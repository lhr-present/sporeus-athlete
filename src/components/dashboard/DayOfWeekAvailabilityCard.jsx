// ─── dashboard/DayOfWeekAvailabilityCard.jsx — Weekday availability viz ─────
// Surfaces analyzeDayOfWeekAvailability(): the athlete's TRAINING FREQUENCY
// per day-of-week (% of Mondays trained, % of Tuesdays, etc.) over the last
// 12 weeks. Reveals anchor days (always trained) vs weak days (often missed).
// Distinct from AverageWeekShapeCard (which measures typical TSS per weekday).
// Cite: Bompa 2018 microcycle availability; Issurin 2010 block scheduling.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeDayOfWeekAvailability } from '../../lib/athlete/dayOfWeekAvailability.js'

// ─── Palette ────────────────────────────────────────────────────────────────
const PATTERN_COLOR = {
  STRUCTURED:    '#5bc25b',
  OPPORTUNISTIC: '#0064ff',
  SPARSE:        '#888',
}

const PATTERN_LABEL = {
  STRUCTURED:    { en: 'STRUCTURED',    tr: 'YAPILI' },
  OPPORTUNISTIC: { en: 'OPPORTUNISTIC', tr: 'FIRSAT' },
  SPARSE:        { en: 'SPARSE',        tr: 'SEYREK' },
}

const PATTERN_HINT = {
  STRUCTURED: {
    en: 'Clear weekly pattern — anchor days hold reliably, weak days are predictable. Plan around it.',
    tr: 'Net haftalık desen — sabit günler güvenilir, zayıf günler öngörülebilir. Buna göre planla.',
  },
  OPPORTUNISTIC: {
    en: 'Training opportunistically — no consistent weekly anchors. Anchoring 2-3 specific days would compound.',
    tr: 'Fırsata göre antrenman — tutarlı haftalık sabitler yok. 2-3 belirli günü sabitlemek birikim yaratır.',
  },
  SPARSE: {
    en: 'Low overall training frequency — focus on volume before optimizing day-of-week placement.',
    tr: 'Düşük genel antrenman frekansı — gün-yerleşimini optimize etmeden önce hacme odaklan.',
  },
}

const ANCHOR_THRESHOLD = 0.75
const WEAK_THRESHOLD   = 0.25

// ─── Chart constants ────────────────────────────────────────────────────────
const SVG_W = 224
const SVG_H = 64
const PAD_X = 4
const BAR_GAP = 4
const BAR_W = Math.floor(((SVG_W - 2 * PAD_X) - BAR_GAP * 6) / 7)
const CHART_H = SVG_H

export default function DayOfWeekAvailabilityCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeDayOfWeekAvailability({ log }), [log])

  if (!result) return null

  const { pattern, days, anchorDays, weakDays, averageRate, citation } = result
  const accent = PATTERN_COLOR[pattern] || PATTERN_COLOR.OPPORTUNISTIC
  const patternLbl = PATTERN_LABEL[pattern]?.[isTR ? 'tr' : 'en'] || pattern
  const hint = PATTERN_HINT[pattern]?.[isTR ? 'tr' : 'en'] || ''

  const title = isTR ? 'HAFTA GÜNÜ MÜSAİTLİK · 12H' : 'DAY-OF-WEEK AVAILABILITY · 12W'

  // Bars: height proportional to rate (0..1). Max rate is always ≤ 1.
  const maxRate = 1

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Hafta günü müsaitlik' : 'Day-of-week availability'}
      data-day-of-week-availability-card
      data-availability-pattern={pattern}
      data-average-rate={averageRate}
      data-anchor-day-count={anchorDays.length}
      data-weak-day-count={weakDays.length}
      style={{ ...S.card, borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Pattern badge */}
      <div style={{
        display: 'inline-block',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '11px',
        fontWeight: 700,
        color: '#fff',
        background: accent,
        padding: '4px 10px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginBottom: '12px',
      }}>
        {patternLbl}
      </div>

      {/* 7-bar mini chart */}
      <div style={{ marginBottom: '10px' }}>
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-label={isTR ? 'Hafta günü antrenman oranı' : 'Weekday training rate'}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {days.map((d, i) => {
            const ratio = d.rate / maxRate
            const barH = Math.max(2, Math.round(ratio * (CHART_H - 4)))
            const x = PAD_X + i * (BAR_W + BAR_GAP)
            const y = CHART_H - barH
            const isAnchor = d.rate >= ANCHOR_THRESHOLD
            const isWeak   = d.rate <= WEAK_THRESHOLD
            // Anchor → full band color. Weak → muted grey. Neutral → semi-band.
            const fill = isAnchor
              ? accent
              : isWeak
                ? '#88888855'
                : `${accent}66`
            const stroke = isAnchor ? accent : 'none'
            return (
              <rect
                key={d.dayIndex}
                data-day-bar
                data-day-index={d.dayIndex}
                data-day-rate={d.rate}
                data-day-count={d.count}
                data-is-anchor={isAnchor ? 'true' : 'false'}
                data-is-weak={isWeak ? 'true' : 'false'}
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                fill={fill}
                stroke={stroke}
                strokeWidth={isAnchor ? 1 : 0}
                rx={1}
              />
            )
          })}
        </svg>
        {/* Day labels under bars */}
        <div style={{
          display: 'flex',
          width: SVG_W,
          paddingLeft: PAD_X,
          marginTop: '4px',
        }}>
          {days.map((d, i) => {
            const isAnchor = d.rate >= ANCHOR_THRESHOLD
            const isWeak   = d.rate <= WEAK_THRESHOLD
            return (
              <div
                key={d.dayIndex}
                style={{
                  width: BAR_W,
                  marginRight: i < 6 ? BAR_GAP : 0,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '9px',
                  fontWeight: 600,
                  color: isAnchor ? accent : (isWeak ? 'var(--muted)' : 'var(--muted)'),
                  letterSpacing: '0.04em',
                  textAlign: 'center',
                }}
              >
                {isTR ? d.dayLabelTr : d.dayLabelEn}
              </div>
            )
          })}
        </div>
      </div>

      {/* Interpretation hint */}
      {hint ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.55,
          paddingLeft: '8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: '8px',
        }}>
          {hint}
        </div>
      ) : null}

      {/* Citation */}
      <div style={{
        ...S.mono,
        fontSize: '9px',
        color: '#555',
        marginTop: '4px',
        letterSpacing: '0.04em',
      }}>
        {citation}
      </div>
    </div>
  )
}
