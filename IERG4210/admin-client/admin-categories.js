'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  let csrfToken = '';
  try {
    csrfToken = await ShopAdmin.initCsrf();
  } catch (e) {
    console.error(e);
    alert('Security init failed; reload the page.');
    return;
  }

  const nameInput = document.querySelector('[name=name]');
  const catidInput = document.querySelector('[name=catid]');
  nameInput.setAttribute('maxlength', '128');
  nameInput.setAttribute('autocomplete', 'off');

  async function load() {
    const res = await fetch('/api/categories');
    const cats = await res.json();
    const ul = document.getElementById('list');
    ul.innerHTML = '';
    cats.forEach(c => {
      const li = document.createElement('li');

      const label = document.createElement('span');
      label.textContent = `${c.name} (id:${c.catid}) `;
      li.appendChild(label);

      const edit = document.createElement('button');
      edit.textContent = 'Edit';
      edit.type = 'button';
      edit.className = 'btn-primary';
      edit.addEventListener('click', () => {
        catidInput.value = String(c.catid);
        nameInput.value = c.name;
      });
      li.appendChild(edit);

      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.type = 'button';
      del.className = 'btn-secondary';
      del.addEventListener('click', async () => {
        if (!confirm('Delete?')) return;
        await fetch('/api/categories', {
          method: 'POST',
          credentials: 'include',
          headers: ShopAdmin.csrfHeaders(csrfToken, true),
          body: JSON.stringify({ action: 'delete', catid: c.catid, _csrf: csrfToken })
        });
        load();
      });
      li.appendChild(del);
      ul.appendChild(li);
    });
  }

  document.getElementById('createBtn').addEventListener('click', () => {
    catidInput.value = '';
    nameInput.value = '';
  });

  document.getElementById('catForm').addEventListener('submit', async e => {
    e.preventDefault();
    const catid = catidInput.value.trim();
    const name = nameInput.value.trim();
    if (!name) {
      alert('Name is required');
      return;
    }
    const action = catid ? 'update' : 'create';
    const body = { action, name, _csrf: csrfToken };
    if (catid) body.catid = parseInt(catid, 10);
    const res = await fetch('/api/categories', {
      method: 'POST',
      credentials: 'include',
      headers: ShopAdmin.csrfHeaders(csrfToken, true),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Save failed');
      return;
    }
    await res.json();
    load();
  });

  load();
});
