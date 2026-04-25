// ─── InjuryForecastCard.jsx — 8-week rolling injury risk + 4-week projection ──
// E22: Malone 2017, Gabbett 2016, Hulin 2016
// ─────────────────────────────────────────────────────────────────────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeInjuryForecast } from '../../lib/athlete/injuryForecast.js'

const BAND_COLORS = {
  low:      '#5bc25b',
  moderate: '#f5c542',
  high:     '#e03030',
}

const SVG_W   = 260
const SVG_H   = 60
const BAR_W   = 14
const BAR_GAP = 6
const TOTAL_BARS = 12
const PAD_LEFT   = 8

export default function InjuryForecastCard({ log = [], recovery = [] }) {
  const { t } = useContext(LangCtx)

  const data = computeInjuryForecast(log, recovery)

  // Return null if insufficient data
  if (!data) return null

  const { history, forecast, topFactor, citation } = data

  // Combine bars: 8 history + 4 forecast
  const allBars = [...history, ...forecast]

  // X position for each bar
  const barX = (i) => PAD_LEFT + i * (BAR_W + BAR_GAP)

  // Divider X: between bar 7 (index 7) and bar 8 (index 8)
  const dividerX = barX(8) - BAR_GAP / 2

  return (
    <div
      className="sp-card"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
      }}
    >
      {/* Title */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#ff6600',
        marginBottom: '12px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '8px',
      }}>
        ◈ {t('injuryForecastTitle')}
      </div>

      {/* 12-bar SVG chart */}
      <svg
        width={SVG_W}
        height={SVG_H + 18}
        style={{ display: 'block', overflow: 'visible', marginBottom: '10px' }}
        aria-label="Injury risk forecast chart"
      >
        {/* Bars */}
        {allBars.map((bar, i) => {
          const color = BAND_COLORS[bar.band] || '#888'
          const isProjected = !!bar.projected
          const maxScore = 100
          const barHeight = Math.max(2, Math.round((bar.score / maxScore) * (SVG_H - 4)))
          const x = barX(i)
          const y = SVG_H - barHeight

          return (
            <rect
              key={bar.isoWeek + (isProjected ? '-proj' : '')}
              x={x}
              y={y}
              width={BAR_W}
              height={barHeight}
              fill={color}
              opacity={isProjected ? 0.5 : 1}
              rx={2}
            />
          )
        })}

        {/* Vertical divider between history and forecast */}
        <line
          x1={dividerX}
          y1={0}
          x2={dividerX}
          y2={SVG_H}
          stroke="var(--muted)"
          strokeWidth="1"
          strokeDasharray="3,2"
        />

        {/* Forecast label below divider */}
        <text
          x={dividerX + 2}
          y={SVG_H + 12}
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="7"
          fill="var(--muted)"
          letterSpacing="0.04em"
        >
          {t('injuryForecastLabel')} →
        </text>
      </svg>

      {/* Band legend */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '10px',
        flexWrap: 'wrap',
      }}>
        {(['low', 'moderate', 'high']).map(band => (
          <span key={band} style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: BAND_COLORS[band],
          }}>
            ■ {t('injury' + band.charAt(0).toUpperCase() + band.slice(1))}
          </span>
        ))}
      </div>

      {/* Top risk factor callout */}
      {topFactor && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          marginBottom: '8px',
          lineHeight: 1.5,
        }}>
          <span style={{ color: '#888', marginRight: '4px' }}>{t('injuryTopFactor')}:</span>
          {topFactor.label}
        </div>
      )}

      {/* Citation */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '8px',
        color: '#555',
        letterSpacing: '0.04em',
      }}>
        {citation}
      </div>
    </div>
  )
}
