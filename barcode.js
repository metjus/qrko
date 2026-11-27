document.addEventListener('DOMContentLoaded', () => {
  // Texty hlásení (web je len po anglicky)
  const t = {
    ean13len: (n) => `You entered ${n} characters. EAN-13 needs exactly 12 or 13 digits.`,
    upclen: (n) => `You entered ${n} characters. UPC-A needs exactly 11 or 12 digits.`,
    badCheck: "The check digit doesn't match. Double-check for a typo, or leave the last digit out — we'll calculate it for you.",
    digitsOnly: 'This field can only contain digits.',
    noDiacritics: 'CODE128 does not support accented letters or other special characters outside the standard English alphabet. Try the text without accents.',
    empty: 'Enter a value to encode.',
    working: 'Generating…',
    generate: 'Generate barcode',
    done: 'Done. Download the code or scan it right away.',
    first: 'Generate a barcode first.',
    error: 'That value could not be encoded. Check the format.',
    placeholder: 'Your barcode will appear here',
    preview: 'Barcode preview'
  };

  const generateBtn = document.getElementById('bc-generate');
  if (!generateBtn) return; // tento skript beží iba na stránke Čiarové kódy

  const stage = document.getElementById('bc-stage');
  const svgHost = document.getElementById('bc-svg');
  const downloadBtn = document.getElementById('bc-download');
  const hint = document.getElementById('bc-hint');
  const typeSelect = document.getElementById('bc-type');
  const valueInput = document.getElementById('bc-value');
  const errorEl = document.getElementById('bc-error');

  let lastPngUrl = null;

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    valueInput.setAttribute('aria-invalid', 'true');
  }
  function clearError() {
    errorEl.textContent = '';
    errorEl.hidden = true;
    valueInput.removeAttribute('aria-invalid');
  }
  valueInput.addEventListener('input', clearError);
  typeSelect.addEventListener('change', clearError);

  /*
    JsBarcode má (aspoň vo verzii 3.12.1) vnútornú chybu: po zavolaní
    EAN13/UPC a následne CODE128 v tej istej stránke zlyhá CODE128 na
    úplne bežnom texte s nezmyselnou chybou o regulárnom výraze.
    Overené opakovaným testovaním. Obídeme to tak, že knižnicu pred
    KAŽDÝM generovaním načítame ako čerstvý <script> (s cache-bust
    parametrom), čím sa jej vnútorný stav nemá šancu skaziť medzi
    jednotlivými formátmi. Malá réžia (desiatky ms), žiadne riziko.
  */
  function loadFreshJsBarcode() {
    return new Promise((resolve, reject) => {
      const old = document.getElementById('jsbarcode-lib');
      if (old) old.remove();
      try { delete window.JsBarcode; } catch (e) { window.JsBarcode = undefined; }
      const s = document.createElement('script');
      s.id = 'jsbarcode-lib';
      s.src = '/jsbarcode.min.js?v=' + Date.now();
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('jsbarcode-load-failed'));
      document.head.appendChild(s);
    });
  }

  function checkDigitEAN(digits12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(digits12[i], 10);
      sum += (i % 2 === 0) ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  function validate() {
    const raw = valueInput.value.trim();
    const type = typeSelect.value;

    if (!raw) { showError(t.empty); return null; }

    if (type === 'EAN13' || type === 'UPC') {
      if (!/^\d+$/.test(raw)) { showError(t.digitsOnly); return null; }
      const need = type === 'EAN13' ? [12, 13] : [11, 12];
      if (raw.length !== need[0] && raw.length !== need[1]) {
        showError(type === 'EAN13' ? t.ean13len(raw.length) : t.upclen(raw.length));
        return null;
      }
      if (raw.length === need[1]) {
        // Používateľ zadal aj kontrolnú číslicu - overíme ju sami vopred,
        // aby hláška bola zrozumiteľná (nie technická chyba z knižnice).
        const body = type === 'EAN13' ? raw.slice(0, 12) : '0' + raw.slice(0, 11);
        const expected = checkDigitEAN(body);
        const given = parseInt(raw.slice(-1), 10);
        if (expected !== given) { showError(t.badCheck); return null; }
      }
      return raw;
    }

    // CODE128: základný režim podporuje len bežnú anglickú abecedu,
    // číslice a interpunkciu (ASCII 32-126) - žiadnu diakritiku.
    if (!/^[\x20-\x7E]*$/.test(raw)) { showError(t.noDiacritics); return null; }
    return raw;
  }

  function jsBarcodeFormat(type) {
    if (type === 'EAN13') return 'EAN13';
    if (type === 'UPC') return 'UPC';
    return 'CODE128';
  }

  generateBtn.addEventListener('click', async () => {
    const value = validate();
    if (!value) return;

    generateBtn.disabled = true;
    const original = generateBtn.textContent;
    generateBtn.textContent = t.working;

    try {
      await loadFreshJsBarcode();

      svgHost.innerHTML = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgHost.appendChild(svg);

      JsBarcode(svg, value, {
        format: jsBarcodeFormat(typeSelect.value),
        width: 2.4,
        height: 90,
        displayValue: true,
        font: 'monospace',
        fontSize: 16,
        margin: 10,
        background: '#ffffff',
        lineColor: '#0b0d12'
      });
      stage.classList.add('has-code');

      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      await new Promise((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 3; // ostrejšie PNG pre tlač
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          if (lastPngUrl) URL.revokeObjectURL(lastPngUrl);
          lastPngUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });

      if (hint) hint.textContent = t.done;
    } catch (e) {
      svgHost.innerHTML = '';
      stage.classList.remove('has-code');
      showError(t.error);
    }

    generateBtn.disabled = false;
    generateBtn.textContent = original;
  });

  downloadBtn.addEventListener('click', () => {
    if (!lastPngUrl) { alert(t.first); return; }
    const a = document.createElement('a');
    a.href = lastPngUrl;
    a.download = 'barcode.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  valueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); generateBtn.click(); }
  });
});
