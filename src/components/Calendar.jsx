import { useState, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'

const TYPE_COLORS = {
  'Easy Run':'#4ade80','Tempo':'#facc15','Interval':'#ef4444','Long Run':'#22d3ee',
  'Recovery':'#a78bfa','Strength':'#f97316','Swim':'#94a3b8','Bike':'#60a5fa',
  'Race':'#ff6600','Test':'#d946ef',
}

export default function Calendar({ log, setLog, onEdit }) {
  const { t: _t } = useContext(LangCtx)
  const [cur, setCur] = useState(new Date())
  const [sel, setSel] = useState(null)
  const [plan] = useLocalStorage('sporeus-plan', null)
  const { recovery } = useData()

  const today = new Date().toISOString().slice(0,10)
  const yr = cur.getFullYear(), mo = cur.getMonth()
  const firstDow = (new Date(yr, mo, 1).getDay() + 6) % 7 // Mon=0
  const daysInMo = new Date(yr, mo + 1, 0).getDate()
  const monthLabel = cur.toLocaleDateString('en-GB', {month:'long', year:'numeric'}).toUpperCase()

  // Lookup maps
  const logByDate = {}
  log.forEach(e => { if (!logByDate[e.date]) logByDate[e.date] = []; logByDate[e.date].push(e) })

  const recByDate = {}
  recovery.forEach(e => { recByDate[e.date] = e })

  const planByDate = {}
  if (plan?.weeks && plan.generatedAt) {
    const base = new Date(plan.generatedAt)
    plan.weeks.forEach((w, wi) => {
      w.sessions.forEach((ses, di) => {
        const d = new Date(base); d.setDate(d.getDate() + wi * 7 + di)
        planByDate[d.toISOString().slice(0,10)] = ses
      })
    })
  }

  const cells = [...Array(firstDow).fill(null), ...Array.from({length:daysInMo},(_,i)=>i+1)]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <button onClick={()=>setCur(new Date(yr,mo-1,1))} aria-label="Previous month" style={{ ...S.mono, fontSize:'16px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:'2px 8px' }}>←</button>
        <div style={S.cardTitle}>{monthLabel}</div>
        <button onClick={()=>setCur(new Date(yr,mo+1,1))} aria-label="Next month" style={{ ...S.mono, fontSize:'16px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:'2px 8px' }}>→</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px' }}>
        {['M','T','W','T','F','S','S'].map((d,i)=>(
          <div key={i} style={{ ...S.mono, fontSize:'9px', fontWeight:600, color:'#888', textAlign:'center' }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
        {cells.map((day,i) => {
          if (!day) return <div key={i}/>
          const ds = `${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const sessions = logByDate[ds] || []
          const planned = planByDate[ds]
          const rec = recByDate[ds]
          const isToday = ds === today
          const isSel = sel === ds

          return (
            <div key={i} onClick={()=>setSel(isSel?null:ds)} style={{
              minHeight:'52px', padding:'3px 3px 2px', borderRadius:'4px', cursor:'pointer',
              border: isToday ? '2px solid #ff6600' : isSel ? '2px solid #0064ff' : '1px solid var(--border)',
              background: isSel ? '#0064ff11' : 'var(--card-bg)',
              position:'relative', overflow:'hidden',
            }}>
              <div style={{ ...S.mono, fontSize:'10px', fontWeight:isToday?700:400, color:isToday?'#ff6600':'var(--muted)', lineHeight:1 }}>{day}</div>
              {sessions.slice(0,2).map((ses,si)=>(
                <div key={si} style={{ display:'flex', alignItems:'center', gap:'2px', marginTop:'2px' }}>
                  <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:TYPE_COLORS[ses.type]||'#d4d4d4', flexShrink:0 }}/>
                  <span style={{ ...S.mono, fontSize:'8px', color:'#ff6600', fontWeight:600 }}>{ses.tss}</span>
                </div>
              ))}
              {sessions.length > 2 && <div style={{ ...S.mono, fontSize:'7px', color:'#888' }}>+{sessions.length-2}</div>}
              {!sessions.length && planned && planned.type !== 'Rest' && planned.duration > 0 && (
                <div style={{ border:'1px dashed #555', borderRadius:'2px', padding:'1px 2px', marginTop:'3px' }}>
                  <div style={{ ...S.mono, fontSize:'7px', color:'#888', textAlign:'center', lineHeight:1.2 }}>{planned.type?.slice(0,3)}</div>
                </div>
              )}
              {rec && <div style={{ position:'absolute', bottom:'2px', right:'2px', width:'5px', height:'5px', borderRadius:'50%', background:'#5bc25b' }}/>}
            </div>
          )
        })}
      </div>

      {/* Selected day detail */}
      {sel && (() => {
        const sessions = logByDate[sel] || []
        const planned = planByDate[sel]
        const rec = recByDate[sel]
        return (
          <div style={{ marginTop:'12px', borderTop:'1px solid var(--border)', paddingTop:'10px' }}>
            <div style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:'var(--muted)', marginBottom:'8px' }}>{sel}</div>
            {sessions.map((ses, si) => (
              <div key={si} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'var(--surface)', borderRadius:'4px', marginBottom:'4px', borderLeft:`3px solid ${TYPE_COLORS[ses.type]||'#d4d4d4'}` }}>
                <div>
                  <span style={{ ...S.mono, fontSize:'12px', fontWeight:600, color:TYPE_COLORS[ses.type]||'var(--text)' }}>{ses.type}</span>
                  <span style={{ ...S.mono, fontSize:'10px', color:'#888', marginLeft:'8px' }}>{ses.duration}min · RPE {ses.rpe} · TSS {ses.tss}</span>
                  {ses.notes && <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginTop:'2px' }}>{ses.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:'4px' }}>
                  {onEdit && <button onClick={()=>{ onEdit(ses); setSel(null) }} aria-label="Edit session" style={{ ...S.mono, fontSize:'12px', background:'none', border:'none', color:'#aaa', cursor:'pointer' }}>✎</button>}
                  <button onClick={()=>setLog(log.filter(e=>e.id!==ses.id))} aria-label="Delete session" style={{ ...S.mono, fontSize:'12px', background:'none', border:'none', color:'#ccc', cursor:'pointer' }}>✕</button>
                </div>
              </div>
            ))}
            {!sessions.length && planned && planned.type !== 'Rest' && planned.duration > 0 && (
              <div style={{ padding:'7px 10px', border:'1px dashed var(--border)', borderRadius:'4px', ...S.mono, fontSize:'11px', color:'#888' }}>
                PLANNED: {planned.type} · {planned.duration}min · {planned.zone}
              </div>
            )}
            {!sessions.length && !planned && !rec && (
              <div style={{ ...S.mono, fontSize:'11px', color:'#aaa', textAlign:'center', padding:'8px 0' }}>Rest day</div>
            )}
            {rec && (
              <div style={{ ...S.mono, fontSize:'10px', color:'#5bc25b', padding:'5px 10px', background:'#5bc25b11', borderRadius:'4px', marginTop:'4px' }}>
                ♡ Recovery score: {rec.score}/100 · Sleep {rec.sleep}/5 · Energy {rec.energy}/5
              </div>
            )}
          </div>
        )
      })()}

      {/* Legend */}
      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginTop:'10px', paddingTop:'8px', borderTop:'1px solid var(--border)' }}>
        {[['#4ade80','Logged'],['#5bc25b','Recovery'],['#aaa','Planned (dashed)'],['#ff6600','Today']].map(([c,l])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:'4px', ...S.mono, fontSize:'9px', color:c }}>
            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:c }}/>{l}
          </div>
        ))}
      </div>
    </div>
  )
}
