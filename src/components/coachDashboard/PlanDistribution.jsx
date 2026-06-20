import { useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'

// ─── Plan Templates ───────────────────────────────────────────────────────────

export default function PlanDistribution({ templates, setTemplates, onApply }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const [open, setOpen] = useState(false)

  return (
    <div style={{ ...S.card, marginBottom:'16px' }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={lang === 'tr' ? 'Plan şablonlarını aç/kapat' : 'Toggle plan templates'}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
        <div style={S.cardTitle}>{lang === 'tr' ? 'PLAN ŞABLONLARI' : 'PLAN TEMPLATES'} ({templates.length})</div>
        <span style={{ ...S.mono, fontSize:'12px', color:'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div>
          {!templates.length && (
            <div style={{ ...S.mono, fontSize:'11px', color:'var(--muted)', paddingTop:'6px' }}>
              {lang === 'tr'
                ? 'Henüz şablon yok. Bir sporcu için plan oluşturup şablon olarak kaydedin.'
                : 'No templates yet. Generate a plan for an athlete and save it as a template.'}
            </div>
          )}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'8px' }}>
            {templates.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'6px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px', padding:'6px 10px' }}>
                <button onClick={() => onApply(t)} style={{ ...S.mono, fontSize:'11px', color:'#0064ff', background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}>
                  {t.name}
                  <span style={{ ...S.mono, fontSize:'9px', color:'#888', marginLeft:'6px' }}>{t.sport} · {t.weeks}{lang === 'tr' ? 'hf' : 'wk'} · {t.goal}</span>
                </button>
                <button onClick={() => setTemplates(prev => prev.filter(x => x.id !== t.id))} aria-label={lang === 'tr' ? 'Şablonu kaldır' : 'Remove template'} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'13px', padding:'0 2px' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
