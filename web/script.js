document.addEventListener('DOMContentLoaded', () => {
  // Texty hlásení (web je len po anglicky)
  const t = {
    url: 'Please enter a valid web address (for example google.com).',
    text: 'Please enter some text.',
    ssid: 'Please enter the network name (SSID).',
    name: 'Please enter a name.',
    working: 'Generating…',
    generate: 'Generate QR code',
    done: 'Done. Download the code or scan it right away.',
    first: 'Generate a QR code first.',
    error: 'Could not generate the QR code',
    placeholder: 'Your code will appear here',
    preview: 'QR code preview',
    made: 'Generated QR code',
    logoType: 'Please choose a PNG, JPG, WebP, GIF or SVG image.',
    logoSize: 'The logo is too large. Please use an image under 5 MB.',
    logoError: 'Could not read this image. Please try another file.'
  };
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Generátor je iba na hlavnej stránke - na ostatných stránkach tento kód nič nerobí
  const generateBtn = document.getElementById('generate');
  if (!generateBtn) return;

  const qrContainer = document.getElementById('qr');
  const qrPlaceholder = document.getElementById('qr-placeholder');
  const downloadBtn = document.getElementById('download');
  const downloadSvgBtn = document.getElementById('download-svg');
  const logoInput = document.getElementById('logo');
  const logoRemove = document.getElementById('logo-remove');
  const openBtn = document.getElementById('open');
  const hint = document.getElementById('hint');
  const tabs = Array.from(document.querySelectorAll('.qr-tab'));
  const fields = Array.from(document.querySelectorAll('.qr-field'));

  let lastDataUrl = null;
  let lastSvg = null;
  let lastPayload = null;
  let logo = null;
  let activeType = 'url';

  function isValidUrl(value) {
    try {
      const u = new URL(value);
      return (u.protocol === 'http:' || u.protocol === 'https:');
    } catch (e) { return false; }
  }

  // Doplní https:// ak používateľ napísal len "google.com" bez protokolu.
  // Vráti normalizovanú URL alebo null, ak je vstup neplatný.
  function normalizeUrl(value) {
    let v = value.trim();
    if (!v) return null;
    // Ak vstup obsahuje iný protokol (napr. ftp://, mailto:), považujeme ho za neplatný.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^https?:\/\//i.test(v)) {
      return null;
    }
    if (!/^https?:\/\//i.test(v)) {
      v = 'https://' + v;
    }
    return isValidUrl(v) ? v : null;
  }

  function setActiveTab(type, focusTab) {
    activeType = type;
    tabs.forEach(t => {
      const selected = t.dataset.type === type;
      t.setAttribute('aria-selected', selected ? 'true' : 'false');
      t.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) t.focus();
    });
    fields.forEach(f => {
      f.classList.toggle('active', f.dataset.type === type);
    });
    // Reset náhľadu pri zmene typu
    resetPreview();
  }

  function resetPreview() {
    qrContainer.innerHTML = '<div id="qr-placeholder">' + t.placeholder + '</div>';
    qrContainer.setAttribute('aria-label', t.preview);
    lastDataUrl = null;
    lastSvg = null;
    lastPayload = null;
    if (openBtn) openBtn.style.display = activeType === 'url' ? '' : 'none';
  }

  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.type));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (idx + dir + tabs.length) % tabs.length;
      setActiveTab(tabs[nextIdx].dataset.type, true);
    });
  });

  function buildPayload() {
    if (activeType === 'url') {
      return normalizeUrl(document.getElementById('url').value);
    }
    if (activeType === 'text') {
      return document.getElementById('text').value.trim();
    }
    if (activeType === 'wifi') {
      const ssid = document.getElementById('wifi-ssid').value.trim();
      const pass = document.getElementById('wifi-pass').value;
      const enc = document.getElementById('wifi-enc').value;
      if (!ssid) return null;
      const escape = (s) => s.replace(/([\\;,:"])/g, '\\$1');
      if (enc === 'nopass') {
        return `WIFI:T:nopass;S:${escape(ssid)};;`;
      }
      return `WIFI:T:${enc};S:${escape(ssid)};P:${escape(pass)};;`;
    }
    if (activeType === 'vcard') {
      const val = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');
      const name = val('vcard-name');
      if (!name) return null;

      // vCard vyžaduje escapovanie čiarok, bodkočiarok a spätných lomítok
      const esc = (s) => s.replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\n/g, ' ');

      // N: priezvisko;meno — mnohé čítačky bez tohto poľa kontakt neuložia
      const parts = name.split(/\s+/);
      const last = parts.length > 1 ? parts.pop() : '';
      const first = parts.join(' ');

      let web = val('vcard-web');
      if (web && !/^https?:\/\//i.test(web)) web = 'https://' + web;

      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      lines.push('N:' + esc(last) + ';' + esc(first) + ';;;');
      lines.push('FN:' + esc(name));
      if (val('vcard-org')) lines.push('ORG:' + esc(val('vcard-org')));
      if (val('vcard-title')) lines.push('TITLE:' + esc(val('vcard-title')));
      if (val('vcard-phone')) lines.push('TEL;TYPE=CELL:' + esc(val('vcard-phone')));
      if (val('vcard-email')) lines.push('EMAIL;TYPE=INTERNET:' + esc(val('vcard-email')));
      if (web) lines.push('URL:' + esc(web));
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    return null;
  }

  function validateBeforeGenerate() {
    if (activeType === 'url') {
      const normalized = normalizeUrl(document.getElementById('url').value);
      if (!normalized) {
        alert(t.url);
        document.getElementById('url').focus();
        return false;
      }
    }
    if (activeType === 'text') {
      if (!document.getElementById('text').value.trim()) {
        alert(t.text);
        document.getElementById('text').focus();
        return false;
      }
    }
    if (activeType === 'wifi') {
      if (!document.getElementById('wifi-ssid').value.trim()) {
        alert(t.ssid);
        document.getElementById('wifi-ssid').focus();
        return false;
      }
    }
    if (activeType === 'vcard') {
      if (!document.getElementById('vcard-name').value.trim()) {
        alert(t.name);
        document.getElementById('vcard-name').focus();
        return false;
      }
    }
    return true;
  }

  // Vykreslenie QR kódu: moduly z knižnice kreslíme sami, aby sme vedeli
  // vyrobiť PNG aj SVG z toho istého kódu a vložiť logo do stredu.
  // PNG má aspoň SIZE px a modul má vždy celý počet pixelov. Pri necelých
  // moduloch niektoré čítačky kód s určitou dĺžkou obsahu neprečítali.
  const SIZE = 600;
  const MARGIN = 1;

  // Logo prekryje stred kódu. S najvyššou korekciou chýb (H, až 30 %)
  // kód stále funguje, ak logo zaberá najviac ~8 % plochy (strana 28 %).
  const LOGO_SHARE = 0.28;

  function buildQr(text) {
    return QRCode.create(text, { errorCorrectionLevel: logo ? 'H' : 'M' });
  }

  // Štvorec v strede (v moduloch), ktorý sa pod logom vyprázdni.
  // Nepárna strana, aby bol presne v strede mriežky.
  function logoBox(size) {
    let k = Math.round(size * LOGO_SHARE);
    if (k % 2 === 0) k += 1;
    const start = (size - k) / 2;
    return { start, end: start + k, k };
  }

  function isDark(qr, box, r, c) {
    if (box && r >= box.start && r < box.end && c >= box.start && c < box.end) return false;
    return qr.modules.get(r, c);
  }

  // Logo sa vmestí do štvorca s okrajom, pomer strán ostane zachovaný
  function logoRect(box) {
    const pad = 0.4;
    const side = box.k - pad * 2;
    const ratio = logo.width / logo.height;
    const w = ratio >= 1 ? side : side * ratio;
    const h = ratio >= 1 ? side / ratio : side;
    const x = MARGIN + box.start + (box.k - w) / 2;
    const y = MARGIN + box.start + (box.k - h) / 2;
    return { x, y, w, h };
  }

  function drawCanvas(qr) {
    const size = qr.modules.size;
    const total = size + MARGIN * 2;
    const cell = Math.ceil(SIZE / total);
    const px = total * cell;
    const box = logo ? logoBox(size) : null;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isDark(qr, box, r, c)) ctx.fillRect((c + MARGIN) * cell, (r + MARGIN) * cell, cell, cell);
      }
    }
    if (box) {
      const rect = logoRect(box);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(logo.img, rect.x * cell, rect.y * cell, rect.w * cell, rect.h * cell);
    }
    return canvas;
  }

  function buildSvg(qr) {
    const size = qr.modules.size;
    const total = size + MARGIN * 2;
    const box = logo ? logoBox(size) : null;
    const px = total * Math.ceil(SIZE / total);
    let path = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isDark(qr, box, r, c)) path += 'M' + (c + MARGIN) + ' ' + (r + MARGIN) + 'h1v1h-1z';
      }
    }
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + total + ' ' + total +
      '" width="' + px + '" height="' + px + '" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      '<path fill="#000000" d="' + path + '"/>';
    if (box) {
      const rect = logoRect(box);
      const n = (v) => +v.toFixed(3);
      svg += '<image x="' + n(rect.x) + '" y="' + n(rect.y) + '" width="' + n(rect.w) + '" height="' + n(rect.h) +
        '" preserveAspectRatio="xMidYMid meet" xlink:href="' + logo.src + '"/>';
    }
    return svg + '</svg>';
  }

  async function generateQRCode(text, label) {
    qrContainer.innerHTML = '';
    let canvas;
    try {
      const qr = buildQr(text);
      canvas = drawCanvas(qr);
      lastSvg = buildSvg(qr);
    } catch (err) {
      qrContainer.textContent = t.error;
      lastDataUrl = null;
      lastSvg = null;
      console.error(err);
      return null;
    }
    const displayCanvas = document.createElement('canvas');
    displayCanvas.setAttribute('aria-hidden', 'true');
    displayCanvas.width = 184;
    displayCanvas.height = 184;
    const ctx = displayCanvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);

    qrContainer.appendChild(displayCanvas);
    qrContainer.setAttribute('aria-label', label || t.made);

    lastDataUrl = canvas.toDataURL('image/png');
    lastPayload = text;
    return canvas;
  }

  // Načítanie loga. SVG ostáva vektorové, veľké obrázky zmenšíme,
  // aby stiahnuté SVG nebolo zbytočne ťažké.
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function setLogo(file) {
    if (!file) { clearLogo(); return; }
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) {
      alert(t.logoType); clearLogo(); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(t.logoSize); clearLogo(); return;
    }
    try {
      let src = await readFile(file);
      let img = await loadImage(src);
      // SVG bez rozmerov má v niektorých prehliadačoch šírku 0
      let width = img.naturalWidth || 512;
      let height = img.naturalHeight || 512;
      if (file.type !== 'image/svg+xml' && Math.max(width, height) > 512) {
        const scale = 512 / Math.max(width, height);
        const c = document.createElement('canvas');
        c.width = Math.round(width * scale);
        c.height = Math.round(height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        src = c.toDataURL('image/png');
        img = await loadImage(src);
        width = c.width; height = c.height;
      }
      logo = { img, src, width, height };
    } catch (err) {
      console.error(err);
      alert(t.logoError); clearLogo(); return;
    }
    if (logoRemove) logoRemove.hidden = false;
    refresh();
  }

  function clearLogo() {
    logo = null;
    if (logoInput) logoInput.value = '';
    if (logoRemove) logoRemove.hidden = true;
    refresh();
  }

  // Ak už je kód vygenerovaný, prekreslí ho s novým logom
  function refresh() {
    if (lastPayload) generateQRCode(lastPayload, qrContainer.getAttribute('aria-label'));
  }

  if (logoInput) logoInput.addEventListener('change', () => setLogo(logoInput.files[0]));
  if (logoRemove) logoRemove.addEventListener('click', clearLogo);

  generateBtn.addEventListener('click', async () => {
    if (!validateBeforeGenerate()) return;
    const payload = buildPayload();
    if (!payload) return;
    generateBtn.disabled = true;
    generateBtn.textContent = t.working;
    await generateQRCode(payload, t.made + ' (' + activeType + ')');
    generateBtn.disabled = false;
    generateBtn.textContent = t.generate;
    if (hint) hint.textContent = t.done;
  });

  function downloadFile(href, name) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadBtn.addEventListener('click', () => {
    if (!lastDataUrl) { alert(t.first); return; }
    downloadFile(lastDataUrl, 'qr-code.png');
  });

  if (downloadSvgBtn) {
    downloadSvgBtn.addEventListener('click', () => {
      if (!lastSvg) { alert(t.first); return; }
      const url = URL.createObjectURL(new Blob([lastSvg], { type: 'image/svg+xml' }));
      downloadFile(url, 'qr-code.svg');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const normalized = normalizeUrl(document.getElementById('url').value);
      if (!normalized) {
        alert(t.url);
        document.getElementById('url').focus();
        return;
      }
      window.open(normalized, '_blank', 'noopener');
    });
  }

  document.getElementById('url')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); generateBtn.click(); }
  });

  resetPreview();
});
