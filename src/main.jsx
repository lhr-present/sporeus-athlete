import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
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

// Force any stale service worker to update immediately.
// Runs before React mounts so old SWs don't intercept the first auth requests.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      reg.update()
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
