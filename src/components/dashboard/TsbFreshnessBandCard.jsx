// src/components/dashboard/TsbFreshnessBandCard.jsx
//
// Dashboard card surfacing the Banister TSB (CTL−ATL) freshness band
// classification + 28-day TSB trend sparkline. Complements
// NMFreshnessCard (Skiba 2010 W' neuromuscular freshness) by covering
// systemic training-stress freshness, which has been shown as a raw
// TSB number elsewhere but never bucketed into actionable bands.
//
// Renders nothing when the log is empty (pure-fn returns null).

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { classifyTsbFreshness } from '../../lib/athlete/tsbFreshnessBand.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  VERY_FRESH:    '#5bc25b',
  FRESH:         '#5bc25b',
  NEUTRAL:       '#0064ff',
  FATIGUED:      '#ff9800',
  VERY_FATIGUED: '#cc0000',
}

const BAND_LABEL = {
  VERY_FRESH:    { en: 'VERY FRESH',    tr: 'ÇOK TAZE' },
  FRESH:         { en: 'FRESH',         tr: 'TAZE' },
  NEUTRAL:       { en: 'NEUTRAL',       tr: 'NÖTR' },
  FATIGUED:      { en: 'FATIGUED',      tr: 'YORGUN' },
  VERY_FATIGUED: { en: 'VERY FATIGUED', tr: 'ÇOK YORGUN' },
}

const TREND_ARROW = { rising: '↑', falling: '↓', stable: '→' }
const TREND_LABEL = {
  rising:  { en: 'rising',  tr: 'yükseliyor' },
  falling: { en: 'falling', tr: 'düşüyor' },
  stable:  { en: 'stable',  tr: 'sabit' },
}

// Sparkline geometry
const SPARK_W = 200
const SPARK_H = 36
const SPARK_PAD = 2

export default function TsbFreshnessBandCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(() => classifyTsbFreshness({ log }), [log])

  if (!result) return null

  const color = BAND_COLOR[result.band] || '#888'
  const bandLabel = (BAND_LABEL[result.band] || { en: result.band, tr: result.band })[isTR ? 'tr' : 'en']
  const trendLabel = (TREND_LABEL[result.trend7d] || { en: result.trend7d, tr: result.trend7d })[isTR ? 'tr' : 'en']
  const arrow = TREND_ARROW[result.trend7d] || '·'

  const heading = isTR ? 'TSB TAZELİK' : 'TSB FRESHNESS'
  const ariaLabel = isTR ? 'TSB tazelik bandı kartı' : 'TSB freshness band card'

  // Sparkline path
  const hist = Array.isArray(result.tsbHistory) ? result.tsbHistory : []
  const sparkPath = (() => {
    if (hist.length < 2) return null
    const vals = hist.map(p => p.tsb)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const innerW = SPARK_W - SPARK_PAD * 2
    const innerH = SPARK_H - SPARK_PAD * 2
    const step = hist.length > 1 ? innerW / (hist.length - 1) : 0
    return hist.map((p, i) => {
      const x = SPARK_PAD + i * step
      const y = SPARK_PAD + innerH - ((p.tsb - min) / range) * innerH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  })()

  // Zero line in sparkline coordinate space (if 0 falls inside the range)
  const zeroY = (() => {
    if (hist.length < 2) return null
    const vals = hist.map(p => p.tsb)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    if (0 < min || 0 > max) return null
    const range = max - min || 1
    const innerH = SPARK_H - SPARK_PAD * 2
    return SPARK_PAD + innerH - ((0 - min) / range) * innerH
  })()

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-tsb-freshness-band-card
      data-tsb-band={result.band}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{
          fontSize: 10, color: 'var(--muted, #888)',
          letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
        }}>
          {heading}
        </div>
        <div style={{
          fontSize: 9, color,
          border: `1px solid ${color}55`, borderRadius: 2,
          padding: '2px 8px', letterSpacing: '0.06em',
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          {bandLabel}
        </div>
      </div>

      {/* Big TSB value + trend arrow */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 44, fontWeight: 700, color, lineHeight: 1 }}>
          {result.currentTsb > 0 ? '+' : ''}{result.currentTsb}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)' }}>TSB</div>
        <div
          aria-label={isTR ? `7 günlük eğilim: ${trendLabel}` : `7-day trend: ${trendLabel}`}
          data-tsb-trend={result.trend7d}
          style={{
            marginLeft: 'auto', fontSize: 14, color,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700 }}>{arrow}</span>
          <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
            {isTR ? '7g' : '7d'} · {trendLabel}
          </span>
        </div>
      </div>

      {/* 28d sparkline */}
      {sparkPath ? (
        <div style={{ marginBottom: 8 }} data-tsb-sparkline>
          <svg
            width={SPARK_W}
            height={SPARK_H}
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            style={{ display: 'block', width: '100%', maxWidth: SPARK_W }}
            role="img"
            aria-label={isTR ? '28 günlük TSB eğilim grafiği' : '28-day TSB trend chart'}
          >
            {zeroY !== null ? (
              <line
                x1={SPARK_PAD} x2={SPARK_W - SPARK_PAD}
                y1={zeroY} y2={zeroY}
                stroke="var(--border, #333)" strokeWidth="1" strokeDasharray="2 3"
              />
            ) : null}
            <path d={sparkPath} fill="none" stroke={color} strokeWidth="1.5" />
          </svg>
          <div style={{ fontSize: 8, color: '#555', letterSpacing: '0.05em', marginTop: 2 }}>
            {isTR
              ? `${hist.length} gün · CTL − ATL günlük`
              : `${hist.length}d · daily CTL − ATL`}
          </div>
        </div>
      ) : null}

      {/* Citation footer */}
      <div style={{
        fontSize: 8, color: '#555',
        borderTop: '1px solid var(--border, #222)',
        paddingTop: 6, marginTop: 4, lineHeight: 1.5,
        fontStyle: 'italic',
      }}>
        {result.citation}
      </div>
    </div>
  )
}
