// ─── LongestSessionTrendCard.jsx — 12-Week Longest-Session Trend ─────────────
//
// Surfaces `analyzeLongestSessionTrend` (src/lib/athlete/longestSessionTrend.js).
// For endurance athletes, the longest weekly session is the canonical
// indicator of aerobic-base development. Lydiard 1978 and Daniels 2014
// both anchor their macrocycles around progressive long-session growth.
//
// Band visualization:
//   GROWING  → green  (delta ≥ +10%)
//   STABLE   → blue   (|delta| < 10% OR earlyAvg=0 / recentAvg>0)
//   SHRINKING → orange (delta ≤ -10%)
//
// Bilingual via LangCtx. Mono terminal aesthetic. Renders null when the
// analyzer returns null (<6 active weeks of 12).

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeLongestSessionTrend } from '../../lib/athlete/longestSessionTrend.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  GROWING:   '#5bc25b',
  STABLE:    '#0064ff',
  SHRINKING: '#ff6600',
}

const BAND_TR = {
  GROWING:   'BÜYÜYOR',
  STABLE:    'STABİL',
  SHRINKING: 'KÜÇÜLÜYOR',
}

const BAND_HINT = {
  GROWING: {
    en: 'Long sessions are getting longer — aerobic base is expanding.',
    tr: 'Uzun seanslar uzuyor — aerobik temel genişliyor.',
  },
  STABLE: {
    en: 'Long-session capacity is steady. Add 10-15% length next month to keep building.',
    tr: 'Uzun seans kapasitesi sabit. Devam etmek için önümüzdeki ay süreye %10-15 ekle.',
  },
  SHRINKING: {
    en: 'Longest sessions are getting shorter — endurance base may be drifting.',
    tr: 'En uzun seanslar kısalıyor — dayanıklılık temeli kayıyor olabilir.',
  },
}

// Convert minutes → "Xh Ymin" / "Ymin" formatted string.
function formatDuration(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (rem === 0) return `${h}h`
  return `${h}h ${rem}min`
}

function formatDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return '—'
  const pct = delta * 100
  const sign = pct > 0 ? '+' : pct < 0 ? '' : ''
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * @description Dashboard card showing the 12-week trend of longest
 *   weekly session duration. Renders null when analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
function LongestSessionTrendCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const analysis = useMemo(
    () => analyzeLongestSessionTrend({ log, today }),
    [log, today]
  )

  if (!analysis) return null

  const { band, delta, weeks, peakWeek, peakMin } = analysis
  const color = BAND_COLOR[band] || '#0064ff'
  const bandLabel = isTR ? (BAND_TR[band] || band) : band
  const hint = BAND_HINT[band] || BAND_HINT.STABLE
  const title = isTR ? 'EN UZUN SEANS · 12H' : 'LONGEST SESSION · 12W'
  const ariaLabel = isTR ? 'En uzun seans trendi' : 'Longest session trend'
  const peakLabel = isTR ? 'ZİRVE' : 'PEAK'
  const deltaLabel = isTR ? 'DEĞİŞİM' : 'CHANGE'

  // Bar chart geometry — height proportional to longestMin / peakMin.
  const MAX_BAR_H = 56
  const MIN_EMPTY_H = 3

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-longest-session-trend-card
      data-trend-band={band}
      data-delta={delta == null ? '' : delta.toFixed(4)}
      data-peak-week={peakWeek}
      data-peak-min={peakMin}
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-trend-band-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Peak duration (big) + delta */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em' }}>
          {peakLabel}
        </div>
        <div
          data-peak-duration
          style={{
            fontSize: 22,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {formatDuration(peakMin)}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em' }}>
          {deltaLabel}
        </div>
        <div
          data-delta-pct
          style={{
            fontSize: 14,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {formatDelta(delta)}
        </div>
      </div>

      {/* 12 mini bars — height proportional to longestMin, peak highlighted */}
      <div
        data-week-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: MAX_BAR_H + 4,
          marginBottom: 10,
        }}
      >
        {weeks.map(w => {
          const isEmpty = !(w.longestMin > 0)
          const isPeak = w.weekStart === peakWeek && peakMin > 0
          const ratio = peakMin > 0 ? (w.longestMin / peakMin) : 0
          const h = isEmpty ? MIN_EMPTY_H : Math.max(4, Math.round(ratio * MAX_BAR_H))
          const barColor = isEmpty
            ? 'var(--muted, #555)'
            : isPeak
              ? color
              : `${color}88`
          return (
            <div
              key={w.weekStart}
              data-week-bar
              data-week-start={w.weekStart}
              data-longest-min={w.longestMin}
              title={`${w.weekStart} · ${formatDuration(w.longestMin)}`}
              style={{
                flex: 1,
                height: h,
                background: barColor,
                borderRadius: 2,
                opacity: isEmpty ? 0.35 : 1,
                border: isPeak ? `1px solid ${color}` : '1px solid transparent',
                minWidth: 6,
              }}
            />
          )
        })}
      </div>

      {/* Interpretation hint (bilingual) */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}10`,
        border: `1px solid ${color}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {isTR ? hint.tr : hint.en}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Daniels 2014; Lydiard 1978
      </div>
    </div>
  )
}

export default memo(LongestSessionTrendCard)
