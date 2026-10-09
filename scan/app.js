/* Kontora Scan – Belege fotografieren und verschlüsselt an Kontora auf dem PC senden.
 *
 * Ablauf: Der PC zeigt einen QR-Code mit Kopplungs-ID und geheimem Schlüssel
 * (im #-Teil der Adresse – der wird nie an einen Server geschickt). Dieses
 * Handy speichert beides, fotografiert Belege, schneidet sie automatisch zu
 * (Kantenerkennung + Entzerrung), verschlüsselt sie mit AES-GCM und lädt den
 * Chiffretext hoch. Der PC holt ihn ab, entschlüsselt und löscht ihn vom Server.
 */
(() => {
  'use strict';

  const RELAY = 'https://brtdtjqinyhsesiqhkkk.supabase.co/functions/v1/kontora-scan';
  const STORE_KEY = 'kontoraScan.v1';
  const MAX_SRC = 2400; // Arbeitsauflösung (lange Kante)
  const MAX_OUT = 2000; // Ausgabe (lange Kante)

  // ── Texte ───────────────────────────────────────────────────────────────
  const T = {
    de: {
      menu: 'Menü', unpair: 'Dieses Handy entkoppeln', loading: 'Wird geladen…',
      unpairedTitle: 'Handy mit Kontora koppeln', unpaired1: 'Öffne Kontora auf deinem PC.',
      unpaired2: 'Gehe zu Belege → Mit Handy scannen.', unpaired3: 'Scanne den QR-Code mit der Kamera dieses Handys.',
      unpairedNote: 'Danach kannst du Belege von überall fotografieren – sie landen automatisch in Kontora auf deinem PC.',
      shoot: 'Beleg fotografieren', pick: 'Aus Galerie oder Datei (Foto, PDF)', draftTitle: 'Aktueller Beleg',
      addPage: '+ Weitere Seite', next: 'Weiter', history: 'Zuletzt gesendet', historyEmpty: 'Noch keine Belege gesendet.',
      cropTip: 'Ecken ziehen, bis nur der Beleg im Rahmen ist.', rotate: 'Drehen', full: 'Ganzes Bild',
      modeDoc: 'Dokument', modeColor: 'Farbe', cancel: 'Verwerfen', useCrop: 'Übernehmen', reviewTitle: 'Beleg senden',
      paidHow: 'Wie bezahlt?', payBank: 'Karte / Überweisung', payCash: 'Bar', note: 'Notiz (optional)', back: 'Zurück',
      send: 'An Kontora senden', e2e: '🔒 Wird auf diesem Handy verschlüsselt. Nur dein PC kann den Beleg öffnen.',
      pairedTo: 'Gekoppelt mit', pairedNow: 'Gekoppelt! Du kannst jetzt Belege fotografieren.',
      pages: (n) => (n === 1 ? '1 Seite' : `${n} Seiten`), page: 'Seite',
      processing: 'Beleg wird aufbereitet…', encrypting: 'Wird verschlüsselt…',
      queued: 'Gespeichert – wird gesendet.', sentOk: 'Gesendet! Kontora holt den Beleg ab, sobald dein PC läuft.',
      stWait: 'Wartet auf Internet', stSent: 'Gesendet – PC holt ab', stOk: 'In Kontora angekommen', stErr: 'Fehler – wird erneut versucht',
      receipt: 'Beleg', pcSeen: (s) => `PC zuletzt erreichbar: ${s}`, pcNever: 'Dein PC hat noch keine Belege abgeholt. Öffne Kontora am PC, dann geht es automatisch.',
      unpairConfirm: 'Dieses Handy wirklich entkoppeln? Noch nicht abgeholte Belege werden gelöscht.',
      unpaired: 'Handy entkoppelt.', revoked: 'Die Kopplung wurde am PC aufgehoben. Bitte neu koppeln.',
      tooBig: 'Die Datei ist zu groß (max. 10 MB).', notImage: 'Diese Datei kann nicht gelesen werden.',
      installIos: 'Tipp: Tippe unten auf „Teilen“ und dann „Zum Home-Bildschirm“ – dann startet Kontora Scan wie eine App.',
      installBtn: 'Als App installieren', batchSent: (n) => `${n} Belege gespeichert – werden gesendet.`,
      menuInfo: (name) => `Gekoppelt mit ${name}. Fotos werden verschlüsselt übertragen und nach dem Abholen vom Server gelöscht.`,
      justNow: 'gerade eben', minutesAgo: (n) => `vor ${n} Min.`, hoursAgo: (n) => `vor ${n} Std.`,
    },
    en: {
      menu: 'Menu', unpair: 'Unpair this phone', loading: 'Loading…',
      unpairedTitle: 'Pair your phone with Kontora', unpaired1: 'Open Kontora on your computer.',
      unpaired2: 'Go to Receipts → Scan with phone.', unpaired3: 'Scan the QR code with this phone’s camera.',
      unpairedNote: 'After that you can photograph receipts anywhere – they arrive in Kontora on your computer automatically.',
      shoot: 'Photograph receipt', pick: 'From gallery or file (photo, PDF)', draftTitle: 'Current receipt',
      addPage: '+ Add page', next: 'Next', history: 'Recently sent', historyEmpty: 'No receipts sent yet.',
      cropTip: 'Drag the corners until only the receipt is inside the frame.', rotate: 'Rotate', full: 'Whole image',
      modeDoc: 'Document', modeColor: 'Color', cancel: 'Discard', useCrop: 'Apply', reviewTitle: 'Send receipt',
      paidHow: 'How was it paid?', payBank: 'Card / bank transfer', payCash: 'Cash', note: 'Note (optional)', back: 'Back',
      send: 'Send to Kontora', e2e: '🔒 Encrypted on this phone. Only your computer can open the receipt.',
      pairedTo: 'Paired with', pairedNow: 'Paired! You can now photograph receipts.',
      pages: (n) => (n === 1 ? '1 page' : `${n} pages`), page: 'Page',
      processing: 'Preparing receipt…', encrypting: 'Encrypting…',
      queued: 'Saved – sending.', sentOk: 'Sent! Kontora picks up the receipt as soon as your computer is running.',
      stWait: 'Waiting for internet', stSent: 'Sent – computer will pick up', stOk: 'Arrived in Kontora', stErr: 'Error – retrying',
      receipt: 'Receipt', pcSeen: (s) => `Computer last reachable: ${s}`, pcNever: 'Your computer hasn’t picked up any receipts yet. Open Kontora on your computer and it happens automatically.',
      unpairConfirm: 'Really unpair this phone? Receipts not yet picked up will be deleted.',
      unpaired: 'Phone unpaired.', revoked: 'The pairing was removed on the computer. Please pair again.',
      tooBig: 'The file is too large (max. 10 MB).', notImage: 'This file can’t be read.',
      installIos: 'Tip: tap “Share” and then “Add to Home Screen” – Kontora Scan then starts like an app.',
      installBtn: 'Install as app', batchSent: (n) => `${n} receipts saved – sending.`,
      menuInfo: (name) => `Paired with ${name}. Photos are transferred encrypted and deleted from the server after pickup.`,
      justNow: 'just now', minutesAgo: (n) => `${n} min ago`, hoursAgo: (n) => `${n} h ago`,
    },
  };
  let lang = 'de';
  const t = (k, ...a) => {
    const v = (T[lang] && T[lang][k]) ?? T.de[k];
    return typeof v === 'function' ? v(...a) : v;
  };
  function applyTexts() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  }

  // ── Kleine Helfer ───────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const enc = new TextEncoder();
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const b64uDecode = (s) => {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let toastTimer = 0;
  function toast(msg, err = false) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast' + (err ? ' err' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, err ? 5000 : 3200);
  }
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    window.scrollTo(0, 0);
  }
  function busy(text) { $('busy-text').textContent = text; show('s-busy'); }

  // ── Kopplung ────────────────────────────────────────────────────────────
  let pairing = null; // { id, secret (b64u), name, lang }
  let keys = null; // { token, aes }

  function readPairingFromHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return null;
    const p = new URLSearchParams(h);
    const v = p.get('p') || '';
    const m = /^([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/.exec(v);
    if (!m) return null;
    return { id: m[1], secret: m[2], name: (p.get('n') || 'Kontora').slice(0, 80), lang: p.get('l') === 'en' ? 'en' : 'de' };
  }
  function loadPairing() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
  }
  function savePairing(p) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* privat-Modus */ }
  }
  async function deriveKeys(p) {
    const raw = b64uDecode(p.secret);
    const hk = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const auth = await crypto.subtle.sign('HMAC', hk, enc.encode('kontora-scan-auth'));
    const encRaw = await crypto.subtle.sign('HMAC', hk, enc.encode('kontora-scan-enc'));
    const aes = await crypto.subtle.importKey('raw', encRaw, 'AES-GCM', false, ['encrypt']);
    return { token: hex(auth), aes };
  }
  function relayHeaders(extra = {}) {
    return { 'x-kopplung': pairing.id, 'x-token': keys.token, ...extra };
  }
  async function relayJson(action, body = {}) {
    const r = await fetch(RELAY, { method: 'POST', headers: relayHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ action, ...body }) });
    if (r.status === 410 || r.status === 401) { await handleRevoked(); throw new Error('revoked'); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function handleRevoked() {
    try { localStorage.removeItem(STORE_KEY); } catch { /* egal */ }
    pairing = null; keys = null;
    await dbClear();
    toast(t('revoked'), true);
    renderUnpaired();
  }

  // ── Warteschlange (IndexedDB) ───────────────────────────────────────────
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('kontora-scan', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'localId' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const x = d.transaction('items', mode);
      const st = x.objectStore('items');
      let out;
      Promise.resolve(fn(st)).then((v) => { out = v; });
      x.oncomplete = () => res(out);
      x.onerror = () => rej(x.error);
    });
  }
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const dbAll = () => tx('readonly', (st) => req(st.getAll()));
  const dbPut = (item) => tx('readwrite', (st) => { st.put(item); });
  const dbDel = (id) => tx('readwrite', (st) => { st.delete(id); });
  const dbClear = () => tx('readwrite', (st) => { st.clear(); }).catch(() => {});

  // ── Bild laden ──────────────────────────────────────────────────────────
  async function loadToCanvas(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bmp = await new Promise((res, rej) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); res(img); };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
        img.src = url;
      });
    }
    const w = bmp.width, h = bmp.height;
    const s = Math.min(1, MAX_SRC / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return c;
  }
  function rotateCanvas(c) {
    const r = document.createElement('canvas');
    r.width = c.height; r.height = c.width;
    const x = r.getContext('2d');
    x.translate(r.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0);
    return r;
  }

  // ── Kantenerkennung ─────────────────────────────────────────────────────
  // Papier ist fast immer heller als der Untergrund: Otsu-Schwelle auf einer
  // verkleinerten Graustufen-Kopie, größte helle Fläche suchen, deren vier
  // äußerste Ecken bilden das Viereck. Klappt es nicht, ganzes Bild.
  function fullQuad(c, inset = 0) {
    const ix = c.width * inset, iy = c.height * inset;
    return [{ x: ix, y: iy }, { x: c.width - ix, y: iy }, { x: c.width - ix, y: c.height - iy }, { x: ix, y: c.height - iy }];
  }
  function detectQuad(c) {
    const s = 360 / Math.max(c.width, c.height);
    const w = Math.max(8, Math.round(c.width * s)), h = Math.max(8, Math.round(c.height * s));
    const sc = document.createElement('canvas'); sc.width = w; sc.height = h;
    const sx = sc.getContext('2d', { willReadFrequently: true });
    sx.drawImage(c, 0, 0, w, h);
    const d = sx.getImageData(0, 0, w, h).data;
    const n = w * h;
    const g = new Uint8Array(n);
    const hist = new Uint32Array(256);
    // leichte Glättung (3x3-Box) gegen Rauschen und Schrift
    const raw = new Uint8Array(n);
    for (let i = 0; i < n; i++) raw[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { sum += raw[yy * w + xx]; cnt++; }
      }
      const v = (sum / cnt) | 0; g[y * w + x] = v; hist[v]++;
    }
    // Otsu
    let total = 0; for (let i = 0; i < 256; i++) total += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = n - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (total - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i; }
    }
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) mask[i] = g[i] > thr ? 1 : 0;
    // größte zusammenhängende helle Fläche
    const label = new Int32Array(n);
    const stack = new Int32Array(n);
    let bestLabel = 0, bestSize = 0, cur = 0;
    for (let i = 0; i < n; i++) {
      if (!mask[i] || label[i]) continue;
      cur++; let sp = 0, size = 0; stack[sp++] = i; label[i] = cur;
      while (sp) {
        const p = stack[--sp]; size++;
        const x = p % w, y = (p / w) | 0;
        if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = cur; stack[sp++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = cur; stack[sp++] = p + 1; }
        if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = cur; stack[sp++] = p - w; }
        if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = cur; stack[sp++] = p + w; }
      }
      if (size > bestSize) { bestSize = size; bestLabel = cur; }
    }
    if (bestSize < n * 0.06) return fullQuad(c, 0.02);
    let tl = null, tr = null, br = null, bl = null;
    let mTL = Infinity, mTR = -Infinity, mBR = -Infinity, mBL = Infinity;
    let touch = 0;
    for (let i = 0; i < n; i++) {
      if (label[i] !== bestLabel) continue;
      const x = i % w, y = (i / w) | 0;
      const a = x + y, b = x - y;
      if (a < mTL) { mTL = a; tl = { x, y }; }
      if (a > mBR) { mBR = a; br = { x, y }; }
      if (b > mTR) { mTR = b; tr = { x, y }; }
      if (b < mBL) { mBL = b; bl = { x, y }; }
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touch++;
    }
    const q = [tl, tr, br, bl].map((p) => ({ x: (p.x + 0.5) / s, y: (p.y + 0.5) / s }));
    const area = Math.abs(polyArea(q));
    const full = c.width * c.height;
    // Fläche berührt den Rand großflächig → vermutlich Hintergrund statt Beleg
    if (touch > (w + h) * 1.2 || area > full * 0.97 || area < full * 0.06) return fullQuad(c, 0.02);
    return q;
  }
  function polyArea(q) {
    let a = 0;
    for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; a += p.x * r.y - r.x * p.y; }
    return a / 2;
  }

  // ── Entzerren (Perspektive) ─────────────────────────────────────────────
  function solve8(A, b) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      let mx = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r;
      [A[i], A[mx]] = [A[mx], A[i]]; [b[i], b[mx]] = [b[mx], b[i]];
      const p = A[i][i] || 1e-12;
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / p;
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / (A[i][i] || 1e-12);
    }
    return x;
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function warp(src, q) {
    let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
    let H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    const s = Math.min(1, MAX_OUT / Math.max(W, H));
    W = Math.max(16, Math.round(W * s)); H = Math.max(16, Math.round(H * s));
    const dst = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const u = dst[i].x, v = dst[i].y, x = q[i].x, y = q[i].y;
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
    }
    const hm = solve8(A, b);
    const sw = src.width, sh = src.height;
    const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const ox = out.getContext('2d');
    const od = ox.createImageData(W, H);
    const o = od.data;
    for (let v = 0; v < H; v++) {
      for (let u = 0; u < W; u++) {
        const den = hm[6] * u + hm[7] * v + 1;
        let x = (hm[0] * u + hm[1] * v + hm[2]) / den;
        let y = (hm[3] * u + hm[4] * v + hm[5]) / den;
        if (x < 0) x = 0; if (y < 0) y = 0;
        if (x > sw - 1.001) x = sw - 1.001; if (y > sh - 1.001) y = sh - 1.001;
        const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        const oi = (v * W + u) * 4;
        for (let k = 0; k < 3; k++) {
          const top = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx;
          const bot = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
          o[oi + k] = top + (bot - top) * fy;
        }
        o[oi + 3] = 255;
      }
    }
    ox.putImageData(od, 0, 0);
    return out;
  }

  // ── Dokument-Filter: Schatten raus, Papier weiß, Schrift kräftig ────────
  function enhance(c) {
    const W = c.width, H = c.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    const id = x.getImageData(0, 0, W, H);
    const d = id.data;
    const n = W * H;
    const g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
    const B = Math.max(16, Math.round(Math.max(W, H) / 60));
    const bw = Math.ceil(W / B), bh = Math.ceil(H / B);
    const mean = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let s = 0, cnt = 0;
      for (let y = by * B; y < Math.min(H, (by + 1) * B); y += 2) for (let xx = bx * B; xx < Math.min(W, (bx + 1) * B); xx += 2) { s += g[y * W + xx]; cnt++; }
      mean[by * bw + bx] = cnt ? s / cnt : 255;
    }
    // Hintergrund = hellster Nachbarblock (Schrift dunkelt einzelne Blöcke ab)
    const bg = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = bx + dx, yy = by + dy;
        if (xx >= 0 && yy >= 0 && xx < bw && yy < bh) m = Math.max(m, mean[yy * bw + xx]);
      }
      bg[by * bw + bx] = Math.max(m, 40);
    }
    for (let y = 0; y < H; y++) {
      const fy = Math.min(bh - 1.001, Math.max(0, y / B - 0.5));
      const y0 = fy | 0, ty = fy - y0;
      for (let xx = 0; xx < W; xx++) {
        const fx = Math.min(bw - 1.001, Math.max(0, xx / B - 0.5));
        const x0 = fx | 0, tx = fx - x0;
        const a = bg[y0 * bw + x0], b2 = bg[y0 * bw + Math.min(bw - 1, x0 + 1)];
        const c2 = bg[Math.min(bh - 1, y0 + 1) * bw + x0], e = bg[Math.min(bh - 1, y0 + 1) * bw + Math.min(bw - 1, x0 + 1)];
        const back = (a + (b2 - a) * tx) * (1 - ty) + (c2 + (e - c2) * tx) * ty;
        const i = y * W + xx;
        let v = g[i] / back; // 1 = Papier
        v = (v - 0.3) / 0.62; // Kontrast
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        v = Math.pow(v, 1.4) * 255;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      }
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  const toBlob = (c, q = 0.82) => new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', q));
  function thumbOf(c, h = 240) {
    const s = h / c.height;
    const tc = document.createElement('canvas');
    tc.width = Math.max(1, Math.round(c.width * s)); tc.height = h;
    tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
    return tc.toDataURL('image/jpeg', 0.7);
  }

  // ── Zuschneide-Ansicht ──────────────────────────────────────────────────
  const crop = { src: null, quad: null, mode: 'doc', resolve: null, view: null, drag: -1 };

  function cropLayout() {
    const stage = $('stage');
    const cw = stage.clientWidth, ch = stage.clientHeight;
    const k = Math.min(cw / crop.src.width, ch / crop.src.height);
    const iw = crop.src.width * k, ih = crop.src.height * k;
    crop.view = { k, ox: (cw - iw) / 2, oy: (ch - ih) / 2, cw, ch };
    const cv = $('crop-canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, cw, ch);
    x.drawImage(crop.src, crop.view.ox, crop.view.oy, iw, ih);
    drawOverlay();
  }
  function toView(p) { const v = crop.view; return { x: v.ox + p.x * v.k, y: v.oy + p.y * v.k }; }
  function toSrc(p) {
    const v = crop.view;
    return {
      x: Math.min(crop.src.width, Math.max(0, (p.x - v.ox) / v.k)),
      y: Math.min(crop.src.height, Math.max(0, (p.y - v.oy) / v.k)),
    };
  }
  function drawOverlay() {
    const svg = $('crop-svg');
    const v = crop.view;
    svg.setAttribute('viewBox', `0 0 ${v.cw} ${v.ch}`);
    const pts = crop.quad.map(toView);
    const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const shade = `M0 0H${v.cw}V${v.ch}H0Z M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')}Z`;
    svg.innerHTML =
      `<path class="shade" d="${shade}"/><polygon class="edge" points="${poly}"/>` +
      pts.map((p) => `<circle class="handle" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="15"/>`).join('');
  }
  function stagePoint(e) {
    const r = $('stage').getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function initCropEvents() {
    const stage = $('stage');
    stage.addEventListener('pointerdown', (e) => {
      if (!crop.src) return;
      const p = stagePoint(e);
      let best = -1, bd = 48;
      crop.quad.map(toView).forEach((q, i) => { const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = i; } });
      if (best < 0) return;
      crop.drag = best;
      stage.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (crop.drag < 0) return;
      crop.quad[crop.drag] = toSrc(stagePoint(e));
      drawOverlay();
    });
    const end = () => { crop.drag = -1; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    window.addEventListener('resize', () => { if (crop.src && !$('s-crop').hidden) cropLayout(); });
    $('rot-btn').addEventListener('click', () => {
      const oldH = crop.src.height;
      crop.src = rotateCanvas(crop.src);
      crop.quad = crop.quad.map((p) => ({ x: oldH - p.y, y: p.x }));
      // Reihenfolge TL,TR,BR,BL beibehalten
      crop.quad = [crop.quad[3], crop.quad[0], crop.quad[1], crop.quad[2]];
      cropLayout();
    });
    $('full-btn').addEventListener('click', () => { crop.quad = fullQuad(crop.src); drawOverlay(); });
    $('mode-btn').addEventListener('click', () => {
      crop.mode = crop.mode === 'doc' ? 'color' : 'doc';
      $('mode-label').textContent = t(crop.mode === 'doc' ? 'modeDoc' : 'modeColor');
    });
    $('crop-cancel').addEventListener('click', () => finishCrop(null));
    $('crop-ok').addEventListener('click', () => finishCrop(crop.quad));
  }
  function finishCrop(q) {
    const r = crop.resolve; crop.resolve = null;
    if (r) r(q ? { quad: q, src: crop.src, mode: crop.mode } : null);
  }
  function openCrop(src) {
    crop.src = src; crop.quad = detectQuad(src);
    $('mode-label').textContent = t(crop.mode === 'doc' ? 'modeDoc' : 'modeColor');
    show('s-crop');
    requestAnimationFrame(cropLayout);
    return new Promise((res) => { crop.resolve = res; });
  }
  async function renderPage(src, quad, mode) {
    await sleep(30); // Spinner anzeigen lassen
    let out = warp(src, quad);
    if (mode === 'doc') out = enhance(out);
    const blob = await toBlob(out, mode === 'doc' ? 0.8 : 0.85);
    return { kind: 'image', blob, type: 'image/jpeg', thumb: thumbOf(out) };
  }

  // ── Aktueller Beleg (Entwurf) ───────────────────────────────────────────
  let draft = []; // [{kind, blob, type, thumb, name}]

  function renderDraft() {
    const has = draft.length > 0;
    $('draft').hidden = !has;
    $('draft-count').textContent = t('pages', draft.length);
    for (const box of [$('draft-thumbs'), $('review-thumbs')]) {
      box.innerHTML = '';
      draft.forEach((p, i) => {
        const d = document.createElement('div'); d.className = 'thumb';
        if (p.thumb) { const img = document.createElement('img'); img.src = p.thumb; img.alt = `${t('page')} ${i + 1}`; d.appendChild(img); }
        else { const pd = document.createElement('div'); pd.className = 'pdf-thumb'; pd.textContent = 'PDF'; d.appendChild(pd); }
        const pg = document.createElement('span'); pg.className = 'pg'; pg.textContent = String(i + 1); d.appendChild(pg);
        const del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '×';
        del.setAttribute('aria-label', `${t('page')} ${i + 1} ×`);
        del.addEventListener('click', () => { draft.splice(i, 1); renderDraft(); if (!draft.length && !$('s-review').hidden) show('s-home'); });
        d.appendChild(del);
        box.appendChild(d);
      });
    }
  }

  async function addImageFile(file, { manual = true } = {}) {
    busy(t('processing'));
    let src;
    try { src = await loadToCanvas(file); } catch { toast(t('notImage'), true); return null; }
    let res;
    if (manual) {
      res = await openCrop(src);
      if (!res) return null;
    } else {
      res = { src, quad: detectQuad(src), mode: 'doc' };
    }
    busy(t('processing'));
    return renderPage(res.src, res.quad, res.mode);
  }

  async function onCamera(input) {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    const page = await addImageFile(f);
    if (page) draft.push(page);
    renderDraft();
    show(draft.length ? 's-review' : 's-home');
  }

  async function onPick(input) {
    const files = [...(input.files || [])];
    input.value = '';
    if (!files.length) return;
    for (const f of files) if (f.size > 10 * 1024 * 1024) { toast(t('tooBig'), true); return; }
    if (files.length === 1) {
      const f = files[0];
      if (f.type === 'application/pdf') draft.push({ kind: 'pdf', blob: f, type: 'application/pdf', thumb: null, name: f.name });
      else { const page = await addImageFile(f); if (page) draft.push(page); }
      renderDraft();
      show(draft.length ? 's-review' : 's-home');
      return;
    }
    // Mehrere Dateien: jede wird ein eigener Beleg, automatisch zugeschnitten.
    let n = 0;
    for (const f of files) {
      let page;
      if (f.type === 'application/pdf') page = { kind: 'pdf', blob: f, type: 'application/pdf', thumb: null, name: f.name };
      else page = await addImageFile(f, { manual: false });
      if (!page) continue;
      await enqueue([page], payMethod(), '');
      n++;
    }
    show('s-home');
    await renderHistory();
    if (n) toast(t('batchSent', n));
    processQueue();
  }

  function payMethod() {
    const el = document.querySelector('input[name=pay]:checked');
    return el ? el.value : 'BANK';
  }

  // ── Verschlüsseln + in Warteschlange ────────────────────────────────────
  async function buildPayload(pages, paymentMethod, note) {
    const bufs = await Promise.all(pages.map((p) => p.blob.arrayBuffer()));
    const header = {
      v: 1, paymentMethod, note: note || '', capturedAt: new Date().toISOString(),
      files: pages.map((p, i) => ({ type: p.type, size: bufs[i].byteLength, name: p.name || `seite-${i + 1}.${p.type === 'application/pdf' ? 'pdf' : 'jpg'}` })),
    };
    const hb = enc.encode(JSON.stringify(header));
    const total = 4 + 4 + hb.length + bufs.reduce((s, b) => s + b.byteLength, 0);
    const plain = new Uint8Array(total);
    plain.set(enc.encode('KSC1'), 0);
    new DataView(plain.buffer).setUint32(4, hb.length);
    plain.set(hb, 8);
    let off = 8 + hb.length;
    for (const b of bufs) { plain.set(new Uint8Array(b), off); off += b.byteLength; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(pairing.id) }, keys.aes, plain);
    const body = new Uint8Array(12 + ct.byteLength);
    body.set(iv, 0); body.set(new Uint8Array(ct), 12);
    return body.buffer;
  }

  async function enqueue(pages, paymentMethod, note) {
    const body = await buildPayload(pages, paymentMethod, note);
    const item = {
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(), body, thumb: pages[0].thumb || null, pages: pages.length,
      status: 'wait', remoteId: null, note: note || '',
    };
    await dbPut(item);
    return item;
  }

  async function sendDraft() {
    if (!draft.length) return;
    $('send-btn').disabled = true;
    busy(t('encrypting'));
    try {
      await enqueue(draft, payMethod(), $('note').value.trim());
      try { localStorage.setItem('kontoraScan.pay', payMethod()); } catch { /* egal */ }
      draft = []; $('note').value = '';
      renderDraft();
      show('s-home');
      await renderHistory();
      toast(navigator.onLine ? t('queued') : t('stWait'));
      processQueue();
    } finally {
      $('send-btn').disabled = false;
    }
  }

  let processing = false;
  async function processQueue() {
    if (processing || !pairing || !keys) return;
    processing = true;
    try {
      const items = (await dbAll()).sort((a, b) => a.createdAt - b.createdAt);
      for (const it of items) {
        if ((it.status !== 'wait' && it.status !== 'err') || !it.body) continue;
        if (!navigator.onLine) break;
        try {
          const r = await fetch(`${RELAY}?action=upload`, { method: 'POST', headers: relayHeaders({ 'content-type': 'application/octet-stream' }), body: it.body });
          if (r.status === 410 || r.status === 401) { await handleRevoked(); return; }
          const j = await r.json().catch(() => ({}));
          if (!r.ok) { it.status = 'err'; it.error = j.error || `HTTP ${r.status}`; await dbPut(it); if (r.status === 429) toast(j.error || 'Limit', true); continue; }
          it.status = 'sent'; it.remoteId = j.id; it.body = null; it.error = null;
          await dbPut(it);
          toast(t('sentOk'));
        } catch {
          it.status = 'wait'; await dbPut(it); break;
        }
      }
      await checkArrived();
    } finally {
      processing = false;
      renderHistory();
    }
  }

  let lastPcSeen = null;
  async function checkArrived() {
    const items = await dbAll();
    const sent = items.filter((i) => i.status === 'sent' && i.remoteId);
    try {
      const j = await relayJson('status', { ids: sent.map((i) => i.remoteId) });
      lastPcSeen = j.pc_zuletzt || null;
      const pending = new Set(j.pending || []);
      for (const it of sent) if (!pending.has(it.remoteId)) { it.status = 'ok'; await dbPut(it); }
    } catch { /* offline */ }
    // Verlauf begrenzen
    const all = (await dbAll()).sort((a, b) => b.createdAt - a.createdAt);
    for (const old of all.slice(40)) if (old.status === 'ok') await dbDel(old.localId);
  }

  function ago(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.round(ms / 60000);
    if (m < 2) return t('justNow');
    if (m < 90) return t('minutesAgo', m);
    const h = Math.round(m / 60);
    if (h < 36) return t('hoursAgo', h);
    return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  async function renderHistory() {
    const items = (await dbAll().catch(() => [])).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
    const ul = $('history');
    ul.innerHTML = '';
    $('history-empty').hidden = items.length > 0;
    for (const it of items) {
      const li = document.createElement('li');
      if (it.thumb) { const img = document.createElement('img'); img.src = it.thumb; img.alt = ''; li.appendChild(img); }
      const meta = document.createElement('div'); meta.className = 'meta';
      const a = document.createElement('div'); a.textContent = it.note || `${t('receipt')} · ${t('pages', it.pages)}`;
      const b = document.createElement('div'); b.className = 'muted tiny'; b.textContent = new Date(it.createdAt).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      meta.append(a, b); li.appendChild(meta);
      const badge = document.createElement('span');
      const st = { wait: ['wait', 'stWait'], sent: ['sent', 'stSent'], ok: ['ok', 'stOk'], err: ['err', 'stErr'] }[it.status] || ['wait', 'stWait'];
      badge.className = `badge ${st[0]}`; badge.textContent = t(st[1]);
      li.appendChild(badge);
      ul.appendChild(li);
    }
    const waitingForPc = items.some((i) => i.status === 'sent');
    $('pc-seen').textContent = lastPcSeen ? t('pcSeen', ago(lastPcSeen)) : waitingForPc ? t('pcNever') : '';
  }

  // ── Installation ────────────────────────────────────────────────────────
  let installEvt = null;
  function renderInstallHint() {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const hint = $('install-hint');
    if (standalone) { hint.hidden = true; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (installEvt) {
      hint.innerHTML = '';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'primary small'; b.textContent = t('installBtn');
      b.addEventListener('click', async () => { installEvt.prompt(); installEvt = null; hint.hidden = true; });
      hint.appendChild(b); hint.hidden = false;
    } else if (ios) { hint.textContent = t('installIos'); hint.hidden = false; }
  }

  // ── Ansichten ───────────────────────────────────────────────────────────
  function renderUnpaired() {
    $('menu-btn').hidden = true;
    show('s-unpaired');
  }
  async function renderHome() {
    $('menu-btn').hidden = false;
    $('paired-label').innerHTML = '';
    const s = document.createElement('span'); s.textContent = `${t('pairedTo')} `;
    const b = document.createElement('b'); b.textContent = pairing.name;
    $('paired-label').append(s, b);
    $('menu-info').textContent = t('menuInfo', pairing.name);
    renderDraft();
    show('s-home');
    renderInstallHint();
    await renderHistory();
  }

  async function init() {
    applyTexts();
    initCropEvents();
    const fromHash = readPairingFromHash();
    const stored = loadPairing();
    pairing = fromHash || stored;
    if (pairing) lang = pairing.lang || 'de';
    applyTexts();
    if (!pairing || !crypto.subtle) { renderUnpaired(); return; }
    if (fromHash && (!stored || stored.id !== fromHash.id)) {
      if (stored) await dbClear();
      savePairing(fromHash);
      setTimeout(() => toast(t('pairedNow')), 300);
    }
    // Adresse mit Kopplung behalten (iOS übernimmt sie beim „Zum Home-Bildschirm“).
    const want = `#p=${pairing.id}.${pairing.secret}&n=${encodeURIComponent(pairing.name)}&l=${pairing.lang || 'de'}`;
    if (location.hash !== want) history.replaceState(null, '', location.pathname + want);
    keys = await deriveKeys(pairing);
    try { const pm = localStorage.getItem('kontoraScan.pay'); if (pm) { const r = document.querySelector(`input[name=pay][value="${pm}"]`); if (r) r.checked = true; } } catch { /* egal */ }
    await renderHome();
    processQueue();
  }

  // ── Ereignisse ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('cam').addEventListener('change', (e) => onCamera(e.target));
    $('cam2').addEventListener('change', (e) => onCamera(e.target));
    $('pick').addEventListener('change', (e) => onPick(e.target));
    $('to-review').addEventListener('click', () => { renderDraft(); show('s-review'); });
    $('review-back').addEventListener('click', () => { renderDraft(); show('s-home'); });
    $('send-btn').addEventListener('click', sendDraft);
    const menuBtn = $('menu-btn');
    menuBtn.addEventListener('click', () => {
      const open = $('menu').hidden;
      $('menu').hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!$('menu').hidden && !$('menu').contains(e.target) && !menuBtn.contains(e.target)) { $('menu').hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
    });
    $('unpair-btn').addEventListener('click', async () => {
      if (!confirm(t('unpairConfirm'))) return;
      $('menu').hidden = true;
      try { await relayJson('revoke'); } catch { /* trotzdem lokal trennen */ }
      try { localStorage.removeItem(STORE_KEY); } catch { /* egal */ }
      await dbClear();
      pairing = null; keys = null;
      history.replaceState(null, '', location.pathname);
      toast(t('unpaired'));
      renderUnpaired();
    });
    window.addEventListener('online', processQueue);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') processQueue(); });
    setInterval(() => { if (document.visibilityState === 'visible') processQueue(); }, 20000);
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (pairing) renderInstallHint(); });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    init().catch((e) => { console.error(e); renderUnpaired(); });
  });

  // Für Tests im Browser (keine Geheimnisse): Bildverarbeitung prüfbar machen.
  window.__kontoraScanTest = { detectQuad, warp, enhance, loadToCanvas };
})();
