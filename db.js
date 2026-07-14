const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { hashPassword } = require('./security');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'shop.db');
const db = new sqlite3.Database(DB_PATH); //open the database (will create if not exists)

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      catid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      pid INTEGER PRIMARY KEY AUTOINCREMENT,
      catid INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image_path TEXT,
      images TEXT,
      FOREIGN KEY(catid) REFERENCES categories(catid)
    )`);
    // if table already existed without images column, try to add it
    db.run(`ALTER TABLE products ADD COLUMN images TEXT`, err => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('error adding images column', err.message);
      }
    });

    // Seed categories if empty
    db.get('SELECT COUNT(*) AS c FROM categories', (err, row) => {
      if (err) return console.error(err);
      if (row.c === 0) {
        const stmt = db.prepare('INSERT INTO categories(name) VALUES(?)');
        stmt.run('Electronics');
        stmt.run('Books');
        stmt.finalize();
      }
    });

    // Seed products if empty
    db.get('SELECT COUNT(*) AS c FROM products', (err, row) => {
      if (err) return console.error(err);
      if (row.c === 0) {
        const stmt = db.prepare('INSERT INTO products(catid,name,price,description) VALUES(?,?,?,?)');
        stmt.run(1, 'Smartphone', 399.99, 'A modern smartphone');
        stmt.run(1, 'Headphones', 59.99, 'Noise-cancelling headphones');
        stmt.run(2, 'Learning JS', 29.99, 'An introductory JavaScript book');
        stmt.run(2, 'Algorithms', 39.5, 'Algorithms and data structures book');
        stmt.finalize();
      }
    });

    // Users for authentication
    db.run(`CREATE TABLE IF NOT EXISTS users (
      userid INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userid INTEGER NOT NULL,
      expires INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userid) REFERENCES users(userid)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      orderid INTEGER PRIMARY KEY AUTOINCREMENT,
      userid INTEGER NOT NULL,
      currency TEXT NOT NULL,
      merchant_email TEXT NOT NULL DEFAULT '',
      total_amount REAL NOT NULL,
      salt TEXT NOT NULL,
      digest TEXT NOT NULL,
      items_json TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userid) REFERENCES users(userid)
    )`);
    db.run(`ALTER TABLE orders ADD COLUMN merchant_email TEXT NOT NULL DEFAULT ''`, err => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('error adding merchant_email column', err.message);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      txid INTEGER PRIMARY KEY AUTOINCREMENT,
      orderid INTEGER NOT NULL,
      userid INTEGER NOT NULL,
      provider TEXT NOT NULL,
      paypal_event_id TEXT UNIQUE,
      paypal_order_id TEXT,
      paypal_capture_id TEXT UNIQUE,
      stripe_event_id TEXT UNIQUE,
      stripe_session_id TEXT UNIQUE,
      stripe_payment_intent_id TEXT UNIQUE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      raw_payload TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(orderid) REFERENCES orders(orderid),
      FOREIGN KEY(userid) REFERENCES users(userid)
    )`);
    db.run(`ALTER TABLE transactions ADD COLUMN stripe_event_id TEXT`, err => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('error adding stripe_event_id column', err.message);
      }
    });
    db.run(`ALTER TABLE transactions ADD COLUMN stripe_session_id TEXT`, err => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('error adding stripe_session_id column', err.message);
      }
    });
    db.run(`ALTER TABLE transactions ADD COLUMN stripe_payment_intent_id TEXT`, err => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('error adding stripe_payment_intent_id column', err.message);
      }
    });
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_event_id ON transactions(stripe_event_id)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_session_id ON transactions(stripe_session_id)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent_id ON transactions(stripe_payment_intent_id)');
    db.run(`ALTER TABLE transactions ADD COLUMN payer_email TEXT`, err => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('error adding payer_email column', err.message);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS transaction_items (
      tx_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      txid INTEGER NOT NULL,
      pid INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(txid) REFERENCES transactions(txid)
    )`);

    db.get('SELECT COUNT(*) AS c FROM users', (err2, row2) => {
      if (err2) return console.error(err2);
      if (row2.c === 0) {
        const adminHash = hashPassword('Admin123!');
        const userHash = hashPassword('User123!');
        const stmt2 = db.prepare('INSERT INTO users(email,password,name,is_admin) VALUES (?,?,?,?)');
        stmt2.run('admin@example.com', adminHash, 'Admin', 1);
        stmt2.run('user@example.com', userHash, 'User', 0);
        stmt2.finalize();
      }
    });
  });
}

module.exports = { db, init };
