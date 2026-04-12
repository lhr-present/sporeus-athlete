// ─── OfflineBanner.jsx — Offline/online indicator banner (v5.11.0) ───────────
import { useState, useEffect } from 'react'

const MONO = "'IBM Plex Mono', monospace"

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function goOffline() { setOffline(true) }
    function goOnline()  { setOffline(false) }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10005,
      background: '#7a5c00', borderBottom: '1px solid #e0a030',
      color: '#f5c542', fontFamily: MONO, fontSize: '10px',
      padding: '6px 20px', textAlign: 'center', letterSpacing: '0.1em',
    }}>
      ◈ OFFLINE — data saves locally and syncs when reconnected
    </div>
  )
}
