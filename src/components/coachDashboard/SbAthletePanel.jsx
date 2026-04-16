import { useState, useEffect } from 'react'
import { logger } from '../../lib/logger.js'
import { S } from '../../styles.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { generatePlan } from '../../lib/formulas.js'
import { openAthleteReport } from '../../lib/reportGenerator.js'
import { computeCompliance } from './helpers.jsx'

// ─── SbAthletePanel — expanded detail for a live (Supabase) athlete ──────────
const PLAN_GOALS_COACH = ['5K','10K','Half Marathon','Marathon','Cycling Event','General Fitness','Triathlon']
const PLAN_LEVELS_COACH = ['Beginner','Intermediate','Advanced']
const LEVEL_OVERRIDE_OPTS = ['', 'Beginner', 'Recreational', 'Competitive', 'Advanced', 'Elite']
const COACH_OVERRIDES_KEY = 'sporeus-coach-overrides'

function readOverrides() { try { return JSON.parse(localStorage.getItem(COACH_OVERRIDES_KEY)) || {} } catch { return {} } }
function saveOverrides(obj) { try { localStorage.setItem(COACH_OVERRIDES_KEY, JSON.stringify(obj)) } catch (e) { logger.warn('localStorage:', e.message) } }

export default function SbAthletePanel({ athleteId, athleteName, data, metrics, injRisk, loading, coachId, coachName }) {
  const [planName,   setPlanName]   = useState(`${athleteName} — Training Plan`)
  const [planGoal,   setPlanGoal]   = useState('Half Marathon')
  const [planWeeks,  setPlanWeeks]  = useState('12')
  const [planHours,  setPlanHours]  = useState('8')
  const [planLevel,  setPlanLevel]  = useState('Intermediate')
  const [startDate,  setStartDate]  = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [sending,  setSending]  = useState(false)
  const [sendMsg,  setSendMsg]  = useState('')
  const [showForm, setShowForm] = useState(false)
  const [activePlan,   setActivePlan]   = useState(null)   // most recent active plan for this athlete
  const [compliance,   setCompliance]   = useState(null)   // computeCompliance result
  const [showCompli,   setShowCompli]   = useState(false)  // expand compliance breakdown
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
      .select('id, name, goal, start_date, weeks, status')
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data: planRows }) => {
        const plan = planRows?.[0] || null
        setActivePlan(plan)
        if (plan) setCompliance(computeCompliance(plan, data?.log || []))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- data.log identity excluded; .length signals new entries
  }, [athleteId, data?.log?.length])

  const handleSendPlan = async () => {
    if (!isSupabaseReady() || !coachId || !athleteId) return
    setSending(true)
    const weeks = generatePlan(planGoal, planWeeks, planHours, planLevel.toLowerCase())
    const { error } = await supabase.from('coach_plans').insert({
      coach_id:   coachId,
      athlete_id: athleteId,
      name:       planName.trim() || `${athleteName} Plan`,
      goal:       planGoal,
      start_date: startDate,
      weeks:      weeks,
      status:     'active',
    })
    setSending(false)
    if (error) setSendMsg(`⚠ ${error.message}`)
    else { setSendMsg(`✓ Plan sent to ${athleteName}`); setShowForm(false) }
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

          {/* Plan compliance row */}
          {compliance && (
            <div style={{ marginBottom:'12px' }}>
              <button
                onClick={() => setShowCompli(s => !s)}
                style={{ display:'flex', alignItems:'center', gap:'8px', background:'transparent', border:'none', cursor:'pointer', padding:0 }}>
                <div style={{ ...S.mono, fontSize:'9px', color:'#555', letterSpacing:'0.08em' }}>COMPLIANCE</div>
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
