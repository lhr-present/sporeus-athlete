// ─── ConsistencyTrendCard.jsx — E24: 8-week rolling consistency trend ─────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeConsistencyTrend } from '../../lib/athlete/consistencyTrend.js'

// ─── Tier palette ─────────────────────────────────────────────────────────────
const TIER_COLOR = {
  excellent: '#5bc25b',
  good:      '#0064ff',
  fair:      '#f5c542',
  poor:      '#e03030',
}

// ─── Chart constants ──────────────────────────────────────────────────────────
const SVG_W   = 220
const SVG_H   = 50
const PAD_B   = 0
const CHART_H = SVG_H - PAD_B
const MAX_BARS = 8

export default function ConsistencyTrendCard({ log = [] }) {
  const { t } = useContext(LangCtx)

  const trend = computeConsistencyTrend(log)
  if (!trend) return null

  const { weeks, currentScore, currentTier, trendSlope, improving, streak, citation } = trend

  // ── Tier label key ──────────────────────────────────────────────────────────
  const tierKey = {
    excellent: 'consistencyExcellent',
    good:      'consistencyGood',
    fair:      'consistencyFair',
    poor:      'consistencyPoor',
  }[currentTier] || 'consistencyFair'

  // ── Trend badge ─────────────────────────────────────────────────────────────
  const trendBadge = (() => {
    if (!trendSlope) return { label: '→ STABLE', color: '#888' }
    if (trendSlope.slope > 0.5)  return { label: '↑ IMPROVING', color: '#5bc25b' }
    if (trendSlope.slope < -0.5) return { label: '↓ DECLINING', color: '#e03030' }
    return { label: '→ STABLE', color: '#888' }
  })()

  // ── SVG bar chart ───────────────────────────────────────────────────────────
  const n      = weeks.length
  const barW   = n > 0 ? Math.floor((SVG_W - 4) / n) - 2 : 20
  const barGap = n > 0 ? Math.floor((SVG_W - 4) / n) : 22

  // Midpoints for trend line
  const midpoints = weeks.map((wk, i) => {
    const barH  = Math.max(2, Math.round((wk.score / 100) * CHART_H))
    const x     = 2 + i * barGap + barW / 2
    const y     = CHART_H - barH
    return { x, y }
  })

  const trendPath = midpoints.length >= 2
    ? 'M' + midpoints.map(p => `${p.x},${p.y}`).join(' L')
    : null

  return (
    <div className="sp-card" style={{ ...S.card }}>
      {/* ── Title row ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6600' }}>
          ◈ {t('consistencyTitle')}
        </div>
        {/* Trend badge */}
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '2px 7px', borderRadius: '2px',
          color: trendBadge.color,
          border: `1px solid ${trendBadge.color}44`,
          background: `${trendBadge.color}11`,
        }}>
          {trendBadge.label}
        </span>
      </div>

      {/* ── Score + tier badge ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '36px', fontWeight: 700,
          color: TIER_COLOR[currentTier] || '#888',
          lineHeight: 1,
        }}>
          {currentScore}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
            padding: '2px 8px', borderRadius: '2px',
            color: TIER_COLOR[currentTier] || '#888',
            border: `1px solid ${TIER_COLOR[currentTier] || '#888'}55`,
            background: `${TIER_COLOR[currentTier] || '#888'}15`,
            textTransform: 'uppercase',
          }}>
            {t(tierKey)}
          </span>
          {streak >= 2 && (
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '9px', color: '#5bc25b', letterSpacing: '0.06em',
            }}>
              {streak}-{t('consistencyStreak')}
            </span>
          )}
        </div>
      </div>

      {/* ── 8-bar SVG chart ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '10px' }}>
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-label="8-week consistency chart"
          style={{ overflow: 'visible', display: 'block' }}
        >
          {/* Bars */}
          {weeks.map((wk, i) => {
            const barH = Math.max(2, Math.round((wk.score / 100) * CHART_H))
            const x    = 2 + i * barGap
            const y    = CHART_H - barH
            return (
              <rect
                key={wk.isoWeek}
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={TIER_COLOR[wk.tier] || '#333'}
                opacity={0.85}
                rx={1}
              />
            )
          })}
          {/* Trend line overlay */}
          {trendPath && (
            <path
              d={trendPath}
              fill="none"
              stroke="#ff6600"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          )}
        </svg>
      </div>

      {/* ── Citation ─────────────────────────────────────────────────────────── */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.04em',
        borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px',
      }}>
        {citation}
      </div>
    </div>
  )
}
