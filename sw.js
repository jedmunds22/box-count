// Box Count service worker.
// The page itself: network first (so fixes arrive on the next open), cached copy if offline or slow (3 s).
// Library, WebAssembly, icons: cache first (weak signal in storage), refreshed in the background.
const CACHE = 'boxcount-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png',
  './vendor/barcode-detector-3.2.3-ponyfill.js', './vendor/zxing_reader.wasm'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  e.respondWith(caches.open(CACHE).then(async c => {
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (isPage) {
      const timeout = new Promise(res => setTimeout(() => res(null), 3000));
      const fresh = await Promise.race([net, timeout]);
      if (fresh) return fresh;
      return (await c.match(e.request, {ignoreSearch: true})) || (await net) || new Response('Offline', {status: 503});
    }
    const hit = await c.match(e.request, {ignoreSearch: true});
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline', {status: 503});
  }));
});
