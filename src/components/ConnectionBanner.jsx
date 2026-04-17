// ─── ConnectionBanner.jsx — Global realtime reconnecting indicator ─────────────
// Subscribes to realtimeStatus module. Shows a fixed top banner when any
// channel is in 'connecting' or 'reconnecting' state. Auto-hides when all live.
// z-index 9990 — below OfflineBanner (10005), above regular content.

import { useState, useEffect } from 'react'
import { subscribeToStatuses, getStatuses } from '../lib/realtimeStatus.js'

const MONO = "'IBM Plex Mono', monospace"

const RECONNECTING_STATES = new Set(['connecting', 'reconnecting'])

function isReconnecting(statuses) {
  return Object.values(statuses).some(s => RECONNECTING_STATES.has(s))
}

export default function ConnectionBanner() {
  const [show, setShow] = useState(() => isReconnecting(getStatuses()))

  useEffect(() => {
    const unsub = subscribeToStatuses(statuses => {
      setShow(isReconnecting(statuses))
    })
    return unsub
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 9990,
      background: '#1a1000',
      borderBottom: '1px solid #f5c54255',
      color: '#f5c542',
      fontFamily: MONO,
      fontSize: '10px',
      padding: '5px 20px',
      textAlign: 'center',
      letterSpacing: '0.08em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    }}>
      <span style={{ animation: 'sporeus-pulse 1.4s ease-in-out infinite', display: 'inline-block' }}>○</span>
      RECONNECTING TO LIVE FEED…
    </div>
  )
}
