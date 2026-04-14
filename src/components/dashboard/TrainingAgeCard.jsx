import { useMemo } from 'react'
import { S } from '../../styles.js'

export default function TrainingAgeCard({ log, dl }) {
  const result = useMemo(() => {
    if (!dl.trainingage || log.length === 0) return null

    const earliest = log.reduce((min, e) => (e.date < min ? e.date : min), log[0].date)
    const start    = new Date(earliest)
    const now      = new Date()

    const totalMonths =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())

    const years  = Math.floor(totalMonths / 12)
    const months = totalMonths % 12

    let tier
    if (totalMonths < 12) {
      tier = {
        label:  'Beginner',
        advice: 'Prioritise consistency over intensity',
        border: '#f5c542',
        color:  '#f5c542',
      }
    } else if (totalMonths <= 36) {
      tier = {
        label:  'Developing',
        advice: 'ACWR 0.8–1.2 recommended',
        border: '#0064ff',
        color:  '#0064ff',
      }
    } else {
      tier = {
        label:  'Experienced',
        advice: 'Higher load tolerance, periodise well',
        border: '#5bc25b',
        color:  '#5bc25b',
      }
    }

    return { years, months, totalMonths, tier, earliest }
  }, [log, dl.trainingage])

  if (!dl.trainingage || log.length === 0 || !result) return null

  const { years, months, tier, earliest } = result

  return (
    <div className="sp-card" style={{ ...S.card, borderLeft: `3px solid ${tier.border}`, animationDelay: '0ms' }}>
      <div style={S.cardTitle}>TRAINING AGE</div>
      <div style={{ ...S.mono, fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
        {years > 0 ? `${years}y ${months}mo` : `${months} month${months !== 1 ? 's' : ''}`} of logged training
      </div>
      <div style={{
        ...S.mono, fontSize: '10px', fontWeight: 600,
        color: tier.color, letterSpacing: '0.06em', marginBottom: '4px',
      }}>
        {tier.label.toUpperCase()}
      </div>
      <div style={{ ...S.mono, fontSize: '11px', color: '#888', lineHeight: 1.5 }}>
        {tier.advice}
      </div>
      <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginTop: '6px' }}>
        First logged session: {earliest}
      </div>
    </div>
  )
}
