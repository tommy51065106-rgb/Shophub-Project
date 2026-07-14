import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './ShoppingCart.css';

const ShoppingCart = () => {
    const { 
        cart, 
        isCartOpen, 
        closeCart, 
        removeFromCart, 
        updateQuantity,
        clearCart
    } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [cartDetails, setCartDetails] = useState([]);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const [checkoutSuccess, setCheckoutSuccess] = useState('');

    const handleQuantityChange = (productId, newQuantity) => {
        updateQuantity(productId, parseInt(newQuantity) || 1);
    };

    // whenever the cart (ids+quantities) changes, fetch latest details for each product
    useEffect(() => {
        if (cart.length === 0) {
            setCartDetails([]);
            return;
        }
        const loadDetails = async () => {
            const promises = cart
            .filter(item => item && item.id !== undefined && item.id !== null)
            .map(item =>
                fetch(`/api/product/${encodeURIComponent(item.id)}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(prod => {
                        if (prod) {
                            const image = prod.image_path
                                ? prod.image_path.replace('-large','-thumb')
                                : `/images/products/product-${prod.pid}.svg`;
                            return {
                                id: item.id,
                                quantity: item.quantity,
                                name: prod.name || item.name || '',
                                price: prod.price !== undefined ? parseFloat(prod.price) : 0,
                                image
                            };
                        }
                        // fallback to stored item info if API fails
                        return {
                            id: item.id,
                            quantity: item.quantity,
                            name: item.name || '',
                            price: item.price ? parseFloat(item.price) : 0,
                            image: item.image || `/images/products/product-${item.id}.svg`
                        };
                    })
            );
            const results = await Promise.all(promises);
            setCartDetails(results.filter(Boolean));
        };
        loadDetails();
    }, [cart]);

    const getCsrfToken = async () => {
        const tokenRes = await fetch('/api/csrf-token', { credentials: 'include' });
        if (!tokenRes.ok) throw new Error('Unable to initialize checkout');
        const tokenData = await tokenRes.json();
        if (!tokenData.csrfToken) throw new Error('CSRF token missing');
        return tokenData.csrfToken;
    };

    const handleCheckoutSubmit = async (e) => {
        e.preventDefault();
        setCheckoutError('');
        setCheckoutSuccess('');

        if (!user) {
            setCheckoutError('Please log in before checkout.');
            navigate('/login');
            return;
        }

        if (!cartDetails.length) {
            setCheckoutError('Your cart is empty.');
            return;
        }

        // Only send pid and quantity to the server
        const items = cartDetails.map(item => ({
            pid: item.id,
            quantity: item.quantity
        }));

        setCheckoutLoading(true);
        try {
            const csrfToken = await getCsrfToken();
            const res = await fetch('/api/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({
                    items,
                    currency: 'hkd'
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Checkout initialization failed');
            }

            const stripeRes = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({
                    orderId: data.orderId
                })
            });

            const stripeData = await stripeRes.json();
            if (!stripeRes.ok) {
                throw new Error(stripeData.error || 'Unable to start Stripe checkout');
            }
            if (!stripeData.url) {
                throw new Error('Stripe checkout URL missing');
            }

            // Local order has been stored; clear the cart before handing off to Stripe.
            clearCart();
            setCheckoutSuccess(`Order #${data.orderId} created. Redirecting to Stripe...`);
            window.location.assign(stripeData.url);
        } catch (err) {
            setCheckoutError(err.message || 'Checkout failed');
        } finally {
            setCheckoutLoading(false);
        }
    };

    return (
        <aside 
            className={`shopping-cart-overlay ${isCartOpen ? 'active' : ''}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    closeCart();
                }
            }}
        >
            <div className="cart-content" onClick={(e) => e.stopPropagation()}>
                <div className="cart-header">
                    <h2>Shopping Cart</h2>
                    <button 
                        className="close-cart" 
                        onClick={closeCart}
                        aria-label="Close shopping cart"
                    >
                        ×
                    </button>
                </div>
                <form className="cart-checkout-form" onSubmit={handleCheckoutSubmit}>
                    <div className="cart-items">
                        {cartDetails.length === 0 ? (
                            <p className="empty-cart-message">Your cart is empty</p>
                        ) : (
                            cartDetails.map(item => (
                                <div key={item.id} className="cart-item">
                                    <img 
                                        src={item.image} 
                                        alt={item.name} 
                                        className="cart-item-image"
                                    />
                                    <div className="cart-item-info">
                                        <div className="cart-item-name">{item.name}</div>
                                        <div className="cart-item-price">${(item.price || 0).toFixed(2)}</div>
                                        <div className="cart-item-quantity">
                                            <label htmlFor={`qty-${item.id}`}>Qty:</label>
                                            <input 
                                                id={`qty-${item.id}`}
                                                name={`qty-${item.id}`}
                                                type="number" 
                                                min="1" 
                                                max="999"
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            className="remove-item-btn" 
                                            onClick={() => removeFromCart(item.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="cart-footer">
                        <div className="cart-total">
                            <strong>Total: $<span>{cartDetails.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}</span></strong>
                        </div>
                        {checkoutError ? <p className="checkout-status checkout-error">{checkoutError}</p> : null}
                        {checkoutSuccess ? <p className="checkout-status checkout-success">{checkoutSuccess}</p> : null}
                        <button 
                            type="submit"
                            className="checkout-btn"
                            disabled={cartDetails.length === 0 || checkoutLoading}
                        >
                            {checkoutLoading ? 'Processing...' : 'Checkout'}
                        </button>
                    </div>
                </form>
            </div>
        </aside>
    );
};

export default ShoppingCart;
