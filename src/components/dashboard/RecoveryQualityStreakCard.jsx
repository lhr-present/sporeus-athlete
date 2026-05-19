// ─── RecoveryQualityStreakCard.jsx — Dual-Marker Recovery Quality Streak ────
//
// Surfaces consecutive days where the athlete had BOTH sufficient sleep
// (sleepHrs ≥ profile.sleepTarget or 8h default) AND a "fresh" resting HR
// (restingHR ≤ lifetime baseline). Combines two recovery signals into a
// single quality-recovery streak.
//
// Refs: Walker 2017 (sleep + cardiovascular recovery);
//       Buchheit 2014 (RHR as recovery marker).
//
// Status mapping:
//   DEEP_RECOVERY (green)  — currentStreak ≥ 5
//   STEADY        (blue)   — currentStreak ≥ 2
//   INCONSISTENT  (orange) — currentStreak < 2

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeRecoveryQualityStreak } from '../../lib/athlete/recoveryQualityStreak.js'

const MONO = "'IBM Plex Mono', monospace"

const STATUS_COLOR = {
  DEEP_RECOVERY: '#5bc25b',
  STEADY:        '#0064ff',
  INCONSISTENT:  '#ff6600',
}

const STATUS_LABEL = {
  en: {
    DEEP_RECOVERY: 'DEEP RECOVERY',
    STEADY:        'STEADY',
    INCONSISTENT:  'INCONSISTENT',
  },
  tr: {
    DEEP_RECOVERY: 'DERİN TOPARLANMA',
    STEADY:        'SABİT',
    INCONSISTENT:  'KARARSIZ',
  },
}

const HINTS = {
  en: {
    DEEP_RECOVERY: 'Multiple consecutive days where both sleep and RHR are aligned for adaptation. Hard work lands here.',
    STEADY:        'Recovery quality holding. Keep protecting both sleep duration and stress.',
    INCONSISTENT:  'Quality streak broken — either sleep duration or RHR drifted. Identify which and protect it.',
  },
  tr: {
    DEEP_RECOVERY: "Hem uyku hem KAH'ın adaptasyona uyumlu olduğu birden çok ardışık gün. Sert iş burada karşılığını verir.",
    STEADY:        'Toparlanma kalitesi devam ediyor. Hem uyku süresini hem stresi korumaya devam et.',
    INCONSISTENT:  'Kalite serisi kırıldı — ya uyku süresi ya KAH kaydı. Hangisi olduğunu belirle ve koru.',
  },
}

export default function RecoveryQualityStreakCard({ recovery, profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeRecoveryQualityStreak({ recovery, profile }),
    [recovery, profile],
  )

  if (!result) return null

  const {
    status,
    currentStreak,
    longestStreak,
    totalQualityDays28,
    sleepTarget,
    lifetimeBaselineRHR,
    citation,
  } = result

  const statusColor = STATUS_COLOR[status]
  const statusLabel = STATUS_LABEL[isTR ? 'tr' : 'en'][status]
  const hint = HINTS[isTR ? 'tr' : 'en'][status]

  const titleEN = 'RECOVERY QUALITY STREAK'
  const titleTR = 'TOPARLANMA KALİTE SERİSİ'
  const daysEN  = currentStreak === 1 ? 'day' : 'days'
  const daysTR  = 'gün'
  const longestEN = `longest ever: ${longestStreak} days`
  const longestTR = `en uzun: ${longestStreak} gün`
  const qd28EN  = `${totalQualityDays28}/28 quality days last 28d`
  const qd28TR  = `son 28 günde ${totalQualityDays28}/28 kaliteli gün`
  const sleepLabelEN = `sleep ≥ ${sleepTarget.toFixed(1)}h`
  const sleepLabelTR = `uyku ≥ ${sleepTarget.toFixed(1)}sa`
  const rhrLabelEN   = `RHR ≤ ${lifetimeBaselineRHR.toFixed(1)} bpm`
  const rhrLabelTR   = `KAH ≤ ${lifetimeBaselineRHR.toFixed(1)} bpm`

  const ariaLabel = isTR ? 'Toparlanma kalite serisi' : 'Recovery quality streak'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-recovery-quality-streak-card
      data-streak-status={status}
      data-current-streak={currentStreak}
      data-longest-streak={longestStreak}
      data-total-quality-days-28={totalQualityDays28}
      data-sleep-target={sleepTarget}
      data-lifetime-baseline-rhr={lifetimeBaselineRHR}
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
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 10,
        }}
      >
        <span style={{ color: statusColor, marginRight: 6 }}>◢</span>
        {isTR ? titleTR : titleEN}
      </div>

      {/* Big streak count + status badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: statusColor,
            lineHeight: 1,
          }}
        >
          {currentStreak}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted, #888)' }}>
          {isTR ? daysTR : daysEN}
        </span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '2px 8px',
            border: `1px solid ${statusColor}`,
            color: statusColor,
            borderRadius: 3,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Longest ever + 28-day quality count */}
      <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginBottom: 4 }}>
        {isTR ? longestTR : longestEN}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginBottom: 10 }}>
        {isTR ? qd28TR : qd28EN}
      </div>

      {/* Threshold reference: sleep target + baseline RHR */}
      <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 8 }}>
        {isTR ? sleepLabelTR : sleepLabelEN}
        {' · '}
        {isTR ? rhrLabelTR : rhrLabelEN}
      </div>

      {/* Interpretation hint */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text, #ccc)',
          marginBottom: 8,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </div>

      {/* Citation */}
      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {citation}
      </div>
    </div>
  )
}
