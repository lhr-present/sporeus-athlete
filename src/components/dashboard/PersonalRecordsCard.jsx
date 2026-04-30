// ─── dashboard/PersonalRecordsCard.jsx — all-time personal records ────────────
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { calcPRs } from '../../lib/formulas.js'

export default function PersonalRecordsCard({ dl }) {
  const { log } = useData()

  const MONO = "'IBM Plex Mono', monospace"

  if (!dl.records || log.length === 0) return (
    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555', padding: '16px 0', textAlign: 'center' }}>
      Log sessions to track your personal records.<br />
      <span style={{ fontSize: '9px' }}>Kişisel rekorlarınızı takip etmek için antrenman kaydet.</span>
    </div>
  )

  const prs = calcPRs(log)
  if (!prs.length) return (
    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555', padding: '16px 0', textAlign: 'center' }}>
      Log sessions to track your personal records.<br />
      <span style={{ fontSize: '9px' }}>Kişisel rekorlarınızı takip etmek için antrenman kaydet.</span>
    </div>
  )

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
