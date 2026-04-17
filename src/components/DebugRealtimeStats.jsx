// ─── DebugRealtimeStats.jsx — Coach-only realtime channel debug panel ──────────
// Feature-gated: only visible to coach+ tier users.
// Shows all active realtime channel statuses + subscribe/unsubscribe telemetry counts.
// Toggle via localStorage key 'sporeus-debug-realtime' = '1'.

import { useState, useEffect } from 'react'
import { subscribeToStatuses, getStatuses } from '../lib/realtimeStatus.js'
import { getEventSummary } from '../lib/telemetry.js'
import { isFeatureGated } from '../lib/subscription.js'

const MONO = "'IBM Plex Mono', monospace"

const STATUS_COLOR = {
  live:          '#5bc25b',
  connecting:    '#f5c542',
  reconnecting:  '#f5c542',
  disconnected:  '#555',
}

/**
 * @param {object} props
 * @param {string} [props.tier='free']
 */
export default function DebugRealtimeStats({ tier = 'free' }) {
  const [statuses,    setStatuses]    = useState(() => getStatuses())
  const [telemetry,   setTelemetry]   = useState(() => getEventSummary())
  const [visible,     setVisible]     = useState(false)
  const [debugEnabled] = useState(() => {
    try { return localStorage.getItem('sporeus-debug-realtime') === '1' } catch { return false }
  })

  useEffect(() => {
    const unsub = subscribeToStatuses(s => {
      setStatuses(s)
      setTelemetry(getEventSummary())
    })
    return unsub
  }, [])

  // Gate: coach tier + debug flag must both be set
  if (isFeatureGated('debug_realtime_stats', tier) || !debugEnabled) return null

  const channelEntries = Object.entries(statuses)

  return (
    <div style={{
      position: 'fixed', bottom: '40px', left: '10px',
      zIndex: 9999,
      background: '#0a0a0a',
      border: '1px solid #2a2a2a',
      borderRadius: '6px',
      fontFamily: MONO,
      fontSize: '9px',
      minWidth: '220px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setVisible(v => !v)}
        onKeyDown={e => e.key === 'Enter' && setVisible(v => !v)}
        style={{
          padding: '6px 10px', background: '#111', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: visible ? '1px solid #1e1e1e' : 'none',
        }}
      >
        <span style={{ color: '#888', letterSpacing: '0.1em' }}>⚡ REALTIME DEBUG</span>
        <span style={{ color: '#444' }}>{visible ? '▲' : '▼'}</span>
      </div>

      {visible && (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Channel statuses */}
          <div style={{ color: '#555', letterSpacing: '0.08em', marginBottom: '4px' }}>CHANNELS</div>
          {channelEntries.length === 0 ? (
            <div style={{ color: '#333' }}>No active channels</div>
          ) : (
            channelEntries.map(([name, status]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  {name}
                </span>
                <span style={{ color: STATUS_COLOR[status] || '#444', flexShrink: 0 }}>
                  {status}
                </span>
              </div>
            ))
          )}

          {/* Telemetry summary */}
          <div style={{ color: '#555', letterSpacing: '0.08em', marginTop: '6px', marginBottom: '4px' }}>TELEMETRY</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ color: '#5bc25b' }}>↑ sub: {telemetry['realtime'] || 0}</span>
            <span style={{ color: '#888' }}>total events</span>
          </div>
          <div style={{ color: '#333', marginTop: '4px' }}>
            Toggle: localStorage 'sporeus-debug-realtime'='1'
          </div>
        </div>
      )}
    </div>
  )
}
