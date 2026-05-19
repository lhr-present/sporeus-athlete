// ─── CumulativeFatigueWindowsCard.jsx ───────────────────────────────────
// Surfaces `analyzeCumulativeFatigueWindows` (Halson 2014; Meeusen 2013) —
// a CHRONIC-DOSE counter that asks "how often have you visited the
// overreaching zone in the last 90 days?" rather than the point-in-time
// state surfaced by ACWRCard / CtlSlopeCard / CtlRampRateCard.
//
// Render rules:
//   - Returns null when the pure-fn returns null (empty log / no warm CTL).
//   - Otherwise renders for all four bands.
//   - Sparkline draws the daily rolling7TSS/CTL ratio over the window
//     with a horizontal threshold line at `overreachRatio` and red dots
//     wherever the daily ratio exceeded the threshold.
//
// Bilingual EN/TR via LangCtx.
// Test anchors:
//   data-card="cumulative-fatigue-windows",
//   data-overreach-band, data-windows-above-threshold, data-total-days,
//   data-exposure-rate, data-peak-ratio, data-peak-ratio-date.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeCumulativeFatigueWindows } from '../../lib/athlete/cumulativeFatigueWindows.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  CONSERVATIVE:        '#5bc25b', // green — well below the overreaching dose
  NORMAL:              '#0064ff', // blue  — occasional in-zone days, expected
  ELEVATED_EXPOSURE:   '#ff6600', // orange — frequent, watch the trend
  CHRONIC_OVERREACH:   '#e03030', // red    — chronic dose, risk of NFOR/OT
}

const BAND_LABEL_EN = {
  CONSERVATIVE:      'CONSERVATIVE',
  NORMAL:            'NORMAL',
  ELEVATED_EXPOSURE: 'ELEVATED EXPOSURE',
  CHRONIC_OVERREACH: 'CHRONIC OVERREACH',
}
const BAND_LABEL_TR = {
  CONSERVATIVE:      'TUTUMLU',
  NORMAL:            'NORMAL',
  ELEVATED_EXPOSURE: 'YÜKSEK MARUZİYET',
  CHRONIC_OVERREACH: 'KRONİK AŞIRI YÜKLENME',
}

const HINT_EN = {
  CONSERVATIVE:
    'Almost no time in the overreaching zone — plenty of headroom to push the build.',
  NORMAL:
    'Occasional overreach days — expected for any honest build block.',
  ELEVATED_EXPOSURE:
    'Frequent overreach days. Schedule a recovery week before the dose accumulates further.',
  CHRONIC_OVERREACH:
    'Chronic overreaching dose — non-functional overreaching / overtraining risk. Recovery block needed now.',
}
const HINT_TR = {
  CONSERVATIVE:
    'Aşırı yüklenme bölgesinde neredeyse hiç gün yok — yapı bloğunu zorlamak için bol alan var.',
  NORMAL:
    'Ara sıra aşırı yüklenme günü — dürüst bir yapı bloğu için beklenen.',
  ELEVATED_EXPOSURE:
    'Sık aşırı yüklenme günleri. Doz daha fazla birikmeden bir toparlanma haftası planla.',
  CHRONIC_OVERREACH:
    'Kronik aşırı yüklenme dozu — fonksiyonel olmayan aşırı yüklenme / aşırı antrenman riski. Şimdi toparlanma bloğu gerekli.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

// ─── sparkline ──────────────────────────────────────────────────────────
function Sparkline({ dailyRatios, overreachRatio, color }) {
  const w = 280
  const h = 56
  const padX = 4
  const padY = 6

  // Determine numeric range (ignore null/warmup days).
  const numericRatios = dailyRatios
    .map(d => d.ratio)
    .filter(v => Number.isFinite(v))
  if (numericRatios.length === 0) return null

  const maxR = Math.max(overreachRatio * 1.05, ...numericRatios)
  const minR = Math.min(0, ...numericRatios)
  const range = maxR - minR || 1

  const n = dailyRatios.length
  const stepX = (w - 2 * padX) / Math.max(n - 1, 1)
  const yFor = r => h - padY - ((r - minR) / range) * (h - 2 * padY)

  // Build polyline string of plotted (non-null) points.
  const points = []
  const dots = []
  dailyRatios.forEach((d, i) => {
    if (!Number.isFinite(d.ratio)) return
    const x = padX + i * stepX
    const y = yFor(d.ratio)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
    if (d.ratio > overreachRatio) {
      dots.push({ x, y })
    }
  })

  const threshY = yFor(overreachRatio)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Daily overreach ratio sparkline"
      data-sparkline="cumulative-fatigue-windows"
      style={{ display: 'block', marginTop: 8 }}
    >
      {/* threshold line */}
      <line
        x1={padX}
        y1={threshY}
        x2={w - padX}
        y2={threshY}
        stroke="#e03030"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.5"
      />
      {/* ratio polyline */}
      {points.length > 1 ? (
        <polyline
          fill="none"
          stroke="#0064ff"
          strokeWidth="1.5"
          points={points.join(' ')}
        />
      ) : null}
      {/* over-threshold dots */}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r="2"
          fill="#e03030"
          stroke={color}
          strokeWidth="0.5"
          data-overreach-dot
        />
      ))}
    </svg>
  )
}

export default function CumulativeFatigueWindowsCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeCumulativeFatigueWindows({
      log,
      today: todayIso(),
      windowDays: 90,
      overreachRatio: 1.30,
    }),
    [log]
  )

  if (!result) return null

  const {
    band,
    windowsAboveThreshold,
    totalDays,
    peakRatio,
    peakRatioDate,
    exposureRate,
    dailyRatios,
    overreachRatio,
    citation,
  } = result

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR
    ? 'AŞIRI YÜKLENME MARUZİYETİ · 90G'
    : 'OVERREACH EXPOSURE · 90D'
  const ariaLabel = isTR
    ? `Son 90 günde aşırı yüklenme bölgesinde geçen günler (${citation})`
    : `Days spent in the overreaching zone over the last 90 days (${citation})`

  const daysLabel = isTR
    ? `son ${totalDays} günden aşırı yüklenme bölgesinde`
    : `days in overreach zone of last ${totalDays}`
  const exposurePct = (exposureRate * 100).toFixed(1)
  const exposureLabel = isTR
    ? `${exposurePct}% maruziyet oranı`
    : `${exposurePct}% exposure rate`
  const peakLabel = isTR
    ? `Zirve oran ${peakRatio.toFixed(2)} (${peakRatioDate || '—'})`
    : `Peak ratio ${peakRatio.toFixed(2)} (${peakRatioDate || '—'})`
  const threshLabel = isTR
    ? `Eşik: 7g ortalama TSS / CTL > ${overreachRatio.toFixed(2)}`
    : `Threshold: 7d mean TSS / CTL > ${overreachRatio.toFixed(2)}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="cumulative-fatigue-windows"
      data-overreach-band={band}
      data-windows-above-threshold={windowsAboveThreshold}
      data-total-days={totalDays}
      data-exposure-rate={exposureRate}
      data-peak-ratio={peakRatio}
      data-peak-ratio-date={peakRatioDate || ''}
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
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
          }}>
            <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
            {title}
          </div>
          <div style={{ marginTop: 10 }}>
            <div
              data-windows-above-display
              style={{
                fontSize: 28, fontWeight: 700, color, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {windowsAboveThreshold}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 3 }}>
              {daysLabel}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-band-chip
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              padding: '3px 8px', borderRadius: 3,
              background: `${color}22`, color, border: `1px solid ${color}`,
              display: 'inline-block',
            }}
          >
            {bandLabel}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginTop: 6 }}>
            {exposureLabel}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {peakLabel}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline
        dailyRatios={dailyRatios}
        overreachRatio={overreachRatio}
        color={color}
      />

      <div style={{
        fontSize: 9, color: 'var(--muted, #777)', marginTop: 4,
        letterSpacing: '0.04em',
      }}>
        {threshLabel}
      </div>

      {/* Coaching hint band-coloured strip */}
      <div
        data-band-strip
        style={{
          marginTop: 10, padding: '6px 8px',
          background: `${color}14`,
          border: `1px solid ${color}55`,
          borderRadius: 3,
          fontSize: 10, color: 'var(--text, #ccc)', lineHeight: 1.5,
        }}
      >
        ↗ {hint}
      </div>

      {/* Citation footer */}
      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
