import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
    const { addToCart } = useCart();

    const handleAddToCart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // only need id and quantity now; details will be fetched when cart displays
        addToCart(product.id, 1);
    };

    return (
        <article className="product-card">
            <Link to={`/product/${product.id}`} className="product-link">
                <div className="product-image">
                    <img src={product.image} alt={product.name} width="100%" height="100%" />
                </div>
                <h3 className="product-name">{product.name}</h3>
            </Link>
            <div className="product-info">
                <p className="product-price">${product.price.toFixed(2)}</p>
                <button 
                    className="add-to-cart-btn" 
                    onClick={handleAddToCart}
                >
                    Add to Cart
                </button>
            </div>
        </article>
    );
};

export default ProductCard;
