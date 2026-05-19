// ─── WeeklyTssVarianceCard.jsx — 12-week between-week TSS variance card ──────
//
// Surfaces `analyzeWeeklyTssVariance` (src/lib/athlete/weeklyTssVariance.js).
// Measures BETWEEN-week TSS variability across 12 ISO weeks ending in
// the week containing today. Distinct from MonotonyTrendCard which
// measures WITHIN-week monotony.
//
// Bands (Foster 2001; Bourdon 2017):
//   STEADY   (cv < 0.20)        — green, highly consistent habit
//   MODERATE (0.20 ≤ cv < 0.40) — blue,  normal training swings
//   CHAOTIC  (cv ≥ 0.40)        — orange, large week-to-week swings

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeWeeklyTssVariance } from '../../lib/athlete/weeklyTssVariance.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  STEADY:   '#5bc25b', // green
  MODERATE: '#0064ff', // blue
  CHAOTIC:  '#ff6600', // orange
}

const BAND_LABEL_EN = {
  STEADY:   'STEADY',
  MODERATE: 'MODERATE',
  CHAOTIC:  'CHAOTIC',
}
const BAND_LABEL_TR = {
  STEADY:   'SABİT',
  MODERATE: 'ORTA',
  CHAOTIC:  'KAOTİK',
}

const BAND_HINT = {
  STEADY: {
    en: 'Highly consistent weekly load. Predictability supports adaptation and lowers injury risk.',
    tr: 'Yüksek tutarlılıkta haftalık yük. Öngörülebilirlik adaptasyonu destekler ve sakatlık riskini düşürür.',
  },
  MODERATE: {
    en: 'Normal swings — typical training pattern. No structural issue.',
    tr: 'Normal dalgalanmalar — tipik antrenman deseni. Yapısal sorun yok.',
  },
  CHAOTIC: {
    en: 'Large week-to-week swings. Smooth the load distribution for steadier adaptation.',
    tr: 'Haftalar arası büyük dalgalanmalar. Daha dengeli adaptasyon için yük dağılımını yumuşat.',
  },
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function WeeklyTssVarianceCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeWeeklyTssVariance({ log, today: todayIso() }),
    [log],
  )

  if (!analysis) return null

  const { band, cv, meanTss, stdTss, weeks, citation } = analysis
  const color = BAND_COLOR[band] || '#888888'
  const bandLabel = isTR ? (BAND_LABEL_TR[band] || '—') : (BAND_LABEL_EN[band] || '—')
  const hint = BAND_HINT[band] || { en: '', tr: '' }

  const title = isTR ? 'HAFTALAR ARASI DEĞİŞKENLİK · 12H' : 'WEEK-TO-WEEK VARIANCE · 12W'
  const ariaLabel = isTR ? 'Haftalar arası TSS değişkenliği' : 'Week-to-week TSS variance'
  const avgLabel = isTR ? `ort ${Math.round(meanTss)} TSS/hafta` : `avg ${Math.round(meanTss)} TSS/wk`
  const stdLabel = `±${Math.round(stdTss)} TSS`

  // Mini-bar scaling: max TSS across the 12 weeks → 36px tall.
  const maxTss = Math.max(1, ...weeks.map(w => w.tss))
  const BAR_HEIGHT_MAX = 36
  const BAR_HEIGHT_MIN = 2

  const cvPctText = `${Math.round(cv * 100)}%`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-weekly-tss-variance-card
      data-variance-band={band}
      data-cv={cv}
      data-mean-tss={meanTss}
      data-std-tss={stdTss}
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
        <div style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 700 }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-variance-band-chip
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
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

      {/* CV % + mean / std refs */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        marginBottom: 12,
        flexWrap: 'wrap',
      }}>
        <div
          data-variance-cv-display
          style={{
            fontSize: 32,
            fontWeight: 700,
            color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {cvPctText}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          CV · 12W
        </div>
        <div style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.03em',
        }}>
          <span data-variance-mean-label>{avgLabel}</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
          <span data-variance-std-label>{stdLabel}</span>
        </div>
      </div>

      {/* 12 mini bars, height proportional to weekly TSS */}
      <div
        data-variance-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: BAR_HEIGHT_MAX + 4,
          marginBottom: 10,
        }}
      >
        {weeks.map((w) => {
          const scaled = w.tss > 0
            ? Math.max(BAR_HEIGHT_MIN, Math.round((w.tss / maxTss) * BAR_HEIGHT_MAX))
            : BAR_HEIGHT_MIN
          return (
            <div
              key={w.weekStart}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-tss={w.tss}
              title={`${w.weekStart} · ${w.tss} TSS`}
              style={{
                flex: '1 1 0',
                minWidth: 6,
                height: scaled,
                background: w.tss > 0 ? color : 'var(--muted)',
                opacity: w.tss > 0 ? 0.85 : 0.25,
                borderRadius: 2,
              }}
            />
          )
        })}
      </div>

      {/* Interpretation hint */}
      <div
        data-variance-hint
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
      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {citation}
      </div>
    </div>
  )
}
