// ─── WorkoutDeviationCard.jsx — 28-day actual vs planned TSS adherence ───────
//
// Surfaces `computeWorkoutDeviation` (Foster 2001; Hopkins 2002): a rolling
// 28-day actual/planned TSS ratio with bands (EXCELLENT / GOOD / MODERATE /
// POOR / SURPLUS). Distinct from PlanAdherenceCard: that card buckets
// week-by-week and caps weekly compliance at 150%; this one is a single
// rolling-window adherence number with science-grade bands.
//
// Renders nothing when the pure-fn returns null (no plan, no log in window,
// or planned TSS = 0).
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeWorkoutDeviation } from '../../lib/athlete/workoutDeviation.js'

const MONO = "'IBM Plex Mono', monospace"

// Bloomberg-terminal palette consistent with other dashboard cards.
const BAND_COLOR = {
  EXCELLENT: '#5bc25b',  // green
  GOOD:      '#0064ff',  // blue
  MODERATE:  '#ff9933',  // orange
  SURPLUS:   '#ff9933',  // orange (same severity tier as MODERATE)
  POOR:      '#e03030',  // red
}

const BAND_LABEL_EN = {
  EXCELLENT: 'EXCELLENT',
  GOOD:      'GOOD',
  MODERATE:  'MODERATE',
  SURPLUS:   'SURPLUS',
  POOR:      'POOR',
}
const BAND_LABEL_TR = {
  EXCELLENT: 'MÜKEMMEL',
  GOOD:      'İYİ',
  MODERATE:  'ORTA',
  SURPLUS:   'FAZLA',
  POOR:      'ZAYIF',
}

function todayISO() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function WorkoutDeviationCard({ log, plan }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => computeWorkoutDeviation({ log, plan, today: todayISO(), windowDays: 28 }),
    [log, plan],
  )

  if (!result) return null

  const { actualTss, plannedTss, adherencePct, band, daysCounted, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const heading = isTR ? '28G UYUM' : '28D ADHERENCE'
  const ariaLabel = isTR
    ? '28 günlük antrenman uyum kartı'
    : '28-day workout adherence card'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-workout-deviation-card
      data-adherence-band={band}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Heading */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: color,
        }}>
          ◈ {heading}
        </div>
        <span
          data-band-label
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: color,
            border: `1px solid ${color}55`,
            padding: '2px 7px',
            borderRadius: 2,
            letterSpacing: '0.06em',
            fontWeight: 700,
          }}
        >
          {bandLabel}
        </span>
      </div>

      {/* Big adherence percent */}
      <div style={{ marginBottom: 8 }}>
        <span
          data-adherence-pct
          style={{
            fontFamily: MONO,
            fontSize: 32,
            fontWeight: 700,
            color: color,
            letterSpacing: '-0.02em',
          }}
        >
          {adherencePct}%
        </span>
        <span style={{
          fontFamily: MONO,
          fontSize: 9,
          color: 'var(--muted, #888)',
          marginLeft: 8,
          letterSpacing: '0.06em',
        }}>
          {isTR ? 'PLANIN' : 'OF PLAN'}
        </span>
      </div>

      {/* Stats row */}
      <div style={{
        fontFamily: MONO,
        fontSize: 10,
        color: 'var(--muted, #888)',
        letterSpacing: '0.04em',
        marginBottom: 8,
        lineHeight: 1.6,
      }}>
        <div>
          <span style={{ color: 'var(--text, #ccc)' }}>{actualTss}</span>
          {' '}{isTR ? 'gerçek TSS' : 'actual TSS'}
          {' · '}
          <span style={{ color: 'var(--text, #ccc)' }}>{plannedTss}</span>
          {' '}{isTR ? 'planlanan TSS' : 'planned TSS'}
        </div>
        <div>
          <span style={{ color: 'var(--text, #ccc)' }}>{daysCounted}</span>
          {' '}{isTR ? 'gün sayıldı (28 gün penceresi)' : 'days counted (28d window)'}
        </div>
      </div>

      {/* Citation footer */}
      <div style={{
        fontFamily: MONO,
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
        borderTop: '1px solid var(--border, #222)',
        paddingTop: 6,
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(WorkoutDeviationCard)
