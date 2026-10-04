// Service worker for the web version. Generated into the build by scripts/build-web.mjs.
const CACHE = 'fidelis-__VERSION__';
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('fidelis-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Cache first: the build is versioned as a whole, and a new deploy installs a new cache.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      if (request.mode === 'navigate') {
        // Real pages (e.g. privacy.html) as themselves; app routes get the app.
        return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match('./')) ?? fetch(request);
      }
      return (await cache.match(request, { ignoreSearch: true })) ?? fetch(request);
    }),
  );
});

// Tapping the "pomodoro finished" notification brings the app back.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) =>
      windows.length ? windows[0].focus() : self.clients.openWindow('./'),
    ),
  );
});
