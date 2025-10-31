// service-worker-v12.js
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const CACHE_NAME = 'jusmile-pwa-v12';
const ASSET_VER = '20251101-4';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './styles.css?v=' + ASSET_VER,
  './app.js?v=' + ASSET_VER,
  './manifest.json?v=' + ASSET_VER,
  './404.html',
  './privacy.html',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// 改為「網路優先，失敗再回快取」以免 index 卡住
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request.url, res.clone());
      return res;
    } catch (e) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return caches.match('./index.html'); // 最後備援
    }
  })());
});
