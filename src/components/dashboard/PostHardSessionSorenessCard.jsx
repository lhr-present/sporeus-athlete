// ─── PostHardSessionSorenessCard.jsx ─────────────────────────────────────
// Surfaces `analyzePostHardSessionSoreness` (Kellmann 2018; Lemyre 2007):
// tracks the typical SORENESS score the morning AFTER each hard training
// session, compared to the athlete's baseline soreness mean over the
// last 60 days.
//
// Bands:
//   FAST_RECOVERY        — elevation < 0.5 (barely above baseline)
//   NORMAL               — 0.5 <= elevation < 1.5 (textbook DOMS pattern)
//   PROLONGED_SORENESS   — elevation >= 1.5 (incomplete recovery signal)
//   INSUFFICIENT_HARD_DATA — fewer than 5 hard events with matched soreness
//
// Distinct from sibling cards:
//   - PostHardSessionResponseCard      — sleep/RHR/HRV deltas vs baseline
//   - EnergySorenessDivergenceCard     — 28d energy × soreness quadrant
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-card="post-hard-session-soreness", data-band,
//   data-hard-event-count, data-mean-next-day-soreness,
//   data-baseline-mean-soreness, data-soreness-elevation.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzePostHardSessionSoreness } from '../../lib/athlete/postHardSessionSoreness.js'

const MONO = "'IBM Plex Mono', monospace"
const WINDOW_DAYS = 60

const BAND_COLOR = {
  FAST_RECOVERY:          '#5bc25b', // green
  NORMAL:                 '#0064ff', // blue
  PROLONGED_SORENESS:     '#e03030', // red
  INSUFFICIENT_HARD_DATA: '#888888', // grey
}

const BAND_LABEL_EN = {
  FAST_RECOVERY:          'FAST',
  NORMAL:                 'NORMAL',
  PROLONGED_SORENESS:     'PROLONGED',
  INSUFFICIENT_HARD_DATA: 'INSUFFICIENT',
}
const BAND_LABEL_TR = {
  FAST_RECOVERY:          'HIZLI',
  NORMAL:                 'NORMAL',
  PROLONGED_SORENESS:     'UZAYAN',
  INSUFFICIENT_HARD_DATA: 'YETERSİZ',
}

const HINT_EN = {
  FAST_RECOVERY:
    'Day-after-hard soreness is barely above baseline. Either you are adapting well — or your hard sessions are not stimulating enough to drive change.',
  NORMAL:
    'Soreness elevates moderately the day after hard work — textbook DOMS pattern. Recovery is on track.',
  PROLONGED_SORENESS:
    'Hard sessions are leaving markedly elevated soreness the next day. Recovery is incomplete — extend easy days or reduce intensity dose.',
  INSUFFICIENT_HARD_DATA:
    'Need at least 5 hard sessions (TSS ≥ 80) with a recorded next-day soreness score in the last 60 days.',
}
const HINT_TR = {
  FAST_RECOVERY:
    'Sert seans sonrası ağrı, temel seviyenin az üstünde. Ya iyi adapte oluyorsun — ya da sert seansların yeterince uyaran üretmiyor.',
  NORMAL:
    'Sert iş sonrası ağrı ölçülü şekilde yükseliyor — tipik DOMS deseni. Toparlanma rayında.',
  PROLONGED_SORENESS:
    'Sert seanslar ertesi gün belirgin yüksek ağrı bırakıyor. Toparlanma eksik — kolay günleri uzat veya yoğunluk dozunu azalt.',
  INSUFFICIENT_HARD_DATA:
    'Son 60 günde en az 5 sert seans (TSS ≥ 80) ve ertesi gün kaydedilmiş ağrı puanı gerekli.',
}

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
                  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatDateLabel(iso, isTR) {
  if (!iso || iso.length < 10) return ''
  const months = isTR ? MONTH_TR : MONTH_EN
  const m = Number(iso.slice(5, 7)) - 1
  const d = Number(iso.slice(8, 10))
  if (Number.isNaN(m) || Number.isNaN(d) || m < 0 || m > 11) return iso
  return isTR ? `${d} ${months[m]}` : `${months[m]} ${d}`
}

function fmtNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function fmtElevation(value) {
  if (!Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '0.0'
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded.toFixed(1)}`
}

/**
 * @description Surface `analyzePostHardSessionSoreness` as a Dashboard
 *   card. Renders null when the analyzer returns null. Requires BOTH
 *   `log` AND `recovery` props.
 *
 * @param {{ log: Array, recovery: Array }} props
 */
function PostHardSessionSorenessCard({ log = [], recovery = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = useMemo(() => todayIso(), [])

  const analysis = useMemo(
    () => analyzePostHardSessionSoreness({
      log,
      recovery,
      today,
      windowDays: WINDOW_DAYS,
    }),
    [log, recovery, today],
  )

  // Most-recent events first (analyzer returns oldest-first via sort).
  const recentEvents = useMemo(() => {
    if (!analysis) return []
    return analysis.events.slice(-3).reverse()
  }, [analysis])

  if (!analysis) return null

  const {
    band,
    hardEventCount,
    meanNextDaySoreness,
    baselineMeanSoreness,
    sorenessElevation,
    citation,
  } = analysis

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'SERT SONRASI AĞRI' : 'DAY-AFTER-HARD SORENESS'
  const ariaLabel = isTR
    ? 'Sert seans sonrası ağrı deseni (Kellmann 2018; Lemyre 2007)'
    : 'Day-after-hard soreness pattern (Kellmann 2018; Lemyre 2007)'

  const meanLabelEN = 'post-hard mean'
  const meanLabelTR = 'sert sonrası ort.'
  const baselineLabelEN = 'baseline mean'
  const baselineLabelTR = 'temel ortalama'
  const elevationLabelEN = 'elevation'
  const elevationLabelTR = 'artış'
  const eventsLabelEN = `${hardEventCount} hard sessions · last ${WINDOW_DAYS}d`
  const eventsLabelTR = `${hardEventCount} sert seans · son ${WINDOW_DAYS}g`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="post-hard-session-soreness"
      data-band={band}
      data-hard-event-count={String(hardEventCount)}
      data-mean-next-day-soreness={String(meanNextDaySoreness)}
      data-baseline-mean-soreness={String(baselineMeanSoreness)}
      data-soreness-elevation={String(sorenessElevation)}
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
      {/* Title + band badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 8, flexWrap: 'wrap',
      }}>
        <div
          data-post-hard-soreness-title
          style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}
        >
          {title}
        </div>
        <div
          data-band-label
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color, padding: '2px 8px',
            border: `1px solid ${color}`, borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Event count caption */}
      <div style={{
        fontSize: 10, color: 'var(--muted, #888)', marginTop: 6,
      }}>
        {isTR ? eventsLabelTR : eventsLabelEN}
      </div>

      {/* Two stats side-by-side: post-hard mean + baseline mean */}
      <div
        data-soreness-stats
        style={{
          display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap',
        }}
      >
        <div data-mean-stat>
          <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>
            {fmtNumber(meanNextDaySoreness, 2)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)',
            marginTop: 2, letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {isTR ? meanLabelTR : meanLabelEN}
          </div>
        </div>
        <div data-baseline-stat>
          <div style={{ fontSize: 24, fontWeight: 700,
                        color: 'var(--text, #ccc)', lineHeight: 1 }}>
            {fmtNumber(baselineMeanSoreness, 2)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)',
            marginTop: 2, letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {isTR ? baselineLabelTR : baselineLabelEN}
          </div>
        </div>
        <div data-elevation-stat>
          <div style={{
            fontSize: 24, fontWeight: 700, color,
            lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4,
          }}>
            <span data-elevation-arrow style={{ fontSize: 14 }}>
              {sorenessElevation > 0 ? '▲' : sorenessElevation < 0 ? '▼' : '·'}
            </span>
            <span>{fmtElevation(sorenessElevation)}</span>
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)',
            marginTop: 2, letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {isTR ? elevationLabelTR : elevationLabelEN}
          </div>
        </div>
      </div>

      {/* Recent event chips (up to 3, newest first) */}
      {recentEvents.length > 0 ? (
        <div
          data-event-chips
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12,
          }}
        >
          {recentEvents.map((ev, i) => {
            const dateTxt = formatDateLabel(ev.hardDate, isTR)
            const tssTxt = Math.round(ev.hardDayTss)
            const sorenessTxt = ev.nextDaySoreness == null
              ? (isTR ? '—' : '—')
              : `${ev.nextDaySoreness}/10`
            const tail = isTR
              ? `${sorenessTxt} ağrı`
              : `${sorenessTxt} soreness`
            return (
              <div
                key={ev.hardDate || i}
                data-event-chip
                data-chip-hard-date={ev.hardDate}
                style={{
                  fontSize: 9, padding: '3px 6px',
                  border: `1px solid ${color}`, borderRadius: 3,
                  color: 'var(--text, #ccc)',
                  background: 'var(--surface, #111)',
                  lineHeight: 1.4,
                }}
              >
                {dateTxt} ({tssTxt} TSS) → {tail}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Band-coloured interpretation strip */}
      <div
        data-band-hint
        style={{
          marginTop: 10, padding: '6px 8px',
          background: 'var(--surface, #111)', borderRadius: 4,
          borderLeft: `2px solid ${color}`,
          fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
        }}
      >
        ↗ {hint}
      </div>

      {/* Citation */}
      <div
        data-post-hard-soreness-citation
        style={{
          marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
        }}
      >
        {citation}
      </div>
    </div>
  )
}

export default memo(PostHardSessionSorenessCard)
