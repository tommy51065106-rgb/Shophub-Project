import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import ImageSlider from './ImageSlider';
import './ProductDetail.css';

function getMediaTypeFromUrl(url) {
    const value = String(url || '').toLowerCase();
    if (/^data:video\//.test(value)) return 'video';
    if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(value)) return 'video';
    return 'image';
}

function normalizeMediaItems(product) {
    const candidates = [];
    if (Array.isArray(product.images)) candidates.push(...product.images);
    if (product.image_path) candidates.push(product.image_path);
    if (Array.isArray(product.videos)) candidates.push(...product.videos);
    if (Array.isArray(product.video_urls)) candidates.push(...product.video_urls);
    if (typeof product.video_url === 'string') candidates.push(product.video_url);
    if (typeof product.video === 'string') candidates.push(product.video);

    const seen = new Set();
    const unique = candidates
        .map(src => String(src || '').trim())
        .filter(src => src && !seen.has(src) && seen.add(src));

    if (!unique.length) {
        return [{
            type: 'image',
            src: `/images/products/product-${product.pid}.svg`
        }];
    }

    return unique.map(src => ({
        type: getMediaTypeFromUrl(src),
        src
    }));
}

const ProductDetail = () => {
    const { id } = useParams();
    const { addToCart } = useCart();
    const [quantity, setQuantity] = useState(1);
    const [product, setProduct] = useState(null);
    const [relatedProducts, setRelatedProducts] = useState([]);

    useEffect(() => {
        fetch(`/api/product/${id}`)
            .then(r => {
                if (!r.ok) throw new Error('network response not ok');
                return r.json();
            })
            .then(data => {
                if (data) {
                    // normalize to include `id` and numeric price
                    setProduct({
                        ...data,
                        id: data.pid,
                        price: data.price !== undefined ? parseFloat(data.price) : 0
                    });
                }
            })
            .catch(console.error);
    }, [id]);

    useEffect(() => {
        if (!product) return;
        fetch(`/api/products?catid=${product.catid}`)
            .then(r => r.json())
            .then(data => {
                const mapped = data
                    .filter(p => p.pid !== product.pid)
                    .slice(0, 4)
                    .map(p => ({
                        id: p.pid,
                        name: p.name,
                        price: p.price,
                        image: p.image_path
                            ? p.image_path.replace('-large', '-thumb')
                            : `/images/products/product-${p.pid}.svg`
                    }));
                setRelatedProducts(mapped);
            })
            .catch(console.error);
    }, [product]);

    if (!product) {
        return <div>Loading...</div>;
    }

    const discount = product.originalPrice 
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0;
    
    const productMedia = normalizeMediaItems(product);
    const features = Array.isArray(product.features) ? product.features : [];
    const description = product.description || '';

    const breadcrumbItems = [
        { label: 'Home', link: '/' },
        { label: product.category_name || 'Category', link: `/?catid=${product.catid}` },
        { label: product.name }
    ];

    // determine which image should appear in the cart (thumb if uploaded, fallback svg)
    const handleAddToCart = () => {
        // quantity only; details come from server when cart is rendered
        addToCart(product.id, quantity);
    };

    const handleQuantityChange = (e) => {
        const newQuantity = parseInt(e.target.value, 10) || 1;
        setQuantity(Math.min(999, Math.max(1, newQuantity)));
    };


    return (
        <div className="product-detail-page">
            <Breadcrumb items={breadcrumbItems} />
            <main className="main-content">
                <section className="product-detail-section">
                    <div className="product-detail-container">
                        <div className="product-image-section">
                            <ImageSlider mediaItems={productMedia} productName={product.name} />
                        </div>
                        <div className="product-info-section">
                            <h1 className="product-title">{product.name}</h1>
                            <div className="product-rating">
                                <span className="stars">★★★★★</span>
                                <span className="review-count">(128 reviews)</span>
                            </div>
                            <div className="product-price-large">
                                <span className="price">${product.price.toFixed(2)}</span>
                                {product.originalPrice && (
                                    <>
                                        <span className="original-price">${product.originalPrice.toFixed(2)}</span>
                                        <span className="discount-badge">{discount}% OFF</span>
                                    </>
                                )}
                            </div>
                            <div className="product-description">
                                <h2>Description</h2>
                                <p>{description}</p>
                                {features.length > 0 && (
                                    <ul className="product-features">
                                        {features.map((feature, index) => (
                                            <li key={index}>{feature}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="product-actions">
                                <div className="quantity-selector">
                                    <label htmlFor="quantity">Quantity:</label>
                                    <input 
                                        type="number" 
                                        id="quantity" 
                                        name="quantity" 
                                        min="1" 
                                        max="999"
                                        value={quantity}
                                        onChange={handleQuantityChange}
                                        className="quantity-input"
                                    />
                                </div>
                                <button 
                                    className="add-to-cart-btn-large"
                                    onClick={handleAddToCart}
                                >
                                    Add to Cart
                                </button>
                            </div>
                            <div className="product-shipping">
                                <p><strong>Free Shipping</strong> on orders over $50</p>
                                <p>Estimated delivery: 2-3 business days</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="related-products-section">
                    <h2 className="section-title">You May Also Like</h2>
                    <div className="products-grid">
                        {relatedProducts.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default ProductDetail;
