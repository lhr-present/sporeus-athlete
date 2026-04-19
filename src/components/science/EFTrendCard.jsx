// src/components/science/EFTrendCard.jsx
// E12 — 30-day Efficiency Factor trend card.
// Shows EF sparkline, trend direction arrow, CV%, and session count.
// Based on Coggan (2003) aerobic adaptation benchmark.

import { useMemo } from 'react'
import { useLanguage } from '../../contexts/LangCtx.jsx'
import { computeEF, efTrend } from '../../lib/science/efficiencyFactor.js'
import { EFTrendExplainer } from './MetricExplainerDecoupling.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const TREND_ARROW = { improving: '↑', stable: '→', declining: '↓' }
const TREND_COLOR = { improving: '#00cc44', stable: 'var(--muted)', declining: '#cc3300' }

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, width = 120, height = 32, color = '#0064ff' }) {
  if (!values || values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last value dot */}
      {(() => {
        const last = values[values.length - 1]
        const x = width
        const y = height - ((last - min) / range) * height
        return <circle cx={x} cy={y} r={2.5} fill={color} />
      })()}
    </svg>
  )
}

// ── EFTrendCard ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Object[]} props.sessions   - Training sessions (same shape as computeEF input + `date`)
 * @param {number}   [props.windowDays=30] - Rolling window for trend analysis
 */
export default function EFTrendCard({ sessions, windowDays = 30 }) {
  const { lang } = useLanguage()

  const result = useMemo(() => efTrend(sessions, windowDays), [sessions, windowDays])

  const latestEF = useMemo(() => {
    if (!Array.isArray(sessions) || sessions.length === 0) return null
    const sorted = [...sessions].sort((a, b) => (a.date ?? '') > (b.date ?? '') ? -1 : 1)
    for (const s of sorted) {
      const ef = computeEF(s)
      if (ef) return ef.ef
    }
    return null
  }, [sessions])

  const trendColor = result ? TREND_COLOR[result.trend] : 'var(--muted)'
  const arrow      = result ? TREND_ARROW[result.trend] : '—'

  const TREND_LABEL = {
    en: { improving: 'Improving', stable: 'Stable', declining: 'Declining' },
    tr: { improving: 'İyileşiyor', stable: 'Stabil', declining: 'Geriliyor' },
  }

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      minWidth: 180,
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
          {lang === 'tr' ? 'VF Trendi' : 'EF Trend'}
        </span>
        <EFTrendExplainer
          trend={result?.trend}
          changePercent={result?.changePercent}
        />
      </div>

      {result ? (
        <>
          {/* Trend arrow + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: '1.4rem', lineHeight: 1, color: trendColor, fontWeight: 700 }}>
              {arrow}
            </span>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: trendColor }}>
                {TREND_LABEL[lang]?.[result.trend] ?? TREND_LABEL.en[result.trend]}
              </div>
              <div style={{ fontSize: '0.70rem', color: 'var(--muted)' }}>
                {result.changePercent > 0 ? '+' : ''}{result.changePercent.toFixed(1)}%{' '}
                {lang === 'tr' ? `(${windowDays}g)` : `(${windowDays}d)`}
              </div>
            </div>
          </div>

          {/* Sparkline */}
          <div style={{ marginBottom: 6 }}>
            <Sparkline
              values={result.efValues}
              color={trendColor}
              width={150}
              height={36}
            />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--muted)' }}>
            {latestEF != null && (
              <span>
                <span style={{ color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>
                  {latestEF.toFixed(3)}
                </span>{' '}
                {lang === 'tr' ? 'son' : 'latest'}
              </span>
            )}
            <span>
              <span style={{ color: 'var(--text)' }}>{(result.cv * 100).toFixed(1)}%</span>{' '}
              CV
            </span>
            <span>
              <span style={{ color: 'var(--text)' }}>n={result.sessionsN}</span>
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', paddingTop: 4 }}>
          {lang === 'tr'
            ? `Trend için ${windowDays} günde en az 8 antrenman gerekli`
            : `Need ≥8 sessions in ${windowDays}d for trend`}
        </div>
      )}

      {/* Citation */}
      <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 4, fontStyle: 'italic' }}>
        Coggan A.R. (2003) Training &amp; Racing with a Power Meter
      </div>
    </div>
  )
}
