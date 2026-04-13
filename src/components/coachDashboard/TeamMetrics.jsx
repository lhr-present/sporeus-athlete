import { S } from '../../styles.js'
import { daysBefore, getReadinessColor } from './helpers.jsx'

// ─── Weekly Team Summary ──────────────────────────────────────────────────────

export default function TeamMetrics({ roster }) {
  const d7 = daysBefore(7), d14 = daysBefore(14)
  const thisWeekStart = daysBefore(7)
  const lastWeekStart = daysBefore(14)
  let totalThis = 0, totalLast = 0, totalReadiness = 0, readinessCount = 0
  const highACWR = [], missedSessions = [], injured = []

  roster.forEach(a => {
    const log = a.log || []
    const recovery = a.recovery || []
    totalThis += log.filter(e => e.date >= thisWeekStart).length
    totalLast += log.filter(e => e.date >= lastWeekStart && e.date < thisWeekStart).length
    const lastRec = [...recovery].sort((a, b) => (a.date > b.date ? -1 : 1))[0]
    if (lastRec?.score) { totalReadiness += lastRec.score; readinessCount++ }
    const tss7 = log.filter(e => e.date >= d7).reduce((s, e) => s + (e.tss || 0), 0)
    const tss28 = log.filter(e => e.date >= d14).reduce((s, e) => s + (e.tss || 0), 0) / 4
    const acwr = tss28 > 0 ? tss7 / tss28 : null
    if (acwr !== null && acwr > 1.3) highACWR.push({ name: a.name, acwr: acwr.toFixed(2) })
    const expectedWeekly = 4
    if (log.filter(e => e.date >= thisWeekStart).length < expectedWeekly - 2) missedSessions.push(a.name)
    if ((a.injuryLog || []).some(e => e.date >= d14)) {
      const zones = [...new Set((a.injuryLog || []).filter(e => e.date >= d14).map(e => e.zone))]
      injured.push({ name: a.name, zones })
    }
  })

  const avgReadiness = readinessCount ? Math.round(totalReadiness / readinessCount) : null
  const weekLabel = (() => {
    const d = new Date(); const prev = new Date(d); prev.setDate(prev.getDate() - 6)
    return `${prev.toLocaleDateString('en-GB',{month:'short',day:'numeric'})} – ${d.toLocaleDateString('en-GB',{month:'short',day:'numeric',year:'numeric'})}`
  })()

  function handleCopySummary() {
    const lines = [
      `Sporeus Coach Weekly — ${weekLabel}`,
      `Team: ${roster.length} athletes | ${totalThis} sessions this week (${totalThis > totalLast ? '+' : ''}${totalThis - totalLast} vs last week)`,
      avgReadiness !== null ? `Avg readiness: ${avgReadiness}/100` : null,
      highACWR.length ? `High ACWR: ${highACWR.map(a => `${a.name} (${a.acwr})`).join(', ')}` : null,
      missedSessions.length ? `Low activity: ${missedSessions.join(', ')}` : null,
      injured.length ? `Injuries: ${injured.map(a => `${a.name} (${a.zones.join(', ')})`).join(', ')}` : null,
      '— sporeus.com',
    ].filter(Boolean)
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  if (!roster.length) return null

  return (
    <div style={{ ...S.card, marginBottom:'16px', borderLeft:`3px solid #0064ff` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <div style={S.cardTitle}>WEEKLY TEAM SUMMARY</div>
        <button style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px', borderColor:'#0064ff', color:'#0064ff' }} onClick={handleCopySummary}>
          Copy for WhatsApp
        </button>
      </div>
      <div style={{ ...S.row, marginBottom:'10px' }}>
        {[
          { lbl:'SESSIONS THIS WEEK', val:totalThis, color:'#ff6600', sub:`${totalThis > totalLast ? '↑' : totalThis < totalLast ? '↓' : '='} ${Math.abs(totalThis-totalLast)} vs last wk` },
          { lbl:'AVG READINESS', val: avgReadiness !== null ? `${avgReadiness}/100` : '—', color: avgReadiness !== null ? getReadinessColor(avgReadiness) : '#888', sub:'' },
          { lbl:'HIGH ACWR', val: highACWR.length, color: highACWR.length ? '#f5c542' : '#5bc25b', sub: highACWR.length ? highACWR.map(a=>a.name).join(', ') : 'All clear' },
          { lbl:'INJURIES', val: injured.length, color: injured.length ? '#e03030' : '#5bc25b', sub: injured.length ? injured.map(a=>a.name).join(', ') : 'None reported' },
        ].map(({ lbl, val, color, sub }) => (
          <div key={lbl} style={{ flex:'1 1 90px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px', padding:'8px 10px' }}>
            <div style={{ ...S.mono, fontSize:'18px', fontWeight:700, color }}>{val}</div>
            <div style={{ ...S.mono, fontSize:'8px', color:'var(--muted)', letterSpacing:'0.06em', marginTop:'2px' }}>{lbl}</div>
            {sub && <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'3px' }}>{sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#555', borderTop:'1px solid var(--border)', paddingTop:'6px' }}>
        {weekLabel}
      </div>
    </div>
  )
}
