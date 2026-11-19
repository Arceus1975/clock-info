// Minimal service worker for the Phase 0 probe: it only has to register and
// activate, which proves a background context is available on this device.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) { /* pass-through */ });
