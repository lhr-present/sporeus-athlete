import { useRef, useState, useEffect, useCallback, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { generateCoachId, generateUnlockCode, verifyUnlockCode, FREE_ATHLETE_LIMIT } from '../lib/formulas.js'
import { analyzeLoadTrend, analyzeZoneBalance, predictInjuryRisk, predictFitness, analyzeRecoveryCorrelation, computeRaceReadiness, predictRacePerformance } from '../lib/intelligence.js'
import { correlateTrainingToResults, findRecoveryPatterns, mineInjuryPatterns, findOptimalWeekStructure } from '../lib/patterns.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)
// Coach ID is now generated dynamically per-coach via registration

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function daysBefore(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function daysAgo(dateStr) {
  if (!dateStr || dateStr === '—') return null
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return '1d ago'
  return `${diff}d ago`
}

function computeLoad(log) {
  if (!log || !log.length) return { ctl: 0, atl: 0, tsb: 0 }
  const sorted = [...log].sort((a, b) => (a.date > b.date ? 1 : -1))
  let ctl = 0, atl = 0
  for (const s of sorted) {
    const tss = s.tss || 0
    ctl = ctl + (tss - ctl) / 42
    atl = atl + (tss - atl) / 7
  }
  return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(ctl - atl) }
}

function computeAthleteMetrics(athlete) {
  const log = athlete.log || []
  const recovery = athlete.recovery || []
  const d7 = daysBefore(7), d28 = daysBefore(28), d14 = daysBefore(14)
  const sorted = [...log].sort((a, b) => (a.date > b.date ? -1 : 1))
  const lastSession = sorted[0]?.date || '—'
  const log7 = log.filter(e => e.date >= d7)
  const tss7 = log7.reduce((s, e) => s + (e.tss || 0), 0)
  const log28 = log.filter(e => e.date >= d28)
  const chronic28 = log28.reduce((s, e) => s + (e.tss || 0), 0) / 4
  let acwr = null, acwrColor = '#888'
  if (chronic28 > 0) {
    acwr = Math.round(tss7 / chronic28 * 100) / 100
    if (acwr < 0.8) acwrColor = '#0064ff'
    else if (acwr <= 1.3) acwrColor = '#5bc25b'
    else if (acwr <= 1.5) acwrColor = '#f5c542'
    else acwrColor = '#e03030'
  }
  const lastRec = [...recovery].sort((a, b) => (a.date > b.date ? -1 : 1))[0]
  const readiness = lastRec?.score || null
  const hasRecentInjury = (athlete.injuryLog || []).some(e => e.date >= d14)
  const needsAttention = (readiness !== null && readiness < 50) || (acwr !== null && acwr > 1.5) || hasRecentInjury
  const statusColor = needsAttention ? '#e03030'
    : ((acwr !== null && acwr > 1.3) || (readiness !== null && readiness < 60)) ? '#f5c542'
    : '#5bc25b'
  return { lastSession, tss7, acwr, acwrColor, readiness, hasRecentInjury, needsAttention, statusColor }
}

function getReadinessColor(score) {
  if (score === null || score === undefined) return '#888'
  return score >= 75 ? '#5bc25b' : score >= 50 ? '#f5c542' : '#e03030'
}

// ─── Sport-aware plan generator ───────────────────────────────────────────────

const SPORT_SESSION_TEMPLATES = {
  running:   [['Monday','Easy Run',0.20,4],['Wednesday','Threshold Run',0.20,7],['Friday','Easy Run',0.15,4],['Saturday','Long Run',0.35,6],['Sunday','Rest',0,1]],
  cycling:   [['Monday','Easy Ride',0.20,4],['Wednesday','Sweet Spot',0.20,7],['Friday','Recovery Ride',0.15,3],['Saturday','Long Ride',0.35,6],['Sunday','Rest',0,1]],
  swimming:  [['Monday','Easy Swim',0.20,4],['Wednesday','CSS Intervals',0.20,7],['Friday','Drills',0.15,4],['Saturday','Long Swim',0.35,6],['Sunday','Rest',0,1]],
  triathlon: [['Monday','Easy Swim',0.15,4],['Tuesday','Easy Run',0.12,4],['Wednesday','Threshold Ride',0.18,7],['Friday','Brick (Bike+Run)',0.20,7],['Saturday','Long Ride',0.22,6],['Sunday','Long Run',0.13,6]],
  rowing:    [['Monday','Easy Erg',0.20,4],['Wednesday','Intervals',0.20,7],['Friday','Technique Erg',0.15,4],['Saturday','Long Piece',0.35,6],['Sunday','Rest',0,1]],
}
const SPORT_GOALS = {
  running:   ['5K','10K','Half Marathon','Full Marathon','General Fitness'],
  cycling:   ['Gran Fondo','Stage Race','Criterium','Time Trial','General Fitness'],
  swimming:  ['Open Water','1500m','5K Open','Triathlon Swim','General Fitness'],
  triathlon: ['Sprint','Olympic','70.3','Full Ironman','General Fitness'],
  rowing:    ['2K Erg','6K Erg','Head Race','General Fitness'],
}

function generateCoachPlan({ goal, weeks, hoursPerWeek, level, athleteName, sport }) {
  const w = parseInt(weeks) || 8
  const h = parseInt(hoursPerWeek) || 8
  const sp = (sport || 'running').toLowerCase()
  const sessions = SPORT_SESSION_TEMPLATES[sp] || SPORT_SESSION_TEMPLATES.running
  return {
    generated: TODAY, goal, sport: sp, weeks: w, hoursPerWeek: h, level, athleteName,
    weekPlan: Array(w).fill(null).map((_, wi) => ({
      week: wi + 1,
      phase: wi < w * 0.3 ? 'Base' : wi < w * 0.6 ? 'Build' : wi < w * 0.85 ? 'Peak' : 'Taper',
      sessions: sessions.map(([day, type, frac, rpe]) => ({
        day, type, duration: Math.round(h * 60 * frac), rpe,
      })),
    })),
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ReadinessBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>—</span>
  return <span style={S.tag(getReadinessColor(score))}>{score}</span>
}

function AcwrBadge({ acwr, acwrColor }) {
  if (acwr === null) return <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>—</span>
  return <span style={S.tag(acwrColor)}>{acwr.toFixed(2)}{acwr > 1.5 ? ' ⚠' : ''}</span>
}

function ComplianceBar({ pct }) {
  const color = pct >= 75 ? '#5bc25b' : pct >= 50 ? '#f5c542' : '#e03030'
  const filled = Math.round(pct / 5)
  return <span style={{ ...S.mono, fontSize:'11px', color, letterSpacing:'1px' }}>{'█'.repeat(filled)}{'░'.repeat(20-filled)} {pct}%</span>
}

// ─── Coach Onboarding ─────────────────────────────────────────────────────────

function CoachOnboarding({ onDone, inviteUrl, fileRef }) {
  const [step, setStep] = useState(0)
  const steps = [
    {
      title: 'Welcome to Coach Mode',
      body: (
        <div>
          <p style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'12px' }}>
            Manage athletes, create plans, track compliance — all from one screen.
          </p>
          <p style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8 }}>
            Data stays local. Athletes share JSON files with you. Zero server, zero fees.
          </p>
        </div>
      ),
    },
    {
      title: 'How it works',
      body: (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0', marginBottom:'20px', flexWrap:'wrap', justifyContent:'center' }}>
            {[
              { icon:'◈', lbl:'Athlete exports\nJSON from app' },
              { icon:'→', lbl:null },
              { icon:'⊞', lbl:'You import file\nin Coach Mode' },
              { icon:'→', lbl:null },
              { icon:'⚡', lbl:'Create plan,\nexport back' },
            ].map((s, i) => s.lbl ? (
              <div key={i} style={{ textAlign:'center', padding:'12px' }}>
                <div style={{ ...S.mono, fontSize:'24px', color:'#0064ff', marginBottom:'6px' }}>{s.icon}</div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888', whiteSpace:'pre-line', lineHeight:1.6 }}>{s.lbl}</div>
              </div>
            ) : (
              <div key={i} style={{ ...S.mono, fontSize:'20px', color:'#333', padding:'0 4px' }}>{s.icon}</div>
            ))}
          </div>
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', textAlign:'center', marginTop:'8px' }}>
            Share your invite link → athletes auto-connect when they open it
          </div>
        </div>
      ),
    },
    {
      title: 'Get started',
      body: (
        <div>
          <p style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'16px' }}>
            Import your first athlete or share your invite link below.
          </p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            <button style={S.btn} onClick={() => { fileRef.current?.click(); onDone() }}>
              Import Athlete JSON
            </button>
            <button style={S.btnSec} onClick={() => {
              navigator.clipboard.writeText(inviteUrl).catch(() => {})
              onDone()
            }}>
              Copy Invite Link
            </button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:10200 }} onClick={onDone}/>
      <div style={{ position:'fixed', top:'15vh', left:'50%', transform:'translateX(-50%)', width:'min(480px,92vw)', background:'var(--card-bg)', border:'1px solid #0064ff44', borderRadius:'8px', zIndex:10201, padding:'28px', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#0064ff', letterSpacing:'0.1em' }}>◈ COACH MODE — STEP {step+1}/3</div>
          <button onClick={onDone} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'18px' }}>×</button>
        </div>
        <div style={{ ...S.mono, fontSize:'16px', fontWeight:700, color:'var(--text)', marginBottom:'16px' }}>
          {steps[step].title}
        </div>
        {steps[step].body}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'24px' }}>
          <div style={{ display:'flex', gap:'6px' }}>
            {steps.map((_, i) => (
              <div key={i} style={{ width:i===step?'20px':'8px', height:'8px', borderRadius:'4px', background: i===step?'#0064ff':i<step?'#0064ff88':'#333', transition:'all 0.3s' }}/>
            ))}
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {step > 0 && <button style={S.btnSec} onClick={() => setStep(s => s - 1)}>← Back</button>}
            {step < steps.length - 1
              ? <button style={S.btn} onClick={() => setStep(s => s + 1)}>Next →</button>
              : <button style={S.btn} onClick={onDone}>Done ✓</button>
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Weekly Team Summary ──────────────────────────────────────────────────────

function WeeklySummary({ roster }) {
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

// ─── Plan Templates ───────────────────────────────────────────────────────────

function PlanTemplates({ templates, setTemplates, onApply }) {
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

// ─── Athlete Detail ───────────────────────────────────────────────────────────

function AthleteDetail({ athlete, onUpdate, onClose, templates, setTemplates }) {
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

// ─── Athlete Status Card ──────────────────────────────────────────────────────

function AthleteCard({ athlete, isOpen, onToggle, onRemove, onUpdate, templates, setTemplates, onQuickNote, myCoachId }) {
  const metrics = computeAthleteMetrics(athlete)
  const load = computeLoad(athlete.log || [])
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
            <button onClick={onRemove} style={{ ...S.btnSec, fontSize:'11px', padding:'5px 8px', color:'#e03030', borderColor:'#e03030' }}>✕</button>
          </div>
        </div>

        {/* 4 mini stats */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {[
            { lbl:'CTL', val: load.ctl, color:'#0064ff' },
            { lbl:'TSB', val: (load.tsb>=0?'+':'')+load.tsb, color: load.tsb>5?'#5bc25b':load.tsb<-10?'#e03030':'#f5c542' },
            { lbl:'ACWR', val: metrics.acwr !== null ? metrics.acwr.toFixed(2) : '—', color: metrics.acwrColor },
            { lbl:'READY', val: metrics.readiness !== null ? metrics.readiness : '—', color: getReadinessColor(metrics.readiness) },
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
          <AthleteDetail
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

// ─── Multi-Athlete Comparison ─────────────────────────────────────────────────

function AthleteComparison({ roster }) {
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

// ─── Coach Registration ────────────────────────────────────────────────────────

function CoachRegistration({ onDone }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [generatedId, setGeneratedId] = useState(null)
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    if (!name.trim()) return
    setGenerating(true)
    const id = await generateCoachId(name, email)
    setGeneratedId(id)
    setGenerating(false)
  }

  function handleConfirm() {
    if (!generatedId) return
    onDone({ name: name.trim(), email: email.trim(), coachId: generatedId, createdAt: new Date().toISOString(), unlockCode: null, athleteLimit: FREE_ATHLETE_LIMIT })
  }

  return (
    <div className="sp-fade">
      <div style={{ ...S.card, borderLeft:'3px solid #0064ff' }}>
        <div style={{ ...S.cardTitle, color:'#0064ff', borderColor:'#0064ff44' }}>◈ SET UP YOUR COACH PROFILE</div>
        <div style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'20px' }}>
          Each coach gets a unique invite code. Athletes connect by opening your link.
          <br/><span style={{ color:'var(--muted)', fontSize:'11px' }}>Your email stays local — used only to generate your unique code.</span>
        </div>
        <div style={S.row}>
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>YOUR NAME *</label>
            <input style={S.input} placeholder="Hüseyin Akbulut" value={name} onChange={e => setName(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>EMAIL (optional, makes code unique)</label>
            <input style={S.input} type="email" placeholder="coach@sporeus.com" value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
        </div>
        <button style={{ ...S.btn, marginTop:'16px' }} onClick={handleGenerate} disabled={!name.trim() || generating}>
          {generating ? 'Generating...' : '◈ Generate My Invite Code'}
        </button>
        {generatedId && (
          <div style={{ marginTop:'20px', padding:'14px 16px', background:'#0064ff11', border:'1px solid #0064ff44', borderRadius:'6px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'6px', letterSpacing:'0.1em' }}>YOUR COACH ID</div>
            <div style={{ ...S.mono, fontSize:'22px', fontWeight:700, color:'#0064ff', letterSpacing:'0.1em', marginBottom:'8px' }}>{generatedId}</div>
            <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.7, marginBottom:'16px' }}>
              This is your unique invite code. Share the link — athletes auto-connect.<br/>
              <span style={{ color:'var(--muted)', fontSize:'10px' }}>Free tier: {FREE_ATHLETE_LIMIT} connected athletes. Contact sporeus.com to unlock more.</span>
            </div>
            <button style={{ ...S.btn, background:'#0064ff', borderColor:'#0064ff' }} onClick={handleConfirm}>
              ✓ Save &amp; Open Coach Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Gating Overlay ────────────────────────────────────────────────────────────

function GatingOverlay({ coachProfile, onUnlock, onCancel }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const limit = coachProfile.athleteLimit || FREE_ATHLETE_LIMIT

  async function handleVerify() {
    if (!code.trim()) return
    setVerifying(true); setError('')
    const result = await verifyUnlockCode(code.trim().toUpperCase(), coachProfile.coachId)
    setVerifying(false)
    if (!result) { setError('Invalid code. Contact sporeus.com/huseyin-akbulut/ to get your unlock code.'); return }
    onUnlock(result.limit)
  }

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:10200 }} onClick={onCancel}/>
      <div style={{ position:'fixed', top:'15vh', left:'50%', transform:'translateX(-50%)', width:'min(480px,92vw)', background:'var(--card-bg)', border:'1px solid #f5c54244', borderRadius:'8px', zIndex:10201, padding:'28px', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', letterSpacing:'0.1em' }}>◈ FREE LIMIT REACHED</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'18px' }} aria-label="Close">×</button>
        </div>
        <div style={{ ...S.mono, fontSize:'15px', fontWeight:700, color:'var(--text)', marginBottom:'8px' }}>
          {limit}/{limit} Athlete Slots Used
        </div>
        <div style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'20px' }}>
          You've reached the free limit ({limit} connected athletes). To add more, contact Hüseyin for an unlock code.
        </div>
        <label style={S.label}>UNLOCK CODE</label>
        <input
          style={{ ...S.input, marginBottom:'8px', letterSpacing:'0.06em' }}
          placeholder="SPUNLOCK-a3f7b2e1-10-c4d8f2"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
        />
        {error && <div style={{ ...S.mono, fontSize:'11px', color:'#e03030', marginBottom:'10px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button style={{ ...S.btn, background:'#0064ff', borderColor:'#0064ff' }} onClick={handleVerify} disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify Code'}
          </button>
          <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer" style={{ ...S.btnSec, textDecoration:'none', color:'#ff6600', borderColor:'#ff6600', display:'inline-flex', alignItems:'center' }}>
            Contact Hüseyin →
          </a>
          <button style={{ ...S.btnSec, color:'var(--muted)', borderColor:'var(--border)' }} onClick={onCancel}>Later</button>
        </div>
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachDashboard({ authUser }) {
  const [roster, setRoster] = useLocalStorage('sporeus-coach-athletes', [])
  const [coachOnboarded, setCoachOnboarded] = useLocalStorage('sporeus-coach-onboarded', false)
  const [coachProfile, setCoachProfile] = useLocalStorage('sporeus-coach-profile', null)
  const [templates, setTemplates] = useLocalStorage('sporeus-coach-templates', [])
  const [expanded, setExpanded] = useLocalStorage('sporeus-coach-last-athlete', null)
  const [showMyAthletes, setShowMyAthletes] = useState(false)
  const [sortBy, setSortBy] = useState('attention')
  const [sortDir, setSortDir] = useState('desc')
  const [copyToast, setCopyToast] = useState(false)
  const [quickNoteId, setQuickNoteId] = useState(null)
  const [quickNoteText, setQuickNoteText] = useState('')
  const [pendingAthlete, setPendingAthlete] = useState(null)
  const [showGating, setShowGating] = useState(false)
  const fileRef = useRef(null)

  // ── Supabase live-athlete state (only when Supabase is configured) ──────────
  const [sbAthletes, setSbAthletes]     = useState([])   // [{profile, status, athlete_id}]
  const [sbInviteCode, setSbInviteCode] = useState(null) // generated code
  const [sbInviteBusy, setSbInviteBusy] = useState(false)
  const [sbInviteCopied, setSbInviteCopied] = useState(false)
  const [sbSelectedId, setSbSelectedId] = useState(null) // selected athlete id
  const [sbAthleteData, setSbAthleteData] = useState({}) // {[id]: {log, recovery}}
  const [sbLoadingData, setSbLoadingData] = useState(false)

  const sbCoachId = authUser?.id ?? null

  const loadSbAthletes = useCallback(async () => {
    if (!isSupabaseReady() || !sbCoachId) return
    const { data } = await supabase
      .from('coach_athletes')
      .select('athlete_id, status, profiles!coach_athletes_athlete_id_fkey(id, display_name, email)')
      .eq('coach_id', sbCoachId)
      .in('status', ['active', 'pending'])
      .order('status')
    if (data) setSbAthletes(data)
  }, [sbCoachId])

  useEffect(() => { loadSbAthletes() }, [loadSbAthletes])

  const generateSbInvite = useCallback(async () => {
    if (!isSupabaseReady() || !sbCoachId || sbInviteBusy) return
    setSbInviteBusy(true)
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
    const { error } = await supabase.from('coach_invites').insert({ coach_id: sbCoachId, code })
    if (!error) setSbInviteCode(code)
    setSbInviteBusy(false)
  }, [sbCoachId, sbInviteBusy])

  const copySbInvite = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?invite=${sbInviteCode}`
    navigator.clipboard.writeText(url).catch(() => {})
    setSbInviteCopied(true)
    setTimeout(() => setSbInviteCopied(false), 2000)
  }, [sbInviteCode])

  const selectSbAthlete = useCallback(async (athleteId) => {
    setSbSelectedId(prev => prev === athleteId ? null : athleteId)
    if (sbAthleteData[athleteId] || !isSupabaseReady()) return
    setSbLoadingData(true)
    const [{ data: log }, { data: recovery }] = await Promise.all([
      supabase.from('training_log').select('*').eq('user_id', athleteId).order('date', { ascending: false }).limit(365),
      supabase.from('recovery').select('*').eq('user_id', athleteId).order('date', { ascending: false }).limit(90),
    ])
    setSbAthleteData(prev => ({ ...prev, [athleteId]: { log: log || [], recovery: recovery || [] } }))
    setSbLoadingData(false)
  }, [sbAthleteData])

  // Derived — all hooks above, safe to conditional-return now
  const myCoachId    = coachProfile?.coachId || ''
  const athleteLimit = coachProfile?.athleteLimit ?? FREE_ATHLETE_LIMIT

  if (!coachProfile) {
    return <CoachRegistration onDone={profile => setCoachProfile(profile)}/>
  }

  const inviteUrl = `${window.location.origin}${window.location.pathname}?coach=${myCoachId}`

  function handleCopyInvite() {
    navigator.clipboard.writeText(inviteUrl).catch(() => {})
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 2000)
  }

  // Summary stats
  const d14 = daysBefore(14)
  const connected   = roster.filter(a => a.coachId === myCoachId).length
  const needsAttn   = roster.filter(a => computeAthleteMetrics(a).needsAttention).length
  const injuredCnt  = roster.filter(a => (a.injuryLog || []).some(e => e.date >= d14)).length

  // Filtering
  const filteredRoster = showMyAthletes ? roster.filter(a => a.coachId === MY_COACH_ID) : roster

  // Sorting
  const sortedRoster = [...filteredRoster].sort((a, b) => {
    const ma = computeAthleteMetrics(a), mb = computeAthleteMetrics(b)
    const dir = sortDir === 'desc' ? -1 : 1
    if (sortBy === 'attention') {
      if (ma.needsAttention !== mb.needsAttention) return ma.needsAttention ? -1 : 1
      return (ma.lastSession > mb.lastSession ? -1 : 1) * dir
    }
    if (sortBy === 'acwr') return ((ma.acwr || 0) - (mb.acwr || 0)) * dir
    if (sortBy === 'readiness') return ((ma.readiness || 0) - (mb.readiness || 0)) * dir
    if (sortBy === 'lastActive') return (ma.lastSession > mb.lastSession ? 1 : -1) * dir
    if (sortBy === 'name') return a.name.localeCompare(b.name) * dir
    return 0
  })

  function toggleSort(field) {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(field); setSortDir('desc') }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('File too large (max 10MB).'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target.result
        if (text.length > 10e6) throw new Error('oversized')
        const raw = JSON.parse(text)
        if (typeof raw !== 'object' || Array.isArray(raw) || raw === null) throw new Error('invalid')
        const data = raw._export ? (raw.data || {}) : raw
        const sanitizeStr = v => typeof v === 'string' ? v.slice(0, 200) : ''
        const sanitizeNum = v => typeof v === 'number' && isFinite(v) ? v : 0
        const rawProfile = data['sporeus-profile']?.data || data.profile || {}
        const profile = {
          name: sanitizeStr(rawProfile.name), sport: sanitizeStr(rawProfile.sport || rawProfile.primarySport),
          age: sanitizeStr(rawProfile.age), weight: sanitizeStr(rawProfile.weight),
          ftp: sanitizeStr(rawProfile.ftp), vo2max: sanitizeStr(rawProfile.vo2max),
          threshold: sanitizeStr(rawProfile.threshold), goal: sanitizeStr(rawProfile.goal),
        }
        const coachId = sanitizeStr(raw.coachId || data.coachId || '')
        const toLog = v => Array.isArray(v) ? v.slice(0, 5000).map(e => ({ id:sanitizeNum(e.id), date:sanitizeStr(e.date), type:sanitizeStr(e.type), duration:sanitizeNum(e.duration), rpe:sanitizeNum(e.rpe), tss:sanitizeNum(e.tss), notes:sanitizeStr(e.notes) })) : []
        const toRec = v => Array.isArray(v) ? v.slice(0, 2000).map(e => ({ date:sanitizeStr(e.date), score:sanitizeNum(e.score), sleep:sanitizeNum(e.sleep), sleepHrs:sanitizeStr(e.sleepHrs) })) : []
        const entry = {
          id: Date.now(), name: profile.name || 'Athlete', sport: profile.sport || '—',
          coachId, importedAt: TODAY, profile,
          log:       toLog(data['sporeus_log']?.data || data.log || data.trainingLog),
          recovery:  toRec(data['sporeus-recovery']?.data || data.recovery || data.recoveryLog),
          testLog:   Array.isArray(data['sporeus-test-results']?.data || data.testLog) ? (data['sporeus-test-results']?.data || data.testLog || []).slice(0, 500) : [],
          injuryLog: Array.isArray(data['sporeus-injuries']?.data || data.injuryLog) ? (data['sporeus-injuries']?.data || data.injuryLog || []).slice(0, 1000) : [],
          notes: [],
        }
        const wouldConnect = myCoachId && entry.coachId === myCoachId
        if (wouldConnect && connected >= athleteLimit) {
          setPendingAthlete(entry)
          setShowGating(true)
        } else {
          setRoster(prev => [...prev, entry])
          setExpanded(entry.id)
        }
      } catch { alert('Could not parse JSON. Make sure it is a valid Sporeus export.') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  function handleRemove(id) {
    if (!window.confirm('Remove this athlete?')) return
    setRoster(prev => prev.filter(a => a.id !== id))
    if (expanded === id) setExpanded(null)
  }

  function handleUpdateAthlete(updated) {
    setRoster(prev => prev.map(a => a.id === updated.id ? updated : a))
  }

  function toggleExpand(id) {
    const next = expanded === id ? null : id
    setExpanded(next)
  }

  function handleQuickNoteSubmit(athleteId) {
    if (!quickNoteText.trim()) { setQuickNoteId(null); return }
    const athlete = roster.find(a => a.id === athleteId)
    if (!athlete) return
    handleUpdateAthlete({ ...athlete, notes: [{ date: TODAY, text: quickNoteText.trim() }, ...(athlete.notes || [])] })
    setQuickNoteId(null); setQuickNoteText('')
  }

  function handleUnlock(newLimit) {
    setCoachProfile(prev => ({ ...prev, athleteLimit: newLimit }))
    if (pendingAthlete) {
      setRoster(prev => [...prev, pendingAthlete])
      setExpanded(pendingAthlete.id)
    }
    setShowGating(false)
    setPendingAthlete(null)
  }

  function applyTemplate(tmpl) {
    // Templates just auto-expand the appropriate athlete and populate plan fields
    // We store it in session state for AthleteDetail — for now just a future hook
  }

  const SORT_CHIPS = [
    { id:'attention', label:'Attention' },
    { id:'acwr',      label:'ACWR' },
    { id:'readiness', label:'Readiness' },
    { id:'lastActive',label:'Last Active' },
    { id:'name',      label:'Name' },
  ]

  return (
    <div className="sp-fade">
      {/* Coach Onboarding */}
      {!coachOnboarded && (
        <CoachOnboarding
          onDone={() => setCoachOnboarded(true)}
          inviteUrl={inviteUrl}
          fileRef={fileRef}
        />
      )}

      {/* Coach Mode Banner */}
      <div style={{ background:'#0064ff11', border:'1px solid #0064ff44', borderRadius:'6px', padding:'10px 16px', marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'6px' }}>
        <div style={{ ...S.mono, fontSize:'14px', fontWeight:700, color:'#0064ff', letterSpacing:'0.1em' }}>
          ◈ COACH MODE · {(coachProfile.name || 'COACH').toUpperCase()}
        </div>
        <div style={{ ...S.mono, fontSize:'9px', color:'#0064ff88', letterSpacing:'0.08em' }}>
          ID: {myCoachId}
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'var(--muted)' }}>File-based | Zero server</div>
          <button style={{ ...S.mono, fontSize:'9px', color:'#0064ff', background:'transparent', border:'1px solid #0064ff44', borderRadius:'3px', padding:'2px 8px', cursor:'pointer' }} onClick={() => setCoachOnboarded(false)}>
            ? How it works
          </button>
        </div>
      </div>

      {/* ── Supabase Live Athletes ──────────────────────────────────────────── */}
      {isSupabaseReady() && sbCoachId && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ ...S.mono, fontSize:'11px', fontWeight:700, color:'#0064ff', letterSpacing:'0.1em', marginBottom:'12px' }}>
            MY ATHLETES (LIVE) · {sbAthletes.filter(a => a.status==='active').length} CONNECTED
          </div>

          {/* Invite generator */}
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', marginBottom:'12px' }}>
            {!sbInviteCode ? (
              <button
                onClick={generateSbInvite}
                disabled={sbInviteBusy}
                style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'7px 14px', background:'#0064ff', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', opacity: sbInviteBusy ? 0.5 : 1 }}
              >
                {sbInviteBusy ? '…' : '+ GENERATE INVITE LINK'}
              </button>
            ) : (
              <>
                <input
                  readOnly
                  value={`${window.location.origin}${window.location.pathname}?invite=${sbInviteCode}`}
                  onFocus={e => e.target.select()}
                  style={{ ...S.mono, fontSize:'10px', color:'#0064ff', background:'#0064ff11', border:'1px solid #0064ff33', borderRadius:'4px', padding:'6px 10px', flex:'1 1 260px', outline:'none' }}
                />
                <button onClick={copySbInvite} style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'7px 14px', background: sbInviteCopied ? '#5bc25b' : '#1a1a1a', color: sbInviteCopied ? '#fff' : '#ccc', border:'1px solid #333', borderRadius:'4px', cursor:'pointer', minWidth:'70px' }}>
                  {sbInviteCopied ? '✓ COPIED' : 'COPY'}
                </button>
                <button onClick={generateSbInvite} disabled={sbInviteBusy} style={{ ...S.mono, fontSize:'9px', padding:'7px 10px', background:'transparent', color:'#555', border:'1px solid #333', borderRadius:'4px', cursor:'pointer' }}>
                  NEW
                </button>
              </>
            )}
          </div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#444', marginBottom:sbAthletes.length ? '12px' : 0 }}>
            Invite expires in 7 days · athlete opens link and accepts
          </div>

          {/* Athlete list */}
          {sbAthletes.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {sbAthletes.map(row => {
                const profile = row.profiles
                const isActive = row.status === 'active'
                const isSelected = sbSelectedId === row.athlete_id
                const data = sbAthleteData[row.athlete_id]
                const metrics = data ? computeLoad(data.log) : null
                const injRisk = data ? predictInjuryRisk(data.log, data.recovery, {}) : null
                return (
                  <div key={row.athlete_id}>
                    <button
                      onClick={() => isActive && selectSbAthlete(row.athlete_id)}
                      style={{
                        width:'100%', textAlign:'left', background: isSelected ? '#0064ff18' : '#0a0a0a',
                        border:`1px solid ${isSelected ? '#0064ff' : '#222'}`, borderRadius:'5px',
                        padding:'10px 14px', cursor: isActive ? 'pointer' : 'default',
                        display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
                      }}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:0 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background: isActive ? '#5bc25b' : '#555', flexShrink:0 }}/>
                        <div style={{ ...S.mono, fontSize:'12px', color:'#e0e0e0', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {profile?.display_name || 'Athlete'}
                        </div>
                        <div style={{ ...S.mono, fontSize:'9px', color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {profile?.email || ''}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'12px', alignItems:'center', flexShrink:0 }}>
                        {metrics && <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600' }}>CTL {metrics.ctl}</div>}
                        {injRisk && <div style={{ ...S.mono, fontSize:'10px', color: injRisk.level === 'HIGH' ? '#e03030' : injRisk.level === 'MODERATE' ? '#f5c542' : '#5bc25b' }}>{injRisk.level}</div>}
                        <div style={{ ...S.mono, fontSize:'9px', color: isActive ? '#5bc25b' : '#555', letterSpacing:'0.08em' }}>
                          {isActive ? 'ACTIVE' : 'PENDING'}
                        </div>
                        {isActive && <div style={{ ...S.mono, fontSize:'10px', color:'#444' }}>{isSelected ? '▲' : '▼'}</div>}
                      </div>
                    </button>

                    {/* Expanded athlete detail */}
                    {isSelected && data && (
                      <div style={{ background:'#0a0a0a', border:'1px solid #0064ff33', borderTop:'none', borderRadius:'0 0 5px 5px', padding:'12px 14px' }}>
                        {sbLoadingData ? (
                          <div style={{ ...S.mono, fontSize:'10px', color:'#555' }}>Loading…</div>
                        ) : (
                          <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
                            {[
                              { lbl:'SESSIONS', val: data.log.length },
                              { lbl:'CTL', val: metrics?.ctl ?? '—', color:'#ff6600' },
                              { lbl:'ATL', val: metrics?.atl ?? '—', color:'#0064ff' },
                              { lbl:'TSB', val: metrics?.tsb ?? '—', color: (metrics?.tsb ?? 0) >= 0 ? '#5bc25b' : '#f5c542' },
                              { lbl:'INJURY RISK', val: injRisk?.level ?? '—', color: injRisk?.level === 'HIGH' ? '#e03030' : injRisk?.level === 'MODERATE' ? '#f5c542' : '#5bc25b' },
                            ].map(({ lbl, val, color }) => (
                              <div key={lbl} style={{ textAlign:'center' }}>
                                <div style={{ ...S.mono, fontSize:'16px', fontWeight:700, color: color || '#e0e0e0' }}>{val}</div>
                                <div style={{ ...S.mono, fontSize:'8px', color:'#555', letterSpacing:'0.08em', marginTop:'2px' }}>{lbl}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {sbAthletes.length === 0 && (
            <div style={{ ...S.mono, fontSize:'10px', color:'#444', fontStyle:'italic' }}>
              No connected athletes yet — generate an invite link above.
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ ...S.row, marginBottom:'16px' }}>
        {[
          { lbl:'TOTAL ATHLETES', val: roster.length, color:'#e0e0e0' },
          { lbl:'CONNECTED', val: `${connected}/${athleteLimit}`, color: connected >= athleteLimit ? '#f5c542' : '#0064ff' },
          { lbl:'NEEDS ATTENTION', val: needsAttn, color: needsAttn > 0 ? '#f5c542' : '#5bc25b' },
          { lbl:'INJURY FLAGS', val: injuredCnt, color: injuredCnt > 0 ? '#e03030' : '#5bc25b' },
        ].map(({ lbl, val, color }) => (
          <div key={lbl} style={{ flex:'1 1 90px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'10px', textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'22px', fontWeight:700, color }}>{val}</div>
            <div style={{ ...S.mono, fontSize:'8px', color:'var(--muted)', letterSpacing:'0.08em', marginTop:'4px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Weekly Team Summary */}
      <WeeklySummary roster={roster}/>

      {/* Invite Link */}
      <div style={{ ...S.card, marginBottom:'16px' }}>
        <div style={S.cardTitle}>INVITE ATHLETES</div>
        <div style={{ ...S.mono, fontSize:'10px', color:'var(--muted)', marginBottom:'8px' }}>
          Athletes auto-connect when they open this link:
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <input style={{ ...S.input, flex:'1 1 200px', color:'#0064ff', fontSize:'11px' }} readOnly value={inviteUrl} onFocus={e => e.target.select()}/>
          <button style={{ ...S.btnSec, whiteSpace:'nowrap', borderColor:'#0064ff', color: copyToast ? '#5bc25b' : '#0064ff' }} onClick={handleCopyInvite}>
            {copyToast ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Plan Templates */}
      <PlanTemplates templates={templates} setTemplates={setTemplates} onApply={applyTemplate}/>

      {/* Athlete Roster */}
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
          <div style={S.cardTitle}>
            ROSTER ({sortedRoster.length}{showMyAthletes ? ' connected' : ` of ${roster.length}`})
          </div>
          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={() => setShowMyAthletes(false)} style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${!showMyAthletes?'#0064ff':'var(--border)'}`, background:!showMyAthletes?'#0064ff22':'transparent', color:!showMyAthletes?'#0064ff':'var(--muted)' }}>ALL</button>
            <button onClick={() => setShowMyAthletes(true)}  style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${showMyAthletes?'#0064ff':'var(--border)'}`, background:showMyAthletes?'#0064ff22':'transparent', color:showMyAthletes?'#0064ff':'var(--muted)' }}>◉ CONNECTED</button>
            <button style={S.btn} onClick={() => fileRef.current?.click()}>+ Import</button>
          </div>
        </div>

        {/* Sort chips */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
          <span style={{ ...S.mono, fontSize:'9px', color:'var(--muted)', alignSelf:'center' }}>SORT:</span>
          {SORT_CHIPS.map(chip => (
            <button key={chip.id} onClick={() => toggleSort(chip.id)} style={{ ...S.mono, fontSize:'9px', padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:`1px solid ${sortBy===chip.id?'#ff6600':'var(--border)'}`, background:sortBy===chip.id?'#ff660022':'transparent', color:sortBy===chip.id?'#ff6600':'var(--muted)' }}>
              {chip.label}{sortBy===chip.id ? (sortDir==='desc'?' ↓':' ↑') : ''}
            </button>
          ))}
        </div>

        <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleFileSelect}/>

        {sortedRoster.length === 0 && (
          <div style={{ ...S.mono, fontSize:'12px', color:'var(--muted)', textAlign:'center', padding:'24px 0' }}>
            {showMyAthletes ? 'No connected athletes yet. Share your invite link.' : 'No athletes imported. Export athlete data from the Sporeus app, then import here.'}
          </div>
        )}

        {sortedRoster.map(athlete => (
          <div key={athlete.id}>
            {/* Quick Note inline input */}
            {quickNoteId === athlete.id && (
              <div style={{ display:'flex', gap:'8px', marginBottom:'8px', padding:'8px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px' }}>
                <input
                  style={{ ...S.input, flex:1, fontSize:'12px' }}
                  placeholder={`Quick note for ${athlete.name}...`}
                  value={quickNoteText}
                  onChange={e => setQuickNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter') handleQuickNoteSubmit(athlete.id); if (e.key==='Escape') { setQuickNoteId(null); setQuickNoteText('') } }}
                  autoFocus
                />
                <button style={{ ...S.btn, padding:'6px 12px', fontSize:'11px' }} onClick={() => handleQuickNoteSubmit(athlete.id)}>Save</button>
                <button style={{ ...S.btnSec, padding:'6px 10px', fontSize:'11px' }} onClick={() => { setQuickNoteId(null); setQuickNoteText('') }}>✕</button>
              </div>
            )}
            <AthleteCard
              athlete={athlete}
              isOpen={expanded === athlete.id}
              onToggle={() => toggleExpand(athlete.id)}
              onRemove={() => handleRemove(athlete.id)}
              onUpdate={handleUpdateAthlete}
              templates={templates}
              setTemplates={setTemplates}
              onQuickNote={() => { setQuickNoteId(id => id === athlete.id ? null : athlete.id); setQuickNoteText('') }}
              myCoachId={myCoachId}
            />
          </div>
        ))}
      </div>

      {/* Multi-Athlete Comparison */}
      {roster.length >= 2 && <AthleteComparison roster={roster}/>}

      {/* Gating Overlay */}
      {showGating && (
        <GatingOverlay
          coachProfile={coachProfile}
          onUnlock={handleUnlock}
          onCancel={() => { setShowGating(false); setPendingAthlete(null) }}
        />
      )}
    </div>
  )
}
