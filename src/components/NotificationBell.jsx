// ─── NotificationBell.jsx — In-app notification center (v6.9.3) ─────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getNotifications,
  markRead,
  markAllRead,
  clearAll,
  getUnreadCount,
} from '../lib/notificationCenter.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

const TYPE_ICON = {
  training:    '🏃',
  analytics:   '📊',
  warning:     '⚠️',
  achievement: '🏆',
  coach:       '💬',
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen]         = useState(false)
  const [items, setItems]       = useState([])
  const [unread, setUnread]     = useState(0)
  const dropRef                 = useRef(null)

  const refresh = useCallback(() => {
    setItems(getNotifications())
    setUnread(getUnreadCount())
  }, [])

  // Sync on mount and when storage changes (other tabs / components calling addNotification)
  useEffect(() => {
    refresh()
    function onStorage(e) {
      if (e.key === 'sporeus-notifications') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  // Re-read on every open
  useEffect(() => { if (open) refresh() }, [open, refresh])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleMarkAll() {
    markAllRead()
    refresh()
  }

  function handleClear() {
    clearAll()
    refresh()
  }

  function handleClick(n) {
    markRead(n.id)
    refresh()
    setOpen(false)
    if (onNavigate && n.metadata?.tab) onNavigate(n.metadata.tab)
  }

  return (
    <div ref={dropRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Notifications"
        style={{
          fontFamily: MONO,
          fontSize: '14px',
          padding: '4px 8px',
          borderRadius: '3px',
          border: '1px solid #444',
          background: open ? '#1a1a1a' : 'transparent',
          color: '#ccc',
          cursor: 'pointer',
          position: 'relative',
          lineHeight: 1,
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            minWidth: '14px',
            height: '14px',
            borderRadius: '7px',
            background: '#e03030',
            color: '#fff',
            fontFamily: MONO,
            fontSize: '8px',
            fontWeight: 700,
            lineHeight: '14px',
            textAlign: 'center',
            padding: '0 3px',
            pointerEvents: 'none',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'fixed',
          top: '52px',
          right: '12px',
          width: '320px',
          maxHeight: '440px',
          overflowY: 'auto',
          background: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: '5px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 9000,
          fontFamily: MONO,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid #1e1e1e',
            position: 'sticky',
            top: 0,
            background: '#111',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#888', letterSpacing: '0.1em' }}>
              NOTIFICATIONS {unread > 0 && <span style={{ color: ORANGE }}>({unread})</span>}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  style={{ background: 'none', border: 'none', color: '#555', fontSize: '9px', cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.05em' }}
                >
                  Mark all read
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={handleClear}
                  style={{ background: 'none', border: 'none', color: '#444', fontSize: '9px', cursor: 'pointer', fontFamily: MONO }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: '10px', color: '#444' }}>
              No notifications
            </div>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '10px 14px',
                  borderBottom: '1px solid #181818',
                  cursor: n.metadata?.tab ? 'pointer' : 'default',
                  background: n.read ? 'transparent' : '#141414',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a' }}
                onMouseLeave={e => { e.currentTarget.style.background = n.read ? 'transparent' : '#141414' }}
              >
                <span style={{ fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>
                  {TYPE_ICON[n.type] || '📊'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: n.read ? 400 : 700,
                      color: n.read ? '#777' : '#ccc',
                      lineHeight: 1.3,
                    }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '8px', color: '#444', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <div style={{
                      fontSize: '9px',
                      color: '#555',
                      marginTop: '2px',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {n.body}
                    </div>
                  )}
                </div>
                {!n.read && (
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: ORANGE, flexShrink: 0, marginTop: '5px' }} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
