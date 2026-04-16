import { useMemo } from 'react'
import { S } from '../../styles.js'
import { getGoalProgress, getGoalStatus, calcWeeklyRate } from '../../lib/sport/goalTracker.js'

const STATUS_COLOR = { on_track: '#5bc25b', behind: '#f5c542', impossible: '#e03030' }
const STATUS_DOT   = { on_track: '●', behind: '●', impossible: '●' }

export default function GoalTrackerCard({ log, profile: _profile, dl }) {
  const goals = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('sporeus-goals') || '[]')
    } catch {
      return []
    }
  }, [])

  const goalData = useMemo(() => {
    if (!goals.length || !log.length) return []

    const now = Date.now()
    const cutoff = new Date(now - 12 * 7 * 86400000).toISOString().slice(0, 10)

    return goals.map(goal => {
      // Filter last 12 weeks of log
      const recent = log.filter(e => e.date >= cutoff)

      // Build dataPoints per type
      let dataPoints = []
      let currentValue = goal.current ?? 0

      if (goal.type === 'ftp') {
        dataPoints = recent
          .filter(e => e.ftp != null && e.ftp > 0)
          .map(e => ({ date: e.date, value: e.ftp }))
        if (dataPoints.length) currentValue = dataPoints[dataPoints.length - 1].value

      } else if (goal.type === 'vo2max') {
        dataPoints = recent
          .filter(e => e.vo2max != null && e.vo2max > 0)
          .map(e => ({ date: e.date, value: e.vo2max }))
        if (dataPoints.length) currentValue = dataPoints[dataPoints.length - 1].value

      } else if (goal.type === 'distance') {
        // Group by ISO week, sum distances
        const byWeek = {}
        recent.forEach(e => {
          if (!e.distance || e.distance <= 0) return
          const d = new Date(e.date)
          const dow = d.getDay() || 7
          const mon = new Date(d); mon.setDate(d.getDate() - dow + 1)
          const wk = mon.toISOString().slice(0, 10)
          byWeek[wk] = (byWeek[wk] || 0) + e.distance
        })
        dataPoints = Object.entries(byWeek)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }))
        currentValue = dataPoints.length ? dataPoints[dataPoints.length - 1].value : 0

      } else if (goal.type === 'time') {
        // Weekly total duration
        const byWeek = {}
        recent.forEach(e => {
          if (!e.duration || e.duration <= 0) return
          const d = new Date(e.date)
          const dow = d.getDay() || 7
          const mon = new Date(d); mon.setDate(d.getDate() - dow + 1)
          const wk = mon.toISOString().slice(0, 10)
          byWeek[wk] = (byWeek[wk] || 0) + e.duration
        })
        dataPoints = Object.entries(byWeek)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }))
        currentValue = dataPoints.length ? dataPoints[dataPoints.length - 1].value : 0

      } else {
        // Fallback: use tss as proxy
        dataPoints = recent
          .filter(e => e.tss != null && e.tss > 0)
          .map(e => ({ date: e.date, value: e.tss }))
        if (dataPoints.length) currentValue = dataPoints[dataPoints.length - 1].value
      }

      const weeklyRate = calcWeeklyRate(dataPoints)
      const progress   = getGoalProgress(goal, currentValue)
      const statusObj  = getGoalStatus(goal, currentValue, weeklyRate)

      return { goal, currentValue, weeklyRate, progress, statusObj }
    })
  }, [goals, log])

  if (!goals.length) {
    return (
      <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
        <div style={S.cardTitle}>GOAL TRACKER</div>
        <div style={{ ...S.mono, fontSize: '12px', color: '#888', textAlign: 'center', padding: '16px 0' }}>
          Set goals in Profile → Goals
        </div>
      </div>
    )
  }

  if (!dl.goaltracker) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      <div style={S.cardTitle}>GOAL TRACKER</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {goalData.map(({ goal, currentValue, progress, statusObj }, i) => {
          const pct   = Math.max(0, Math.min(100, progress.pct))
          const color = STATUS_COLOR[statusObj.status] || '#888'
          const label = goal.label || goal.type?.toUpperCase() || 'GOAL'

          return (
            <div key={i}>
              {/* Row: label + status dot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                  {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color, fontSize: '9px' }}>{STATUS_DOT[statusObj.status]}</span>
                  <span style={{ ...S.mono, fontSize: '10px', color }}>{statusObj.status.replace('_', ' ').toUpperCase()}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ ...S.mono, fontSize: '10px', color: '#888' }}>
                  {currentValue} / {goal.target} · {pct}%
                </span>
                <span style={{ ...S.mono, fontSize: '10px', color: '#888' }}>
                  {progress.daysLeft > 0 ? `${progress.daysLeft}d left` : 'Overdue'}
                </span>
              </div>

              {/* Status message */}
              <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginTop: '2px' }}>
                {statusObj.message}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
