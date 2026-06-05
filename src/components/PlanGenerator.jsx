import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { PLAN_GOALS, PLAN_LEVELS, ZONE_COLORS, ZONE_NAMES } from '../lib/constants.js'
import { adaptE13PlanToLegacy } from '../lib/plan/adapter.js'
import { generatePlan, calcLoad, validatePlanRamp } from '../lib/formulas.js'
import { computeCTL } from '../lib/nextAction.js'
import { BLOCK_PHASES, generateBlockPlan } from '../lib/sport/blockPeriodization.js'
import { MiniDonut } from './ui.jsx'
import { findOptimalWeekStructure } from '../lib/patterns.js'
import { generatePlan as generateAdaptivePlan } from '../lib/plan/generatePlan.js'
import { normalizeTrainingDow, defaultDowForCount } from '../lib/plan/trainingDays.js'
import { applyTaper, suggestTaper } from '../lib/plan/taperEngine.js'
import { validatePlan } from '../lib/plan/planValidators.js'
import { explainPlannedWeek } from '../lib/athlete/weekRationale.js'
import { readPlanHistory } from '../lib/plan/versionTracking.js'
import { announce } from '../lib/a11y/announcer.js'
import { buildZwoWorkout, sessionToZwoWorkout, downloadZwoFile } from '../lib/integrations/zwoExport.js'
import { strengthProgramForPlan } from '../lib/athlete/eliteProgramStrength.js'
import { StrengthSection } from './dashboard/BroaderPlanSections.jsx'
import PlanTemplatePicker from './PlanTemplatePicker.jsx'

// ─── Map a legacy week-card session.type → zwoExport intent keyword ───────────
// PlanGenerator stores sessions as { type, duration, rpe, ... } where `type` is
// a free-form label. zwoExport.sessionToZwoWorkout() expects a normalized
// `intent` keyword. Keep mapping short and predictable.
function sessionTypeToZwoIntent(rawType) {
  const t = String(rawType || '').toLowerCase().trim()
  if (!t) return 'steady'
  if (t === 'recovery' || t.includes('easy')) return 'recovery'
  if (t === 'long')      return 'long'
  if (t === 'tempo')     return 'tempo'
  if (t === 'intervals' || t.includes('interval')) return 'intervals'
  return 'steady'
}

// Detect rest/off rows that should NOT show a Zwift export button.
function isRestSession(ses) {
  if (!ses) return true
  const t = String(ses.type || '').toLowerCase().trim()
  if (!t) return true
  if (t === 'rest' || t === 'off') return true
  if (!(Number(ses.duration) > 0)) return true
  return false
}

// ─── Pure: serialize a (legacy-shape) plan to a CSV string ────────────────────
// Columns: Week, Day, SessionIntent, TargetTSS, RPELow, RPEHigh, Zone, Description
// Always emits the header row. Escapes any field containing comma / quote / newline.
const CSV_HEADER = 'Week,Day,SessionIntent,TargetTSS,RPELow,RPEHigh,Zone,Description'
function csvEscape(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function planToCSV(plan) {
  if (!plan || !Array.isArray(plan.weeks)) return CSV_HEADER + '\n'
  const rows = [CSV_HEADER]
  for (const w of plan.weeks) {
    for (const s of (w.sessions || [])) {
      const rpe = s.rpe ?? ''
      rows.push([
        csvEscape(w.week),
        csvEscape(s.day),
        csvEscape(s.type ?? s.intent ?? ''),
        csvEscape(s.tss ?? s.targetTSS ?? ''),
        csvEscape(s.rpeLow ?? rpe),
        csvEscape(s.rpeHigh ?? rpe),
        csvEscape(s.zone ?? ''),
        csvEscape(s.description ?? ''),
      ].join(','))
    }
  }
  return rows.join('\n') + '\n'
}

function TaperCalculator() {
  const [peakTSS, setPeakTSS] = useState('500')
  const [peakVol, setPeakVol] = useState('10')
  const [taperWeeks, setTaperWeeks] = useState('2')
  const [model, setModel] = useState('exp')

  const PT = parseFloat(peakTSS)||500, PV = parseFloat(peakVol)||10, TW = parseInt(taperWeeks)||2

  const genTaper = () => {
    const weeks = []
    for (let i = 0; i <= TW; i++) {
      let volPct, tssPct
      if (model === 'exp') {
        const _ratio = i === TW ? 0.40 : 1 - (1 - 0.40) * (i / TW) * (2 - i / TW) * 0.5
        volPct = Math.round((i === 0 ? 1 : Math.pow(0.40, i / TW)) * 100)
        tssPct = Math.round((i === 0 ? 1 : Math.pow(0.40, i / TW)) * 100)
      } else {
        volPct = Math.round((1 - i / TW * 0.6) * 100)
        tssPct = Math.round((1 - i / TW * 0.6) * 100)
      }
      if (i === TW) { volPct = 40; tssPct = 40 }
      weeks.push({
        label: i === 0 ? 'PEAK' : i === TW ? 'RACE WK' : `TAPER ${i}`,
        vol: Math.round(PV * volPct / 100 * 10) / 10,
        tss: Math.round(PT * tssPct / 100),
        volPct, tssPct,
        isRace: i === TW,
      })
    }
    return weeks
  }

  const taperData = genTaper()
  const tips = [
    'Maintain intensity — only reduce volume',
    'Keep ≥1 quality session/week during taper',
    'Sleep 8–9h, prioritize nutrition carb-loading in final 3 days',
    '2-week taper: −40% week 1 → −60% race week',
    '3-week taper: −20% → −40% → −60%',
  ]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'250ms' }}>
      <div style={S.cardTitle}>TAPER CALCULATOR</div>
      <div style={S.row}>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>PEAK WEEKLY TSS: <strong>{peakTSS}</strong></label>
          <input type="range" min="200" max="1200" step="10" value={peakTSS} onChange={e=>setPeakTSS(e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>200</span><span>1200</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>PEAK VOLUME (h/wk): <strong>{peakVol}</strong></label>
          <input type="range" min="3" max="20" value={peakVol} onChange={e=>setPeakVol(e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>3h</span><span>20h</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>TAPER WEEKS: <strong>{taperWeeks}</strong></label>
          <input type="range" min="1" max="4" value={taperWeeks} onChange={e=>setTaperWeeks(e.target.value)} style={{ width:'100%', accentColor:'#4a90d9' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>1</span><span>4</span></div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'6px', margin:'10px 0' }}>
        {['exp','linear'].map(m=>(
          <button key={m} onClick={()=>setModel(m)} style={{ ...S.navBtn(model===m), borderRadius:'4px', fontSize:'10px', padding:'4px 10px' }}>
            {m==='exp'?'Exponential':'Linear'}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:'6px', flexWrap:'nowrap', overflowX:'auto', padding:'4px 0' }}>
        {taperData.map((w,i)=>(
          <div key={i} style={{ flex:'1 1 80px', minWidth:'75px', background: w.isRace?'#ff660022':'var(--card-bg)', border:`1px solid ${w.isRace?'#ff6600':'var(--border)'}`, borderTop:`3px solid ${w.isRace?'#ff6600':'#4a90d9'}`, borderRadius:'5px', padding:'8px 10px', textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'9px', fontWeight:600, color: w.isRace?'#ff6600':'#888', marginBottom:'4px' }}>{w.label}</div>
            <div style={{ ...S.mono, fontSize:'14px', fontWeight:600, color:'var(--text)' }}>{w.vol}h</div>
            <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600' }}>{w.tss} TSS</div>
            <div style={{ ...S.mono, fontSize:'9px', color:'var(--muted)', marginTop:'2px' }}>{w.volPct}%</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:'12px' }}>
        {tips.map((tip,i)=>(
          <div key={i} style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', padding:'2px 0', display:'flex', gap:'6px' }}>
            <span style={{ color:'#ff6600' }}>◈</span>{tip}
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'8px' }}>Mujika &amp; Padilla (2003) · Bosquet et al. (2007) meta-analysis</div>
    </div>
  )
}

export default function PlanGenerator({ onLogSession }) {
  const { t } = useContext(LangCtx)
  const { log, recovery, profile } = useData()
  const [goal,  setGoal]  = useState('Half Marathon')
  // v9.61.0 — When the athlete already supplied a race date during onboarding,
  // pre-fill the plan duration from that anchor so a full-year plan generates
  // with one click. Clamps to the slider range [4, 52].
  const [weeks, setWeeks] = useState(() => {
    const rd = profile?.raceDate || profile?.nextRaceDate
    if (rd) {
      const w = Math.round((new Date(rd).getTime() - Date.now()) / 604800000)
      if (Number.isFinite(w) && w >= 4 && w <= 52) return w
    }
    return 12
  })
  const [hours, setHours] = useState(8)
  const [level, setLevel] = useState('Intermediate')
  const [plan,  setPlan]  = useLocalStorage('sporeus-plan', null)
  const [planStatus, setPlanStatus] = useLocalStorage('sporeus-plan-status', {})
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [selWeek, setSelWeek] = useState(0)
  const [blockMode, setBlockMode] = useState(false)
  // ── E13 Advanced (adaptive) mode state ─────────────────────────────────────
  const [advancedMode, setAdvancedMode] = useState(false)
  const [advAvailableDays, setAdvAvailableDays] = useState(5)
  const [advModel, setAdvModel] = useState('traditional')
  const [advAutoTaper, setAdvAutoTaper] = useState(true)
  const [advRaceDate, setAdvRaceDate] = useState('')
  const [_planWarnings, setPlanWarnings] = useState([])
  // Full validator error objects (with code + bilingual message + weekNum) so the
  // sighted warnings panel can show details beyond the screen-reader announce().
  const [planValidationErrors, setPlanValidationErrors] = useState([])
  const [warningsExpanded, setWarningsExpanded] = useState(true)

  const toggleStatus = (wi, di, val) => {
    const key = `${wi}-${di}`
    setPlanStatus(prev => {
      const next = { ...prev }
      if (next[key] === val) delete next[key]
      else next[key] = val
      return next
    })
  }
  const weekCompliance = (wi) => {
    if (!plan) return null
    const sessions = plan.weeks[wi].sessions
    let total = 0, done = 0
    sessions.forEach((s, di) => {
      if (s.type !== 'Rest' && s.duration > 0) {
        total++
        const st = planStatus[`${wi}-${di}`]
        if (st === 'done' || st === 'modified') done++
      }
    })
    return total ? Math.round(done / total * 100) : null
  }
  const planCompliance = () => {
    if (!plan) return null
    let total = 0, done = 0
    plan.weeks.forEach((w, wi) => {
      w.sessions.forEach((s, di) => {
        if (s.type !== 'Rest' && s.duration > 0) {
          total++
          const st = planStatus[`${wi}-${di}`]
          if (st === 'done' || st === 'modified') done++
        }
      })
    })
    return total ? Math.round(done / total * 100) : null
  }

  const today = new Date().toISOString().slice(0,10)
  const thisWeekIdx = plan ? Math.min(
    Math.floor((new Date(today) - new Date(plan.generatedAt)) / (7*864e5)),
    plan.weeks.length - 1
  ) : 0

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('plan_goal')) setGoal(decodeURIComponent(p.get('plan_goal')))
    if (p.get('plan_weeks')) setWeeks(Math.min(52, Math.max(4, parseInt(p.get('plan_weeks'))||12)))
    if (p.get('plan_hours')) setHours(Math.min(15, Math.max(3, parseInt(p.get('plan_hours'))||8)))
    if (p.get('plan_level')) setLevel(decodeURIComponent(p.get('plan_level')))
  }, [])

  const [shareMsg, setShareMsg] = useState('')

  const sharePlan = () => {
    const base = window.location.origin + window.location.pathname
    const params = new URLSearchParams({
      plan_goal: goal,
      plan_weeks: weeks,
      plan_hours: hours,
      plan_level: level,
    })
    const url = `${base}?${params.toString()}#plan`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => { setShareMsg('Link copied!'); setTimeout(()=>setShareMsg(''),2500) })
    } else {
      setShareMsg(url)
    }
  }

  const generate = () => {
    if (advancedMode) {
      // ── E13 adaptive path ────────────────────────────────────────────────
      const goalKey = ({
        '5K':'pr','10K':'pr','Half Marathon':'pr','Marathon':'pr',
        'General Fitness':'fitness','Cycling Event':'pr',
      })[goal] || 'pr'
      const levelKey = (level || 'Intermediate').toLowerCase()
      const ctlNow = calcLoad(log)?.ctl ?? 0
      // Floor CTL so generator has a workable baseline even for new athletes
      const currentCTL = Math.max(20, ctlNow)
      // Honor the athlete's chosen training weekdays (Profile → trainingDow): the
      // session COUNT follows the chosen days, and the set is stored on the plan so
      // getTodayPlannedSession maps weekday → session (no forced weekend rest).
      const trainingDow = normalizeTrainingDow(profile?.trainingDow) || defaultDowForCount(advAvailableDays)
      const effAvailableDays = trainingDow
        ? Math.max(2, Math.min(7, trainingDow.length))
        : advAvailableDays
      // v9.92.0 — Mission 1 PLAN link: pass race distance + primary sport
      // through so 5K ≠ Marathon and cyclist plans show "Long ride" not "Long run"
      const adaptive = generateAdaptivePlan({
        goal:          goalKey,
        currentCTL,
        weeksToRace:   weeks,
        availableDays: effAvailableDays,
        model:         advModel,
        level:         levelKey,
        raceDistance:  goal,
        primarySport:  profile?.primarySport || null,
      })
      let finalPlan = adaptive
      if (finalPlan && advAutoTaper && advRaceDate) {
        const suggested = suggestTaper(finalPlan, advRaceDate)
        const tw = suggested?.taperWeeks || 2
        const tapered = applyTaper(finalPlan, advRaceDate, tw)
        if (tapered) finalPlan = tapered
      }
      const validation = finalPlan ? validatePlan(finalPlan) : { valid: false, errors: [{ code:'INVALID_PLAN', message:{ en:'Could not generate plan — check inputs.', tr:'Plan oluşturulamadı — girdileri kontrol edin.' } }] }
      const warnMsgs = (validation.errors || []).map(e => (lang === 'tr' ? e.message?.tr : e.message?.en) || e.code)
      setPlanWarnings(warnMsgs)
      setPlanValidationErrors(validation.errors || [])
      setWarningsExpanded(true)
      const legacyWeeks = adaptE13PlanToLegacy(
        finalPlan,
        lang,
        profile?.primarySport || null,
        { threshold: profile?.threshold || null },
      ) || []
      setPlan({
        goal,
        weeks: legacyWeeks,
        generatedAt: today,
        trainingDow,
        level,
        hoursPerWeek: hours,
        isAdaptive: true,
        raceDistance: goal,
        primarySport: profile?.primarySport || null,
        adaptiveMeta: finalPlan ? { model: finalPlan.model, raceDate: finalPlan.raceDate || advRaceDate, taperWeeks: finalPlan.taperWeeks, raceDayTSB: finalPlan.raceDayTSB, ctlDropPct: finalPlan.ctlDropPct, recommendation: finalPlan.recommendation } : null,
      })
      if (warnMsgs.length > 0) {
        announce(lang === 'tr' ? `Plan ${warnMsgs.length} uyarı içeriyor` : `Plan has ${warnMsgs.length} issues`, 'assertive')
      } else {
        announce(lang === 'tr' ? 'Plan oluşturuldu' : 'Plan generated', 'polite')
      }
    } else if (blockMode) {
      const blockWeeks = generateBlockPlan({ weeklyHours: hours, totalWeeks: weeks, baseTSS: 300 })
      const weeks_arr = blockWeeks.map(w => ({
        week: w.week,
        phase: w.phaseId,
        tss: w.tssTarget,
        totalHours: w.hoursTarget,
        sessions: [],
        zonePct: [0, 0, 0, 0, 0],
        zoneEmphasis: w.zoneEmphasis,
        focus: w.focus,
      }))
      const baselineCTL = computeCTL(log)
      const rampWarn = validatePlanRamp(weeks_arr, baselineCTL)
      setPlan({ goal: t('blockPeriodization'), weeks: weeks_arr, generatedAt: today, level, hoursPerWeek: hours, isBlock: true, baselineCTL })
      setPlanWarnings(rampWarn.map(w => (lang === 'tr' ? w.message.tr : w.message.en)))
      setPlanValidationErrors(rampWarn)
      setWarningsExpanded(rampWarn.length > 0)
    } else {
      const weeks_arr = generatePlan(goal, weeks, hours, level)
      const baselineCTL = computeCTL(log)
      const rampWarn = validatePlanRamp(weeks_arr, baselineCTL)
      setPlan({ goal, weeks: weeks_arr, generatedAt: today, level, hoursPerWeek: hours, baselineCTL })
      setPlanWarnings(rampWarn.map(w => (lang === 'tr' ? w.message.tr : w.message.en)))
      setPlanValidationErrors(rampWarn)
      setWarningsExpanded(rampWarn.length > 0)
    }
    setSelWeek(0)
  }

  const printPlan = () => {
    if (!plan) return
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    const phaseColors = { Base:'#4a90d9', Build:'#f5c542', Peak:'#e03030', Peak2:'#e03030', Taper:'#888', Recovery:'#5bc25b', 'Race Week':'#ff6600', accumulation:'#4a90d9', transmutation:'#f5c542', realization:'#ff6600' }
    const rows = plan.weeks.map(w => {
      const activeSessions = w.sessions.filter(s => s.type !== 'Rest' && s.duration > 0)
      return `<tr>
        <td style="font-weight:600;color:${phaseColors[esc(w.phase)]||'#888'}">${esc(w.week)}</td>
        <td style="font-weight:600;color:${phaseColors[esc(w.phase)]||'#888'}">${esc(w.phase)}</td>
        <td>${esc(w.totalHours)}h</td>
        <td>${esc(w.tss)}</td>
        <td style="font-size:10px">${activeSessions.map(s=>`${esc(s.day)}: ${esc(s.type)} ${esc(s.duration)}min`).join('<br>')}</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>${esc(plan.goal)} Training Plan</title>
    <style>
      body{font-family:'Courier New',monospace;font-size:11px;color:#1a1a1a;margin:24px;background:#fff}
      h1{font-size:16px;border-bottom:2px solid #ff6600;padding-bottom:8px;margin-bottom:16px}
      .meta{font-size:11px;color:#555;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px;border:1px solid #ccc}
      td{padding:6px 8px;border:1px solid #e0e0e0;vertical-align:top}
      tr:nth-child(even){background:#fafafa}
      .footer{margin-top:24px;font-size:10px;color:#888;border-top:1px solid #e0e0e0;padding-top:8px}
      @media print{body{margin:12px}}
    </style></head><body>
    <h1>SPOREUS ATHLETE — ${esc(plan.goal).toUpperCase()} TRAINING PLAN</h1>
    <div class="meta">
      Level: ${esc(plan.level)} &nbsp;|&nbsp; Duration: ${esc(plan.weeks.length)} weeks &nbsp;|&nbsp;
      Volume: ~${esc(plan.hoursPerWeek)}h/week &nbsp;|&nbsp; Generated: ${esc(plan.generatedAt)}
    </div>
    <table><thead><tr><th>WK</th><th>PHASE</th><th>VOL</th><th>TSS</th><th>SESSIONS</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">sporeus.com — Science-based periodization (Seiler, Issurin, Bompa)</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}</script>
    </body></html>`
    const w = window.open('', '_blank', 'width=900,height=700')
    if (w) { w.document.write(html); w.document.close() }
  }

  const exportPlanCSV = () => {
    if (!plan) return
    const csv = planToCSV(plan)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0,10)
    a.href = url
    a.download = `sporeus-plan-${dateStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    announce(lang === 'tr' ? 'Plan dışa aktarıldı' : 'Plan exported', 'polite')
  }

  // ── Download a single session as a .zwo (Zwift / TrainerRoad / SYSTM) file ──
  const exportSessionZwo = (ses) => {
    if (!ses || isRestSession(ses)) return
    const ftpRaw = Number(profile?.ftp)
    const ftp = Number.isFinite(ftpRaw) && ftpRaw > 0 ? ftpRaw : 200
    const intent = sessionTypeToZwoIntent(ses.type)
    const workout = sessionToZwoWorkout({
      ...ses,
      intent,
      duration: Number(ses.duration) || 0,
    }, ftp)
    const { xml, errors } = buildZwoWorkout(workout)
    if (!xml || errors.length > 0) {
      announce(lang === 'tr' ? 'Antrenman indirilemedi' : 'Workout download failed', 'assertive')
      return
    }
    const dateStr = new Date().toISOString().slice(0, 10)
    const safeType = String(ses.type || 'session').toLowerCase().replace(/\s+/g, '-')
    const filename = `sporeus-${safeType}-${dateStr}.zwo`
    downloadZwoFile(xml, filename)
    announce(lang === 'tr' ? 'Antrenman indirildi' : 'Workout downloaded', 'polite')
  }

  const W = plan?.weeks[selWeek]

  // Optimal week from athlete's own data
  const optWeek = findOptimalWeekStructure(log, recovery)

  return (
    <div className="sp-fade">
      {optWeek.reliable && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'0ms', borderLeft:'4px solid #0064ff', marginBottom:'16px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#0064ff', letterSpacing:'0.08em', fontWeight:600, marginBottom:'8px' }}>
            ◈ {lang==='tr'?'VERİLERİNE GÖRE':'BASED ON YOUR DATA'}
          </div>
          <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.7, marginBottom:'10px' }}>
            {optWeek[lang] || optWeek.en}
          </div>
          {optWeek.bestPattern && optWeek.bestPattern.length > 0 && (
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'10px' }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => {
                const dayFull = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]
                const sess = optWeek.bestPattern.find(p => p.day === dayFull)
                const isRest = !sess
                return (
                  <div key={d} style={{ flex:'1 1 36px', textAlign:'center', padding:'5px 4px', borderRadius:'4px', background: isRest ? 'var(--card-bg)' : '#0064ff22', border:`1px solid ${isRest?'var(--border)':'#0064ff44'}` }}>
                    <div style={{ ...S.mono, fontSize:'8px', color:'#888' }}>{d}</div>
                    <div style={{ ...S.mono, fontSize:'9px', color: isRest ? '#888' : '#0064ff', fontWeight: isRest ? 400 : 600, lineHeight:1.3, marginTop:'2px' }}>
                      {isRest ? 'REST' : (sess.type.split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase())}
                    </div>
                    {!isRest && <div style={{ ...S.mono, fontSize:'8px', color:'#888' }}>{sess.avgDuration}m</div>}
                  </div>
                )
              })}
            </div>
          )}
          <button style={{ ...S.btn, fontSize:'11px', padding:'5px 12px', background:'#0064ff' }}
            onClick={() => setHours(optWeek.bestWeeklyHours?.min || hours)}>
            {lang==='tr'?'Bu Deseni Kullan':'Use This Pattern'}
          </button>
        </div>
      )}
      <PlanTemplatePicker />
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('planGoalL')}</div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
          {PLAN_GOALS.map(g=>(
            <button key={g} onClick={()=>setGoal(g)}
              style={{ ...S.navBtn(goal===g), borderRadius:'4px', fontSize:'11px', padding:'6px 12px' }}>{g}</button>
          ))}
        </div>
        <div style={S.row}>
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('planWeeksL')}: <strong>{weeks}</strong></label>
            {/* v9.61.0 — Range extended to 52 weeks (yearly plan support). */}
            <input type="range" min="4" max="52" value={weeks} onChange={e=>setWeeks(+e.target.value)}
              title="Total plan duration: 4–52 weeks (full year)"
              style={{ width:'100%', accentColor:'#ff6600' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>4</span><span>52</span></div>
          </div>
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('planHoursL')}: <strong>{hours}h</strong></label>
            <input type="range" min="3" max="15" value={hours} onChange={e=>setHours(+e.target.value)}
              title="Average training hours available per week"
              style={{ width:'100%', accentColor:'#ff6600' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>3h</span><span>15h</span></div>
          </div>
        </div>
        <div style={{ marginTop:'12px' }}>
          <label style={S.label}>{t('planLevelL')}</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {PLAN_LEVELS.map(lv=>(
              <button key={lv} onClick={()=>setLevel(lv)}
                title={lv==='Beginner'?'0–2 years, up to 6h/week':lv==='Intermediate'?'2–5 years, 6–10h/week':'5+ years, 10h+ per week'}
                style={{ ...S.navBtn(level===lv), borderRadius:'4px', fontSize:'11px', padding:'6px 14px' }}>{lv}</button>
            ))}
          </div>
        </div>
        <div style={{ marginTop:'14px' }}>
          <label style={S.label}>{t('blockPeriodization')}</label>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            <button
              onClick={() => setBlockMode(false)}
              style={{ ...S.navBtn(!blockMode), borderRadius:'4px', fontSize:'11px', padding:'6px 14px' }}
            >{t('blockModeLinear')}</button>
            <button
              onClick={() => setBlockMode(true)}
              style={{ ...S.navBtn(blockMode), borderRadius:'4px', fontSize:'11px', padding:'6px 14px', ...(blockMode ? { background:'#ff6600', color:'#fff', borderColor:'#ff6600' } : {}) }}
            >{t('blockModeBlock')}</button>
          </div>
          {blockMode && (
            <div style={{ marginTop:'10px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {BLOCK_PHASES.map(ph => (
                <div key={ph.id} style={{ flex:'1 1 140px', background:'var(--card-bg)', border:'1px solid #ff660044', borderTop:'3px solid #ff6600', borderRadius:'5px', padding:'8px 10px' }}>
                  <div style={{ ...S.mono, fontSize:'10px', fontWeight:700, color:'#ff6600', marginBottom:'3px' }}>{ph.name[lang] || ph.name.en}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'var(--muted)', marginBottom:'2px' }}>{t('blockFocusLabel')}: {ph.focus[lang] || ph.focus.en}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#4a90d9' }}>{t('blockZoneLabel')}: {ph.zoneEmphasis}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'2px' }}>{ph.durationWeeks.min}–{ph.durationWeeks.max} wk</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop:'14px', borderTop:'1px dashed var(--border)', paddingTop:'12px' }}>
          <label style={{ ...S.label, display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={e => setAdvancedMode(e.target.checked)}
              aria-label={lang==='tr' ? 'Gelişmiş (uyarlanabilir)' : 'Advanced (adaptive)'}
            />
            <span>{lang==='tr' ? 'GELİŞMİŞ (UYARLANABİLİR)' : 'ADVANCED (ADAPTIVE)'}</span>
          </label>
          {advancedMode && (
            <div style={{ marginTop:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px' }}>
              <div>
                <label style={S.label}>
                  {lang==='tr' ? 'GÜN/HAFTA' : 'DAYS/WEEK'}: <strong>{advAvailableDays}</strong>
                </label>
                <input
                  type="range" min="2" max="7" value={advAvailableDays}
                  onChange={e=>setAdvAvailableDays(+e.target.value)}
                  aria-label={lang==='tr' ? 'Haftalık antrenman günü' : 'Available days per week'}
                  style={{ width:'100%', accentColor:'#0064ff' }}
                />
              </div>
              <div>
                <label style={S.label}>{lang==='tr' ? 'PERİYODİZASYON' : 'PERIODIZATION'}</label>
                <select
                  value={advModel}
                  onChange={e=>setAdvModel(e.target.value)}
                  aria-label={lang==='tr' ? 'Periyodizasyon modeli' : 'Periodization model'}
                  style={{ ...S.mono, fontSize:'11px', padding:'4px 6px', width:'100%', background:'var(--input-bg)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'3px' }}
                >
                  <option value="traditional">{lang==='tr' ? 'Geleneksel' : 'Traditional'}</option>
                  <option value="polarized">{lang==='tr' ? 'Polarize' : 'Polarized'}</option>
                  <option value="block">{lang==='tr' ? 'Blok' : 'Block'}</option>
                </select>
              </div>
              <div>
                <label style={S.label}>{lang==='tr' ? 'YARIŞ TARİHİ' : 'RACE DATE'}</label>
                <input
                  type="date"
                  value={advRaceDate}
                  onChange={e=>setAdvRaceDate(e.target.value)}
                  aria-label={lang==='tr' ? 'Yarış tarihi' : 'Race date'}
                  style={{ ...S.mono, fontSize:'11px', padding:'4px 6px', width:'100%', background:'var(--input-bg)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'3px' }}
                />
              </div>
              <div style={{ display:'flex', alignItems:'center' }}>
                <label style={{ ...S.label, display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', marginTop:'14px' }}>
                  <input
                    type="checkbox"
                    checked={advAutoTaper}
                    onChange={e=>setAdvAutoTaper(e.target.checked)}
                    aria-label={lang==='tr' ? 'Otomatik taper' : 'Auto-taper'}
                  />
                  <span>{lang==='tr' ? 'OTO. TAPER' : 'AUTO-TAPER'}</span>
                </label>
              </div>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:'8px', marginTop:'16px', flexWrap:'wrap', alignItems:'center' }}>
          <button style={S.btn} onClick={generate}>{t('genPlanBtn')}</button>
          <button style={{ ...S.btnSec, fontSize:'11px' }} onClick={sharePlan}>⤴ Share Config</button>
          {shareMsg && <span style={{ ...S.mono, fontSize:'11px', color:'#5bc25b' }}>{shareMsg}</span>}
        </div>
        {planValidationErrors.length > 0 && (
          <div
            role="region"
            aria-label={lang==='tr' ? 'Plan uyarıları' : 'Plan warnings'}
            style={{ marginTop:'12px', padding:'8px 10px', background:'#f5c54222', border:'1px solid #f5c54266', borderLeft:'3px solid #f5c542', borderRadius:'4px' }}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <div style={{ ...S.mono, fontSize:'10px', fontWeight:700, color:'#a07a00' }}>
                {lang==='tr' ? `PLAN UYARILARI (${planValidationErrors.length})` : `PLAN WARNINGS (${planValidationErrors.length})`}
              </div>
              <button
                type="button"
                onClick={() => setWarningsExpanded(v => !v)}
                aria-expanded={warningsExpanded}
                aria-label={warningsExpanded
                  ? (lang==='tr' ? 'Uyarıları gizle' : 'Hide warnings')
                  : (lang==='tr' ? 'Uyarıları göster' : 'Show warnings')}
                style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'2px 8px', borderRadius:'3px', cursor:'pointer', border:'1px solid #a07a00', background:'transparent', color:'#a07a00' }}
              >
                {warningsExpanded ? '▾' : '▸'}
              </button>
            </div>
            {warningsExpanded && planValidationErrors.map((err, i) => {
              const text = (lang === 'tr' ? err.message?.tr : err.message?.en) || err.code
              return (
                <div key={i} style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', lineHeight:1.6, padding:'2px 0', display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'baseline' }}>
                  <span style={{ display:'inline-block', minWidth:'12px' }}>•</span>
                  <span style={{ flex:'1 1 200px' }}>{text}</span>
                  <span style={{ ...S.mono, fontSize:'9px', fontWeight:700, padding:'1px 5px', border:'1px solid #a07a00', borderRadius:'2px', color:'#a07a00', background:'#f5c54211' }}>
                    {err.code}
                  </span>
                  {err.weekNum != null && (
                    <span style={{ ...S.mono, fontSize:'9px', color:'#888' }}>
                      W{err.weekNum}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ ...S.card, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'12px 16px', marginBottom:'16px', ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.8 }}>
        {t('coachNote')}{' '}
        <a href="https://sporeus.com" target="_blank" rel="noreferrer" style={{ color:'#0064ff', fontWeight:600 }}>sporeus.com →</a>
      </div>

      {plan && (
        <>
          <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={S.cardTitle}>
                  {plan.goal} — {plan.weeks.length} {t('weekLabel').toLowerCase()}s · {plan.level}
                  {plan.versionTag && (
                    <span style={{ ...S.mono, fontSize:'9px', color:'#666', marginLeft:'8px', letterSpacing:'0.04em', fontWeight:400, textTransform:'none' }}>
                      [{plan.versionTag}]
                    </span>
                  )}
                </div>
                <button onClick={printPlan} style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)' }}>⎙ Print/PDF</button>
                <button
                  onClick={exportPlanCSV}
                  aria-label={lang==='tr' ? 'CSV olarak indir' : 'Export plan as CSV'}
                  style={{ ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 8px', borderRadius:'3px', cursor:'pointer', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)' }}
                >
                  {lang==='tr' ? '⤓ CSV' : '⤓ Export CSV'}
                </button>
              </div>
              {planCompliance() !== null && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ ...S.mono, fontSize:'10px', color:'#888' }}>PLAN COMPLIANCE</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                    <div style={{ width:'80px', height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ width:`${planCompliance()}%`, height:'100%', background: planCompliance()>=80?'#5bc25b':planCompliance()>=50?'#f5c542':'#e03030', borderRadius:'3px', transition:'width 0.3s' }}/>
                    </div>
                    <span style={{ ...S.mono, fontSize:'11px', fontWeight:600, color: planCompliance()>=80?'#5bc25b':planCompliance()>=50?'#f5c542':'#e03030' }}>{planCompliance()}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* v9.106.0 (Prompt JJ) — Plan history viewer. Reads
                sporeus-plan-history (v9.104 FF) and surfaces the mutation
                trail so athletes (and coaches viewing the same view) can
                see when the current plan was regenerated / deloaded /
                recalibrated. Collapsed by default — only shown when there
                are entries to display. */}
            {(() => {
              const history = readPlanHistory()
              if (!history || history.length === 0) return null
              return (
                <details style={{ marginTop:'4px', marginBottom:'8px' }}>
                  <summary style={{ ...S.mono, fontSize:'10px', color:'#888', cursor:'pointer', letterSpacing:'0.06em', userSelect:'none' }}>
                    ◇ {lang === 'tr' ? `PLAN GEÇMİŞİ · ${history.length} sürüm` : `PLAN HISTORY · ${history.length} versions`}
                  </summary>
                  <div style={{ marginTop:'6px', padding:'8px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'4px' }}>
                    {[...history].reverse().map((entry, i) => {
                      const isCurrent = i === 0
                      const when = entry.ts ? new Date(entry.ts).toLocaleString() : '—'
                      return (
                        <div key={`${entry.ts}-${i}`} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'3px 0', borderBottom: i < history.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                          <span style={{ ...S.mono, fontSize:'10px', fontWeight:700, color: isCurrent ? '#ff6600' : '#aaa', minWidth:'170px' }}>
                            [{entry.versionTag}]
                          </span>
                          {isCurrent && (
                            <span style={{ ...S.mono, fontSize:'8px', color:'#ff6600', background:'#ff660022', border:'1px solid #ff660044', borderRadius:'2px', padding:'1px 4px', letterSpacing:'0.06em' }}>
                              CURRENT
                            </span>
                          )}
                          <span style={{ ...S.mono, fontSize:'9px', color:'#666' }}>
                            {entry.weeks}wk · {entry.goal || '—'}
                          </span>
                          <span style={{ ...S.mono, fontSize:'9px', color:'#555', marginLeft:'auto' }}>
                            {when}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )
            })()}
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {plan.weeks.map((w,i) => {
                const isThis = Boolean(plan) && i === thisWeekIdx
                const isSel  = i === selWeek
                const phaseColor = { Base:'#4a90d9', Build:'#f5c542', Peak:'#e03030', Peak2:'#e03030', Taper:'#888', Recovery:'#5bc25b', 'Race Week':'#ff6600', accumulation:'#4a90d9', transmutation:'#f5c542', realization:'#ff6600' }[w.phase] || '#888'
                const wc = weekCompliance(i)
                return (
                  <button key={i} onClick={()=>setSelWeek(i)} style={{
                    ...S.mono, fontSize:'10px', fontWeight:600, padding:'5px 9px', borderRadius:'4px', cursor:'pointer',
                    background: isSel ? phaseColor : 'var(--card-bg)',
                    color: isSel ? '#fff' : 'var(--sub)',
                    border: isThis ? `2px solid ${phaseColor}` : '2px solid transparent',
                    position:'relative',
                  }}>
                    W{w.week}
                    {isThis && <span style={{ position:'absolute', top:'-4px', right:'-4px', width:'7px', height:'7px', background:'#ff6600', borderRadius:'50%' }}/>}
                    {wc !== null && <span style={{ position:'absolute', bottom:'-6px', left:'50%', transform:'translateX(-50%)', fontSize:'8px', color: wc>=80?'#5bc25b':wc>=50?'#f5c542':'#e03030', fontWeight:700 }}>{wc}%</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {W && (
            <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    <div style={S.cardTitle}>{t('weekLabel')} {W.week} — {W.phase.toUpperCase()}</div>
                    {selWeek === thisWeekIdx && <span style={{ ...S.tag('#ff6600') }}>THIS WEEK</span>}
                    {weekCompliance(selWeek) !== null && (
                      <span style={{ ...S.mono, fontSize:'10px', fontWeight:700, color: weekCompliance(selWeek)>=80?'#5bc25b':weekCompliance(selWeek)>=50?'#f5c542':'#e03030' }}>
                        {weekCompliance(selWeek)}% DONE
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'16px' }}>
                    {[{l:t('totalHrsLabel'),v:`${W.totalHours}h`},{l:t('tssEstLabel'),v:W.tss}].map(({l,v})=>(
                      <div key={l}>
                        <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{l}</div>
                        <div style={{ ...S.mono, fontSize:'15px', fontWeight:600, color:'#ff6600' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <MiniDonut pcts={W.zonePct} colors={ZONE_COLORS} size={56}/>
                  <div style={{ ...S.mono, fontSize:'8px', color:'#888', lineHeight:2 }}>
                    {ZONE_NAMES.map((n,i)=>W.zonePct[i]>0 && <div key={i} style={{ color:ZONE_COLORS[i] }}>Z{i+1}: {W.zonePct[i]}%</div>)}
                  </div>
                </div>
              </div>

              {plan.isBlock && W.focus && (
                <div style={{ display:'flex', gap:'12px', marginBottom:'10px', flexWrap:'wrap' }}>
                  <div style={{ ...S.mono, fontSize:'10px', color:'var(--muted)' }}>
                    <span style={{ color:'#888' }}>{t('blockFocusLabel')}: </span>
                    <span style={{ color:'var(--text)', fontWeight:600 }}>{W.focus}</span>
                  </div>
                  <div style={{ ...S.mono, fontSize:'10px', color:'var(--muted)' }}>
                    <span style={{ color:'#888' }}>{t('blockZoneLabel')}: </span>
                    <span style={{ color:'#4a90d9', fontWeight:600 }}>{W.zoneEmphasis}</span>
                  </div>
                </div>
              )}
              {/* v9.131.0 — "Why this week" rationale disclosure. Surfaces
                  phase context, volume ramp vs last week, session-type
                  distribution, position in macro cycle, upcoming phase
                  transition. Pure derive from plan + weekIdx. Hidden when
                  no factors fire (very short plans). */}
              {(() => {
                const wr = explainPlannedWeek({ plan, weekIdx: selWeek })
                if (!wr.hasContent) return null
                return (
                  <details style={{
                    marginBottom: '12px', padding: '6px 10px',
                    background: 'rgba(0,100,255,0.04)', border: '1px solid #0064ff33',
                    borderRadius: '4px',
                  }}>
                    <summary style={{
                      ...S.mono, fontSize: '10px', color: '#6699ff',
                      letterSpacing: '0.06em', cursor: 'pointer', userSelect: 'none',
                    }}>
                      ▼ {lang === 'tr' ? 'BU HAFTA NEDEN?' : 'WHY THIS WEEK'}
                      <span style={{ color: '#888', marginLeft: '8px' }}>· {wr.factors.length}</span>
                    </summary>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {wr.factors.map(f => (
                        <div key={f.key} style={{ ...S.mono, fontSize: '10px', lineHeight: 1.55 }}>
                          <span style={{ color: '#0064ff', fontWeight: 700 }}>
                            {f.label?.[lang] || f.label?.en}
                          </span>
                          <span style={{ color: '#aaa', marginLeft: '6px' }}>
                            — {f.detail?.[lang] || f.detail?.en}
                          </span>
                          {f.citation && (
                            <div style={{ color: '#666', fontSize: '9px', fontStyle: 'italic', marginTop: '2px' }}>
                              {f.citation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })()}

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'8px' }}>
                {W.sessions.map((ses, di) => {
                  const stKey = `${selWeek}-${di}`
                  const st = planStatus[stKey]
                  const stColors = { done:'#5bc25b', skipped:'#888', modified:'#f5c542' }
                  const stLabels = { done:'✓ DONE', skipped:'↷ SKIPPED', modified:'~ MODIFIED' }
                  return (
                  <div key={di} style={{
                    background: st==='done' ? '#5bc25b11' : st==='skipped' ? 'var(--card-bg)' : ses.type==='Rest' ? 'var(--card-bg)' : `${ses.color}11`,
                    border: `1px solid ${st ? stColors[st]+'44' : ses.type==='Rest'?'var(--border)':ses.color+'44'}`,
                    borderLeft: `3px solid ${st ? stColors[st] : ses.color}`,
                    borderRadius:'5px', padding:'10px 12px',
                    opacity: st==='skipped' ? 0.65 : 1,
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                      <span style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:'var(--muted)' }}>{ses.day.toUpperCase()}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        {st && <span style={{ ...S.mono, fontSize:'9px', fontWeight:700, color:stColors[st] }}>{stLabels[st]}</span>}
                        {ses.duration > 0 && <span style={{ ...S.mono, fontSize:'10px', color:'var(--muted)' }}>{ses.duration}min</span>}
                      </div>
                    </div>
                    <div style={{ ...S.mono, fontSize:'12px', fontWeight:600, color:ses.type==='Rest'?'var(--border)':ses.color, marginBottom:'4px' }}>{ses.type}</div>
                    {ses.zone !== '—' && <span style={{ ...S.tag(ses.color), fontSize:'9px', marginBottom:'6px', display:'inline-block' }}>{ses.zone}</span>}
                    <div style={{ fontSize:'11px', color:'var(--sub)', lineHeight:1.6, marginTop:'4px' }}>{ses.description}</div>
                    {ses.type !== 'Rest' && ses.duration > 0 && (
                      <>
                        <div style={{ display:'flex', gap:'4px', marginTop:'8px' }}>
                          {['done','skipped','modified'].map(s=>(
                            <button key={s} onClick={()=>toggleStatus(selWeek,di,s)}
                              style={{ flex:1, ...S.mono, fontSize:'9px', fontWeight:600, padding:'3px 0', borderRadius:'3px', cursor:'pointer', border:`1px solid ${st===s?stColors[s]:'var(--border)'}`, background:st===s?stColors[s]+'22':'transparent', color:st===s?stColors[s]:'var(--muted)' }}>
                              {s==='done'?'✓':s==='skipped'?'↷':'~'} {s.charAt(0).toUpperCase()+s.slice(1)}
                            </button>
                          ))}
                          {!isRestSession(ses) && (
                            <button
                              type="button"
                              onClick={() => exportSessionZwo(ses)}
                              aria-label={lang === 'tr' ? 'Zwift antrenman dosyası indir' : 'Download Zwift workout file'}
                              title={lang === 'tr' ? 'Zwift .zwo indir' : 'Download Zwift .zwo'}
                              style={{ ...S.mono, fontSize:'9px', fontWeight:700, width:'34px', padding:'3px 0', borderRadius:'3px', cursor:'pointer', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)' }}
                            >
                              ↓zwo
                            </button>
                          )}
                        </div>
                        <button onClick={() => onLogSession(ses)}
                          style={{ ...S.btnSec, fontSize:'10px', padding:'4px 10px', marginTop:'6px', width:'100%' }}>
                          {'\u2261'} {t('logThisBtn')}
                        </button>
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* v9.351.0 — Free-tier S&C parity. Same Rønnestad/Beattie
              phase-periodized strength science the elite-program path surfaces,
              derived from this plan's phases. Renders via the shared
              StrengthSection (collapsed by default). */}
          {(() => {
            const sp = strengthProgramForPlan(plan, plan.primarySport || profile?.primarySport || null)
            if (!sp || Object.keys(sp).length === 0) return null
            return (
              <div style={{ marginTop: '16px' }}>
                <StrengthSection strengthProgram={sp} isTR={lang === 'tr'} />
              </div>
            )
          })()}
        </>
      )}

      {!plan && (
        <div style={{ textAlign:'center', ...S.mono, padding:'40px 0' }}>
          <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'14px' }}>{t('noPlanYet')}</div>
          <button style={{ ...S.btn, fontSize:'12px' }} onClick={generate}>{t('genPlanBtn')}</button>
        </div>
      )}

      <TaperCalculator />
    </div>
  )
}
