// Service worker « réseau d'abord » : la page reste rechargeable sans réseau
// (plantage du navigateur pendant une coupure). Les données passent par Firestore,
// qui gère lui-même la file d'attente hors ligne.
const CACHE = 'temps-reaction-v1';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const gere = e.request.method === 'GET'
    && (url.origin === self.location.origin || url.href.startsWith('https://www.gstatic.com/firebasejs/'));
  if (!gere) return;
  e.respondWith((async () => {
    try {
      const rep = await fetch(e.request);
      if (rep.ok) { const c = await caches.open(CACHE); c.put(e.request, rep.clone()); }
      return rep;
    } catch {
      const enCache = await caches.match(e.request, { ignoreSearch: true });
      if (enCache) return enCache;
      throw new Error('Hors ligne et absent du cache : ' + url.pathname);
    }
  })());
});
