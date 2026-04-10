import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { SESSION_TYPES_BY_DISCIPLINE, ZONE_COLORS, ZONE_NAMES, SPORT_CONFIG } from '../lib/constants.js'
import { calcTSS } from '../lib/formulas.js'
import { sanitizeLogEntry } from '../lib/validate.js'
import Calendar from './Calendar.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

export default function TrainingLog({ log, setLog, prefill, clearPrefill }) {
  const { t } = useContext(LangCtx)
  const [profileLS] = useLocalStorage('sporeus_profile', {})
  const today = new Date().toISOString().slice(0,10)
  const defaultType = (() => {
    const sc = SPORT_CONFIG[profileLS?.primarySport]
    if (!sc) return 'Easy Run'
    const group = SESSION_TYPES_BY_DISCIPLINE[sc.sessionGroup]
    return group?.[0] || 'Easy Run'
  })()
  const [form, setForm] = useState({ date:today, type:defaultType, duration:'', rpe:'5', notes:'' })
  const [showZones, setShowZones] = useState(false)
  const [zoneMins, setZoneMins] = useState(['','','','',''])
  const [editingId, setEditingId] = useState(null)
  const [calView, setCalView] = useState(false)

  useEffect(() => {
    if (prefill) {
      setForm({ date:today, type:prefill.type||'Easy Run', duration:String(prefill.duration||''), rpe:String(prefill.rpe||5), notes:prefill.description||'' })
      clearPrefill && clearPrefill()
    }
  }, [prefill])

  const zoneTotal = zoneMins.reduce((s,v)=>s+(parseInt(v)||0),0)
  const zoneDiff  = form.duration && showZones ? Math.abs(zoneTotal - parseInt(form.duration)) : 0
  const [tssPreview, setTssPreview] = useState(null)

  const add = () => {
    if (!form.duration) return
    const tss = calcTSS(parseInt(form.duration), parseInt(form.rpe))
    const zones = showZones ? zoneMins.map(v=>parseInt(v)||0) : null
    const raw = { id: editingId !== null ? editingId : Date.now(), ...form, duration:parseInt(form.duration), rpe:parseInt(form.rpe), tss, ...(zones ? { zones } : {}) }
    const entry = sanitizeLogEntry(raw)
    if (editingId !== null) {
      setLog(log.map(e => e.id === editingId ? entry : e))
      setEditingId(null)
    } else {
      setLog([...log, entry])
    }
    setForm({ date:today, type:'Easy Run', duration:'', rpe:'5', notes:'' })
    setZoneMins(['','','','','']); setShowZones(false); setTssPreview(null)
  }

  const startEdit = (s, idx) => {
    const entry = { ...log.find((_,i)=>i===log.length-1-idx) }
    setForm({ date:entry.date, type:entry.type, duration:String(entry.duration), rpe:String(entry.rpe), notes:entry.notes||'' })
    if (entry.zones) { setZoneMins(entry.zones.map(String)); setShowZones(true) }
    setEditingId(entry.id||null)
    window.scrollTo({ top:0, behavior:'smooth' })
  }
  const cancelEdit = () => { setEditingId(null); setForm({ date:today, type:'Easy Run', duration:'', rpe:'5', notes:'' }); setZoneMins(['','','','','']); setShowZones(false) }

  const exportCSV = () => {
    const header = 'Date,Type,Duration (min),RPE,TSS,Notes'
    const rows = log.map(e=>`${e.date},${e.type},${e.duration},${e.rpe},${e.tss},"${(e.notes||'').replace(/"/g,'""')}"`)
    const csv = [header,...rows].join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='sporeus_training_log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('logTitle')}</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 130px' }}>
            <label style={S.label}>{t('dateL')}</label>
            <input style={S.input} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          </div>
          <div style={{ flex:'1 1 150px' }}>
            <label style={S.label}>{t('typeL')}</label>
            <select style={S.select} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
              {Object.entries(SESSION_TYPES_BY_DISCIPLINE).map(([group,types])=>(
                <optgroup key={group} label={group}>
                  {types.map(x=><option key={x}>{x}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{ flex:'1 1 110px' }}>
            <label style={S.label}>{t('durL')}</label>
            <input style={S.input} type="number" placeholder="60" value={form.duration}
              onChange={e=>{setForm({...form,duration:e.target.value});setTssPreview(null)}}/>
          </div>
          <div style={{ flex:'1 1 120px' }}>
            <label style={S.label}>{t('rpeL')}</label>
            <select style={S.select} value={form.rpe}
              onChange={e=>{setForm({...form,rpe:e.target.value});setTssPreview(null)}}>
              {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop:'10px' }}>
          <label style={S.label}>{t('notesL')}</label>
          <input style={S.input} type="text" placeholder="Felt strong at threshold pace\u2026" value={form.notes}
            onChange={e=>setForm({...form,notes:e.target.value})}/>
        </div>
        <div style={{ marginTop:'10px' }}>
          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', ...S.mono, fontSize:'11px', color:'#888' }}>
            <input type="checkbox" checked={showZones} onChange={e=>setShowZones(e.target.checked)} style={{ accentColor:'#ff6600' }}/>
            ADD ZONE BREAKDOWN (optional)
          </label>
          {showZones && (
            <div style={{ marginTop:'10px' }}>
              <div style={S.row}>
                {ZONE_NAMES.map((n,i)=>(
                  <div key={i} style={{ flex:'1 1 70px' }}>
                    <label style={{ ...S.label, color:ZONE_COLORS[i] }}>{n.split(' ')[0]} (min)</label>
                    <input style={{ ...S.input, borderColor:ZONE_COLORS[i]+'66' }} type="number" placeholder="0"
                      value={zoneMins[i]} onChange={e=>{ const z=[...zoneMins]; z[i]=e.target.value; setZoneMins(z) }}/>
                  </div>
                ))}
              </div>
              <div style={{ ...S.mono, fontSize:'10px', marginTop:'6px', color: zoneDiff>parseInt(form.duration||0)*0.1?'#e03030':'#5bc25b' }}>
                Zone total: {zoneTotal} min {form.duration && `/ ${form.duration} min session`}
                {zoneDiff > parseInt(form.duration||0)*0.1 && ' ⚠ >10% mismatch'}
              </div>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:'10px', marginTop:'14px', alignItems:'center', flexWrap:'wrap' }}>
          <button style={S.btn} onClick={add}>{editingId!==null ? '✓ UPDATE SESSION' : t('addBtn')}</button>
          {editingId!==null && <button style={S.btnSec} onClick={cancelEdit}>✕ Cancel</button>}
          {editingId===null && <button style={S.btnSec} onClick={()=>form.duration&&setTssPreview(calcTSS(parseInt(form.duration),parseInt(form.rpe)))}>{t('previewTSSBtn')}</button>}
          {tssPreview!==null && <span style={{ ...S.mono, fontSize:'13px', color:'#ff6600', fontWeight:600 }}>TSS: {tssPreview}</span>}
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...S.cardTitle }}>
          <span>{t('sessionHistTitle')} ({log.length})</span>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <button onClick={()=>setCalView(false)} style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${!calView?'#ff6600':'var(--border)'}`, background:!calView?'#ff660022':'transparent', color:!calView?'#ff6600':'var(--muted)' }}>≡ LIST</button>
            <button onClick={()=>setCalView(true)}  style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${calView?'#ff6600':'var(--border)'}`, background:calView?'#ff660022':'transparent', color:calView?'#ff6600':'var(--muted)' }}>⊞ CAL</button>
            {log.length>0 && !calView && <button style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }} onClick={exportCSV}>{t('exportCSVBtn')}</button>}
          </div>
        </div>
        {calView ? (
          <Calendar log={log} setLog={setLog} onEdit={ses=>{
            setForm({ date:ses.date, type:ses.type, duration:String(ses.duration), rpe:String(ses.rpe), notes:ses.notes||'' })
            if (ses.zones) { setZoneMins(ses.zones.map(String)); setShowZones(true) }
            setEditingId(ses.id||null)
            window.scrollTo({ top:0, behavior:'smooth' })
          }}/>
        ) : log.length===0 ? (
          <div style={{ ...S.mono, fontSize:'12px', color:'#aaa', textAlign:'center', padding:'20px' }}>{t('noSessionsYet')}</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
                  {['DATE','TYPE','MIN','RPE','TSS','NOTES',''].map(h=>(
                    <th key={h} style={{ textAlign:['TSS','MIN','RPE',''].includes(h)?'right':'left', padding:'4px 6px 8px 0', fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...log].reverse().map((s,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'6px 6px 6px 0', color:'var(--sub)' }}>{s.date}</td>
                    <td style={{ padding:'6px 6px 6px 0' }}>{s.type}</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 6px 0' }}>{s.duration}</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:s.rpe>=8?'#e03030':s.rpe>=6?'#f5c542':'#5bc25b' }}>{s.rpe}</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:'#ff6600', fontWeight:600 }}>{s.tss}</td>
                    <td style={{ padding:'6px 6px 6px 0', color:'#888', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.notes}</td>
                    <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                      <button onClick={()=>startEdit(s,i)}
                        style={{ background:'none', border:'none', color:'#aaa', cursor:'pointer', ...S.mono, fontSize:'12px', marginRight:'4px' }}>✎</button>
                      <button onClick={()=>setLog(log.filter((_,idx)=>idx!==log.length-1-i))}
                        style={{ background:'none', border:'none', color:'#ccc', cursor:'pointer', ...S.mono, fontSize:'12px' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
