// ─── AerobicDecouplingTrendCard.jsx — Dashboard surface for aerobic Pw:Hr drift
//
// Surfaces the pure-fn `analyzeDecouplingTrend` (src/lib/athlete/decouplingTrend.js,
// shipped v9.123.0) which had no production call sites. The analyzer
// averages per-session `decouplingPct` (Friel-method Pw:Hr / pace:HR
// drift, computed at FIT-import time by `lib/decoupling.js`) across
// the recent aerobic-effort window (RPE ≤ 6) and classifies the
// average drift into Friel tiers:
//
//   < 5%  → COUPLED      (aerobic base sufficient)
//   5–10% → MILD         (mild aerobic insufficiency)
//   ≥10%  → POOR         (significant decoupling — base needs rebuild)
//
// The analyzer requires ≥2 aerobic sessions in the window. This card
// renders NULL when:
//   - analysis returns null
//   - sampleCount < 3 (card-level threshold, slightly stricter than
//     the analyzer's flag threshold; we want a trend, not two points)
//
// Citation: Friel J. (2014) The Cyclist's Training Bible, 4th ed.;
// Coggan A.R. & Allen H. (2010) Training & Racing with a Power Meter.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeDecouplingTrend } from '../../lib/athlete/decouplingTrend.js'

const MONO = "'IBM Plex Mono', monospace"
const MIN_SAMPLES_FOR_CARD = 3

// Friel-tier color + display band code. The analyzer's flag uses
// 'good'|'mild'|'significant'; we project that onto the spec's
// COUPLED / MILD / POOR display band names.
const BAND_FROM_FLAG = {
  good:        'COUPLED',
  mild:        'MILD',
  significant: 'POOR',
}
const BAND_TR = {
  COUPLED: 'EŞLEŞMİŞ',
  MILD:    'HAFİF',
  POOR:    'ZAYIF',
}
const BAND_COLOR = {
  COUPLED: '#5bc25b', // green
  MILD:    '#0064ff', // blue
  POOR:    '#ff6600', // orange
}
const BAND_HINT = {
  COUPLED: {
    en: 'Aerobic base is holding output relative to HR — stay the course.',
    tr: 'Aerobik temel KAH\'a göre çıktıyı koruyor — programı sürdür.',
  },
  MILD: {
    en: 'Mild HR drift across aerobic sessions — hold easy paces and lengthen Z2 work for 2–3 weeks.',
    tr: 'Aerobik seanslarda hafif KAH kayması — kolay tempoları koru, 2–3 hafta Z2 hacmini artır.',
  },
  POOR: {
    en: 'Significant decoupling — aerobic base needs deliberate rebuilding before adding intensity.',
    tr: 'Belirgin desenkronizasyon — yoğunluk eklemeden önce aerobik temel tekrar inşa edilmeli.',
  },
}

/**
 * @description Surface `analyzeDecouplingTrend` as a Dashboard card.
 * Renders null when the analyzer returns null or fewer than 3 samples
 * (a stricter trend threshold than the analyzer's flag gate of 2).
 *
 * @param {{ log: Array }} props
 */
export default function AerobicDecouplingTrendCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(() => analyzeDecouplingTrend(log), [log])

  if (!analysis) return null
  if (!analysis.flag) return null
  if (!Array.isArray(analysis.samples) || analysis.samples.length < MIN_SAMPLES_FOR_CARD) {
    return null
  }
  if (!Number.isFinite(analysis.avgPct)) return null

  const band = BAND_FROM_FLAG[analysis.flag]
  if (!band) return null
  const color = BAND_COLOR[band]
  const hint = BAND_HINT[band]
  const bandLabel = isTR ? BAND_TR[band] : band
  const title = isTR ? 'AEROBİK BOZULMA · 30G' : 'AEROBIC DECOUPLING · 30D'
  const ariaLabel = isTR ? 'Aerobik bozulma trendi' : 'Aerobic decoupling trend'
  const avgLabel = isTR ? 'ORT.' : 'AVG'
  const sessionsLabel = isTR
    ? `${analysis.samples.length} aerobik seans`
    : `${analysis.samples.length} aerobic sessions`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-aerobic-decoupling-trend-card
      data-decoupling-band={band}
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
          data-decoupling-band-label
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

      {/* Average + sample count */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em' }}>
          {avgLabel}
        </div>
        <div
          data-decoupling-avg
          style={{
            fontSize: 22,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {analysis.avgPct.toFixed(1)}%
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          · {sessionsLabel}
        </div>
      </div>

      {/* Per-session chip strip — one chip per sample, colored by per-session band */}
      <div
        data-decoupling-chips
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginBottom: 10,
        }}
      >
        {analysis.samples.map((s, i) => {
          const pct = Number(s.decouplingPct)
          const sBand = pct < 5 ? 'COUPLED' : pct < 10 ? 'MILD' : 'POOR'
          const sColor = BAND_COLOR[sBand]
          return (
            <div
              key={`${s.date}-${i}`}
              data-decoupling-chip
              data-chip-band={sBand}
              title={`${s.date} · ${pct.toFixed(1)}%`}
              style={{
                fontSize: 9,
                padding: '3px 6px',
                background: `${sColor}22`,
                color: sColor,
                border: `1px solid ${sColor}`,
                borderRadius: 2,
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}
            >
              {pct.toFixed(1)}%
            </div>
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
        Friel 2014; Coggan &amp; Allen 2010
      </div>
    </div>
  )
}
