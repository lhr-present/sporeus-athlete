import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**/*.js'],
      exclude: ['src/lib/**/*.test.js'],
    },
  },
  base: '/sporeus-athlete/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/') || id.includes('react/jsx-runtime') || id.includes('react/jsx-dev-runtime')) {
            return 'vendor-react'
          }
          if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/react-smooth/') || id.includes('/node_modules/react-redux/') || id.includes('/node_modules/redux/') || id.includes('/node_modules/use-sync-external-store/') || id.includes('/node_modules/victory-vendor/') || id.includes('/node_modules/decimal.js-light/') || id.includes('/node_modules/eventemitter3/') || id.includes('/node_modules/reselect/') || id.includes('/node_modules/@reduxjs/toolkit/') || id.includes('/node_modules/immer/')) {
            return 'vendor-recharts'
          }
          if (id.includes('/node_modules/@supabase/') || id.includes('/node_modules/supabase')) {
            return 'vendor-supabase'
          }
          if (id.includes('/node_modules/fit-file-parser')) {
            return 'vendor-fit'
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',   // Phase 3.4: custom SW for push notification handling
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sporeus Athlete Console',
        short_name: 'Sporeus',
        description: 'Bloomberg Terminal for endurance athletes — zones, tests, training log, periodization',
        theme_color: '#ff6600',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/sporeus-athlete/',
        icons: [
          { src: 'icons/icon-48x48.png',        sizes: '48x48',   type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-72x72.png',         sizes: '72x72',   type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-96x96.png',         sizes: '96x96',   type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-128x128.png',       sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-144x144.png',       sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-152x152.png',       sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192x192.png',       sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-256x256.png',       sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-384x384.png',       sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512x512.png',       sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png',  sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png',  sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      }
    })
  ]
})
