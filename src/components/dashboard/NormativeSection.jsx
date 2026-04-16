// ─── dashboard/NormativeSection.jsx — FTP & CTL percentile vs peer groups ─────
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import NormativeCard from '../NormativeCard.jsx'
import { getFTPNorm, getCTLNorm } from '../../lib/sport/normativeTables.js'

export default function NormativeSection() {
  const { log, profile } = useData()

  const cards = useMemo(() => {
    const result  = []
    const ftp     = parseFloat(profile.ftp    || 0)
    const weight  = parseFloat(profile.weight || 0)
    const sport   = (profile.sport || 'cycling').toLowerCase()
    const gender  = (profile.gender || 'male').toLowerCase()
    const ctlVal  = log.length >= 7
      ? Math.round(log.slice(-28).reduce((s, e) => s + (e.tss || 0), 0) / 42)
      : null
    const normSport = sport.includes('tri')
      ? 'triathlon'
      : sport.includes('cycl') || sport.includes('bike') ? 'cycling' : null

    if (ftp > 0 && weight > 0 && normSport) {
      const ftpPerKg = Math.round((ftp / weight) * 100) / 100
      const norm     = getFTPNorm(normSport, gender, ftpPerKg)
      if (norm.category !== 'Unknown') {
        result.push(
          <NormativeCard
            key="ftp"
            label="FTP"
            value={`${ftpPerKg} w/kg`}
            percentile={norm.percentile}
            category={norm.category}
            context={`vs ${normSport} ${gender}s`}
          />
        )
      }
    }

    if (ctlVal != null && ctlVal > 0) {
      const level    = (profile.level || 'recreational').toLowerCase().replace('-', '')
      const ctlSport = sport.includes('run') ? 'running' : sport.includes('row') ? 'rowing' : sport.includes('swim') ? 'swimming' : 'cycling'
      const normLevel = level.includes('elite') ? 'elite' : level.includes('expert') || level.includes('well') ? 'masters' : level.includes('trained') ? 'amateur' : 'recreational'
      const ctlNorm  = getCTLNorm(ctlSport, normLevel, ctlVal)
      if (ctlNorm.status !== 'Unknown') {
        result.push(
          <NormativeCard
            key="ctl"
            label="CTL (Fitness)"
            value={`${ctlVal} TSS/d`}
            percentile={Math.max(0, Math.min(100, ctlNorm.percentileOfTypical))}
            category={ctlNorm.status}
            context={`${ctlSport} · ${normLevel}`}
          />
        )
      }
    }

    return result
  }, [log, profile])

  if (!cards.length) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '210ms' }}>
      <div style={S.cardTitle}>NORMATIVE COMPARISON</div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {cards}
      </div>
    </div>
  )
}
