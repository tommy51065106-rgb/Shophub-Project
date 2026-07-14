import React from 'react';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="main-footer">
            <div className="footer-container">
                <section className="footer-section">
                    <h3>About Us</h3>
                    <p>ShopHub is your one-stop destination for quality products at great prices.</p>
                </section>
                <section className="footer-section">
                    <h3>Customer Service</h3>
                    <ul>
                        <li><a href="#contact">Contacttt Us</a></li>
                        <li><a href="#shipping">Shipping Info</a></li>
                        <li><a href="#returns">Returns</a></li>
                    </ul>
                </section>
                <section className="footer-section">
                    <h3>Follow Us</h3>
                    <ul>
                        <li><a href="#facebook">Facebook</a></li>
                        <li><a href="#twitter">Twitter</a></li>
                        <li><a href="#instagram">Instagram</a></li>
                    </ul>
                </section>
            </div>
            <div className="footer-bottom">
                <p>&copy; 2026 ShopHub. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer;
