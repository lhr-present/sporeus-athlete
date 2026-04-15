// ─── NotifReminders — training reminders + push notification controls ────────
import { useState, useEffect } from 'react'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { getPushState, subscribePush, unsubscribePush, checkRaceCountdowns } from '../../lib/pushNotify.js'

export default function NotifReminders({ authUser }) {
  const [reminders, setReminders] = useLocalStorage('sporeus-reminders', { train: false, trainTime: '18:00', recovery: false, racecountdown: false })
  const [pushState, setPushState] = useState('loading') // 'loading'|'unsupported'|'denied'|'default'|'granted'|'subscribed'
  const [pushBusy, setPushBusy]   = useState(false)
  const [pushMsg,  setPushMsg]    = useState('')
  const supported = typeof window !== 'undefined' && 'Notification' in window

  useEffect(() => {
    getPushState().then(s => setPushState(s))
  }, [])

  const handlePushToggle = async () => {
    setPushBusy(true)
    try {
      if (pushState === 'subscribed') {
        await unsubscribePush(authUser?.id)
        setPushState('granted')
        setPushMsg('Push notifications disabled')
      } else {
        await subscribePush(authUser?.id)
        setPushState('subscribed')
        setPushMsg('Push notifications enabled ✓')
      }
    } catch (e) {
      setPushMsg(`⚠ ${e.message}`)
    }
    setPushBusy(false)
    setTimeout(() => setPushMsg(''), 4000)
  }

  const toggleTrain = async () => {
    if (!reminders.train && supported) await Notification.requestPermission()
    setReminders(r => ({ ...r, train: !r.train }))
  }
  const toggleRecovery = async () => {
    if (!reminders.recovery && supported) await Notification.requestPermission()
    setReminders(r => ({ ...r, recovery: !r.recovery }))
  }
  const toggleRaceCountdown = async () => {
    if (!reminders.racecountdown && supported) await Notification.requestPermission()
    setReminders(r => ({ ...r, racecountdown: !r.racecountdown }))
  }

  useEffect(() => {
    if (!supported) return
    const interval = setInterval(async () => {
      if (Notification.permission !== 'granted') return
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (reminders.train && hhmm === reminders.trainTime) {
        new Notification('Sporeus — Time to train!', { body: 'Your training reminder is ready. Check your plan.', icon: '/sporeus-athlete/pwa-192x192.png' })
      }
      if (reminders.recovery && hhmm === '08:00') {
        const today = new Date().toISOString().slice(0, 10)
        try {
          const rec = JSON.parse(localStorage.getItem('sporeus-recovery') || '[]')
          if (!rec.find(e => e.date === today)) {
            new Notification('Sporeus — Log your recovery', { body: 'How did you sleep? Fill in your daily wellness check.', icon: '/sporeus-athlete/pwa-192x192.png' })
          }
        } catch {}
      }
      if (reminders.racecountdown && hhmm === '09:00') {
        checkRaceCountdowns()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [reminders, supported])

  if (!supported) return (
    <div style={{ ...S.mono, fontSize: '11px', color: '#aaa' }}>Notifications not available in this browser.</div>
  )

  const pushActive = pushState === 'subscribed'
  const pushLabel  = { loading: '...', unsupported: 'Not supported', denied: 'Permission denied', default: 'Enable', granted: 'Subscribe', subscribed: 'Active' }[pushState] || '—'

  return (
    <div>
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
          </div>
          <div style={{ ...S.mono, fontSize: '10px', color: '#888', lineHeight: 1.6 }}>
            {pushState === 'denied'
              ? 'Notifications blocked. Enable in browser settings.'
              : 'Receive race countdowns, injury alerts, and coach messages even when the app is closed.'}
          </div>
          {pushMsg && <div style={{ ...S.mono, fontSize: '10px', marginTop: '6px', color: pushMsg.startsWith('⚠') ? '#e03030' : '#5bc25b' }}>{pushMsg}</div>}
        </div>
      )}

      {[
        { label: 'Training reminder',                    key: 'train',         toggle: toggleTrain,         active: reminders.train },
        { label: 'Recovery check-in at 08:00',           key: 'recovery',      toggle: toggleRecovery,      active: reminders.recovery },
        { label: 'Race countdown (7d + 1d before race)', key: 'racecountdown', toggle: toggleRaceCountdown, active: reminders.racecountdown },
      ].map(({ label, key, toggle, active }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button onClick={toggle} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '3px', border: `1px solid ${active ? '#ff6600' : '#e0e0e0'}`, background: active ? '#ff6600' : 'transparent', color: active ? '#fff' : '#888', cursor: 'pointer' }}>
            {active ? 'ON' : 'OFF'}
          </button>
          <span style={{ ...S.mono, fontSize: '12px', color: 'var(--text)' }}>{label}</span>
          {key === 'train' && active && (
            <input type="time" value={reminders.trainTime} onChange={e => setReminders(r => ({ ...r, trainTime: e.target.value }))}
              style={{ ...S.input, width: '110px', padding: '4px 8px', fontSize: '12px' }}/>
          )}
        </div>
      ))}
    </div>
  )
}
