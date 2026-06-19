// ─── LongRunFrequencyCard.jsx — Long-Session Frequency Tracker (6 months) ────
//
// Surfaces `analyzeLongRunFrequency` (src/lib/athlete/longRunFrequency.js).
// Endurance base building requires REPEATED long-session exposure, not a
// single occasional outlier. This card answers a frequency question:
//
//   "Across the last 6 calendar months, how many long sessions
//    (durationMin ≥ 90) did the athlete actually complete?"
//
// Bands:
//   STRONG_BASE → green   (avgPerMonth ≥ 3.0)
//   DEVELOPING  → blue    (1.5 ≤ avgPerMonth < 3.0)
//   THIN        → orange  (avgPerMonth < 1.5)
//
// Bilingual via LangCtx. Mono terminal aesthetic. Renders null when the
// analyzer returns null (<3 of 6 months have any sessions — log too sparse).
//
// Distinct from LongestSessionTrendCard (length trend per week) and
// LongSessionShareCard (long session as share of weekly volume). This card
// is purely about cadence / habit frequency.
//
// Citations: Daniels 2014; Lydiard 1978; Maffetone 2010.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeLongRunFrequency } from '../../lib/athlete/longRunFrequency.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  STRONG_BASE: '#5bc25b', // green
  DEVELOPING:  '#0064ff', // blue
  THIN:        '#ff6600', // orange
}

const BAND_LABEL_EN = {
  STRONG_BASE: 'STRONG BASE',
  DEVELOPING:  'DEVELOPING',
  THIN:        'THIN',
}

const BAND_LABEL_TR = {
  STRONG_BASE: 'GÜÇLÜ TEMEL',
  DEVELOPING:  'GELİŞEN',
  THIN:        'İNCE',
}

const BAND_HINT_EN = {
  STRONG_BASE: 'Repeated long-session exposure — aerobic base is being maintained.',
  DEVELOPING:  'Some long sessions, not yet weekly habit. 1 more long session per month would solidify the base.',
  THIN:        'Rare long sessions. Add 1 long session every 2-3 weeks before adding intensity.',
}

const BAND_HINT_TR = {
  STRONG_BASE: 'Tekrarlanan uzun seans maruziyeti — aerobik temel korunuyor.',
  DEVELOPING:  'Bazı uzun seanslar var, henüz haftalık alışkanlık değil. Ayda 1 ek uzun seans temeli sağlamlaştırır.',
  THIN:        'Az sayıda uzun seans. Yoğunluk eklemeden önce 2-3 haftada bir uzun seans ekle.',
}

// Turkish 3-letter month labels — index 0 = January.
const MONTH_LABELS_TR = [
  'OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ',
  'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA',
]

// Convert 'YYYY-MM' → Turkish 3-letter label (1-indexed month).
function monthLabelTR(monthStr) {
  if (typeof monthStr !== 'string') return ''
  const parts = monthStr.split('-')
  if (parts.length < 2) return ''
  const idx = Number(parts[1]) - 1
  if (!Number.isInteger(idx) || idx < 0 || idx > 11) return ''
  return MONTH_LABELS_TR[idx]
}

/**
 * @description Dashboard card showing the count of long sessions
 *   (durationMin ≥ 90) per calendar month across the last 6 months.
 *   Renders null when analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
function LongRunFrequencyCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const result = useMemo(
    () => analyzeLongRunFrequency({ log, today }),
    [log, today]
  )

  if (!result) return null

  const { band, totalLongSessions, avgPerMonth, months, longMinThreshold } = result
  const color = BAND_COLOR[band] || '#0064ff'
  const bandLabel = isTR ? (BAND_LABEL_TR[band] || band) : (BAND_LABEL_EN[band] || band)
  const hint = isTR ? BAND_HINT_TR[band] : BAND_HINT_EN[band]
  const title = isTR ? 'UZUN SEANSLAR · 6 AY' : 'LONG SESSIONS · 6 MONTHS'
  const ariaLabel = isTR ? 'Uzun seans frekansı kartı' : 'Long run frequency card'

  // EN label below the big number: e.g. "≥90min sessions / 6mo"
  const minUnit = isTR ? 'dk' : 'min'
  const sessionsLabel = isTR
    ? `≥${longMinThreshold}${minUnit} seans / 6 ay`
    : `≥${longMinThreshold}${minUnit} sessions / 6mo`

  const avgLabel = isTR
    ? `${avgPerMonth.toFixed(1)}/ay ort.`
    : `${avgPerMonth.toFixed(1)}/mo avg`

  // Bar geometry — height proportional to count / maxCount.
  const maxCount = months.reduce((m, mo) => Math.max(m, mo.count), 0)
  const MAX_BAR_H = 56
  const MIN_BAR_H = 3

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-long-run-frequency-card
      data-frequency-band={band}
      data-total-long-sessions={totalLongSessions}
      data-avg-per-month={avgPerMonth}
      data-long-min-threshold={longMinThreshold}
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

      {/* Big total + threshold caption + avg/mo */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 12,
      }}>
        <div
          data-total-display
          style={{
            fontSize: 32,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {totalLongSessions}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          lineHeight: 1.4,
        }}>
          {sessionsLabel}
        </div>
        <div style={{ flex: 1 }} />
        <div
          data-avg-display
          style={{
            fontSize: 12,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {avgLabel}
        </div>
      </div>

      {/* 6 monthly mini bars + labels */}
      <div
        data-month-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: MAX_BAR_H + 4,
          marginBottom: 4,
        }}
      >
        {months.map(mo => {
          const ratio = maxCount > 0 ? (mo.count / maxCount) : 0
          const isEmpty = !(mo.count > 0)
          const h = isEmpty ? MIN_BAR_H : Math.max(4, Math.round(ratio * MAX_BAR_H))
          const monthLabel = isTR ? monthLabelTR(mo.month) : mo.monthLabel
          return (
            <div
              key={mo.month}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                minWidth: 18,
              }}
            >
              <div
                data-month-bar
                data-month={mo.month}
                data-month-label={monthLabel}
                data-month-count={mo.count}
                title={`${monthLabel} · ${mo.count}`}
                style={{
                  width: '100%',
                  height: h,
                  background: isEmpty ? 'var(--muted, #555)' : color,
                  opacity: isEmpty ? 0.35 : 1,
                  borderRadius: 2,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Month labels row (mirror of bars, kept separate for crisp baseline). */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 10,
      }}>
        {months.map(mo => {
          const monthLabel = isTR ? monthLabelTR(mo.month) : mo.monthLabel
          return (
            <div
              key={`lbl-${mo.month}`}
              style={{
                flex: 1,
                fontSize: 9,
                textAlign: 'center',
                color: 'var(--muted, #888)',
                letterSpacing: '0.04em',
                minWidth: 18,
              }}
            >
              {monthLabel}
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
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {hint}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Daniels 2014; Lydiard 1978
      </div>
    </div>
  )
}

export default memo(LongRunFrequencyCard)
