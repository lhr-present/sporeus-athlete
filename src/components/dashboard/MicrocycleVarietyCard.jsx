// ─── MicrocycleVarietyCard.jsx — 12-Week Within-Week Stimulus Variety ───────
//
// Surfaces `analyzeMicrocycleVariety` (src/lib/athlete/microcycleVariety.js).
// DIFFERENT from SessionVarietyCard (overall variety across all sessions)
// and HardSessionTypePatternCard (HARD-only Shannon entropy). This card
// measures variety WITHIN each individual microcycle (week) — distinct
// session types per week — over the last 12 ISO weeks, plus the linear
// trend across that window.
//
// Issurin 2010 + Bompa 2018 block-periodization theory: each microcycle
// should hit MULTIPLE stimuli to drive concurrent adaptations. A
// monotonous week ceiling-effects fast.
//
// Renders the mean unique types/week, the trend slope with an arrow, a
// 12-bar sparkline (one bar per week showing uniqueTypes height +
// sessionCount label below), and a band-coloured interpretation strip.
// Bilingual via LangCtx, Bloomberg terminal aesthetic.
//
// Citations:
//   Issurin V. (2010). Sports Med 40(3):189-206.
//   Bompa T., Buzzichelli C. (2018). Periodization: Theory and Methodology
//     of Training, 6th ed.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeMicrocycleVariety } from '../../lib/athlete/microcycleVariety.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  WIDE_VARIETY:      '#5bc25b', // green
  BALANCED:          '#0064ff', // blue
  NARROW:            '#ff6600', // orange
  MONOTONOUS:        '#e03030', // red
  INSUFFICIENT_DATA: '#888888', // grey
}

const BAND_LABEL = {
  WIDE_VARIETY:      { en: 'WIDE VARIETY',     tr: 'GENİŞ ÇEŞİTLİLİK' },
  BALANCED:          { en: 'BALANCED',         tr: 'DENGELİ' },
  NARROW:            { en: 'NARROW',           tr: 'DAR' },
  MONOTONOUS:        { en: 'MONOTONOUS',       tr: 'TEK DÜZE' },
  INSUFFICIENT_DATA: { en: 'NOT ENOUGH WEEKS', tr: 'YETERSİZ HAFTA' },
}

const BAND_HINT = {
  WIDE_VARIETY: {
    en: 'Each microcycle is hitting many different stimuli — concurrent adaptation pathways are being trained.',
    tr: 'Her mikrosikl pek çok farklı uyarana ulaşıyor — eşzamanlı adaptasyon yolları çalışıyor.',
  },
  BALANCED: {
    en: 'Healthy mix of stimuli per week — a typical microcycle covers 3–4 distinct session types.',
    tr: 'Haftada sağlıklı uyaran karışımı — tipik bir mikrosikl 3–4 farklı seans tipini kapsıyor.',
  },
  NARROW: {
    en: 'Each week leans on just 2 session types — add a long, a tempo, or a strength block to broaden the stimulus.',
    tr: 'Her hafta sadece 2 seans tipine yaslanıyor — uyaranı genişletmek için uzun, tempo ya da kuvvet bloğu ekle.',
  },
  MONOTONOUS: {
    en: 'Each microcycle is essentially the same session repeated — ceiling-effect risk. Rotate stimuli within the week.',
    tr: 'Her mikrosikl aslında aynı seansın tekrarı — tavan etkisi riski. Hafta içinde uyaranı rotasyona al.',
  },
  INSUFFICIENT_DATA: {
    en: 'Log at least 4 weeks of training to evaluate microcycle variety.',
    tr: 'Mikrosikl çeşitliliğini değerlendirmek için en az 4 hafta antrenman kaydet.',
  },
}

function trendArrow(delta) {
  if (!Number.isFinite(delta)) return '·'
  if (delta > 0.05) return '↑'
  if (delta < -0.05) return '↓'
  return '→'
}

/**
 * Dashboard card visualising within-week stimulus variety over the
 * last 12 ISO weeks plus the linear trend across that window.
 *
 * @param {{ log: Array }} props
 */
export default function MicrocycleVarietyCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const analysis = useMemo(
    () => analyzeMicrocycleVariety({ log, today, windowWeeks: 12 }),
    [log, today],
  )

  if (!analysis) return null

  const {
    band,
    weeks,
    meanUniqueTypesPerWeek,
    trendDeltaPerWeek,
    trainingWeekCount,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || BAND_COLOR.BALANCED
  const bandLabel = (BAND_LABEL[band] || BAND_LABEL.BALANCED)[isTR ? 'tr' : 'en']
  const hint = BAND_HINT[band] || BAND_HINT.BALANCED

  const title = isTR
    ? 'MİKROSİKL ÇEŞİTLİLİĞİ · 12H'
    : 'MICROCYCLE VARIETY · 12W'

  const ariaLabel = isTR
    ? `Mikrosikl çeşitliliği — ${bandLabel}`
    : `Microcycle variety — ${bandLabel}`

  const typesPerWeekLabel = isTR ? 'tip / hafta' : 'types per week'
  const trainingWeeksLabel = isTR
    ? `${trainingWeekCount} antrenmanlı hafta`
    : `${trainingWeekCount} training week${trainingWeekCount === 1 ? '' : 's'}`

  // Trend arrow + delta label
  const arrow = trendArrow(trendDeltaPerWeek)
  const deltaAbs = Math.abs(trendDeltaPerWeek).toFixed(2)
  const trendLabel = isTR
    ? `eğim ${arrow} ${deltaAbs} / hafta`
    : `trend ${arrow} ${deltaAbs} /wk`
  const trendColor = trendDeltaPerWeek > 0.05
    ? '#5bc25b'
    : trendDeltaPerWeek < -0.05
      ? '#e03030'
      : 'var(--muted, #888)'

  // Bars — max height anchored to the largest uniqueTypes in the window
  // (or 1 if everything is 0, to avoid division by zero).
  const maxUnique = Math.max(1, ...weeks.map(w => w.uniqueTypes))
  const BAR_HEIGHT_PX = 48

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="microcycle-variety"
      data-band={band}
      data-training-weeks={trainingWeekCount}
      data-mean-unique={meanUniqueTypesPerWeek}
      data-trend-delta={trendDeltaPerWeek}
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

      {/* Large stat: mean types/week */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 6,
        flexWrap: 'wrap',
      }}>
        <div
          data-mean-stat
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--text)',
            lineHeight: 1,
          }}
        >
          {meanUniqueTypesPerWeek.toFixed(2)}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--muted, #888)',
          letterSpacing: '0.04em',
        }}>
          {typesPerWeekLabel}
        </div>
      </div>

      {/* Trend + training-week stats */}
      <div
        data-stats
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
          fontSize: 11,
        }}
      >
        <span
          data-trend
          style={{ color: trendColor, fontWeight: 600 }}
        >
          {trendLabel}
        </span>
        <span
          data-training-weeks-label
          style={{ color: 'var(--muted, #888)' }}
        >
          {trainingWeeksLabel}
        </span>
      </div>

      {/* 12 mini bars — uniqueTypes height + sessionCount label below */}
      <div
        data-bars
        role="list"
        aria-label={isTR ? 'Haftalık mikrosikl çeşitliliği' : 'Weekly microcycle variety'}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: BAR_HEIGHT_PX + 16,
          marginBottom: 10,
          paddingTop: 4,
        }}
      >
        {weeks.map((w, i) => {
          const heightPct = w.uniqueTypes > 0
            ? (w.uniqueTypes / maxUnique) * 100
            : 0
          const heightPx = Math.max(2, (heightPct / 100) * BAR_HEIGHT_PX)
          const isEmptyWeek = w.sessionCount === 0
          const barColor = isEmptyWeek ? 'var(--surface, #1a1a1a)' : color
          const aria = isTR
            ? `${w.weekStart}: ${w.uniqueTypes} tip, ${w.sessionCount} seans`
            : `${w.weekStart}: ${w.uniqueTypes} type${w.uniqueTypes === 1 ? '' : 's'}, ${w.sessionCount} session${w.sessionCount === 1 ? '' : 's'}`
          return (
            <div
              key={w.weekStart}
              role="listitem"
              data-bar={i}
              data-week-start={w.weekStart}
              data-unique-types={w.uniqueTypes}
              data-session-count={w.sessionCount}
              aria-label={aria}
              title={aria}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: heightPx,
                  background: barColor,
                  borderRadius: 2,
                  opacity: isEmptyWeek ? 0.4 : 1,
                  transition: 'height 0.3s',
                }}
              />
              <div
                data-bar-count
                style={{
                  fontSize: 9,
                  color: 'var(--muted, #888)',
                  marginTop: 2,
                  lineHeight: 1,
                }}
              >
                {w.sessionCount}
              </div>
            </div>
          )
        })}
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
