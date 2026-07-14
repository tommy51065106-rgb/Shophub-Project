import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MemberOrders.css';

function formatCurrency(value, currency) {
  const normalized = String(currency || 'hkd').toUpperCase();
  const amount = Number(value || 0);
  return `${normalized} ${amount.toFixed(2)}`;
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

function MemberOrders() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }

    async function loadRecentOrders() {
      setPageLoading(true);
      setError('');
      try {
        const res = await fetch('/api/my/orders', {
          credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Unable to load your recent orders');
        }
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Unable to load your recent orders');
        setOrders([]);
      } finally {
        setPageLoading(false);
      }
    }

    loadRecentOrders();
  }, [user, loading, navigate]);

  return (
    <div className="member-orders-page main-content">
      <section className="member-orders-hero">
        <h2>Member Portal</h2>
        <p>Your most recent 5 orders and payment status.</p>
      </section>

      {pageLoading ? <p className="member-orders-hint">Loading your recent orders...</p> : null}
      {!pageLoading && error ? <p className="member-orders-error">{error}</p> : null}

      {!pageLoading && !error && !orders.length ? (
        <div className="member-orders-empty">
          <h3>No orders yet</h3>
          <p>When you complete checkout, your latest orders will appear here.</p>
        </div>
      ) : null}

      {!pageLoading && !error && orders.length ? (
        <div className="member-orders-list">
          {orders.map(order => (
            <article key={order.orderId} className="member-order-card">
              <header className="member-order-header">
                <div>
                  <h3>Order #{order.orderId}</h3>
                  <p>{formatDate(order.createdAt)}</p>
                </div>
                <div className="member-order-status-wrap">
                  <span className="member-order-status">{order.paymentStatus}</span>
                  {order.paymentProvider ? <small>via {order.paymentProvider}</small> : null}
                </div>
              </header>

              <ul className="member-order-items">
                {Array.isArray(order.items) && order.items.length ? (
                  order.items.map(item => (
                    <li key={`${order.orderId}-${item.pid}`}>
                      <span>{item.name || `Product #${item.pid}`} x {item.quantity}</span>
                      <strong>{formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0), order.currency)}</strong>
                    </li>
                  ))
                ) : (
                  <li>
                    <span>No item snapshot available</span>
                  </li>
                )}
              </ul>

              <footer className="member-order-footer">
                <div>
                  <span>Total</span>
                  <strong>{formatCurrency(order.orderTotal, order.currency)}</strong>
                </div>
                <div>
                  <span>Paid</span>
                  <strong>
                    {order.paidAmount == null
                      ? '-'
                      : formatCurrency(order.paidAmount, order.paidCurrency || order.currency)}
                  </strong>
                </div>
              </footer>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default MemberOrders;
