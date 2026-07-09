// ─── OfflineBanner.jsx — Offline/online indicator banner (v5.11.0) ───────────
import { useState, useEffect } from 'react'
import { announce } from '../lib/a11y/announcer.js'

const MONO = "'IBM Plex Mono', monospace"

export default function OfflineBanner({ lang = 'en' } = {}) {
  const [offline, setOffline] = useState(!navigator.onLine)
  // v9.495 (F14): server-unreachable-while-online — consumes the hydration
  // failure signal that previously had no reader.
  const [serverDown, setServerDown] = useState(() => {
    try { return localStorage.getItem('sporeus-offline-mode') === '1' } catch { return false }
  })

  useEffect(() => {
    function onServerStatus(e) { setServerDown(e?.detail?.unreachable === true) }
    window.addEventListener('sporeus-server-status', onServerStatus)
    return () => window.removeEventListener('sporeus-server-status', onServerStatus)
  }, [])

  useEffect(() => {
    function goOffline() {
      setOffline(true)
      announce(
        lang === 'tr'
          ? 'Çevrimdışı — veriler yerel olarak kaydedilecek'
          : 'Offline — data will save locally',
        'assertive',
      )
    }
    function goOnline()  { setOffline(false) }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [lang])

  if (!offline && serverDown) {
    return (
      <div style={{
        position: 'relative', zIndex: 10005,
        background: '#5c1a1a', borderBottom: '1px solid #a03030',
        color: '#ff8080', fontFamily: MONO, fontSize: '10px',
        padding: '6px 20px', textAlign: 'center', letterSpacing: '0.1em',
      }}>
        ◈ {lang === 'tr'
          ? 'SUNUCUYA ULAŞILAMIYOR — cihazdaki veriler gösteriliyor; kayıtlar bağlantı gelince senkronize olur'
          : "CAN'T REACH THE SERVER — showing device data; saves will sync when the connection returns"}
      </div>
    )
  }
  if (!offline) return null

  return (
    <div style={{
      position: 'relative', zIndex: 10005,  // v9.370.0 — App banner stack positions it (was fixed top:0)
      background: '#7a5c00', borderBottom: '1px solid #e0a030',
      color: '#f5c542', fontFamily: MONO, fontSize: '10px',
      padding: '6px 20px', textAlign: 'center', letterSpacing: '0.1em',
    }}>
      ◈ {lang === 'tr'
        ? 'ÇEVRİMDIŞI — veriler yerel olarak kaydedilir ve yeniden bağlanınca senkronize olur'
        : 'OFFLINE — data saves locally and syncs when reconnected'}
    </div>
  )
}
