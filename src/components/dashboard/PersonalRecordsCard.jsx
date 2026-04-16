// ─── dashboard/PersonalRecordsCard.jsx — all-time personal records ────────────
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { calcPRs } from '../../lib/formulas.js'

export default function PersonalRecordsCard({ dl }) {
  const { log } = useData()

  if (!dl.records || log.length === 0) return null

  const prs = calcPRs(log)
  if (!prs.length) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '190ms' }}>
      <div style={S.cardTitle}>PERSONAL RECORDS</div>
      <div style={S.row}>
        {prs.map(pr => (
          <div key={pr.label} style={{ ...S.stat, flex: '1 1 130px', textAlign: 'left', padding: '10px 12px' }}>
            <span style={{ ...S.statVal, fontSize: '15px', textAlign: 'left' }}>{pr.value}</span>
            <span style={S.statLbl}>{pr.label}</span>
            {pr.date && (
              <div style={{ ...S.mono, fontSize: '9px', color: 'var(--sub)', marginTop: '2px' }}>
                {pr.date} · {pr.unit}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
