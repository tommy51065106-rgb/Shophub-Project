/**
 * Local product image paths.
 * All images are stored in public/images/products/
 * Use these paths instead of web URLs so photos work offline and with your own files.
 *
 * To use your own photos:
 * 1. Add image files (jpg, png, svg) to public/images/products/
 * 2. Update the paths below to match your filenames (e.g. '/images/products/headphones.jpg')
 */

const IMG_BASE = '/images/products';

/** Map of product id -> array of image paths for the product detail page slider */
export const productDetailImages = {
    1: [
        `${IMG_BASE}/product-1.svg`,
        `${IMG_BASE}/product-1-2.svg`,
        `${IMG_BASE}/product-1-3.svg`,
    ],
    2: [
        `${IMG_BASE}/product-2.svg`,
        `${IMG_BASE}/product-2-2.svg`,
    ],
    3: [
        `${IMG_BASE}/product-3.svg`,
        `${IMG_BASE}/product-3-2.svg`,
    ],
    4: [
        `${IMG_BASE}/product-4.svg`,
        `${IMG_BASE}/product-4-2.svg`,
    ],
    5: [`${IMG_BASE}/product-5.svg`],
    6: [`${IMG_BASE}/product-6.svg`],
    7: [`${IMG_BASE}/product-7.svg`],
    8: [`${IMG_BASE}/product-8.svg`],
};

/** Single image path per product for the home page product cards */
export const productCardImages = {
    1: `${IMG_BASE}/product-1.svg`,
    2: `${IMG_BASE}/product-2.svg`,
    3: `${IMG_BASE}/product-3.svg`,
    4: `${IMG_BASE}/product-4.svg`,
    5: `${IMG_BASE}/product-5.svg`,
    6: `${IMG_BASE}/product-6.svg`,
    7: `${IMG_BASE}/product-7.svg`,
    8: `${IMG_BASE}/product-8.svg`,
};

export function getProductImages(productId) {
    return productDetailImages[productId] || [productCardImages[productId] || `${IMG_BASE}/product-1.svg`];
}

export function getProductCardImage(productId) {
    return productCardImages[productId] || productCardImages[1];
}
