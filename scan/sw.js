// Kontora Scan – App-Hülle offline verfügbar machen (Belege selbst liegen in IndexedDB).
const CACHE = 'kontora-scan-v1';
const SHELL = ['./', 'index.html', 'app.css?v=1', 'app.js?v=1', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  '../fonts/schibsted-grotesk-latin-400-normal.woff2', '../fonts/schibsted-grotesk-latin-700-normal.woff2', '../fonts/schibsted-grotesk-latin-800-normal.woff2'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Übertragung an den Server nie aus dem Cache
  if (req.mode === 'navigate') {
    // Netz zuerst (neue Version), offline die gespeicherte Seite
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
