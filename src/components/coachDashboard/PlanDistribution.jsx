import { useState } from 'react'
import { S } from '../../styles.js'

// ─── Plan Templates ───────────────────────────────────────────────────────────

export default function PlanDistribution({ templates, setTemplates, onApply }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ ...S.card, marginBottom:'16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={S.cardTitle}>PLAN TEMPLATES ({templates.length})</div>
        <span style={{ ...S.mono, fontSize:'12px', color:'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div>
          {!templates.length && (
            <div style={{ ...S.mono, fontSize:'11px', color:'var(--muted)', paddingTop:'6px' }}>
              No templates yet. Generate a plan for an athlete and save it as a template.
            </div>
          )}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'8px' }}>
            {templates.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'6px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px', padding:'6px 10px' }}>
                <button onClick={() => onApply(t)} style={{ ...S.mono, fontSize:'11px', color:'#0064ff', background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}>
                  {t.name}
                  <span style={{ ...S.mono, fontSize:'9px', color:'#888', marginLeft:'6px' }}>{t.sport} · {t.weeks}wk · {t.goal}</span>
                </button>
                <button onClick={() => setTemplates(prev => prev.filter(x => x.id !== t.id))} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'13px', padding:'0 2px' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
