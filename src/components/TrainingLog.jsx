import { useState, useEffect, useContext, useRef, useMemo } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { SESSION_TYPES_BY_DISCIPLINE, ZONE_COLORS, ZONE_NAMES, SPORT_CONFIG } from '../lib/constants.js'
import { calcTSS, normalizedPower, computePowerTSS, computeWPrime } from '../lib/formulas.js'
import { sanitizeLogEntry } from '../lib/validate.js'
import Calendar from './Calendar.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { scoreSession, autoTagSession, analyseSession, detectPersonalBests } from '../lib/intelligence.js'
import { BANISTER } from '../lib/sport/constants.js'
import { computeDecoupling } from '../lib/decoupling.js'
import ScienceTooltip from './ScienceTooltip.jsx'

// 2-char Bloomberg-style type prefix
function typePrefix(type) {
  const t = (type || '').toLowerCase()
  if (t.includes('race') || t.includes('triathlon')) return 'RC'
  if (t.includes('run')) return 'RN'
  if (t.includes('ride') || t.includes('cycl') || t.includes('ftp')) return 'RD'
  if (t.includes('swim') || t.includes('css')) return 'SW'
  if (t.includes('row')) return 'RW'
  return 'TR'
}

// 4-char Unicode block intensity band
function tssBand(tss) {
  const v = tss || 0
  if (v >= 150) return '███░'
  if (v >= 100) return '██░░'
  if (v >= 50)  return '█░░░'
  return '░░░░'
}

// CTL before and after a single session using EWMA
function calcCtlDelta(log, session) {
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date))
  const idx = sorted.findIndex(e => e.id === session.id)
  if (idx < 0) return null
  const K = BANISTER.K_CTL
  let ctl = 0
  for (let i = 0; i < idx; i++) {
    ctl = ctl * (1 - K) + (sorted[i].tss || 0) * K
  }
  const ctlBefore = Math.round(ctl * 10) / 10
  ctl = ctl * (1 - K) + (session.tss || 0) * K
  const ctlAfter = Math.round(ctl * 10) / 10
  const delta = Math.round((ctlAfter - ctlBefore) * 10) / 10
  return { ctlBefore, ctlAfter, delta }
}
import { parseFIT, parseGPX, detectFileType, parseBulkCSV, deduplicateByDate, downloadCSVTemplate } from '../lib/fileImport.js'
import { uploadActivityFile } from '../lib/activityUpload.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import ActivityMap from './ActivityMap.jsx'
import UploadActivity from './UploadActivity.jsx'

export default function TrainingLog({ log, setLog, prefill, clearPrefill }) {
  const { t } = useContext(LangCtx)
  const { profile: profileLS } = useData()
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
  const [calView, setCalView]           = useState(false)
  const [authUser, setAuthUser]         = useState(null)
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [sessionScore, setSessionScore] = useState(null)
  const [lastPBs, setLastPBs] = useState(null)
  const [aiInsight, setAiInsight] = useState(null)   // { text, busy }
  const aiInsightTimer = useRef(null)
  const [importPreview, setImportPreview] = useState(null) // parsed workout before confirm
  const [importError, setImportError]     = useState(null)
  const [importBusy, setImportBusy]       = useState(false)
  const [routeSession, setRouteSession]   = useState(null) // session with trackpoints to show on map
  const [csvPreview, setCsvPreview]       = useState(null) // { entries, skipped, deduped }
  const [bulkMode, setBulkMode]           = useState(false)
  const [selected, setSelected]           = useState(new Set())
  const [expandedId, setExpandedId]       = useState(null)
  const fileInputRef    = useRef(null)
  const csvInputRef     = useRef(null)
  const importFileRef   = useRef(null)   // raw File object for Storage archival

  // ── Memoised derivations ─────────────────────────────────────────────────
  const reversedLog = useMemo(() => [...log].reverse(), [log])
  const expandedEntry = useMemo(
    () => expandedId != null ? (log.find(s => s.id === expandedId) ?? null) : null,
    [expandedId, log]
  )
  const expandedAnalysis = useMemo(
    () => expandedEntry ? analyseSession(expandedEntry, log.slice(-28)) : null,
    [expandedEntry, log.length] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const expandedCtlInfo = useMemo(
    () => expandedEntry ? calcCtlDelta(log, expandedEntry) : null,
    [expandedEntry, log.length] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const expandedSimilar = useMemo(() => {
    if (!expandedEntry) return []
    return log.filter(e =>
      e !== expandedEntry &&
      (e.type||'') === (expandedEntry.type||'') &&
      e.tss &&
      Math.abs(e.tss - (expandedEntry.tss||0)) / Math.max(expandedEntry.tss||1, 1) <= 0.15
    ).slice(-3)
  }, [expandedEntry, log.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prefill) {
      setForm({ date:today, type:prefill.type||'Easy Run', duration:String(prefill.duration||''), rpe:String(prefill.rpe||5), notes:prefill.description||'' })
      clearPrefill && clearPrefill()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- today/clearPrefill are stable within session; react to prefill object identity
  }, [prefill])

  // Resolve current authUser once (needed by UploadActivity)
  useEffect(() => {
    if (!isSupabaseReady()) return
    supabase.auth.getUser().then(({ data: { user } }) => setAuthUser(user || null)).catch(() => {})
  }, [])

  const requestSessionAnalysis = (entry) => {
    if (!isSupabaseReady()) return
    setAiInsight({ text: null, busy: true })
    clearTimeout(aiInsightTimer.current)
    supabase.functions.invoke('analyse-session', {
      body: { entry: { id: entry.id, date: entry.date, type: entry.type, tss: entry.tss, rpe: entry.rpe, duration: entry.duration, notes: entry.notes } },
    }).then(({ data, error }) => {
      if (error || !data?.insight) {
        setAiInsight(null)
      } else {
        setAiInsight({ text: data.insight, busy: false })
        aiInsightTimer.current = setTimeout(() => setAiInsight(null), 20000)
      }
    }).catch(() => setAiInsight(null))
  }

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
      setLastPBs(null)
    } else {
      const scored = scoreSession(entry, log, profileLS)
      setSessionScore(scored)
      setTimeout(() => setSessionScore(null), 8000)
      const pbs = detectPersonalBests(entry, log)
      setLastPBs(pbs)
      setLog([...log, entry])
      requestSessionAnalysis(entry)
    }
    setForm({ date:today, type:'Easy Run', duration:'', rpe:'5', notes:'' })
    setZoneMins(['','','','','']); setShowZones(false); setTssPreview(null)
  }

  const startEdit = (s, idx) => {
    const found = log.find((_,i)=>i===log.length-1-idx)
    if (!found) return
    const entry = { ...found }
    setForm({ date:entry.date, type:entry.type, duration:String(entry.duration), rpe:String(entry.rpe), notes:entry.notes||'' })
    if (entry.zones) { setZoneMins(entry.zones.map(String)); setShowZones(true) }
    setEditingId(entry.id||null)
    window.scrollTo({ top:0, behavior:'smooth' })
  }
  const cancelEdit = () => { setEditingId(null); setForm({ date:today, type:'Easy Run', duration:'', rpe:'5', notes:'' }); setZoneMins(['','','','','']); setShowZones(false); setLastPBs(null) }

  const handleBulkTag = (tag) => {
    if (!tag) return
    setLog(log.map(e => selected.has(e.id) ? { ...e, tags: [tag] } : e))
  }

  const handleBulkDelete = () => {
    if (!selected.size) return
    if (!window.confirm(`Delete ${selected.size} selected session${selected.size > 1 ? 's' : ''}?`)) return
    setLog(log.filter(e => !selected.has(e.id)))
    setSelected(new Set())
    setBulkMode(false)
  }

  const applyTag = (entry, tag) => {
    setLog(log.map(e => e.id === entry.id ? { ...e, tags: [tag] } : e))
  }

  const handleFileImport = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    importFileRef.current = file
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

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    try {
      const text    = await file.text()
      const parsed  = parseBulkCSV(text)
      const skipped = text.split('\n').length - 1 - parsed.length
      const deduped = deduplicateByDate(log, parsed)
      setCsvPreview({ entries: deduped, allParsed: parsed, skipped: Math.max(0, skipped), duplicates: parsed.length - deduped.length })
    } catch (err) {
      setImportError('CSV parse error: ' + err.message)
    }
  }

  const confirmCSVImport = () => {
    if (!csvPreview) return
    setLog(prev => [...prev, ...csvPreview.entries])
    setCsvPreview(null)
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

    // Aerobic decoupling — requires HR + (power or speed) streams from FIT import
    const hrSeries    = importPreview.hrSeries    || []
    const speedSeries = importPreview.speedSeries || []
    let decouplingPct = null
    if (hrSeries.length >= 30 && (powers.length >= 30 || speedSeries.length >= 30)) {
      const dcResult = computeDecoupling({ hr: hrSeries, power: powers.length >= 30 ? powers : undefined, speed: speedSeries.length >= 30 ? speedSeries : undefined })
      if (dcResult.valid) decouplingPct = dcResult.decouplingPct
    }

    const entryId = Date.now()
    const raw = {
      id: entryId,
      date: importPreview.date,
      type: importPreview.type,
      duration: importPreview.durationMin,
      rpe: importPreview.rpe || 5,
      tss,
      notes: importPreview.notes || `Imported ${importPreview.source?.toUpperCase()} · ${importPreview.distanceM ? (importPreview.distanceM/1000).toFixed(2)+'km' : ''}${npStr}`,
      source: importPreview.source,
      ...(wPrimeExhausted  ? { wPrimeExhausted: true } : {}),
      ...(powers.length >= 30 ? { hasPower: true } : {}),
      ...(decouplingPct !== null ? { decouplingPct } : {}),
    }
    setLog([...log, sanitizeLogEntry(raw)])
    // Store power stream keyed by entry ID for Power Curve analysis
    if (powers.length >= 30) {
      try { localStorage.setItem('sporeus-power-' + entryId, JSON.stringify(powers.slice(0, 10800))) } catch (e) { logger.warn('localStorage:', e.message) }
    }
    // Archive raw file to Supabase Storage (fire-and-forget — failures are non-fatal)
    if (importFileRef.current && isSupabaseReady()) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id) {
          uploadActivityFile(user.id, importFileRef.current, {
            date: raw.date, durationMin: raw.duration, tss, distanceM: importPreview.distanceM,
          }, String(entryId)).catch(e => logger.warn('activityUpload:', e.message))
        }
      }).catch(e => logger.warn('activityUpload auth:', e.message))
      importFileRef.current = null
    }
    requestSessionAnalysis(raw)
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

      {/* AI session insight */}
      {aiInsight && (
        <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #b060ff', animationDelay:'0ms' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <span style={{ ...S.mono, fontSize:'10px', color:'#b060ff', letterSpacing:'0.1em' }}>◈ AI COACHING INSIGHT</span>
            <button onClick={() => { clearTimeout(aiInsightTimer.current); setAiInsight(null) }} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'14px', lineHeight:1, padding:0 }}>×</button>
          </div>
          {aiInsight.busy ? (
            <div style={{ ...S.mono, fontSize:'11px', color:'#555' }}>Analysing session…</div>
          ) : (
            <div style={{ ...S.mono, fontSize:'12px', color:'#c0c0c0', lineHeight:1.7 }}>{aiInsight.text}</div>
          )}
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...S.cardTitle }}>
          <span>{t('sessionHistTitle')} ({log.length})</span>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <button onClick={()=>setCalView(false)} style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${!calView?'#ff6600':'var(--border)'}`, background:!calView?'#ff660022':'transparent', color:!calView?'#ff6600':'var(--muted)' }}>≡ LIST</button>
            <button onClick={()=>setCalView(true)}  style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${calView?'#ff6600':'var(--border)'}`, background:calView?'#ff660022':'transparent', color:calView?'#ff6600':'var(--muted)' }}>⊞ CAL</button>
            {log.length>0 && !calView && <button style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }} onClick={exportCSV}>{t('exportCSVBtn')}</button>}
            {authUser && isSupabaseReady() && (
              <button
                style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px', color:'#b060ff', borderColor:'#b060ff' }}
                onClick={() => setShowUploadPanel(true)}
              >
                ↑ UPLOAD &amp; PARSE
              </button>
            )}
            <button
              style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px', opacity: importBusy ? 0.5 : 1 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
            >
              {importBusy ? '…' : '↑ IMPORT WORKOUT'}
            </button>
            <button
              style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }}
              onClick={() => csvInputRef.current?.click()}
            >
              ↑ IMPORT CSV
            </button>
            <button
              style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }}
              onClick={downloadCSVTemplate}
              title="Download CSV template"
            >
              ↓ TEMPLATE
            </button>
            <button
              style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px', border: bulkMode ? '1px solid #ff6600' : undefined, color: bulkMode ? '#ff6600' : undefined }}
              onClick={() => { setBulkMode(m => !m); setSelected(new Set()) }}
            >
              {bulkMode ? 'CANCEL SELECT' : 'SELECT'}
            </button>
            <input ref={fileInputRef} type="file" accept=".fit,.gpx" style={{ display:'none' }} onChange={handleFileImport}/>
            <input ref={csvInputRef}  type="file" accept=".csv"       style={{ display:'none' }} onChange={handleCSVImport}/>
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
                  {bulkMode && <th style={{ padding:'4px 6px 8px 0', fontWeight:600, width:'24px' }}></th>}
                  <th style={{ padding:'4px 6px 8px 0', fontWeight:600, width:'28px' }}></th>
                  {['DATE','TYPE','MIN','RPE','TSS','LOAD','NOTES',''].map(h=>(
                    <th key={h} style={{ textAlign:['TSS','MIN','RPE','LOAD',''].includes(h)?'right':'left', padding:'4px 6px 8px 0', fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reversedLog.map((s,i)=>{
                  const hasTag = s.tags && s.tags.length > 0
                  const suggestedTag = !hasTag ? autoTagSession(s) : null
                  const isExpanded = expandedId === s.id
                  return (
                    <>
                    <tr key={i} style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border)', background: bulkMode && selected.has(s.id) ? '#ff660011' : isExpanded ? '#0f0f0f' : undefined, cursor: bulkMode ? undefined : 'pointer' }}
                      onClick={bulkMode ? undefined : () => setExpandedId(isExpanded ? null : s.id)}>
                      {bulkMode && (
                        <td style={{ padding:'6px 6px 6px 0' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => {
                              setSelected(prev => {
                                const next = new Set(prev)
                                if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                                return next
                              })
                            }}
                            style={{ accentColor:'#ff6600', cursor:'pointer' }}
                          />
                        </td>
                      )}
                      <td style={{ padding:'6px 4px 6px 0', color:'#444', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', width:'28px', letterSpacing:'0.04em' }}>{typePrefix(s.type)}</td>
                      <td style={{ padding:'6px 6px 6px 0', color:'var(--sub)' }}>{s.date}</td>
                      <td style={{ padding:'6px 6px 6px 0' }}>{s.type}</td>
                      <td style={{ textAlign:'right', padding:'6px 6px 6px 0' }}>{s.duration}</td>
                      <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:s.rpe>=8?'#e03030':s.rpe>=6?'#f5c542':'#5bc25b' }}>{s.rpe}</td>
                      <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:'#ff6600', fontWeight:600 }}>{s.tss}</td>
                      <td style={{ textAlign:'right', padding:'6px 6px 6px 0', color:'#555', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', letterSpacing:'0.04em' }}>{tssBand(s.tss)}</td>
                      <td style={{ padding:'6px 6px 6px 0', color:'#888', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.wPrimeExhausted && <span title="W' reached zero — complete anaerobic depletion (Skiba 2012)" style={{ display:'inline-block', background:'#e03030', color:'#fff', fontSize:'8px', fontWeight:700, borderRadius:'3px', padding:'1px 4px', marginRight:'4px', letterSpacing:'0.05em' }}>⚡W'0</span>}
                        {s.notes}
                        {suggestedTag && (
                          <span
                            onClick={e => { e.stopPropagation(); applyTag(s, suggestedTag) }}
                            style={{ ...S.mono, fontSize:'9px', color:'#ff660088', border:'1px solid #ff660033', borderRadius:2, padding:'1px 5px', cursor:'pointer', marginLeft:4 }}
                            title="Auto-suggested tag — click to apply"
                          >{suggestedTag}</span>
                        )}
                      </td>
                      <td style={{ textAlign:'right', whiteSpace:'nowrap' }} onClick={e => e.stopPropagation()}>
                        {s.trackpoints?.length >= 2 && (
                          <button onClick={() => setRouteSession(s)}
                            title="View route"
                            style={{ background:'none', border:'none', color:'#0064ff', cursor:'pointer', ...S.mono, fontSize:'11px', marginRight:'4px' }}>⌖</button>
                        )}
                        <button onClick={()=>startEdit(s,i)}
                          style={{ background:'none', border:'none', color:'#aaa', cursor:'pointer', ...S.mono, fontSize:'12px', marginRight:'4px' }}>✎</button>
                        <button onClick={()=>setLog(log.filter((_,idx)=>idx!==log.length-1-i))}
                          style={{ background:'none', border:'none', color:'#ccc', cursor:'pointer', ...S.mono, fontSize:'12px' }}>✕</button>
                      </td>
                    </tr>
                    {i === 0 && lastPBs && lastPBs.map((pb, pi) => (
                      <tr key={`pb-${pi}`} style={{ background: 'transparent' }}>
                        <td colSpan={bulkMode ? 10 : 9} style={{ padding: 0 }}>
                          <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', fontFamily: "'IBM Plex Mono', monospace", paddingLeft: '16px', marginBottom: '2px' }}>
                            → {pb}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {isExpanded && (() => {
                      const colCount = bulkMode ? 10 : 9
                      return (
                        <tr key={`exp-${i}`} style={{ borderBottom:'1px solid var(--border)', background:'#0a0a0a' }}>
                          <td colSpan={colCount} style={{ padding:'0 0 10px 0' }}>
                            <div style={{ margin:'0 6px 0 0', padding:'12px', background:'#0f0f0f', border:'1px solid #1e1e1e', borderRadius:'4px' }}>
                              <div style={{ fontSize:'9px', color:'#ff6600', letterSpacing:'0.12em', marginBottom:'10px', fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>SESSION ANALYSIS</div>
                              {expandedCtlInfo && (
                                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#666', marginBottom:'10px' }}>
                                  CTL: {expandedCtlInfo.ctlBefore} → {expandedCtlInfo.ctlAfter} ({expandedCtlInfo.delta >= 0 ? '+' : ''}{expandedCtlInfo.delta} this session)
                                </div>
                              )}
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px', fontFamily:"'IBM Plex Mono',monospace" }}>
                                <div>
                                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'3px' }}>COMPARISON</div>
                                  <div style={{ fontSize:'10px', color:'#aaa' }}>{expandedAnalysis?.comparison}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'3px' }}>ZONE ESTIMATE</div>
                                  <div style={{ fontSize:'10px', color:'#aaa' }}>{expandedAnalysis?.zone_estimate}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'3px' }}>RECOVERY</div>
                                  <div style={{ fontSize:'10px', color:'#aaa' }}>{expandedAnalysis?.recovery_time}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'3px' }}>NOTES</div>
                                  {expandedAnalysis?.notes.map((n,ni) => <div key={ni} style={{ fontSize:'10px', color:'#aaa' }}>· {n}</div>)}
                                </div>
                              </div>
                              {expandedEntry?.decouplingPct != null && (() => {
                                const pct = expandedEntry.decouplingPct
                                const cls = pct < 5 ? 'coupled' : pct < 10 ? 'mild' : 'significant'
                                const color = cls === 'coupled' ? '#5bc25b' : cls === 'mild' ? '#ff6600' : '#e03030'
                                return (
                                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", marginBottom:'10px' }}>
                                    <div style={{ fontSize:'9px', color:'#555', marginBottom:'3px' }}>
                                      <ScienceTooltip anchor="10-aerobic-decoupling-pwhr" label="Aerobic Decoupling" short="Pw:Hr ratio drift first vs second half. <5% = coupled aerobic base. Friel 2009.">AEROBIC DECOUPLING (Pw:Hr)</ScienceTooltip>
                                    </div>
                                    <div style={{ fontSize:'10px', color }}>
                                      {pct.toFixed(1)}% ({cls})
                                    </div>
                                    <div style={{ fontSize:'9px', color:'#444', marginTop:'2px' }}>
                                      {'<5% coupled · 5–10% mild · >10% significant — Friel 2009'}
                                    </div>
                                  </div>
                                )
                              })()}
                              {expandedSimilar.length > 0 && (
                                <div style={{ fontFamily:"'IBM Plex Mono',monospace" }}>
                                  <div style={{ fontSize:'9px', color:'#555', marginBottom:'5px' }}>SIMILAR SESSIONS</div>
                                  {expandedSimilar.map((sm,si) => (
                                    <div key={si} style={{ fontSize:'10px', color:'#666', display:'flex', gap:'12px' }}>
                                      <span>{sm.date}</span>
                                      <span>{sm.tss} TSS</span>
                                      <span>{sm.duration}min</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })()}
                    </>
                  )
                })}
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
              const _wExhaustSec = wExhausted ? wbalPrev.findIndex(v => v <= 0) : -1
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

      {/* CSV bulk import preview modal */}
      {csvPreview && (
        <div style={{ position:'fixed', inset:0, zIndex:20500, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'IBM Plex Mono',monospace" }}>
          <div style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'28px', width:'100%', maxWidth:'560px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#ff6600', letterSpacing:'0.1em', marginBottom:'18px' }}>
              ↑ BULK IMPORT CSV
            </div>
            {/* Summary counts */}
            <div style={{ display:'flex', gap:'12px', marginBottom:'18px', flexWrap:'wrap' }}>
              {[
                { lbl:'READY TO IMPORT', val:csvPreview.entries.length, color:'#5bc25b' },
                { lbl:'SKIPPED (INVALID)', val:csvPreview.skipped, color: csvPreview.skipped > 0 ? '#f5c542' : '#555' },
                { lbl:'DUPLICATES SKIPPED', val:csvPreview.duplicates, color: csvPreview.duplicates > 0 ? '#888' : '#555' },
              ].map(({ lbl, val, color }) => (
                <div key={lbl} style={{ flex:'1 1 120px', background:'#0a0a0a', borderRadius:'4px', padding:'10px 12px', minWidth:'100px' }}>
                  <div style={{ fontSize:'8px', color:'#555', letterSpacing:'0.08em', marginBottom:'4px' }}>{lbl}</div>
                  <div style={{ fontSize:'18px', fontWeight:700, color }}>{val}</div>
                </div>
              ))}
            </div>
            {/* Preview table — first 5 rows */}
            {csvPreview.entries.length > 0 ? (
              <>
                <div style={{ fontSize:'9px', color:'#555', letterSpacing:'0.08em', marginBottom:'8px' }}>PREVIEW (first 5 rows)</div>
                <div style={{ overflowX:'auto', marginBottom:'12px' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid #2a2a2a', color:'#555', fontSize:'9px', letterSpacing:'0.06em' }}>
                        {['DATE','TYPE','MIN','TSS','RPE'].map(h => (
                          <th key={h} style={{ padding:'4px 8px 6px 0', textAlign:'left', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.entries.slice(0,5).map((e,i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #1a1a1a' }}>
                          <td style={{ padding:'5px 8px 5px 0', color:'var(--sub,#aaa)' }}>{e.date}</td>
                          <td style={{ padding:'5px 8px 5px 0' }}>{e.type}</td>
                          <td style={{ padding:'5px 8px 5px 0' }}>{e.durationMin || e.duration || '—'}</td>
                          <td style={{ padding:'5px 8px 5px 0', color:'#ff6600', fontWeight:600 }}>{e.tss ?? '—'}</td>
                          <td style={{ padding:'5px 8px 5px 0' }}>{e.rpe ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvPreview.entries.length > 5 && (
                  <div style={{ fontSize:'10px', color:'#666', marginBottom:'16px' }}>
                    …and {csvPreview.entries.length - 5} more {csvPreview.entries.length - 5 === 1 ? 'entry' : 'entries'}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize:'11px', color:'#888', marginBottom:'16px', padding:'12px', background:'#0a0a0a', borderRadius:'4px' }}>
                No new entries to import. All rows were either invalid or already exist in your log.
              </div>
            )}
            <div style={{ display:'flex', gap:'10px' }}>
              <button
                onClick={confirmCSVImport}
                disabled={csvPreview.entries.length === 0}
                style={{ flex:1, padding:'11px', background: csvPreview.entries.length ? '#ff6600' : '#333', color: csvPreview.entries.length ? '#fff' : '#555', border:'none', borderRadius:'4px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', cursor: csvPreview.entries.length ? 'pointer' : 'not-allowed' }}
              >
                ✓ IMPORT {csvPreview.entries.length} {csvPreview.entries.length === 1 ? 'SESSION' : 'SESSIONS'}
              </button>
              <button onClick={() => setCsvPreview(null)} style={{ flex:1, padding:'11px', background:'#1a1a1a', color:'#888', border:'1px solid #333', borderRadius:'4px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', cursor:'pointer' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route map modal */}
      {routeSession && (
        <div style={{ position:'fixed', inset:0, zIndex:21000, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
          <div style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'20px', width:'100%', maxWidth:'520px', fontFamily:"'IBM Plex Mono',monospace" }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ fontSize:'11px', fontWeight:700, color:'#ff6600', letterSpacing:'0.1em' }}>
                ⌖ ROUTE — {routeSession.date}
              </div>
              <button onClick={() => setRouteSession(null)} aria-label="Close" style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'16px' }}>✕</button>
            </div>
            <ActivityMap trackpoints={routeSession.trackpoints} onClose={() => setRouteSession(null)} />
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:500, background:'#111', borderTop:'1px solid #333', padding:'10px 16px', display:'flex', gap:'8px', alignItems:'center' }}>
          <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>{selected.size} selected</span>
          <select
            onChange={e => { handleBulkTag(e.target.value); e.target.value = '' }}
            style={{ ...S.mono, fontSize:'11px', background:'#222', color:'#ccc', border:'1px solid #444', borderRadius:3, padding:'4px 8px' }}
            defaultValue=""
          >
            <option value="">Tag selected…</option>
            {['Race','Key Session','Recovery','Easy','Test'].map(t2 => <option key={t2} value={t2}>{t2}</option>)}
          </select>
          <button onClick={handleBulkDelete} style={{ ...S.btn, fontSize:'11px', background:'#e03030', padding:'4px 12px' }}>Delete ({selected.size})</button>
          <button onClick={() => { setSelected(new Set()); setBulkMode(false) }} style={{ ...S.btnSec, fontSize:'11px', padding:'4px 10px' }}>Cancel</button>
        </div>
      )}

      {/* ── Upload & Parse overlay ─────────────────────────────────────────── */}
      {showUploadPanel && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowUploadPanel(false) }}
        >
          <UploadActivity
            authUser={authUser}
            onSuccess={logEntryId => {
              setShowUploadPanel(false)
              logger.info('upload-parse done, logEntryId:', logEntryId)
            }}
            onClose={() => setShowUploadPanel(false)}
          />
        </div>
      )}
    </div>
  )
}
