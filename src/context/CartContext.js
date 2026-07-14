import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('shoppingCart');
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                // drop any malformed entries that lack an id
                const valid = Array.isArray(parsed)
                    ? parsed.filter(item => item && (item.id !== undefined && item.id !== null))
                    : [];
                setCart(valid);
            } catch (error) {
                console.error('Error loading cart from localStorage:', error);
            }
        }
    }, []);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('shoppingCart', JSON.stringify(cart));
    }, [cart]);

    // store only id & quantity; details (name/price/image) will be pulled from server when rendering
    const addToCart = (productId, quantity = 1) => {
        if (productId === undefined || productId === null) {
            console.warn('addToCart called with invalid id', productId);
            return;
        }
        const q = Math.min(999, Math.max(1, parseInt(quantity, 10) || 1));
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === productId);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === productId
                        ? { ...item, quantity: Math.min(999, item.quantity + q) }
                        : item
                );
            } else {
                return [...prevCart, { id: productId, quantity: q }];
            }
        });
        setIsCartOpen(true);
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };

    const clearCart = () => {
        setCart([]);
    };

    const updateQuantity = (productId, quantity) => {
        const q = parseInt(quantity, 10) || 0;
        if (q <= 0) {
            removeFromCart(productId);
        } else {
            const clamped = Math.min(999, Math.max(1, q));
            setCart(prevCart =>
                prevCart.map(item =>
                    item.id === productId
                        ? { ...item, quantity: clamped }
                        : item
                )
            );
        }
    };

    const calculateTotal = () => {
        // cart items may not include price, so guard against undefined
        return cart.reduce((total, item) => {
            const p = item.price ? parseFloat(item.price) : 0;
            return total + (p * item.quantity);
        }, 0).toFixed(2);
    };

    const getTotalItems = () => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    };

    const toggleCart = () => {
        setIsCartOpen(prev => !prev);
    };

    const closeCart = () => {
        setIsCartOpen(false);
    };

    const value = {
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        updateQuantity,
        calculateTotal,
        getTotalItems,
        isCartOpen,
        toggleCart,
        closeCart
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};
