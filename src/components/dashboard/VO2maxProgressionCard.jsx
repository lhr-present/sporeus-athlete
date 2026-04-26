// ─── VO2maxProgressionCard.jsx ────────────────────────────────────────────────
// E29: 8-week VO2max trend from running sessions with HR data.
// Daniels 2013 · Lucia 2002

import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeVO2maxProgression } from '../../lib/athlete/vo2maxProgression.js'

const FONT = 'IBM Plex Mono, monospace'

export default function VO2maxProgressionCard({ log, profile }) {
  const { t, lang: _lang } = useContext(LangCtx)

  const result = computeVO2maxProgression(log, profile)
  if (!result) {
    return (
      <div className="sp-card" style={S.card}>
        <div style={S.cardTitle}>
          <span style={{ color: '#ff6600' }}>◈ </span>
          {t('vo2maxProgTitle')}
        </div>
        <div style={{ fontFamily: FONT, fontSize: '12px', color: '#555' }}>
          {t('vo2maxProgNeeded')}
        </div>
      </div>
    )
  }

  const { history, trend, currentVO2max, maxHR: _maxHR, citation } = result

  // ── Trend badge ──────────────────────────────────────────────────────────────
  let trendSymbol = '→'
  let trendLabel  = t('vo2maxProgStable')
  let trendColor  = '#888'
  if (trend) {
    if (trend.improving) {
      trendSymbol = '↑'
      trendLabel  = t('vo2maxProgImproving')
      trendColor  = '#5bc25b'
    } else if (trend.slope < -0.1) {
      trendSymbol = '↓'
      trendLabel  = t('vo2maxProgDeclining')
      trendColor  = '#e03030'
    }
  }

  // ── 8-bar SVG chart ──────────────────────────────────────────────────────────
  // Color bars: above or equal running mean → green, below → red
  const chartW  = 200
  const chartH  = 50
  const bars    = history.slice(-8)
  const n       = bars.length
  const values  = bars.map(h => h.vo2max)

  const minV = Math.min(...values) - 1
  const maxV = Math.max(...values) + 1
  const range = maxV - minV || 1

  // Running mean for coloring
  const barColors = values.map((v, i) => {
    const slice = values.slice(0, i + 1)
    const runMean = slice.reduce((a, b) => a + b, 0) / slice.length
    return v >= runMean ? '#5bc25b' : '#e03030'
  })

  const barW   = n > 0 ? Math.floor((chartW - (n - 1) * 2) / n) : 0
  const svgBars = bars.map((b, i) => {
    const barH = Math.max(2, Math.round(((b.vo2max - minV) / range) * (chartH - 4)))
    const x    = i * (barW + 2)
    const y    = chartH - barH
    return (
      <rect
        key={b.date || i}
        x={x}
        y={y}
        width={barW}
        height={barH}
        fill={barColors[i]}
        rx="1"
      />
    )
  })

  return (
    <div className="sp-card" style={S.card}>
      {/* Title */}
      <div style={S.cardTitle}>
        <span style={{ color: '#ff6600' }}>◈ </span>
        {t('vo2maxProgTitle')}
      </div>

      {/* Current VO2max + trend badge */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <span style={{ fontFamily: FONT, fontSize: '28px', fontWeight: 700, color: '#5bc25b', lineHeight: 1 }}>
          {currentVO2max}
        </span>
        <span style={{ fontFamily: FONT, fontSize: '11px', color: '#888' }}>
          mL/kg/min
        </span>
        <span style={{ fontFamily: FONT, fontSize: '12px', fontWeight: 700, color: trendColor, marginLeft: '4px' }}>
          {trendSymbol} {trendLabel}
        </span>
      </div>

      {/* Weekly gain */}
      {trend && (
        <div style={{ fontFamily: FONT, fontSize: '11px', color: '#888', marginBottom: '10px' }}>
          {trend.weeklyGain >= 0 ? '+' : ''}{trend.weeklyGain.toFixed(2)}/wk
        </div>
      )}

      {/* SVG bar chart */}
      {n > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <svg
            width={chartW}
            height={chartH}
            style={{ display: 'block', overflow: 'visible' }}
            aria-label="VO2max trend chart"
          >
            {svgBars}
          </svg>
        </div>
      )}

      {/* R² low confidence warning */}
      {trend && trend.r2 < 0.3 && (
        <div style={{ fontFamily: FONT, fontSize: '11px', color: '#555', marginBottom: '6px' }}>
          {t('vo2maxProgLowConf')} (R²={trend.r2.toFixed(2)})
        </div>
      )}

      {/* Citation */}
      <div style={{ fontFamily: FONT, fontSize: '10px', color: '#555', marginTop: '4px' }}>
        {citation}
      </div>
    </div>
  )
}
