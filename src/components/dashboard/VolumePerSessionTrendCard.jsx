// ─── VolumePerSessionTrendCard.jsx — 12-Week Mean Session Duration Trend ────
//
// Surfaces `analyzeVolumePerSessionTrend` (src/lib/athlete/volumePer
// SessionTrend.js). While SessionLengthDistributionCard is a SNAPSHOT
// histogram of session durations (the *shape* of session-length mix
// over 90 days), this card tracks the MEAN session duration TREND over
// 12 ISO weeks: are typical sessions getting longer or shorter?
//
// Daniels 2014 + Pfitzinger 2014 — two orthogonal ways to grow volume:
// add more sessions, or make sessions LONGER. They produce different
// adaptations. This card surfaces whether session LENGTH is the lever
// the athlete is pulling.
//
// Band visualisation:
//   SHRINKING         → orange  (<-2%/wk)
//   STABLE            → blue    (|trend| < 2%/wk)
//   GROWING           → green   (2–5%/wk)
//   AGGRESSIVE_GROWTH → magenta (≥5%/wk, watch injury risk)
//   INSUFFICIENT_DATA → grey
//
// Bilingual via LangCtx. Mono terminal aesthetic. Renders null when the
// analyzer returns null (today unresolvable).

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeVolumePerSessionTrend } from '../../lib/athlete/volumePerSessionTrend.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  SHRINKING:         '#ff6600', // orange
  STABLE:            '#0064ff', // blue
  GROWING:           '#5bc25b', // green
  AGGRESSIVE_GROWTH: '#c64ad1', // magenta — distinguishes "growing fast" from healthy growth
  INSUFFICIENT_DATA: '#888888', // grey
}

const BAND_LABEL = {
  SHRINKING:         { en: 'SHRINKING',         tr: 'KÜÇÜLÜYOR' },
  STABLE:            { en: 'STABLE',            tr: 'STABİL' },
  GROWING:           { en: 'GROWING',           tr: 'BÜYÜYOR' },
  AGGRESSIVE_GROWTH: { en: 'AGGRESSIVE GROWTH', tr: 'AGRESİF BÜYÜME' },
  INSUFFICIENT_DATA: { en: 'NOT ENOUGH DATA',   tr: 'YETERSİZ VERİ' },
}

const BAND_HINT = {
  SHRINKING: {
    en: 'Typical session is getting shorter — aerobic stimulus per session is shrinking. Add 5–10 min to your easy days.',
    tr: 'Tipik seans kısalıyor — seans başına aerobik uyaran düşüyor. Kolay günlerine 5–10 dk ekle.',
  },
  STABLE: {
    en: 'Mean session length is steady. To grow volume next month, either add a session or extend your typical session by 10%.',
    tr: 'Ortalama seans süresi sabit. Önümüzdeki ay hacim için ya seans ekle ya da tipik seansını %10 uzat.',
  },
  GROWING: {
    en: 'Typical session is getting longer — healthy duration progression that builds aerobic base.',
    tr: 'Tipik seans uzuyor — aerobik tabanı geliştiren sağlıklı bir ilerleme.',
  },
  AGGRESSIVE_GROWTH: {
    en: 'Session length is climbing ≥5%/week — strong stimulus, but watch for fatigue, soreness, and sleep debt.',
    tr: 'Seans süresi haftada %5+ artıyor — güçlü uyaran; yorgunluk, ağrı ve uyku borcunu izle.',
  },
  INSUFFICIENT_DATA: {
    en: 'Log at least 12 sessions across the last 12 weeks to track your session-length trend.',
    tr: 'Seans süresi trendini izlemek için son 12 haftada en az 12 seans kaydet.',
  },
}

function formatDuration(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (rem === 0) return `${h}h`
  return `${h}h ${rem}min`
}

function formatSlope(slope, isTR) {
  if (!Number.isFinite(slope)) return '—'
  const sign = slope > 0 ? '+' : ''
  const unit = isTR ? 'dk/hafta' : 'min/wk'
  return `${sign}${slope.toFixed(2)} ${unit}`
}

function formatPct(pct) {
  if (!Number.isFinite(pct)) return '—'
  const v = pct * 100
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%/wk`
}

function trendArrow(pct) {
  if (!Number.isFinite(pct)) return '·'
  if (pct >= 0.05) return '⇈'
  if (pct >= 0.02) return '↑'
  if (pct <= -0.02) return '↓'
  return '→'
}

/**
 * Dashboard card showing weekly mean session duration over 12 ISO
 * weeks plus a linear-regression trend line. Renders null when the
 * analyzer returns null (today unresolvable).
 *
 * @param {{ log: Array }} props
 */
function VolumePerSessionTrendCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const analysis = useMemo(
    () => analyzeVolumePerSessionTrend({ log, today, windowWeeks: 12 }),
    [log, today]
  )

  if (!analysis) return null

  const {
    band,
    weeks,
    overallMeanSessionMin,
    trendSlopeMinPerWeek,
    trendPctPerWeek,
    sessionCountTotal,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || '#0064ff'
  const bandLabel = BAND_LABEL[band] ? BAND_LABEL[band][isTR ? 'tr' : 'en'] : band
  const hint = BAND_HINT[band] || BAND_HINT.STABLE
  const title = isTR ? 'ANTRENMAN SÜRESİ TRENDİ · 12H' : 'SESSION LENGTH TREND · 12W'
  const ariaLabel = isTR
    ? `Antrenman süresi trendi — ${bandLabel}`
    : `Session length trend — ${bandLabel}`
  const meanLabel = isTR ? 'ORT' : 'MEAN'
  const trendLabel = isTR ? 'EĞİM' : 'TREND'
  const sessionsLabel = isTR
    ? `${sessionCountTotal} seans analiz edildi`
    : `${sessionCountTotal} session${sessionCountTotal === 1 ? '' : 's'} analyzed`

  // Geometry for SVG mini-chart: 12 bars + linear-regression line overlay.
  const N = weeks.length
  const W = 240
  const H = 60
  const padLeft = 4
  const padRight = 4
  const padTop = 4
  const padBottom = 8
  const innerW = W - padLeft - padRight
  const innerH = H - padTop - padBottom

  const peakMean = weeks.reduce((m, w) => (w.meanSessionMin > m ? w.meanSessionMin : m), 0)
  const yScale = peakMean > 0 ? innerH / peakMean : 0
  const stepX = N > 1 ? innerW / N : innerW
  const barW = Math.max(2, stepX - 3)

  // Recompute regression slope + intercept on the rendered weeks so the
  // overlay line uses the same data the bars draw.
  let slope = 0
  let intercept = 0
  if (N >= 2) {
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
    for (let i = 0; i < N; i++) {
      const y = weeks[i].meanSessionMin
      sumX += i
      sumY += y
      sumXY += i * y
      sumXX += i * i
    }
    const denom = N * sumXX - sumX * sumX
    if (denom !== 0) {
      slope = (N * sumXY - sumX * sumY) / denom
      intercept = (sumY - slope * sumX) / N
    } else {
      intercept = sumY / N
    }
  }

  function xFor(i) {
    return padLeft + i * stepX + (stepX - barW) / 2
  }
  function yFor(value) {
    const clamped = Math.max(0, value)
    return padTop + innerH - clamped * yScale
  }
  function centerX(i) {
    return padLeft + i * stepX + stepX / 2
  }

  const x1 = centerX(0)
  const y1 = yFor(intercept)
  const x2 = centerX(N - 1)
  const y2 = yFor(intercept + slope * (N - 1))

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="volume-per-session-trend"
      data-band={band}
      data-overall-mean={overallMeanSessionMin}
      data-trend-slope={trendSlopeMinPerWeek}
      data-trend-pct={trendPctPerWeek}
      data-session-count-total={sessionCountTotal}
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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 8,
        flexWrap: 'wrap',
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
          data-band-label
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

      {/* Big mean stat + trend slope/pct */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', letterSpacing: '0.05em' }}>
          {meanLabel}
        </div>
        <div
          data-overall-mean-display
          style={{
            fontSize: 22,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {formatDuration(overallMeanSessionMin)}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', letterSpacing: '0.05em' }}>
          {trendLabel}
        </div>
        <div
          data-trend-display
          style={{
            fontSize: 12,
            fontWeight: 700,
            color,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
          }}
        >
          <span data-trend-arrow style={{ fontSize: 14 }}>{trendArrow(trendPctPerWeek)}</span>
          <span data-trend-slope-display>{formatSlope(trendSlopeMinPerWeek, isTR)}</span>
          <span
            data-trend-pct-display
            style={{ fontSize: 10, color: 'var(--muted, #888)', marginLeft: 4 }}
          >
            ({formatPct(trendPctPerWeek)})
          </span>
        </div>
      </div>

      {/* Mini bars + trend line */}
      <div
        data-mini-chart
        style={{ marginBottom: 8 }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label={isTR ? 'Haftalık ortalama seans süresi' : 'Weekly mean session duration'}
          style={{ display: 'block' }}
        >
          {weeks.map((w, i) => {
            const isEmpty = !(w.meanSessionMin > 0)
            const x = xFor(i)
            const y = yFor(w.meanSessionMin)
            const h = isEmpty ? 2 : Math.max(2, innerH - (y - padTop))
            return (
              <rect
                key={w.weekStart}
                data-week-bar
                data-week-start={w.weekStart}
                data-mean-min={w.meanSessionMin}
                data-session-count={w.sessionCount}
                x={x}
                y={isEmpty ? padTop + innerH - 2 : y}
                width={barW}
                height={h}
                fill={isEmpty ? 'var(--muted, #555)' : `${color}99`}
                opacity={isEmpty ? 0.35 : 1}
                rx={1}
              />
            )
          })}
          {N >= 2 && peakMean > 0 && (
            <line
              data-trend-line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="3 2"
              opacity={0.95}
            />
          )}
        </svg>
      </div>

      {/* Sessions analysed count */}
      <div
        data-sessions-total
        style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          letterSpacing: '0.04em',
          marginBottom: 8,
        }}
      >
        {sessionsLabel}
      </div>

      {/* Band-coloured interpretation strip */}
      <div
        data-hint
        aria-live="polite"
        style={{
          fontSize: 10,
          color: 'var(--text)',
          lineHeight: 1.5,
          padding: 8,
          background: `${color}10`,
          border: `1px solid ${color}40`,
          borderRadius: 3,
          marginBottom: 8,
        }}
      >
        {isTR ? hint.tr : hint.en}
      </div>

      {/* Citation footer */}
      <div
        data-citation
        style={{
          fontSize: 9,
          color: '#555',
          fontStyle: 'italic',
        }}
      >
        {citation}
      </div>
    </div>
  )
}

export default memo(VolumePerSessionTrendCard)
