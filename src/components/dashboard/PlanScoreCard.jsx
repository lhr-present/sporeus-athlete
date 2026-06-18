// ─── dashboard/PlanScoreCard.jsx — E48: Plan Score Card ─────────────────────
// Displays plan quality score (0-100) and peak form window from Banister model.
// Source: Banister & Calvert (1980) — Modeling elite athletic performance
import { memo, useMemo, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computePlanScore } from '../../lib/athlete/planScore.js'
import { TSBSparkline } from '../ui.jsx'

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

  const MONO = "'IBM Plex Mono', monospace"
  if (!result) return (
    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555', padding: '16px 0', textAlign: 'center' }}>
      {lang === 'tr'
        ? 'Plan puanını görmek için bir antrenman planı oluştur.'
        : 'Generate a training plan to see your plan score.'}
    </div>
  )

  const { score, peakDay, peakTSB, peakDate, weekCount, totalTSS, tsbTrace } = result
  const hasTrace = Array.isArray(tsbTrace) && tsbTrace.length >= 2
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

      {/* "So what" interpretation */}
      {score != null && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          padding: '8px',
          background: `${scoreColor}10`,
          border: `1px solid ${scoreColor}40`,
          borderRadius: '3px',
          marginBottom: '10px',
        }}>
          {score >= 75
            ? (lang === 'tr'
                ? 'Güçlü plan — kademeli yük ve doruğa temiz bir konik. Devam et.'
                : 'Strong plan — progressive load with a clean taper into your peak. Stick with it.')
            : score >= 50
            ? (lang === 'tr'
                ? 'Sağlam plan, ince ayar mümkün — sert haftaları toparlanma haftalarının izlediğinden emin ol.'
                : 'Solid plan with room to tune — make sure hard weeks are followed by recovery weeks.')
            : (lang === 'tr'
                ? 'Plan geliştirilmeli — yük çok hızlı artıyor olabilir veya konik temiz bir doruk için uygun değil.'
                : 'Plan needs work — load may ramp too fast or the taper is off for a clean peak.')}
        </div>
      )}

      {/* Peak form section */}
      {peakDate && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#ff6600', letterSpacing: '0.08em', marginBottom: '5px' }}>
            ◈ {peakTitle}
          </div>
          <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', letterSpacing: '0.04em' }}>
            {lang === 'tr' ? 'Gün' : 'Day'} {peakDay} · {peakDate} · TSB {peakTSB}
          </div>
          {hasTrace && (
            <div style={{ marginTop: '8px' }}>
              <TSBSparkline data={tsbTrace} peakDay={peakDay} />
              <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.04em', marginTop: '2px', opacity: 0.8 }}>
                {lang === 'tr'
                  ? 'Form (TSB) eğrisi — antrenmanda düşer, doruğa yükselir'
                  : 'Form (TSB) curve — dips in the build, rebuilds into the peak'}
              </div>
            </div>
          )}
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
