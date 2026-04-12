// ─── InstallPrompt.jsx — PWA install banner (v5.11.0) ────────────────────────
import { useState, useEffect, useRef } from 'react'

const MONO = "'IBM Plex Mono', monospace"
const DISMISS_KEY = 'sporeus-install-dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)
  const deferredRef = useRef(null)

  useEffect(() => {
    // Never show if already installed or dismissed
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    if (isIOS()) {
      // iOS: no beforeinstallprompt — show manual instructions after 30s
      const t = setTimeout(() => { setIos(true); setShow(true) }, 30000)
      return () => clearTimeout(t)
    }

    // Chrome/Edge: capture beforeinstallprompt
    const handler = e => {
      e.preventDefault()
      deferredRef.current = e
      // Show after 30s delay
      setTimeout(() => setShow(true), 30000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setShow(false)
  }

  async function install() {
    if (deferredRef.current) {
      deferredRef.current.prompt()
      const { outcome } = await deferredRef.current.userChoice
      if (outcome === 'accepted') deferredRef.current = null
    }
    dismiss()
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 10004, background: '#1a1a1a', border: '1px solid #ff6600',
      borderRadius: '8px', padding: '14px 20px', maxWidth: '380px', width: '90%',
      fontFamily: MONO, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.08em' }}>
            ◈ INSTALL SPOREUS ATHLETE
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', lineHeight: 1.5 }}>
            {ios
              ? "Tap the share icon below, then 'Add to Home Screen' for offline access."
              : 'Add to your home screen for offline access and faster loading.'}
          </div>
        </div>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
      </div>
      {!ios && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={install}
            style={{ flex: 1, padding: '8px', background: '#ff6600', border: 'none', borderRadius: '4px', color: '#fff', fontFamily: MONO, fontSize: '11px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em' }}>
            INSTALL
          </button>
          <button
            onClick={dismiss}
            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #333', borderRadius: '4px', color: '#555', fontFamily: MONO, fontSize: '11px', cursor: 'pointer' }}>
            Not now
          </button>
        </div>
      )}
    </div>
  )
}
