import { useMemo } from 'react'
import { S } from '../../styles.js'
import { findBestVO2maxSession } from '../../lib/sport/vo2max.js'
import { getVO2maxNorm } from '../../lib/sport/normativeTables.js'

export default function VO2maxCard({ log, profile, dl }) {
  const result = useMemo(() => {
    if (!dl.vo2max) return null
    return findBestVO2maxSession(log, profile)
  }, [log, profile, dl.vo2max])

  const norm = useMemo(() => {
    if (!result) return null
    const age    = parseInt(profile?.age) || 30
    const gender = profile?.gender || 'male'
    const sport  = (profile?.primarySport || '').includes('run') ? 'running' : 'cycling'
    return getVO2maxNorm(sport, age, gender, result.vo2max)
  }, [result, profile])

  if (!dl.vo2max || !result) return null

  const methodLabel = result.method === 'cooper' ? 'COOPER' : 'DANIELS'

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      <div style={S.cardTitle}>VO2MAX ESTIMATE</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ ...S.mono, fontSize: '36px', fontWeight: 700, color: '#ff6600' }}>
          {result.vo2max}
        </span>
        <span style={{ ...S.mono, fontSize: '12px', color: '#888' }}>mL/kg/min</span>
        <span style={{
          ...S.mono, fontSize: '9px', color: '#ff6600',
          border: '1px solid #ff660044', borderRadius: '3px',
          padding: '2px 7px', letterSpacing: '0.08em',
        }}>
          {methodLabel}
        </span>
      </div>
      {norm && (
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div>
            <div style={{ ...S.mono, fontSize: '10px', color: '#666', letterSpacing: '0.06em', marginBottom: '2px' }}>PERCENTILE</div>
            <div style={{ ...S.mono, fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
              {norm.percentile}<span style={{ fontSize: '11px', color: '#888' }}>th</span>
            </div>
          </div>
          <div>
            <div style={{ ...S.mono, fontSize: '10px', color: '#666', letterSpacing: '0.06em', marginBottom: '2px' }}>CATEGORY</div>
            <div style={{ ...S.mono, fontSize: '18px', fontWeight: 600, color:
              norm.category === 'Superior' ? '#5bc25b' :
              norm.category === 'Excellent' ? '#0064ff' :
              norm.category === 'Good' ? '#f5c542' :
              norm.category === 'Fair' ? '#f08c00' : '#e03030'
            }}>
              {norm.category.toUpperCase()}
            </div>
          </div>
        </div>
      )}
      <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginTop: '4px' }}>
        Best qualifying session: {result.date} · {result.sessionType}
      </div>
    </div>
  )
}
