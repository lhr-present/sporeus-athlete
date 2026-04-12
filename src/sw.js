// src/sw.js — Custom service worker for Sporeus Athlete (v5.13.0)
// vite-plugin-pwa injects self.__WB_MANIFEST here at build time.

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

const CACHE_VERSION = 'sporeus-v5.13.0'

// ── Precaching ─────────────────────────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Navigation fallback ────────────────────────────────────────────────────────
// Denylist: OAuth callbacks must hit network to avoid serving cached index.html
const DENYLIST = [/^\/auth/, /\?code=/, /\?error=/, /#access_token=/, /\?state=strava/]
const handler = createHandlerBoundToURL('/sporeus-athlete/index.html')
registerRoute(new NavigationRoute(handler, { denylist: DENYLIST }))

// ── Supabase — network first, 5-min cache, 3s timeout ────────────────────────
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: `sporeus-supabase-${CACHE_VERSION}`,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 }),
    ],
  })
)

// ── Sporeus API — network first, 48h cache ─────────────────────────────────────
registerRoute(
  ({ url }) => url.hostname.includes('sporeus.com') && url.pathname.startsWith('/wp-json/'),
  new NetworkFirst({
    cacheName: 'sporeus-api-v5',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 48 })],
    networkTimeoutSeconds: 5,
  })
)

// ── Lifecycle ──────────────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  // Clean up caches from old cache versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('sporeus-') && !k.includes(CACHE_VERSION) && !k.startsWith('workbox-'))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Push notifications (Phase 3.4) ────────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch {}

  const title   = payload.title   || 'Sporeus Athlete'
  const body    = payload.body    || ''
  const tag     = payload.tag     || 'sporeus'
  const url     = payload.url     || '/sporeus-athlete/'
  const icon    = '/sporeus-athlete/pwa-192x192.png'
  const badge   = '/sporeus-athlete/pwa-192x192.png'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data:    { url },
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/sporeus-athlete/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('sporeus-athlete') && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
