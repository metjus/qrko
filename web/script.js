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
    made: 'Generated QR code'
  };
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Generátor je iba na hlavnej stránke - na ostatných stránkach tento kód nič nerobí
  const generateBtn = document.getElementById('generate');
  if (!generateBtn) return;

  const qrContainer = document.getElementById('qr');
  const qrPlaceholder = document.getElementById('qr-placeholder');
  const downloadBtn = document.getElementById('download');
  const openBtn = document.getElementById('open');
  const hint = document.getElementById('hint');
  const tabs = Array.from(document.querySelectorAll('.qr-tab'));
  const fields = Array.from(document.querySelectorAll('.qr-field'));

  let lastDataUrl = null;
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

  async function generateQRCode(text, label) {
    qrContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    try {
      await QRCode.toCanvas(canvas, text, { width: 600, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
    } catch (err) {
      qrContainer.textContent = t.error;
      console.error(err);
      return null;
    }
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = 184;
    displayCanvas.height = 184;
    const ctx = displayCanvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
    ctx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);

    qrContainer.appendChild(displayCanvas);
    qrContainer.setAttribute('aria-label', label || t.made);

    lastDataUrl = canvas.toDataURL('image/png');
    return canvas;
  }

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

  downloadBtn.addEventListener('click', () => {
    if (!lastDataUrl) { alert(t.first); return; }
    const a = document.createElement('a');
    a.href = lastDataUrl;
    a.download = 'qr-code.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

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
