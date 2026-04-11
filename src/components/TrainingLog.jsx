import { useState, useEffect, useContext, useRef } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { SESSION_TYPES_BY_DISCIPLINE, ZONE_COLORS, ZONE_NAMES, SPORT_CONFIG } from '../lib/constants.js'
import { calcTSS, normalizedPower, computePowerTSS, computeWPrime } from '../lib/formulas.js'
import { sanitizeLogEntry } from '../lib/validate.js'
import Calendar from './Calendar.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { scoreSession } from '../lib/intelligence.js'
import { parseFIT, parseGPX, detectFileType } from '../lib/fileImport.js'

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
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [sessionScore, setSessionScore] = useState(null)
  const [importPreview, setImportPreview] = useState(null) // parsed workout before confirm
  const [importError, setImportError]     = useState(null)
  const [importBusy, setImportBusy]       = useState(false)
  const fileInputRef = useRef(null)

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
      const scored = scoreSession(entry, log, profileLS)
      setSessionScore(scored)
      setTimeout(() => setSessionScore(null), 8000)
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

  const handleFileImport = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setImportError(null); setImportBusy(true)
    const kind = detectFileType(file)
    if (kind === 'unsupported') { setImportError('Unsupported file type. Use .fit or .gpx'); setImportBusy(false); return }
    try {
      let parsed
      const maxHR = profileLS?.maxHR ? parseInt(profileLS.maxHR) : null
      if (kind === 'fit') {
        const buf = await file.arrayBuffer()
        parsed = await parseFIT(buf, maxHR)
      } else {
        const text = await file.text()
        parsed = parseGPX(text, maxHR)
      }
      setImportPreview({ ...parsed, source: kind, type: defaultType, rpe: 5 })
    } catch (err) {
      setImportError(err.message)
    }
    setImportBusy(false)
  }

  const confirmImport = () => {
    if (!importPreview) return
    const ftp = parseInt(profileLS?.ftp) || 0
    const powers = importPreview.powerSeries || []
    const np = powers.length >= 30 ? normalizedPower(powers) : 0
    const durationSec = (importPreview.durationMin || 0) * 60
    const powerTSS = (np && ftp) ? computePowerTSS(np, durationSec, ftp) : null
    const tss = powerTSS ?? importPreview.tssEstimate ?? calcTSS(importPreview.durationMin, importPreview.rpe || 5)
    const tssMethod = powerTSS ? 'power-based' : importPreview.tssEstimate ? 'HR-based' : 'RPE-based'
    const npStr = np ? ` · NP: ${np}W · IF: ${(np/ftp).toFixed(2)} · TSS: ${tss} (${tssMethod})` : ` · TSS: ${tss} (${tssMethod})`
    // W' exhaustion check — requires CP + W' in profile
    const cp       = parseInt(profileLS?.cp) || 0
    const wPrimeCap = parseInt(profileLS?.wPrime) || 0
    let wPrimeExhausted = false
    if (powers.length >= 30 && cp && wPrimeCap) {
      const wbal = computeWPrime(powers, cp, wPrimeCap)
      wPrimeExhausted = wbal.some(v => v <= 0)
    }

    const raw = {
      id: Date.now(),
      date: importPreview.date,
      type: importPreview.type,
      duration: importPreview.durationMin,
      rpe: importPreview.rpe || 5,
      tss,
      notes: importPreview.notes || `Imported ${importPreview.source?.toUpperCase()} · ${importPreview.distanceM ? (importPreview.distanceM/1000).toFixed(2)+'km' : ''}${npStr}`,
      source: importPreview.source,
      ...(wPrimeExhausted ? { wPrimeExhausted: true } : {}),
    }
    setLog([...log, sanitizeLogEntry(raw)])
    setImportPreview(null)
  }

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

      {/* Session Quality Card (v4.3) — auto-dismisses 8s */}
      {sessionScore && (
        <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${sessionScore.grade==='A'?'#5bc25b':sessionScore.grade==='B'?'#0064ff':sessionScore.grade==='C'?'#f5c542':'#e03030'}`, animationDelay:'0ms' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={S.cardTitle}>{t('sessionQualityTitle')}</div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ ...S.mono, fontSize:'28px', fontWeight:600, color:sessionScore.grade==='A'?'#5bc25b':sessionScore.grade==='B'?'#0064ff':sessionScore.grade==='C'?'#f5c542':'#e03030' }}>{sessionScore.grade}</span>
              <span style={{ ...S.mono, fontSize:'13px', color:'#888' }}>{sessionScore.score}/100</span>
            </div>
          </div>
          <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', marginTop:'6px', lineHeight:1.6 }}>
            {sessionScore.feedback[lang] || sessionScore.feedback.en}
          </div>
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...S.cardTitle }}>
          <span>{t('sessionHistTitle')} ({log.length})</span>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <button onClick={()=>setCalView(false)} style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${!calView?'#ff6600':'var(--border)'}`, background:!calView?'#ff660022':'transparent', color:!calView?'#ff6600':'var(--muted)' }}>≡ LIST</button>
            <button onClick={()=>setCalView(true)}  style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${calView?'#ff6600':'var(--border)'}`, background:calView?'#ff660022':'transparent', color:calView?'#ff6600':'var(--muted)' }}>⊞ CAL</button>
            {log.length>0 && !calView && <button style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }} onClick={exportCSV}>{t('exportCSVBtn')}</button>}
            <button
              style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px', opacity: importBusy ? 0.5 : 1 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
            >
              {importBusy ? '…' : '↑ IMPORT WORKOUT'}
            </button>
            <input ref={fileInputRef} type="file" accept=".fit,.gpx" style={{ display:'none' }} onChange={handleFileImport}/>
            {importError && <span style={{ ...S.mono, fontSize:'9px', color:'#e03030' }}>{importError}</span>}
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
                    <td style={{ padding:'6px 6px 6px 0', color:'#888', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.wPrimeExhausted && <span title="W' reached zero — complete anaerobic depletion (Skiba 2012)" style={{ display:'inline-block', background:'#e03030', color:'#fff', fontSize:'8px', fontWeight:700, borderRadius:'3px', padding:'1px 4px', marginRight:'4px', letterSpacing:'0.05em' }}>⚡W'0</span>}
                      {s.notes}
                    </td>
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

      {/* Import preview modal */}
      {importPreview && (
        <div style={{ position:'fixed', inset:0, zIndex:20000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'IBM Plex Mono',monospace" }}>
          <div style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'32px', width:'100%', maxWidth:'420px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#ff6600', letterSpacing:'0.1em', marginBottom:'20px' }}>
              ↑ IMPORT PREVIEW · {importPreview.source?.toUpperCase()}
            </div>
            {(() => {
              const ftp = parseInt(profileLS?.ftp) || 0
              const powers = importPreview.powerSeries || []
              const np = powers.length >= 30 ? normalizedPower(powers) : 0
              const durationSec = (importPreview.durationMin || 0) * 60
              const powerTSS = (np && ftp) ? computePowerTSS(np, durationSec, ftp) : null
              const IF = (np && ftp) ? (np / ftp).toFixed(2) : null
              const tssDisplay = powerTSS ?? importPreview.tssEstimate
              const tssLabel = powerTSS ? `TSS (power)` : importPreview.tssEstimate ? 'TSS (HR est.)' : 'TSS (RPE est.)'
              const cpPrev    = parseInt(profileLS?.cp) || 0
              const wCapPrev  = parseInt(profileLS?.wPrime) || 0
              const wbalPrev  = (powers.length >= 30 && cpPrev && wCapPrev) ? computeWPrime(powers, cpPrev, wCapPrev) : null
              const wExhausted = wbalPrev ? wbalPrev.some(v => v <= 0) : false
              const wExhaustSec = wExhausted ? wbalPrev.findIndex(v => v <= 0) : -1
              const previewStats = [
                { lbl:'DATE', val: importPreview.date },
                { lbl:'DURATION', val: `${importPreview.durationMin} min` },
                { lbl:'DISTANCE', val: importPreview.distanceM ? `${(importPreview.distanceM/1000).toFixed(2)} km` : '—' },
                { lbl:'AVG HR', val: importPreview.avgHR ? `${importPreview.avgHR} bpm` : '—' },
                ...(np ? [
                  { lbl:'NORM POWER', val: `${np}W`, color:'#ff6600' },
                  { lbl:'INT FACTOR', val: IF, color: IF >= 1.05 ? '#e03030' : IF >= 0.88 ? '#f5c542' : '#5bc25b' },
                ] : []),
                { lbl: tssLabel, val: tssDisplay, color:'#ff6600' },
                { lbl:'ELEV GAIN', val: importPreview.elevationGainM != null ? `${importPreview.elevationGainM} m` : '—' },
              ]
              return (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
                  {previewStats.map(({ lbl, val, color }) => (
                    <div key={lbl} style={{ background:'#0a0a0a', borderRadius:'4px', padding:'10px 12px' }}>
                      <div style={{ fontSize:'8px', color:'#555', letterSpacing:'0.1em', marginBottom:'4px' }}>{lbl}</div>
                      <div style={{ fontSize:'14px', fontWeight:700, color: color || '#e0e0e0' }}>{val}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
            {wExhausted && (
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', background:'rgba(224,48,48,0.1)', border:'1px solid #e0303066', borderRadius:'4px', padding:'8px 12px', marginBottom:'16px', color:'#e03030' }}>
                ⚡ W' reached zero at {Math.floor(wExhaustSec/60)}:{String(wExhaustSec%60).padStart(2,'0')} — complete anaerobic reserve depletion.
                Session will be flagged in your log. (Skiba 2012)
              </div>
            )}
            <div style={{ marginBottom:'16px' }}>
              <label style={{ fontSize:'9px', color:'#666', letterSpacing:'0.1em', display:'block', marginBottom:'4px' }}>SESSION TYPE</label>
              <select value={importPreview.type} onChange={e => setImportPreview(p => ({...p, type: e.target.value}))}
                style={{ ...S.input, width:'100%', boxSizing:'border-box' }}>
                {(SESSION_TYPES_BY_DISCIPLINE[SPORT_CONFIG[profileLS?.primarySport]?.sessionGroup] || SESSION_TYPES_BY_DISCIPLINE.run || []).map(t2 => (
                  <option key={t2} value={t2}>{t2}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom:'20px' }}>
              <label style={{ fontSize:'9px', color:'#666', letterSpacing:'0.1em', display:'block', marginBottom:'4px' }}>RPE (1-10)</label>
              <input type="number" min="1" max="10" value={importPreview.rpe}
                onChange={e => setImportPreview(p => ({...p, rpe: parseInt(e.target.value)||5}))}
                style={{ ...S.input, width:'60px' }}/>
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={confirmImport} style={{ flex:1, padding:'11px', background:'#ff6600', color:'#fff', border:'none', borderRadius:'4px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', cursor:'pointer' }}>
                ✓ SAVE SESSION
              </button>
              <button onClick={() => setImportPreview(null)} style={{ flex:1, padding:'11px', background:'#1a1a1a', color:'#888', border:'1px solid #333', borderRadius:'4px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', cursor:'pointer' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
