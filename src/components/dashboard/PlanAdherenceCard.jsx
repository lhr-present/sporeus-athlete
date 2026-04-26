// ─── dashboard/PlanAdherenceCard.jsx — E32: Plan Adherence Tracker ───────────
// Shows week-by-week planned vs actual TSS compliance as an 8-bar SVG chart
// with a 100% planned baseline line.
import { memo, useMemo, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeAdherenceSummary } from '../../lib/athlete/planAdherence.js'

const STATUS_COLOR = {
  on_track: '#5bc25b',
  over:     '#0064ff',
  under:    '#e03030',
  unknown:  '#333',
}

function PlanAdherenceCard({ plan, planStatus, log }) {
  const { t, lang: _lang } = useContext(LangCtx)

  const summary = useMemo(
    () => computeAdherenceSummary(plan, planStatus, log),
    [plan, planStatus, log],
  )

  if (!summary) return null

  const { adherenceWeeks, avgCompliance, overallStatus, weeksOnTrack, weeksOver, weeksUnder } = summary

  const overallColor = STATUS_COLOR[overallStatus] || '#555'
  const overallLabel = overallStatus === 'on_track'
    ? t('adherenceOnTrack')
    : overallStatus === 'over'
    ? t('adherenceOver')
    : overallStatus === 'under'
    ? t('adherenceUnder')
    : '—'

  // ── SVG chart ──────────────────────────────────────────────────────────────
  const SVG_W    = 220
  const SVG_H    = 50
  const chartH   = 42
  const chartTop = 4
  const n        = adherenceWeeks.length
  const barW     = n > 0 ? Math.floor((SVG_W - (n - 1) * 2) / n) : 20
  const gap      = 2
  const baseline = chartTop + chartH - Math.round(100 / 150 * chartH)  // y-coordinate for 100%

  const bars = adherenceWeeks.map((w, i) => {
    const compliance = w.compliance ?? 0
    const h = Math.max(2, Math.round(compliance / 150 * chartH))
    const x = i * (barW + gap)
    const y = chartTop + chartH - h
    return { x, y, h, color: STATUS_COLOR[w.status] || '#333' }
  })

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '24ms', borderLeft: '3px solid #ff660044' }}>
      {/* Title + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ ...S.cardTitle, color: '#ff6600' }}>
          ◈ {t('adherenceTitle')}
        </div>
        {overallStatus && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            color: overallColor,
            border: `1px solid ${overallColor}44`,
            padding: '2px 7px',
            borderRadius: '2px',
            letterSpacing: '0.06em',
          }}>
            {overallLabel}
          </span>
        )}
      </div>

      {/* Average compliance — large number */}
      <div style={{ marginBottom: '10px' }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '28px',
          fontWeight: 700,
          color: overallColor,
          letterSpacing: '-0.02em',
        }}>
          {avgCompliance !== null ? `${avgCompliance}%` : '—'}
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          color: '#555',
          marginLeft: '6px',
          letterSpacing: '0.06em',
        }}>
          {t('adherenceAvg')}
        </span>
      </div>

      {/* 8-bar SVG with 100% baseline */}
      <svg
        width={SVG_W}
        height={SVG_H}
        style={{ display: 'block', overflow: 'visible', marginBottom: '6px' }}
      >
        {/* bars */}
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={barW}
            height={b.h}
            fill={b.color}
            rx="1"
          />
        ))}
        {/* 100% planned baseline */}
        <line
          x1={0}
          y1={baseline}
          x2={n > 0 ? (n - 1) * (barW + gap) + barW : SVG_W}
          y2={baseline}
          stroke="#555"
          strokeWidth="1"
          strokeDasharray="3,2"
        />
      </svg>

      {/* Stats row */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px',
        color: '#555',
        letterSpacing: '0.04em',
      }}>
        <span style={{ color: STATUS_COLOR.on_track }}>{weeksOnTrack}</span>
        {' '}{t('adherenceOnTrack').toLowerCase()}
        {' · '}
        <span style={{ color: STATUS_COLOR.over }}>{weeksOver}</span>
        {' '}{t('adherenceOver').toLowerCase()}
        {' · '}
        <span style={{ color: STATUS_COLOR.under }}>{weeksUnder}</span>
        {' '}{t('adherenceUnder').toLowerCase()}
      </div>
    </div>
  )
}

export default memo(PlanAdherenceCard)
