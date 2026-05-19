// src/components/dashboard/YearOverYearCard.jsx
// Surfaces analyzeYearOverYear — same-calendar-day YTD comparison vs the
// previous year. Distinct from SeasonStats (annual snapshot) and
// MonthlyProgress (month-over-month) — this is the long-horizon, calendar-
// anchored progression view that block periodization and elite endurance
// development models care about.
//
// Renders nothing when the pure-fn returns null.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeYearOverYear } from '../../lib/athlete/yearOverYear.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  AHEAD:    '#5bc25b',
  MATCHING: '#0064ff',
  BEHIND:   '#ff6600',
}

const BAND_LABEL_EN = {
  AHEAD:    'AHEAD',
  MATCHING: 'MATCHING',
  BEHIND:   'BEHIND',
}
const BAND_LABEL_TR = {
  AHEAD:    'ÖNDE',
  MATCHING: 'EŞİT',
  BEHIND:   'GERİDE',
}

const HINT_EN = {
  AHEAD:    "You're trending ahead of last year at the same point — solid YoY progression.",
  MATCHING: "Tracking last year's pace — consistency over time builds capacity.",
  BEHIND:   "Behind last year's YTD volume. Check whether this is intentional (recovery, life) or unintentional drift.",
}
const HINT_TR = {
  AHEAD:    'Geçen yılın aynı dönemine göre öndesin — sağlam yıllık ilerleme.',
  MATCHING: 'Geçen yılın hızını yakalıyorsun — zaman içinde tutarlılık kapasite üretir.',
  BEHIND:   'Geçen yılın hacminin gerisinde. Bilinçli mi (toparlanma, yaşam) yoksa istem dışı kayma mı kontrol et.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function fmtPct(x) {
  if (x == null || !Number.isFinite(x)) return '—'
  const pct = x * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function rowDeltaColor(d) {
  if (d == null || !Number.isFinite(d)) return 'var(--muted, #888)'
  if (d >= 0.10) return '#5bc25b'
  if (d <= -0.10) return '#ff6600'
  return '#0064ff'
}

export default function YearOverYearCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => analyzeYearOverYear({ log, today: todayIso() }),
    [log]
  )

  if (!data) return null

  const { band, aggregateTrend, thisYear, lastYear, deltas, citation } = data

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'YIL vs GEÇEN YIL · YIL BAŞINDAN' : 'YEAR vs LAST YEAR · YTD'
  const ariaLabel = isTR
    ? 'Yıl içi antrenman karşılaştırması'
    : 'Year-over-year YTD training comparison'

  const sessionsLbl = isTR ? 'ANTRENMAN' : 'SESSIONS'
  const hoursLbl    = isTR ? 'SAAT'      : 'HOURS'
  const tssLbl      = 'TSS'

  const thisYearHours = Math.round((thisYear.minutes || 0) / 60)
  const lastYearHours = Math.round((lastYear.minutes || 0) / 60)

  const rows = [
    { metric: 'sessions', label: sessionsLbl, thisYearVal: thisYear.sessions, lastYearVal: lastYear.sessions, delta: deltas.sessions },
    { metric: 'hours',    label: hoursLbl,    thisYearVal: thisYearHours,     lastYearVal: lastYearHours,     delta: deltas.minutes },
    { metric: 'tss',      label: tssLbl,      thisYearVal: thisYear.tss,      lastYearVal: lastYear.tss,      delta: deltas.tss },
  ]

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-year-over-year-card
      data-yoy-band={band}
      data-yoy-aggregate-trend={aggregateTrend == null ? '' : String(aggregateTrend)}
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
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, flexWrap: 'wrap', marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
          color: 'var(--text, #ccc)',
        }}>
          ◈ {title}
        </div>
        <div
          data-yoy-band-label
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            color, padding: '2px 8px',
            border: `1px solid ${color}`, borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Aggregate trend — big number */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 32, fontWeight: 700, color, lineHeight: 1,
        }}>
          {fmtPct(aggregateTrend)}
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 4, letterSpacing: '0.05em' }}>
          {isTR ? 'TOPLAM EĞİLİM' : 'AGGREGATE TREND'}
        </div>
      </div>

      {/* Stat-pair rows */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12,
      }}>
        {rows.map(({ metric, label, thisYearVal, lastYearVal, delta }) => (
          <div
            key={metric}
            data-yoy-row
            data-yoy-metric={metric}
            data-yoy-this-year={String(thisYearVal)}
            data-yoy-last-year={String(lastYearVal)}
            data-yoy-delta={delta == null ? '' : String(delta)}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr 1fr 70px',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              background: 'var(--surface, #111)',
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
              color: 'var(--muted, #888)',
            }}>
              {label}
            </span>
            <span style={{ color: 'var(--text, #ccc)', fontWeight: 600 }}>
              {thisYearVal}
            </span>
            <span style={{ color: 'var(--muted, #888)' }}>
              {lastYearVal}
            </span>
            <span style={{
              textAlign: 'right',
              fontWeight: 700,
              color: rowDeltaColor(delta),
            }}>
              {fmtPct(delta)}
            </span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div style={{
        padding: '8px 10px',
        background: 'var(--surface, #111)',
        borderRadius: 4,
        fontSize: 10,
        color: 'var(--muted, #aaa)',
        lineHeight: 1.5,
        marginBottom: 8,
      }}>
        ↗ {hint}
      </div>

      {/* Citation */}
      <div style={{
        fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
