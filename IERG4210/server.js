/**
 * Node.js/Express server for ShopHub
 * - Hides Node version (no X-Powered-By header)
 * - Does not display warnings
 *
 * Use this server to serve the React build and for backend APIs (e.g. payment gateway).
 * Build React first: npm run build  (with .env BUILD_PATH=dist outputs to ./dist)
 * Then run: node server.js  (or: npm run server)
 */

process.removeAllListeners('warning');
process.on('warning', () => {});

require('dotenv').config({ quiet: true });

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const { exec } = require('child_process');
const Stripe = require('stripe');
const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
const stripeWebhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const appBaseUrl = (process.env.APP_BASE_URL || '').trim();
const stripe = stripeSecretKey ? Stripe(stripeSecretKey) : null;
const paypalClientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
const paypalClientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
const paypalWebhookId = (process.env.PAYPAL_WEBHOOK_ID || '').trim();
const paypalApiBase = (process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').trim();

const {
  securityHeaders,
  injectScriptNonces,
  issueCsrfToken,
  requireCsrf,
  sanitizeText,
  parsePositiveInt,
  validatePrice,
  hashPassword,
  verifyPassword,
  parseImagesJson,
  safePublicImagePath,
  MAX_CATEGORY_NAME,
  MAX_PRODUCT_NAME,
  MAX_DESCRIPTION
} = require('./security');

const { db, init } = require('./db');

/** CRA: set BUILD_PATH=dist in .env so output avoids a broken/locked ./build folder on Windows. */
function resolveBuildDir() {
  const fromEnv = (process.env.BUILD_PATH || '').trim();
  const order = fromEnv ? [fromEnv, 'dist', 'build'] : ['dist', 'build'];
  const seen = new Set();
  for (const dir of order) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    try {
      if (fs.existsSync(path.join(__dirname, dir, 'index.html'))) return dir;
    } catch (_) {
      /* EPERM */
    }
  }
  console.warn('[ShopHub] No dist/index.html or build/index.html — run: npm run build');
  return fromEnv || 'dist';
}

const BUILD_DIR = resolveBuildDir();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cookieParser());
app.use(securityHeaders);
app.use(express.json({
  limit: '256kb',
  verify(req, res, buf) {
    if (req.originalUrl === '/api/stripe/webhook') {
      req.rawBody = Buffer.from(buf);
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

const imagesDir = path.join(__dirname, 'public', 'images', 'products');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

init();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.mimetype);
    cb(null, ok);
  }
});

app.get('/api/csrf-token', issueCsrfToken);

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    expires
  });
}

function clearAuthCookie(res) {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
}

function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.auth_token;
  if (!token) {
    req.user = null;
    return next();
  }
  db.get('SELECT sessions.userid, sessions.expires, users.email, users.name, users.is_admin FROM sessions JOIN users ON sessions.userid = users.userid WHERE sessions.token = ?', [token], (err, row) => {
    if (err || !row) {
      req.user = null;
      return next();
    }
    if (Date.now() > row.expires) {
      db.run('DELETE FROM sessions WHERE token = ?', [token]);
      req.user = null;
      return next();
    }
    req.user = {
      userid: row.userid,
      email: row.email,
      name: row.name || 'guest',
      is_admin: row.is_admin === 1
    };
    req.sessionToken = token;
    next();
  });
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

function isHttpsRequest(req) {
  if (req.secure) return true;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return forwarded === 'https';
}

function buildDigestFromFields(currency, merchantEmail, salt, items, totalAmount) {
  const sortedItems = [...items].sort((a, b) => a.pid - b.pid);
  const itemParts = sortedItems
    .map(item => `${item.pid}:${item.quantity}:${Number(item.price).toFixed(2)}`)
    .join('|');
  const digestInput = [
    String(currency || '').toLowerCase(),
    String(merchantEmail || '').toLowerCase(),
    String(salt || ''),
    itemParts,
    Number(totalAmount).toFixed(2)
  ].join('|');
  return crypto.createHash('sha256').update(digestInput).digest('hex');
}

function getPublicBaseUrl(req) {
  const fallbackOrigin = String(req.headers.origin || '').trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').trim().toLowerCase();
  const protocol = forwardedProto || (req.secure ? 'https' : 'http');
  const host = String(req.headers.host || '').trim();
  const requestBase = host ? `${protocol}://${host}` : fallbackOrigin;

  const configured = String(appBaseUrl || '').trim().replace(/\/$/, '');
  const requestHost = String(req.hostname || '').toLowerCase();
  const configuredHost = configured ? String(new URL(configured).hostname || '').toLowerCase() : '';
  const configuredIsLocal = configuredHost === 'localhost' || configuredHost === '127.0.0.1';
  const requestIsLocal = requestHost === 'localhost' || requestHost === '127.0.0.1' || requestHost === '::1';

  // If APP_BASE_URL is accidentally left as localhost on a public server,
  // prefer the current request host to avoid redirecting users to localhost.
  const baseUrl = (configured && !(configuredIsLocal && !requestIsLocal) ? configured : requestBase).replace(/\/$/, '');

  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error('APP_BASE_URL or request origin must be an absolute URL');
  }
  return baseUrl;
}

function parseStoredOrderItems(itemsJson) {
  let parsedItems;
  try {
    parsedItems = JSON.parse(itemsJson || '[]');
  } catch {
    throw new Error('order items are invalid');
  }

  if (!Array.isArray(parsedItems) || !parsedItems.length) {
    throw new Error('order has no items');
  }

  return parsedItems.map(item => ({
    pid: Number(item.pid),
    name: String(item.name || `Product ${item.pid}`),
    quantity: Number(item.quantity),
    price: Number(item.price)
  }));
}

function sqliteUtcToIso(timestampValue) {
  const raw = String(timestampValue || '').trim();
  if (!raw) return null;
  // SQLite CURRENT_TIMESTAMP format is UTC: YYYY-MM-DD HH:MM:SS
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
}

function normalizeStripePaymentIntentId(paymentIntent) {
  if (!paymentIntent) return null;
  if (typeof paymentIntent === 'string') return paymentIntent;
  if (typeof paymentIntent.id === 'string') return paymentIntent.id;
  return null;
}

function parseStripeLineItemsForDigest(lineItems) {
  const normalizedItems = [];

  for (const lineItem of lineItems) {
    const product = lineItem && lineItem.price && typeof lineItem.price.product === 'object'
      ? lineItem.price.product
      : null;
    const pidParsed = parsePositiveInt(product && product.metadata ? product.metadata.pid : null, 'stripe item pid');
    if (pidParsed.error) throw new Error('Stripe line item pid metadata is missing or invalid');

    const qtyParsed = parsePositiveInt(lineItem && lineItem.quantity, 'stripe item quantity');
    if (qtyParsed.error) throw new Error('Stripe line item quantity is missing or invalid');

    const unitAmountCents = Number(lineItem && lineItem.price ? lineItem.price.unit_amount : NaN);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      throw new Error('Stripe line item price is missing or invalid');
    }

    normalizedItems.push({
      pid: pidParsed.value,
      quantity: qtyParsed.value,
      price: unitAmountCents / 100
    });
  }

  if (!normalizedItems.length) {
    throw new Error('Stripe session does not contain any line items');
  }

  return normalizedItems;
}

async function getPayPalAccessToken() {
  if (!paypalClientId || !paypalClientSecret) {
    throw new Error('PayPal credentials are not configured');
  }
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable in this Node.js runtime');
  }

  const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
  const tokenRes = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error('Failed to get PayPal access token');
  }
  return tokenJson.access_token;
}

async function verifyPayPalWebhookSignature(reqBody, reqHeaders) {
  if (!paypalWebhookId) {
    throw new Error('PAYPAL_WEBHOOK_ID is not configured');
  }

  const accessToken = await getPayPalAccessToken();
  const verifyRes = await fetch(`${paypalApiBase}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      auth_algo: reqHeaders['paypal-auth-algo'],
      cert_url: reqHeaders['paypal-cert-url'],
      transmission_id: reqHeaders['paypal-transmission-id'],
      transmission_sig: reqHeaders['paypal-transmission-sig'],
      transmission_time: reqHeaders['paypal-transmission-time'],
      webhook_id: paypalWebhookId,
      webhook_event: reqBody
    })
  });

  const verifyData = await verifyRes.json();
  return verifyRes.ok && verifyData && verifyData.verification_status === 'SUCCESS';
}

async function fetchPayPalOrderDetails(paypalOrderId) {
  const accessToken = await getPayPalAccessToken();
  const detailsRes = await fetch(`${paypalApiBase}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const details = await detailsRes.json();
  if (!detailsRes.ok) {
    throw new Error('Failed to fetch PayPal order details');
  }
  return details;
}

function parsePayPalItemsForDigest(paypalOrder) {
  const purchaseUnit = Array.isArray(paypalOrder.purchase_units) ? paypalOrder.purchase_units[0] : null;
  const items = Array.isArray(purchaseUnit && purchaseUnit.items) ? purchaseUnit.items : [];
  const normalized = [];

  for (const item of items) {
    const pidParsed = parsePositiveInt(item && item.sku, 'paypal item sku');
    if (pidParsed.error) throw new Error('PayPal item sku(pid) missing or invalid');

    const qtyParsed = parsePositiveInt(item && item.quantity, 'paypal item quantity');
    if (qtyParsed.error) throw new Error('PayPal item quantity missing or invalid');

    const unitValue = Number(item && item.unit_amount && item.unit_amount.value);
    if (!Number.isFinite(unitValue) || unitValue <= 0) throw new Error('PayPal item price missing or invalid');

    normalized.push({
      pid: pidParsed.value,
      quantity: qtyParsed.value,
      price: unitValue
    });
  }

  if (!normalized.length) throw new Error('PayPal order items are missing');
  return normalized;
}

app.use(authMiddleware);

app.post('/api/auth/register', requireCsrf, (req, res) => {
  const email = sanitizeText(req.body.email || '', 256).toLowerCase();
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm_password || '');
  const name = sanitizeText(req.body.name || '', 64) || 'guest';

  if (!email || !password || !confirm) return res.status(400).json({ error: 'Missing fields' });
  if (password !== confirm) return res.status(400).json({ error: 'Passwords do not match' });

  db.get('SELECT userid FROM users WHERE email = ?', [email], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    const hashed = hashPassword(password);
    db.run('INSERT INTO users(email,password,name,is_admin) VALUES (?,?,?,0)', [email, hashed, name], function (err2) {
      if (err2) return res.status(500).json({ error: 'Server error' });
      const userid = this.lastID;
      const token = createSessionToken();
      const expires = Date.now() + 24 * 60 * 60 * 1000;
      db.run('INSERT INTO sessions(token, userid, expires) VALUES (?,?,?)', [token, userid, expires], err3 => {
        if (err3) return res.status(500).json({ error: 'Server error' });
        setAuthCookie(res, token);
        res.json({ message: 'Registered', userid });
      });
    });
  });
});

app.post('/api/auth/login', requireCsrf, (req, res) => {
  const email = sanitizeText(req.body.email || '', 256).toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  db.get('SELECT userid, password, is_admin, name FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!user) return res.status(400).json({ error: 'Email or password incorrect' });
    if (!verifyPassword(password, user.password)) return res.status(400).json({ error: 'Email or password incorrect' });

    const token = createSessionToken();
    const expires = Date.now() + 24 * 60 * 60 * 1000;

    db.run('DELETE FROM sessions WHERE userid = ?', [user.userid], () => {
      db.run('INSERT INTO sessions(token, userid, expires) VALUES (?,?,?)', [token, user.userid, expires], err2 => {
        if (err2) return res.status(500).json({ error: 'Server error' });
        setAuthCookie(res, token);
        res.json({ message: 'Logged in', is_admin: user.is_admin === 1, name: user.name || 'guest' });
      });
    });
  });
});

app.post('/api/auth/logout', requireCsrf, (req, res) => {
  const token = req.cookies && req.cookies.auth_token;
  if (token) {
    db.run('DELETE FROM sessions WHERE token = ?', [token]);
  }
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
});

// Create order: validate items, compute digest, store in DB, return orderId + digest
app.post('/api/create-order', requireCsrf, requireAuth, async (req, res) => {
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (!rawItems.length) return res.status(400).json({ error: 'items required' });

  const quantityByPid = new Map();
  for (const item of rawItems) {
    const pidParsed = parsePositiveInt(item && item.pid, 'item pid');
    if (pidParsed.error) return res.status(400).json({ error: 'invalid item pid' });
    const qtyParsed = parsePositiveInt(item && item.quantity, 'item quantity');
    if (qtyParsed.error) return res.status(400).json({ error: 'invalid item quantity' });
    if (qtyParsed.value > 999) return res.status(400).json({ error: 'item quantity too large' });
    const prev = quantityByPid.get(pidParsed.value) || 0;
    quantityByPid.set(pidParsed.value, prev + qtyParsed.value);
  }

  const currency = sanitizeText(req.body.currency || 'hkd', 8).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    return res.status(400).json({ error: 'invalid currency' });
  }

  try {
    const pids = Array.from(quantityByPid.keys());
    const placeholders = pids.map(() => '?').join(',');
    const products = await new Promise((resolve, reject) => {
      db.all(`SELECT pid, name, price FROM products WHERE pid IN (${placeholders})`, pids, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    if (products.length !== pids.length) {
      return res.status(400).json({ error: 'some products do not exist' });
    }

    const normalizedItems = products.map(product => ({
      pid: product.pid,
      name: product.name,
      quantity: quantityByPid.get(product.pid) || 0,
      price: Number(product.price)
    })).sort((a, b) => a.pid - b.pid);

    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (totalAmount <= 0) return res.status(400).json({ error: 'invalid order total' });

    const merchantEmail = process.env.MERCHANT_EMAIL || 'merchant@example.com';
    const salt = crypto.randomBytes(16).toString('hex');
    const digest = buildDigestFromFields(currency, merchantEmail, salt, normalizedItems, totalAmount);

    const itemsJson = JSON.stringify(normalizedItems);

    const orderId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO orders (userid, currency, merchant_email, total_amount, salt, digest, items_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.userid, currency, merchantEmail.toLowerCase(), totalAmount, salt, digest, itemsJson],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    res.json({ orderId, digest, totalAmount: totalAmount.toFixed(2), currency });
  } catch (err) {
    console.error('Create order error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Unable to create order' });
  }
});

app.post('/api/stripe/create-checkout-session', requireCsrf, requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured on server' });
  }

  try {
    const orderIdParsed = parsePositiveInt(req.body.orderId, 'orderId');
    if (orderIdParsed.error) return res.status(400).json({ error: 'invalid orderId' });

    const localOrder = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE orderid = ? AND userid = ?', [orderIdParsed.value, req.user.userid], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
    if (!localOrder) return res.status(404).json({ error: 'order not found' });

    const orderItems = parseStoredOrderItems(localOrder.items_json);
    const baseUrl = getPublicBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Explicitly specify card only — this disables Stripe Link which autofills
      // saved emails and payment methods from previous sessions.
      payment_method_types: ['card'],
      client_reference_id: String(localOrder.orderid),
      // Pre-fill the current user's email to lock the field to the correct account.
      customer_email: req.user.email,
      success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?checkout=cancelled&order_id=${localOrder.orderid}`,
      metadata: {
        order_id: String(localOrder.orderid),
        user_id: String(localOrder.userid),
        merchant_email: String(localOrder.merchant_email || '').toLowerCase()
      },
      payment_intent_data: {
        metadata: {
          order_id: String(localOrder.orderid),
          user_id: String(localOrder.userid)
        }
      },
      line_items: orderItems.map(item => ({
        quantity: item.quantity,
        price_data: {
          currency: String(localOrder.currency || 'hkd').toLowerCase(),
          unit_amount: Math.round(Number(item.price) * 100),
          product_data: {
            name: item.name,
            metadata: {
              pid: String(item.pid)
            }
          }
        }
      }))
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Create Stripe checkout session error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Unable to create Stripe checkout session' });
  }
});

app.post('/api/stripe/webhook', async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook is not configured on server' });
  }

  try {
    const host = String(req.hostname || '').toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isHttpsRequest(req) && !isLocalHost) {
      return res.status(400).json({ error: 'Webhook endpoint must be served over HTTPS' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature || !req.rawBody) {
      return res.status(400).json({ error: 'Stripe webhook signature is missing' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret);
    } catch (err) {
      return res.status(400).json({ error: `Invalid Stripe webhook signature: ${err.message}` });
    }

    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      return res.json({ message: 'Event ignored' });
    }

    const session = event.data && event.data.object ? event.data.object : null;
    const stripeEventId = String(event.id || '').trim();
    const stripeSessionId = String(session && session.id ? session.id : '').trim();
    const stripePaymentIntentId = normalizeStripePaymentIntentId(session && session.payment_intent);
    if (!stripeEventId || !stripeSessionId) {
      return res.status(400).json({ error: 'Stripe webhook payload missing required identifiers' });
    }

    const existingTx = await new Promise((resolve, reject) => {
      db.get(
        'SELECT txid FROM transactions WHERE stripe_event_id = ? OR stripe_session_id = ? OR stripe_payment_intent_id = ? LIMIT 1',
        [stripeEventId, stripeSessionId, stripePaymentIntentId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
    if (existingTx) {
      return res.json({ message: 'Transaction already processed' });
    }

    const orderIdSource = String(
      (session && session.metadata && session.metadata.order_id) ||
      (session && session.client_reference_id) ||
      ''
    ).trim();
    const orderIdParsed = parsePositiveInt(orderIdSource, 'orderId');
    if (orderIdParsed.error) {
      return res.status(400).json({ error: 'Stripe checkout session is missing a valid local order ID' });
    }

    const localOrder = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE orderid = ?', [orderIdParsed.value], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
    if (!localOrder) {
      return res.status(400).json({ error: 'Local order does not exist' });
    }

    const lineItemsResponse = await stripe.checkout.sessions.listLineItems(stripeSessionId, {
      limit: 100,
      expand: ['data.price.product']
    });
    const stripeItems = parseStripeLineItemsForDigest(lineItemsResponse.data || []);

    const stripeCurrency = String(session && session.currency ? session.currency : '').toLowerCase();
    const stripeTotal = Number(session && session.amount_total ? session.amount_total : 0) / 100;
    if (!stripeCurrency || !Number.isFinite(stripeTotal) || stripeTotal <= 0) {
      return res.status(400).json({ error: 'Stripe amount data missing or invalid' });
    }
    if (String(session && session.payment_status ? session.payment_status : '').toLowerCase() !== 'paid') {
      return res.json({ message: 'Payment not completed yet' });
    }

    const merchantEmail = String(localOrder.merchant_email || process.env.MERCHANT_EMAIL || '').toLowerCase();
    const regeneratedDigest = buildDigestFromFields(stripeCurrency, merchantEmail, localOrder.salt, stripeItems, stripeTotal);
    if (regeneratedDigest !== localOrder.digest) {
      return res.status(400).json({ error: 'Digest mismatch. Integrity validation failed.' });
    }

    const stripePayerEmail = String(
      (session && session.customer_details && session.customer_details.email) ||
      (session && session.customer_email) ||
      ''
    ).trim().toLowerCase() || null;

    const txid = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO transactions (
          orderid, userid, provider, stripe_event_id, stripe_session_id, stripe_payment_intent_id,
          amount, currency, status, payer_email, raw_payload
        ) VALUES (?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localOrder.orderid,
          localOrder.userid,
          stripeEventId,
          stripeSessionId,
          stripePaymentIntentId,
          stripeTotal,
          stripeCurrency,
          'completed',
          stripePayerEmail,
          JSON.stringify(event)
        ],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    for (const item of stripeItems) {
      // Store paid item snapshot (pid, quantity, unit price) for post-payment audit.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO transaction_items (txid, pid, quantity, price) VALUES (?, ?, ?, ?)',
          [txid, item.pid, item.quantity, item.price],
          err => (err ? reject(err) : resolve())
        );
      });
    }

    return res.json({ message: 'Stripe payment verified and stored', txid, orderId: localOrder.orderid });
  } catch (err) {
    console.error('Stripe webhook processing error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to process Stripe webhook' });
  }
});

// Create a PayPal checkout order linked to a local order id.
app.post('/api/paypal/create-checkout-order', requireCsrf, requireAuth, async (req, res) => {
  try {
    const orderIdParsed = parsePositiveInt(req.body.orderId, 'orderId');
    if (orderIdParsed.error) return res.status(400).json({ error: 'invalid orderId' });

    const localOrder = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE orderid = ? AND userid = ?', [orderIdParsed.value, req.user.userid], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
    if (!localOrder) return res.status(404).json({ error: 'order not found' });

    let orderItems;
    try {
      orderItems = JSON.parse(localOrder.items_json || '[]');
    } catch {
      return res.status(500).json({ error: 'order items are invalid' });
    }
    if (!Array.isArray(orderItems) || !orderItems.length) {
      return res.status(400).json({ error: 'order has no items' });
    }

    const accessToken = await getPayPalAccessToken();
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: String(localOrder.orderid),
          currency_code: String(localOrder.currency || 'hkd').toUpperCase(),
          amount: {
            currency_code: String(localOrder.currency || 'hkd').toUpperCase(),
            value: Number(localOrder.total_amount).toFixed(2),
            breakdown: {
              item_total: {
                currency_code: String(localOrder.currency || 'hkd').toUpperCase(),
                value: Number(localOrder.total_amount).toFixed(2)
              }
            }
          },
          items: orderItems.map(item => ({
            name: String(item.name || `Product ${item.pid}`),
            sku: String(item.pid),
            quantity: String(item.quantity),
            unit_amount: {
              currency_code: String(localOrder.currency || 'hkd').toUpperCase(),
              value: Number(item.price).toFixed(2)
            }
          }))
        }
      ]
    };

    const ppRes = await fetch(`${paypalApiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const ppData = await ppRes.json();
    if (!ppRes.ok) {
      return res.status(502).json({ error: 'Failed to create PayPal order', details: ppData });
    }

    const links = Array.isArray(ppData.links) ? ppData.links : [];
    const approve = links.find(link => link && link.rel === 'approve');
    return res.json({ paypalOrderId: ppData.id, approveUrl: approve ? approve.href : null });
  } catch (err) {
    console.error('Create PayPal checkout order error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Unable to create PayPal checkout order' });
  }
});

// PayPal webhook for completed payments.
app.post('/api/paypal/webhook', async (req, res) => {
  try {
    const host = String(req.hostname || '').toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isHttpsRequest(req) && !isLocalHost) {
      return res.status(400).json({ error: 'Webhook endpoint must be served over HTTPS' });
    }

    const isAuthentic = await verifyPayPalWebhookSignature(req.body, req.headers);
    if (!isAuthentic) {
      return res.status(400).json({ error: 'Invalid PayPal webhook signature' });
    }

    const event = req.body || {};
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return res.json({ message: 'Event ignored' });
    }

    const paypalEventId = String(event.id || '').trim();
    const paypalCaptureId = String(event.resource && event.resource.id ? event.resource.id : '').trim();
    const paypalOrderId = String(
      (event.resource && event.resource.supplementary_data && event.resource.supplementary_data.related_ids && event.resource.supplementary_data.related_ids.order_id) ||
      ''
    ).trim();

    if (!paypalEventId || !paypalCaptureId || !paypalOrderId) {
      return res.status(400).json({ error: 'Webhook payload missing required PayPal identifiers' });
    }

    const existingTx = await new Promise((resolve, reject) => {
      db.get(
        'SELECT txid FROM transactions WHERE paypal_event_id = ? OR paypal_capture_id = ? LIMIT 1',
        [paypalEventId, paypalCaptureId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
    if (existingTx) {
      return res.json({ message: 'Transaction already processed' });
    }

    const paypalOrder = await fetchPayPalOrderDetails(paypalOrderId);
    const purchaseUnit = Array.isArray(paypalOrder.purchase_units) ? paypalOrder.purchase_units[0] : null;
    const customIdRaw = String(purchaseUnit && purchaseUnit.custom_id ? purchaseUnit.custom_id : '').trim();
    const orderIdMatch = customIdRaw.match(/^(\d+)/);
    if (!orderIdMatch) {
      return res.status(400).json({ error: 'PayPal order custom_id must start with local order ID' });
    }

    const orderIdParsed = parsePositiveInt(orderIdMatch[1], 'order id');
    if (orderIdParsed.error) {
      return res.status(400).json({ error: 'Invalid local order ID in PayPal custom_id' });
    }

    const localOrder = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE orderid = ?', [orderIdParsed.value], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
    if (!localOrder) {
      return res.status(400).json({ error: 'Local order does not exist' });
    }

    const paypalItems = parsePayPalItemsForDigest(paypalOrder);
    const paypalCurrency = String((event.resource && event.resource.amount && event.resource.amount.currency_code) || '').toLowerCase();
    const paypalTotal = Number((event.resource && event.resource.amount && event.resource.amount.value) || 0);
    if (!paypalCurrency || !Number.isFinite(paypalTotal) || paypalTotal <= 0) {
      return res.status(400).json({ error: 'PayPal amount data missing or invalid' });
    }

    const payeeEmail = String(
      (purchaseUnit && purchaseUnit.payee && purchaseUnit.payee.email_address) ||
      localOrder.merchant_email ||
      process.env.MERCHANT_EMAIL ||
      ''
    ).toLowerCase();

    const regeneratedDigest = buildDigestFromFields(paypalCurrency, payeeEmail, localOrder.salt, paypalItems, paypalTotal);
    if (regeneratedDigest !== localOrder.digest) {
      return res.status(400).json({ error: 'Digest mismatch. Integrity validation failed.' });
    }

    const txid = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO transactions (
          orderid, userid, provider, paypal_event_id, paypal_order_id, paypal_capture_id,
          amount, currency, status, raw_payload
        ) VALUES (?, ?, 'paypal', ?, ?, ?, ?, ?, ?, ?)`,
        [
          localOrder.orderid,
          localOrder.userid,
          paypalEventId,
          paypalOrderId,
          paypalCaptureId,
          paypalTotal,
          paypalCurrency,
          'completed',
          JSON.stringify(event)
        ],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    for (const item of paypalItems) {
      // Store paid item snapshot (pid, quantity, unit price) per requirement.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO transaction_items (txid, pid, quantity, price) VALUES (?, ?, ?, ?)',
          [txid, item.pid, item.quantity, item.price],
          err => (err ? reject(err) : resolve())
        );
      });
    }

    return res.json({ message: 'Payment verified and stored', txid, orderId: localOrder.orderid });
  } catch (err) {
    console.error('PayPal webhook processing error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to process PayPal webhook' });
  }
});

app.post('/api/create-payment-intent', requireCsrf, requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured on server' });
  }

  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (!rawItems.length) return res.status(400).json({ error: 'items required' });

  const quantityByPid = new Map();
  for (const item of rawItems) {
    const pidParsed = parsePositiveInt(item && item.id, 'item id');
    if (pidParsed.error) return res.status(400).json({ error: 'invalid item id' });
    const qtyParsed = parsePositiveInt(item && item.quantity, 'item quantity');
    if (qtyParsed.error) return res.status(400).json({ error: 'invalid item quantity' });
    if (qtyParsed.value > 999) return res.status(400).json({ error: 'item quantity too large' });
    const prev = quantityByPid.get(pidParsed.value) || 0;
    quantityByPid.set(pidParsed.value, prev + qtyParsed.value);
  }

  // Stripe expects ISO currency code and amount in the smallest unit (e.g. cents).
  const currency = sanitizeText(req.body.currency || 'hkd', 8).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    return res.status(400).json({ error: 'invalid currency' });
  }

  try {
    const pids = Array.from(quantityByPid.keys());
    const placeholders = pids.map(() => '?').join(',');
    const products = await new Promise((resolve, reject) => {
      db.all(`SELECT pid, name, price FROM products WHERE pid IN (${placeholders})`, pids, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    if (products.length !== pids.length) {
      return res.status(400).json({ error: 'some products do not exist' });
    }

    const normalizedItems = products.map(product => {
      const quantity = quantityByPid.get(product.pid) || 0;
      const unitAmount = Math.round(Number(product.price) * 100);
      return {
        id: product.pid,
        name: product.name,
        quantity,
        unitAmount,
        lineAmount: unitAmount * quantity
      };
    });

    const amount = normalizedItems.reduce((sum, item) => sum + item.lineAmount, 0);
    if (amount <= 0) return res.status(400).json({ error: 'invalid order total' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        user_id: String(req.user.userid),
        item_count: String(normalizedItems.reduce((sum, item) => sum + item.quantity, 0))
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      currency,
      items: normalizedItems
    });
  } catch (err) {
    console.error('Stripe payment intent error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Unable to create payment intent' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  return res.json({
    user: {
      userid: req.user.userid,
      email: req.user.email,
      name: req.user.name || 'guest',
      is_admin: req.user.is_admin
    }
  });
});

app.post('/api/auth/change-password', requireCsrf, requireAuth, (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');
  const confirm = String(req.body.confirm_password || '');

  if (!current || !next || !confirm) return res.status(400).json({ error: 'Missing fields' });
  if (next !== confirm) return res.status(400).json({ error: 'New passwords do not match' });

  db.get('SELECT password FROM users WHERE userid = ?', [req.user.userid], (err, row) => {
    if (err || !row) return res.status(500).json({ error: 'Server error' });
    if (!verifyPassword(current, row.password)) return res.status(400).json({ error: 'Current password incorrect' });

    const hashed = hashPassword(next);
    db.run('UPDATE users SET password = ? WHERE userid = ?', [hashed, req.user.userid], err2 => {
      if (err2) return res.status(500).json({ error: 'Server error' });
      db.run('DELETE FROM sessions WHERE userid = ?', [req.user.userid], () => {
        clearAuthCookie(res);
        res.json({ message: 'Password changed; logged out' });
      });
    });
  });
});

function sendHtmlWithNonce(res, filePath) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return res.status(500).type('text/plain').send('Server error');
    const withNonce = injectScriptNonces(html, res.locals.cspNonce);
    res.type('html').send(withNonce);
  });
}

const adminDir = path.join(__dirname, 'public', 'admin');
app.get('/admin/categories.html', requireAuth, requireAdmin, (req, res) => sendHtmlWithNonce(res, path.join(adminDir, 'categories.html')));
app.get('/admin/products.html', requireAuth, requireAdmin, (req, res) => sendHtmlWithNonce(res, path.join(adminDir, 'products.html')));
app.get('/admin/orders.html', requireAuth, requireAdmin, (req, res) => sendHtmlWithNonce(res, path.join(adminDir, 'orders.html')));
app.get('/admin/index.html', requireAuth, requireAdmin, (req, res) => sendHtmlWithNonce(res, path.join(adminDir, 'index.html')));
app.get('/admin', requireAuth, requireAdmin, (req, res) => res.redirect(302, '/admin/index.html'));

app.use(express.static(path.join(__dirname, BUILD_DIR), { index: false }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/admin-client', express.static(path.join(__dirname, 'admin-client')));

// --- API: Categories ---
app.get('/api/categories', (req, res) => {
  db.all('SELECT catid, name FROM categories ORDER BY catid', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(rows);
  });
});

app.post('/api/categories', requireCsrf, requireAdmin, (req, res) => {
  const action = String(req.body.action || '').trim();
  const catidRaw = req.body.catid;
  const name = sanitizeText(req.body.name, MAX_CATEGORY_NAME);

  if (!['create', 'update', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'invalid action' });
  }

  if (action === 'create') {
    if (!name) return res.status(400).json({ error: 'name required' });
    db.run('INSERT INTO categories(name) VALUES (?)', [name], function (err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ catid: this.lastID });
    });
    return;
  }

  const pidCheck = parsePositiveInt(catidRaw, 'catid');
  if (pidCheck.error) return res.status(400).json({ error: pidCheck.error });

  if (action === 'update') {
    if (!name) return res.status(400).json({ error: 'name required' });
    db.run('UPDATE categories SET name = ? WHERE catid = ?', [name, pidCheck.value], function (ert) {
      if (ert) return res.status(500).json({ error: 'Server error' });
      res.json({ changes: this.changes });
    });
  } else {
    db.run('DELETE FROM categories WHERE catid = ?', [pidCheck.value], function (erd) {
      if (erd) return res.status(500).json({ error: 'Server error' });
      res.json({ changes: this.changes });
    });
  }
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await new Promise((resolve, reject) => {
      db.all(
        `SELECT o.orderid, o.userid, o.currency, o.total_amount, o.items_json, o.created_at, u.email AS user_email
         FROM orders o
         LEFT JOIN users u ON u.userid = o.userid
         ORDER BY o.orderid DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    const transactions = await new Promise((resolve, reject) => {
      db.all(
        `SELECT txid, orderid, provider, status, amount, currency, payer_email, created_at
         FROM transactions
         ORDER BY txid DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    const latestTxByOrder = new Map();
    for (const tx of transactions) {
      if (!latestTxByOrder.has(tx.orderid)) {
        latestTxByOrder.set(tx.orderid, tx);
      }
    }

    const response = orders.map(order => {
      let parsedItems = [];
      try {
        const decoded = JSON.parse(order.items_json || '[]');
        if (Array.isArray(decoded)) {
          parsedItems = decoded
            .map(item => ({
              pid: Number(item.pid),
              name: String(item.name || ''),
              quantity: Number(item.quantity),
              price: Number(item.price)
            }))
            .filter(item => Number.isFinite(item.pid) && Number.isFinite(item.quantity) && Number.isFinite(item.price));
        }
      } catch {
        parsedItems = [];
      }

      const tx = latestTxByOrder.get(order.orderid) || null;
      return {
        orderId: order.orderid,
        userId: order.userid,
        userEmail: order.user_email || '',
        createdAt: sqliteUtcToIso(order.created_at),
        currency: order.currency,
        orderTotal: Number(order.total_amount),
        paymentStatus: tx ? String(tx.status || 'unknown') : 'pending',
        paymentProvider: tx ? String(tx.provider || '') : '',
        paidAmount: tx ? Number(tx.amount) : null,
        paidCurrency: tx ? String(tx.currency || '') : '',
        payerEmail: tx ? (tx.payer_email || null) : null,
        paidAt: tx ? sqliteUtcToIso(tx.created_at) : null,
        transactionId: tx ? tx.txid : null,
        items: parsedItems
      };
    });

    return res.json(response);
  } catch (err) {
    console.error('Load admin orders error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Unable to load orders' });
  }
});

app.get('/api/my/orders', requireAuth, async (req, res) => {
  try {
    const orders = await new Promise((resolve, reject) => {
      db.all(
        `SELECT orderid, userid, currency, total_amount, items_json, created_at
         FROM orders
         WHERE userid = ?
         ORDER BY orderid DESC
         LIMIT 5`,
        [req.user.userid],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    const orderIds = orders.map(order => order.orderid);
    let latestTxByOrder = new Map();

    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(',');
      const transactions = await new Promise((resolve, reject) => {
        db.all(
          `SELECT txid, orderid, provider, status, amount, currency, created_at
           FROM transactions
           WHERE orderid IN (${placeholders})
           ORDER BY txid DESC`,
          orderIds,
          (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        );
      });

      latestTxByOrder = new Map();
      for (const tx of transactions) {
        if (!latestTxByOrder.has(tx.orderid)) {
          latestTxByOrder.set(tx.orderid, tx);
        }
      }
    }

    const response = orders.map(order => {
      let parsedItems = [];
      try {
        const decoded = JSON.parse(order.items_json || '[]');
        if (Array.isArray(decoded)) {
          parsedItems = decoded
            .map(item => ({
              pid: Number(item.pid),
              name: String(item.name || ''),
              quantity: Number(item.quantity),
              price: Number(item.price)
            }))
            .filter(item => Number.isFinite(item.pid) && Number.isFinite(item.quantity) && Number.isFinite(item.price));
        }
      } catch {
        parsedItems = [];
      }

      const tx = latestTxByOrder.get(order.orderid) || null;
      return {
        orderId: order.orderid,
        createdAt: sqliteUtcToIso(order.created_at),
        currency: order.currency,
        orderTotal: Number(order.total_amount),
        paymentStatus: tx ? String(tx.status || 'unknown') : 'pending',
        paymentProvider: tx ? String(tx.provider || '') : '',
        paidAmount: tx ? Number(tx.amount) : null,
        paidCurrency: tx ? String(tx.currency || '') : '',
        paidAt: tx ? sqliteUtcToIso(tx.created_at) : null,
        transactionId: tx ? tx.txid : null,
        items: parsedItems
      };
    });

    return res.json(response);
  } catch (err) {
    console.error('Load member orders error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Unable to load your recent orders' });
  }
});

function sendProductsRows(res, err, rows) {
  if (err) return res.status(500).json({ error: 'Server error' });
  const converted = rows.map(r => {
    const images = parseImagesJson(r.images);
    const thumb = images.length
      ? images[0].replace('-large', '-thumb')
      : (r.image_path ? r.image_path.replace('-large', '-thumb') : `/images/products/product-${r.pid}.svg`);
    return {
      ...r,
      images,
      image_thumb: thumb
    };
  });
  res.json(converted);
}

app.get('/api/products', (req, res) => {
  const catidRaw = req.query.catid;
  if (catidRaw === undefined || catidRaw === null || String(catidRaw).trim() === '') {
    db.all('SELECT * FROM products ORDER BY pid', [], (err, rows) => sendProductsRows(res, err, rows));
    return;
  }
  const parsed = parsePositiveInt(catidRaw, 'catid');
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  db.all('SELECT * FROM products WHERE catid = ? ORDER BY pid', [parsed.value], (err, rows) =>
    sendProductsRows(res, err, rows));
});

app.get('/api/product/:id', (req, res) => {
  const parsed = parsePositiveInt(req.params.id, 'id');
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  db.get(
    'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.catid = c.catid WHERE p.pid = ?',
    [parsed.value],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (!row) return res.status(404).json({ error: 'not found' });
      row.images = parseImagesJson(row.images);
      const thumb = row.images.length
        ? row.images[0].replace('-large', '-thumb')
        : (row.image_path ? row.image_path.replace('-large', '-thumb') : `/images/products/product-${row.pid}.svg`);
      row.image_thumb = thumb;
      res.json(row);
    }
  );
});

function processFiles(pid, files) {
  const paths = [];
  return Promise.all(
    files.map((file, idx) => {
      const tempPath = file.path;
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const unique = Date.now();
      const baseName = `${pid}-${idx + 1}-${unique}`;
      const largePath = path.join(imagesDir, `${baseName}-large${ext}`);
      const thumbPath = path.join(imagesDir, `${baseName}-thumb${ext}`);

      if (ext === '.svg') {
        fs.copyFileSync(tempPath, largePath);
        fs.copyFileSync(tempPath, thumbPath);
        fs.unlinkSync(tempPath);
        paths.push(`/images/products/${baseName}-large${ext}`);
        return Promise.resolve();
      }

      return sharp(tempPath)
        .resize(1024, 1024, { fit: 'inside' })
        .toFile(largePath)
        .then(() => sharp(tempPath).resize(300, 300, { fit: 'cover' }).toFile(thumbPath))
        .then(() => {
          fs.unlinkSync(tempPath);
          paths.push(`/images/products/${baseName}-large${ext}`);
        });
    })
  ).then(() => paths);
}

app.post('/api/products/create', upload.any(), requireCsrf, requireAdmin, async (req, res) => {
  try {
    const catParsed = parsePositiveInt(req.body.catid, 'catid');
    if (catParsed.error) return res.status(400).json({ error: catParsed.error });
    const name = sanitizeText(req.body.name, MAX_PRODUCT_NAME);
    const priceParsed = validatePrice(req.body.price);
    if (priceParsed.error) return res.status(400).json({ error: priceParsed.error });
    const description = sanitizeText(req.body.description, MAX_DESCRIPTION);
    if (!name) return res.status(400).json({ error: 'name required' });

    db.run(
      'INSERT INTO products(catid,name,price,description) VALUES (?,?,?,?)',
      [catParsed.value, name, priceParsed.value, description],
      function (err) {
        if (err) return res.status(500).json({ error: 'Server error' });
        const pid = this.lastID;
        const imageFiles = (req.files || []).filter(f => f.fieldname === 'images');
        const saveImages = imageFiles.length ? processFiles(pid, imageFiles) : Promise.resolve([]);
        saveImages
          .then(paths => {
            const first = paths[0] || null;
            db.run('UPDATE products SET image_path = ?, images = ? WHERE pid = ?', [
              first,
              JSON.stringify(paths),
              pid
            ]);
            res.json({ pid });
          })
          .catch(() => res.status(500).json({ error: 'Server error' }));
      }
    );
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products/update', upload.any(), requireCsrf, requireAdmin, (req, res) => {
  const pidParsed = parsePositiveInt(req.body.pid, 'pid');
  if (pidParsed.error) return res.status(400).json({ error: pidParsed.error });
  const catParsed = parsePositiveInt(req.body.catid, 'catid');
  if (catParsed.error) return res.status(400).json({ error: catParsed.error });
  const name = sanitizeText(req.body.name, MAX_PRODUCT_NAME);
  const priceParsed = validatePrice(req.body.price);
  if (priceParsed.error) return res.status(400).json({ error: priceParsed.error });
  const description = sanitizeText(req.body.description, MAX_DESCRIPTION);
  if (!name) return res.status(400).json({ error: 'name required' });

  const pid = pidParsed.value;

  db.get('SELECT images FROM products WHERE pid = ?', [pid], (err, row) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    const oldImages = row && row.images ? parseImagesJson(row.images) : [];

    db.run(
      'UPDATE products SET catid = ?, name = ?, price = ?, description = ? WHERE pid = ?',
      [catParsed.value, name, priceParsed.value, description, pid],
      function (eru) {
        if (eru) return res.status(500).json({ error: 'Server error' });
        const imageFiles = (req.files || []).filter(f => f.fieldname === 'images');
        const saveImages = imageFiles.length ? processFiles(pid, imageFiles) : Promise.resolve([]);
        saveImages
          .then(paths => {
            if (paths.length) {
              const first = paths[0];
              db.run('UPDATE products SET image_path = ?, images = ? WHERE pid = ?', [
                first,
                JSON.stringify(paths),
                pid
              ]);

              oldImages.forEach(src => {
                const relative = safePublicImagePath(src);
                if (!relative) return;
                const fullPath = path.join(__dirname, 'public', relative);
                const thumbPath = fullPath.replace('-large', '-thumb');
                [fullPath, thumbPath].forEach(p => {
                  if (fs.existsSync(p)) fs.unlinkSync(p);
                });
              });
            }
            res.json({ changes: this.changes });
          })
          .catch(() => res.status(500).json({ error: 'Server error' }));
      }
    );
  });
});

app.post('/api/products/delete', requireCsrf, requireAdmin, (req, res) => {
  const pidParsed = parsePositiveInt(req.body.pid, 'pid');
  if (pidParsed.error) return res.status(400).json({ error: pidParsed.error });
  const pid = pidParsed.value;
  db.run('DELETE FROM products WHERE pid = ?', [pid], function (err) {
    if (err) return res.status(500).json({ error: 'Server error' });
    const largePath = path.join(imagesDir, `${pid}-large.jpg`);
    const thumbPath = path.join(imagesDir, `${pid}-thumb.jpg`);
    [largePath, thumbPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    res.json({ changes: this.changes });
  });
});

app.get('*', (req, res, next) => {
  const indexPath = path.join(__dirname, BUILD_DIR, 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(503).type('text/plain').send(
          'React build missing (dist/index.html or build/index.html). Fix folder permissions, then run: npm run build'
        );
      }
      return next(err);
    }
    res.type('html').send(injectScriptNonces(html, res.locals.cspNonce));
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Upload error' });
  }
  return next(err);
});

function startServer(port) {
  const listener = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    if (process.argv.includes('--open')) {
      const url = `http://localhost:${port}`;
      if (process.platform === 'win32') {
        exec(`start "" "${url}"`);
      }
    }
  });
  listener.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

const desiredPort = parseInt(process.env.PORT, 10) || PORT;
startServer(desiredPort);
