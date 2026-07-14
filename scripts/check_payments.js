const { init, db } = require('../db');

function runAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function runGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function main() {
  init();

  const tables = await runAll(
    "SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?, ?) ORDER BY name",
    ['table', 'orders', 'transactions', 'transaction_items']
  );
  console.log('Payment-related tables:');
  console.table(tables);

  const transactionCount = await runGet('SELECT COUNT(*) AS count FROM transactions');
  console.log('Transactions count:', transactionCount ? transactionCount.count : 0);

  const latestTransaction = await runGet('SELECT txid, orderid, amount, currency, status, created_at FROM transactions ORDER BY txid DESC LIMIT 1');
  if (!latestTransaction) {
    console.log('No transaction found');
    return;
  }

  console.log('Latest transaction:');
  console.table([latestTransaction]);

  const latestItems = await runAll(
    'SELECT pid, quantity, price FROM transaction_items WHERE txid = ? ORDER BY pid',
    [latestTransaction.txid]
  );
  console.log('Latest transaction items:');
  console.table(latestItems);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => db.close(), 50);
  });