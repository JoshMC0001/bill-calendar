// Bump VERSION whenever you change index.html so devices pick up the new copy.
const VERSION = 'v4';
const SHELL = 'bills-shell-' + VERSION;
const SDK = 'bills-firebase-sdk';
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bills-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page loads: try the network for the latest copy, fall back to the saved one offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Firebase SDK files: saved on first load, then served from the cache.
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(
      caches.open(SDK).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }))
      )
    );
    return;
  }

  // Own files (icons, manifest): cache first.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
  // Everything else, including Firestore's own traffic, goes straight to the network.
});