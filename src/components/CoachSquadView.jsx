// ─── CoachSquadView.jsx — Squad overview orchestrator ────────────────────────
// Thin coordinator: imports sub-components and wires state.
// Sub-components: coach/ChatPanel, coach/TeamSelector, coach/AthleteRow,
//                 coach/NotePanel, coach/ExpandedRow
// Custom hook:    hooks/useRealtimeSquad
import { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { fetchSquad } from '../lib/db/athletes.js'
import { createInvite, getMyAthletes } from '../lib/inviteUtils.js'
import { supabase } from '../lib/supabase.js'
import { S } from '../styles.js'
import { generateDemoSquad, filterByTeam, DEMO_TEAMS, getTeams } from '../lib/squadUtils.js'
import { getTierSync, canAddAthlete, isFeatureGated, getUpgradePrompt } from '../lib/subscription.js'
import { generateSquadDigest, wellnessAvg } from '../lib/coachDigest.js'
import ChatPanel    from './coach/ChatPanel.jsx'
import TeamSelector from './coach/TeamSelector.jsx'
import AthleteRow   from './coach/AthleteRow.jsx'
import NotePanel    from './coach/NotePanel.jsx'
import ExpandedRow  from './coach/ExpandedRow.jsx'
import CoachMessage from './CoachMessage.jsx'
import { useRealtimeSquad }       from '../hooks/useRealtimeSquad.js'
import { useRealtimeSquadFeed }    from '../hooks/useRealtimeSquadFeed.js'
import { useSquadPresence }        from '../hooks/useSquadPresence.js'
import LiveSquadFeed               from './coach/LiveSquadFeed.jsx'
import EmptyState from './ui/EmptyState.jsx'
import ScienceTooltip from './ScienceTooltip.jsx'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const YELLOW = '#f5c542'
const COLORS = ['#ff6600','#0064ff','#5bc25b','#f5c542','#b060ff']

const STATUS_ORDER = ['Overreaching','Detraining','Building','Peaking','Recovering','Maintaining']
function defaultSort(a, b) {
  const d = STATUS_ORDER.indexOf(a.training_status) - STATUS_ORDER.indexOf(b.training_status)
  return d !== 0 ? d : a.display_name.localeCompare(b.display_name)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CoachSquadView({ authUser }) {
  const { t } = useContext(LangCtx)
  const [athletes,     setAthletes]    = useState([])
  const [isDemo,       setIsDemo]      = useState(false)
  const [loading,      setLoading]     = useState(true)
  const [sort,         setSort]        = useState({ col: 'status', dir: 1 })
  const [expanded,     setExpanded]    = useState(null)
  const [noteFor,      setNoteFor]     = useState(null)
  const [msgFor,       setMsgFor]      = useState(null)
  const [flagged,      setFlagged]     = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sporeus-coach-flagged') || '[]')) } catch (e) { logger.warn('localStorage:', e.message); return new Set() }
  })
  const [isMobile,     setIsMobile]    = useState(() => window.innerWidth < 640)
  const [digestOpen,   setDigestOpen]  = useState(false)
  const [digest,       setDigest]      = useState(null)
  const [copied,       setCopied]      = useState(false)
  const [compareIds,   setCompareIds]  = useState(new Set())
  const [teams,        setTeams]       = useState([])
  const [activeTeamId, setActiveTeamId] = useState(() => {
    try { return localStorage.getItem('sporeus-active-team') || 'all' } catch (e) { logger.warn('localStorage:', e.message); return 'all' }
  })

  const todayStr    = new Date().toISOString().slice(0, 10)
  const pastCutoff  = new Date().getHours() >= 10
  const missedCheckIn = a => pastCutoff && a.last_session_date !== todayStr

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!authUser?.id) throw new Error('no-supabase')
      const { data, error } = await fetchSquad()
      if (error || !data?.length) throw new Error('empty')
      setAthletes(data); setIsDemo(false)
    } catch (e) {
      logger.warn('db:', e.message)
      setAthletes(generateDemoSquad()); setIsDemo(true)
    }
    setLoading(false)
  }, [authUser?.id])

  useEffect(() => {
    load().then(() => {
      if (authUser?.id) getTeams(authUser.id).then(({ data }) => setTeams(data || []))
    })
  }, [load, authUser?.id])
  useEffect(() => { if (isDemo) setTeams(DEMO_TEAMS) }, [isDemo])

  // ── Realtime ──────────────────────────────────────────────────────────────────
  const { rtStatus, lastUpdated, rtToast } = useRealtimeSquad({
    authUser, isDemo, athletes,
    onUpdate: (athleteId, newDate) => setAthletes(prev => prev.map(a =>
      a.athlete_id === athleteId ? { ...a, last_session_date: newDate } : a
    )),
  })

  const { feedEvents, feedStatus } = useRealtimeSquadFeed({
    coachId:  authUser?.id,
    athletes: athletes,
    enabled:  !isDemo && !!authUser?.id,
  })

  const { presenceMap } = useSquadPresence({
    coachId: authUser?.id,
    role:    'coach',
  })

  // ── Sort + filter ─────────────────────────────────────────────────────────────
  const SORT_FNS = {
    name:      (a, b) => a.display_name.localeCompare(b.display_name),
    readiness: (a, b) => (b.last_hrv_score || 0) - (a.last_hrv_score || 0),
    tsb:       (a, b) => (b.today_tsb || 0) - (a.today_tsb || 0),
    acwr:      (a, b) => (b.acwr_ratio || 0) - (a.acwr_ratio || 0),
    adherence: (a, b) => (b.adherence_pct || 0) - (a.adherence_pct || 0),
    status:    defaultSort,
  }
  const sorted = useMemo(() => {
    const fn      = SORT_FNS[sort.col] || defaultSort
    const activeTeam = activeTeamId === 'all' ? null : teams.find(t => t.id === activeTeamId) || null
    return [...filterByTeam(athletes, activeTeam)].sort((a, b) => fn(a, b) * sort.dir)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- SORT_FNS is a module-level constant
  }, [athletes, sort, activeTeamId, teams])

  const handleSort = col => setSort(prev => prev.col === col ? { col, dir: -prev.dir } : { col, dir: 1 })
  const sortArrow  = col => sort.col === col ? (sort.dir === 1 ? ' ↓' : ' ↑') : ''

  const toggleFlag    = id => setFlagged(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    try { localStorage.setItem('sporeus-coach-flagged', JSON.stringify([...next])) } catch (e) { logger.warn('localStorage:', e.message) }
    return next
  })
  const toggleCompare = id => setCompareIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else if (next.size < 5) next.add(id)
    return next
  })

  const coachId       = authUser?.id
  const tier          = getTierSync()
  const inviteBlocked = !canAddAthlete(athletes.length, tier)
  const teamGated     = isFeatureGated('multi_team', tier)
  const inviteCode    = coachId ? coachId.slice(0, 8).toUpperCase() : null

  // ── Invite link generation ────────────────────────────────────────────────────
  const [inviteBusy,    setInviteBusy]    = useState(false)
  const [inviteToast,   setInviteToast]   = useState(null)  // { msg, ok }
  const [connectedCount, setConnectedCount] = useState(null)
  const inviteToastTimer = useRef(null)

  useEffect(() => {
    if (!coachId || !supabase) return
    getMyAthletes(supabase, coachId).then(ids => setConnectedCount(ids.length))
  }, [coachId])

  const handleGenerateInvite = useCallback(async () => {
    if (!coachId || inviteBusy || !supabase) return
    setInviteBusy(true)
    const result = await createInvite(supabase, coachId)
    setInviteBusy(false)
    if (result.error) {
      setInviteToast({ msg: `✗ Failed to generate link — ${result.error}`, ok: false })
    } else {
      try { await navigator.clipboard.writeText(result.inviteUrl) } catch (e) { logger.warn('share:', e.message) }
      setInviteToast({ msg: '✓ Invite link copied — expires in 7 days', ok: true })
      setConnectedCount(c => c) // refresh count after next load
    }
    clearTimeout(inviteToastTimer.current)
    inviteToastTimer.current = setTimeout(() => setInviteToast(null), 4000)
  }, [coachId, inviteBusy])

  function ColHdr({ col, children, style }) {
    return (
      <th onClick={() => handleSort(col)} style={{ fontFamily: MONO, fontSize: 9, color: sort.col === col ? ORANGE : '#555', letterSpacing: '0.08em', padding: '6px 8px', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', background: 'transparent', border: 'none', textAlign: 'left', ...style }}>
        {children}{sortArrow(col)}
      </th>
    )
  }

  if (loading) return (
    <div className="sp-card" style={{ ...S.card }}>
      <div style={S.cardTitle}>{t('squadTitle')}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: '#555', padding: '12px 0' }}>{t('loadingSquad')}</div>
    </div>
  )

  const comparisonSelected = sorted.filter(a => compareIds.has(a.athlete_id))

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      {/* Invite toast */}
      {inviteToast && (
        <div style={{ position:'fixed', top:16, right:16, zIndex:20001, fontFamily:MONO, fontSize:10, padding:'8px 14px', borderRadius:4, border:`1px solid ${inviteToast.ok ? GREEN : '#e03030'}44`, background: inviteToast.ok ? `${GREEN}11` : '#e0303011', color: inviteToast.ok ? GREEN : '#e03030', boxShadow:'0 4px 16px rgba(0,0,0,0.4)', whiteSpace:'nowrap' }}>
          {inviteToast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap', gap:'6px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={S.cardTitle}>{t('squadTitle')}</div>
          {connectedCount !== null && (
            <span style={{ fontFamily:MONO, fontSize:9, color:'#555', letterSpacing:'0.08em' }}>
              {connectedCount} {t('connected')}
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {!isDemo && !inviteBlocked && coachId && (
            <button
              onClick={handleGenerateInvite}
              disabled={inviteBusy}
              style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.08em', padding:'5px 12px', background:'transparent', border:`1px solid ${ORANGE}`, borderRadius:3, color:ORANGE, cursor:inviteBusy ? 'not-allowed' : 'pointer', opacity:inviteBusy ? 0.6 : 1, whiteSpace:'nowrap' }}>
              {inviteBusy ? '…' : t('inviteLink')}
            </button>
          )}
        </div>
        {!isDemo && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontFamily: MONO, fontSize: 9, color: rtStatus === 'live' ? GREEN : rtStatus === 'reconnecting' ? YELLOW : '#555' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background: rtStatus === 'live' ? GREEN : rtStatus === 'reconnecting' ? YELLOW : '#333', display:'inline-block' }}/>
            {rtStatus === 'live' ? t('rtLive') : rtStatus === 'reconnecting' ? t('rtReconnecting') : '●'}
            {lastUpdated && rtStatus === 'live' && <span style={{ color:'#444' }}>· {lastUpdated}</span>}
          </div>
        )}
      </div>

      {/* Realtime toast */}
      {rtToast && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, padding: '5px 10px', borderRadius: 3, border: `1px solid ${GREEN}44`, background: `${GREEN}11`, marginBottom: 8 }}>
          ◉ {rtToast}
        </div>
      )}

      {/* Demo banner */}
      {isDemo && <EmptyState variant="warn" body={t('demoDataWarning')} />}

      {/* Tier gates */}
      {inviteBlocked && !isDemo && <EmptyState variant="warn" body={getUpgradePrompt('multi_team').replace('Multi-team management', 'Adding more athletes')} />}

      {/* Team selector */}
      <TeamSelector
        teams={teams} activeTeamId={activeTeamId}
        onSelect={id => { setActiveTeamId(id); try { localStorage.setItem('sporeus-active-team', id) } catch (e) { logger.warn('localStorage:', e.message) } }}
        gated={teamGated && teams.length > 0} upgradeMsg={getUpgradePrompt('multi_team')}
      />

      {/* Empty state */}
      {!isDemo && athletes.length === 0 && inviteCode && !inviteBlocked && (
        <EmptyState variant="empty" body={t('noAthletesYet')}>
          <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: ORANGE, letterSpacing: '0.2em', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, display: 'inline-block' }}>{inviteCode}</div>
        </EmptyState>
      )}

      {/* Athlete Comparison */}
      {compareIds.size >= 2 && comparisonSelected.length >= 2 && (() => {
        const maxCTL = Math.max(...comparisonSelected.map(a => a.today_ctl || 0), 1)
        const maxACWR = Math.max(...comparisonSelected.map(a => a.acwr_ratio || 0), 0.1)
        const metrics = [
          { label:'CTL',        get: a => a.today_ctl || 0,         fmt: v => String(Math.round(v)),  max: maxCTL  },
          { label:'ACWR',       get: a => a.acwr_ratio || 0,        fmt: v => v.toFixed(2),            max: maxACWR },
          { label:'WELLNESS%',  get: a => wellnessAvg(a),           fmt: v => `${v}%`,                 max: 100 },
          { label:'TSB',        get: a => (a.today_tsb ?? 0) + 50,  fmt: (_, a) => `${a.today_tsb > 0 ? '+' : ''}${a.today_tsb}`, max: 100 },
        ]
        return (
          <div style={{ marginBottom: 12, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>◈ COMPARISON — {comparisonSelected.length} ATHLETES</span>
              <button onClick={() => setCompareIds(new Set())} style={{ fontFamily: MONO, fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>× CLEAR</button>
            </div>
            <div style={{ display:'flex', gap: 10, flexWrap:'wrap', marginBottom: 10 }}>
              {comparisonSelected.map((a, i) => (
                <div key={a.athlete_id} style={{ display:'flex', alignItems:'center', gap: 4 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: COLORS[i] }}/>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: COLORS[i] }}>{a.display_name}</span>
                </div>
              ))}
            </div>
            {metrics.map(m => (
              <div key={m.label} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: '#555', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                {comparisonSelected.map((a, i) => {
                  const raw = m.get(a)
                  const pct = Math.min(100, Math.round(raw / m.max * 100))
                  return (
                    <div key={a.athlete_id} style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: '#555', minWidth: 90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.display_name.split(' ')[0]}</span>
                      <div style={{ flex:1, height:8, background:'#1a1a1a', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background: COLORS[i], borderRadius:2, transition:'width 0.3s' }}/>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: COLORS[i], minWidth: 40, textAlign:'right' }}>{m.fmt(raw, a)}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })()}

      {/* Weekly Digest */}
      {sorted.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => { if (!digestOpen) setDigest(generateSquadDigest(sorted)); setDigestOpen(p => !p); setCopied(false) }}
            style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', padding: '5px 12px', background: 'transparent', border: `1px solid ${digestOpen ? ORANGE : '#333'}`, borderRadius: 3, color: digestOpen ? ORANGE : '#555', cursor: 'pointer' }}>
            {t('weeklyDigest')} {digestOpen ? '▲' : '▼'}
          </button>
          {digestOpen && digest && (
            <div style={{ marginTop: 8, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#555' }}>{digest.date} · {digest.lines.length} ATHLETES</span>
                <button onClick={() => { navigator.clipboard?.writeText(digest.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {}) }}
                  style={{ fontFamily: MONO, fontSize: 9, padding: '3px 10px', cursor:'pointer', background: copied ? GREEN : 'transparent', border: `1px solid ${copied ? GREEN : '#444'}`, borderRadius:2, color: copied ? '#0a0a0a' : '#888' }}>
                  {copied ? t('copied') : t('copyAll')}
                </button>
              </div>
              <pre style={{ fontFamily: MONO, fontSize: 10, color: '#aaa', lineHeight: 1.7, margin: 0, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{digest.text}</pre>
            </div>
          )}
        </div>
      )}

      {/* Athlete table / card stack */}
      {sorted.length > 0 && (
        isMobile ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sorted.map(ath => (
              <AthleteRow key={ath.athlete_id}
                ath={ath} isMobile={true}
                isExpanded={expanded === ath.athlete_id}
                onExpand={() => setExpanded(expanded === ath.athlete_id ? null : ath.athlete_id)}
                isFlagged={flagged.has(ath.athlete_id)} onFlag={() => toggleFlag(ath.athlete_id)}
                inCompare={compareIds.has(ath.athlete_id)} compareAtMax={!compareIds.has(ath.athlete_id) && compareIds.size >= 5}
                onCompare={() => toggleCompare(ath.athlete_id)}
                onMessage={() => setMsgFor(ath)}
                noCheckIn={missedCheckIn(ath)}
              >
                <ExpandedRow athlete={ath} coachId={coachId} onNote={setNoteFor} />
              </AthleteRow>
            ))}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #222' }}>
                  <th style={{ fontFamily: MONO, fontSize: 9, color:'#333', padding:'6px 8px' }} title="Compare (max 5)">{t('squadColCompare')}</th>
                  <ColHdr col="name">{t('squadColAthlete')}</ColHdr>
                  <ColHdr col="readiness" style={{ textAlign:'center' }}>{t('squadColReadiness')}</ColHdr>
                  <ColHdr col="tsb">{t('squadColTSB')}</ColHdr>
                  <ColHdr col="acwr">
                    <ScienceTooltip anchor="2-acwr--acutechronic-workload-ratio" label="ACWR" short="Acute:Chronic Workload Ratio — Hulin 2016. Optimal: 0.8–1.3.">{t('squadColACWR')}</ScienceTooltip>
                  </ColHdr>
                  <ColHdr col="adherence">{t('squadColAdherence')}</ColHdr>
                  <ColHdr col="status">{t('squadColStatus')}</ColHdr>
                  <th style={{ fontFamily: MONO, fontSize: 9, color:'#333', padding:'6px 8px' }}>{t('squadColFlag')}</th>
                  <th style={{ fontFamily: MONO, fontSize: 9, color:'#333', padding:'6px 8px' }}>{t('squadColMsg')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(ath => (
                  <AthleteRow key={ath.athlete_id}
                    ath={ath} isMobile={false}
                    isExpanded={expanded === ath.athlete_id}
                    onExpand={() => setExpanded(expanded === ath.athlete_id ? null : ath.athlete_id)}
                    isFlagged={flagged.has(ath.athlete_id)} onFlag={() => toggleFlag(ath.athlete_id)}
                    inCompare={compareIds.has(ath.athlete_id)} compareAtMax={!compareIds.has(ath.athlete_id) && compareIds.size >= 5}
                    onCompare={() => toggleCompare(ath.athlete_id)}
                    onMessage={() => setMsgFor(ath)}
                    noCheckIn={missedCheckIn(ath)}
                  >
                    <ExpandedRow athlete={ath} coachId={coachId} onNote={setNoteFor} />
                  </AthleteRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Live squad feed + presence */}
      {!isDemo && authUser && (
        <LiveSquadFeed
          feedEvents={feedEvents}
          feedStatus={feedStatus}
          presenceMap={presenceMap}
          athletes={sorted}
        />
      )}

      {/* AI Coach chatbot */}
      {(isDemo || authUser) && <ChatPanel squad={sorted} isDemo={isDemo} />}

      {/* Note panel overlay */}
      {noteFor && (
        <>
          <div onClick={() => setNoteFor(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:299 }} />
          <NotePanel athlete={noteFor} coachId={coachId} onClose={() => setNoteFor(null)} />
        </>
      )}

      {/* Message panel */}
      {msgFor && <CoachMessage athlete={msgFor} coachId={coachId} onClose={() => setMsgFor(null)} />}
    </div>
  )
}
