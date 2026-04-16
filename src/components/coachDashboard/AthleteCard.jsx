import { S } from '../../styles.js'
import { computeAthleteMetrics, computeLoad, getReadinessColor, daysAgo } from './helpers.jsx'
import { assessDataQuality } from '../../lib/intelligence.js'
import AthleteDetailPanel from './AthleteDetailPanel.jsx'

// ─── Athlete Status Card ──────────────────────────────────────────────────────

export default function AthleteCard({ athlete, isOpen, onToggle, onRemove, onUpdate, templates, setTemplates, onQuickNote, myCoachId }) {
  const metrics = computeAthleteMetrics(athlete)
  const load = computeLoad(athlete.log || [])
  const dq = assessDataQuality(athlete.log || [], athlete.recovery || [], athlete.testResults || [], athlete.profile || athlete)
  const isConnected = !!(myCoachId && athlete.coachId === myCoachId)
  const ago = daysAgo(metrics.lastSession)

  function handleQuickReport() {
    const line = `${athlete.name} | CTL: ${load.ctl} | TSB: ${(load.tsb>=0?'+':'')+load.tsb} | ACWR: ${metrics.acwr !== null ? metrics.acwr.toFixed(2) : '—'} | Readiness: ${metrics.readiness !== null ? metrics.readiness : '—'} | Last: ${metrics.lastSession}`
    navigator.clipboard.writeText(line).catch(() => {})
  }

  return (
    <div style={{ border:`1px solid ${metrics.needsAttention?'#f5c54244':'var(--border)'}`, borderRadius:'8px', marginBottom:'12px', overflow:'hidden', background:'var(--card-bg)' }}>
      {/* Status bar */}
      <div style={{ height:'4px', background:`linear-gradient(90deg, ${metrics.statusColor}, ${metrics.statusColor}88)` }}/>
      {/* Card content */}
      <div style={{ padding:'12px 14px' }}>
        {/* Header row */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px', gap:'8px' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              {isConnected && <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#0064ff', flexShrink:0, display:'inline-block' }}/>}
              <span style={{ ...S.mono, fontSize:'14px', fontWeight:700, color:'#0064ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {athlete.name}
              </span>
              {metrics.needsAttention && <span style={{ ...S.mono, fontSize:'10px', color:'#f5c542' }}>⚠</span>}
            </div>
            <div style={{ ...S.mono, fontSize:'10px', color:'var(--muted)', marginTop:'2px' }}>
              {athlete.sport || '—'}{ago ? ` · ${ago}` : ''}
            </div>
          </div>
          {/* Quick action buttons */}
          <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
            <button onClick={handleQuickReport} title="Copy quick report" style={{ ...S.mono, fontSize:'11px', padding:'4px 7px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer', color:'var(--muted)' }}>
              📋
            </button>
            <button onClick={onQuickNote} title="Add quick note" style={{ ...S.mono, fontSize:'11px', padding:'4px 7px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer', color:'var(--muted)' }}>
              📝
            </button>
            <button
              onClick={onToggle}
              style={{ ...S.btnSec, fontSize:'11px', padding:'5px 10px', background: isOpen?'#0064ff':'transparent', color: isOpen?'#fff':'#0064ff', borderColor:'#0064ff' }}>
              {isOpen ? '▲' : '▼'}
            </button>
            <button onClick={onRemove} aria-label="Remove athlete" style={{ ...S.btnSec, fontSize:'11px', padding:'5px 8px', color:'#e03030', borderColor:'#e03030' }}>✕</button>
          </div>
        </div>

        {/* 5 mini stats */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {[
            { lbl:'CTL',   val: load.ctl, color:'#0064ff' },
            { lbl:'TSB',   val: (load.tsb>=0?'+':'')+load.tsb, color: load.tsb>5?'#5bc25b':load.tsb<-10?'#e03030':'#f5c542' },
            { lbl:'ACWR',  val: metrics.acwr !== null ? metrics.acwr.toFixed(2) : '—', color: metrics.acwrColor },
            { lbl:'READY', val: metrics.readiness !== null ? metrics.readiness : '—', color: getReadinessColor(metrics.readiness) },
            { lbl:'DATA',  val: dq.grade, color: dq.gradeColor },
          ].map(({ lbl, val, color }) => (
            <div key={lbl} style={{ flex:'1 1 50px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'4px', padding:'6px 8px', textAlign:'center' }}>
              <div style={{ ...S.mono, fontSize:'14px', fontWeight:700, color }}>{val}</div>
              <div style={{ ...S.mono, fontSize:'8px', color:'var(--muted)', letterSpacing:'0.06em', marginTop:'2px' }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded detail */}
      {isOpen && (
        <div style={{ padding:'0 14px 14px 14px', borderTop:'1px solid var(--border)' }}>
          <AthleteDetailPanel
            athlete={athlete}
            onUpdate={onUpdate}
            onClose={() => {}}
            templates={templates}
            setTemplates={setTemplates}
          />
        </div>
      )}
    </div>
  )
}
