/*
  Čítačka QR kódov z obrázka (stránka /qr-reader).

  Ako to funguje:
  1. Obrázok sa dostane do stránky troma spôsobmi: pustením (drag & drop),
     výberom súboru (na mobile aj odfotením) alebo vložením zo schránky.
  2. Obrázok sa nikam neodosiela. Číta sa priamo v prehliadači cez canvas
     a knižnicu jsQR (jsqr.min.js, licencia Apache 2.0).
  3. Ak sa kód nenájde hneď, skúša sa viac mierok a potom výrezy obrázka,
     lebo malý kód v celej fotke knižnica niekedy prehliadne.
  4. Obsah kódu sa NIKDY neotvára automaticky. Zobrazí sa ako text
     a pri odkazoch s upozorneniami, ak vyzerajú podozrivo.

  BEZPEČNOSŤ: obsah kódu je cudzí vstup. Do stránky sa vkladá výhradne cez
  textContent (nikdy innerHTML) a odkaz sa vytvorí len pre http/https.

  Súbor je rozdelený na sekcie: 1) nastavenie, 2) čítanie kódov z obrázka,
  3) rozpoznanie typu obsahu, 4) vykreslenie výsledkov, 5) vstup od používateľa.
*/
document.addEventListener('DOMContentLoaded', () => {
  const drop = document.getElementById('qr-drop');
  if (!drop) return; // tento skript beží iba na stránke /qr-reader

  // ═══════════════════════════════════════════════════════════════════
  // 1) NASTAVENIE
  // ═══════════════════════════════════════════════════════════════════
  const fileInput = document.getElementById('qr-file');
  const errorEl = document.getElementById('qr-error');
  const statusEl = document.getElementById('qr-status');
  const previewImg = document.getElementById('qr-preview');
  const previewEmpty = document.getElementById('qr-preview-empty');
  const resultsEl = document.getElementById('qr-results');

  const MAX_FILE_BYTES = 25 * 1024 * 1024; // väčšie súbory prehliadač zbytočne zaťažia
  const MAX_CODES = 6;                      // koľko kódov na jednom obrázku hľadáme
  const IDLE_NOTE = 'The image is read on your device. Nothing is uploaded.';

  // Skracovače odkazov: skutočný cieľ je skrytý, preto na to upozorníme
  const SHORTENERS = new Set([
    'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'is.gd', 'ow.ly', 'buff.ly',
    'rebrand.ly', 'cutt.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 'lnkd.in'
  ]);

  let previewUrl = null; // adresa náhľadu, ktorú treba uvoľniť
  let runId = 0;         // číslo posledného spracovania (staré výsledky zahodíme)

  // ═══════════════════════════════════════════════════════════════════
  // 2) ČÍTANIE KÓDOV Z OBRÁZKA
  // ═══════════════════════════════════════════════════════════════════

  const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

  // Načíta obrázok. createImageBitmap správne zohľadní otočenie z fotoaparátu,
  // záloha cez <img> pokryje staršie prehliadače.
  async function loadSource(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap, width: bitmap.width, height: bitmap.height,
          close: () => { if (bitmap.close) bitmap.close(); }
        };
      } catch (e) { /* skúsime záložný spôsob */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth, height = img.naturalHeight;
        if (!width || !height) { URL.revokeObjectURL(url); reject(new Error('empty')); return; }
        resolve({ source: img, width, height, close: () => URL.revokeObjectURL(url) });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  // Vykreslí výrez obrázka (sx, sy, sw, sh v bodoch pôvodného obrázka) na canvas
  // tak, aby jeho dlhšia strana mala `longest` bodov. Pozadie je biele:
  // priehľadné PNG by sa inak čítalo ako čierne. Už nájdené kódy (`masks`)
  // sa zakryjú bielou, aby sa nenašli znova.
  function grab(src, sx, sy, sw, sh, longest, masks) {
    const scale = Math.min(longest / Math.max(sw, sh), 4);
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = scale < 1; // pri zväčšovaní nechceme rozmazať moduly
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    ctx.fillStyle = '#fff';
    masks.forEach((m) => ctx.fillRect((m.x - sx) * scale, (m.y - sy) * scale, m.w * scale, m.h * scale));
    return { ctx, w, h, scale, sx, sy };
  }

  // Prečíta z canvasu všetky kódy, ktoré knižnica nájde: po každom nájdenom
  // ho zakryje bielou a hľadá ďalší. Vráti aj polohu kódu v bodoch
  // pôvodného obrázka (na zakrytie pri ďalšom hľadaní).
  function readAll(g) {
    const hits = [];
    for (let i = 0; i < MAX_CODES; i++) {
      const image = g.ctx.getImageData(0, 0, g.w, g.h);
      const hit = jsQR(image.data, g.w, g.h, { inversionAttempts: 'attemptBoth' });
      if (!hit) break;
      const c = hit.location;
      const xs = [c.topLeftCorner.x, c.topRightCorner.x, c.bottomLeftCorner.x, c.bottomRightCorner.x];
      const ys = [c.topLeftCorner.y, c.topRightCorner.y, c.bottomLeftCorner.y, c.bottomRightCorner.y];
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const bw = Math.max(...xs) - x0, bh = Math.max(...ys) - y0;
      const pad = 0.12 * Math.max(bw, bh); // rezerva okolo kódu
      g.ctx.fillStyle = '#fff';
      g.ctx.fillRect(x0 - pad, y0 - pad, bw + 2 * pad, bh + 2 * pad);
      if (hit.data === '') continue;
      hits.push({
        data: hit.data,
        rect: { x: g.sx + (x0 - pad) / g.scale, y: g.sy + (y0 - pad) / g.scale,
                w: (bw + 2 * pad) / g.scale, h: (bh + 2 * pad) / g.scale }
      });
    }
    return hits;
  }

  // Zoznam stratégií hľadania, od najlacnejšej (cena rastie s veľkosťou
  // obrázka, preto sa začína malými mierkami):
  //  - celý obrázok v niekoľkých mierkach (700, 1000 a prípadne 1600 bodov),
  //  - výrezy s prekryvom (malý kód uprostred veľkej fotky; navyše knižnica
  //    pri viacerých kódoch vedľa seba často nenájde ani jeden, v malom
  //    výreze je však sám). Pri veľkých fotkách výrezy 2x2 nahrádzajú drahý
  //    pokus s celým obrázkom na 1600 bodov, majú podobné rozlíšenie.
  function strategies(src) {
    const longest = Math.max(src.width, src.height);
    const targets = longest < 500
      ? [800, 500]
      : [700, 1000, 1600].filter((t) => t < longest && (t < 1600 || longest <= 2200));
    if (longest >= 500 && longest <= 1600) targets.push(longest);
    const list = targets.map((target) => ({ kind: 'whole', target }));
    [2, 3].forEach((n) => list.push({ kind: 'tiles', n }));
    return list;
  }

  // Spustí jednu stratégiu a vráti všetky kódy, ktoré našla (bez zakrytých)
  async function runStrategy(src, strategy, masks) {
    const hits = [];
    const add = (list) => list.forEach((h) => { if (!hits.some((x) => x.data === h.data)) hits.push(h); });
    if (strategy.kind === 'whole') {
      await pause();
      add(readAll(grab(src.source, 0, 0, src.width, src.height, strategy.target, masks)));
    } else {
      const n = strategy.n;
      const tw = Math.min(src.width, Math.round(src.width / n * 1.35));
      const th = Math.min(src.height, Math.round(src.height / n * 1.35));
      const stepX = (src.width - tw) / (n - 1);
      const stepY = (src.height - th) / (n - 1);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          await pause();
          add(readAll(grab(src.source, Math.round(i * stepX), Math.round(j * stepY), tw, th,
                           Math.min(Math.max(tw, th), 1000), masks)));
        }
      }
    }
    return hits;
  }

  // Hlavná funkcia: vráti pole textov zo všetkých nájdených kódov.
  // `onUpdate(zoznam)` sa zavolá vždy, keď pribudne nový kód, takže prvý
  // výsledok sa ukáže hneď a hľadanie ďalších beží na pozadí.
  //
  // 1) Prvé kódy sa hľadajú všetkými stratégiami od najlacnejšej.
  // 2) Potom sa hľadá ďalej so zakrytými už nájdenými kódmi (len celý obrázok
  //    a výrezy 2x2), kým sa nenájde nič nové. Knižnica totiž nevie prečítať
  //    viac kódov vedľa seba naraz, ale každý zvlášť prečíta bez problémov.
  async function findCodes(file, onUpdate, onStage) {
    const src = await loadSource(file);
    try {
      const found = [];
      const masks = [];
      const take = (hits) => {
        let added = 0;
        hits.forEach((h) => {
          if (found.length < MAX_CODES && !found.includes(h.data)) {
            found.push(h.data); masks.push(h.rect); added++;
          }
        });
        if (added && onUpdate) onUpdate(found.slice());
        return added;
      };

      let any = false;
      for (const strategy of strategies(src)) {
        // pri dlhšom hľadaní dáme používateľovi vedieť, že sa niečo deje
        if (strategy.kind === 'tiles' && onStage) onStage('Still looking: scanning the picture section by section…');
        if (take(await runStrategy(src, strategy, masks))) { any = true; break; }
      }
      if (!any) return found;

      const cheap = strategies(src).filter((st) => st.kind === 'whole' || st.n === 2);
      let progress = true;
      while (progress && found.length < MAX_CODES) {
        progress = false;
        for (const strategy of cheap) {
          if (take(await runStrategy(src, strategy, masks))) { progress = true; break; }
        }
      }
      return found;
    } finally {
      src.close();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3) ROZPOZNANIE TYPU OBSAHU
  // Každá funkcia vráti { type, fields: [[názov, hodnota], ...], ... }
  // ═══════════════════════════════════════════════════════════════════

  // Rozdelí text podľa oddeľovača, ktorý nie je „escapovaný" spätným lomítkom
  function splitUnescaped(text, sep) {
    const parts = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\\' && i + 1 < text.length) { cur += ch + text[i + 1]; i++; }
      else if (ch === sep) { parts.push(cur); cur = ''; }
      else { cur += ch; }
    }
    parts.push(cur);
    return parts;
  }
  const unescapeBackslash = (s) => s.replace(/\\(.)/g, '$1');
  // decodeURIComponent vie spadnúť na poškodenom texte, tak ho ošetríme
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };

  function parseWifi(text) {
    const data = {};
    splitUnescaped(text.slice(5), ';').forEach((token) => {
      const pieces = splitUnescaped(token, ':');
      if (pieces.length < 2) return;
      data[pieces[0].trim().toUpperCase()] = unescapeBackslash(pieces.slice(1).join(':'));
    });
    const security = (data.T || '').toUpperCase();
    const secLabel = security === 'NOPASS' || security === ''
      ? 'None (open network)'
      : (security === 'WPA' ? 'WPA / WPA2 / WPA3' : security);
    const fields = [['Network name', data.S || '(empty)'], ['Security', secLabel]];
    if (security !== 'NOPASS' && data.P !== undefined) fields.push(['Password', data.P]);
    if (String(data.H).toLowerCase() === 'true') fields.push(['Hidden network', 'Yes']);
    return {
      type: 'wifi', label: 'Wi-Fi network', fields,
      copyExtra: data.P ? { label: 'Copy password', value: data.P } : null
    };
  }

  function parseVCard(text) {
    // vCard môže mať zalomené riadky (pokračovanie začína medzerou)
    const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    const card = { TEL: [], EMAIL: [], URL: [] };
    lines.forEach((line) => {
      const idx = line.indexOf(':');
      if (idx < 1) return;
      const name = line.slice(0, idx).split(';')[0].toUpperCase();
      const value = line.slice(idx + 1)
        .replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
      if (['TEL', 'EMAIL', 'URL'].includes(name)) card[name].push(value);
      else if (!card[name]) card[name] = value;
    });
    let name = card.FN;
    if (!name && card.N) {
      const n = card.N.split(';');
      name = [n[1], n[0]].filter(Boolean).join(' ');
    }
    const fields = [];
    if (name) fields.push(['Name', name]);
    if (card.ORG) fields.push(['Organization', card.ORG.split(';').filter(Boolean).join(', ')]);
    if (card.TITLE) fields.push(['Job title', card.TITLE]);
    card.TEL.forEach((v) => fields.push(['Phone', v]));
    card.EMAIL.forEach((v) => fields.push(['Email', v]));
    card.URL.forEach((v) => fields.push(['Website', v]));
    if (card.ADR) fields.push(['Address', card.ADR.split(';').filter(Boolean).join(', ')]);
    if (card.NOTE) fields.push(['Note', card.NOTE]);
    return { type: 'contact', label: 'Contact card', fields, vcf: text };
  }

  function parseUrl(text) {
    let url;
    try { url = new URL(text.trim()); } catch (e) { return null; }
    const host = url.hostname;
    const warnings = [];
    if (url.protocol === 'http:') {
      warnings.push('This link is not encrypted (http), so others on the network may see what you open.');
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
      warnings.push('The link points to a numeric IP address instead of a website name.');
    }
    if (host.split('.').some((part) => part.startsWith('xn--'))) {
      warnings.push('The address uses international characters that can imitate a well-known site.');
    }
    if (url.username || url.password) {
      warnings.push('The address contains a username or password part, a common trick to disguise the real site.');
    }
    if (SHORTENERS.has(host.replace(/^www\./, ''))) {
      warnings.push('This is a link shortener, so the real destination stays hidden until you open it.');
    }
    return {
      type: 'link', label: 'Web link',
      fields: [['Website', host], ['Full address', url.href]],
      link: url.href, warnings
    };
  }

  function parseContent(text) {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('wifi:')) return parseWifi(trimmed);
    if (lower.startsWith('begin:vcard')) return parseVCard(trimmed);

    if (/^https?:\/\//i.test(trimmed)) {
      const link = parseUrl(trimmed);
      if (link) return link;
    }

    if (lower.startsWith('mailto:')) {
      let url = null;
      try { url = new URL(trimmed); } catch (e) { /* zostane obyčajný text */ }
      if (url) {
        const fields = [['Email address', safeDecode(url.pathname)]];
        if (url.searchParams.get('subject')) fields.push(['Subject', url.searchParams.get('subject')]);
        if (url.searchParams.get('body')) fields.push(['Message', url.searchParams.get('body')]);
        return { type: 'email', label: 'Email', fields };
      }
    }
    if (lower.startsWith('tel:')) {
      return { type: 'phone', label: 'Phone number', fields: [['Number', trimmed.slice(4)]] };
    }
    if (lower.startsWith('smsto:') || lower.startsWith('sms:')) {
      const body = trimmed.slice(trimmed.indexOf(':') + 1);
      const parts = lower.startsWith('smsto:') ? body.split(':') : body.split('?body=');
      const fields = [['Number', parts[0]]];
      if (parts[1]) fields.push(['Message', parts.slice(1).join(':')]);
      return { type: 'sms', label: 'SMS message', fields };
    }
    if (lower.startsWith('geo:')) {
      const coords = trimmed.slice(4).split(/[?;]/)[0].split(',');
      const lat = parseFloat(coords[0]), lon = parseFloat(coords[1]);
      if (isFinite(lat) && isFinite(lon)) {
        return {
          type: 'location', label: 'Location',
          fields: [['Latitude', String(lat)], ['Longitude', String(lon)]],
          link: 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=16/' + lat + '/' + lon,
          linkLabel: 'View on map', warnings: []
        };
      }
    }
    // iné schémy (otpauth:, bitcoin:, upi: ...): otvorili by inú aplikáciu
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      return {
        type: 'app', label: 'Link for another app', fields: [],
        note: 'This code would open another app on your phone (for example a payment or authenticator app). Only continue if you trust where the code came from.'
      };
    }
    return { type: 'text', label: 'Text', fields: [] };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4) VYKRESLENIE VÝSLEDKOV
  // ═══════════════════════════════════════════════════════════════════

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // iba textContent, nikdy innerHTML
    return node;
  }

  function copyText(text, button, doneLabel) {
    const original = button.textContent;
    const done = () => {
      button.textContent = doneLabel || 'Copied';
      setTimeout(() => { button.textContent = original; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => legacyCopy(text, done));
    } else {
      legacyCopy(text, done);
    }
  }
  function legacyCopy(text, done) {
    const area = el('textarea', 'visually-hidden');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try { if (document.execCommand('copy')) done(); } catch (e) { /* nič */ }
    area.remove();
  }

  function renderCard(parsed, raw, index) {
    const card = el('article', 'result-card');
    card.setAttribute('data-type', parsed.type);

    const head = el('div', 'result-head');
    head.appendChild(el('span', 'result-badge', parsed.label));
    head.appendChild(el('h2', '', 'Decoded content'));
    head.appendChild(el('span', 'result-count')); // text doplní labelCards()
    card.appendChild(head);

    if (parsed.fields && parsed.fields.length) {
      const dl = el('dl', 'result-fields');
      parsed.fields.forEach(([name, value]) => {
        dl.appendChild(el('dt', '', name));
        dl.appendChild(el('dd', '', value));
      });
      card.appendChild(dl);
    }

    if (parsed.warnings && parsed.warnings.length) {
      const list = el('ul', 'result-warn');
      list.setAttribute('role', 'note');
      parsed.warnings.forEach((w) => list.appendChild(el('li', '', w)));
      card.appendChild(list);
    }
    if (parsed.link && parsed.type === 'link') {
      card.appendChild(el('p', 'result-note',
        'We never open links for you. Check the address above before you continue.'));
    }
    if (parsed.note) card.appendChild(el('p', 'result-note', parsed.note));

    const labelId = 'raw-' + index;
    const label = el('label', 'result-raw-label', 'Raw text');
    label.setAttribute('for', labelId);
    const raw$ = el('textarea', 'result-raw');
    raw$.id = labelId;
    raw$.readOnly = true;
    raw$.value = raw;
    raw$.rows = Math.min(6, Math.max(2, raw.split('\n').length));
    card.appendChild(label);
    card.appendChild(raw$);

    const actions = el('div', 'result-actions');
    const copyBtn = el('button', 'btn btn-primary', 'Copy text');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', () => copyText(raw, copyBtn));
    actions.appendChild(copyBtn);

    if (parsed.copyExtra) {
      const extra = el('button', 'btn', parsed.copyExtra.label);
      extra.type = 'button';
      extra.addEventListener('click', () => copyText(parsed.copyExtra.value, extra));
      actions.appendChild(extra);
    }
    if (parsed.vcf) {
      const save = el('button', 'btn', 'Save contact (.vcf)');
      save.type = 'button';
      save.addEventListener('click', () => {
        const blob = new Blob([parsed.vcf], { type: 'text/vcard;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'contact.vcf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      actions.appendChild(save);
    }
    if (parsed.link) {
      // odkaz vzniká len pre http/https (parseUrl) a mapu, ktorú skladáme sami
      const a = el('a', 'btn btn-link',
        parsed.linkLabel || (parsed.warnings && parsed.warnings.length ? 'Open link anyway' : 'Open link'));
      a.href = parsed.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      actions.appendChild(a);
    }
    card.appendChild(actions);
    return card;
  }

  // Pri viacerých kódoch ich označí „Code 1 of 3"
  function labelCards() {
    const cards = resultsEl.querySelectorAll('.result-card');
    cards.forEach((card, i) => {
      card.querySelector('.result-count').textContent =
        cards.length > 1 ? 'Code ' + (i + 1) + ' of ' + cards.length : '';
    });
  }

  // Prispôsobí výšku polí „Raw text“ ich obsahu. Atribút rows počíta len
  // skutočné konce riadkov, takže dlhý odkaz, ktorý sa na úzkom displeji
  // zalomí na tri riadky, by sa v dvojriadkovom poli orezal.
  // Volá sa až keď je karta v stránke (mimo nej nemá text žiadnu výšku).
  function fitRawFields() {
    resultsEl.querySelectorAll('.result-raw').forEach((area) => {
      area.style.height = 'auto';
      area.style.height = Math.min(area.scrollHeight + 2, 320) + 'px'; // dlhšie texty sa posúvajú vnútri poľa
    });
  }
  window.addEventListener('resize', fitRawFields); // otočenie telefónu mení zalamovanie

  // Zobrazí kódy. Už vykreslené karty ostanú, pridajú sa len nové,
  // takže sa výsledok nehýbe, kým hľadanie ďalších kódov ešte beží.
  function showCodes(codes, stillSearching) {
    resultsEl.querySelectorAll('.reader-empty').forEach((n) => n.remove());
    while (resultsEl.querySelectorAll('.result-card').length < codes.length) {
      const i = resultsEl.querySelectorAll('.result-card').length;
      resultsEl.appendChild(renderCard(parseContent(codes[i]), codes[i], i));
    }
    fitRawFields();
    labelCards();
    const found = codes.length === 1 ? 'Found 1 QR code.' : 'Found ' + codes.length + ' QR codes.';
    setStatus(stillSearching ? found + ' Checking for more…' : found);
  }

  function showNone() {
    resultsEl.textContent = '';
    const box = el('div', 'reader-empty');
    box.appendChild(el('h2', '', 'No QR code found'));
    box.appendChild(el('p', '', 'The picture was read, but no readable QR code was found in it. Try this:'));
    const tips = el('ul');
    [
      'Crop the picture so the QR code fills most of it.',
      'Make sure the whole code is visible, including the white border around it.',
      'Avoid glare, blur and shadows. A sharper, larger picture works best.',
      'For a code on a screen, a screenshot works better than a photo of the screen.',
      'This reader handles QR codes only. Barcodes such as EAN or UPC are not supported.'
    ].forEach((t) => tips.appendChild(el('li', '', t)));
    box.appendChild(tips);
    resultsEl.appendChild(box);
    setStatus('No QR code found.');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5) VSTUP OD POUŽÍVATEĽA
  // ═══════════════════════════════════════════════════════════════════

  function setStatus(message) { statusEl.textContent = message; }
  function showError(message) { errorEl.textContent = message; errorEl.hidden = false; }
  function clearError() { errorEl.textContent = ''; errorEl.hidden = true; }

  function showPreview(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    previewImg.src = previewUrl;
    previewImg.hidden = false;
    previewEmpty.hidden = true;
  }

  const isImage = (file) => file && /^image\//i.test(file.type);

  async function handleFile(file, droppedCount) {
    clearError();
    resultsEl.textContent = '';
    if (!isImage(file)) {
      showError('That does not look like an image. Please choose a PNG, JPG, WebP or GIF picture.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showError('That image is larger than 25 MB. Please use a smaller picture or a screenshot.');
      return;
    }
    const myRun = ++runId;
    showPreview(file);
    setStatus(droppedCount > 1
      ? 'Reading the first of ' + droppedCount + ' images…'
      : 'Looking for QR codes…');
    try {
      const codes = await findCodes(file, (list) => {
        if (myRun === runId) showCodes(list, true); // prvý výsledok hneď, hľadanie pokračuje
      }, (message) => {
        if (myRun === runId) setStatus(message);
      });
      if (myRun !== runId) return; // medzitým prišiel novší obrázok
      if (codes.length) showCodes(codes, false); else showNone();
    } catch (e) {
      if (myRun !== runId) return;
      showError('Your browser could not open this image. Try a screenshot or a JPG or PNG version.');
      setStatus(IDLE_NOTE);
    }
  }

  function firstImage(fileList) {
    return Array.prototype.find.call(fileList || [], isImage) || (fileList && fileList[0]) || null;
  }

  // Výber súboru (na mobile ponúkne aj fotoaparát)
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handleFile(file, fileInput.files.length);
    fileInput.value = ''; // aby sa dal vybrať ten istý súbor znova
  });

  // Pustenie obrázka na zónu
  ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add('is-dragover');
  }));
  ['dragleave', 'dragend'].forEach((type) => drop.addEventListener(type, () => {
    drop.classList.remove('is-dragover');
  }));
  drop.addEventListener('drop', () => drop.classList.remove('is-dragover'));

  // Pustenie hocikde na stránke: spracujeme ho a zabránime tomu, aby
  // prehliadač obrázok otvoril namiesto stránky
  const hasFiles = (e) => e.dataTransfer && Array.prototype.includes.call(e.dataTransfer.types || [], 'Files');
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer) return;
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || !files.length) {
      showError('Please drop an image file, not a link. Save the picture first, or copy it and paste it here.');
      return;
    }
    handleFile(firstImage(files), files.length);
  });

  // Vloženie obrázka zo schránky (napr. snímka obrazovky + Ctrl+V)
  document.addEventListener('paste', (e) => {
    const files = e.clipboardData && e.clipboardData.files;
    if (!files || !files.length) return;
    const file = firstImage(files);
    if (isImage(file)) {
      e.preventDefault();
      handleFile(file, files.length);
    }
  });

  // Na dotykových zariadeniach nedáva zmysel „drag and drop" ani Ctrl+V
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    const title = drop.querySelector('.dropzone-title');
    const sub = drop.querySelector('.dropzone-sub');
    if (title) title.textContent = 'Tap to choose a picture';
    if (sub) sub.textContent = 'or take a photo of a QR code';
  }

  setStatus(IDLE_NOTE);
});
