// src/components/dashboard/VdotProgressCard.jsx — E89
// SVG VDOT trend chart from training log. On-track/ahead/behind status vs goal trajectory.
// Suggests next 5K time trial every 12 weeks (Daniels 2014 calibration recommendation).
import { useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { detectVdotFromLog } from '../../lib/athlete/vdotTracker.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const BLUE   = '#4a90d9'
const DIM    = '#444'
const DIMMER = '#2a2a2a'

// Convert YYYY-MM-DD to day-of-year number for x-axis spacing
function daysSinceEpoch(dateStr) {
  return Math.floor(new Date(dateStr + 'T12:00:00Z').getTime() / 86_400_000)
}

// Generate expected VDOT trajectory: linear interpolation from startVdot→goalVdot over planWeeks
function expectedTrajectory(startVdot, goalVdot, planStartDate, planWeeks) {
  if (!startVdot || !goalVdot || !planStartDate || !planWeeks) return []
  const startDay = daysSinceEpoch(planStartDate)
  const endDay   = startDay + planWeeks * 7
  const points   = []
  for (let w = 0; w <= planWeeks; w += 4) {
    const t = w / planWeeks
    points.push({
      day:  startDay + w * 7,
      vdot: Math.round((startVdot + (goalVdot - startVdot) * t) * 10) / 10,
    })
  }
  if (points[points.length - 1]?.day !== endDay) {
    points.push({ day: endDay, vdot: goalVdot })
  }
  return points
}

// Miniature SVG trend chart
function VdotChart({ trend, expected, goalVdot, width = 280, height = 80 }) {
  const allVdots = [
    ...trend.map(p => p.vdot),
    ...expected.map(p => p.vdot),
  ]
  const allDays = [
    ...trend.map(p => daysSinceEpoch(p.date)),
    ...expected.map(p => p.day),
  ]
  if (!allVdots.length || !allDays.length) return null

  const minV  = Math.floor(Math.min(...allVdots) - 2)
  const maxV  = Math.ceil(Math.max(...allVdots, goalVdot || 0) + 2)
  const minD  = Math.min(...allDays)
  const maxD  = Math.max(...allDays)
  const rangeV = maxV - minV || 1
  const rangeD = maxD - minD || 1

  const pad = { top: 6, right: 8, bottom: 18, left: 28 }
  const w   = width  - pad.left - pad.right
  const h   = height - pad.top  - pad.bottom

  function px(day)  { return pad.left + ((day - minD) / rangeD) * w }
  function py(vdot) { return pad.top  + (1 - (vdot - minV) / rangeV) * h }

  // Build polyline points
  const trendPts = trend.map(p => `${px(daysSinceEpoch(p.date)).toFixed(1)},${py(p.vdot).toFixed(1)}`).join(' ')
  const expPts   = expected.map(p => `${px(p.day).toFixed(1)},${py(p.vdot).toFixed(1)}`).join(' ')

  const today    = new Date().toISOString().slice(0, 10)
  const todayX   = px(daysSinceEpoch(today))

  // Y-axis ticks at every 5 VDOT units
  const yTicks = []
  for (let v = Math.ceil(minV / 5) * 5; v <= maxV; v += 5) {
    yTicks.push(v)
  }

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid lines */}
      {yTicks.map(v => (
        <line key={v}
          x1={pad.left} x2={pad.left + w}
          y1={py(v)} y2={py(v)}
          stroke="#1a1a1a" strokeWidth="1"
        />
      ))}
      {/* Y-axis labels */}
      {yTicks.map(v => (
        <text key={v} x={pad.left - 4} y={py(v) + 3}
          textAnchor="end" fontSize="7" fill="#333" fontFamily={MONO}>{v}</text>
      ))}

      {/* Goal VDOT dashed line */}
      {goalVdot && (
        <line
          x1={pad.left} x2={pad.left + w}
          y1={py(goalVdot)} y2={py(goalVdot)}
          stroke={GREEN} strokeWidth="1" strokeDasharray="3,2" opacity="0.4"
        />
      )}

      {/* Expected trajectory (dashed) */}
      {expPts && (
        <polyline points={expPts} fill="none" stroke={BLUE} strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
      )}

      {/* Actual VDOT trend (solid) */}
      {trendPts && (
        <polyline points={trendPts} fill="none" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Data points */}
      {trend.map((p, i) => {
        const x = px(daysSinceEpoch(p.date))
        const y = py(p.vdot)
        return (
          <circle key={i} cx={x} cy={y} r={p.isRace ? 3.5 : 2}
            fill={p.isRace ? GREEN : ORANGE} opacity="0.9" />
        )
      })}

      {/* Today vertical line */}
      <line x1={todayX} x2={todayX} y1={pad.top} y2={pad.top + h}
        stroke="#333" strokeWidth="1" strokeDasharray="2,2" />

      {/* Legend */}
      <line x1={pad.left} x2={pad.left + 14} y1={height - 6} y2={height - 6}
        stroke={ORANGE} strokeWidth="1.5" />
      <text x={pad.left + 17} y={height - 3} fontSize="7" fill="#555" fontFamily={MONO}>actual</text>
      <line x1={pad.left + 50} x2={pad.left + 64} y1={height - 6} y2={height - 6}
        stroke={BLUE} strokeWidth="1" strokeDasharray="4,3" />
      <text x={pad.left + 67} y={height - 3} fontSize="7" fill="#555" fontFamily={MONO}>target</text>
    </svg>
  )
}

// Days since last race or 5K effort in the log
function daysSinceLastRealEffort(trend, today) {
  const races = [...trend].filter(t => t.isRace || t.distanceKm >= 5)
  if (!races.length) return Infinity
  const last = races.sort((a, b) => b.date.localeCompare(a.date))[0]
  return daysSinceEpoch(today) - daysSinceEpoch(last.date)
}

export default function VdotProgressCard({ log = [], profile = {}, isTR }) {
  const [saved] = useLocalStorage('sporeus-race-goal-v2', null)
  const today   = new Date().toISOString().slice(0, 10)

  const detected = useMemo(() => detectVdotFromLog(log, 365, today), [log, today])

  const analysis = useMemo(() => {
    if (!saved) return null
    const cSec = parseMmSs(saved.currentTime)
    const gSec = parseMmSs(saved.goalTime)
    return analyzeRaceGoal(cSec, gSec, saved.distM || 10000, profile || {}, log)
  }, [saved, profile, log])

  const expected = useMemo(() => {
    if (!analysis || !saved?.planStart) return []
    return expectedTrajectory(
      analysis.currentVdot,
      analysis.goalVdot,
      saved.planStart,
      analysis.weeksToGoal,
    )
  }, [analysis, saved])

  // Status: compare latest actual VDOT against expected trajectory at today's date
  const status = useMemo(() => {
    if (!detected || !expected.length || !analysis) return null
    const todayDay = daysSinceEpoch(today)
    // Find expected VDOT at today
    let expVdot = expected[0]?.vdot ?? analysis.currentVdot
    for (let i = 0; i < expected.length - 1; i++) {
      if (todayDay >= expected[i].day && todayDay <= expected[i + 1].day) {
        const t = (todayDay - expected[i].day) / (expected[i + 1].day - expected[i].day)
        expVdot = expected[i].vdot + t * (expected[i + 1].vdot - expected[i].vdot)
        break
      }
    }
    const delta = detected.vdot - expVdot
    if (delta > 1.5)  return { key: 'ahead',   en: `Ahead of schedule (+${delta.toFixed(1)} VDOT)`,  tr: `Programın önünde (+${delta.toFixed(1)} VDOT)`,  color: GREEN }
    if (delta < -1.5) return { key: 'behind',  en: `Behind schedule (${delta.toFixed(1)} VDOT)`,     tr: `Programın gerisinde (${delta.toFixed(1)} VDOT)`, color: RED   }
    return               { key: 'on-track', en: `On track (±${Math.abs(delta).toFixed(1)} VDOT)`,  tr: `Yolda (±${Math.abs(delta).toFixed(1)} VDOT)`,    color: BLUE  }
  }, [detected, expected, analysis, today])

  // 5K time trial suggestion: every 84 days (12 weeks) since last real effort
  const timetrial = useMemo(() => {
    if (!detected) return null
    const since = daysSinceLastRealEffort(detected.trend, today)
    if (since >= 84) return {
      en: `Time for a 5K test (${since} days since last effort — Daniels recommends every 12 weeks)`,
      tr: `5K test zamanı (son efordan bu yana ${since} gün — Daniels her 12 haftada tavsiye eder)`,
    }
    return null
  }, [detected, today])

  if (!detected && !analysis) return null

  const trend     = detected?.trend || []
  const goalVdot  = analysis?.goalVdot

  return (
    <div style={{ ...S.card, fontFamily: MONO }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'VDOT İLERLEME' : 'VDOT PROGRESS'}
        </div>
        {detected && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: ORANGE }}>{detected.vdot}</span>
            {goalVdot && (
              <span style={{ fontSize: '9px', color: DIM }}>→ {goalVdot}</span>
            )}
          </div>
        )}
      </div>

      {/* Status badge */}
      {status && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '8px', color: status.color, border: `1px solid ${status.color}44`, borderRadius: '2px', padding: '2px 6px' }}>
            {isTR ? status.tr : status.en}
          </span>
        </div>
      )}

      {/* SVG Chart */}
      {trend.length >= 2 ? (
        <div style={{ marginBottom: '10px', overflowX: 'auto' }}>
          <VdotChart trend={trend} expected={expected} goalVdot={goalVdot} />
        </div>
      ) : trend.length === 1 ? (
        <div style={{ fontSize: '9px', color: DIMMER, marginBottom: '10px' }}>
          {isTR
            ? `VDOT ${trend[0].vdot} — grafik için en az 2 koşu verisi gerekli.`
            : `VDOT ${trend[0].vdot} — log at least 2 runs with distance to show trend.`}
        </div>
      ) : (
        <div style={{ fontSize: '9px', color: DIMMER, marginBottom: '10px' }}>
          {isTR
            ? 'Mesafe verisi olan koşular kaydettiğinde VDOT trendi burada görünür.'
            : 'Log runs with distance data to see your VDOT trend.'}
        </div>
      )}

      {/* Candidate count */}
      {detected?.candidateCount > 0 && (
        <div style={{ fontSize: '8px', color: DIMMER, marginBottom: '6px' }}>
          {isTR
            ? `${detected.candidateCount} kayıttan tahmin edildi · ${detected.date} · ${detected.confidence.toUpperCase()} güven`
            : `Estimated from ${detected.candidateCount} log entries · ${detected.date} · ${detected.confidence.toUpperCase()} confidence`}
        </div>
      )}

      {/* 5K time trial suggestion */}
      {timetrial && (
        <div style={{ fontSize: '8px', color: AMBER, padding: '4px 7px', background: '#1a1000', borderRadius: '3px', borderLeft: `2px solid ${AMBER}`, marginBottom: '6px', lineHeight: 1.5 }}>
          ⏱ {isTR ? timetrial.tr : timetrial.en}
        </div>
      )}

      {/* Checkpoints from goal analysis */}
      {analysis?.checkpoints?.length > 0 && (
        <div>
          <div style={{ fontSize: '8px', color: DIMMER, letterSpacing: '0.08em', marginBottom: '4px' }}>
            {isTR ? 'KONTROL NOKTALARI' : 'CHECKPOINTS'}
          </div>
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {analysis.checkpoints.map((cp, i) => {
              const reached = detected?.vdot >= cp.vdot - 0.5
              return (
                <div key={i} style={{
                  fontSize: '7px', padding: '2px 5px',
                  background: '#0a0a0a', borderRadius: '2px',
                  border: `1px solid ${reached ? GREEN : '#1a1a1a'}`,
                  color: reached ? GREEN : '#333',
                }}>
                  W{cp.week} · {cp.vdot}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
