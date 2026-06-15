// ─── InstallPrompt.jsx — PWA install banner ──────────────────────────────────
// v9.333.0 — Mobile install nudge improvements:
//   - Bilingual (EN/TR) copy (matched rest of app convention)
//   - Visual share-icon glyph for iOS so users can find the share button
//   - Soft re-prompt: dismiss snoozes for 7 days instead of forever
//
// Pre-v9.333 the dismiss key was a boolean — once a user clicked "Not now",
// the prompt never returned. That mirrored the wizard "Skip all →" trap
// (see v9.328): a single mis-click could silently kill a recurring nudge.
import { useState, useEffect, useRef, useContext } from 'react'
import { logger } from '../lib/logger.js'
import { emitEvent } from '../lib/attribution.js'
import { LangCtx } from '../contexts/LangCtx.jsx'

const MONO = "'IBM Plex Mono', monospace"
const DISMISS_AT_KEY = 'sporeus-install-dismissed-at'    // v9.333: timestamp, not boolean
const LEGACY_KEY     = 'sporeus-install-dismissed'        // pre-v9.333 boolean flag
const SNOOZE_DAYS    = 7

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

// v9.333 — snooze-aware dismiss check. Returns true while within 7d window.
// Handles legacy boolean flag from pre-v9.333: treats as "dismissed now"
// to avoid surprising users who already opted out — they'll see the prompt
// again 7 days after the first session under v9.333.
function isWithinSnoozeWindow() {
  if (localStorage.getItem(LEGACY_KEY) === '1') {
    try {
      localStorage.setItem(DISMISS_AT_KEY, String(Date.now()))
      localStorage.removeItem(LEGACY_KEY)
    } catch (_) {}
    return true
  }
  const raw = localStorage.getItem(DISMISS_AT_KEY)
  if (!raw) return false
  const ts = parseInt(raw, 10)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < SNOOZE_DAYS * 24 * 60 * 60 * 1000
}

export default function InstallPrompt() {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)
  const deferredRef = useRef(null)

  useEffect(() => {
    if (isStandalone()) {
      const key = 'sporeus-install-converted'
      if (!localStorage.getItem(key)) {
        try { localStorage.setItem(key, '1') } catch (_) {}
        emitEvent('pwa_already_installed', {})
      }
      return
    }
    if (isWithinSnoozeWindow()) return

    if (isIOS()) {
      const t = setTimeout(() => {
        setIos(true)
        setShow(true)
        emitEvent('pwa_install_prompt_shown', { platform: 'ios' })
      }, 30000)
      return () => clearTimeout(t)
    }

    const handler = e => {
      e.preventDefault()
      deferredRef.current = e
      setTimeout(() => {
        setShow(true)
        emitEvent('pwa_install_prompt_shown', { platform: 'android' })
      }, 30000)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const onInstalled = () => emitEvent('pwa_install_accepted', { platform: 'android' })
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_AT_KEY, String(Date.now())) } catch (e) { logger.warn('localStorage:', e.message) }
    emitEvent('pwa_install_prompt_dismissed', { platform: ios ? 'ios' : 'android' })
    setShow(false)
  }

  async function install() {
    if (deferredRef.current) {
      deferredRef.current.prompt()
      const { outcome } = await deferredRef.current.userChoice
      if (outcome === 'accepted') {
        emitEvent('pwa_install_accepted', { platform: 'android' })
        deferredRef.current = null
      } else {
        emitEvent('pwa_install_declined', { platform: 'android' })
      }
    }
    dismiss()
  }

  if (!show) return null

  // v9.333 — SVG share icon. iOS doesn't expose the system glyph, so we
  // approximate it (arrow up out of a tray box) — close enough to Safari's
  // bottom-bar share icon that users will recognize the analog.
  const ShareIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', margin: '0 4px' }}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )

  return (
    <div
      role="dialog"
      aria-label={isTR ? 'Sporeus uygulamayı yükle' : 'Install Sporeus app'}
      style={{
        position: 'fixed', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10004, background: '#1a1a1a', border: '1px solid #ff6600',
        borderRadius: '8px', padding: '14px 20px', maxWidth: '380px', width: '90%',
        fontFamily: MONO, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.08em' }}>
            ◈ {isTR ? 'SPOREUS ATHLETE YÜKLE' : 'INSTALL SPOREUS ATHLETE'}
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', lineHeight: 1.6 }}>
            {ios ? (
              <>
                {isTR ? 'Aşağıdaki ' : 'Tap the '}
                <ShareIcon />
                {isTR ? "düğmesine dokun, sonra 'Ana Ekrana Ekle' seç." : "icon below, then 'Add to Home Screen'."}
              </>
            ) : (
              isTR
                ? 'Çevrimdışı erişim ve daha hızlı yükleme için ana ekrana ekle.'
                : 'Add to your home screen for offline access and faster loading.'
            )}
          </div>
        </div>
        <button onClick={dismiss} aria-label={isTR ? 'Kapat' : 'Dismiss'} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
      </div>
      {!ios && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={install}
            style={{ flex: 1, padding: '8px', background: '#ff6600', border: 'none', borderRadius: '4px', color: '#fff', fontFamily: MONO, fontSize: '11px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em' }}>
            {isTR ? 'YÜKLE' : 'INSTALL'}
          </button>
          <button
            onClick={dismiss}
            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #333', borderRadius: '4px', color: '#555', fontFamily: MONO, fontSize: '11px', cursor: 'pointer' }}>
            {isTR ? 'Şimdi değil' : 'Not now'}
          </button>
        </div>
      )}
    </div>
  )
}
