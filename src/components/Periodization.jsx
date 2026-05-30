import React, { useState, useContext, useMemo, useEffect, useRef, Fragment } from 'react'
import { useAdaptivePlan } from '../hooks/useAdaptivePlan.js'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { MACRO_PHASES, ZONE_COLORS, ZONE_NAMES } from '../lib/constants.js'
import { useData } from '../contexts/DataContext.jsx'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { emitEvent } from '../lib/attribution.js'
import { formatLastSession } from '../lib/squadView.js'
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
  // v9.47.0 — locate which week is "today" so the table can highlight it.
  // Without a raceDate (no weekOffset), nothing is highlighted.
  const currentWeekIdx = weekOffset
    ? (() => {
        const today = Date.now()
        const idx = Math.floor((today - weekOffset.getTime()) / (7 * 86400000))
        return idx >= 0 && idx < phases.length ? idx : -1
      })()
    : -1

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
                  .toLocaleDateString('en-GB', { day:'2-digit', month:'short', timeZone:'UTC' })
              : '—'

            const isCurrent = idx === currentWeekIdx
            return (
              <tr key={row.week} aria-current={isCurrent ? 'true' : undefined} style={{
                borderBottom:'1px solid var(--border)',
                background: isCurrent
                  ? '#ff660018'
                  : isRace ? '#ff000011' : isRec ? '#fffbf011' : 'transparent',
                // v9.47.0 — current-week marker (orange inset shadow) so the
                // athlete can answer "where am I in the macro plan?" at a glance.
                boxShadow: isCurrent ? 'inset 3px 0 0 #ff6600' : undefined,
                fontWeight: isCurrent ? 600 : undefined,
              }}>
                <td style={{ padding:'6px 8px 6px 0', fontWeight:700, color:'#ff6600' }}>
                  {isCurrent ? '▸ ' : ''}{row.week}
                </td>
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

// v9.112.0 (Prompt CCC) — Decline reason set. Kept in lockstep with the
// CHECK constraint added by 20260479_coach_plan_decline_reason.sql.
// Widening this client-side without also widening the DB constraint will
// cause the UPDATE to error.
const DECLINE_REASONS = [
  { key: 'too_hard',          en: 'Too hard for me right now',  tr: 'Şu an için fazla zor' },
  { key: 'schedule_conflict', en: "Doesn't fit my schedule",     tr: 'Programa uygun değil' },
  { key: 'injury',            en: "I'm injured / need recovery", tr: 'Sakatım / iyileşmem gerek' },
  { key: 'other',             en: 'Other',                       tr: 'Diğer' },
]
const DECLINE_REASON_LABEL = Object.fromEntries(
  DECLINE_REASONS.map(r => [r.key, { en: r.en, tr: r.tr }])
)

function CoachPlansCard({ authUser }) {
  const { t, lang } = useContext(LangCtx)
  const [plans, setPlans]     = useState(null)  // null = loading
  const [expanded, setExpanded] = useState({})
  const [responses, setResponses] = useState(() => readPlanResponses())
  // v9.112.0 (Prompt CCC) — Decline modal state. Plan + draft reason/note
  // kept here rather than per-row local state so an open modal isn't lost
  // if the parent re-renders after the optimistic plan list update.
  const [declineModal, setDeclineModal] = useState(null) // null | { plan, reason, note }
  // v9.115.0 (Prompt GGG) — Focus management for the decline modal.
  // modalRef is the dialog container, used by the focus trap to scope
  // tabbable queries. firstFocusRef points at the first reason button
  // so keyboard users land somewhere meaningful when the dialog opens
  // rather than at the body (which would scroll the page on Tab).
  //
  // v9.119.0 (Prompt KKK) — Focus restoration. previousFocusRef
  // captures document.activeElement at the moment the modal opens so
  // we can return focus to the opener (typically the DECLINE button)
  // when the modal closes. Without this, modal close drops focus to
  // <body> and keyboard users have to re-find their place.
  const modalRef = useRef(null)
  const firstFocusRef = useRef(null)
  const previousFocusRef = useRef(null)
  useEffect(() => {
    if (!declineModal) {
      // Closing: restore focus to the element that had it before open.
      // Defer one frame so React finishes unmount before we move focus.
      const prev = previousFocusRef.current
      previousFocusRef.current = null
      if (prev && typeof prev.focus === 'function') {
        const id = setTimeout(() => {
          try { prev.focus() } catch { /* element may have unmounted */ }
        }, 0)
        return () => clearTimeout(id)
      }
      return
    }
    // Opening: capture current focus, then defer one frame so the
    // button is mounted before .focus()
    if (!previousFocusRef.current && typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement
    }
    const id = setTimeout(() => firstFocusRef.current?.focus(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus only on open/close transitions; reason/note keystrokes shouldn't re-steal focus
  }, [declineModal?.plan?.id, !!declineModal])

  useEffect(() => {
    if (!isSupabaseReady() || !authUser) { setPlans([]); return }
    supabase
      .from('coach_plans')
      // v9.105.0 (Prompt BB): also pull accepted_at/rejected_at so the
      // ACCEPT/DECLINE buttons or status pill can render.
      .select('id, name, goal, start_date, weeks, status, created_at, coach_id, accepted_at, rejected_at, decline_reason, decline_note')
      .eq('athlete_id', authUser.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (error) { setPlans([]); return }
        setPlans(data || [])
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on auth identity; same pattern as other auth effects
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

  // v9.105.0 (Prompt BB) — Acceptance handlers. Optimistic local update +
  // best-effort DB write. ACCEPT also replaces the local plan so the
  // athlete's TodayView immediately reflects the coach's prescription.
  const respondToPlan = async (plan, action, declineReason = null, declineNote = null) => {
    if (!isSupabaseReady()) return
    const nowISO = new Date().toISOString()
    const patch = action === 'accept'
      ? { accepted_at: nowISO, rejected_at: null, decline_reason: null, decline_note: null }
      : {
          rejected_at:    nowISO,
          accepted_at:    null,
          decline_reason: declineReason,
          decline_note:   declineNote && declineNote.trim() ? declineNote.trim().slice(0, 500) : null,
        }
    // Optimistic UI update
    setPlans(prev => (prev || []).map(p => p.id === plan.id ? { ...p, ...patch } : p))
    try {
      await supabase.from('coach_plans').update(patch).eq('id', plan.id)
      emitEvent(action === 'accept' ? 'coach_plan_accepted' : 'coach_plan_declined', {
        plan_id:  plan.id,
        coach_id: plan.coach_id,
        weeks:    Array.isArray(plan.weeks) ? plan.weeks.length : 0,
        ...(action === 'decline' ? { reason: declineReason } : {}),
      })
      if (action === 'accept') {
        // Replace local plan so TodayView + drift card see the coach's plan.
        // Same shape as the legacy starter plan, with a versionTag noting
        // the coach origin for v9.104 Prompt FF provenance.
        const localPlan = {
          goal:         plan.goal || 'General Fitness',
          weeks:        Array.isArray(plan.weeks) ? plan.weeks : [],
          generatedAt:  plan.start_date || nowISO.slice(0, 10),
          coachPlanId:  plan.id,
          versionTag:   `9.105.0-coach-${plan.id.slice(0, 8)}`,
          fromCoach:    true,
        }
        try {
          localStorage.setItem('sporeus-plan', JSON.stringify(localPlan))
        } catch (e) { logger.warn('local plan write failed:', e?.message) }
      }
    } catch (e) {
      logger.warn('plan response failed:', e?.message)
    }
  }

  if (!isSupabaseReady() || !authUser) return null
  if (plans === null) return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'160ms' }}>
      <div style={S.cardTitle}>PLANS FROM YOUR COACH</div>
      <div style={{ ...S.mono, fontSize:'11px', color:'#555' }}>{t('loadingCoachPlans')}</div>
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
          ? new Date(plan.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' })
          : '—'

        const hasNotes = weeks.some(wk => wk.coachNote)
        const lastViewed = (() => { try { return localStorage.getItem(planViewedKey(plan.id)) } catch { return null } })()
        const latestNoteTs = weeks.reduce((best, wk) => wk.noteTs && wk.noteTs > best ? wk.noteTs : best, '')
        const isUpdated = hasNotes && latestNoteTs && (!lastViewed || latestNoteTs > lastViewed)

        // v9.105.0 (Prompt BB): three states drive the right action.
        const isPending  = !plan.accepted_at && !plan.rejected_at
        const isAccepted = !!plan.accepted_at
        const isDeclined = !!plan.rejected_at
        const responseAge = plan.accepted_at || plan.rejected_at
          ? formatLastSession(plan.accepted_at || plan.rejected_at)
          : null
        // v9.107.0 (Prompt MM): nudge when a pending plan sits >5 days.
        // Coaches reading pending counts (v9.106 KK) get acted on faster
        // when athletes see a passive reminder they can't dismiss.
        const pendingAgeDays = isPending && plan.created_at
          ? Math.floor((Date.now() - new Date(plan.created_at).getTime()) / 86400000)
          : 0
        const isPendingStale = pendingAgeDays > 5
        // Pending plans get a yellow border; stale-pending gets stronger amber.
        const borderColor = isPendingStale ? '#ff6600bb'
                          : isPending      ? '#f5c54299'
                          : isUpdated      ? '#0064ff55'
                          : 'var(--border)'

        return (
          <div key={plan.id} style={{ marginBottom:'10px', border:`1px solid ${borderColor}`, borderRadius:'5px', overflow:'hidden' }}>
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
                    ● {t('coachUpdated')}
                  </span>
                )}
                {/* v9.105.0 (Prompt BB) — Response status pill */}
                {isPending && (
                  <span style={{ ...S.mono, fontSize:'9px', color:'#f5c542', background:'#f5c54222', border:'1px solid #f5c54266', borderRadius:'3px', padding:'1px 6px', letterSpacing:'0.06em' }}>
                    PENDING
                  </span>
                )}
                {isAccepted && (
                  <span style={{ ...S.mono, fontSize:'9px', color:'#5bc25b', background:'#5bc25b22', border:'1px solid #5bc25b66', borderRadius:'3px', padding:'1px 6px', letterSpacing:'0.06em' }}>
                    ✓ ACCEPTED {responseAge}
                  </span>
                )}
                {isDeclined && (
                  <span style={{ ...S.mono, fontSize:'9px', color:'#888', background:'#88888822', border:'1px solid #88888866', borderRadius:'3px', padding:'1px 6px', letterSpacing:'0.06em' }}>
                    ✕ DECLINED {responseAge}
                    {plan.decline_reason && (
                      <span style={{ color:'#aaa' }}>
                        {' · '}{DECLINE_REASON_LABEL[plan.decline_reason]?.[lang] || DECLINE_REASON_LABEL[plan.decline_reason]?.en || plan.decline_reason}
                      </span>
                    )}
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

            {/* v9.107.0 (Prompt MM) — Stale-pending nudge banner. Coaches
                can see pending counts (v9.106 KK), but the athlete-side
                pressure was just the amber border. After 5 days
                un-responded, surface an explicit reminder line so the
                plan doesn't quietly age out of relevance. */}
            {isPendingStale && (
              <div style={{
                padding:'8px 12px', background:'#ff660014',
                borderTop:'1px solid #ff660044',
                ...S.mono, fontSize:'10px', color:'#ff9944', lineHeight:1.5,
              }}>
                ⏱ {t('coachPlanStaleNudge')
                  ? `${t('coachPlanStaleNudge')} (${pendingAgeDays}d)`
                  : `Your coach has been waiting ${pendingAgeDays} days for your response.`}
              </div>
            )}

            {/* v9.105.0 (Prompt BB) — Action bar: ACCEPT / DECLINE, only on pending */}
            {isPending && (
              <div style={{ display:'flex', gap:'8px', padding:'8px 12px', background:'var(--card-bg)', borderTop:'1px solid var(--border)' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); respondToPlan(plan, 'accept') }}
                  style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'5px 12px', background:'#5bc25b', border:'none', color:'#fff', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em' }}>
                  ✓ {t('coachPlanAccept') || 'ACCEPT PLAN'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeclineModal({ plan, reason: '', note: '' }) }}
                  style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'5px 12px', background:'transparent', border:'1px solid #888', color:'#aaa', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em' }}>
                  ✕ {t('coachPlanDecline') || 'DECLINE'}
                </button>
                <span style={{ ...S.mono, fontSize:'9px', color:'#666', alignSelf:'center', marginLeft:'auto' }}>
                  {t('coachPlanAcceptHint') || 'Accepting replaces your current plan'}
                </span>
              </div>
            )}

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
              <div style={{ ...S.mono, fontSize:'10px', color:'#555', padding:'10px 12px' }}>{t('noWeekData')}</div>
            )}
          </div>
        )
      })}

      {/* v9.112.0 (Prompt CCC) — Decline reason modal. Required reason
          (4 closed options) + optional free-form note. Modal blocks the
          DECLINE flow so coaches always get a structured signal back.
          Cancel exits without writing; Submit fires respondToPlan with
          the reason + trimmed note. */}
      {declineModal && (() => {
        // v9.115.0 (Prompt GGG) — Decline-modal a11y + draft preservation.
        // Pre-v9.115 the modal had role/aria-modal but no Esc-to-close,
        // no focus trap, no initial focus, and backdrop click silently
        // discarded the draft. Keyboard users got stranded behind the
        // overlay; mid-typing users lost work to a stray click.
        const hasDraft = !!(declineModal.reason || (declineModal.note || '').trim())
        const requestClose = () => {
          if (hasDraft) {
            const confirmMsg = lang === 'tr'
              ? 'Taslağı sil ve kapat?'
              : 'Discard your draft and close?'
            // eslint-disable-next-line no-alert -- intentional confirm-before-discard
            if (!window.confirm(confirmMsg)) return
          }
          setDeclineModal(null)
        }
        const onKeyDown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            requestClose()
            return
          }
          if (e.key === 'Tab' && modalRef.current) {
            // Focus trap — cycle within tabbable elements inside the modal.
            const focusables = modalRef.current.querySelectorAll(
              'button:not([disabled]), textarea, [href], input, select, [tabindex]:not([tabindex="-1"])'
            )
            if (!focusables.length) return
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault()
              last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault()
              first.focus()
            }
          }
        }
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-modal-title"
            onClick={requestClose}
            onKeyDown={onKeyDown}
            style={{
              position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
              display:'flex', alignItems:'center', justifyContent:'center',
              padding:'16px', zIndex:9999,
            }}>
            <div
              ref={modalRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...S.card, maxWidth:'420px', width:'100%',
                borderLeft:'3px solid #888', padding:'18px',
              }}>
              <div id="decline-modal-title" style={{ ...S.cardTitle, marginBottom:'14px' }}>
                ✕ {lang === 'tr' ? 'PLANI REDDET' : 'DECLINE PLAN'}
              </div>
              <div style={{ ...S.mono, fontSize:'11px', color:'#aaa', marginBottom:'12px', lineHeight:1.55 }}>
                {lang === 'tr'
                  ? 'Antrenörünün bir sonraki planı senin için ayarlayabilmesi için neden seçmen gerekiyor.'
                  : 'Pick a reason so your coach can adjust the next plan for you.'}
              </div>
              <div role="radiogroup" aria-label={lang === 'tr' ? 'Reddetme nedeni' : 'Decline reason'}
                style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'14px' }}>
                {DECLINE_REASONS.map((r, i) => {
                  const selected = declineModal.reason === r.key
                  return (
                    <button
                      key={r.key}
                      ref={i === 0 ? firstFocusRef : null}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDeclineModal(m => ({ ...m, reason: r.key }))}
                      style={{
                        ...S.mono, fontSize:'11px', textAlign:'left',
                        padding:'8px 10px',
                        background: selected ? '#ff660018' : 'transparent',
                        border:`1px solid ${selected ? '#ff660066' : 'var(--border)'}`,
                        color: selected ? '#ff9944' : '#ccc',
                        borderRadius:'4px', cursor:'pointer',
                      }}>
                      {selected ? '◉' : '○'} {r[lang] || r.en}
                    </button>
                  )
                })}
              </div>
              <textarea
                value={declineModal.note}
                onChange={e => setDeclineModal(m => ({ ...m, note: e.target.value.slice(0, 500) }))}
                rows={3}
                placeholder={lang === 'tr'
                  ? 'İsteğe bağlı not (en fazla 500 karakter)…'
                  : 'Optional note (max 500 chars)…'}
                style={{ ...S.input, width:'100%', fontSize:'11px', padding:'7px 9px', resize:'vertical', lineHeight:1.5, marginBottom:'14px' }}
              />
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button
                  onClick={requestClose}
                  style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'6px 14px', background:'transparent', border:'1px solid #555', color:'#aaa', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em' }}>
                  {lang === 'tr' ? 'VAZGEÇ' : 'CANCEL'}
                </button>
                <button
                  onClick={() => {
                    const { plan, reason, note } = declineModal
                    if (!reason) return
                    respondToPlan(plan, 'decline', reason, note)
                    setDeclineModal(null)
                  }}
                  disabled={!declineModal.reason}
                  style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'6px 14px', background:'#e03030', border:'none', color:'#fff', borderRadius:'3px', cursor: declineModal.reason ? 'pointer' : 'not-allowed', letterSpacing:'0.06em', opacity: declineModal.reason ? 1 : 0.4 }}>
                  ✕ {lang === 'tr' ? 'GÖNDER' : 'SUBMIT'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
// ─── AdaptivePlanCard — shows last-week adherence + next-week suggestion ───────
function AdaptivePlanCard({ log, plan, lang }) {
  const { adaptation, dismiss } = useAdaptivePlan(log, plan)
  if (!adaptation) return null

  const statusColor = {
    on_track:  '#5bc25b',
    exceeded:  '#f5c542',
    overreach: '#e03030',
    under:     '#f5c542',
    low:       '#e03030',
  }[adaptation.status] || '#888'

  return (
    <div className="sp-card" style={{ ...S.card, borderLeft: `4px solid ${statusColor}`, animationDelay: '0ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ ...S.cardTitle, color: statusColor }}>
          {lang === 'tr' ? 'PLAN UYUM ANALİZİ' : 'PLAN ADAPTATION'}
        </div>
        <button onClick={dismiss}
          aria-label={lang === 'tr' ? 'Uyarıyı kapat' : 'Dismiss alert'}
          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>
          ×
        </button>
      </div>
      <div style={{ ...S.mono, fontSize: '11px', color: '#ccc', lineHeight: 1.7, marginBottom: '10px' }}>
        {lang === 'tr' ? adaptation.messageTr : adaptation.message}
      </div>
      {adaptation.adjustedNextTSS && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#888', padding: '6px 10px', background: 'var(--surface)', borderRadius: '3px' }}>
          {lang === 'tr' ? 'Sonraki hafta önerilen yük' : 'Suggested next-week load'}:
          {' '}<span style={{ color: statusColor, fontWeight: 700 }}>{adaptation.adjustedNextTSS} TSS</span>
          {' '}({lang === 'tr' ? 'planlı' : 'planned'}: {adaptation.nextPlannedTSS})
          {' '}· {adaptation.adjustPct > 0 ? '+' : ''}{adaptation.adjustPct}%
        </div>
      )}
    </div>
  )
}

export default function Periodization({ authUser }) {
  const { t, lang } = useContext(LangCtx)
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
        .toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' })
    : null

  // Read coach plan from localStorage for adaptive analysis (same key used by App.jsx)
  const coachPlan = (() => { try { return JSON.parse(localStorage.getItem('sporeus-plan') || 'null') } catch { return null } })()

  return (
    <div className="sp-fade">
      <AdaptivePlanCard log={log} plan={coachPlan} lang={lang} />
      {/* ─── Inputs ─── */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('macroCycleTitle')} · {t('periodizationTitle')}</div>
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
            {t('startDateLbl')} {startDate} · Race: {new Date(raceDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' })}
          </div>
        )}
        {!raceDate && (
          <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'10px' }}>
            {t('raceAnchorHint')}
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
            {showChart ? t('hideChart') : t('showChart')}
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
