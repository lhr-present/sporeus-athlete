// ─── RestDayEnergyTrendCard.jsx — 30d rest-day vs training-day energy gap ───
//
// Dashboard surface for `analyzeRestDayEnergyTrend` (Lemyre 2007 + Kellmann
// 2018 burnout / under-recovery framing). Surfaces:
//
//   1. Rest-day mean (green) vs training-day mean (orange), side-by-side.
//   2. The energy gap as a large signed number ("+1.4" / "-0.3") with arrow.
//   3. The 8-week slope of that gap ("+/-0.X /week").
//   4. A band-coloured interpretation strip with bilingual EN/TR copy
//      explaining the Lemyre framing.
//   5. Citation footer.
//
// Band colours match the rest of the dashboard's wellness/affect family:
//   BURNOUT_SIGNAL → red       — rest no longer restores or trend collapsing
//   WARNING        → orange    — small positive gap and shrinking
//   NEUTRAL        → blue      — moderate but stable
//   WELL_RESTORED  → green     — textbook restoration, rest is working
//
// Citation: Lemyre 2007; Kellmann 2018.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeRestDayEnergyTrend } from '../../lib/athlete/restDayEnergyTrend.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  WELL_RESTORED:  '#5bc25b', // green
  NEUTRAL:        '#0064ff', // blue
  WARNING:        '#ff6600', // orange
  BURNOUT_SIGNAL: '#ff4444', // red
}

const BAND_TR = {
  WELL_RESTORED:  'İYİ TOPARLANIYOR',
  NEUTRAL:        'NÖTR',
  WARNING:        'UYARI',
  BURNOUT_SIGNAL: 'TÜKENMİŞLİK SİNYALİ',
}

const BAND_HINT = {
  WELL_RESTORED: {
    en: 'Rest days restore meaningfully — energy is reliably higher on rest. Adaptation is on track (Lemyre 2007).',
    tr: 'Dinlenme günleri belirgin biçimde toparlıyor — enerji dinlenmede güvenilir biçimde daha yüksek. Adaptasyon yolunda (Lemyre 2007).',
  },
  NEUTRAL: {
    en: 'Rest is producing a modest energy lift over training days — normal. Watch the trend.',
    tr: 'Dinlenme, antrenman günlerine göre ölçülü bir enerji artışı sağlıyor — normal. Eğilime dikkat.',
  },
  WARNING: {
    en: 'Restoration gap is small AND shrinking — early under-recovery signal. Reduce intensity for a week.',
    tr: 'Toparlanma farkı küçük VE daralıyor — erken yetersiz toparlanma sinyali. Bir hafta yoğunluğu düşür.',
  },
  BURNOUT_SIGNAL: {
    en: 'Rest no longer restores — energy on rest days matches or undershoots training. Classic Lemyre burnout signal: insert a deload.',
    tr: 'Dinlenme artık toparlamıyor — dinlenme günlerinde enerji antrenmana eşit ya da daha düşük. Klasik Lemyre tükenmişlik sinyali: bir deload haftası ekle.',
  },
}

/**
 * Format a signed gap value to one decimal place with explicit +/-.
 * 0.0 displayed without a leading sign.
 */
function fmtGap(v) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 0.05) return '0.0'
  const sign = v > 0 ? '+' : '-'
  return `${sign}${Math.abs(v).toFixed(1)}`
}

/** Arrow glyph matching the sign of the gap. */
function gapArrow(v) {
  if (!Number.isFinite(v)) return ''
  if (Math.abs(v) < 0.05) return '·'
  return v > 0 ? '↑' : '↓'
}

/**
 * Format a trend-slope value to one decimal place per week.
 * Returns "—" for null/undefined.
 */
function fmtTrend(v) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 0.05) return '0.0'
  const sign = v > 0 ? '+' : '-'
  return `${sign}${Math.abs(v).toFixed(1)}`
}

/** Format a 1-10 energy mean to one decimal place. */
function fmtMean(v) {
  if (!Number.isFinite(v)) return '—'
  return v.toFixed(1)
}

/**
 * Dashboard card for the 30-day rest-day vs training-day energy gap +
 * 8-week trend. Renders null when analyze returns null.
 *
 * @param {{ log: Array, recovery: Array }} props
 */
function RestDayEnergyTrendCard({ log, recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeRestDayEnergyTrend({ log, recovery }),
    [log, recovery],
  )

  if (!analysis) return null

  const color = BAND_COLOR[analysis.band]
  if (!color) return null

  const bandLabel = isTR ? BAND_TR[analysis.band] : analysis.band.replace('_', ' ')
  const hint = BAND_HINT[analysis.band]

  const title = isTR
    ? 'DİNLENME GÜNÜ TOPARLANMASI · 30G'
    : 'REST-DAY RESTORATION · 30D'
  const ariaLabel = isTR
    ? 'Dinlenme günü toparlanması'
    : 'Rest-day energy restoration'

  const restLabel = isTR ? 'DİNLENME' : 'REST'
  const trainLabel = isTR ? 'ANTRENMAN' : 'TRAINING'
  const gapLabel = isTR ? 'FARK (D − A)' : 'GAP (R − T)'
  const trendLabel = isTR ? 'EĞİLİM' : 'TREND'
  const perWeekLabel = isTR ? '/hf' : '/wk'
  const sampleLabel = isTR
    ? `${analysis.restDayCount} dinlenme · ${analysis.trainingDayCount} antrenman`
    : `${analysis.restDayCount} rest · ${analysis.trainingDayCount} training`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="rest-day-energy-trend"
      data-band={analysis.band}
      data-energy-gap={analysis.energyGap !== null ? analysis.energyGap.toFixed(2) : ''}
      data-trend-per-week={analysis.trendDeltaPerWeek !== null
        ? analysis.trendDeltaPerWeek.toFixed(4)
        : ''}
      data-rest-mean={analysis.recentRestDayMean !== null
        ? analysis.recentRestDayMean.toFixed(2)
        : ''}
      data-training-mean={analysis.recentTrainingDayMean !== null
        ? analysis.recentTrainingDayMean.toFixed(2)
        : ''}
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
      {/* Header — title + band badge */}
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

      {/* Sample counts */}
      <div style={{
        fontSize: 10,
        color: 'var(--muted, #888)',
        marginBottom: 12,
      }}>
        {sampleLabel}
      </div>

      {/* Side-by-side rest vs training means */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
      }}>
        <div
          data-stat="rest"
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--surface, #1a1a1a)',
            border: '1px solid var(--border, #222)',
            borderRadius: 3,
          }}
        >
          <div style={{
            fontSize: 9,
            letterSpacing: '0.05em',
            color: 'var(--muted, #888)',
            fontWeight: 700,
            marginBottom: 4,
          }}>
            {restLabel}
          </div>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#5bc25b',
            lineHeight: 1,
          }}>
            {fmtMean(analysis.recentRestDayMean)}
          </div>
        </div>
        <div
          data-stat="training"
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--surface, #1a1a1a)',
            border: '1px solid var(--border, #222)',
            borderRadius: 3,
          }}
        >
          <div style={{
            fontSize: 9,
            letterSpacing: '0.05em',
            color: 'var(--muted, #888)',
            fontWeight: 700,
            marginBottom: 4,
          }}>
            {trainLabel}
          </div>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#ff6600',
            lineHeight: 1,
          }}>
            {fmtMean(analysis.recentTrainingDayMean)}
          </div>
        </div>
      </div>

      {/* Large gap stat with arrow + trend slope */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
        padding: '10px 12px',
        background: 'var(--surface, #1a1a1a)',
        border: '1px solid var(--border, #222)',
        borderRadius: 3,
      }}>
        <div>
          <div style={{
            fontSize: 9,
            letterSpacing: '0.05em',
            color: 'var(--muted, #888)',
            fontWeight: 700,
            marginBottom: 4,
          }}>
            {gapLabel}
          </div>
          <div
            data-gap-value
            style={{
              fontSize: 28,
              fontWeight: 700,
              color,
              lineHeight: 1,
            }}
          >
            <span aria-hidden="true" style={{ marginRight: 6 }}>
              {gapArrow(analysis.energyGap)}
            </span>
            {fmtGap(analysis.energyGap)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 9,
            letterSpacing: '0.05em',
            color: 'var(--muted, #888)',
            fontWeight: 700,
            marginBottom: 4,
          }}>
            {trendLabel}
          </div>
          <div
            data-trend-value
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1,
            }}
          >
            {fmtTrend(analysis.trendDeltaPerWeek)} {perWeekLabel}
          </div>
        </div>
      </div>

      {/* Interpretation strip */}
      <div
        data-band-hint
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
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Lemyre 2007; Kellmann 2018
      </div>
    </div>
  )
}

export default memo(RestDayEnergyTrendCard)
