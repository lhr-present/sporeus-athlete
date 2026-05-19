// ─── PerfectWeekCard.jsx — Perfect-week ratio (12W) ─────────────────────────
//
// Surfaces `analyzePerfectWeek` (Hellard 2019; Seiler 2010).
//
// "Perfect week" = ≥3 sessions AND ≥1 hard (RPE≥7) AND ≥1 long (≥90 min).
// The card shows how often the week SHAPE — not just total volume — lines up
// with the structural recipe most adaptations depend on.
//
// Pattern → color:
//   HABITUAL_QUALITY  green  #5bc25b  — perfectRate ≥ 0.50
//   OCCASIONAL        blue   #0064ff  — 0.20 ≤ rate < 0.50
//   SPORADIC          orange #ff6600  — perfectRate < 0.20
//
// Tests: src/components/__tests__/PerfectWeekCard.test.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzePerfectWeek } from '../../lib/athlete/perfectWeek.js'

const MONO = "'IBM Plex Mono', monospace"

const PATTERN_COLOR = {
  HABITUAL_QUALITY: '#5bc25b', // green
  OCCASIONAL:       '#0064ff', // blue
  SPORADIC:         '#ff6600', // orange
}

const PATTERN_LABEL_EN = {
  HABITUAL_QUALITY: 'HABITUAL',
  OCCASIONAL:       'OCCASIONAL',
  SPORADIC:         'SPORADIC',
}

const PATTERN_LABEL_TR = {
  HABITUAL_QUALITY: 'ALIŞKANLIK',
  OCCASIONAL:       'ARA SIRA',
  SPORADIC:         'DÜZENSİZ',
}

const GAP_LABEL_EN = {
  sessions: 'sessions',
  hard:     'hard',
  long:     'long',
}

const GAP_LABEL_TR = {
  sessions: 'seans',
  hard:     'sert',
  long:     'uzun',
}

const HINT_EN = {
  HABITUAL_QUALITY: 'Quality structure is your default — most weeks hit volume, intensity, and a long session. Consistency compounds.',
  OCCASIONAL:       'Some weeks hit the structure, others miss. Identify the recurring gap and protect that slot.',
  SPORADIC:         'Quality structure rarely lands. Pick ONE missing element (sessions / hard / long) and anchor it for 4 weeks.',
}

const HINT_TR = {
  HABITUAL_QUALITY: 'Kaliteli yapı varsayılan — çoğu hafta hacim, yoğunluk ve uzun seansı yakalıyor. Tutarlılık birikiyor.',
  OCCASIONAL:       'Bazı haftalar yapıyı yakalıyor, bazıları kaçırıyor. Tekrarlayan boşluğu belirle ve o slotu koru.',
  SPORADIC:         'Kaliteli yapı nadiren oluşuyor. Eksik bir öğeyi seç (seans / sert / uzun) ve 4 hafta sabitle.',
}

export default function PerfectWeekCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const result = useMemo(
    () => analyzePerfectWeek({ log, today, windowWeeks: 12 }),
    [log, today]
  )

  if (!result) return null

  const color = PATTERN_COLOR[result.pattern] || '#888'
  const patternLabel = isTR ? PATTERN_LABEL_TR[result.pattern] : PATTERN_LABEL_EN[result.pattern]
  const heading = isTR ? 'MÜKEMMEL HAFTA ORANI · 12H' : 'PERFECT WEEK RATIO · 12W'
  const ariaLabel = isTR ? 'Mükemmel hafta oranı kartı' : 'Perfect week ratio card'

  const totalWeeks = result.weeks.length
  const ratePct = Math.round(result.perfectRate * 100)

  const hint = isTR ? HINT_TR[result.pattern] : HINT_EN[result.pattern]

  const gapTranslated = result.mostCommonGap
    ? (isTR ? GAP_LABEL_TR[result.mostCommonGap] : GAP_LABEL_EN[result.mostCommonGap])
    : null

  const missingMostOftenLabel = isTR ? 'en çok eksik' : 'missing most often'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-perfect-week-card
      data-perfect-week-pattern={result.pattern}
      data-perfect-rate={result.perfectRate}
      data-perfect-weeks={result.perfectWeeks}
      data-most-common-gap={result.mostCommonGap ?? ''}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--muted, #888)',
          fontWeight: 700,
        }}>
          {heading}
        </div>
        <div style={{
          fontSize: 9,
          letterSpacing: '0.05em',
          color,
          fontWeight: 700,
        }}>
          {patternLabel}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{
          fontSize: 32,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>
          {result.perfectWeeks}/{totalWeeks}
        </div>
        <div style={{
          fontSize: 12,
          color,
          fontWeight: 700,
        }}>
          {ratePct}%
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          marginLeft: 4,
          lineHeight: 1.4,
        }}>
          {isTR ? 'mükemmel hafta' : 'perfect weeks'}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${totalWeeks}, 1fr)`,
        gap: 4,
        marginBottom: 12,
      }}>
        {result.weeks.map(w => (
          <div
            key={w.weekStart}
            data-week-block
            data-week-start={w.weekStart}
            data-week-perfect={w.isPerfect ? 'true' : 'false'}
            data-week-session-count={w.sessionCount}
            data-week-had-hard={w.hadHard ? 'true' : 'false'}
            data-week-had-long={w.hadLong ? 'true' : 'false'}
            title={`${w.weekStart} · ${w.sessionCount} sessions`}
            style={{
              height: 20,
              borderRadius: 2,
              background: w.isPerfect ? color : 'transparent',
              border: `1px solid ${color}${w.isPerfect ? '' : '66'}`,
            }}
          />
        ))}
      </div>

      {gapTranslated && (
        <div style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          marginBottom: 8,
        }}>
          {missingMostOftenLabel}: <span style={{ color: 'var(--text, #ccc)', fontWeight: 700 }}>{gapTranslated}</span>
        </div>
      )}

      <div style={{
        fontSize: 10,
        color: 'var(--text, #ccc)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {hint}
      </div>

      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {result.citation}
      </div>
    </div>
  )
}
