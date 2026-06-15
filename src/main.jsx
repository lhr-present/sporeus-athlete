import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initSentry } from './lib/observability/sentry.js'
import { initWebVitals } from './lib/observability/webVitals.js'
import { init as initA11yAnnouncer } from './lib/a11y/announcer.js'
// Self-hosted fonts — latin + latin-ext only (covers EN + TR characters)
// No Google Fonts CDN dependency — fonts served from same origin
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-400-italic.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import '@fontsource/ibm-plex-mono/latin-ext-600.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-sans/latin-ext-400.css'
import '@fontsource/ibm-plex-sans/latin-ext-600.css'

// Check for service-worker updates on load so a new version is *detected*
// early (this drives the "new version available" toast in useAppState).
// We deliberately do NOT auto-activate a waiting SW here: posting
// SKIP_WAITING on every load swaps the SW mid-session before the user
// acknowledges the toast. Activation is now user-controlled — only the
// toast's RELOAD button posts SKIP_WAITING (see useAppState.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      reg.update()
    })
  })
}

// Initialise the a11y live-region announcer once, before React mounts.
// Subsequent calls to announce() can rely on the regions already existing.
initA11yAnnouncer()

createRoot(document.getElementById('root')).render(<App />)

// Load Sentry + Web Vitals after first paint — async, never blocks main bundle.
// Both no-op gracefully if env vars / plausible are absent.
initSentry()
initWebVitals()
