'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await ShopAdmin.initCsrf();
  } catch (e) {
    console.error(e);
    alert('Security init failed; reload the page.');
    return;
  }

  const tableBody = document.querySelector('#ordersTable tbody');

  function formatCurrency(value, currency) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    return `${amount.toFixed(2)} ${String(currency || '').toUpperCase()}`.trim();
  }

  function formatDate(value) {
    if (!value) return '-';
    const raw = String(value).trim();
    const utcLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;
    const d = new Date(utcLike);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-HK', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d) + ' HKT';
  }

  function renderProducts(items) {
    if (!Array.isArray(items) || !items.length) return 'No products';
    return items
      .map(item => `${item.name || `PID ${item.pid}`} (PID ${item.pid}) x${item.quantity} @ ${Number(item.price).toFixed(2)}`)
      .join(' | ');
  }

  function appendOrderRow(order) {
    const tr = document.createElement('tr');

    const orderId = document.createElement('td');
    orderId.textContent = String(order.orderId);
    tr.appendChild(orderId);

    const user = document.createElement('td');
    user.textContent = order.userEmail ? `${order.userEmail} (uid:${order.userId})` : `uid:${order.userId}`;
    tr.appendChild(user);

    const payerEmail = document.createElement('td');
    payerEmail.textContent = order.payerEmail || '-';
    tr.appendChild(payerEmail);

    const products = document.createElement('td');
    products.textContent = renderProducts(order.items);
    tr.appendChild(products);

    const total = document.createElement('td');
    total.textContent = formatCurrency(order.orderTotal, order.currency);
    tr.appendChild(total);

    const status = document.createElement('td');
    status.textContent = order.paymentProvider
      ? `${order.paymentStatus} (${order.paymentProvider})`
      : order.paymentStatus;
    tr.appendChild(status);

    const paid = document.createElement('td');
    if (order.transactionId) {
      paid.textContent = `tx:${order.transactionId}, ${formatCurrency(order.paidAmount, order.paidCurrency)}${order.paidAt ? `, ${formatDate(order.paidAt)}` : ''}`;
    } else {
      paid.textContent = '-';
    }
    tr.appendChild(paid);

    const created = document.createElement('td');
    created.textContent = formatDate(order.createdAt);
    tr.appendChild(created);

    tableBody.appendChild(tr);
  }

  async function loadOrders() {
    const res = await fetch('/api/admin/orders', { credentials: 'include' });
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      const msg = data && data.error ? data.error : `Failed (${res.status})`;
      throw new Error(msg);
    }

    tableBody.innerHTML = '';
    if (!Array.isArray(data) || !data.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = 'No orders found';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    data.forEach(appendOrderRow);
  }

  try {
    await loadOrders();
  } catch (err) {
    console.error(err);
    alert(`Unable to load orders: ${err.message || err}`);
  }
});
