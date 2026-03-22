/**
 * Service Worker — Cache-first strategy
 * Caches app shell and CDN assets on install.
 * After first visit, app works fully offline.
 */

const CACHE_NAME = 'attendance-app-v13';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/router.js',
  '/js/state/store.js',
  '/js/db/database.js',
  '/js/db/groups.js',
  '/js/db/students.js',
  '/js/db/attendance.js',
  '/js/db/contracts.js',
  '/js/db/closedDays.js',
  '/js/services/premium.js',
  '/js/services/ads.js',
  '/js/services/stats.js',
  '/js/services/export.js',
  '/js/services/holidays.js',
  '/js/components/modal.js',
  '/js/components/toast.js',
  '/js/components/sidebar.js',
  '/js/components/bottom-nav.js',
  '/js/pages/dashboard.js',
  '/js/pages/groups.js',
  '/js/pages/group-detail.js',
  '/js/pages/attendance.js',
  '/js/pages/calendar.js',
  '/js/pages/statistics.js',
  '/js/pages/settings.js',
  '/js/pages/premium.js',
  '/js/pages/export.js',
  '/js/pages/group-picker.js',
  '/js/pages/calendar-all.js',
  '/js/utils/date.js',
  '/js/utils/dom.js',
  '/js/utils/i18n.js',
  '/js/utils/holidays.js',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/ko.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
];

// Install: cache all app shell files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache shell assets (critical)
      await cache.addAll(SHELL_ASSETS).catch(err => {
        console.warn('[SW] Some shell assets failed to cache:', err);
      });

      // Cache CDN assets (best-effort, don't fail install if CDN is down)
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => res.ok ? cache.put(url, res) : null)
            .catch(() => null)
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app assets, network-first for nothing
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful responses for app assets
        if (response.ok) {
          const url = event.request.url;
          const isAppAsset = SHELL_ASSETS.some(a => url.endsWith(a)) || CDN_ASSETS.includes(url);
          if (isAppAsset) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
        }
        return response;
      }).catch(() => {
        // Return offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
