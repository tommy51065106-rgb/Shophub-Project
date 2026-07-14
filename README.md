# ShopHub

ShopHub is a full-stack e-commerce web application built with React, Express, and SQLite.
It delivers a complete online shopping workflow: catalog browsing, authentication, cart and checkout, order tracking, and admin product management.

## Recruiter Quick Scan

- End-to-end full-stack delivery (frontend, backend API, database, security).
- Real-world backend concerns: auth sessions, CSRF, input validation, and payment webhooks.
- Admin tooling with product CRUD and media upload pipeline.
- Production-minded behavior: static asset serving, API routing, and environment-based configuration.

## Why This Project

- Built an end-to-end shopping system from UI to database-backed APIs.
- Implemented secure session authentication and CSRF protection.
- Added production-style image upload and resizing pipeline.
- Integrated payment flows with Stripe and PayPal webhook handling.

## Resume-Friendly Highlights

- Designed and implemented 20+ REST endpoints across auth, catalog, orders, and payments.
- Built secure user/session flows with role-based access controls for admin operations.
- Implemented multi-image upload processing with server-side resizing and persistent metadata storage.
- Structured the codebase into clear frontend, backend, and admin modules for maintainability.

## Core Features

- Customer storefront with category filter, product detail pages, and cart UX.
- Authentication: register, login, logout, password change, and session-based user state.
- Member order history (`/api/my/orders`).
- Admin dashboard for category and product management.
- Product image uploads with automatic large and thumbnail generation.
- Checkout and payment endpoints for Stripe and PayPal.

## Tech Stack

- Frontend: React 18, React Router 6, Swiper
- Backend: Node.js, Express
- Database: SQLite3
- Upload/Image processing: Multer, Sharp
- Payments: Stripe SDK, PayPal API

## Security Highlights

- CSRF token issuance and server-side CSRF validation.
- HttpOnly cookie session auth with role checks for admin routes.
- Input sanitization and server-side validation.
- Content Security Policy with script nonce injection.
- Disabled x-powered-by and hardened response headers.

## Architecture Overview

```text
src/                    React storefront (customer UI)
public/admin/           Admin HTML pages
admin-client/           Admin-side JS modules
server.js               Express API + auth + payment + static serving
db.js                   SQLite schema/init/data access helpers
security.js             Security middleware + validation helpers
data/                   SQLite database files
public/images/products/ Processed product assets
uploads/                Temporary upload storage
```

## API Surface (Selected)

Auth and account:

- `GET /api/csrf-token`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

Catalog and admin:

- `GET /api/categories`
- `POST /api/categories` (admin)
- `GET /api/products`
- `GET /api/product/:id`
- `POST /api/products/create` (admin)
- `POST /api/products/update` (admin)
- `POST /api/products/delete` (admin)

Orders and payments:

- `POST /api/create-order`
- `GET /api/my/orders`
- `GET /api/admin/orders` (admin)
- `POST /api/create-payment-intent`
- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/webhook`
- `POST /api/paypal/create-checkout-order`
- `POST /api/paypal/webhook`

## Getting Started

Run from repository root:

```bash
npm install
npm start
```

Default app URL: `http://localhost:3000`

`npm start` starts the real website server and auto-opens the browser.

## Scripts

Inside `package.json`:

- `npm start`: Start Express server on port 3000 (auto-opens browser)
- `npm run start:dev`: Start React development server on port 3000
- `npm run build`: Build React production assets
- `npm run server`: Alias of `npm start`
- `npm run kill:3000`: Force-kill any process bound to port 3000
- `npm test`: Run React test command

## Environment Variables

Copy `.env.example` to `.env` and adjust values:

- `PORT` (default `3000`)
- `BUILD_PATH` (example: `dist`)
- `APP_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `REACT_APP_STRIPE_PUBLISHABLE_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_API_BASE`
- `MERCHANT_EMAIL`

## Image Handling Pipeline

When product images are uploaded:

- Large version generated for detail pages (up to 1024x1024).
- Thumbnail generated for listing pages (300x300).
- Paths stored in database for consistent frontend rendering.

## Notes for Reviewers

- This repository includes both current React/Express implementation and legacy static assets from earlier phases.
- The canonical runtime entrypoint is `npm start`.

## Author

Built as an academic project and extended into a portfolio-quality full-stack application.


