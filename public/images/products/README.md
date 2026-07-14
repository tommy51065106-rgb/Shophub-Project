# Product Images

This folder holds **local product photos** used by the shop instead of web links.

## Current files

- `product-1.svg`, `product-1-2.svg`, `product-1-3.svg` – Wireless Headphones (main + slider)
- `product-2.svg`, `product-2-2.svg` – Smart Watch
- `product-3.svg`, `product-3-2.svg` – Laptop Stand
- `product-4.svg`, `product-4-2.svg` – USB-C Cable
- `product-5.svg` – Wireless Mouse
- `product-6.svg` – Mechanical Keyboard
- `product-7.svg` – Monitor Stand
- `product-8.svg` – Webcam HD

The `.svg` files are placeholders. You can replace them with your own images.

## Using your own photos

1. Add your image files here (e.g. `headphones.jpg`, `watch-1.png`).
2. Update **`src/data/productImages.js`** so the paths point to your files:
   - `productCardImages` – one image per product (home page cards).
   - `productDetailImages` – array of images per product (product page slider).

Example for product 1:

```js
// In src/data/productImages.js
productCardImages: {
  1: '/images/products/headphones.jpg',
  // ...
},
productDetailImages: {
  1: [
    '/images/products/headphones-front.jpg',
    '/images/products/headphones-side.jpg',
    '/images/products/headphones-back.jpg',
  ],
  // ...
}
```

Paths are relative to the `public` folder, so use `/images/products/yourfile.jpg`.
