// ─── TrainingAgeCard.jsx — Lloyd 2015 long-term athletic development stage ──
//
// Surfaces `analyzeTrainingAge` (src/lib/athlete/trainingAge.js).
// The pure-fn counts ISO weeks (Mon-Sun) with >= 3 sessions across
// the full log range and maps the cumulative consistent-week total
// onto a Lloyd 2015 development band:
//
//   BEGINNER    — < 26 weeks      (< 6 months)
//   DEVELOPING  — 26..103         (6mo .. 2y)
//   ESTABLISHED — 104..259        (2y .. 5y)
//   VETERAN     — >= 260          (5y+)
//
// Renders null when the pure-fn returns null (empty log).
//
// Citations: Bompa & Buzzichelli (2018) "Periodization: Theory and
// Methodology of Training"; Tønnessen et al. (2014) "Training
// Olympic-Level Elite Endurance Athletes"; Lloyd & Oliver (2015)
// "The Long-Term Athletic Development model".

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeTrainingAge } from '../../lib/athlete/trainingAge.js'

const MONO = "'IBM Plex Mono', monospace"

const STAGE_TR = {
  BEGINNER:    'YENİ',
  DEVELOPING:  'GELİŞEN',
  ESTABLISHED: 'YERLEŞMİŞ',
  VETERAN:     'USTA',
}

const STAGE_COLOR = {
  BEGINNER:    '#888888',
  DEVELOPING:  '#0064ff',
  ESTABLISHED: '#5bc25b',
  VETERAN:     '#ff6600',
}

const STAGE_HINT = {
  BEGINNER: {
    en: 'Less than 6 months of consistent training. Focus on building the habit before chasing intensity.',
    tr: '6 aydan az tutarlı antrenman. Yoğunluk peşinden koşmadan önce alışkanlığı kur.',
  },
  DEVELOPING: {
    en: 'Building athletic base. Adaptations come faster than they ever will again — use it.',
    tr: 'Atletik temel inşası. Adaptasyonlar bundan daha hızlı asla gelmeyecek — bunu kullan.',
  },
  ESTABLISHED: {
    en: 'Solid athletic foundation. Marginal gains require precision — periodization matters more now.',
    tr: 'Sağlam atletik temel. Marjinal kazançlar hassasiyet gerektirir — periyotlama artık daha önemli.',
  },
  VETERAN: {
    en: 'Long-term endurance athlete. Recovery and durability outweigh raw volume.',
    tr: 'Uzun vadeli dayanıklılık sporcusu. Toparlanma ve dayanıklılık ham hacimden daha önemli.',
  },
}

/**
 * @description Render the training-age primary metric.
 *   - "Xy Ymo" if trainingAgeYears >= 1
 *   - "Xmo"    otherwise (uses trainingAgeMonths rounded to integer)
 */
function formatTenure(trainingAgeYears, trainingAgeMonths) {
  if (trainingAgeYears >= 1) {
    const fullYears = Math.floor(trainingAgeYears)
    const remainderMonths = Math.max(
      0,
      Math.round((trainingAgeYears - fullYears) * 12),
    )
    return `${fullYears}y ${remainderMonths}mo`
  }
  const months = Math.max(0, Math.round(trainingAgeMonths))
  return `${months}mo`
}

/**
 * @description Surface `analyzeTrainingAge` as a Dashboard card.
 *
 * @param {{ log: Array }} props
 */
export default function TrainingAgeCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(() => analyzeTrainingAge({ log }), [log])

  if (!analysis) return null
  const stage = analysis.stage
  if (!STAGE_COLOR[stage]) return null

  const color = STAGE_COLOR[stage]
  const hint = STAGE_HINT[stage]
  const stageLabel = isTR ? STAGE_TR[stage] : stage

  const title = isTR ? 'ANTRENMAN YAŞI' : 'TRAINING AGE'
  const ariaLabel = isTR ? 'Antrenman Yaşı' : 'Training Age'

  const tenure = formatTenure(analysis.trainingAgeYears, analysis.trainingAgeMonths)
  const tenureSuffix = isTR ? 'tutarlı antrenman' : 'consistent training'

  const consistencyPct = Math.round(analysis.consistencyRate * 100)
  const consistencyLine = isTR
    ? `Haftaların %${consistencyPct}'i ≥3 seanstı`
    : `${consistencyPct}% of weeks were ≥3 sessions`

  const trackedYears = Math.round((analysis.totalWeeksTracked / 52) * 10) / 10
  const trackedLine = isTR
    ? `${trackedYears} yıllık günlük geçmişi üzerinden`
    : `over ${trackedYears} years of log history`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-training-age-card
      data-development-stage={stage}
      data-training-age-weeks={analysis.trainingAgeWeeks}
      data-consistency-rate={analysis.consistencyRate}
      data-total-weeks-tracked={analysis.totalWeeksTracked}
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
          data-stage-badge
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
          {stageLabel}
        </div>
      </div>

      {/* Primary tenure metric */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 12,
      }}>
        <div
          data-training-age-display
          style={{
            fontSize: 28,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {tenure}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
          {tenureSuffix}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 12,
        fontSize: 10,
        color: 'var(--text)',
        letterSpacing: '0.02em',
      }}>
        <div data-consistency-line>
          {consistencyLine}
        </div>
        <div data-tracked-line style={{ color: 'var(--muted, #888)' }}>
          {trackedLine}
        </div>
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
        {analysis.citation}
      </div>
    </div>
  )
}
