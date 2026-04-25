// ─── dashboard/PlanScoreCard.jsx — E48: Plan Score Card ─────────────────────
// Displays plan quality score (0-100) and peak form window from Banister model.
// Source: Banister & Calvert (1980) — Modeling elite athletic performance
import { memo, useMemo, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computePlanScore } from '../../lib/athlete/planScore.js'

const SCORE_COLOR = score =>
  score >= 75 ? '#5bc25b' : score >= 50 ? '#f5c542' : '#e03030'

function gradeLabel(score, lang) {
  if (score >= 75) return lang === 'tr' ? 'MÜKEMMEL'       : 'EXCELLENT'
  if (score >= 50) return lang === 'tr' ? 'İYİ'            : 'GOOD'
  return                  lang === 'tr' ? 'GELİŞTİRİLMELİ' : 'NEEDS WORK'
}

function PlanScoreCard({ plan, log }) {
  const { t, lang } = useContext(LangCtx)

  const result = useMemo(
    () => computePlanScore(plan, log),
    [plan, log],
  )

  if (!result) return null

  const { score, peakDay, peakTSB, peakDate, weekCount, totalTSS } = result
  const scoreColor = score != null ? SCORE_COLOR(score) : '#555'
  const grade      = score != null ? gradeLabel(score, lang) : '—'
  const title      = lang === 'tr' ? 'ANTRENMAN PLAN PUANI' : 'TRAINING PLAN SCORE'
  const peakTitle  = t('planScorePeak')

  return (
    <div style={{ ...S.card, fontFamily: 'IBM Plex Mono, monospace' }}>
      {/* Title */}
      <div style={{ ...S.cardTitle, color: '#ff6600', letterSpacing: '0.08em', marginBottom: '10px' }}>
        ◈ {title}
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
        <span style={{
          fontSize: '42px',
          fontWeight: 700,
          fontFamily: 'IBM Plex Mono, monospace',
          color: scoreColor,
          lineHeight: 1,
        }}>
          {score ?? '—'}
        </span>
        <span style={{
          fontSize: '11px',
          color: scoreColor,
          letterSpacing: '0.1em',
          fontFamily: 'IBM Plex Mono, monospace',
          fontWeight: 600,
        }}>
          {grade}
        </span>
      </div>

      {/* Metadata row */}
      <div style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', letterSpacing: '0.05em' }}>
        {weekCount} {lang === 'tr' ? 'hafta' : 'weeks'} · Total TSS: {totalTSS}
      </div>

      {/* Peak form section */}
      {peakDate && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#ff6600', letterSpacing: '0.08em', marginBottom: '5px' }}>
            ◈ {peakTitle}
          </div>
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', letterSpacing: '0.04em' }}>
            {lang === 'tr' ? 'Gün' : 'Day'} {peakDay} · {peakDate} · TSB {peakTSB}
          </div>
        </div>
      )}

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginTop: '10px', letterSpacing: '0.04em', opacity: 0.7 }}>
        ℹ Banister &amp; Calvert (1980) — taper bonus, TSB window, monotony penalty
      </div>
    </div>
  )
}

export default memo(PlanScoreCard)
