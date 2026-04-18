// ─── LiveSquadFeed.jsx — Live activity feed panel for coach dashboard ──────────
// Renders events from useRealtimeSquadFeed with presence dots from useSquadPresence.
// Collapsible; events are clickable and call onAthleteClick(athleteId).
// Designed to sit above the squad table in CoachSquadView.

import { useState } from 'react'
import { S } from '../../styles.js'

const STATUS_COLOR = { live: '#5bc25b', connecting: '#f5c542', reconnecting: '#f5c542', disconnected: '#555' }
const STATUS_LABEL = { live: '● LIVE', connecting: '○ connecting…', reconnecting: '○ reconnecting…', disconnected: '○ offline' }
const KIND_COLOR   = { session: '#5bc25b', recovery: '#0064ff' }

/**
 * @param {object}   props
 * @param {Array}    props.feedEvents      — from useRealtimeSquadFeed
 * @param {string}   props.feedStatus      — 'live' | 'connecting' | 'reconnecting' | 'disconnected'
 * @param {object}   props.presenceMap     — { [athleteId]: { online, last_seen } }
 * @param {Array}    props.athletes        — full athlete list for presence dot display
 * @param {Function} [props.onAthleteClick] — called with athleteId when an event row is clicked
 */
export default function LiveSquadFeed({
  feedEvents = [],
  feedStatus = 'disconnected',
  presenceMap = {},
  athletes = [],
  onAthleteClick,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const onlineCount = athletes.filter(a => presenceMap[a.athlete_id]?.online).length

  return (
    <div style={{
      marginTop: '16px',
      border: '1px solid #1e1e1e',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Header — click to collapse/expand */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(c => !c)}
        onKeyDown={e => e.key === 'Enter' && setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '8px 14px', background: '#0d0d0d',
          borderBottom: collapsed ? 'none' : '1px solid #1e1e1e',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ ...S.mono, fontSize: '10px', color: STATUS_COLOR[feedStatus] || '#555', letterSpacing: '0.05em' }}>
          {STATUS_LABEL[feedStatus] || '○ offline'}
        </span>
        <span style={{ ...S.mono, fontSize: '10px', color: '#444' }}>SQUAD FEED</span>
        {onlineCount > 0 && (
          <span style={{ ...S.mono, fontSize: '10px', color: '#5bc25b', marginLeft: 'auto' }}>
            {onlineCount} online
          </span>
        )}
        {/* Presence dots */}
        {athletes.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', marginLeft: onlineCount > 0 ? '0' : 'auto' }}>
            {athletes.slice(0, 12).map(a => (
              <span
                key={a.athlete_id}
                title={`${a.display_name}: ${presenceMap[a.athlete_id]?.online ? 'online' : 'offline'}`}
                style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: presenceMap[a.athlete_id]?.online ? '#5bc25b' : '#333',
                  display: 'inline-block', transition: 'background 0.4s',
                }}
              />
            ))}
          </div>
        )}
        {/* Collapse chevron */}
        <span style={{ ...S.mono, fontSize: '10px', color: '#444', marginLeft: 'auto', flexShrink: 0 }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </div>

      {/* Event list — hidden when collapsed */}
      {!collapsed && (
        <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#080808' }}>
          {feedEvents.length === 0 ? (
            <div style={{ padding: '20px 14px', ...S.mono, fontSize: '11px', color: '#333', textAlign: 'center' }}>
              {athletes.length === 0
                ? 'No athletes yet — invite your first athlete from the Squad tab.'
                : feedStatus === 'live'
                  ? 'No activity yet — waiting for squad updates…'
                  : 'Connecting to live feed…'}
            </div>
          ) : (
            feedEvents.map(ev => (
              <div
                key={ev.id}
                role={onAthleteClick ? 'button' : undefined}
                tabIndex={onAthleteClick ? 0 : undefined}
                onClick={() => onAthleteClick?.(ev.athleteId)}
                onKeyDown={e => e.key === 'Enter' && onAthleteClick?.(ev.athleteId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 14px', borderBottom: '1px solid #0d0d0d',
                  cursor: onAthleteClick ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (onAthleteClick) e.currentTarget.style.background = '#0f0f0f' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: KIND_COLOR[ev.kind] || '#555',
                }} />
                <span style={{ ...S.mono, fontSize: '11px', color: '#c0c0c0', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.label}
                </span>
                <span style={{ ...S.mono, fontSize: '9px', color: '#444', flexShrink: 0 }}>
                  {relTime(ev.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function relTime(iso) {
  try {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (secs < 60) return 'just now'
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  } catch { return '' }
}
