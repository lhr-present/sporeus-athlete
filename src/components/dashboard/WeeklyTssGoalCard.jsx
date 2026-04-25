import { useMemo } from 'react'
import { S } from '../../styles.js'

// ─── WeeklyTssGoalCard — E54 ──────────────────────────────────────────────────
// Shows current week TSS vs personal goal with a 7-day sparkbar.
// Props: log (array), profile (object), isTR (bool)

const DAY_ABBR_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_ABBR_TR = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P']

function getMondayISO() {
  const now = new Date()
  const dow = now.getDay() // 0=Sun, 1=Mon … 6=Sat
  const diffToMon = (dow === 0 ? -6 : 1 - dow) // days back to Monday
  const mon = new Date(now)
  mon.setDate(now.getDate() + diffToMon)
  return mon.toISOString().slice(0, 10)
}

function getWeekDates(mondayISO) {
  // Returns array of 7 ISO date strings: Mon … Sun
  const dates = []
  const base = new Date(mondayISO + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function progressBarColor(pct) {
  if (pct === null) return '#444'
  if (pct > 100) return '#ff6600'
  if (pct >= 75) return '#5bc25b'
  if (pct >= 33) return '#f5c542'
  return '#444'
}

export default function WeeklyTssGoalCard({ log, profile, isTR }) {
  const mondayISO = useMemo(() => getMondayISO(), [])
  const weekDates = useMemo(() => getWeekDates(mondayISO), [mondayISO])

  const { weekTss, sessionCount, dailyTss } = useMemo(() => {
    const dayMap = {}
    weekDates.forEach(d => { dayMap[d] = 0 })

    let total = 0
    let count = 0
    ;(log || []).forEach(entry => {
      const d = (entry.date || '').slice(0, 10)
      if (d >= mondayISO && d <= weekDates[6]) {
        const tss = entry.tss || 0
        total += tss
        count += 1
        if (dayMap[d] !== undefined) dayMap[d] += tss
      }
    })

    return {
      weekTss: Math.round(total),
      sessionCount: count,
      dailyTss: weekDates.map(d => dayMap[d] || 0),
    }
  }, [log, mondayISO, weekDates])

  const goal = parseFloat(profile?.weeklyTssGoal) || 0
  const progressPct = goal > 0 ? Math.min(100, Math.round(weekTss / goal * 100)) : null
  const isOverGoal  = goal > 0 && weekTss > goal

  // Early exit: nothing to show for brand-new athletes with no log and no goal
  if ((!log || log.length === 0) && goal === 0) return null

  const dayAbbr  = isTR ? DAY_ABBR_TR : DAY_ABBR_EN
  const maxDay   = Math.max(...dailyTss, 1)
  const barColor = progressBarColor(progressPct)

  const labelNoGoal = isTR
    ? `BU HAFTA · PROFİLDE HEDEF BELİRLE`
    : `THIS WEEK · SET GOAL IN PROFILE`

  const sessLabel = isTR
    ? `${sessionCount} antrenman`
    : `${sessionCount} session${sessionCount !== 1 ? 's' : ''}`

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '15ms' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.08em' }}>
          <span style={{ color: '#ff6600', marginRight: '6px' }}>◈</span>
          {goal > 0 ? (isTR ? 'BU HAFTA' : 'THIS WEEK') : labelNoGoal}
        </div>
        <div style={{ ...S.mono, fontSize: '10px', color: '#888' }}>
          {sessLabel}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', marginBottom: '8px' }} />

      {/* TSS / Goal row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <div style={{ ...S.mono, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
          {weekTss}
          {goal > 0 && (
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#888' }}> / {goal} TSS</span>
          )}
          {goal === 0 && (
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#888' }}> TSS</span>
          )}
        </div>
        {progressPct !== null && (
          <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: barColor }}>
            {isOverGoal ? '✓ ' : ''}{isOverGoal ? Math.round(weekTss / goal * 100) : progressPct}%
          </div>
        )}
      </div>

      {/* Progress bar — only when goal is set */}
      {goal > 0 && (
        <div style={{ height: '7px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%',
            background: barColor,
            borderRadius: '4px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* Day sparkbar */}
      <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '28px', marginBottom: '4px' }}>
        {dailyTss.map((tss, i) => {
          const h = tss > 0 ? Math.max(4, Math.round(tss / maxDay * 24)) : 2
          const today = new Date().toISOString().slice(0, 10)
          const isToday = weekDates[i] === today
          const barFill = tss > 0
            ? (isToday ? '#ff6600' : '#ff660066')
            : (isToday ? '#333' : '#1e1e1e')
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '2px' }}>
              <div style={{
                width: '100%',
                height: `${h}px`,
                background: barFill,
                borderRadius: '2px',
                transition: 'height 0.3s ease',
              }} />
            </div>
          )
        })}
      </div>

      {/* Day labels */}
      <div style={{ display: 'flex', gap: '3px' }}>
        {dayAbbr.map((d, i) => {
          const today = new Date().toISOString().slice(0, 10)
          const isToday = weekDates[i] === today
          return (
            <div key={i} style={{
              flex: 1,
              textAlign: 'center',
              ...S.mono,
              fontSize: '8px',
              color: isToday ? '#ff6600' : '#444',
              fontWeight: isToday ? 700 : 400,
            }}>
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}
