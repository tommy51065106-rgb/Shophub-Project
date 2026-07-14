'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { hashPassword } = require('../security');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'shop.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function rebuildDatabase() {
  await run('PRAGMA foreign_keys = OFF');

  await run('DROP TABLE IF EXISTS sessions');
  await run('DROP TABLE IF EXISTS users');
  await run('DROP TABLE IF EXISTS products');
  await run('DROP TABLE IF EXISTS categories');

  await run(`CREATE TABLE categories (
    catid INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);

  await run(`CREATE TABLE products (
    pid INTEGER PRIMARY KEY AUTOINCREMENT,
    catid INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    image_path TEXT,
    images TEXT,
    FOREIGN KEY(catid) REFERENCES categories(catid)
  )`);

  await run(`CREATE TABLE users (
    userid INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    userid INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userid) REFERENCES users(userid)
  )`);

  await run('INSERT INTO categories(name) VALUES (?)', ['Electronics']);
  await run('INSERT INTO categories(name) VALUES (?)', ['Books']);

  await run(
    'INSERT INTO products(catid, name, price, description) VALUES (?, ?, ?, ?)',
    [1, 'Smartphone', 399.99, 'A modern smartphone']
  );
  await run(
    'INSERT INTO products(catid, name, price, description) VALUES (?, ?, ?, ?)',
    [1, 'Headphones', 59.99, 'Noise-cancelling headphones']
  );
  await run(
    'INSERT INTO products(catid, name, price, description) VALUES (?, ?, ?, ?)',
    [2, 'Learning JS', 29.99, 'An introductory JavaScript book']
  );
  await run(
    'INSERT INTO products(catid, name, price, description) VALUES (?, ?, ?, ?)',
    [2, 'Algorithms', 39.50, 'Algorithms and data structures book']
  );

  const adminHash = hashPassword('Admin123!');
  const userHash = hashPassword('User123!');

  await run('INSERT INTO users(email, password, name, is_admin) VALUES (?, ?, ?, ?)', [
    'admin@example.com',
    adminHash,
    'Admin',
    1
  ]);

  await run('INSERT INTO users(email, password, name, is_admin) VALUES (?, ?, ?, ?)', [
    'user@example.com',
    userHash,
    'User',
    0
  ]);

  await run('PRAGMA foreign_keys = ON');
}

rebuildDatabase()
  .then(() => {
    console.log('Database rebuilt successfully at', dbPath);
    console.log('Seed users: admin@example.com / Admin123!, user@example.com / User123!');
    db.close();
  })
  .catch(err => {
    console.error('Database rebuild failed:', err.message);
    db.close();
    process.exit(1);
  });
