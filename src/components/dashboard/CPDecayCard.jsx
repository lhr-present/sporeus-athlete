// src/components/dashboard/CPDecayCard.jsx
// E19 — Critical Power Decay Index dashboard card.
// Shows CP trend, slope badge, W' status, sparkline and recommendation.
//
// Sources:
//   Poole D.C. et al. (2016) Med Sci Sports Exerc 48(11):2320–2334
//   Vanhatalo A., Jones A.M., Burnley M. (2011) IJSPP 6(1):128–136

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeCPDecayIndex, cpTrendSparkline } from '../../lib/science/cpDecay.js'

const CLASS_COLOR = {
  building:          '#5bc25b',
  maintaining:       '#ff6600',
  detraining:        '#e03030',
  insufficient_data: '#555',
}

const WPRIME_COLOR = {
  expanding:   '#5bc25b',
  stable:      '#f5c542',
  contracting: '#e03030',
}

export default function CPDecayCard({ testResults = [] }) {
  const { t, lang } = useContext(LangCtx)

  const result = useMemo(
    () => computeCPDecayIndex(testResults),
    [testResults]
  )

  const sparkData = useMemo(
    () => cpTrendSparkline(result.history, 12),
    [result.history]
  )

  // Only render when we have meaningful data (at least 2 history entries)
  if (!result.history || result.history.length < 2) return null

  const { slope_w_per_week, cpCurrent, classification, wPrimeStatus, recommendation, citation } = result
  const classColor = CLASS_COLOR[classification] || '#555'

  // Slope badge text
  const slopeBadge = (() => {
    if (slope_w_per_week === null) return null
    const sign  = slope_w_per_week >= 0 ? '+' : '−'
    const abs   = Math.abs(slope_w_per_week).toFixed(1)
    return `${sign}${abs} W/wk`
  })()
  const slopeColor = slope_w_per_week > 0 ? '#5bc25b' : slope_w_per_week < 0 ? '#e03030' : '#888'

  // Classification label
  const classKey = {
    building:          'cpBuilding',
    maintaining:       'cpMaintaining',
    detraining:        'cpDetraining',
    insufficient_data: 'cpDetraining',
  }[classification]
  const classLabel = t(classKey) || classification

  // W' status label + color
  const wPrimeLabel = wPrimeStatus
    ? (t({ expanding: 'cpExpanding', stable: 'cpStable', contracting: 'cpContracting' }[wPrimeStatus]) || wPrimeStatus)
    : null

  // Sparkline geometry (200×40 SVG)
  const SVG_W = 200
  const SVG_H = 40
  const PAD   = 4
  const sparkline = (() => {
    if (sparkData.length < 2) return null
    const vals  = sparkData.map(h => h.cp)
    const minV  = Math.min(...vals)
    const maxV  = Math.max(...vals)
    const range = maxV - minV || 1
    const pts   = vals.map((v, i) => {
      const x = PAD + i * (SVG_W - 2 * PAD) / Math.max(vals.length - 1, 1)
      const y = SVG_H - PAD - (v - minV) / range * (SVG_H - 2 * PAD)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    return pts
  })()

  // Recommendation text (lang-aware)
  const recText = recommendation
    ? (recommendation[lang] || recommendation.en)
    : null

  return (
    <div
      className="sp-card"
      style={{ ...S.card, animationDelay: '196ms', borderLeft: `3px solid ${classColor}` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={S.cardTitle}>{t('cpDecay') || 'Critical Power Trend'}</div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>Poole 2016</div>
      </div>

      {/* Big CP value + slope badge */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '10px' }}>
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '36px',
            fontWeight: 700,
            color: '#ff6600',
            lineHeight: 1,
          }}>
            {cpCurrent != null ? Math.round(cpCurrent) : '—'}
            <span style={{ fontSize: '14px', fontWeight: 400, color: '#888', marginLeft: '3px' }}>W</span>
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginTop: '3px' }}>
            {lang === 'tr' ? 'Kritik Güç (mevcut)' : 'Critical Power (current)'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {slopeBadge && (
            <span style={{
              ...S.mono,
              fontSize: '11px',
              fontWeight: 700,
              color: slopeColor,
              border: `1px solid ${slopeColor}44`,
              padding: '2px 6px',
              borderRadius: '2px',
            }}>
              {slopeBadge}
            </span>
          )}
          <span style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 600,
            color: classColor,
            border: `1px solid ${classColor}44`,
            padding: '2px 6px',
            borderRadius: '2px',
          }}>
            {classLabel}
          </span>
        </div>
      </div>

      {/* W' status */}
      {wPrimeStatus && wPrimeLabel && (
        <div style={{ ...S.mono, fontSize: '10px', marginBottom: '8px', color: '#888' }}>
          {t('cpWPrimeStatus') || "W' Status"}:{' '}
          <span style={{ color: WPRIME_COLOR[wPrimeStatus], fontWeight: 600 }}>
            {wPrimeLabel}
          </span>
        </div>
      )}

      {/* Sparkline */}
      {sparkline && (
        <div style={{ marginBottom: '8px' }}>
          <svg
            width={SVG_W}
            height={SVG_H}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <polyline
              points={sparkline}
              fill="none"
              stroke="#ff6600"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {sparkData.map((h, i) => {
              const vals = sparkData.map(d => d.cp)
              const minV = Math.min(...vals)
              const maxV = Math.max(...vals)
              const range = maxV - minV || 1
              const x = PAD + i * (SVG_W - 2 * PAD) / Math.max(vals.length - 1, 1)
              const y = SVG_H - PAD - (h.cp - minV) / range * (SVG_H - 2 * PAD)
              return (
                <circle
                  key={i}
                  cx={x.toFixed(1)}
                  cy={y.toFixed(1)}
                  r="2"
                  fill="#ff6600"
                />
              )
            })}
          </svg>
        </div>
      )}

      {/* Recommendation */}
      {recText && (
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '6px' }}>
          <span style={{ color: '#555', marginRight: '4px' }}>{t('cpRecommendation') || 'Recommendation'}:</span>
          {recText}
        </div>
      )}

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '8px', color: '#333', marginTop: '4px' }}>
        {citation}
      </div>
    </div>
  )
}
