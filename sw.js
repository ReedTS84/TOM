/* TOM — Gentleman's Assistant | Service Worker */
'use strict';

const CACHE = 'tom-v11.2';

// Core assets — the app cannot function without these
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// Optional assets — cached if available, but won't break install if missing
const OPTIONAL_ASSETS = [
  './icon-192.png',
  './icon-512.png',
];

/* Install — cache core assets, attempt optional ones gracefully */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Core assets must succeed
      await cache.addAll(CORE_ASSETS);

      // Optional assets — fail silently if missing
      await Promise.allSettled(
        OPTIONAL_ASSETS.map(url =>
          fetch(url).then(res => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {/* icon missing — no problem */})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* Activate — remove old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch strategy */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // /tom-ai — never intercept, always go straight to network
  // (Requires a Cloudflare Function at /functions/tom-ai.js)
  if (url.pathname === '/tom-ai') {
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

  // Skip non-http requests (e.g. chrome extensions)
  if (!e.request.url.startsWith('http')) return;

  // Everything else — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {

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
