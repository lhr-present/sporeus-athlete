// ─── MonotonyTrendCard.jsx — 4-week monotony / Foster strain trend ───────────
//
// Surfaces `computeMonotonyTrend` (a thin wrapper around the existing
// `computeMonotony` pure-fn from src/lib/trainingLoad.js, Foster 1998;
// Foster 2001).
//
// Why this card exists:
//   `computeMonotony` already powers a one-line TodayView warning, but
//   no card has surfaced the 28-day MONOTONY TREND. Monotony rises
//   BEFORE Foster strain peaks — a rolling 4-week chip strip gives the
//   athlete an earlier visual signal that they are sliding toward an
//   overreaching/overtraining regime than waiting for a strain alarm.
//
// Bands (Foster 1998; Foster 2001):
//   LOW       (<1.5)        — green, healthy day-to-day variance
//   MODERATE  (1.5–1.99)    — blue,  acceptable, watch the trend
//   HIGH      (2.0–2.5)     — orange, early warning band
//   VERY_HIGH (>2.5)        — red,   recovery day required

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeMonotonyTrend } from '../../lib/athlete/monotonyTrend.js'

const MONO = "'IBM Plex Mono', monospace"

// Bloomberg-terminal palette (green / blue / orange / red).
const BAND_COLOR = {
  LOW:       '#5bc25b', // green
  MODERATE:  '#0064ff', // blue
  HIGH:      '#ff6600', // orange
  VERY_HIGH: '#e03030', // red
}

const BAND_LABEL_EN = {
  LOW:       'LOW',
  MODERATE:  'MODERATE',
  HIGH:      'HIGH',
  VERY_HIGH: 'VERY HIGH',
}
const BAND_LABEL_TR = {
  LOW:       'DÜŞÜK',
  MODERATE:  'ORTA',
  HIGH:      'YÜKSEK',
  VERY_HIGH: 'ÇOK YÜKSEK',
}

export default function MonotonyTrendCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const trend = useMemo(() => computeMonotonyTrend({ log }), [log])

  if (!trend) return null

  const { trend: weeks, latest, band, citation } = trend
  const color = BAND_COLOR[band] || '#888888'
  const bandLabel = isTR
    ? (BAND_LABEL_TR[band] || '—')
    : (BAND_LABEL_EN[band] || '—')

  const title    = isTR ? 'MONOTONLUK · 4H TRENDİ' : 'MONOTONY · 4W TREND'
  const ariaLbl  = isTR ? 'Monotonluk 4 haftalık trendi' : 'Monotony 4-week trend'
  const latestLbl = isTR ? 'Son hafta' : 'Latest'
  const strainLbl = isTR ? 'gerilim' : 'strain'
  const blurb    = isTR
    ? 'Yüksek monotonluk: günlük yükler birbirine çok benziyor — toparlanma günü gerekli.'
    : 'High monotony: daily loads look too similar — a recovery day is overdue.'

  return (
    <div
      role="region"
      aria-label={ariaLbl}
      data-monotony-trend-card
      data-monotony-band={band || 'NULL'}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 700 }}>
          <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-monotony-band-chip
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            padding: '2px 8px', borderRadius: 3,
            background: `${color}22`, color, border: `1px solid ${color}`,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Latest value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <div
          data-monotony-latest
          style={{ fontSize: 32, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}
        >
          {latest !== null && latest !== undefined ? latest.toFixed(2) : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          {latestLbl} · M
        </div>
      </div>

      {/* 4-week trend chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {weeks.map((w, idx) => {
          const isLatest = idx === weeks.length - 1
          const wColor = w.monotony === null
            ? '#666666'
            : (w.monotony < 1.5 ? BAND_COLOR.LOW
              : w.monotony < 2.0 ? BAND_COLOR.MODERATE
              : w.monotony <= 2.5 ? BAND_COLOR.HIGH
              : BAND_COLOR.VERY_HIGH)
          const labelM = w.monotony === null ? '—' : w.monotony.toFixed(2)
          const labelS = w.strain === null ? '—' : Math.round(w.strain)
          return (
            <div
              key={w.weekStart}
              data-monotony-week
              data-week-start={w.weekStart}
              data-week-monotony={w.monotony === null ? 'null' : String(w.monotony)}
              title={`${w.weekStart} · M ${labelM} · ${strainLbl} ${labelS} · TSS ${w.weekTss}`}
              style={{
                flex: '1 1 60px', minWidth: 56,
                padding: '6px 8px',
                background: `${wColor}1f`,
                border: `1px solid ${wColor}${isLatest ? '' : '55'}`,
                borderRadius: 3,
                textAlign: 'center',
                fontSize: 10, lineHeight: 1.3,
                color: 'var(--text)',
              }}
            >
              <div style={{ color: 'var(--muted)', fontSize: 9 }}>
                {w.weekStart.slice(5)}
              </div>
              <div style={{ fontWeight: 700, color: wColor, fontVariantNumeric: 'tabular-nums' }}>
                {labelM}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 9 }}>
                {strainLbl}: {labelS}
              </div>
            </div>
          )
        })}
      </div>

      {/* Coaching blurb — only when the band is in a warning state */}
      {(band === 'HIGH' || band === 'VERY_HIGH') ? (
        <div
          data-monotony-blurb
          style={{
            padding: 8,
            background: `${color}14`,
            border: `1px solid ${color}55`,
            borderRadius: 3,
            fontSize: 10,
            lineHeight: 1.5,
            color: 'var(--text)',
            marginBottom: 8,
          }}
        >
          ⚠ {blurb}
        </div>
      ) : null}

      {/* Citation footer */}
      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {citation}
      </div>
    </div>
  )
}
