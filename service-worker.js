const CACHE_VERSION = 'refritec-silva-pwa-v10';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './offline.html',
  './qrcode-mobile.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return Promise.all(
        APP_SHELL.map(function(url) {
          return fetch(new Request(url, { cache: 'reload' }))
            .then(function(response) {
              if (response && response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(function() {
              return cache.add(url).catch(function() {});
            });
        })
      );
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(key) { return key !== CACHE_VERSION; })
            .map(function(key) { return caches.delete(key); })
        );
      })
      .then(function() { return self.clients.claim(); })
      .then(function() {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(function(clients) {
        clients.forEach(function(client) {
          try {
            client.postMessage({ type: 'REFRITEC_SW_ACTIVATED', version: CACHE_VERSION });
          } catch (e) {}
        });
      })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.indexOf('/api/') === 0 || url.pathname.endsWith('/version.json')) return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_VERSION).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          const network = fetch(event.request).then(function(response) {
            if (response && (response.ok || response.type === 'opaque')) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(function() { return cached; });
          return cached || network;
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isHtmlOrManifest =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/manifest.webmanifest');

  if (isHtmlOrManifest) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(function(response) {
          if (response && response.ok) {
            const copy1 = response.clone();
            const copy2 = response.clone();
            caches.open(CACHE_VERSION).then(function(cache) {
              if (url.pathname.endsWith('/manifest.webmanifest')) {
                cache.put('./manifest.webmanifest', copy1);
              } else {
                cache.put('./', copy1);
                cache.put('./index.html', copy2);
              }
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request)
            .then(function(res) { return res || caches.match('./index.html'); })
            .then(function(res) { return res || caches.match('./offline.html'); });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      const fetchPromise = fetch(event.request, { cache: 'no-cache' }).then(function(response) {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(function(cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});
