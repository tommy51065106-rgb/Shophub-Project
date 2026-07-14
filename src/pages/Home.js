import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import ProductCard from '../components/ProductCard';
import './Home.css';

const Home = () => {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [currentPageUrl, setCurrentPageUrl] = useState('https://example.com');
    const [searchParams, setSearchParams] = useSearchParams();
    const catidParam = searchParams.get('catid') || '';

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setCurrentPageUrl(window.location.href);
        }
    }, []);

    useEffect(() => {
        fetch('/api/categories')
            .then(r => r.json())
            .then(setCategories)
            .catch(console.error);
    }, []);

    useEffect(() => {
        const qs = catidParam ? `?catid=${encodeURIComponent(catidParam)}` : '';
        fetch(`/api/products${qs}`)
            .then(r => r.json())
            .then(data => {
                const mapped = data.map(p => {
                    // server now provides image_thumb, fall back if missing
                    const thumb = p.image_thumb ||
                        (p.images && p.images.length ? p.images[0].replace('-large','-thumb') :
                            (p.image_path ? p.image_path.replace('-large','-thumb') : `/images/products/product-${p.pid}.svg`));
                    return {
                        id: p.pid,
                        name: p.name,
                        price: p.price,
                        image: thumb
                    };
                });
                setProducts(mapped);
            })
            .catch(console.error);
    }, [catidParam]);

    const handleCategoryChange = (e) => {
        const cid = e.target.value;
        if (cid) setSearchParams({ catid: cid });
        else setSearchParams({});
    };

    const breadcrumbItems = [
        { label: 'Home', link: '/' }
    ];

    return (
        <div className="home-page">
            <Breadcrumb items={breadcrumbItems} />
            <main className="main-content">
                <section className="hero-section">
                    <h2>Welcome to ShopHub</h2>
                    <p>Discover amazing products at unbeatable prices</p>
                </section>

                <section className="filter-section">
                    <label>
                        Category:&nbsp;
                        <select value={catidParam} onChange={handleCategoryChange}>
                            <option value="">All</option>
                            {categories.map(c => (
                                <option key={c.catid} value={c.catid}>{c.name}</option>
                            ))}
                        </select>
                    </label>
                </section>

                <section className="products-section">
                    <h2 className="section-title">Products</h2>
                    <div className="products-grid">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>

                <section className="social-section" aria-label="Social media mashup">
                    <h2 className="section-title">Follow Us on Meta</h2>
                    <p className="social-description">Stay updated with product drops, offers, and announcements.</p>

                    <a
                        className="meta-share-link"
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentPageUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Share this page on Facebook
                    </a>
                </section>
            </main>
        </div>
    );
};

export default Home;
