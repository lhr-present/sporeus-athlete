// ─── NotifReminders — push notification controls + reminders (Phase 1.5) ──────
import { useState, useEffect, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useData } from '../../contexts/DataContext.jsx'
import { isSupabaseReady, supabase } from '../../lib/supabase.js'
import {
  getPushState, subscribePush, unsubscribePush, sendTestNotification,
  checkRaceCountdowns,
} from '../../lib/pushNotify.js'

const DEFAULT_NOTIF_PREFS = {
  checkin_reminder:  true,
  invite_accepted:   true,
  readiness_red:     true,
  session_feedback:  true,
  missed_checkin:    false,  // opt-in only
}

const KIND_META = [
  { key: 'checkin_reminder',  label: 'Daily check-in reminder',   desc: 'Reminder at your preferred time to log wellness.',      defaultOn: true  },
  { key: 'invite_accepted',   label: 'New athlete linked',         desc: 'Notifies you when someone joins your squad.',           defaultOn: true  },
  { key: 'readiness_red',     label: 'Squad readiness alert',      desc: 'Coach: athlete drops to red readiness.',               defaultOn: true  },
  { key: 'session_feedback',  label: 'Session feedback',           desc: 'Coach left feedback on your session.',                  defaultOn: true  },
  { key: 'missed_checkin',    label: 'Missed check-in nudge',      desc: '4h after missed check-in (can be frequent — opt-in).',  defaultOn: false },
]

export default function NotifReminders({ authUser }) {
  const { t } = useContext(LangCtx)
  const { profile, setProfile } = useData()

  const [pushState, setPushState]     = useState('loading')
  const [pushBusy, setPushBusy]       = useState(false)
  const [pushMsg,  setPushMsg]        = useState('')
  const [testBusy, setTestBusy]       = useState(false)
  const [recentNotifs, setRecentNotifs] = useState(null) // null = not loaded
  const [showRecent, setShowRecent]   = useState(false)

  const supported = typeof window !== 'undefined' && 'Notification' in window

  // ── Notification preferences from profile ──────────────────────────────────
  const notifPrefs     = profile?.notifications       || DEFAULT_NOTIF_PREFS
  const checkinTime    = profile?.preferred_checkin_time || '07:00'
  const timezone       = profile?.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')

  // ── Init timezone once if missing ───────────────────────────────────────────
  useEffect(() => {
    if (!profile?.timezone && typeof Intl !== 'undefined') {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      setProfile(p => ({ ...p, timezone: detected }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getPushState().then(s => setPushState(s))
  }, [])

  // ── Push toggle ─────────────────────────────────────────────────────────────
  const handlePushToggle = async () => {
    setPushBusy(true)
    try {
      if (pushState === 'subscribed') {
        await unsubscribePush(authUser?.id)
        setPushState('granted')
        flash('Push notifications disabled')
      } else {
        await subscribePush(authUser?.id)
        setPushState('subscribed')
        flash('Push notifications enabled ✓')
      }
    } catch (e) {
      flash(`⚠ ${e.message}`)
    }
    setPushBusy(false)
  }

  // ── Kind toggle ─────────────────────────────────────────────────────────────
  const toggleKind = (key) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] }
    setProfile(p => ({ ...p, notifications: updated }))
  }

  // ── Time / timezone save ────────────────────────────────────────────────────
  const saveCheckinTime = (time) => {
    setProfile(p => ({ ...p, preferred_checkin_time: time }))
  }

  const saveTimezone = (tz) => {
    setProfile(p => ({ ...p, timezone: tz }))
  }

  // ── Test notification ───────────────────────────────────────────────────────
  const handleTest = async () => {
    if (pushState !== 'subscribed') { flash('⚠ Enable push notifications first'); return }
    setTestBusy(true)
    const { error } = await sendTestNotification(authUser?.id)
    setTestBusy(false)
    if (error) flash(`⚠ Test failed: ${error.message || 'unknown'}`)
    else flash('Test notification sent ✓ — should arrive within 10s', 8000)
  }

  // ── Recent notifications ────────────────────────────────────────────────────
  const loadRecentNotifs = async () => {
    if (!authUser?.id || !isSupabaseReady()) return
    const { data } = await supabase
      .from('notification_log')
      .select('kind, delivery_status, sent_at, error')
      .eq('user_id', authUser.id)
      .order('sent_at', { ascending: false })
      .limit(10)
    setRecentNotifs(data || [])
    setShowRecent(true)
  }

  const flash = (text, ms = 4000) => {
    setPushMsg(text)
    setTimeout(() => setPushMsg(''), ms)
  }

  // ── Legacy local reminders (kept for backward compat) ──────────────────────
  const [legacyRace, setLegacyRace] = useState(false)
  useEffect(() => {
    if (legacyRace && Notification.permission === 'granted') checkRaceCountdowns()
  }, [legacyRace])

  if (!supported) return (
    <div style={{ ...S.mono, fontSize: '11px', color: '#aaa' }}>Notifications not available in this browser.</div>
  )

  const pushActive = pushState === 'subscribed'
  const pushLabel  = { loading: '...', unsupported: 'Not supported', denied: 'Permission denied', default: 'Enable', granted: 'Subscribe', subscribed: 'Active' }[pushState] || '—'

  const statusColor = { delivered: '#5bc25b', failed: '#e03030', deduped: '#888', expired_subscription: '#ffa500', pending: '#666' }

  return (
    <div>
      {/* ── Push on/off toggle ─────────────────────────────────────────────── */}
      {pushState !== 'unsupported' && (
        <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--surface)', borderRadius: '4px', borderLeft: `3px solid ${pushActive ? '#5bc25b' : '#444'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <button
              onClick={handlePushToggle}
              disabled={pushBusy || pushState === 'denied' || pushState === 'loading'}
              style={{ ...S.mono, fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '3px', border: `1px solid ${pushActive ? '#5bc25b' : '#444'}`, background: pushActive ? '#5bc25b' : 'transparent', color: pushActive ? '#fff' : '#888', cursor: 'pointer', opacity: (pushState === 'denied' || pushState === 'loading') ? 0.5 : 1 }}>
              {pushBusy ? '...' : pushActive ? 'ON' : 'OFF'}
            </button>
            <span style={{ ...S.mono, fontSize: '12px', color: 'var(--text)' }}>
              Push notifications <span style={{ ...S.mono, fontSize: '9px', color: pushActive ? '#5bc25b' : '#888', marginLeft: '4px' }}>({pushLabel})</span>
            </span>
            {pushActive && (
              <button
                onClick={handleTest}
                disabled={testBusy}
                style={{ ...S.mono, fontSize: '9px', padding: '3px 8px', borderRadius: '3px', border: '1px solid #444', background: 'transparent', color: '#888', cursor: 'pointer', marginLeft: 'auto' }}>
                {testBusy ? '...' : 'TEST'}
              </button>
            )}
          </div>
          <div style={{ ...S.mono, fontSize: '10px', color: '#888', lineHeight: 1.6 }}>
            {pushState === 'denied'
              ? 'Notifications blocked. Enable in browser settings.'
              : 'Receive check-in reminders, squad alerts, and coaching updates when the app is closed.'}
          </div>
        </div>
      )}

      {/* ── Notification kind toggles ───────────────────────────────────────── */}
      {pushActive && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '8px' }}>NOTIFICATION TYPES</div>
          {KIND_META.map(({ key, label, desc, defaultOn }) => {
            const active = notifPrefs[key] ?? defaultOn
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                <button onClick={() => toggleKind(key)} style={{ ...S.mono, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '3px', border: `1px solid ${active ? '#ff6600' : '#444'}`, background: active ? '#ff6600' : 'transparent', color: active ? '#fff' : '#555', cursor: 'pointer', flexShrink: 0, marginTop: '1px' }}>
                  {active ? 'ON' : 'OFF'}
                </button>
                <div>
                  <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', fontWeight: active ? 600 : 400 }}>{label}</div>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#555', lineHeight: 1.5 }}>
                    {desc}
                    {!defaultOn && <span style={{ color: '#ffa500' }}> — opt-in</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Check-in time + timezone (only if checkin_reminder is on) ────────── */}
      {pushActive && notifPrefs.checkin_reminder !== false && (
        <div style={{ marginBottom: '16px', padding: '10px 12px', background: '#0a0a0a', borderRadius: '4px' }}>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '8px' }}>CHECK-IN SCHEDULE</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ ...S.mono, fontSize: '9px', color: '#666', marginBottom: '3px' }}>PREFERRED TIME</div>
              <input
                type="time"
                value={checkinTime}
                onChange={e => saveCheckinTime(e.target.value)}
                style={{ ...S.mono, fontSize: '12px', padding: '4px 8px', borderRadius: '3px', border: '1px solid #333', background: '#111', color: '#e0e0e0', width: '110px' }}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <div style={{ ...S.mono, fontSize: '9px', color: '#666', marginBottom: '3px' }}>TIMEZONE</div>
              <input
                type="text"
                value={timezone}
                onChange={e => saveTimezone(e.target.value)}
                placeholder="e.g. Europe/Istanbul"
                style={{ ...S.mono, fontSize: '11px', padding: '4px 8px', borderRadius: '3px', border: '1px solid #333', background: '#111', color: '#e0e0e0', width: '100%' }}
              />
            </div>
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '6px' }}>
            IANA timezone — auto-detected. The cron-based reminder fires at this local hour.
          </div>
        </div>
      )}

      {/* ── Race countdown (legacy local notif) ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button onClick={() => setLegacyRace(r => !r)} style={{ ...S.mono, fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '3px', border: `1px solid ${legacyRace ? '#ff6600' : '#444'}`, background: legacyRace ? '#ff6600' : 'transparent', color: legacyRace ? '#fff' : '#888', cursor: 'pointer' }}>
          {legacyRace ? 'ON' : 'OFF'}
        </button>
        <span style={{ ...S.mono, fontSize: '12px', color: 'var(--text)' }}>Race countdown (7d + 1d before race)</span>
      </div>

      {/* ── Recent notifications ───────────────────────────────────────────────── */}
      {pushActive && authUser?.id && isSupabaseReady() && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={showRecent ? () => setShowRecent(false) : loadRecentNotifs}
            style={{ ...S.mono, fontSize: '10px', color: '#555', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showRecent ? 'Hide notification log' : 'Show recent notifications'}
          </button>
          {showRecent && recentNotifs !== null && (
            <div style={{ marginTop: '8px' }}>
              {recentNotifs.length === 0 ? (
                <div style={{ ...S.mono, fontSize: '10px', color: '#555' }}>No notifications sent yet.</div>
              ) : recentNotifs.map((n, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: '#0a0a0a', borderRadius: '3px', marginBottom: '3px', ...S.mono, fontSize: '10px' }}>
                  <span style={{ color: '#888' }}>{new Date(n.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ color: '#e0e0e0' }}>{n.kind}</span>
                  <span style={{ color: statusColor[n.delivery_status] || '#888' }}>{n.delivery_status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Flash message ────────────────────────────────────────────────────── */}
      {pushMsg && (
        <div style={{ ...S.mono, fontSize: '11px', marginTop: '10px', color: pushMsg.startsWith('⚠') ? '#e03030' : '#5bc25b' }}>
          {pushMsg}
        </div>
      )}
    </div>
  )
}
