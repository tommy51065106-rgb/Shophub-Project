// home.js - dynamically load products from server API and inject into index.html

function createProductCard(p) {
    const article = document.createElement('article');
    article.className = 'product-card';

    const link = document.createElement('a');
    link.href = `product.html?id=${encodeURIComponent(p.pid)}`;
    link.className = 'product-link';

    const imgDiv = document.createElement('div');
    imgDiv.className = 'product-image';
    const img = document.createElement('img');
    const thumb = p.image_thumb || (p.image_path ? p.image_path.replace('-large','-thumb') : `/images/products/product-${p.pid}.svg`);
    img.src = thumb;
    img.alt = p.name;
    img.width = 0; // CSS handles sizing
    img.height = 0;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    imgDiv.appendChild(img);

    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = p.name;

    link.appendChild(imgDiv);
    link.appendChild(name);
    article.appendChild(link);

    const info = document.createElement('div');
    info.className = 'product-info';

    const price = document.createElement('p');
    price.className = 'product-price';
    price.textContent = `$${parseFloat(p.price).toFixed(2)}`;

    const button = document.createElement('button');
    button.className = 'add-to-cart-btn';
    button.setAttribute('data-product-id', p.pid);
    button.setAttribute('data-product-name', p.name);
    button.setAttribute('data-product-price', p.price);
    button.setAttribute('data-product-image', img.src);
    button.textContent = 'Add to Cart';

    info.appendChild(price);
    info.appendChild(button);
    article.appendChild(info);

    return article;
}

function loadProducts() {
    fetch('/api/products')
        .then(r => r.json())
        .then(products => {
            const grid = document.getElementById('productsGrid');
            if (!grid) return;
            grid.innerHTML = '';
            products.forEach(p => {
                grid.appendChild(createProductCard(p));
            });
        })
        .catch(console.error);
}

// run on page load
window.addEventListener('DOMContentLoaded', loadProducts);
// reload products when other tabs/pages notify of updates
window.addEventListener('storage', (e) => { if (e.key === 'products_updated') loadProducts(); });
