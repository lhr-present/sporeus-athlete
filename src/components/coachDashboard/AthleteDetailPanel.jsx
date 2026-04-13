import { useState } from 'react'
import { S } from '../../styles.js'
import { daysBefore, computeLoad, getReadinessColor, generateCoachPlan, SPORT_GOALS, ComplianceBar, escHtml, TODAY } from './helpers.jsx'
import { analyzeLoadTrend, analyzeZoneBalance, predictInjuryRisk, predictFitness, analyzeRecoveryCorrelation, computeRaceReadiness, predictRacePerformance } from '../../lib/intelligence.js'
import { correlateTrainingToResults, findRecoveryPatterns, mineInjuryPatterns, findOptimalWeekStructure } from '../../lib/patterns.js'

// ─── Athlete Detail ───────────────────────────────────────────────────────────

export default function AthleteDetailPanel({ athlete, onUpdate, onClose, templates, setTemplates }) {
  const log = athlete.log || []
  const recovery = athlete.recovery || []
  const { ctl, atl, tsb } = computeLoad(log)
  const tsbColor = tsb > 5 ? '#5bc25b' : tsb < -10 ? '#e03030' : '#f5c542'
  const last5 = [...log].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 5)
  const recTrend = [...recovery].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 7).map(r => r.score || '?').join(', ')
  const d14 = daysBefore(14)
  const recentInjuryZones = [...new Set((athlete.injuryLog || []).filter(e => e.date >= d14).map(e => e.zone).filter(Boolean))]
  const complianceWeeks = Array.from({length:4}, (_, w) => {
    const wStart = daysBefore(28 - w * 7), wEnd = daysBefore(21 - w * 7)
    const actual = log.filter(e => e.date >= wStart && e.date < wEnd).length
    return { week: 4 - w, actual, expected: 4, pct: Math.min(100, Math.round((actual / 4) * 100)) }
  })

  const athleteSport = (athlete.sport || athlete.profile?.sport || 'running').toLowerCase()
  const goalOptions = SPORT_GOALS[athleteSport] || SPORT_GOALS.running

  const [planGoal, setPlanGoal] = useState(goalOptions[0])
  const [planWeeks, setPlanWeeks] = useState('8')
  const [planHours, setPlanHours] = useState('8')
  const [planLevel, setPlanLevel] = useState('Intermediate')
  const [planSaved, setPlanSaved] = useState(false)

  const [noteText, setNoteText] = useState('')
  const [editingNoteIdx, setEditingNoteIdx] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')

  function handleGeneratePlan() {
    const plan = generateCoachPlan({ goal: planGoal, weeks: planWeeks, hoursPerWeek: planHours, level: planLevel, athleteName: athlete.name, sport: athleteSport })
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `sporeus-plan-${athlete.name.replace(/\s+/g,'-')}-${TODAY}.json`; a.click()
    URL.revokeObjectURL(url)
    setPlanSaved(false)
  }

  function handleSaveTemplate() {
    const name = `${athleteSport.charAt(0).toUpperCase()+athleteSport.slice(1)} ${planWeeks}wk ${planLevel}`
    const tmpl = { id: Date.now(), name, sport: athleteSport, goal: planGoal, weeks: planWeeks, hours: planHours, level: planLevel }
    setTemplates(prev => [...prev, tmpl])
    setPlanSaved(true)
    setTimeout(() => setPlanSaved(false), 2000)
  }

  function handleAddNote() {
    if (!noteText.trim()) return
    onUpdate({ ...athlete, notes: [{ date: TODAY, text: noteText.trim() }, ...(athlete.notes || [])] })
    setNoteText('')
  }
  function handleDeleteNote(idx) {
    const notes = [...(athlete.notes || [])]; notes.splice(idx, 1); onUpdate({ ...athlete, notes })
  }
  function handleSaveEditNote() {
    const notes = [...(athlete.notes || [])]
    notes[editingNoteIdx] = { ...notes[editingNoteIdx], text: editNoteText.trim() }
    onUpdate({ ...athlete, notes }); setEditingNoteIdx(null); setEditNoteText('')
  }

  function handleCopyReport() {
    const totalActual = complianceWeeks.reduce((s, c) => s + c.actual, 0)
    const lines = [`COMPLIANCE REPORT — ${athlete.name}`, `Generated: ${TODAY}`, '', ...complianceWeeks.map(c => `Week ${c.week}: ${c.actual}/${c.expected} (${c.pct}%)`), '', `4-Week Total: ${totalActual}/16 (${Math.round(totalActual/16*100)}%)`]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  function handlePrintReport() {
    const p = athlete.profile || {}
    const load = computeLoad(log)
    const totalActual = complianceWeeks.reduce((s, c) => s + c.actual, 0)
    const totalPct = Math.round((totalActual / 16) * 100)
    const avgRec = recovery.length ? Math.round(recovery.slice(-7).reduce((s, r) => s + (r.score || 0), 0) / Math.min(7, recovery.length)) : null
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sporeus — ${escHtml(athlete.name)}</title>
<style>body{font-family:'IBM Plex Mono','Courier New',monospace;background:#0a0a0a;color:#e0e0e0;margin:0;padding:24px;font-size:12px}.h{border-bottom:2px solid #ff6600;padding-bottom:12px;margin-bottom:20px}.ht{font-size:20px;font-weight:700;color:#ff6600;letter-spacing:.1em}.sec{margin-bottom:18px;border:1px solid #222;border-radius:4px;padding:14px}.st{font-size:10px;font-weight:700;color:#0064ff;letter-spacing:.1em;margin-bottom:10px}.row{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px}.sv{font-size:22px;font-weight:700}.sl{font-size:9px;color:#888;letter-spacing:.06em;margin-top:3px}table{width:100%;border-collapse:collapse;font-size:11px}th{text-align:left;padding:4px 8px;color:#888;font-size:9px;border-bottom:1px solid #333}td{padding:5px 8px;border-bottom:1px solid #1a1a1a}.o{color:#ff6600}.b{color:#0064ff}.g{color:#5bc25b}.r{color:#e03030}.y{color:#f5c542}.tag{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="h"><div class="ht">◈ SPOREUS ATHLETE REPORT</div><div style="font-size:10px;color:#888;margin-top:4px">COACH: HÜSEYIN IŞIK · ${escHtml(TODAY)}</div></div>
<div class="sec"><div class="st">01 / ATHLETE PROFILE</div><div class="row"><div><span style="color:#888;font-size:9px">NAME</span><br/><strong style="font-size:14px">${escHtml(athlete.name)}</strong></div><div><span style="color:#888;font-size:9px">SPORT</span><br/>${escHtml(athlete.sport||'—')}</div><div><span style="color:#888;font-size:9px">AGE</span><br/>${escHtml(p.age||'—')}</div><div><span style="color:#888;font-size:9px">WEIGHT</span><br/>${escHtml(p.weight?p.weight+' kg':'—')}</div><div><span style="color:#888;font-size:9px">FTP</span><br/>${escHtml(p.ftp?p.ftp+' W':'—')}</div><div><span style="color:#888;font-size:9px">VO2MAX</span><br/>${escHtml(p.vo2max||'—')}</div><div><span style="color:#888;font-size:9px">GOAL</span><br/>${escHtml(p.goal||'—')}</div></div></div>
<div class="sec"><div class="st">02 / TRAINING LOAD</div><div class="row"><div class="sv b">${load.ctl}<div class="sl">CTL (FITNESS)</div></div><div class="sv r">${load.atl}<div class="sl">ATL (FATIGUE)</div></div><div class="sv ${load.tsb>5?'g':load.tsb<-10?'r':'y'}">${load.tsb>=0?'+':''}${load.tsb}<div class="sl">TSB (FORM)</div></div><div class="sv o">${log.reduce((s,e)=>s+(e.tss||0),0)}<div class="sl">TOTAL TSS</div></div><div class="sv">${log.length}<div class="sl">SESSIONS</div></div></div></div>
<div class="sec"><div class="st">03 / LAST 5 SESSIONS</div>${last5.length?'<table><thead><tr><th>DATE</th><th>TYPE</th><th>DUR</th><th>RPE</th><th>TSS</th></tr></thead><tbody>'+last5.map(s=>`<tr><td style="color:#888">${escHtml(s.date||'—')}</td><td>${escHtml(s.type||'—')}</td><td class="o">${s.duration?s.duration+'m':'—'}</td><td>${s.rpe||'—'}</td><td class="b">${s.tss||'—'}</td></tr>`).join('')+'</tbody></table>':'<div style="color:#888">No sessions.</div>'}</div>
<div class="sec"><div class="st">04 / RECOVERY & READINESS</div>${avgRec!==null?`<div class="sv ${avgRec>=75?'g':avgRec>=50?'y':'r'}">${avgRec}<div class="sl">7-DAY AVG READINESS</div></div>`:''}<div style="margin-top:8px;color:#5bc25b;font-size:13px">${escHtml(recTrend||'—')}</div></div>
<div class="sec"><div class="st">05 / INJURY FLAGS (14 DAYS)</div>${recentInjuryZones.length?recentInjuryZones.map(z=>`<span class="tag r">⚠ ${escHtml(z)}</span> `).join(''):'<span class="tag g">✓ None reported</span>'}</div>
<div class="sec"><div class="st">06 / 4-WEEK COMPLIANCE</div><table><thead><tr><th>WEEK</th><th>SESSIONS</th><th>%</th></tr></thead><tbody>${complianceWeeks.map(c=>`<tr><td style="color:#888">Week ${c.week}</td><td>${c.actual}/${c.expected}</td><td class="${c.pct>=75?'g':c.pct>=50?'y':'r'}">${c.pct}%</td></tr>`).join('')}<tr style="font-weight:700;border-top:2px solid #333"><td>TOTAL</td><td>${totalActual}/16</td><td class="${totalPct>=75?'g':totalPct>=50?'y':'r'}">${totalPct}%</td></tr></tbody></table></div>
<div class="sec"><div class="st">07 / COACH NOTES</div>${(athlete.notes||[]).slice(0,5).length?((athlete.notes||[]).slice(0,5).map(n=>`<div style="border-bottom:1px solid #222;padding:6px 0"><span style="color:#888;font-size:9px">${escHtml(n.date)}</span><span style="margin-left:12px">${escHtml(n.text)}</span></div>`).join('')):'<div style="color:#888">No notes.</div>'}</div>
<div style="text-align:center;color:#444;font-size:9px;margin-top:24px">SPOREUS · ${escHtml(TODAY)} · SPOREUS.COM</div>
</body></html>`
    const w = window.open('', '_blank', 'width=820,height=940')
    if (!w) { alert('Pop-up blocked — allow pop-ups to print.'); return }
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600)
  }

  return (
    <div style={{ marginTop:'12px', borderTop:'1px solid var(--border)', paddingTop:'12px' }}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px' }}>
        <button style={{ ...S.btn, background:'#0064ff', fontSize:'11px', padding:'6px 14px' }} onClick={handlePrintReport}>
          ⊞ Print PDF Report
        </button>
      </div>

      {/* CTL / ATL / TSB */}
      <div style={{ ...S.row, marginBottom:'12px' }}>
        {[['CTL (Fitness)', ctl, '#0064ff'], ['ATL (Fatigue)', atl, '#e03030'], ['TSB (Form)', (tsb>=0?'+':'')+tsb, tsbColor]].map(([lbl, val, color]) => (
          <div key={lbl} style={{ flex:'1 1 90px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'10px', textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'20px', fontWeight:700, color }}>{val}</div>
            <div style={{ ...S.mono, fontSize:'9px', color:'var(--muted)', letterSpacing:'0.08em', marginTop:'4px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Last 5 sessions */}
      <div style={S.cardTitle}>LAST 5 SESSIONS</div>
      {last5.length === 0 ? (
        <div style={{ ...S.mono, fontSize:'12px', color:'var(--muted)', marginBottom:'12px' }}>No sessions logged.</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'11px', marginBottom:'12px' }}>
          <thead><tr style={{ borderBottom:'1px solid var(--border)', color:'var(--muted)' }}>
            {['DATE','TYPE','DUR','RPE','TSS'].map(h => <th key={h} style={{ textAlign:'left', padding:'4px 6px', fontWeight:600, letterSpacing:'0.06em' }}>{h}</th>)}
          </tr></thead>
          <tbody>{last5.map((s, i) => (
            <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'4px 6px', color:'var(--muted)' }}>{s.date||'—'}</td>
              <td style={{ padding:'4px 6px' }}>{s.type||'—'}</td>
              <td style={{ padding:'4px 6px', color:'#ff6600' }}>{s.duration?`${s.duration}m`:'—'}</td>
              <td style={{ padding:'4px 6px' }}>{s.rpe||'—'}</td>
              <td style={{ padding:'4px 6px', color:'#0064ff' }}>{s.tss||'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {/* Recovery + Injuries */}
      <div style={{ marginBottom:'12px' }}>
        <span style={S.label}>RECOVERY TREND (last 7)</span>
        <div style={{ ...S.mono, fontSize:'13px', color:'#5bc25b' }}>{recTrend || '—'}</div>
      </div>
      <div style={{ marginBottom:'12px' }}>
        <span style={S.label}>INJURY FLAGS (last 14 days)</span>
        {recentInjuryZones.length === 0
          ? <div style={{ ...S.mono, fontSize:'12px', color:'#5bc25b' }}>None reported</div>
          : <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>{recentInjuryZones.map(z => <span key={z} style={S.tag('#e03030')}>⚠ {z}</span>)}</div>
        }
      </div>

      {/* Compliance */}
      <div style={{ ...S.card, background:'var(--surface)', marginBottom:'12px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={S.cardTitle}>COMPLIANCE</div>
          <button style={{ ...S.btnSec, fontSize:'11px', padding:'4px 10px' }} onClick={handleCopyReport}>Copy</button>
        </div>
        {complianceWeeks.map(cw => (
          <div key={cw.week} style={{ marginBottom:'6px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'11px', marginBottom:'3px' }}>
              <span style={{ color:'var(--muted)' }}>Week {cw.week}</span>
              <span>{cw.actual}/{cw.expected}</span>
            </div>
            <ComplianceBar pct={cw.pct}/>
          </div>
        ))}
      </div>

      {/* Plan Export */}
      <div style={{ ...S.card, background:'var(--surface)', marginBottom:'12px' }}>
        <div style={S.cardTitle}>CREATE PLAN — {athlete.name.toUpperCase()}</div>
        <div style={{ ...S.mono, fontSize:'9px', color:'#0064ff', marginBottom:'8px' }}>SPORT: {athleteSport.toUpperCase()}</div>
        <div style={{ ...S.row, marginBottom:'10px' }}>
          <div style={{ flex:'1 1 130px' }}>
            <label style={S.label}>GOAL</label>
            <select style={S.select} value={planGoal} onChange={e => setPlanGoal(e.target.value)}>
              {goalOptions.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 75px' }}>
            <label style={S.label}>WEEKS</label>
            <input type="number" min="4" max="20" style={S.input} value={planWeeks} onChange={e => setPlanWeeks(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 75px' }}>
            <label style={S.label}>HRS/WK</label>
            <input type="number" min="4" max="20" style={S.input} value={planHours} onChange={e => setPlanHours(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 110px' }}>
            <label style={S.label}>LEVEL</label>
            <select style={S.select} value={planLevel} onChange={e => setPlanLevel(e.target.value)}>
              {['Beginner','Intermediate','Advanced'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <button style={S.btn} onClick={handleGeneratePlan}>Generate &amp; Export</button>
          <button style={{ ...S.btnSec, fontSize:'11px' }} onClick={handleSaveTemplate}>
            {planSaved ? '✓ Saved!' : '+ Save as Template'}
          </button>
        </div>
      </div>

      {/* Coach Notes */}
      <div style={{ ...S.card, background:'var(--surface)' }}>
        <div style={S.cardTitle}>COACH NOTES</div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
          <textarea style={{ ...S.input, height:'56px', resize:'vertical', flex:1 }} placeholder="Add a note..." value={noteText} onChange={e => setNoteText(e.target.value)}/>
          <button style={{ ...S.btn, alignSelf:'flex-end', whiteSpace:'nowrap' }} onClick={handleAddNote}>Add</button>
        </div>
        {(athlete.notes || []).slice(0, 6).map((note, i) => (
          <div key={i} style={{ borderBottom:'1px solid var(--border)', padding:'6px 0' }}>
            {editingNoteIdx === i ? (
              <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                <textarea style={{ ...S.input, height:'44px', resize:'vertical', flex:1, fontSize:'12px' }} value={editNoteText} onChange={e => setEditNoteText(e.target.value)} autoFocus/>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  <button onClick={handleSaveEditNote} style={{ ...S.btn, fontSize:'10px', padding:'4px 10px' }}>✓</button>
                  <button onClick={() => { setEditingNoteIdx(null); setEditNoteText('') }} style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px' }}>✕</button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <span style={{ ...S.mono, fontSize:'10px', color:'var(--muted)', marginRight:'8px' }}>{note.date}</span>
                  <span style={{ ...S.mono, fontSize:'12px' }}>{note.text}</span>
                </div>
                <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                  <button onClick={() => { setEditingNoteIdx(i); setEditNoteText(note.text) }} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', ...S.mono, fontSize:'13px', padding:'0 3px', lineHeight:1 }}>✎</button>
                  <button onClick={() => handleDeleteNote(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#e03030', ...S.mono, fontSize:'14px', padding:'0 3px', lineHeight:1 }}>×</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!(athlete.notes && athlete.notes.length) && <div style={{ ...S.mono, fontSize:'12px', color:'var(--muted)' }}>No notes yet.</div>}
      </div>

      {/* ATHLETE INTELLIGENCE (v4.3) */}
      {log.length >= 4 && (() => {
        const loadTrend   = analyzeLoadTrend(log)
        const zoneBalance = analyzeZoneBalance(log)
        const injRisk     = predictInjuryRisk(log, recovery)
        const fitness     = predictFitness(log)
        const recovCorr   = analyzeRecoveryCorrelation(log, recovery)

        const fullAnalysis = [
          `ATHLETE INTELLIGENCE — ${athlete.name}`,
          `Generated: ${TODAY}`,
          '',
          `LOAD TREND: ${loadTrend.trend.toUpperCase()} (${loadTrend.change > 0 ? '+' : ''}${loadTrend.change}%)`,
          loadTrend.advice.en,
          '',
          `ZONE BALANCE: ${zoneBalance.status.replace('_',' ').toUpperCase()} (${zoneBalance.z1z2Pct}% easy / ${zoneBalance.z4z5Pct}% hard)`,
          zoneBalance.recommendation.en,
          '',
          `INJURY RISK: ${injRisk.level.toUpperCase()} (score ${injRisk.score}/100)`,
          injRisk.factors.map(f => `  · ${f.label}: ${f.detail.en}`).join('\n'),
          injRisk.advice.en,
          '',
          `FITNESS: CTL ${fitness.current} → 4wk ${fitness.in4w} → 8wk ${fitness.in8w} (${fitness.trajectory.toUpperCase()})`,
          fitness.label.en,
          '',
          recovCorr.correlation !== null ? `LOAD↔RECOVERY: ${recovCorr.insight.en}` : '',
        ].filter(l => l !== '').join('\n')

        return (
          <div style={{ marginTop:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600', letterSpacing:'0.08em', fontWeight:600 }}>◈ ATHLETE INTELLIGENCE</div>
              <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 10px' }} onClick={() => navigator.clipboard.writeText(fullAnalysis).catch(() => {})}>
                Copy Full Analysis
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              {[
                { lbl:'LOAD TREND',   val: loadTrend.trend.toUpperCase(),                c: loadTrend.trend==='building'?'#5bc25b':loadTrend.trend==='recovering'?'#4a90d9':'#f5c542',  txt: loadTrend.advice.en },
                { lbl:'ZONE BALANCE', val: zoneBalance.status.replace('_',' ').toUpperCase(), c: zoneBalance.status==='polarized'?'#5bc25b':zoneBalance.status==='too_hard'?'#e03030':'#f5c542', txt: zoneBalance.recommendation.en },
                { lbl:'INJURY RISK',  val: injRisk.level,                                 c: { LOW:'#5bc25b', MODERATE:'#f5c542', HIGH:'#e03030', unknown:'#888' }[injRisk.level] || '#888', txt: injRisk.advice.en },
                { lbl:'FITNESS',      val: `CTL ${fitness.current}→${fitness.in4w}`,     c: fitness.trajectory==='improving'?'#5bc25b':fitness.trajectory==='declining'?'#e03030':'#f5c542', txt: fitness.label.en },
              ].map(row => (
                <div key={row.lbl} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 10px', background:'var(--surface)', borderRadius:'4px', borderLeft:`3px solid ${row.c}` }}>
                  <div style={{ minWidth:'110px' }}>
                    <div style={{ ...S.mono, fontSize:'8px', color:'#888', letterSpacing:'0.06em' }}>{row.lbl}</div>
                    <div style={{ ...S.mono, fontSize:'12px', fontWeight:600, color:row.c }}>{row.val}</div>
                  </div>
                  <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', lineHeight:1.6 }}>{row.txt}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* PATTERNS (v4.5) */}
      {log.length >= 14 && (() => {
        const testRes   = athlete.testResults || []
        const injuries  = athlete.injuryLog || []
        const trainTest = correlateTrainingToResults(log, testRes)
        const recPat    = findRecoveryPatterns(log, recovery)
        const injPat    = mineInjuryPatterns(log, injuries, recovery)
        const weekPat   = findOptimalWeekStructure(log, recovery)

        const allPat = [
          ...trainTest.patterns.map(p => ({ icon:'🔬', text: p.en, conf: p.confidence })),
          ...(recPat.optimalReadiness ? [{ icon:'💤', text: recPat.optimalReadiness.en, conf:'moderate' }] : []),
          ...injPat.patterns.map(p => ({ icon:'🦴', text: p.en, conf: p.confidence })),
          ...(weekPat.reliable ? [{ icon:'📋', text: weekPat.en, conf:'moderate' }] : []),
        ]

        if (!allPat.length) return null

        const copyPatterns = () => {
          const txt = [`PATTERNS — ${athlete.name}`, '─'.repeat(30), ...allPat.map(p=>`${p.icon} [${p.conf.toUpperCase()}] ${p.text}`)].join('\n')
          navigator.clipboard.writeText(txt).catch(()=>{})
        }

        return (
          <div style={{ marginTop:'14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <div style={{ ...S.mono, fontSize:'10px', color:'#4a90d9', letterSpacing:'0.08em', fontWeight:600 }}>◈ PATTERNS</div>
              <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 10px' }} onClick={copyPatterns}>Copy Patterns</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              {allPat.map((p, i) => (
                <div key={i} style={{ display:'flex', gap:'8px', padding:'6px 8px', background:'var(--surface)', borderRadius:'4px' }}>
                  <span style={{ fontSize:'13px', flexShrink:0 }}>{p.icon}</span>
                  <span style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', lineHeight:1.6, flex:1 }}>{p.text}</span>
                  <span style={{ ...S.mono, fontSize:'8px', color: p.conf==='high'?'#5bc25b':p.conf==='moderate'?'#f5c542':'#888', flexShrink:0 }}>{p.conf.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* RACE BRIEF (v4.6) */}
      {log.length >= 7 && (() => {
        const rr   = computeRaceReadiness(log, recovery, athlete.injuryLog||[], athlete.profile||{}, null, {})
        const perf = predictRacePerformance(log, athlete.testResults||[], athlete.profile||{})
        const prof = athlete.profile || {}
        const goal = prof.goal || '—'
        const raceDate = prof.raceDate || null
        const daysToRace = raceDate ? Math.ceil((new Date(raceDate) - new Date()) / 864e5) : null

        const weakFactors = [...rr.factors].sort((a,b) => a.score-b.score).slice(0,2)
        const goalPred = perf.reliable ? perf.predictions.find(p=>(goal||'').toLowerCase().includes(p.label.toLowerCase())) || perf.predictions[1] : null

        const briefText = [
          `RACE BRIEF: ${athlete.name}`,
          `Event: ${goal} | ${raceDate ? `Date: ${raceDate} |` : ''} ${daysToRace ? `${daysToRace} days out` : ''}`,
          `Readiness: ${rr.score}/100 (${rr.grade}) — ${rr.verdict.en.slice(0,60)}...`,
          goalPred ? `Predicted: ${goalPred.predicted} (range: ${goalPred.best}–${goalPred.worst})` : '',
          `Top concerns: ${weakFactors.map(f=>`${f.name} (${f.score}/100)`).join(', ')}`,
          `Action items: ${weakFactors.map(f=>f.en).join(' | ')}`,
          `— Generated by Sporeus Athlete Console`,
        ].filter(Boolean).join('\n')

        return (
          <div style={{ marginTop:'14px', padding:'10px 12px', background:'var(--surface)', borderRadius:'6px', border:'1px solid #0064ff33' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <div style={{ ...S.mono, fontSize:'10px', color:'#0064ff', fontWeight:600, letterSpacing:'0.08em' }}>◈ RACE BRIEF</div>
              <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 10px' }} onClick={() => navigator.clipboard.writeText(briefText).catch(()=>{})}>
                Copy Brief
              </button>
            </div>
            <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
              <div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>READINESS</div>
                <div style={{ ...S.mono, fontSize:'16px', fontWeight:700, color:rr.score>=85?'#5bc25b':rr.score>=70?'#0064ff':rr.score>=55?'#f5c542':'#e03030' }}>{rr.grade} · {rr.score}</div>
              </div>
              {goalPred && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>PREDICTED</div>
                  <div style={{ ...S.mono, fontSize:'14px', fontWeight:700, color:'#ff6600' }}>{goalPred.predicted}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{goalPred.best}–{goalPred.worst}</div>
                </div>
              )}
              {daysToRace && (
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>DAYS OUT</div>
                  <div style={{ ...S.mono, fontSize:'16px', fontWeight:700, color: daysToRace<=14?'#ff6600':'var(--text)' }}>{daysToRace}</div>
                </div>
              )}
            </div>
            {weakFactors.length > 0 && (
              <div style={{ marginTop:'8px', ...S.mono, fontSize:'10px', color:'#f5c542', lineHeight:1.6 }}>
                ⚠ {weakFactors.map(f=>`${f.name}: ${f.en}`).join(' | ')}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
