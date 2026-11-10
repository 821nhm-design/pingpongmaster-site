/* オフラインでも遊べるようにゲームの画面を保存する */
const CACHE = 'ppm-v1';
const FILES = ['./', './index.html', './gate.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', '../products.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // 新しい版があれば使い、ネットがなければ保存した版を使う
  e.respondWith(fetch(e.request).then(r => { if (r.ok && url.origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request)));
});
