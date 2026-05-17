// ─── dashboard/SleepDebtCard.jsx — Rolling 7-day sleep debt ───────────────────
//
// Surfaces `computeSleepDebt` (the canonical sport-science "sleep debt"
// metric: cumulative shortfall vs target across a trailing 7-day window).
// Surplus sleep does NOT subtract from prior debt — see sleepDebt.js for
// the rationale. Card renders null when there is no signal (no debt) so
// it doesn't add chrome to the Dashboard for well-rested athletes.
//
// References:
//   Walker 2017   — Why We Sleep
//   Mah 2011      — Sleep extension improves athletic performance
//   Halson 2014   — Sleep and the elite athlete
//   Milewski 2014 — Chronic lack of sleep & injury risk (4h+ debt threshold)

import { memo, useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeSleepDebt } from '../../lib/athlete/sleepDebt.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  NONE:     '#5bc25b', // green
  MINOR:    '#0064ff', // blue
  MODERATE: '#f5c542', // orange / amber
  SEVERE:   '#e03030', // red
}

const BAND_LABEL_EN = {
  NONE:     'ON TARGET',
  MINOR:    'MINOR',
  MODERATE: 'MODERATE',
  SEVERE:   'SEVERE',
}
const BAND_LABEL_TR = {
  NONE:     'HEDEFE UYUMLU',
  MINOR:    'HAFİF',
  MODERATE: 'ORTA',
  SEVERE:   'AĞIR',
}

// ── Mini bar chart for the 7-day deficit timeline ────────────────────────────
// 140 × 28px. Each bar = one day's deficit; tallest bar = the day with the
// biggest shortfall. Days at/above target render as a single pixel of green
// (still visible so the spacing isn't ambiguous).
function DeficitSparkline({ deficits, targetHours, bandColor }) {
  const W = 140
  const H = 28
  if (!Array.isArray(deficits) || deficits.length === 0) return null

  const vals = deficits.map(d => Number(d?.deficit) || 0)
  // Scale to the larger of (max deficit, 2h) so a tiny deficit isn't
  // visually screaming. targetHours is informational; we never plot
  // hours, only deficits.
  void targetHours
  const maxV = Math.max(...vals, 2)
  const range = maxV || 1

  const n = vals.length
  const gap = 2
  const barW = Math.max(2, Math.floor((W - (n - 1) * gap) / n))

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Sleep debt sparkline"
      data-sleep-debt-sparkline
    >
      {vals.map((v, i) => {
        const x = i * (barW + gap)
        const barH = v > 0
          ? Math.max(2, Math.round((v / range) * (H - 2)))
          : 1
        const y = H - barH
        const color = v > 0 ? bandColor : '#5bc25b'
        const dateKey = deficits[i]?.date ?? i
        return (
          <rect
            key={dateKey}
            x={x}
            y={y}
            width={barW}
            height={barH}
            fill={color}
            opacity={v > 0 ? 0.85 : 0.5}
            data-day-deficit={v}
          />
        )
      })}
    </svg>
  )
}

function SleepDebtCard({ recovery, profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => computeSleepDebt({ recovery, profile, windowDays: 7 }),
    [recovery, profile],
  )

  // No signal: no recovery rows, OR (band NONE AND debt is literally 0).
  // We deliberately keep the card visible for MINOR (band > NONE) so the
  // athlete sees the directional reminder.
  if (!data) return null
  if (data.band === 'NONE' && data.debtHours === 0) return null

  const { debtHours, targetHours, dailyDeficits, band, citation } = data
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]

  const title = isTR ? 'UYKU AÇIĞI · 7G' : 'SLEEP DEBT · 7D'
  const targetLine = isTR
    ? `Hedef: ${targetHours}s/gece`
    : `Target: ${targetHours}h/night`
  const unitLabel = isTR ? 's açık' : 'h debt'
  const ariaLabel = isTR ? 'Yedi günlük uyku açığı' : 'Seven-day rolling sleep debt'

  const guidance = (() => {
    if (band === 'SEVERE') {
      return isTR
        ? 'Ağır açık — 8+ saate dönmek için 3–5 gün ardışık koru; yarış pencerelerinde özellikle kritik.'
        : 'Severe deficit — protect 8+ hours for 3–5 consecutive nights to restore; especially critical before race blocks.'
    }
    if (band === 'MODERATE') {
      return isTR
        ? 'Orta düzeyde açık — bu hafta gece uyku rutinini önceliklendir; uyandırma alarmı yerine doğal uyanmaya bırak.'
        : 'Moderate deficit — prioritize sleep routine this week; aim to wake without an alarm when possible.'
    }
    return isTR
      ? 'Hafif açık — tek bir kötü gece bile haftalık toplamı şişirir; alışkanlığı koru.'
      : 'Minor deficit — even a single short night inflates the weekly sum; keep the habit consistent.'
  })()

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-sleep-debt-card
      data-debt-band={band}
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
      {/* Title */}
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#ff6600',
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        ◈ {title}
      </div>

      {/* Headline: big debt number + band badge */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 6,
      }}>
        <span
          data-debt-hours={debtHours}
          style={{
            fontSize: 28,
            fontWeight: 700,
            color,
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          {debtHours}
        </span>
        <span style={{
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
        }}>
          {unitLabel}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          border: `1px solid ${color}`,
          borderRadius: 2,
          padding: '2px 6px',
          letterSpacing: '0.06em',
        }}>
          {bandLabel}
        </span>
      </div>

      {/* Target line */}
      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        marginBottom: 8,
      }}>
        {targetLine}
      </div>

      {/* 7-day mini chart */}
      <DeficitSparkline
        deficits={dailyDeficits}
        targetHours={targetHours}
        bandColor={color}
      />

      {/* Guidance */}
      <div style={{
        fontSize: 10,
        color: 'var(--text, #ccc)',
        lineHeight: 1.5,
        marginTop: 10,
      }}>
        {guidance}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: 'var(--muted)',
        marginTop: 10,
        letterSpacing: '0.04em',
        opacity: 0.7,
        borderTop: '1px solid var(--border)',
        paddingTop: 6,
        fontStyle: 'italic',
      }}>
        ℹ {citation}
      </div>
    </div>
  )
}

export default memo(SleepDebtCard)
