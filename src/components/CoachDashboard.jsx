import { useRef, useState, useEffect, useCallback, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { FREE_ATHLETE_LIMIT } from '../lib/formulas.js'
import { predictInjuryRisk } from '../lib/intelligence.js'
import { generateAthleteReportCard } from '../lib/digestEmail.js'

import { TODAY, daysBefore, computeAthleteMetrics, computeLoad } from './coachDashboard/helpers.jsx'
import CoachOnboarding from './coachDashboard/CoachOnboarding.jsx'
import TeamMetrics from './coachDashboard/TeamMetrics.jsx'
import PlanDistribution from './coachDashboard/PlanDistribution.jsx'
import AthleteCard from './coachDashboard/AthleteCard.jsx'
import AthleteComparison from './coachDashboard/AthleteComparison.jsx'
import CoachRegistration from './coachDashboard/CoachRegistration.jsx'
import GatingOverlay from './coachDashboard/GatingOverlay.jsx'
import SbAthletePanel from './coachDashboard/SbAthletePanel.jsx'
import SessionManager from './coach/SessionManager.jsx'
import SquadBenchmarkTable from './coach/SquadBenchmarkTable.jsx'
import { calcCompliancePct } from '../lib/sport/squadBenchmark.js'
import { getTierSync, isFeatureGated } from '../lib/subscription.js'
import TeamAnnouncements from './TeamAnnouncements.jsx'

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachDashboard({ authUser }) {
  const [roster, setRoster] = useLocalStorage('sporeus-coach-athletes', [])
  const [coachOnboarded, setCoachOnboarded] = useLocalStorage('sporeus-coach-onboarded', false)
  const [coachProfile, setCoachProfile] = useLocalStorage('sporeus-coach-profile', null)
  const [templates, setTemplates] = useLocalStorage('sporeus-coach-templates', [])
  const [expanded, setExpanded] = useLocalStorage('sporeus-coach-last-athlete', null)
  const [showMyAthletes, setShowMyAthletes] = useState(false)
  const [squadBenchmarkOpen, setSquadBenchmarkOpen] = useState(false)
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

  function handleReport(athlete) {
    const month = new Date().toISOString().slice(0, 7)
    const html = generateAthleteReportCard(
      { display_name: athlete.name || athlete.id, sport: athlete.sport || 'sport' },
      athlete.log || [],
      athlete.wellness || [],
      month
    )
    const blob = new Blob([html], { type: 'text/html' })
    window.open(URL.createObjectURL(blob))
  }

  // Summary stats
  const d14 = daysBefore(14)
  const connected   = roster.filter(a => a.coachId === myCoachId).length
  const needsAttn   = roster.filter(a => computeAthleteMetrics(a).needsAttention).length
  const injuredCnt  = roster.filter(a => (a.injuryLog || []).some(e => e.date >= d14)).length

  // Filtering
  const filteredRoster = showMyAthletes ? roster.filter(a => a.coachId === myCoachId) : roster

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
    // We store it in session state for AthleteDetailPanel — for now just a future hook
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
                    {isSelected && (
                      <SbAthletePanel
                        athleteId={row.athlete_id}
                        athleteName={profile?.display_name || 'Athlete'}
                        data={data}
                        metrics={metrics}
                        injRisk={injRisk}
                        loading={sbLoadingData}
                        coachId={sbCoachId}
                        coachName={coachProfile?.name || ''}
                      />
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
      <TeamMetrics roster={roster}/>

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

      {/* Session RSVP — only when Supabase coach is signed in */}
      {sbCoachId && (
        <div style={{ ...S.card, marginBottom:'16px' }}>
          <SessionManager coachId={sbCoachId} />
        </div>
      )}

      {/* Team Announcements — coach broadcast */}
      {sbCoachId && <TeamAnnouncements coachId={sbCoachId} isCoach={true} />}

      {/* Plan Templates */}
      <PlanDistribution templates={templates} setTemplates={setTemplates} onApply={applyTemplate}/>

      {/* Squad Benchmark */}
      <div style={{ ...S.card, marginBottom:'16px' }}>
        <button
          onClick={() => setSquadBenchmarkOpen(o => !o)}
          style={{ ...S.mono, width:'100%', textAlign:'left', background:'transparent', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}
        >
          <div style={{ ...S.cardTitle, margin:0 }}>SQUAD BENCHMARK</div>
          <span style={{ ...S.mono, fontSize:'12px', color:'#ff6600' }}>{squadBenchmarkOpen ? '▴' : '▾'}</span>
        </button>
        {squadBenchmarkOpen && (() => {
          const benchmarkAthletes = roster.map(athlete => {
            const metrics = computeAthleteMetrics(athlete)
            const recScores = (athlete.recovery || []).map(r => r.score).filter(s => typeof s === 'number')
            const wellness_avg = recScores.length > 0 ? Math.round(recScores.reduce((s, v) => s + v, 0) / recScores.length * 10) / 10 : null
            return {
              id: athlete.id,
              name: athlete.name || 'Athlete',
              ctl: computeLoad(athlete.log || []).ctl,
              acwr: metrics.acwr,
              compliance_pct: calcCompliancePct([], []),
              wellness_avg,
            }
          })
          return (
            <div style={{ marginTop:'12px' }}>
              <SquadBenchmarkTable athletes={benchmarkAthletes} />
            </div>
          )
        })()}
      </div>

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
                <button style={{ ...S.btnSec, padding:'6px 10px', fontSize:'11px' }} aria-label="Cancel note" onClick={() => { setQuickNoteId(null); setQuickNoteText('') }}>✕</button>
                <button style={{ ...S.btnSec, fontSize:'9px', padding:'2px 7px' }} onClick={() => handleReport(athlete)}>Report</button>
              </div>
            )}
            {quickNoteId !== athlete.id && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'4px' }}>
                <button style={{ ...S.btnSec, fontSize:'9px', padding:'2px 7px' }} onClick={() => handleReport(athlete)}>Report</button>
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
