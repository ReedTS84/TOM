/* TOM — Gentleman's Assistant | Service Worker */
'use strict';

const CACHE = 'tom-v14';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

const OPTIONAL_ASSETS = [
  './icon-192.png',
  './icon-512.png',
];

/* ── INSTALL ─────────────────────────────────────────────── */

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      await cache.addAll(CORE_ASSETS);
      await Promise.allSettled(
        OPTIONAL_ASSETS.map(url =>
          fetch(url).then(res => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ────────────────────────────────────────────── */

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ───────────────────────────────────────────────── */

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-http requests (e.g. chrome extensions)
  if (!e.request.url.startsWith('http')) return;

  // Never intercept the AI or notification functions
  if (url.pathname === '/tom-ai' || url.pathname === '/notify-subscribe') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Non-GET requests — pass through
  if (e.request.method !== 'GET') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Google Fonts — network first, cache fallback
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Anthropic API — never intercept
  if (url.hostname.includes('anthropic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Everything else — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ── PUSH NOTIFICATIONS ──────────────────────────────────── */

self.addEventListener('push', e => {
  const body = e.data ? e.data.text() : 'Your morning briefing from TOM.';
  e.waitUntil(
    self.registration.showNotification('TOM — Gentleman\'s Assistant', {
      body,
      icon:               './icon-192.png',
      badge:              './icon-192.png',
      tag:                'tom-daily',
      renotify:           false,
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('./');
    })
  );
});
