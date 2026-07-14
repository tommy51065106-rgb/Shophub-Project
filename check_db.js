const { db, init } = require('./db');

init();

db.serialize(() => {
  db.all('SELECT * FROM categories ORDER BY catid', (err, rows) => {
    if (err) { console.error('categories error', err); return; }
    console.log('CATEGORIES:');
    console.table(rows);
  });

  db.all('SELECT pid,catid,name,price,description,image_path,images FROM products ORDER BY pid', (err, rows) => {
    if (err) { console.error('products error', err); return; }
    console.log('PRODUCTS:');
    rows.forEach(r => { if (r.images) r.parsed_images = JSON.parse(r.images); });
    console.table(rows);
  });

  setTimeout(() => db.close(), 500);
});
