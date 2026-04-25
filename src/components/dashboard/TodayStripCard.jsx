import { useMemo } from 'react'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'

export default function TodayStripCard({ log, isTR, onLogSession }) {
  const todayISO = new Date().toISOString().slice(0, 10)

  const dayName = new Date().toLocaleDateString(isTR ? 'tr-TR' : 'en-US', { weekday: 'short' }).toUpperCase()

  const trainedToday = useMemo(() => (log || []).some(e => e.date === todayISO), [log, todayISO])

  const streak = useMemo(() => {
    const dates = new Set((log || []).map(e => e.date))
    let d = new Date()
    if (!dates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1)
    let s = 0
    while (dates.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1) }
    return s
  }, [log])

  const weekSessions = useMemo(() => {
    const now = new Date()
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - dow)
    const mondayISO = monday.toISOString().slice(0, 10)
    return (log || []).filter(e => e.date >= mondayISO).length
  }, [log])

  // Empty log — show first-session CTA
  if ((log || []).length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0',
        padding: '10px 0 12px', borderBottom: '1px solid #1a1a1a',
        marginBottom: '16px', fontFamily: MONO, fontSize: '10px',
      }}>
        <span style={{ color: '#444', marginRight: '10px' }}>
          {todayISO} · {dayName}
        </span>
        <span style={{ color: '#222', marginRight: '10px' }}>|</span>
        <button
          onClick={onLogSession}
          style={{
            fontSize: '9px', padding: '3px 10px',
            background: ORANGE, color: '#000', border: 'none',
            borderRadius: '3px', cursor: 'pointer', fontFamily: MONO, fontWeight: 700,
          }}
        >
          {isTR ? 'İLK ANTREMANINI KAYDET →' : 'START YOUR FIRST SESSION →'}
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0',
      padding: '10px 0 12px', borderBottom: '1px solid #1a1a1a',
      marginBottom: '16px', fontFamily: MONO, fontSize: '10px',
    }}>
      {/* date */}
      <span style={{ color: '#444', marginRight: '10px' }}>
        {todayISO} · {dayName}
      </span>

      {/* divider */}
      <span style={{ color: '#222', marginRight: '10px' }}>|</span>

      {/* trained today */}
      <span style={{ color: trainedToday ? GREEN : AMBER, fontWeight: 700, marginRight: '10px' }}>
        {trainedToday
          ? (isTR ? '✓ ANTRENDI' : '✓ TRAINED')
          : (isTR ? '○ HENÜZ YOK' : '○ NOT YET')}
      </span>

      {/* streak */}
      {streak > 0 && (
        <>
          <span style={{ color: '#222', marginRight: '10px' }}>|</span>
          <span style={{ color: ORANGE, marginRight: '10px' }}>
            {'◈ '}{streak}{isTR ? 'g seri' : 'd streak'}
          </span>
        </>
      )}

      {/* week sessions */}
      <span style={{ color: '#222', marginRight: '10px' }}>|</span>
      <span style={{ color: '#555', marginRight: '10px' }}>
        {weekSessions} {isTR ? 'antrenman bu hafta' : 'sessions this week'}
      </span>

      {/* CTA if not trained today */}
      {!trainedToday && (
        <button
          onClick={onLogSession}
          style={{
            fontSize: '9px', padding: '3px 10px', marginLeft: '4px',
            background: ORANGE, color: '#000', border: 'none',
            borderRadius: '3px', cursor: 'pointer', fontFamily: MONO, fontWeight: 700,
          }}
        >
          + {isTR ? 'KAYDET' : 'LOG TODAY'}
        </button>
      )}
    </div>
  )
}
