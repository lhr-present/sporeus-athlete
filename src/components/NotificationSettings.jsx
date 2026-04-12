// ─── NotificationSettings.jsx — Push/local notification toggle (v5.11.0) ─────
import { useState, useEffect } from 'react'
import {
  requestPermission,
  scheduleSessionReminder,
  cancelReminder,
  getReminderSettings,
  saveReminderSettings,
} from '../lib/pushNotifications.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

function permColor(p) {
  if (p === 'granted')   return '#5bc25b'
  if (p === 'denied')    return '#e03030'
  return '#888'
}
function permLabel(p) {
  if (p === 'granted')   return 'ALLOWED'
  if (p === 'denied')    return 'BLOCKED'
  if (p === 'unsupported') return 'N/A'
  return 'NOT SET'
}

export default function NotificationSettings() {
  const [permission, setPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [enabled, setEnabled]   = useState(false)
  const [hour, setHour]         = useState(7)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    const s = getReminderSettings()
    setEnabled(s.enabled)
    setHour(s.hour)
  }, [])

  async function handleToggle() {
    if (!enabled) {
      const result = await requestPermission()
      setPermission(result)
      if (result !== 'granted') return
    }
    const next = !enabled
    setEnabled(next)
    saveReminderSettings({ enabled: next, hour })
    if (next) {
      scheduleSessionReminder({ hour })
    } else {
      cancelReminder()
    }
    flashSaved()
  }

  function handleHourChange(e) {
    const h = parseInt(e.target.value, 10)
    setHour(h)
    saveReminderSettings({ enabled, hour: h })
    if (enabled) scheduleSessionReminder({ hour: h })
    flashSaved()
  }

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const notSupported = typeof Notification === 'undefined' || permission === 'unsupported'

  return (
    <div style={{ fontFamily: MONO, padding: '16px', background: '#0f0f0f', border: '1px solid #222', borderRadius: '6px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#ccc', letterSpacing: '0.08em' }}>
          TRAINING REMINDERS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '9px', color: permColor(permission), letterSpacing: '0.1em' }}>
            {permLabel(permission)}
          </span>
          {saved && <span style={{ fontSize: '9px', color: '#5bc25b' }}>SAVED</span>}
        </div>
      </div>

      {notSupported ? (
        <div style={{ fontSize: '10px', color: '#555' }}>
          Notifications not supported in this browser.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <button
              onClick={handleToggle}
              style={{
                width: '38px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: enabled ? ORANGE : '#333', position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: '3px', left: enabled ? '19px' : '3px',
                width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
            <span style={{ fontSize: '11px', color: enabled ? '#ccc' : '#555' }}>
              Daily reminder
            </span>
          </div>

          {enabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '10px', color: '#666' }}>Remind at</span>
              <select
                value={hour}
                onChange={handleHourChange}
                style={{
                  background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px',
                  color: '#ccc', fontFamily: MONO, fontSize: '11px', padding: '4px 8px', cursor: 'pointer',
                }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '10px', color: '#555' }}>local time</span>
            </div>
          )}

          {permission === 'denied' && (
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#e03030', lineHeight: 1.5 }}>
              Notifications blocked. Enable in browser settings to use this feature.
            </div>
          )}
        </>
      )}
    </div>
  )
}
