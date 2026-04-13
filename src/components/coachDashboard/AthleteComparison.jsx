import { useState } from 'react'
import { S } from '../../styles.js'
import { computeAthleteMetrics, computeLoad, getReadinessColor } from './helpers.jsx'

// ─── Multi-Athlete Comparison ─────────────────────────────────────────────────

export default function AthleteComparison({ roster }) {
  const [selected, setSelected] = useState([])
  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 4 ? prev : [...prev, id])
  }
  const compared = roster.filter(a => selected.includes(a.id))
  const stats = compared.map(a => ({ ...a, ...computeAthleteMetrics(a), ...computeLoad(a.log || []) }))
  const minR = stats.reduce((m, a) => (a.readiness !== null && (m === null || a.readiness < m)) ? a.readiness : m, null)
  const maxA = stats.reduce((m, a) => (a.acwr !== null && (m === null || a.acwr > m)) ? a.acwr : m, null)

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>COMPARE ATHLETES</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'12px' }}>
        {roster.map(a => (
          <label key={a.id} style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', ...S.mono, fontSize:'12px' }}>
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleSelect(a.id)} style={{ accentColor:'#0064ff' }}/>
            {a.name}
          </label>
        ))}
      </div>
      {compared.length >= 2 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'11px' }}>
            <thead><tr style={{ borderBottom:'1px solid var(--border)', color:'var(--muted)' }}>
              {['METRIC', ...compared.map(a => a.name.toUpperCase())].map(h => <th key={h} style={{ textAlign:'left', padding:'6px 8px', fontWeight:600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[
                { label:'CTL', vals: stats.map(a => ({ val:a.ctl, color:'#0064ff', warn:false })) },
                { label:'ATL', vals: stats.map(a => ({ val:a.atl, color:'#e03030', warn:false })) },
                { label:'TSB', vals: stats.map(a => { const c=a.tsb>5?'#5bc25b':a.tsb<-10?'#e03030':'#f5c542'; return { val:(a.tsb>=0?'+':'')+a.tsb, color:c, warn:false } }) },
                { label:'ACWR', vals: stats.map(a => ({ val:a.acwr!==null?a.acwr.toFixed(2):'—', color:a.acwrColor, warn:a.acwr!==null&&a.acwr===maxA&&a.acwr>1.3 })) },
                { label:'READINESS', vals: stats.map(a => ({ val:a.readiness!==null?a.readiness:'—', color:getReadinessColor(a.readiness), warn:a.readiness!==null&&a.readiness===minR&&a.readiness<50 })) },
              ].map(row => (
                <tr key={row.label} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 8px', color:'var(--muted)', fontWeight:600 }}>{row.label}</td>
                  {row.vals.map((cell, ci) => <td key={ci} style={{ padding:'6px 8px', color:cell.color, fontWeight:600 }}>{cell.val}{cell.warn?' ⚠':''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {compared.length < 2 && <div style={{ ...S.mono, fontSize:'12px', color:'var(--muted)' }}>Select 2–4 athletes to compare.</div>}
    </div>
  )
}
