// src/components/dashboard/WeekSessionTypeCard.jsx — E79
// Shows this week's session breakdown: easy / moderate / hard counts + total minutes.
// Gives athlete instant visibility into weekly composition.
import { useMemo } from 'react'
import { S } from '../../styles.js'

const MONO = "'IBM Plex Mono', monospace"

function getISOWeekMon(today = new Date().toISOString().slice(0, 10)) {
  const d = new Date(today + 'T12:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() - dow)
  return mon.toISOString().slice(0, 10)
}

function classifyRpe(rpe) {
  if (!rpe || rpe <= 5) return 'easy'
  if (rpe <= 7) return 'moderate'
  return 'hard'
}

export default function WeekSessionTypeCard({ log, isTR }) {
  const { easy, moderate, hard, totalMin, sessions } = useMemo(() => {
    const mon = getISOWeekMon()
    const week = (log || []).filter(e => e.date && e.date >= mon)
    const easy     = week.filter(e => classifyRpe(e.rpe) === 'easy')
    const moderate = week.filter(e => classifyRpe(e.rpe) === 'moderate')
    const hard     = week.filter(e => classifyRpe(e.rpe) === 'hard')
    const totalMin = week.reduce((s, e) => s + (e.duration || 0), 0)
    return { easy, moderate, hard, totalMin, sessions: week.length }
  }, [log])

  if (sessions === 0) return null

  const hours = Math.floor(totalMin / 60)
  const mins  = totalMin % 60

  const Row = ({ label, items, color }) => items.length === 0 ? null : (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #111' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: MONO, fontSize: '9px', color, minWidth: '60px' }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#444' }}>
          {items.map(e => e.type || '—').join(' · ')}
        </span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: '9px', color: '#555' }}>
        {items.reduce((s, e) => s + (e.duration || 0), 0)} min
      </span>
    </div>
  )

  return (
    <div style={{ ...S.card }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'BU HAFTA' : 'THIS WEEK'}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: '#ff6600', fontWeight: 700 }}>
            {sessions} {isTR ? 'seans' : `session${sessions !== 1 ? 's' : ''}`}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555' }}>
            {hours > 0 ? `${hours}h ` : ''}{mins > 0 ? `${mins}m` : ''}
          </span>
        </div>
      </div>

      <Row label={isTR ? 'KOLAY' : 'EASY'}     items={easy}     color="#5bc25b" />
      <Row label={isTR ? 'ORTA' : 'MODERATE'}  items={moderate} color="#f5c542" />
      <Row label={isTR ? 'ZOR' : 'HARD'}       items={hard}     color="#e03030" />

      {/* Mini strip */}
      {sessions > 0 && (
        <div style={{ display: 'flex', gap: '3px', marginTop: '8px' }}>
          {(log || [])
            .filter(e => e.date && e.date >= getISOWeekMon())
            .sort((a, b) => a.date > b.date ? 1 : -1)
            .map((e, i) => {
              const cls = classifyRpe(e.rpe)
              const c = cls === 'easy' ? '#5bc25b' : cls === 'moderate' ? '#f5c542' : '#e03030'
              return (
                <div
                  key={i}
                  title={`${e.date}: ${e.type || '—'} · ${e.duration || 0}min · RPE ${e.rpe || '?'}`}
                  style={{ flex: 1, height: '6px', background: c, borderRadius: '2px', maxWidth: '32px' }}
                />
              )
            })}
        </div>
      )}
    </div>
  )
}
