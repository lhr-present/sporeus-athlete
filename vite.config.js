import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/sporeus-athlete/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sporeus Athlete Console',
        short_name: 'Sporeus Athlete',
        description: 'Bloomberg Terminal for endurance athletes — zones, tests, training log, periodization',
        theme_color: '#ff6600',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/sporeus-athlete/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,           // new SW activates immediately on deploy
        clientsClaim: true,          // takes control of all open tabs at once
        cleanupOutdatedCaches: true, // removes stale caches from old versions
        // No Google Fonts runtime caching — fonts are now self-hosted
        navigateFallbackDenylist: [/^\/auth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/sporeus\.com\/wp-json\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sporeus-api-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 48 }, // 48h
              networkTimeoutSeconds: 5,
            }
          }
        ]
      }
    })
  ]
})
