const VERSION = 'sumus-voca-v13-pwa-2';
const STATIC_CACHE = `${VERSION}-static`;
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/signup-ui.js',
  '/teacher-enhancements.js',
  '/exam-ops.js',
  '/dashboard-ops.js',
  '/student-enhancements.js',
  '/practice-enhancements.js',
  '/pwa.js',
  '/icon.svg',
  '/manifest.webmanifest',
  '/modules/ui.js',
  '/modules/core.js',
  '/modules/character.js',
  '/modules/student.js',
  '/modules/teacher.js',
  '/modules/sessions.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('sumus-voca-') && name !== STATIC_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated API data, exam drafts, scores, or student records.
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put('/index.html', fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(async response => {
      if (response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, response.clone());
      }
      return response;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
