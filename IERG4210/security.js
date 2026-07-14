'use strict';

const crypto = require('crypto');

const CSRF_COOKIE = 'csrf_token';
const RANDOM_BYTES = 32;

const MAX_CATEGORY_NAME = 128;
const MAX_PRODUCT_NAME = 200;
const MAX_DESCRIPTION = 8000;
const MAX_PRICE = 99999999.99;

function generateToken() {
  return crypto.randomBytes(RANDOM_BYTES).toString('hex');
}

function timingSafeEqualStr(cookieToken, sent) {
  if (typeof cookieToken !== 'string' || typeof sent !== 'string') return false;
  const a = Buffer.from(cookieToken, 'utf8');
  const b = Buffer.from(sent, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const CSP_NONCE_BYTES = 16;

/** Random nonce for CSP + matching <script nonce=""> (see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) */
function generateCspNonce() {
  return crypto.randomBytes(CSP_NONCE_BYTES).toString('base64url');
}

function buildContentSecurityPolicy(nonceValue) {
  const token = String(nonceValue).replace(/['";,\s]/g, '');
  const scriptSrc = `'nonce-${token}'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc} 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self' https://www.facebook.com https://web.facebook.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; ');
}

/** Add nonce attribute to every <script> that does not already have one. */
function injectScriptNonces(html, nonceValue) {
  const safe = String(nonceValue).replace(/[\'"<>]/g, '');
  if (!safe) return html;
  return html.replace(/<script(?![^>]*\bnonce\s*=)([^>]*>)/gi, `<script nonce="${safe}"$1`);//add every tag that doesn't already have a nonce, ignore case
}

function securityHeaders(req, res, next) {
  const nonce = generateCspNonce();
  res.locals.cspNonce = nonce;
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

function issueCsrfToken(req, res) {
  const token = generateToken();
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.cookie(CSRF_COOKIE, token, {
    sameSite: 'strict',
    path: '/',
    httpOnly: false,
    secure: !!secure
  });
  res.json({ csrfToken: token });
}

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  const bodyToken = req.body && (req.body._csrf || req.body.csrfToken);
  const sent = headerToken || bodyToken || '';
  if (!timingSafeEqualStr(cookieToken, String(sent))) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
}

function sanitizeText(s, maxLen) {
  if (s == null) return '';
  let t = String(s).replace(/\0/g, '').replace(/[<>]/g, '').trim();
  if (t.length > maxLen) t = t.slice(0, maxLen);
  return t;
}

function parsePositiveInt(value, fieldName) {
  const n = parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 1) {
    return { error: `Invalid ${fieldName}` };
  }
  return { value: n };
}

function validatePrice(priceRaw) {
  const n = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw));
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) {
    return { error: 'Invalid price' };
  }
  return { value: n };
}

function hashPassword(password) {
  if (!password || typeof password !== 'string') throw new Error('Password required');
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 310000;
  const keylen = 64;
  const digest = 'sha512';
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!password || typeof password !== 'string' || !stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const hash = parts[3];
  try {
    const computed = crypto.pbkdf2Sync(password, salt, iterations, Buffer.from(hash, 'hex').length, 'sha512').toString('hex');
    return timingSafeEqualStr(computed, hash);
  } catch {
    return false;
  }
}

function parseImagesJson(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function safePublicImagePath(src) {
  if (!src || typeof src !== 'string') return null;
  const relative = src.replace(/^\//, '');
  if (relative.includes('..') || !relative.startsWith('images/products/')) {
    return null;
  }
  return relative;
}

module.exports = {
  CSRF_COOKIE,
  securityHeaders,
  injectScriptNonces,
  generateCspNonce,
  buildContentSecurityPolicy,
  issueCsrfToken,
  requireCsrf,
  generateToken,
  sanitizeText,
  parsePositiveInt,
  validatePrice,
  hashPassword,
  verifyPassword,
  parseImagesJson,
  safePublicImagePath,
  MAX_CATEGORY_NAME,
  MAX_PRODUCT_NAME,
  MAX_DESCRIPTION,
  MAX_PRICE
};
