// Shopping Cart Functionality
// Note: This is minimal JavaScript for cart functionality
// Phase 1 requirement states JavaScript is NOT necessary, but cart interaction needs it

let cart = [];
let cartTotal = 0;

// Initialize cart from localStorage if available
function initCart() {
    const savedCart = localStorage.getItem('shoppingCart');
    if (savedCart) {
        try {
            let parsed = JSON.parse(savedCart);
            if (Array.isArray(parsed)) {
                parsed = parsed.filter(item => item && item.id !== undefined && item.id !== null);
            } else {
                parsed = [];
            }
            cart = parsed;
        } catch (e) {
            console.error('failed to parse savedCart', e);
            cart = [];
        }
        updateCartDisplay();
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
}

// Add product to cart; only id and quantity are required.  Details will be refreshed from server when the
// cart is rendered.
function addToCart(productId, quantity = 1) {
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: productId,
            quantity: quantity
        });
    }
    
    saveCart();
    updateCartDisplay();
    showCart();
}

// Remove item from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartDisplay();
}

// Update quantity of item in cart
function updateQuantity(productId, quantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = quantity;
            saveCart();
            updateCartDisplay();
        }
    }
}

// Calculate cart total
function calculateTotal() {
    cartTotal = cart.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
    return cartTotal.toFixed(2);
}

// Update cart display
async function updateCartDisplay() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalElement = document.getElementById('cartTotal');
    const cartCountElement = document.querySelector('.cart-count');
    
    if (!cartItemsContainer) return;
    
    // Update cart count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCountElement) {
        cartCountElement.textContent = totalItems;
    }
    
    // Clear cart items
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-message">Your cart is empty</p>';
        if (cartTotalElement) cartTotalElement.textContent = '0.00';
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
        }
        return;
    }
    
    // Display cart items (refresh data from server)
    for (let item of cart) {
        let name = item.name;
        let price = item.price;
        let imgSrc = item.image ? item.image : `public/images/products/product-${item.id}.svg`;
        try {
            const res = await fetch(`/api/product/${encodeURIComponent(item.id)}`);
            if (res.ok) {
                const prod = await res.json();
                name = prod.name || name;
                price = parseFloat(prod.price) || price;
                imgSrc = prod.image_path
                    ? prod.image_path.replace('-large','-thumb')
                    : imgSrc;
            }
        } catch (e) {
            console.error('Error fetching product for cart:', e);
        }

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const imgEl = document.createElement('img');
        imgEl.src = imgSrc;
        imgEl.alt = name;
        imgEl.className = 'cart-item-image';

        const info = document.createElement('div');
        info.className = 'cart-item-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'cart-item-name';
        nameEl.textContent = name;

        const priceEl = document.createElement('div');
        priceEl.className = 'cart-item-price';
        priceEl.textContent = `$${price.toFixed(2)}`;

        const qtyWrap = document.createElement('div');
        qtyWrap.className = 'cart-item-quantity';
        const qtyLabel = document.createElement('label');
        qtyLabel.textContent = 'Qty:';
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.max = '999';
        qtyInput.value = String(item.quantity);
        qtyInput.addEventListener('change', () => {
            updateQuantity(item.id, parseInt(qtyInput.value, 10) || 1);
        });
        qtyWrap.appendChild(qtyLabel);
        qtyWrap.appendChild(qtyInput);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-item-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeFromCart(item.id));

        info.appendChild(nameEl);
        info.appendChild(priceEl);
        info.appendChild(qtyWrap);
        info.appendChild(removeBtn);

        cartItem.appendChild(imgEl);
        cartItem.appendChild(info);
        cartItemsContainer.appendChild(cartItem);
    }
    
    // Update total
    if (cartTotalElement) cartTotalElement.textContent = calculateTotal();
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.disabled = false;
    }
}

// Show cart overlay
function showCart() {
    const cartOverlay = document.getElementById('shoppingCart');
    if (cartOverlay) {
        cartOverlay.classList.add('active');
    }
}

// Hide cart overlay
function hideCart() {
    const cartOverlay = document.getElementById('shoppingCart');
    if (cartOverlay) {
        cartOverlay.classList.remove('active');
    }
}

// Toggle cart overlay
function toggleCart() {
    const cartOverlay = document.getElementById('shoppingCart');
    if (cartOverlay) {
        cartOverlay.classList.toggle('active');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initCart();
    
    // Add to cart buttons (use delegation so dynamically added cards work)
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.add-to-cart-btn, .add-to-cart-btn-large');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const productId = btn.getAttribute('data-product-id');
        const quantityInput = document.getElementById('quantity');
        const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
        addToCart(productId, quantity);
    });
    
    // Cart toggle button
    const cartToggle = document.getElementById('cartToggle');
    if (cartToggle) {
        cartToggle.addEventListener('click', toggleCart);
    }
    
    // Close cart button
    const closeCart = document.getElementById('closeCart');
    if (closeCart) {
        closeCart.addEventListener('click', hideCart);
    }
    
    // Checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
        });
    }
    
    // Close cart when clicking outside (on mobile)
    const cartOverlay = document.getElementById('shoppingCart');
    if (cartOverlay) {
        cartOverlay.addEventListener('click', function(e) {
            if (e.target === cartOverlay) {
                hideCart();
            }
        });
    }
});

// Make functions globally available for inline event handlers
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.showCart = showCart;
window.hideCart = hideCart;
window.toggleCart = toggleCart;
