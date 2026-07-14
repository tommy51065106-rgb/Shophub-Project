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

  const form = document.getElementById('prodForm');
  const nameInput = form.querySelector('[name=name]');
  const priceInput = form.querySelector('[name=price]');
  const descInput = form.querySelector('[name=description]');
  const pidInput = form.querySelector('[name=pid]');
  const imageInput = form.querySelector('[name=images]');
  const imageDropZone = document.getElementById('imageDropZone');
  const imageDropHint = document.getElementById('imageDropHint');
  const droppedImagePreview = document.getElementById('droppedImagePreview');
  const saveBtn = document.getElementById('saveBtn');
  const THUMB_SIZE = 160;
  const defaultDropHint = `Drag images into this box (preview ${THUMB_SIZE}x${THUMB_SIZE}) or click to browse`;
  let selectedUploadFiles = [];

  nameInput.setAttribute('maxlength', '200');
  priceInput.setAttribute('min', '0');
  priceInput.setAttribute('max', '99999999');
  priceInput.setAttribute('step', '0.01');
  descInput.setAttribute('maxlength', '8000');
  if (imageDropHint) imageDropHint.textContent = defaultDropHint;

  function isImageFile(file) {
    return !!(file && typeof file.type === 'string' && file.type.toLowerCase().startsWith('image/'));
  }

  function renderDroppedThumbnails(files) {
    droppedImagePreview.innerHTML = '';
    if (!files || !files.length) return;

    files.forEach(file => {
      const thumb = document.createElement('img');
      thumb.className = 'dropped-thumb';
      thumb.alt = `Selected image: ${file.name}`;
      thumb.src = URL.createObjectURL(file);
      thumb.addEventListener('load', () => URL.revokeObjectURL(thumb.src), { once: true });
      droppedImagePreview.appendChild(thumb);
    });
  }

  function setInputFiles(files) {
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    imageInput.files = dt.files;
  }

  function fileKey(file) {
    return `${file.name}|${file.size}|${file.type}`;
  }

  function mergeFiles(existing, incoming) {
    const merged = [...existing];
    const seen = new Set(existing.map(file => fileKey(file)));

    incoming.forEach(file => {
      const key = fileKey(file);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(file);
      }
    });

    return merged;
  }

  async function applySelectedFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) {
      if (imageDropHint) {
        imageDropHint.textContent = selectedUploadFiles.length
          ? `Loaded ${selectedUploadFiles.length} image(s). Preview is ${THUMB_SIZE}x${THUMB_SIZE}.`
          : defaultDropHint;
      }
      return true;
    }

    const hasNonImage = files.some(file => !isImageFile(file));
    if (hasNonImage) {
      alert('Only image files are allowed. Non-image files were rejected.');
      setInputFiles(selectedUploadFiles);
      renderDroppedThumbnails(selectedUploadFiles);
      if (imageDropHint) {
        imageDropHint.textContent = selectedUploadFiles.length
          ? `Loaded ${selectedUploadFiles.length} image(s). Preview is ${THUMB_SIZE}x${THUMB_SIZE}.`
          : defaultDropHint;
      }
      return false;
    }

    try {
      selectedUploadFiles = mergeFiles(selectedUploadFiles, files);
      setInputFiles(selectedUploadFiles);
      renderDroppedThumbnails(selectedUploadFiles);
      if (imageDropHint) imageDropHint.textContent = `Loaded ${selectedUploadFiles.length} image(s). Preview is ${THUMB_SIZE}x${THUMB_SIZE}.`;
      return true;
    } catch (err) {
      console.error(err);
      alert('Failed to process one or more images. Please try another image file.');
      setInputFiles(selectedUploadFiles);
      renderDroppedThumbnails(selectedUploadFiles);
      if (imageDropHint) {
        imageDropHint.textContent = selectedUploadFiles.length
          ? `Loaded ${selectedUploadFiles.length} image(s). Preview is ${THUMB_SIZE}x${THUMB_SIZE}.`
          : defaultDropHint;
      }
      return false;
    }
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    imageDropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      imageDropZone.classList.add('drag-over');
      if (imageDropHint) imageDropHint.textContent = 'Release to drop images here';
    });
  });

  ['dragleave', 'dragend', 'drop'].forEach(eventName => {
    imageDropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      imageDropZone.classList.remove('drag-over');
      if (eventName !== 'drop' && imageDropHint) imageDropHint.textContent = defaultDropHint;
    });
  });

  imageDropZone.addEventListener('drop', async e => {
    const dropped = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : [];
    await applySelectedFiles(dropped);
  });

  imageDropZone.addEventListener('click', () => {
    imageInput.click();
  });

  imageDropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      imageInput.click();
    }
  });

  imageInput.addEventListener('change', async () => {
    await applySelectedFiles(imageInput.files);
  });

  async function loadCats() {
    const res = await fetch('/api/categories');
    const cats = await res.json();
    const sel = form.querySelector('[name=catid]');
    sel.innerHTML = '';
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = String(c.catid);
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }

  function appendProductLine(ul, p) {
    const li = document.createElement('li');

    const title = document.createElement('strong');
    title.textContent = p.name;
    li.appendChild(title);
    li.appendChild(document.createTextNode(` ($${Number(p.price).toFixed(2)}) `));
    li.appendChild(document.createElement('br'));

    const thumb =
      p.images && p.images.length > 0
        ? p.images[0].replace('-large', '-thumb')
        : p.image_path && p.image_path.replace('-large', '-thumb');
    if (thumb) {
      const img = document.createElement('img');
      img.src = thumb;
      img.alt = '';
      li.appendChild(img);
    }

    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.type = 'button';
    edit.className = 'btn-primary';
    edit.addEventListener('click', () => {
      pidInput.value = String(p.pid);
      form.querySelector('[name=catid]').value = String(p.catid);
      nameInput.value = p.name;
      priceInput.value = String(p.price);
      descInput.value = p.description || '';
      saveBtn.textContent = 'Update';

      const preview = document.getElementById('existingImages');
      preview.innerHTML = '';
      const imgs = p.images || [];
      imgs.forEach(src => {
        const i = document.createElement('img');
        i.src = src.replace('-large', '-thumb');
        i.style.maxWidth = '100px';
        i.style.marginRight = '4px';
        preview.appendChild(i);
      });
    });

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.type = 'button';
    del.className = 'btn-secondary';
    del.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await fetch('/api/products/delete', {
        method: 'POST',
        credentials: 'include',
        headers: ShopAdmin.csrfHeaders(csrfToken, true),
        body: JSON.stringify({ pid: p.pid, _csrf: csrfToken })
      });
      localStorage.setItem('products_updated', Date.now().toString());
      load();
    });

    li.appendChild(edit);
    li.appendChild(del);
    ul.appendChild(li);
  }

  async function load() {
    await loadCats();
    const res = await fetch('/api/products');
    const prods = await res.json();
    const ul = document.getElementById('list');
    ul.innerHTML = '';
    prods.forEach(p => appendProductLine(ul, p));
  }

  function resetForm() {
    pidInput.value = '';
    form.querySelector('[name=catid]').value = '';
    nameInput.value = '';
    priceInput.value = '';
    descInput.value = '';
    selectedUploadFiles = [];
    setInputFiles([]);
    renderDroppedThumbnails(selectedUploadFiles);
    if (imageDropHint) imageDropHint.textContent = defaultDropHint;
    saveBtn.textContent = 'Save';
  }

  document.getElementById('createBtn').addEventListener('click', () => {
    resetForm();
    document.getElementById('existingImages').innerHTML = '';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const pid = pidInput.value.trim();
    const data = new FormData(form);
    const filesForUpload = selectedUploadFiles.length
      ? selectedUploadFiles
      : Array.from(imageInput.files || []);

    data.delete('images');
    filesForUpload.forEach(file => data.append('images', file, file.name));

    if (pid) data.set('pid', pid);
    data.set('_csrf', csrfToken);

    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    if (!name || !Number.isFinite(price) || price < 0) {
      alert('Invalid name or price');
      return;
    }

    const url = pid ? '/api/products/update' : '/api/products/create';
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert('Failed: ' + (result.error || res.status));
      return;
    }
    alert(`Product ${pid ? 'updated' : 'created'} successfully.`);
    localStorage.setItem('products_updated', Date.now().toString());
    resetForm();
    load();
  });

  load();
});
