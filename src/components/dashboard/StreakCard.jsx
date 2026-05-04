// ─── dashboard/StreakCard.jsx — Training Streak Detector ───────────────────
// Surfaces detectStreak(): consecutive training days, longest streak in 90d,
// rest-day pattern. Bands: celebrating, consistent, monitoring, risk,
// recovery, broken. Positive-framed; risk band escalates only when streak
// ≥22d or ≥15d without rest. Cite: Habit-formation; Foster 2001 monotony
// ───────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectStreak } from '../../lib/athlete/streakDetector.js'

const BAND_COLOR = {
  celebrating: '#28a745',
  consistent:  '#0064ff',
  monitoring:  '#ff9500',
  risk:        '#dc3545',
  recovery:    '#6c757d',
  broken:      '#6c757d',
}

const BAND_LABEL = {
  celebrating: { en: 'BUILDING',    tr: 'İNŞA' },
  consistent:  { en: 'CONSISTENT',  tr: 'TUTARLI' },
  monitoring:  { en: 'MONITORING',  tr: 'İZLEME' },
  risk:        { en: 'RISK',        tr: 'RİSK' },
  recovery:    { en: 'RECOVERY',    tr: 'TOPARLANMA' },
  broken:      { en: 'BROKEN',      tr: 'KIRILDI' },
}

export default function StreakCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectStreak(log), [log])

  const title = isTR ? 'GÜNLÜK SERİ — 90G' : 'TRAINING STREAK — 90D'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Günlük seri — yetersiz veri' : 'Training streak — insufficient data'}
        style={{ ...S.card, animationDelay: '240ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Seri takibi için 14+ günlük günlük geçmişi kaydet'
            : 'Log 14+ days of history to track streaks'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.riskBand] || BAND_COLOR.broken
  const bandLbl = BAND_LABEL[result.riskBand]?.[isTR ? 'tr' : 'en'] || result.riskBand.toUpperCase()
  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const streakStr = String(result.currentStreak)
  const longestStr = String(result.longestStreakIn90d)

  const ariaRow = isTR
    ? `${bandLbl} — ${streakStr} günlük seri, en iyi 90 gün ${longestStr}`
    : `${bandLbl} — ${streakStr} day streak, best 90-day ${longestStr}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Günlük seri' : 'Training streak'}
      style={{ ...S.card, animationDelay: '240ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      <div style={{
        display: 'inline-block',
        ...S.mono,
        fontSize: '11px',
        fontWeight: 700,
        color: '#fff',
        background: accent,
        padding: '4px 10px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginBottom: '10px',
      }}>
        {bandLbl}
      </div>

      <div
        aria-live="polite"
        aria-label={ariaRow}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '4px 0 8px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {streakStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            {isTR
              ? <>STREAK<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>SERİ</>
              : <>DAY STREAK<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>GÜNLÜK SERİ</>}
          </div>
        </div>

        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {longestStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            BEST 90D
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            EN İYİ 90G
          </div>
        </div>
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '6px',
        letterSpacing: '0.04em',
      }}>
        {isTR
          ? `28G'de ${result.trainingDaysIn28d} gün`
          : `${result.trainingDaysIn28d}/28 training days`}
      </div>

      {result.daysSinceLastRest !== null && result.daysSinceLastRest !== undefined ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--sub, var(--muted))',
          marginBottom: '10px',
          letterSpacing: '0.04em',
        }}>
          {isTR
            ? `Son dinlenme ${result.daysSinceLastRest} gün önce`
            : `Last rest ${result.daysSinceLastRest}d ago`}
        </div>
      ) : null}

      {message ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: '8px',
        }}>
          {message}
        </div>
      ) : null}

      {recommendation ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}>
          {recommendation}
        </div>
      ) : null}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
