import React, { useState, useContext, useMemo, useEffect, Fragment } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { MACRO_PHASES, ZONE_COLORS, ZONE_NAMES } from '../lib/constants.js'
import { useData } from '../contexts/DataContext.jsx'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

// ─── CTL/ATL/TSB projection math ─────────────────────────────────────────────
const CTL_TC = 42  // chronic time constant (days)
const ATL_TC = 7   // acute time constant (days)

// Phase load intensities → IF squared proxy (maps to TSS/hour)
const PHASE_IF = {
  'Base 1':   0.55,
  'Base 2':   0.62,
  'Build 1':  0.72,
  'Build 2':  0.78,
  'Peak 1':   0.82,
  'Peak 2':   0.78,
  'Taper':    0.68,
  'Race':     0.45,
  'Recovery': 0.42,
}
// Weekly hours multiplier from MACRO_PHASES load string
const LOAD_MULT = { Low: 0.70, Med: 1.00, High: 1.25 }

function projectCTL(phases, startCTL, startATL, weeklyHours) {
  const points = []
  let ctl = startCTL
  let atl = startATL
  const ctlDecay = 1 - 1 / CTL_TC
  const atlDecay = 1 - 1 / ATL_TC

  for (const p of phases) {
    const loadMult = LOAD_MULT[p.load] || 1.0
    const ifFactor = PHASE_IF[p.phase] || 0.65
    const wHours   = weeklyHours * loadMult
    // Weekly TSS ≈ hours × IF² × 100 (standard PMC formula)
    const weekTSS  = wHours * ifFactor * ifFactor * 100
    const dailyTSS = weekTSS / 7

    // Simulate 7 days
    for (let d = 0; d < 7; d++) {
      ctl = ctlDecay * ctl + dailyTSS / CTL_TC
      atl = atlDecay * atl + dailyTSS / ATL_TC
    }
    points.push({
      week:  p.week,
      phase: p.phase,
      CTL:   Math.round(ctl),
      ATL:   Math.round(atl),
      TSB:   Math.round(ctl - atl),
      TSS:   Math.round(weekTSS),
    })
  }
  return points
}

// Derive current CTL from actual log data
function computeCurrentCTL(log) {
  if (!log.length) return 40 // sensible default
  const sorted = [...log].sort((a, b) => (a.date > b.date ? 1 : -1))
  let ctl = 0
  for (const s of sorted) ctl = ctl + ((s.tss || 0) - ctl) / CTL_TC
  return Math.max(10, Math.round(ctl))
}
function computeCurrentATL(log) {
  if (!log.length) return 40
  const sorted = [...log].sort((a, b) => (a.date > b.date ? 1 : -1))
  let atl = 0
  for (const s of sorted) atl = atl + ((s.tss || 0) - atl) / ATL_TC
  return Math.max(10, Math.round(atl))
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ProjectionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload || {}
  return (
    <div style={{ background:'#1a1a1a', border:'1px solid #333', padding:'10px 14px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', lineHeight:1.9, minWidth:'140px' }}>
      <div style={{ color:'#ff6600', fontWeight:700, marginBottom:'4px' }}>WK{label} · {d.phase}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: {p.value >= 0 ? '+' : ''}{p.value}
        </div>
      ))}
      <div style={{ color:'#888', borderTop:'1px solid #333', marginTop:'6px', paddingTop:'6px' }}>
        Target TSS: {d.TSS}/wk
      </div>
    </div>
  )
}

// ─── Periodization plan table ─────────────────────────────────────────────────
function PlanTable({ phases, weeklyHours, raceDate, projection }) {
  const weekOffset = raceDate
    ? (() => {
        const raceDt   = new Date(raceDate)
        const startDt  = new Date(raceDt - (MACRO_PHASES.length - 1) * 7 * 86400000)
        return startDt
      })()
    : null

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', minWidth:'580px' }}>
        <thead>
          <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'10px', letterSpacing:'0.06em' }}>
            {['WK','DATE','PHASE','FOCUS','HRS','TSS','CTL','ATL','TSB','ZONES'].map((h, i) => (
              <th key={h} style={{ textAlign: i >= 4 ? 'center' : 'left', padding:'4px 8px 8px 0', fontWeight:600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {phases.map((row, idx) => {
            const proj    = projection[idx] || {}
            const loadMult = LOAD_MULT[row.load] || 1.0
            const wh = (weeklyHours * loadMult).toFixed(1)
            const isRace = row.phase === 'Race'
            const isRec  = row.phase === 'Recovery'
            const tsb    = proj.TSB ?? 0
            const tsbCol = tsb > 5 ? '#5bc25b' : tsb < -10 ? '#e03030' : '#f5c542'
            const dateStr = weekOffset
              ? new Date(weekOffset.getTime() + idx * 7 * 86400000)
                  .toLocaleDateString('en-GB', { day:'2-digit', month:'short' })
              : '—'

            return (
              <tr key={row.week} style={{
                borderBottom:'1px solid var(--border)',
                background: isRace ? '#ff000011' : isRec ? '#fffbf011' : 'transparent',
              }}>
                <td style={{ padding:'6px 8px 6px 0', fontWeight:700, color:'#ff6600' }}>{row.week}</td>
                <td style={{ padding:'6px 8px 6px 0', color:'#888', fontSize:'10px' }}>{dateStr}</td>
                <td style={{ padding:'6px 8px 6px 0' }}>{row.phase}</td>
                <td style={{ padding:'6px 8px 6px 0', color:'var(--sub)', fontSize:'10px' }}>{row.focus}</td>
                <td style={{ textAlign:'center', padding:'6px 8px 6px 0', fontWeight:600 }}>{wh}</td>
                <td style={{ textAlign:'center', padding:'6px 8px 6px 0', color:'#4a90d9' }}>
                  {proj.TSS ?? '—'}
                </td>
                <td style={{ textAlign:'center', padding:'6px 8px 6px 0', color:'#ff6600', fontWeight:600 }}>
                  {proj.CTL ?? '—'}
                </td>
                <td style={{ textAlign:'center', padding:'6px 8px 6px 0', color:'#aaa' }}>
                  {proj.ATL ?? '—'}
                </td>
                <td style={{ textAlign:'center', padding:'6px 4px 6px 0', fontWeight:600, color: tsbCol }}>
                  {proj.TSB != null ? (proj.TSB >= 0 ? '+' : '') + proj.TSB : '—'}
                </td>
                <td style={{ padding:'6px 0', minWidth:'110px' }}>
                  <div style={{ display:'flex', height:'9px', gap:'1px', borderRadius:'2px', overflow:'hidden' }}>
                    {row.zDist.map((pct, zi) => pct > 0 && (
                      <div key={zi} style={{ width:`${pct}%`, background:ZONE_COLORS[zi] }} title={`${ZONE_NAMES[zi]}: ${pct}%`}/>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Peak CTL banner ──────────────────────────────────────────────────────────
function PeakBanner({ projection, startCTL }) {
  if (!projection.length) return null
  const peak = projection.reduce((best, p) => p.CTL > best.CTL ? p : best, projection[0])
  const gain = peak.CTL - startCTL
  const raceWk = projection.find(p => p.phase === 'Race')
  const tsbOnRace = raceWk?.TSB ?? null

  return (
    <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'16px' }}>
      {[
        { label:'PEAK CTL (WK'+peak.week+')', value: peak.CTL, color:'#ff6600' },
        { label:'CTL GAIN',                  value: `+${gain}`, color:'#5bc25b' },
        { label:'RACE DAY TSB',              value: tsbOnRace != null ? (tsbOnRace >= 0 ? '+' : '') + tsbOnRace : '—', color: tsbOnRace != null ? (tsbOnRace > 5 ? '#5bc25b' : tsbOnRace < -10 ? '#e03030' : '#f5c542') : '#888' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ flex:'1 1 100px', padding:'10px 12px', borderRadius:'5px', border:'1px solid var(--border)', background:'var(--card-bg)', textAlign:'center' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'20px', fontWeight:700, color, letterSpacing:'0.02em' }}>{value}</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#888', marginTop:'4px', letterSpacing:'0.08em' }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Coach Plans Card ─────────────────────────────────────────────────────────
const PLAN_RESPONSES_KEY = 'sporeus-plan-responses'
function readPlanResponses() { try { return JSON.parse(localStorage.getItem(PLAN_RESPONSES_KEY)) || {} } catch { return {} } }
function savePlanResponses(obj) { try { localStorage.setItem(PLAN_RESPONSES_KEY, JSON.stringify(obj)) } catch (e) { logger.warn('localStorage:', e.message) } }
function planViewedKey(planId) { return `sporeus-plan-viewed-${planId}` }

function CoachPlansCard({ authUser }) {
  const [plans, setPlans]     = useState(null)  // null = loading
  const [expanded, setExpanded] = useState({})
  const [responses, setResponses] = useState(() => readPlanResponses())

  useEffect(() => {
    if (!isSupabaseReady() || !authUser) { setPlans([]); return }
    supabase
      .from('coach_plans')
      .select('id, name, goal, start_date, weeks, status, created_at, coach_id')
      .eq('athlete_id', authUser.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (error) { setPlans([]); return }
        setPlans(data || [])
      })
  }, [authUser?.id])

  const toggleResponse = (planId, weekNum, icon) => {
    const key = `${planId}-w${weekNum}`
    const current = responses[key]
    const updated = { ...responses }
    if (current?.response === icon) {
      delete updated[key]
    } else {
      updated[key] = { response: icon, ts: new Date().toISOString() }
    }
    setResponses(updated); savePlanResponses(updated)
  }

  const markPlanViewed = (planId) => {
    try { localStorage.setItem(planViewedKey(planId), new Date().toISOString()) } catch (e) { logger.warn('localStorage:', e.message) }
  }

  if (!isSupabaseReady() || !authUser) return null
  if (plans === null) return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'160ms' }}>
      <div style={S.cardTitle}>PLANS FROM YOUR COACH</div>
      <div style={{ ...S.mono, fontSize:'11px', color:'#555' }}>Loading…</div>
    </div>
  )
  if (plans.length === 0) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'160ms', borderLeft:'3px solid #0064ff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
        <div style={S.cardTitle}>PLANS FROM YOUR COACH</div>
        <span style={{ ...S.mono, fontSize:'9px', color:'#0064ff', border:'1px solid #0064ff44', borderRadius:'3px', padding:'2px 6px' }}>
          PHASE 3
        </span>
      </div>

      {plans.map(plan => {
        const weeks = Array.isArray(plan.weeks) ? plan.weeks : []
        const isOpen = !!expanded[plan.id]
        const startDt = plan.start_date
          ? new Date(plan.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
          : '—'

        const hasNotes = weeks.some(wk => wk.coachNote)
        const lastViewed = (() => { try { return localStorage.getItem(planViewedKey(plan.id)) } catch { return null } })()
        const latestNoteTs = weeks.reduce((best, wk) => wk.noteTs && wk.noteTs > best ? wk.noteTs : best, '')
        const isUpdated = hasNotes && latestNoteTs && (!lastViewed || latestNoteTs > lastViewed)

        return (
          <div key={plan.id} style={{ marginBottom:'10px', border:`1px solid ${isUpdated ? '#0064ff55' : 'var(--border)'}`, borderRadius:'5px', overflow:'hidden' }}>
            {/* Plan header row */}
            <div
              onClick={() => { setExpanded(e => ({ ...e, [plan.id]: !e[plan.id] })); if (!isOpen) markPlanViewed(plan.id) }}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', cursor:'pointer', background:'var(--surface)', userSelect:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                <span style={{ ...S.mono, fontSize:'12px', fontWeight:700, color:'#e0e0e0' }}>{plan.name}</span>
                {plan.goal && (
                  <span style={{ ...S.mono, fontSize:'10px', color:'#ff6600' }}>{plan.goal}</span>
                )}
                {isUpdated && (
                  <span style={{ ...S.mono, fontSize:'9px', color:'#0064ff', background:'#0064ff22', border:'1px solid #0064ff44', borderRadius:'3px', padding:'1px 6px', animation:'pulse 1.5s infinite' }}>
                    ● COACH UPDATED
                  </span>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ ...S.mono, fontSize:'10px', color:'#888' }}>
                  {startDt} · {weeks.length}wk
                </span>
                <span style={{ ...S.mono, fontSize:'11px', color:'#555' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded week table */}
            {isOpen && weeks.length > 0 && (
              <div style={{ overflowX:'auto', padding:'10px 12px 12px', background:'#0a0a0a' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', minWidth:'400px' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid #222', color:'#555', letterSpacing:'0.06em' }}>
                      {['WK','PHASE','SESSIONS','FOCUS'].map(h => (
                        <th key={h} style={{ textAlign:'left', padding:'3px 8px 6px 0', fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((wk, i) => {
                      const wNum = wk.week ?? i + 1
                      const rKey = `${plan.id}-w${wNum}`
                      const resp = responses[rKey]?.response
                      return (
                        <Fragment key={i}>
                          <tr style={{ borderBottom: wk.coachNote ? 'none' : '1px solid #1a1a1a' }}>
                            <td style={{ padding:'5px 8px 5px 0', color:'#ff6600', fontWeight:700 }}>{wNum}</td>
                            <td style={{ padding:'5px 8px 5px 0', color:'#e0e0e0' }}>{wk.phase || '—'}</td>
                            <td style={{ padding:'5px 8px 5px 0', color:'#888' }}>
                              {Array.isArray(wk.sessions) ? wk.sessions.length : (wk.sessions ?? '—')}
                            </td>
                            <td style={{ padding:'5px 0 5px 0', color:'#666', fontSize:'9px' }}>
                              {wk.coachNote ? <span style={{ color:'#0064ff' }}>✎ note</span> : (wk.focus || wk.goal || '—')}
                            </td>
                            <td style={{ padding:'5px 0 5px 4px', whiteSpace:'nowrap' }}>
                              {['✓','⚠','?'].map(icon => (
                                <button key={icon} onClick={() => toggleResponse(plan.id, wNum, icon)}
                                  style={{ ...S.mono, fontSize:'10px', padding:'1px 5px', marginLeft:'2px', background: resp === icon ? (icon==='✓'?'#5bc25b22':icon==='⚠'?'#f5c54222':'#0064ff22') : 'transparent', border:`1px solid ${resp === icon ? (icon==='✓'?'#5bc25b':icon==='⚠'?'#f5c542':'#0064ff') : '#333'}`, borderRadius:'3px', cursor:'pointer', color: resp === icon ? '#fff' : '#555' }}>
                                  {icon}
                                </button>
                              ))}
                            </td>
                          </tr>
                          {wk.coachNote && (
                            <tr style={{ borderBottom:'1px solid #1a1a1a' }}>
                              <td colSpan={5} style={{ padding:'4px 0 6px 32px' }}>
                                <span style={{ ...S.mono, fontSize:'10px', color:'#6699ff', background:'#0064ff0d', borderRadius:'3px', padding:'3px 8px', display:'inline-block', lineHeight:1.5 }}>
                                  ✎ {wk.coachNote}
                                </span>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {isOpen && weeks.length === 0 && (
              <div style={{ ...S.mono, fontSize:'10px', color:'#555', padding:'10px 12px' }}>No week data.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Periodization({ authUser }) {
  const { t } = useContext(LangCtx)
  const { log } = useData()

  const autoCtl = useMemo(() => computeCurrentCTL(log), [log])
  const autoAtl = useMemo(() => computeCurrentATL(log), [log])

  const [raceDate, setRaceDate] = useState('')
  const [hrs,      setHrs]      = useState('10')
  const [ctlInput, setCtlInput] = useState('')  // '' = auto
  const [showChart, setShowChart] = useState(true)

  const weeklyHours = parseFloat(hrs) || 10
  const startCTL    = ctlInput !== '' ? (parseFloat(ctlInput) || autoCtl) : autoCtl
  const startATL    = autoAtl

  const projection = useMemo(
    () => projectCTL(MACRO_PHASES, startCTL, startATL, weeklyHours),
    [startCTL, startATL, weeklyHours]
  )

  const startDate = raceDate
    ? new Date(new Date(raceDate).getTime() - (MACRO_PHASES.length - 1) * 7 * 86400000)
        .toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
    : null

  return (
    <div className="sp-fade">
      {/* ─── Inputs ─── */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('macroCycleTitle')} · FRIEL PERIODIZATION</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 160px' }}>
            <label style={S.label}>{t('raceDateL')}</label>
            <input style={S.input} type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 120px' }}>
            <label style={S.label}>{t('weekHoursL')}</label>
            <input style={S.input} type="number" step="0.5" min="3" max="40" placeholder="10"
              value={hrs} onChange={e => setHrs(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 120px' }}>
            <label style={S.label}>STARTING CTL {autoCtl > 10 ? `(auto: ${autoCtl})` : ''}</label>
            <input style={S.input} type="number" step="1" min="0" max="150"
              placeholder={String(autoCtl)}
              value={ctlInput}
              onChange={e => setCtlInput(e.target.value)}/>
          </div>
        </div>
        {startDate && (
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'10px' }}>
            {t('startDateLbl')} {startDate} · Race: {new Date(raceDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
          </div>
        )}
        {!raceDate && (
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'10px' }}>
            Set a race date to anchor the 13-week plan to calendar dates.
          </div>
        )}
      </div>

      {/* ─── CTL projection summary ─── */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'40ms' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div style={S.cardTitle}>CTL / ATL / TSB PROJECTION</div>
          <button
            onClick={() => setShowChart(s => !s)}
            style={{ ...S.mono, fontSize:'10px', padding:'3px 10px', borderRadius:'3px', border:'1px solid #444', background:'transparent', color:'#888', cursor:'pointer' }}>
            {showChart ? 'HIDE CHART' : 'SHOW CHART'}
          </button>
        </div>

        <PeakBanner projection={projection} startCTL={startCTL}/>

        {showChart && (
          <div style={{ height: 240, marginBottom:'16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projection} margin={{ top:5, right:12, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222"/>
                <XAxis
                  dataKey="week"
                  tickFormatter={w => `W${w}`}
                  tick={{ fill:'#888', fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill:'#888', fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<ProjectionTooltip/>}/>
                <Legend
                  wrapperStyle={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', paddingTop:'8px' }}
                />
                <ReferenceLine y={0} stroke="#444" strokeDasharray="4 2"/>
                <Line type="monotone" dataKey="CTL" stroke="#ff6600" strokeWidth={2.5}
                  dot={{ r:3, fill:'#ff6600', strokeWidth:0 }}
                  activeDot={{ r:5, fill:'#ff6600' }}
                  isAnimationActive={false}
                />
                <Line type="monotone" dataKey="ATL" stroke="#0064ff" strokeWidth={1.5}
                  dot={{ r:2, fill:'#0064ff', strokeWidth:0 }}
                  strokeDasharray="5 3"
                  isAnimationActive={false}
                />
                <Line type="monotone" dataKey="TSB" stroke="#5bc25b" strokeWidth={1.5}
                  dot={{ r:2, fill:'#5bc25b', strokeWidth:0 }}
                  strokeDasharray="3 2"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ ...S.mono, fontSize:'10px', color:'#888', lineHeight:1.7 }}>
          <span style={{ color:'#ff6600' }}>CTL</span> = fitness (42d avg) ·{' '}
          <span style={{ color:'#0064ff' }}>ATL</span> = fatigue (7d avg) ·{' '}
          <span style={{ color:'#5bc25b' }}>TSB</span> = form (CTL−ATL) ·{' '}
          Positive TSB = fresh · Negative = building fatigue · Target race TSB: +5 to +15
        </div>
      </div>

      {/* ─── Weekly plan table ─── */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'80ms' }}>
        <div style={S.cardTitle}>{t('weekBreakTitle')}</div>
        <PlanTable
          phases={MACRO_PHASES}
          weeklyHours={weeklyHours}
          raceDate={raceDate}
          projection={projection}
        />
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'10px', lineHeight:1.7 }}>
          Polarized model — Seiler &amp; Tønnessen (2009) · ~80% Z1–Z2, ~20% Z4–Z5 ·
          TSS targets based on Friel/Coggan PMC model (CTL time constant: 42d)
        </div>
      </div>

      {/* ─── Zone legend ─── */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'120ms' }}>
        <div style={S.cardTitle}>{t('zoneLegendTitle')}</div>
        <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
          {ZONE_NAMES.map((n, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px' }}>
              <div style={{ width:'12px', height:'12px', background:ZONE_COLORS[i], borderRadius:'2px' }}/>
              {n}
            </div>
          ))}
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'12px', lineHeight:1.7 }}>
          Mujika taper decay: TSS drops ~40% over last 2 weeks while intensity is maintained.
          Form (TSB) peaks in race week — target +5 to +15 for optimal performance.
        </div>
      </div>

      {/* ─── Coach-pushed plans ─── */}
      <CoachPlansCard authUser={authUser}/>
    </div>
  )
}
