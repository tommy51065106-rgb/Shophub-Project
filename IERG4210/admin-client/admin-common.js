'use strict';

window.ShopAdmin = window.ShopAdmin || {};

ShopAdmin.initCsrf = async function initCsrf() {
  const res = await fetch('/api/csrf-token', { credentials: 'include' });
  if (!res.ok) throw new Error('CSRF init failed');
  const data = await res.json();
  const h = document.getElementById('csrfHidden');
  if (h) h.value = data.csrfToken;
  return data.csrfToken;
};

ShopAdmin.csrfHeaders = function csrfHeaders(token, contentTypeJson) {
  const h = { 'X-CSRF-Token': token };
  if (contentTypeJson) h['Content-Type'] = 'application/json';
  return h;
};
