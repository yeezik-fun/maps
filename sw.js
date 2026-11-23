// Yeezik Maps — service worker: tiene in cache l'interfaccia, i dati (mappe, percorsi) arrivano sempre dalla rete
const CACHE = 'yeezik-maps-v3';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/core.js', 'js/map.js', 'js/routing.js', 'js/nav.js', 'js/ui.js', 'js/main.js', 'js/search-ui.js', 'style.json', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // servizi esterni: sempre rete
  // prima la rete (così gli aggiornamenti arrivano subito), poi la cache se sei offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
