// product.js - load a single product based on ?id query string and render page

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function renderProduct(product) {
    const container = document.getElementById('productDetailContainer');
    if (!container) return;

    const imgSrc = product.image_path
        ? product.image_path.replace('-large', '-thumb')
        : `/images/products/product-${product.pid}.svg`;

    container.textContent = '';
    const imgSection = document.createElement('div');
    imgSection.className = 'product-image-section';
    const imgWrap = document.createElement('div');
    imgWrap.className = 'product-main-image';
    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = product.name;
    imgWrap.appendChild(img);
    imgSection.appendChild(imgWrap);

    const infoSection = document.createElement('div');
    infoSection.className = 'product-info-section';

    const h1 = document.createElement('h1');
    h1.className = 'product-title';
    h1.textContent = product.name;

    const rating = document.createElement('div');
    rating.className = 'product-rating';
    const stars = document.createElement('span');
    stars.className = 'stars';
    stars.textContent = '★★★★★';
    const reviews = document.createElement('span');
    reviews.className = 'review-count';
    reviews.textContent = '(128 reviews)';
    rating.appendChild(stars);
    rating.appendChild(reviews);

    const priceLarge = document.createElement('div');
    priceLarge.className = 'product-price-large';
    const priceSpan = document.createElement('span');
    priceSpan.className = 'price';
    priceSpan.textContent = `$${parseFloat(product.price).toFixed(2)}`;
    priceLarge.appendChild(priceSpan);
    if (product.originalPrice) {
        const orig = document.createElement('span');
        orig.className = 'original-price';
        orig.textContent = `$${parseFloat(product.originalPrice).toFixed(2)}`;
        const badge = document.createElement('span');
        badge.className = 'discount-badge';
        badge.textContent = `${Math.round(
            ((product.originalPrice - product.price) / product.originalPrice) * 100
        )}% OFF`;
        priceLarge.appendChild(orig);
        priceLarge.appendChild(badge);
    }

    const descBlock = document.createElement('div');
    descBlock.className = 'product-description';
    const descTitle = document.createElement('h2');
    descTitle.textContent = 'Description';
    const descP = document.createElement('p');
    descP.textContent = product.description || '';
    descBlock.appendChild(descTitle);
    descBlock.appendChild(descP);
    if (Array.isArray(product.features) && product.features.length) {
        const ul = document.createElement('ul');
        ul.className = 'product-features';
        product.features.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            ul.appendChild(li);
        });
        descBlock.appendChild(ul);
    }

    const actions = document.createElement('div');
    actions.className = 'product-actions';
    const qtySel = document.createElement('div');
    qtySel.className = 'quantity-selector';
    const qtyLabel = document.createElement('label');
    qtyLabel.htmlFor = 'quantity';
    qtyLabel.textContent = 'Quantity:';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.id = 'quantity';
    qtyInput.name = 'quantity';
    qtyInput.min = '1';
    qtyInput.max = '999';
    qtyInput.value = '1';
    qtyInput.className = 'quantity-input';
    qtySel.appendChild(qtyLabel);
    qtySel.appendChild(qtyInput);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-to-cart-btn-large';
    addBtn.dataset.productId = String(product.pid);
    addBtn.dataset.productName = product.name;
    addBtn.dataset.productPrice = String(product.price);
    addBtn.dataset.productImage = imgSrc;
    addBtn.textContent = 'Add to Cart';

    actions.appendChild(qtySel);
    actions.appendChild(addBtn);

    const shipping = document.createElement('div');
    shipping.className = 'product-shipping';
    const p1 = document.createElement('p');
    const s1 = document.createElement('strong');
    s1.textContent = 'Free Shipping';
    p1.appendChild(s1);
    p1.appendChild(document.createTextNode(' on orders over $50'));
    const p2 = document.createElement('p');
    p2.textContent = 'Estimated delivery: 2-3 business days';
    shipping.appendChild(p1);
    shipping.appendChild(p2);

    infoSection.appendChild(h1);
    infoSection.appendChild(rating);
    infoSection.appendChild(priceLarge);
    infoSection.appendChild(descBlock);
    infoSection.appendChild(actions);
    infoSection.appendChild(shipping);

    container.appendChild(imgSection);
    container.appendChild(infoSection);

    const breadcrumb = document.querySelector('.breadcrumb-nav ul');
    if (breadcrumb) {
        breadcrumb.textContent = '';
        const li1 = document.createElement('li');
        const a1 = document.createElement('a');
        a1.href = 'index.html';
        a1.textContent = 'Home';
        li1.appendChild(a1);
        const li2 = document.createElement('li');
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '>';
        li2.appendChild(sep);
        const li3 = document.createElement('li');
        const cur = document.createElement('span');
        cur.className = 'breadcrumb-current';
        cur.textContent = product.name;
        li3.appendChild(cur);
        breadcrumb.appendChild(li1);
        breadcrumb.appendChild(li2);
        breadcrumb.appendChild(li3);
    }
}

function loadProduct() {
    const id = getQueryParam('id');
    if (!id) return;

    fetch(`/api/product/${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(renderProduct)
        .catch(console.error);
}

window.addEventListener('DOMContentLoaded', loadProduct);
