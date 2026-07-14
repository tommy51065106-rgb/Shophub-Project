import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Header.css';

const Header = () => {
    const { toggleCart, getTotalItems } = useCart();
    const totalItems = getTotalItems();
    const [categories, setCategories] = useState([]);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    //nav bar
    useEffect(() => {
        // grab categories once on mount for nav links
        fetch('/api/categories')
            .then(r => r.json())
            .then(setCategories)
            .catch(console.error);
    }, []);

    const handleLogout = async () => {
      await logout();
      navigate('/');
    };

    return (
        <header className="main-header">
            <div className="header-container">
                <Link to="/" className="logo-link">
                    <h1 className="logo">ShopHub</h1>
                </Link>
                <nav className="main-nav">
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        {categories.map(c => (
                            <li key={c.catid}>
                                <Link to={`/?catid=${c.catid}`}>{c.name}</Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="cart-icon-container">
                    <button 
                        className="cart-toggle" 
                        onClick={toggleCart}
                        aria-label="Toggle shopping cart"
                    >
                        <span className="cart-icon">🛒</span>
                        <span className="cart-count">{totalItems}</span>
                    </button>
                </div>
                <div className="auth-status">
                    <span>
                        Hello, {user ? (user.name || 'guest') : 'guest'}
                        {user && user.is_admin ? ' (admin)' : null}
                    </span>
                    <div className="auth-links">
                      {user ? (
                        <>
                                                    <Link to="/member/orders">My Orders</Link>
                          <Link to="/change-password">Change Password</Link>
                          <button className="link-button" onClick={handleLogout}>
                            Logout
                          </button>
                        </>
                      ) : (
                        <>
                          <Link to="/login">Login</Link>
                          <Link to="/register">Register</Link>
                        </>
                      )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
