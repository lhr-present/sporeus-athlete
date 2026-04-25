// ─── TaperAdvisorCard.jsx — E38: Plan Taper Advisor ──────────────────────────
// Shows when a race is within 90 days. Status: taper_active / taper_soon / pre_taper.
// Wires volumeCutPct + applyVolumeReduction from planAdjust.js via taperAdvisor.js.
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeTaperAdvice } from '../../lib/athlete/taperAdvisor.js'

/**
 * @param {{ plan: object|null, profile: object }} props
 */
export default function TaperAdvisorCard({ plan, profile }) {
  const { t, lang } = useContext(LangCtx)

  const advice = computeTaperAdvice(plan, profile)
  if (!advice) return null

  const title = lang === 'tr' ? t('taperTitle').replace('TAPER ADVISOR', 'POTA PLANLAYICI') : t('taperTitle')

  const statusConfig = {
    taper_active: { label: t('taperActive'), color: '#5bc25b' },
    taper_soon:   { label: t('taperSoon'),   color: '#f5c542' },
    pre_taper:    { label: t('taperPre'),     color: '#0064ff' },
  }
  const { label: statusLabel, color: statusColor } = statusConfig[advice.status] || statusConfig.pre_taper

  const levelLabel = advice.level
    ? String(advice.level).toUpperCase()
    : 'RECREATIONAL'

  return (
    <div className="sp-card" style={{
      ...S.card,
      borderLeft: '4px solid #ff6600',
      marginBottom: '12px',
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.08em' }}>
          {lang === 'tr' ? '◈ POTA PLANLAYICI' : '◈ TAPER ADVISOR'}
        </div>
        {/* Status badge */}
        <span style={{
          ...S.mono,
          fontSize: '9px',
          fontWeight: 700,
          color: statusColor,
          border: `1px solid ${statusColor}66`,
          padding: '1px 6px',
          borderRadius: '2px',
          letterSpacing: '0.07em',
        }}>
          {advice.status === 'taper_soon'
            ? `${t('taperSoon').split(' ')[0]} ${lang === 'tr' ? 'IN' : 'IN'} ${advice.daysUntilTaperStart}D`
            : statusLabel}
        </span>
      </div>

      {/* Main metrics row */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'flex-end' }}>
        {/* Countdown */}
        <div>
          <div style={{ ...S.mono, fontSize: '32px', fontWeight: 700, color: statusColor, lineHeight: 1 }}>
            {advice.daysUntilRace}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginTop: '2px', letterSpacing: '0.06em' }}>
            {t('taperRaceIn').toUpperCase()} {t('taperDays').toUpperCase()}
          </div>
        </div>

        {/* Volume cut + taper start */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--text)' }}>
            {lang === 'tr' ? 'Hacmi' : 'Reduce volume by'}{' '}
            <span style={{ color: '#ff6600', fontWeight: 700 }}>{advice.cutPctDisplay}</span>
          </div>
          <div style={{ ...S.mono, fontSize: '10px', color: '#555' }}>
            {lang === 'tr' ? 'Taper başlangıcı' : 'Taper starts'}: <span style={{ color: 'var(--text)' }}>{advice.taperStartDate}</span>
          </div>
          <div style={{ ...S.mono, fontSize: '10px', color: '#555' }}>
            {lang === 'tr' ? 'Yarış tarihi' : 'Race date'}: <span style={{ color: statusColor }}>{advice.raceDate}</span>
          </div>
        </div>

        {/* Level badge */}
        <span style={{
          ...S.mono,
          fontSize: '9px',
          color: '#888',
          border: '1px solid #33333366',
          padding: '2px 6px',
          borderRadius: '2px',
          letterSpacing: '0.07em',
          alignSelf: 'center',
        }}>
          {levelLabel}
        </span>
      </div>

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '8px', color: '#333', borderTop: '1px solid var(--border)', paddingTop: '6px', letterSpacing: '0.04em' }}>
        {advice.citation}
      </div>
    </div>
  )
}
