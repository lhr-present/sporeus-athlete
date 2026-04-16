// ─── dashboard/RacePredictionsCard.jsx — Riegel race time predictor ──────────
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { riegel, fmtSec, fmtPace } from '../../lib/formulas.js'

const TARGETS = [
  { label: '5K',       m: 5000  },
  { label: '10K',      m: 10000 },
  { label: 'HM',       m: 21097 },
  { label: 'Marathon', m: 42195 },
]

export default function RacePredictionsCard({ dl }) {
  const { profile } = useData()

  if (!dl.predictions) return null
  if (!profile.ftp && !profile.ltPace) return null

  const ltPaceSec = profile.ltPace
    ? profile.ltPace.split(':').reduce((a, v, i, arr) =>
        a + (arr.length === 3 ? [3600, 60, 1][i] : i === 0 ? 60 : 1) * parseFloat(v), 0)
    : 0
  if (!ltPaceSec) return null

  const preds = TARGETS.map(({ label, m }) => ({
    label,
    time: fmtSec(riegel(ltPaceSec, 1000, m)),
    pace: fmtPace(riegel(ltPaceSec, 1000, m), m),
  }))

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '199ms' }}>
      <div style={S.cardTitle}>RACE PREDICTIONS (RIEGEL)</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {preds.map(p => (
          <div key={p.label} style={{ flex: '1 1 100px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '5px', padding: '10px 12px' }}>
            <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>{p.label}</div>
            <div style={{ ...S.mono, fontSize: '15px', fontWeight: 600, color: '#ff6600' }}>{p.time}</div>
            <div style={{ ...S.mono, fontSize: '9px', color: 'var(--sub)' }}>{p.pace}/km</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginTop: '6px' }}>Based on LT pace · Riegel formula</div>
    </div>
  )
}
