import { useState, useEffect, useContext } from 'react'
import { logger } from '../../lib/logger.js'
import { S } from '../../styles.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { generatePlan } from '../../lib/formulas.js'
import { openAthleteReport } from '../../lib/reportGenerator.js'
import { computeCompliance } from './helpers.jsx'
import { planSignature, isDuplicatePlanSend, recordPlanSend } from '../../lib/coachPlanDedup.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { announce } from '../../lib/a11y/announcer.js'
// v9.101.0 — Mission 1 chain extension to coach surface
import { getTodayPlannedSession } from '../../lib/intelligence.js'
import { deriveSessionTargets } from '../../lib/athlete/derivedSessionTargets.js'
import { computeSessionExecution, EXECUTION_STATUS_LABEL, EXECUTION_STATUS_COLOR } from '../../lib/athlete/sessionExecution.js'
// v9.102.0 — Prompt R: drift card on coach side
import { computePlanDrift, detectStalePlan } from '../../lib/athlete/planAdaptation.js'
// v9.106.0 — Prompt II: coach-side diagnostic visibility
import { detectGoalActivityMismatch } from '../../lib/athlete/goalActivityMismatch.js'
import { calcLoad } from '../../lib/formulas.js'

// ─── SbAthletePanel — expanded detail for a live (Supabase) athlete ──────────
const PLAN_GOALS_COACH = ['5K','10K','Half Marathon','Marathon','Cycling Event','General Fitness','Triathlon']
const PLAN_LEVELS_COACH = ['Beginner','Intermediate','Advanced']
const LEVEL_OVERRIDE_OPTS = ['', 'Beginner', 'Recreational', 'Competitive', 'Advanced', 'Elite']
const COACH_OVERRIDES_KEY = 'sporeus-coach-overrides'

function readOverrides() { try { return JSON.parse(localStorage.getItem(COACH_OVERRIDES_KEY)) || {} } catch { return {} } }
function saveOverrides(obj) { try { localStorage.setItem(COACH_OVERRIDES_KEY, JSON.stringify(obj)) } catch (e) { logger.warn('localStorage:', e.message) } }

export default function SbAthletePanel({ athleteId, athleteName, data, metrics, injRisk, loading, coachId, coachName }) {
  const langCtx = useContext(LangCtx)
  const lang = langCtx?.lang ?? 'en'
  const [planName,   setPlanName]   = useState(`${athleteName} — Training Plan`)
  const [planGoal,   setPlanGoal]   = useState('Half Marathon')
  const [planWeeks,  setPlanWeeks]  = useState('12')
  const [planHours,  setPlanHours]  = useState('8')
  const [planLevel,  setPlanLevel]  = useState('Intermediate')
  const [startDate,  setStartDate]  = useState(() => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [sending,  setSending]  = useState(false)
  const [sendMsg,  setSendMsg]  = useState('')
  const [showForm, setShowForm] = useState(false)
  const [activePlan,   setActivePlan]   = useState(null)   // most recent active plan for this athlete
  const [compliance,   setCompliance]   = useState(null)   // computeCompliance result
  const [showCompli,   setShowCompli]   = useState(false)  // expand compliance breakdown
  // v9.106.0 (Prompt KK): count of plans pending athlete response.
  // Surfaces a chip so coaches managing 10+ athletes can triage which
  // ones haven't accepted/declined the plans they were sent.
  const [pendingPlanCount, setPendingPlanCount] = useState(0)
  const [showWeekNotes, setShowWeekNotes] = useState(false)
  const [editingWeek,   setEditingWeek]   = useState(null)  // index of week being noted
  const [weekNoteDraft, setWeekNoteDraft] = useState('')
  const [savingNote,    setSavingNote]    = useState(false)
  const [noteMsg,       setNoteMsg]       = useState('')
  const [levelOverride, setLevelOverride] = useState(() => readOverrides()[athleteId] || '')
  const msgKey = `sporeus-messages-${athleteId}`
  const readMsgs  = () => { try { return JSON.parse(localStorage.getItem(msgKey)) || [] } catch { return [] } }
  const saveMsgs  = (arr) => { try { localStorage.setItem(msgKey, JSON.stringify(arr)) } catch (e) { logger.warn('localStorage:', e.message) } }
  const [messages,     setMessages]     = useState(() => readMsgs())
  const [msgDraft,     setMsgDraft]     = useState('')
  const [showMessages, setShowMessages] = useState(false)
  const unreadFromAthlete = messages.filter(m => m.from === 'athlete' && !m.read).length

  // Sync planLevel with override (or athlete's self-report) when either changes
  useEffect(() => {
    const effective = levelOverride || data?.profile?.athleteLevel || 'Intermediate'
    // Map to PLAN_LEVELS_COACH names (Recreational/Competitive/Elite → nearest)
    const MAP = { Recreational:'Beginner', Competitive:'Intermediate', Elite:'Advanced' }
    setPlanLevel(MAP[effective] || effective)
  }, [levelOverride, data?.profile?.athleteLevel])

  const sendMessage = () => {
    const text = msgDraft.trim()
    if (!text) return
    const msg = { id: Date.now() + Math.random().toString(36).slice(2, 5), from: 'coach', text, ts: new Date().toISOString(), read: true }
    const updated = [...messages, msg]
    setMessages(updated); saveMsgs(updated); setMsgDraft('')
  }

  const openMessages = () => {
    setShowMessages(s => !s)
    // mark all athlete messages as read
    const updated = messages.map(m => m.from === 'athlete' ? { ...m, read: true } : m)
    setMessages(updated); saveMsgs(updated)
  }

  const handleLevelOverride = async (val) => {
    setLevelOverride(val)
    const overrides = readOverrides()
    if (val) overrides[athleteId] = val
    else delete overrides[athleteId]
    saveOverrides(overrides)
    // Best-effort Supabase update to coach_athletes record
    if (isSupabaseReady() && athleteId && coachId) {
      supabase.from('coach_athletes')
        .update({ coachLevelOverride: val || null })
        .eq('athlete_id', athleteId)
        .eq('coach_id', coachId)
        .then(() => {}) // fire-and-forget
    }
  }

  // Fetch active plan once data is ready (Supabase athletes only)
  useEffect(() => {
    if (!isSupabaseReady() || !athleteId) return
    supabase
      .from('coach_plans')
      // v9.105.0 (Prompt BB): pull accepted_at/rejected_at so the coach
      // can see whether the athlete actually responded to the plan they
      // pushed. Pending plans are the highest-value follow-up signal.
      // v9.106.0 (Prompt KK): widen to last 10 active plans so the
      // pending-response counter has data, not just the latest plan.
      .select('id, name, goal, start_date, weeks, status, accepted_at, rejected_at')
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data: planRows }) => {
        const rows = planRows || []
        const plan = rows[0] || null
        setActivePlan(plan)
        if (plan) setCompliance(computeCompliance(plan, data?.log || []))
        setPendingPlanCount(rows.filter(r => !r.accepted_at && !r.rejected_at).length)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- data.log identity excluded; .length signals new entries
  }, [athleteId, data?.log?.length])

  const handleSendPlan = async () => {
    if (!isSupabaseReady() || !coachId || !athleteId) return
    const weeks = generatePlan(planGoal, planWeeks, planHours, planLevel.toLowerCase())
    // v9.64.0 — Client-side idempotency. The `coach_plans` insert lacks a
    // server-side onConflict / unique constraint, so a network-retry after a
    // lost response would create duplicate active plans. Until a DB migration
    // adds the constraint, suppress duplicates within a 60s window using a
    // localStorage signature keyed on (coach, athlete, plan shape).
    const signature = planSignature({ coachId, athleteId, planName, planGoal, startDate, weeks, planLevel })
    if (isDuplicatePlanSend(athleteId, signature)) {
      const dupMsg = lang === 'tr' ? '⚠ Aynı plan az önce gönderildi — tekrar engellendi' : '⚠ Same plan was just sent — duplicate suppressed'
      setSendMsg(dupMsg)
      announce(dupMsg, 'assertive')
      setTimeout(() => setSendMsg(''), 4000)
      return
    }

    setSending(true)
    const { error } = await supabase.from('coach_plans').insert({
      coach_id:   coachId,
      athlete_id: athleteId,
      name:       planName.trim() || `${athleteName} Plan`,
      goal:       planGoal,
      start_date: startDate,
      weeks:      weeks,
      status:     'active',
    })
    if (!error) recordPlanSend(athleteId, signature)
    setSending(false)
    if (error) {
      const errMsg = `⚠ ${error.message}`
      setSendMsg(errMsg)
      announce(lang === 'tr' ? `Plan gönderimi başarısız: ${error.message}` : `Plan send failed: ${error.message}`, 'assertive')
    } else {
      setSendMsg(`✓ Plan sent to ${athleteName}`)
      setShowForm(false)
      announce(lang === 'tr' ? 'Plan sporcuya gönderildi' : 'Plan sent to athlete', 'polite')
    }
    setTimeout(() => setSendMsg(''), 4000)
  }

  const saveWeekNote = async (weekIdx) => {
    if (!activePlan || !isSupabaseReady()) return
    setSavingNote(true)
    const weeks = [...(Array.isArray(activePlan.weeks) ? activePlan.weeks : [])]
    weeks[weekIdx] = { ...weeks[weekIdx], coachNote: weekNoteDraft.trim(), noteTs: new Date().toISOString() }
    const { error } = await supabase.from('coach_plans')
      .update({ weeks })
      .eq('id', activePlan.id)
    setSavingNote(false)
    if (!error) {
      setActivePlan(p => ({ ...p, weeks }))
      setEditingWeek(null); setWeekNoteDraft('')
      setNoteMsg('✓ Note saved'); setTimeout(() => setNoteMsg(''), 3000)
    } else {
      setNoteMsg(`⚠ ${error.message}`); setTimeout(() => setNoteMsg(''), 4000)
    }
  }

  return (
    <div style={{ background:'#0a0a0a', border:'1px solid #0064ff33', borderTop:'none', borderRadius:'0 0 5px 5px', padding:'12px 14px' }}>
      {loading ? (
        <div style={{ ...S.mono, fontSize:'10px', color:'#555' }}>Loading…</div>
      ) : (
        <>
          {/* v9.56.0 — Athlete profile header. Pre-fix coaches couldn't see
              sport / FTP / VO2max / weight / dragFactor — blocking visibility
              into sport-specific context. Now rendered in a single line above
              the metrics row, gated to known-non-empty fields only. */}
          {(() => {
            const p = data?.profile || {}
            const chips = [
              p.primarySport && { lbl: lang === 'tr' ? 'SPOR' : 'SPORT', val: String(p.primarySport).toUpperCase() },
              p.weight && { lbl: lang === 'tr' ? 'KG' : 'KG', val: `${p.weight}` },
              p.gender && { lbl: lang === 'tr' ? 'CIN.' : 'SEX', val: p.gender === 'female' ? 'F' : 'M' },
              p.ftp && { lbl: 'FTP', val: `${p.ftp}W` },
              p.vo2max && { lbl: 'VO₂', val: p.vo2max },
              p.dragFactor && { lbl: 'DF', val: p.dragFactor },
              p.maxhr && { lbl: 'MaxHR', val: p.maxhr },
              p.threshold && { lbl: 'LT', val: p.threshold },
            ].filter(Boolean)
            if (chips.length === 0) return null
            return (
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px dashed #1e1e1e' }}>
                {chips.map((c, i) => (
                  <span key={i} style={{ ...S.mono, fontSize:'10px', color:'#bbb' }}>
                    <span style={{ color:'#555', letterSpacing:'0.04em' }}>{c.lbl}</span>{' '}
                    <span style={{ fontWeight:700 }}>{c.val}</span>
                  </span>
                ))}
              </div>
            )
          })()}

          {/* v9.101.0 (Prompt P) — Today's session derived target + last-session
              execution status. Surfaces the v9.91 / v9.98 / v9.89 Mission 1
              chain to the coach side. Only renders when there's an active
              plan AND physiology is set; otherwise stays out of the way. */}
          {(() => {
            const today = new Date().toISOString().slice(0, 10)
            const profile = data?.profile || {}
            const log = data?.log || []
            // Convert coach_plans week shape (which holds plan.start_date /
            // plan.weeks JSON) into the shape getTodayPlannedSession expects
            // ({ generatedAt, weeks }). start_date is on activePlan; weeks
            // is the same JSON array.
            const planForLookup = activePlan ? {
              generatedAt: activePlan.start_date,
              weeks: Array.isArray(activePlan.weeks) ? activePlan.weeks : [],
            } : null
            const planned = planForLookup ? getTodayPlannedSession(planForLookup, today) : null
            const derived = planned ? deriveSessionTargets(planned, profile) : null

            // Last logged session for execution snapshot
            const sorted = [...log].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            const lastLog = sorted[0] || null
            // Need a planned session for the same date as lastLog to compute execution
            const lastPlanned = (planForLookup && lastLog?.date) ? getTodayPlannedSession(planForLookup, lastLog.date) : null
            const exec = (lastPlanned && lastLog) ? computeSessionExecution(lastPlanned, lastLog) : null

            if (!derived?.paceTarget && !derived?.powerTarget && !exec) return null
            const COL_GREEN = '#5bc25b'
            const COL_AMBER = '#f5c542'
            return (
              <div style={{
                display:'flex', gap:'14px', flexWrap:'wrap',
                marginBottom:'10px', paddingBottom:'8px',
                borderBottom:'1px dashed #1e1e1e',
              }}>
                {derived?.paceTarget && (
                  <span style={{ ...S.mono, fontSize:'10px', color:'#bbb' }}>
                    <span style={{ color:'#555', letterSpacing:'0.04em' }}>{lang === 'tr' ? 'BUGÜN · TEMPO' : 'TODAY · PACE'}</span>{' '}
                    <span style={{ fontWeight:700, color: COL_GREEN }}>{derived.paceTarget}</span>
                  </span>
                )}
                {derived?.powerTarget && (
                  <span style={{ ...S.mono, fontSize:'10px', color:'#bbb' }}>
                    <span style={{ color:'#555', letterSpacing:'0.04em' }}>{lang === 'tr' ? 'BUGÜN · GÜÇ' : 'TODAY · POWER'}</span>{' '}
                    <span style={{ fontWeight:700, color: COL_GREEN }}>{derived.powerTarget}</span>
                  </span>
                )}
                {planned && !derived?.paceTarget && !derived?.powerTarget && (
                  <span style={{ ...S.mono, fontSize:'10px', color:'#bbb' }}>
                    <span style={{ color:'#555', letterSpacing:'0.04em' }}>{lang === 'tr' ? 'BUGÜN' : 'TODAY'}</span>{' '}
                    <span style={{ fontWeight:700 }}>{planned.type}</span>
                    <span style={{ color:'#666' }}> · {planned.duration}min · {planned.zone}</span>
                  </span>
                )}
                {exec && (() => {
                  // v9.101.0 (Prompt Q) — Last-session execution status badge.
                  const c = EXECUTION_STATUS_COLOR[exec.status] || COL_AMBER
                  const lbl = EXECUTION_STATUS_LABEL[exec.status]?.[lang]
                            || EXECUTION_STATUS_LABEL[exec.status]?.en
                            || exec.status
                  return (
                    <span style={{ ...S.mono, fontSize:'10px', color:'#bbb' }}>
                      <span style={{ color:'#555', letterSpacing:'0.04em' }}>
                        {lang === 'tr' ? 'SON · İCRA' : 'LAST · EXEC'}
                      </span>{' '}
                      <span style={{ fontWeight:700, color:c }}>
                        {exec.duration.logged}m/{exec.duration.planned}m
                      </span>
                      <span style={{
                        marginLeft:'4px', padding:'1px 4px',
                        background:`${c}22`, border:`1px solid ${c}66`,
                        borderRadius:'2px', fontSize:'8px',
                        color:c, fontWeight:700, letterSpacing:'0.06em',
                      }}>
                        {String(lbl).toUpperCase()}
                      </span>
                    </span>
                  )
                })()}
              </div>
            )
          })()}

          {/* v9.106.0 (Prompt II) — Coach-side diagnostic flags. The same
              detectors the athlete sees on TodayView (Card 1z mismatch,
              Card 1a stale-plan). Read-only here: coach acts via the
              existing MESSAGE ATHLETE button on the drift card. Renders
              as compact chip row only when at least one flag fires. */}
          {(() => {
            const profile = data?.profile || {}
            const log = data?.log || []
            const today = new Date().toISOString().slice(0, 10)
            const mismatch = detectGoalActivityMismatch(profile, log, { today })
            // Build the same {generatedAt, weeks} adapter shape used by
            // the v9.102 drift card so detectStalePlan reads the right CTL.
            const planForLookup = activePlan ? {
              generatedAt: activePlan.start_date,
              weeks: Array.isArray(activePlan.weeks) ? activePlan.weeks : [],
              seedCTL: activePlan.seedCTL,
            } : null
            const currentCTL = (calcLoad(log)?.ctl) || 0
            const stale = planForLookup ? detectStalePlan(planForLookup, currentCTL, today) : null
            const flags = []
            if (mismatch?.mismatched) {
              const dom = String(mismatch.dominantSport).toUpperCase()
              const goal = String(mismatch.goalSport).toUpperCase()
              const domPct = Math.round(mismatch.dominantShare * 100)
              flags.push({
                key: 'mismatch', color: '#e03030',
                label: lang === 'tr' ? 'HEDEF ≠ ANTRENMAN' : 'GOAL ≠ TRAINING',
                detail: `${dom} ${domPct}% · ${goal} goal`,
                prefill: {
                  en: `I noticed your last 28 days are ${domPct}% ${dom} but your goal is ${goal}. Want to update the goal, or shift training to match it?`,
                  tr: `Son 28 günün %${domPct} ${dom} ama hedefin ${goal}. Hedefi mi güncelleyelim, yoksa antrenmanı mı hedefe göre değiştirelim?`,
                },
              })
            }
            if (stale?.stale) {
              const wks = Math.round(stale.ageDays / 7)
              const driftPct = stale.ctlDriftPct != null ? Math.round(stale.ctlDriftPct * 100) : null
              flags.push({
                key: 'stale', color: '#f5c542',
                label: lang === 'tr' ? `PLAN BAYAT (${stale.reason})` : `PLAN STALE (${stale.reason})`,
                detail: `${wks}wk old${driftPct != null ? ` · Δ${driftPct}%` : ''}`,
                prefill: {
                  en: `Your plan is ${wks} weeks old${driftPct != null ? ` and your fitness has shifted ${driftPct}%` : ''}. Should we recalibrate from your current CTL?`,
                  tr: `Planın ${wks} haftalık${driftPct != null ? ` ve kondisyonun %${driftPct} değişti` : ''}. Mevcut CTL'ne göre yeniden kalibre edelim mi?`,
                },
              })
            }
            // v9.106.0 (Prompt KK) — pending-plan-response counter
            if (pendingPlanCount > 0) {
              flags.push({
                key: 'pending', color: '#f5c542',
                label: lang === 'tr' ? `${pendingPlanCount} PLAN BEKLİYOR` : `${pendingPlanCount} PLAN PENDING`,
                detail: lang === 'tr' ? 'sporcunun yanıt vermesi bekleniyor' : 'awaiting athlete response',
                prefill: {
                  en: `You have ${pendingPlanCount} plan${pendingPlanCount > 1 ? 's' : ''} pending your response. Quick review?`,
                  tr: `${pendingPlanCount} plan yanıtını bekliyor. Hızlı bir bakar mısın?`,
                },
              })
            }
            if (flags.length === 0) return null
            // v9.111.0 (Prompt BBB) — chip becomes button that pre-fills the
            // message thread. Pre-v9.111 chips were static text — coach had
            // to scroll, find the v9.102 R drift card, click MESSAGE
            // ATHLETE. Now any chip is a one-click action.
            const openWithPrefill = (flag) => {
              const text = flag.prefill?.[lang] || flag.prefill?.en || ''
              setMsgDraft(text)
              setShowMessages(true)
              const updated = messages.map(m => m.from === 'athlete' ? { ...m, read: true } : m)
              setMessages(updated); saveMsgs(updated)
              try {
                supabase && supabase.from('attribution_events').insert({
                  user_id: coachId, event_name: 'coach_chip_action',
                  props: { flag: flag.key, action: 'message', athlete_id: athleteId },
                })
              } catch (e) { logger.warn('coach_chip_action emit:', e?.message) }
            }
            return (
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px dashed #1e1e1e' }}>
                {flags.map(f => (
                  <button key={f.key} onClick={() => openWithPrefill(f)} title={f.detail} style={{
                    ...S.mono, fontSize:'9px', letterSpacing:'0.06em', fontWeight:700,
                    padding:'3px 8px', background:`${f.color}18`, border:`1px solid ${f.color}66`,
                    color:f.color, borderRadius:'3px', cursor:'pointer', textAlign:'left',
                  }}>
                    ▲ {f.label}
                    <span style={{ marginLeft:'6px', color:'#aaa', fontWeight:400 }}>{f.detail}</span>
                    <span style={{ marginLeft:'8px', color:'#888', fontWeight:400 }}>✉</span>
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Metrics row */}
          <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'12px' }}>
            {[
              { lbl:'SESSIONS', val: data?.log?.length ?? 0 },
              { lbl:'CTL',      val: metrics?.ctl ?? '—', color:'#ff6600' },
              { lbl:'ATL',      val: metrics?.atl ?? '—', color:'#0064ff' },
              { lbl:'TSB',      val: metrics?.tsb ?? '—', color: (metrics?.tsb ?? 0) >= 0 ? '#5bc25b' : '#f5c542' },
              { lbl:'INJURY RISK', val: injRisk?.level ?? '—', color: injRisk?.level === 'HIGH' ? '#e03030' : injRisk?.level === 'MODERATE' ? '#f5c542' : '#5bc25b' },
            ].map(({ lbl, val, color }) => (
              <div key={lbl} style={{ textAlign:'center' }}>
                <div style={{ ...S.mono, fontSize:'16px', fontWeight:700, color: color || '#e0e0e0' }}>{val}</div>
                <div style={{ ...S.mono, fontSize:'8px', color:'#555', letterSpacing:'0.08em', marginTop:'2px' }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* v9.49.0 — Concern checklist (predictInjuryRisk factors). Was
              previously only the level badge above; now coaches see the
              specific reasons (ACWR spike / monotony / consecutive hard /
              readiness drop) as a science-cited row list. */}
          {Array.isArray(injRisk?.factors) && injRisk.factors.length > 0 ? (
            <div style={{ marginBottom:'12px', padding:'8px 10px', background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:'4px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.08em', marginBottom:'6px' }}>
                {lang === 'tr' ? 'YARALANMA RİSKİ FAKTÖRLERİ' : 'INJURY-RISK FACTORS'}
                <span style={{ color:'#555', marginLeft:6, fontWeight:400 }}>· {injRisk.factors.length}</span>
              </div>
              {injRisk.factors.map((f, i) => {
                const sevColor = f.severity === 'high' ? '#e03030'
                              : f.severity === 'moderate' ? '#f5c542'
                              : '#888'
                return (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ ...S.mono, fontSize:'9px', fontWeight:700, color:sevColor, minWidth:'80px', letterSpacing:'0.04em' }}>
                      {f.severity?.toUpperCase() || '—'}
                    </span>
                    <span style={{ ...S.mono, fontSize:'10px', color:'#ccc', minWidth:'120px', fontWeight:600 }}>
                      {f.label}
                    </span>
                    <span style={{ ...S.mono, fontSize:'10px', color:'#888', flex:1, lineHeight:1.4 }}>
                      {f.detail?.[lang] || f.detail?.en || ''}
                    </span>
                  </div>
                )
              })}
              {injRisk.advice ? (
                <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600', marginTop:'6px', paddingTop:'6px', borderTop:'1px dashed #1e1e1e', fontWeight:600 }}>
                  → {injRisk.advice[lang] || injRisk.advice.en}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* v9.102.0 (Prompt R) — TSS-based plan drift card. Replaces the
              session-count compliance bar. Why: the old bar treated a logged
              30-min easy ride as "done" against a planned 90-min long ride —
              load-aware compliance is what the plan was actually budgeted on.
              When drift.action === 'regenerate', the coach gets a one-click
              MESSAGE ATHLETE button that opens the thread with the rationale
              pre-filled, so the conversation starts with science not friction. */}
          {activePlan && (() => {
            const today = new Date().toISOString().slice(0, 10)
            const planForDrift = {
              generatedAt: activePlan.start_date,
              weeks: Array.isArray(activePlan.weeks) ? activePlan.weeks : [],
            }
            const drift = computePlanDrift(planForDrift, data?.log || [], today)
            if (!drift || drift.status === 'pending') return null
            const RED = '#e03030', AMBER = '#f5c542', GREEN = '#5bc25b'
            const statusColor =
              drift.status === 'drift'    ? RED
              : drift.status === 'under'  ? AMBER
              : drift.status === 'over'   ? AMBER
              : drift.status === 'on-track' ? GREEN
              : '#888'
            const pctLabel = `${Math.round(drift.avgPct * 100)}%`
            return (
              <div style={{
                marginBottom:'12px', padding:'10px 12px',
                background:'#0a0a0a', border:'1px solid #1e1e1e',
                borderLeft:`3px solid ${statusColor}`, borderRadius:'4px',
              }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:'10px', marginBottom:'8px', flexWrap:'wrap' }}>
                  <span style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em' }}>
                    {lang === 'tr' ? 'PLAN ADAPTASYONU' : 'PLAN ADAPTATION'}
                  </span>
                  <span style={{ ...S.mono, fontSize:'18px', fontWeight:700, color: statusColor }}>{pctLabel}</span>
                  <span style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.06em' }}>
                    {lang === 'tr'
                      ? `${drift.weeksAnalyzed} HAFTA · TSS UYUMU`
                      : `${drift.weeksAnalyzed} WEEKS · TSS COMPLIANCE`}
                  </span>
                </div>
                <div style={{
                  ...S.mono, fontSize:'10px', color:'#ccc', lineHeight:1.5,
                  marginBottom:'8px', padding:'6px 8px',
                  background:`${statusColor}0c`, borderLeft:`2px solid ${statusColor}`,
                }}>
                  {drift.recommendation[lang] || drift.recommendation.en}
                </div>
                {drift.citation && (
                  <div style={{ ...S.mono, fontSize:'8px', color:'#666', fontStyle:'italic', marginBottom:'8px' }}>
                    {drift.citation}
                  </div>
                )}
                {drift.weeks.length > 0 && (
                  <div style={{ display:'flex', gap:'3px', marginBottom:'8px', flexWrap:'wrap' }}>
                    {drift.weeks.map(w => {
                      const c =
                        w.status === 'missed'   ? RED
                        : w.status === 'under'  ? AMBER
                        : w.status === 'over'   ? AMBER
                        : w.status === 'on-track' ? GREEN
                        : '#333'
                      return (
                        <div key={w.weekIdx}
                          title={`W${w.weekIdx + 1}: ${w.actualTSS}/${w.plannedTSS} TSS (${Math.round(w.pct * 100)}%)`}
                          style={{
                            flex:'1 0 24px', minWidth:'24px', height:'16px',
                            background:c + '33', border:`1px solid ${c}66`,
                            borderRadius:'2px', display:'flex', alignItems:'center', justifyContent:'center',
                            ...S.mono, fontSize:'8px', color:c, fontWeight:700,
                          }}
                        >
                          W{w.weekIdx + 1}
                        </div>
                      )
                    })}
                  </div>
                )}
                {drift.action === 'regenerate' && (
                  <button
                    onClick={() => {
                      const rationale = drift.recommendation[lang] || drift.recommendation.en
                      const prefix = lang === 'tr'
                        ? `${pctLabel} ortalama plan uyumu (${drift.weeksAnalyzed} hafta). `
                        : `${pctLabel} avg plan compliance over ${drift.weeksAnalyzed} weeks. `
                      setMsgDraft(prefix + rationale + (drift.citation ? `  — ${drift.citation}` : ''))
                      setShowMessages(true)
                      // Mark unread as read since coach is opening the thread
                      const updated = messages.map(m => m.from === 'athlete' ? { ...m, read: true } : m)
                      setMessages(updated); saveMsgs(updated)
                    }}
                    style={{
                      ...S.mono, fontSize:'10px', fontWeight:700, padding:'5px 12px',
                      background:'#ff6600', border:'none', color:'#fff',
                      borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em',
                    }}>
                    ✉ {lang === 'tr' ? 'SPORCUYA MESAJ AT' : 'MESSAGE ATHLETE'}
                  </button>
                )}
              </div>
            )
          })()}

          {/* Legacy session-count compliance — collapsible secondary view */}
          {compliance && (
            <div style={{ marginBottom:'12px' }}>
              <button
                onClick={() => setShowCompli(s => !s)}
                style={{ display:'flex', alignItems:'center', gap:'8px', background:'transparent', border:'none', cursor:'pointer', padding:0 }}>
                <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em' }}>SESSIONS</div>
                <div style={{ ...S.mono, fontSize:'13px', fontWeight:700, color: compliance.color }}>{compliance.pct}%</div>
                <div style={{ flex:1, height:'5px', background:'#1a1a1a', borderRadius:'2px', minWidth:'60px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${compliance.pct}%`, background: compliance.color, borderRadius:'2px', transition:'width 0.4s' }}/>
                </div>
                <span style={{ ...S.mono, fontSize:'9px', color:'#555' }}>{showCompli ? '▲' : '▼'}</span>
              </button>
              {showCompli && (
                <div style={{ marginTop:'8px', padding:'8px 10px', background:'#0a0a0a', borderRadius:'4px', border:'1px solid #1e1e1e' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'6px' }}>{activePlan?.name}</div>
                  {compliance.weekBreakdown.map(w => (
                    <div key={w.week} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                      <div style={{ ...S.mono, fontSize:'9px', color:'#555', width:'32px' }}>W{w.week}</div>
                      <div style={{ ...S.mono, fontSize:'9px', color:'#888', flex:1 }}>{w.phase}</div>
                      <div style={{ display:'flex', gap:'2px' }}>
                        {Array(w.planned).fill(0).map((_, i) => (
                          <div key={i} style={{ width:'8px', height:'8px', borderRadius:'2px', background: i < w.logged ? '#5bc25b' : '#2a2a2a' }}/>
                        ))}
                      </div>
                      <div style={{ ...S.mono, fontSize:'9px', color: w.logged >= w.planned ? '#5bc25b' : w.logged >= w.planned * 0.6 ? '#f5c542' : '#e03030', width:'32px', textAlign:'right' }}>
                        {w.logged}/{w.planned}
                      </div>
                    </div>
                  ))}
                  <div style={{ ...S.mono, fontSize:'9px', color:'#555', marginTop:'6px', borderTop:'1px solid #1e1e1e', paddingTop:'6px' }}>
                    {compliance.totalLogged}/{compliance.totalPlanned} sessions · {compliance.pct}% overall
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Week notes for active plan */}
          {activePlan && (
            <div style={{ marginBottom:'12px' }}>
              <button
                onClick={() => setShowWeekNotes(s => !s)}
                style={{ display:'flex', alignItems:'center', gap:'8px', background:'transparent', border:'none', cursor:'pointer', padding:0 }}>
                <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em' }}>WEEK NOTES</div>
                <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600' }}>{activePlan.name}</div>
                {activePlan.versionTag && (
                  <span style={{ ...S.mono, fontSize:'9px', color:'#666', letterSpacing:'0.04em' }}>
                    [{activePlan.versionTag}]
                  </span>
                )}
                {/* v9.105.0 (Prompt BB) — Response status pill (coach view).
                    Yellow PENDING is the action signal for the coach: this
                    athlete saw the plan but hasn't accepted/declined yet. */}
                {(() => {
                  if (activePlan.accepted_at) {
                    return (
                      <span style={{ ...S.mono, fontSize:'9px', color:'#5bc25b', background:'#5bc25b22', border:'1px solid #5bc25b66', borderRadius:'3px', padding:'1px 6px', letterSpacing:'0.06em' }}>
                        ✓ ACCEPTED
                      </span>
                    )
                  }
                  if (activePlan.rejected_at) {
                    return (
                      <span style={{ ...S.mono, fontSize:'9px', color:'#888', background:'#88888822', border:'1px solid #88888866', borderRadius:'3px', padding:'1px 6px', letterSpacing:'0.06em' }}>
                        ✕ DECLINED
                      </span>
                    )
                  }
                  return (
                    <span style={{ ...S.mono, fontSize:'9px', color:'#f5c542', background:'#f5c54222', border:'1px solid #f5c54266', borderRadius:'3px', padding:'1px 6px', letterSpacing:'0.06em' }}>
                      PENDING
                    </span>
                  )
                })()}
                <span style={{ ...S.mono, fontSize:'9px', color:'#555' }}>{showWeekNotes ? '▲' : '▼'}</span>
              </button>
              {showWeekNotes && (
                <div style={{ marginTop:'8px', padding:'10px 12px', background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:'4px' }}>
                  {noteMsg && <div style={{ ...S.mono, fontSize:'10px', color: noteMsg.startsWith('⚠') ? '#e03030' : '#5bc25b', marginBottom:'8px' }}>{noteMsg}</div>}
                  {(Array.isArray(activePlan.weeks) ? activePlan.weeks : []).map((wk, i) => (
                    <div key={i} style={{ marginBottom:'8px', paddingBottom:'8px', borderBottom:'1px solid #111' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                        <span style={{ ...S.mono, fontSize:'9px', color:'#ff6600', width:'24px' }}>W{wk.week ?? i + 1}</span>
                        <span style={{ ...S.mono, fontSize:'9px', color:'#888', flex:1 }}>{wk.phase}</span>
                        {wk.coachNote && editingWeek !== i && (
                          <span style={{ ...S.mono, fontSize:'9px', color:'#5bc25b' }}>✓ note</span>
                        )}
                        <button
                          onClick={() => { setEditingWeek(editingWeek === i ? null : i); setWeekNoteDraft(wk.coachNote || '') }}
                          style={{ ...S.mono, fontSize:'8px', color:'#0064ff', background:'transparent', border:'1px solid #0064ff33', borderRadius:'3px', padding:'2px 6px', cursor:'pointer' }}>
                          {editingWeek === i ? 'cancel' : wk.coachNote ? 'edit' : '+ note'}
                        </button>
                      </div>
                      {wk.coachNote && editingWeek !== i && (
                        <div style={{ ...S.mono, fontSize:'10px', color:'#888', paddingLeft:'32px', lineHeight:1.5 }}>{wk.coachNote}</div>
                      )}
                      {editingWeek === i && (
                        <div style={{ display:'flex', gap:'6px', marginTop:'4px' }}>
                          <textarea
                            value={weekNoteDraft}
                            onChange={e => setWeekNoteDraft(e.target.value)}
                            rows={2}
                            placeholder={`Note for Week ${wk.week ?? i + 1}…`}
                            style={{ ...S.input, flex:1, fontSize:'10px', padding:'5px 7px', resize:'none', lineHeight:1.5 }}
                          />
                          <button
                            onClick={() => saveWeekNote(i)}
                            disabled={savingNote}
                            style={{ ...S.mono, fontSize:'9px', fontWeight:700, padding:'4px 10px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'3px', cursor:'pointer', alignSelf:'flex-start', opacity: savingNote ? 0.5 : 1 }}>
                            {savingNote ? '…' : 'SAVE'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Coach level override */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
            <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>ATHLETE LEVEL</div>
            <select
              value={levelOverride}
              onChange={e => handleLevelOverride(e.target.value)}
              style={{ ...S.select, fontSize:'10px', padding:'4px 8px', flex:'0 0 auto', minWidth:'200px' }}>
              <option value="">Use athlete's self-report ({data?.profile?.athleteLevel || '?'})</option>
              {LEVEL_OVERRIDE_OPTS.filter(Boolean).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {levelOverride && (
              <span style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.06em' }}>
                ▲ COACH OVERRIDE
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom: showForm ? '12px' : 0 }}>
            <button
              onClick={() => data && openAthleteReport({ name: athleteName, log: data.log, recovery: data.recovery, coachNotes: [], coachName })}
              style={{ ...S.mono, fontSize:'10px', fontWeight:600, padding:'5px 12px', background:'#ff6600', border:'none', color:'#fff', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em' }}>
              ↓ PDF REPORT
            </button>
            <button
              onClick={() => setShowForm(f => !f)}
              style={{ ...S.mono, fontSize:'10px', fontWeight:600, padding:'5px 12px', background: showForm ? '#0064ff22' : 'transparent', border:'1px solid #0064ff44', color:'#0064ff', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em' }}>
              {showForm ? '✕ CANCEL' : '↑ SEND PLAN'}
            </button>
          </div>

          {/* Send plan form */}
          {showForm && (
            <div style={{ marginTop:'12px', padding:'12px', background:'#0a1520', border:'1px solid #0064ff22', borderRadius:'5px' }}>
              <div style={{ ...S.mono, fontSize:'10px', color:'#0064ff', fontWeight:600, letterSpacing:'0.1em', marginBottom:'10px' }}>
                SEND TRAINING PLAN TO {athleteName.toUpperCase()}
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'8px' }}>
                <div style={{ flex:'2 1 200px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'3px' }}>PLAN NAME</div>
                  <input style={{ ...S.input, fontSize:'11px', padding:'6px 8px' }} value={planName} onChange={e => setPlanName(e.target.value)}/>
                </div>
                <div style={{ flex:'1 1 120px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'3px' }}>START DATE</div>
                  <input style={{ ...S.input, fontSize:'11px', padding:'6px 8px' }} type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
                <div style={{ flex:'1 1 120px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'3px' }}>GOAL</div>
                  <select style={{ ...S.select, fontSize:'11px', padding:'6px 8px' }} value={planGoal} onChange={e => setPlanGoal(e.target.value)}>
                    {PLAN_GOALS_COACH.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div style={{ flex:'1 1 80px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'3px' }}>WEEKS</div>
                  <input style={{ ...S.input, fontSize:'11px', padding:'6px 8px' }} type="number" min="4" max="24" value={planWeeks} onChange={e => setPlanWeeks(e.target.value)}/>
                </div>
                <div style={{ flex:'1 1 80px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'3px' }}>HRS/WK</div>
                  <input style={{ ...S.input, fontSize:'11px', padding:'6px 8px' }} type="number" min="3" max="30" step="0.5" value={planHours} onChange={e => setPlanHours(e.target.value)}/>
                </div>
                <div style={{ flex:'1 1 100px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'3px' }}>LEVEL</div>
                  <select style={{ ...S.select, fontSize:'11px', padding:'6px 8px' }} value={planLevel} onChange={e => setPlanLevel(e.target.value)}>
                    {PLAN_LEVELS_COACH.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={handleSendPlan}
                disabled={sending}
                style={{ ...S.mono, fontSize:'11px', fontWeight:700, padding:'7px 18px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'4px', cursor:'pointer', letterSpacing:'0.08em', opacity: sending ? 0.6 : 1 }}>
                {sending ? 'SENDING...' : `↑ SEND PLAN (${planWeeks}wk ${planGoal})`}
              </button>
              {sendMsg && (
                <div style={{ ...S.mono, fontSize:'10px', marginTop:'8px', color: sendMsg.startsWith('⚠') ? '#e03030' : '#5bc25b' }}>
                  {sendMsg}
                </div>
              )}
            </div>
          )}
          {/* Message thread */}
          <div style={{ marginTop:'12px' }}>
            <button
              onClick={openMessages}
              style={{ display:'flex', alignItems:'center', gap:'8px', background:'transparent', border:'1px solid #0064ff33', borderRadius:'4px', padding:'5px 10px', cursor:'pointer' }}>
              <span style={{ ...S.mono, fontSize:'9px', color:'#0064ff', letterSpacing:'0.08em' }}>✉ MESSAGES</span>
              {unreadFromAthlete > 0 && (
                <span style={{ background:'#0064ff', color:'#fff', borderRadius:'8px', fontSize:'9px', padding:'1px 6px', ...S.mono, fontWeight:700 }}>{unreadFromAthlete}</span>
              )}
              {messages.length > 0 && !unreadFromAthlete && (
                <span style={{ ...S.mono, fontSize:'9px', color:'#555' }}>{messages.length}</span>
              )}
              <span style={{ ...S.mono, fontSize:'9px', color:'#555' }}>{showMessages ? '▲' : '▼'}</span>
            </button>
            {showMessages && (
              <div style={{ marginTop:'8px', border:'1px solid #0064ff22', borderRadius:'5px', background:'#060c14', overflow:'hidden' }}>
                {/* Thread */}
                <div style={{ maxHeight:'200px', overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'8px' }}>
                  {messages.length === 0 ? (
                    <div style={{ ...S.mono, fontSize:'10px', color:'#555', textAlign:'center', padding:'16px 0' }}>No messages yet. Write below to start.</div>
                  ) : messages.map(m => (
                    <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: m.from === 'coach' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth:'80%', padding:'6px 10px', borderRadius:'8px', background: m.from === 'coach' ? '#ff660022' : '#0064ff22', border:`1px solid ${m.from === 'coach' ? '#ff660044' : '#0064ff44'}` }}>
                        <div style={{ ...S.mono, fontSize:'11px', color: m.from === 'coach' ? '#ff9944' : '#6699ff', lineHeight:1.5, wordBreak:'break-word' }}>{m.text}</div>
                        <div style={{ ...S.mono, fontSize:'8px', color:'#555', marginTop:'3px' }}>{new Date(m.ts).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Compose */}
                <div style={{ borderTop:'1px solid #0064ff22', padding:'8px 10px', display:'flex', gap:'8px' }}>
                  <textarea
                    value={msgDraft}
                    onChange={e => setMsgDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Write to athlete… (Enter to send)"
                    rows={2}
                    style={{ ...S.input, flex:1, fontSize:'11px', padding:'6px 8px', resize:'none', fontFamily:'inherit', lineHeight:1.5 }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!msgDraft.trim()}
                    style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'6px 12px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'4px', cursor:'pointer', opacity: msgDraft.trim() ? 1 : 0.4, alignSelf:'flex-end' }}>
                    SEND
                  </button>
                </div>
                <div style={{ ...S.mono, fontSize:'8px', color:'#444', padding:'4px 10px 6px', borderTop:'1px solid #0a1a20' }}>
                  Messages are stored locally. Export athlete JSON to share with athlete.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
