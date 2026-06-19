// ─── LongRunConsistencyCard.jsx — Long-Run Duration CV Tracker (12 weeks) ────
//
// Surfaces `analyzeLongRunConsistency` (src/lib/athlete/longRunConsistency.js).
// Daniels (2014) & Pfitzinger (2014): the weekly long run should grow
// predictably across a build phase, then taper. Wild swings in long-run
// *durations* (one week 90, next 180, next 60) signal poor planning or
// interrupted training. This card surfaces the coefficient of variation of
// long-run durations across the last 12 ISO weeks.
//
// DIFFERENT from LongRunFrequencyCard — that one counts how OFTEN long
// sessions occur per calendar month. This one tracks how STABLE / how
// PROGRESSIVE the long-run durations themselves are.
//
// Bands:
//   STEADY        green   — cv < 0.15
//   PROGRESSIVE   blue    — cv ≥ 0.15 AND slope > +3%/week  (planned build)
//   EROSIVE       orange  — cv ≥ 0.15 AND slope < -3%/week  (long runs fading)
//   CHAOTIC       red     — cv ≥ 0.15 AND |slope| ≤ 3%/week (no plan)
//   INSUFFICIENT  muted   — 3-5 long-run weeks (encourage more long runs)
//
// Bilingual via LangCtx. Renders null only when the pure-fn returns null
// (fewer than 3 long-run weeks — truly nothing to show).
//
// Citations: Daniels 2014; Pfitzinger 2014.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeLongRunConsistency } from '../../lib/athlete/longRunConsistency.js'

const MONO = "'IBM Plex Mono', monospace"
const BAR_AREA_HEIGHT = 56
const MIN_BAR_H = 3
const MUTED_COLOR = '#888888'

const BAND_COLOR = {
  STEADY:       '#5bc25b', // green
  PROGRESSIVE:  '#0064ff', // blue
  EROSIVE:      '#ff6600', // orange
  CHAOTIC:      '#e23636', // red
  INSUFFICIENT: '#888888', // muted
}

const BAND_LABEL_EN = {
  STEADY:       'STEADY',
  PROGRESSIVE:  'PROGRESSIVE',
  EROSIVE:      'EROSIVE',
  CHAOTIC:      'CHAOTIC',
  INSUFFICIENT: 'INSUFFICIENT',
}

const BAND_LABEL_TR = {
  STEADY:       'TUTARLI',
  PROGRESSIVE:  'İLERLEYEN',
  EROSIVE:      'ERİYEN',
  CHAOTIC:      'KAOTİK',
  INSUFFICIENT: 'YETERSİZ',
}

const HINT_EN = {
  STEADY:
    'Long-run durations are stable week to week. Reliable aerobic stimulus — ideal during base phase.',
  PROGRESSIVE:
    'Long-run durations are climbing as planned. Classic build-phase pattern (Daniels 2014).',
  EROSIVE:
    'Long runs are shrinking week over week. Verify intent: taper / deload / interruption?',
  CHAOTIC:
    'Long-run durations swing wildly with no clear trend. Pick a target and progress 5-10% per week (Pfitzinger 2014).',
  INSUFFICIENT:
    'Not enough long runs yet to score consistency. Log more long runs (≥90 min) and re-check.',
}

const HINT_TR = {
  STEADY:
    'Uzun koşu süreleri haftadan haftaya kararlı. Güvenilir aerobik uyaran — temel fazı için ideal.',
  PROGRESSIVE:
    'Uzun koşu süreleri planlandığı gibi artıyor. Klasik inşa-fazı paterni (Daniels 2014).',
  EROSIVE:
    'Uzun koşular her hafta kısalıyor. Niyetini doğrula: hafifletme / azaltma / aksaklık?',
  CHAOTIC:
    'Uzun koşu süreleri net trend olmadan savruluyor. Bir hedef seç ve haftada %5-10 ilerlet (Pfitzinger 2014).',
  INSUFFICIENT:
    'Tutarlılık ölçmek için henüz yeterli uzun koşu yok. Daha çok uzun koşu (≥90 dk) kaydet ve tekrar bak.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatPctSigned(frac) {
  const v = Number(frac)
  if (!Number.isFinite(v)) return '—'
  const pct = v * 100
  const rounded = Math.round(pct * 10) / 10
  if (rounded > 0) return `+${rounded.toFixed(1)}%`
  if (rounded < 0) return `${rounded.toFixed(1)}%`
  return '0.0%'
}

function formatPctUnsigned(frac) {
  const v = Number(frac)
  if (!Number.isFinite(v) || v < 0) return '—'
  const pct = v * 100
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`
}

function formatMinutes(min) {
  const v = Number(min)
  if (!Number.isFinite(v) || v <= 0) return '0m'
  const whole = Math.round(v)
  if (whole < 60) return `${whole}m`
  const h = Math.floor(whole / 60)
  const m = whole - h * 60
  return `${h}h ${m}m`
}

/**
 * Dashboard card for long-run duration consistency (12 ISO weeks).
 *
 * @param {{ log: Array }} props
 */
function LongRunConsistencyCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeLongRunConsistency({ log, today: todayIso(), windowWeeks: 12 }),
    [log]
  )

  if (!result) return null

  const {
    band, weeks, cv, meanMin, longRunCount, trendSlopePctPerWeek, citation,
  } = result

  const color = BAND_COLOR[band] || MUTED_COLOR
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]
  const title = isTR ? 'UZUN KOŞU TUTARLILIĞI · 12H' : 'LONG-RUN CONSISTENCY · 12W'
  const ariaLabel = isTR
    ? 'Uzun koşu süresi tutarlılık kartı (Daniels 2014; Pfitzinger 2014)'
    : 'Long-run duration consistency card (Daniels 2014; Pfitzinger 2014)'

  const cvLabel = isTR ? 'CV:' : 'CV:'
  const meanLabel = isTR ? 'ort:' : 'mean:'
  const slopeLabel = isTR ? 'eğim/hafta:' : 'slope/wk:'
  const longRunsLabel = isTR
    ? `${longRunCount} uzun koşu / 12 hf`
    : `${longRunCount} long runs / 12w`

  const maxMin = weeks.reduce((m, w) => Math.max(m, w.longestRunMin || 0), 0)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="long-run-consistency"
      data-long-run-consistency-card
      data-band={band}
      data-cv={cv}
      data-mean-min={meanMin}
      data-long-run-count={longRunCount}
      data-trend-slope-pct-per-week={trendSlopePctPerWeek}
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

      {/* Headline numbers row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <div>
          <div data-cv-display style={{
            fontSize: 28, fontWeight: 700, color, lineHeight: 1,
          }}>
            {band === 'INSUFFICIENT' ? '—' : formatPctUnsigned(cv)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)', marginTop: 4,
            letterSpacing: '0.05em',
          }}>
            {cvLabel} {isTR ? 'değişim katsayısı' : 'coefficient of variation'}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div data-mean-display style={{
            fontSize: 12, color: 'var(--text)', fontWeight: 700,
          }}>
            {meanLabel} {band === 'INSUFFICIENT' ? '—' : formatMinutes(meanMin)}
          </div>
          <div data-slope-display style={{
            fontSize: 12, color, fontWeight: 700, marginTop: 4,
          }}>
            {slopeLabel} {band === 'INSUFFICIENT' ? '—' : formatPctSigned(trendSlopePctPerWeek)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)', marginTop: 4,
          }}>
            {longRunsLabel}
          </div>
        </div>
      </div>

      {/* 12 vertical bars — one per ISO week, height proportional to longest run minutes */}
      <div
        data-week-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: BAR_AREA_HEIGHT + 4,
          marginTop: 6,
          marginBottom: 10,
        }}
      >
        {weeks.map(w => {
          const active = w.longestRunMin > 0
          const barH = active && maxMin > 0
            ? Math.max(4, Math.round((w.longestRunMin / maxMin) * BAR_AREA_HEIGHT))
            : MIN_BAR_H
          return (
            <div
              key={w.weekStart}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-min={w.longestRunMin}
              title={`${w.weekStart} · ${formatMinutes(w.longestRunMin)}`}
              style={{
                flex: 1,
                height: barH,
                background: active ? color : MUTED_COLOR,
                opacity: active ? 1 : 0.35,
                border: `1px solid ${active ? color : MUTED_COLOR}`,
                borderRadius: 2,
                minWidth: 6,
              }}
            />
          )
        })}
      </div>

      {/* Band-coloured interpretation strip */}
      <div
        data-hint
        style={{
          fontSize: 10,
          color: 'var(--text)',
          lineHeight: 1.5,
          padding: 8,
          background: `${color}14`,
          border: `1px solid ${color}33`,
          borderRadius: 3,
          marginBottom: 8,
        }}
      >
        {hint}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(LongRunConsistencyCard)
