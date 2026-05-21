// ─── TrainingHourBudgetCard.jsx — Weekly Training-Hour Budget Tracker ────────
//
// Surfaces `analyzeTrainingHourBudget` (Hellard 2019; Mujika 2014).
// Tracks TOTAL weekly training hours — irrespective of zone, sport, or
// intensity — over the last 12 ISO weeks. The lifestyle-constraint lens:
// 8-10 h/wk is sustainable on top of work + family, 12+ h/wk verges on
// elite training load.
//
// DIFFERENT from WeeklyEnduranceTimeCard (Z1+Z2 only), WeeklyTssGoalCard
// (TSS target), WeeklyKmPerSportCard (km per sport). This card answers
// "can I sustain this week-after-week alongside my life?"
//
// Bilingual via LangCtx. Returns null only when the pure-fn returns null
// (today unresolvable). With insufficient data (< 6 weeks of any
// training) renders an INSUFFICIENT_DATA state.
//
// Citations: Hellard 2019; Mujika 2014.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeTrainingHourBudget } from '../../lib/athlete/trainingHourBudget.js'

const MONO = "'IBM Plex Mono', monospace"
const BAR_AREA_HEIGHT = 56
const MIN_BAR_H = 3
const MUTED_COLOR = '#888888'

const BAND_COLOR = {
  INSUFFICIENT_DATA: '#888888', // muted
  LIGHT:             '#888888', // muted — below amateur threshold
  AMATEUR:           '#5bc25b', // green
  COMMITTED:         '#0064ff', // blue
  NEAR_PRO:          '#ff6600', // orange (signature)
}

const BAND_LABEL_EN = {
  INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
  LIGHT:             'LIGHT',
  AMATEUR:           'AMATEUR',
  COMMITTED:         'COMMITTED',
  NEAR_PRO:          'NEAR-PRO',
}

const BAND_LABEL_TR = {
  INSUFFICIENT_DATA: 'YETERSİZ VERİ',
  LIGHT:             'HAFİF',
  AMATEUR:           'AMATÖR',
  COMMITTED:         'ADANMIŞ',
  NEAR_PRO:          'PROFESYONELE YAKIN',
}

const HINT_EN = {
  INSUFFICIENT_DATA:
    'Log at least 6 weeks of training to see your sustainable weekly hour budget. The lifestyle-constraint lens needs a base rate first.',
  LIGHT:
    'Under 4 h/wk on average — recreational pace. Plenty of headroom to grow without overrunning lifestyle constraints (Hellard 2019).',
  AMATEUR:
    'Typical recreational athlete (4-8 h/wk). Sustainable on top of work + family for most schedules; aim for steady consistency over peaks.',
  COMMITTED:
    'Serious amateur load (8-12 h/wk) — at the upper limit of what fits sustainably alongside work + family. Guard sleep and recovery (Hellard 2019).',
  NEAR_PRO:
    '12+ h/wk — extraordinary commitment, verging on elite training load. Requires deliberate lifestyle support to avoid burnout (Mujika 2014).',
}

const HINT_TR = {
  INSUFFICIENT_DATA:
    'Sürdürülebilir haftalık saat bütçeni görmek için en az 6 hafta antrenman kaydet. Yaşam-kısıtı bakışı önce taban hızını ister.',
  LIGHT:
    'Ortalama 4 sa/hf altında — rekreasyonel tempo. Yaşam kısıtlarını aşmadan büyümek için bolca alan var (Hellard 2019).',
  AMATEUR:
    'Tipik rekreasyonel sporcu (4-8 sa/hf). İş + aile üstüne çoğu programda sürdürülebilir; zirveden çok tutarlılığa odaklan.',
  COMMITTED:
    'Ciddi amatör yük (8-12 sa/hf) — iş + aile yanında sürdürülebilirliğin üst sınırı. Uyku ve toparlanmayı koru (Hellard 2019).',
  NEAR_PRO:
    '12+ sa/hf — olağanüstü adanmışlık, elit antrenman yüküne yaklaşıyorsun. Tükenmişlikten kaçınmak için bilinçli yaşam desteği şart (Mujika 2014).',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function formatHours(h) {
  const v = Number(h)
  if (!Number.isFinite(v) || v <= 0) return '0h'
  const rounded = Math.round(v * 10) / 10
  return `${rounded.toFixed(1)}h`
}

function formatSlope(slope) {
  const v = Number(slope)
  if (!Number.isFinite(v)) return '—'
  const rounded = Math.round(v * 100) / 100
  if (rounded > 0) return `↑ +${rounded.toFixed(2)}h/wk`
  if (rounded < 0) return `↓ ${rounded.toFixed(2)}h/wk`
  return '→ 0.00h/wk'
}

// Lower bound (in hours/week) of the next higher band — used to draw a
// reference target line on the 12-bar chart.
function targetHoursFor(band) {
  switch (band) {
    case 'LIGHT':     return 4   // next band: AMATEUR floor
    case 'AMATEUR':   return 8   // next band: COMMITTED floor
    case 'COMMITTED': return 12  // next band: NEAR_PRO floor
    case 'NEAR_PRO':  return 12  // marker stays at NEAR_PRO floor
    default:          return 4   // INSUFFICIENT_DATA — show AMATEUR floor
  }
}

/**
 * Dashboard card for total weekly training hours (12 ISO weeks).
 *
 * @param {{ log: Array }} props
 */
export default function TrainingHourBudgetCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeTrainingHourBudget({ log, today: todayIso(), windowWeeks: 12 }),
    [log]
  )

  if (!result) return null

  const {
    band,
    weeks,
    meanHoursPerWeek,
    maxHoursPerWeek,
    totalHours,
    trendDeltaPerWeek,
    citation,
  } = result

  const color = BAND_COLOR[band] || MUTED_COLOR
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'HAFTALIK SAAT BÜTÇESİ · 12H' : 'WEEKLY HOUR BUDGET · 12W'
  const ariaLabel = isTR
    ? 'Haftalık saat bütçesi kartı (Hellard 2019; Mujika 2014)'
    : 'Weekly hour budget card (Hellard 2019; Mujika 2014)'

  const meanLabel = isTR ? 'ort. sa/hf' : 'h/wk avg'
  const peakLabel = isTR ? 'tepe' : 'peak'
  const totalLabel = isTR ? '12h toplam' : '12w total'
  const slopeLabel = isTR ? 'eğim' : 'trend'
  const targetHint = isTR
    ? 'hafif <4 · amatör 4-8 · adanmış 8-12 · profesyonele yakın 12+ sa/hf'
    : 'light <4 · amateur 4-8 · committed 8-12 · near-pro 12+ h/wk'

  // Reference target line — drawn at the next band floor.
  const targetH = targetHoursFor(band)

  // Scale bars against whichever is larger: the in-window max OR the
  // target line, so the line is always visible above the data when
  // appropriate (e.g. LIGHT users with the AMATEUR-floor target).
  const maxBarValue = Math.max(maxHoursPerWeek, targetH, 0.001)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="training-hour-budget"
      data-band={band}
      data-mean-hours-per-week={meanHoursPerWeek}
      data-max-hours-per-week={maxHoursPerWeek}
      data-total-hours={totalHours}
      data-trend-delta-per-week={trendDeltaPerWeek}
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
          <div data-mean-display style={{
            fontSize: 28, fontWeight: 700, color, lineHeight: 1,
          }}>
            {formatHours(meanHoursPerWeek)}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--muted, #888)', marginTop: 4,
            letterSpacing: '0.05em',
          }}>
            {meanLabel}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div data-peak-display style={{
            fontSize: 12, color: 'var(--text)', fontWeight: 700,
          }}>
            {peakLabel}: {formatHours(maxHoursPerWeek)}
          </div>
          <div data-total-display style={{
            fontSize: 12, color: 'var(--text)', fontWeight: 700, marginTop: 4,
          }}>
            {totalLabel}: {formatHours(totalHours)}
          </div>
          <div data-trend-display style={{
            fontSize: 12, color, fontWeight: 700, marginTop: 4,
          }}>
            {slopeLabel}: {formatSlope(trendDeltaPerWeek)}
          </div>
        </div>
      </div>

      {/* 12 vertical bars — one per ISO week. Band-target line drawn across. */}
      <div
        data-week-bars
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: BAR_AREA_HEIGHT + 4,
          marginTop: 6,
          marginBottom: 10,
        }}
      >
        {weeks.map(w => {
          const hasData = w.hours > 0
          const barH = hasData
            ? Math.max(MIN_BAR_H, Math.round((w.hours / maxBarValue) * BAR_AREA_HEIGHT))
            : MIN_BAR_H
          return (
            <div
              key={w.weekStart}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-hours={w.hours}
              title={`${w.weekStart} · ${formatHours(w.hours)}`}
              style={{
                flex: 1,
                position: 'relative',
                height: barH,
                background: hasData ? color : `${MUTED_COLOR}22`,
                border: `1px solid ${hasData ? color : MUTED_COLOR}`,
                borderRadius: 2,
                minWidth: 6,
                opacity: hasData ? 1 : 0.5,
              }}
            />
          )
        })}
        {/* Band-target reference line */}
        <div
          data-target-line
          data-target-hours={targetH}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: Math.round((targetH / maxBarValue) * BAR_AREA_HEIGHT),
            height: 0,
            borderTop: `1px dashed ${color}`,
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        />
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
          marginBottom: 6,
        }}
      >
        {hint}
      </div>

      {/* Target band hint */}
      <div
        data-target-hint
        style={{
          fontSize: 9,
          color: 'var(--muted, #888)',
          marginBottom: 6,
          letterSpacing: '0.03em',
        }}
      >
        {targetHint}
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
