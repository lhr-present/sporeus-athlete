// ─── CoachSquadView.jsx — Coach squad overview with PMC metrics ────────────────
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { S } from '../styles.js'
import { generateDemoSquad, filterByTeam, DEMO_TEAMS, getTeams } from '../lib/squadUtils.js'
import { getTierSync, canAddAthlete, isFeatureGated, getUpgradePrompt } from '../lib/subscription.js'
import CTLChart from './charts/CTLChart.jsx'
import CoachMessage from './CoachMessage.jsx'
import { generateSquadDigest, wellnessAvg } from '../lib/coachDigest.js'
import { getReadinessLabel, getAthleteInsights } from '../lib/ruleInsights.js'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const YELLOW = '#f5c542'
const RED    = '#e03030'
const GREY   = '#555'

// ── Sort config ───────────────────────────────────────────────────────────────
const STATUS_ORDER = ['Overreaching','Detraining','Building','Peaking','Recovering','Maintaining']

function defaultSort(a, b) {
  const ai = STATUS_ORDER.indexOf(a.training_status)
  const bi = STATUS_ORDER.indexOf(b.training_status)
  if (ai !== bi) return ai - bi
  return a.display_name.localeCompare(b.display_name)
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function statusColor(s) {
  return { Overreaching: RED, Detraining: GREY, Building: BLUE,
           Peaking: ORANGE, Recovering: YELLOW, Maintaining: GREEN }[s] || GREY
}

function acwrColor(s) {
  return { optimal: GREEN, caution: YELLOW, danger: RED, low: GREY }[s] || GREY
}

function adherenceColor(pct) {
  if (pct >= 85) return GREEN
  if (pct >= 60) return YELLOW
  return RED
}

function tsbColor(v) {
  if (v > 10) return GREEN
  if (v >= -20) return YELLOW
  return RED
}

function readinessColor(score) {
  if (!score) return GREY
  return score >= 7 ? GREEN : score >= 4 ? YELLOW : RED
}

// Map HRV rMSSD to 1-10 readiness scale (simple: 20ms=1, 80ms=10, clamp)
function hrvToReadiness(hrv) {
  if (!hrv) return null
  return Math.round(Math.min(10, Math.max(1, (hrv - 15) / 7)))
}

function fmtDate(d) {
  if (!d) return '—'
  return d.slice(5)  // MM-DD
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TsbBar({ value }) {
  const pct = Math.max(-50, Math.min(50, value))
  const barWidth = Math.abs(pct) / 50 * 40  // max 40px
  const isPos = pct >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: tsbColor(value), minWidth: 32, textAlign: 'right' }}>
        {value > 0 ? '+' : ''}{value}
      </span>
      <span style={{
        display: 'inline-block', width: barWidth, height: 6, borderRadius: 2,
        background: tsbColor(value), opacity: 0.7,
      }} />
    </span>
  )
}

function ReadinessCircle({ score, size = 26 }) {
  if (score === null) return <span style={{ fontFamily: MONO, fontSize: 10, color: GREY }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${readinessColor(score)}`,
      fontFamily: MONO, fontSize: 10, fontWeight: 700,
      color: readinessColor(score),
    }}>
      {score}
    </span>
  )
}

// ── Note panel ────────────────────────────────────────────────────────────────
const NOTE_CATS = ['general','injury','wellness','technique','motivation']

function NotePanel({ athlete, coachId, onClose }) {
  const [notes, setNotes]       = useState([])
  const [body, setBody]         = useState('')
  const [category, setCategory] = useState('general')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (!supabase || !athlete?.athlete_id?.startsWith('demo-')) loadNotes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.athlete_id])

  async function loadNotes() {
    if (!supabase || !coachId) return
    const { data } = await supabase
      .from('coach_notes')
      .select('id, created_at, category, note')
      .eq('coach_id', coachId)
      .eq('athlete_id', athlete.athlete_id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setNotes(data)
  }

  async function saveNote() {
    if (!body.trim()) return
    setSaving(true)
    if (supabase && coachId && !athlete.athlete_id.startsWith('demo-')) {
      await supabase.from('coach_notes').insert({
        coach_id: coachId, athlete_id: athlete.athlete_id,
        category, note: body.trim(),
      })
      await loadNotes()
    } else {
      // Demo: store locally for session
      setNotes(prev => [{
        id: Date.now(), created_at: new Date().toISOString(),
        category, note: body.trim(),
      }, ...prev.slice(0, 4)])
    }
    setBody('')
    setSaving(false)
  }

  const catColor = { injury: RED, wellness: GREEN, technique: BLUE, motivation: ORANGE, general: GREY }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(320px, 100vw)',
      background: '#111', borderLeft: '1px solid #2a2a2a', zIndex: 300,
      display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ORANGE }}>
            NOTES — {athlete.display_name.toUpperCase()}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontFamily: MONO, fontSize: 16 }}>✕</button>
      </div>

      {/* Past notes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {notes.length === 0 && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#444' }}>No notes yet.</div>
        )}
        {notes.map(n => (
          <div key={n.id} style={{ marginBottom: 10, borderLeft: `3px solid ${catColor[n.category] || GREY}44`, paddingLeft: 8 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: catColor[n.category] || GREY, textTransform: 'uppercase' }}>
                {n.category || 'general'}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#444' }}>
                {n.created_at?.slice(0, 10)}
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#ccc', lineHeight: 1.5 }}>{n.note}</div>
          </div>
        ))}
      </div>

      {/* Add note */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #222' }}>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ ...S.input, marginBottom: 8, fontSize: 10, textTransform: 'uppercase' }}
        >
          {NOTE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add note…"
          rows={3}
          style={{
            ...S.input, width: '100%', resize: 'vertical', marginBottom: 8,
            fontFamily: MONO, fontSize: 11, lineHeight: 1.5,
          }}
        />
        <button
          onClick={saveNote}
          disabled={saving || !body.trim()}
          style={{
            width: '100%', padding: '8px', background: ORANGE, border: 'none',
            borderRadius: '3px', fontFamily: MONO, fontSize: 11, fontWeight: 700,
            color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: (!body.trim() || saving) ? 0.5 : 1,
          }}
        >
          {saving ? '…' : 'SAVE NOTE'}
        </button>
      </div>
    </div>
  )
}

// ── Expanded athlete row ──────────────────────────────────────────────────────
function ExpandedRow({ athlete, coachId, onNote }) {
  const [liveLog, setLiveLog] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (athlete._log) { setLiveLog(athlete._log); return }
    if (!supabase || !coachId) return
    setLoading(true)
    supabase
      .from('training_log')
      .select('date, tss, type, rpe')
      .eq('user_id', athlete.athlete_id)
      .order('date', { ascending: false })
      .limit(30)
      .then(({ data }) => { setLiveLog(data || []); setLoading(false) })
  }, [athlete.athlete_id, athlete._log, coachId])

  const recent3 = (liveLog || []).slice(0, 3)

  return (
    <div style={{ padding: '10px 14px 14px', background: 'var(--surface)', borderTop: '1px solid #1e1e1e' }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Mini PMC */}
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          {loading && <div style={{ fontFamily: MONO, fontSize: 9, color: '#444' }}>Loading…</div>}
          {liveLog && liveLog.length >= 5 && (
            <CTLChart log={liveLog} days={30} raceResults={[]} />
          )}
          {liveLog && liveLog.length < 5 && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#444' }}>
              CTL: {athlete.today_ctl} · ATL: {athlete.today_atl} · TSB: {athlete.today_tsb > 0 ? '+' : ''}{athlete.today_tsb}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 6 }}>
            RECENT SESSIONS
          </div>
          {recent3.length === 0 && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#444' }}>No sessions in last 30 days</div>
          )}
          {recent3.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#666', minWidth: 48 }}>{fmtDate(s.date)}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#888', minWidth: 70 }}>{(s.type || '—').slice(0, 12)}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: ORANGE }}>{s.tss ? `${Math.round(s.tss)} TSS` : '—'}</span>
              {s.rpe && <span style={{ fontFamily: MONO, fontSize: 9, color: '#555' }}>RPE {s.rpe}</span>}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => onNote(athlete)}
        style={{
          marginTop: 10, fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
          padding: '4px 10px', background: 'transparent', border: '1px solid #333',
          borderRadius: '2px', color: '#888', cursor: 'pointer',
        }}
      >
        + ADD NOTE
      </button>
    </div>
  )
}

// ── ChatPanel — AI coach chatbot (streaming) ──────────────────────────────────
const MAX_CHAT_MSGS = 10
const ANTHR_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHR_VER     = '2023-06-01'
const CHAT_MODEL    = 'claude-haiku-4-5-20251001'

async function streamCoachReply(squad, question, onChunk, onDone, onError) {
  const key = (() => { try { return localStorage.getItem('sporeus-anthropic-key') || '' } catch { return '' } })()
  if (!key) { onError('No API key — set it in Profile → AI Settings'); return }

  const system = `You are an expert endurance coach assistant. Answer questions about the squad data provided. Be concise and practical. Under 150 words unless more detail is clearly needed.`
  const user   = `Squad (${squad.length} athletes):\n${squad.map(a => `${a.display_name}: CTL=${a.today_ctl}, TSB=${a.today_tsb}, ACWR=${a.acwr_ratio ?? '—'}, Well=${a.adherence_pct}%`).join('\n')}\n\nQuestion: ${question}`

  try {
    const res = await fetch(ANTHR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHR_VER },
      body: JSON.stringify({ model: CHAT_MODEL, max_tokens: 512, stream: true, system, messages: [{ role: 'user', content: user }] }),
    })
    if (!res.ok) { let m = `API error ${res.status}`; try { const e = await res.json(); m = e?.error?.message || m } catch {}; onError(m); return }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6)
        if (raw === '[DONE]') { onDone(); return }
        try { const evt = JSON.parse(raw); if (evt.type === 'content_block_delta' && evt.delta?.text) onChunk(evt.delta.text) } catch {}
      }
    }
    onDone()
  } catch (e) { onError(e.message) }
}

function ChatPanel({ squad, isDemo }) {
  const [open, setOpen]         = useState(false)
  const [msgs, setMsgs]         = useState([])
  const [input, setInput]       = useState('')
  const [typing, setTyping]     = useState(false)
  const threadRef               = useRef(null)
  const hasKey = (() => { try { return !!localStorage.getItem('sporeus-anthropic-key') } catch { return false } })()

  const scrollDown = () => setTimeout(() => { threadRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }) }, 30)

  const send = () => {
    const q = input.trim()
    if (!q || typing) return
    setInput('')
    setMsgs(prev => [...prev.slice(-(MAX_CHAT_MSGS - 1)), { role: 'user', text: q }])
    setTyping(true)
    scrollDown()

    let reply = ''
    const appendChunk = chunk => {
      reply += chunk
      setMsgs(prev => {
        const copy = [...prev]
        if (copy[copy.length - 1]?.role === 'ai') copy[copy.length - 1] = { role: 'ai', text: reply }
        else copy.push({ role: 'ai', text: reply })
        return copy
      })
      scrollDown()
    }
    // seed empty AI bubble immediately
    setMsgs(prev => [...prev, { role: 'ai', text: '' }])

    streamCoachReply(squad, q, appendChunk,
      () => { setTyping(false); scrollDown() },
      err => {
        setMsgs(prev => {
          const copy = [...prev]
          if (copy[copy.length - 1]?.role === 'ai') copy[copy.length - 1] = { role: 'ai', text: `⚠ ${err}`, error: true }
          return copy
        })
        setTyping(false)
      }
    )
  }

  if (!open) {
    return (
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button
          onClick={() => setOpen(true)}
          style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '6px 16px', background: ORANGE, border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer' }}>
          ◈ ASK AI
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14, border: `1px solid ${ORANGE}44`, borderRadius: 4, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0d0d0d', borderBottom: '1px solid #1e1e1e' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>◈ AI COACH</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {msgs.length > 0 && <button onClick={() => setMsgs([])} style={{ fontFamily: MONO, fontSize: 9, background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}>CLEAR</button>}
          <button onClick={() => setOpen(false)} style={{ fontFamily: MONO, fontSize: 10, background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}>▼</button>
        </div>
      </div>

      {!hasKey && (
        <div style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 10, color: '#888', background: '#0a0a0a' }}>
          Set your Claude API key in Profile → AI Settings to enable this.
        </div>
      )}

      {hasKey && (
        <>
          {/* Thread */}
          <div ref={threadRef} style={{ maxHeight: 280, overflowY: 'auto', padding: '10px 12px', background: '#070707', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.length === 0 && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#444', textAlign: 'center', marginTop: 20 }}>
                Ask about your squad — readiness, load, who to push, who to rest.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  fontFamily: MONO, fontSize: 11, lineHeight: 1.7, padding: '6px 10px', borderRadius: 4, maxWidth: '85%',
                  background:  m.role === 'user' ? ORANGE : '#1a1a1a',
                  color:       m.error ? '#e03030' : m.role === 'user' ? '#fff' : '#d0d0d0',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.text || (typing && i === msgs.length - 1 ? <span style={{ opacity: 0.5 }}>●●●</span> : '')}
                </div>
              </div>
            ))}
            {typing && msgs[msgs.length - 1]?.text === '' && (
              <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
                {[0, 1, 2].map(j => (
                  <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#444', display: 'inline-block', animation: `sp-dot 1.2s ${j * 0.2}s infinite` }} />
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about your squad..."
              disabled={typing}
              style={{ flex: 1, fontFamily: MONO, fontSize: 11, background: 'transparent', border: 'none', outline: 'none', padding: '10px 12px', color: '#e0e0e0' }}
            />
            <button onClick={send} disabled={typing || !input.trim()} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '8px 16px', background: typing ? '#222' : ORANGE, border: 'none', color: typing ? '#555' : '#fff', cursor: typing ? 'not-allowed' : 'pointer' }}>
              {typing ? '…' : '↵'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CoachSquadView({ authUser }) {
  const [athletes, setAthletes]     = useState([])
  const [isDemo, setIsDemo]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const [sort, setSort]             = useState({ col: 'status', dir: 1 })
  const [expanded, setExpanded]     = useState(null)   // athlete_id
  const [noteFor, setNoteFor]       = useState(null)   // athlete object
  const [msgFor,  setMsgFor]        = useState(null)   // athlete object
  const [flagged, setFlagged]       = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sporeus-coach-flagged') || '[]')) }
    catch { return new Set() }
  })
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 640)
  const [digestOpen, setDigestOpen] = useState(false)
  const [digest, setDigest]         = useState(null)
  const [copied, setCopied]         = useState(false)
  const [compareIds, setCompareIds] = useState(new Set())
  const [teams, setTeams]           = useState([])
  const [activeTeamId, setActiveTeamId] = useState(() => {
    try { return localStorage.getItem('sporeus-active-team') || 'all' } catch { return 'all' }
  })
  // Realtime
  const [rtStatus, setRtStatus]   = useState('disconnected') // 'live' | 'reconnecting' | 'disconnected'
  const [lastUpdated, setLastUpdated] = useState(null)
  const [rtToast, setRtToast]     = useState('')
  const rtChannelRef              = useRef(null)
  const rtRetryRef                = useRef(0)
  const rtTimerRef                = useRef(null)

  // Missed check-in: flag athletes who haven't logged by cutoff hour (10am default)
  const [checkInCutoff] = useState(10)  // hour (0-23); persisted externally if needed
  const todayStr     = new Date().toISOString().slice(0, 10)
  const currentHour  = new Date().getHours()
  const pastCutoff   = currentHour >= checkInCutoff
  const missedCheckIn = (ath) => pastCutoff && ath.last_session_date !== todayStr

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // Load squad data
  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!isSupabaseReady() || !supabase || !authUser?.id) throw new Error('no-supabase')
      const { data, error } = await supabase.functions.invoke('squad-sync', {
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      })
      if (error) throw error
      if (!data || data.length === 0) throw new Error('empty')
      setAthletes(data)
      setIsDemo(false)
    } catch {
      setAthletes(generateDemoSquad())
      setIsDemo(true)
    }
    setLoading(false)
  }, [authUser?.id])

  useEffect(() => {
    load().then(() => {
      // Load teams (real or demo)
      if (authUser?.id) {
        getTeams(authUser.id).then(({ data }) => setTeams(data || []))
      }
    })
  }, [load, authUser?.id])

  // In demo mode, use DEMO_TEAMS
  useEffect(() => { if (isDemo) setTeams(DEMO_TEAMS) }, [isDemo])

  // ── Realtime subscriptions (coach + coach/club tier only) ─────────────────
  useEffect(() => {
    const isCoach = authUser?.role === 'coach' || !!authUser?.id
    const rtTierOk = !isFeatureGated('realtime_dashboard', tier)
    if (!isCoach || !rtTierOk || isDemo || !isSupabaseReady()) return

    let active = true

    function connectRealtime() {
      if (!active) return
      setRtStatus('reconnecting')

      // Unsubscribe previous channel
      if (rtChannelRef.current) {
        supabase.removeChannel(rtChannelRef.current)
        rtChannelRef.current = null
      }

      const channel = supabase.channel(`coach-${authUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'wellness_logs',
          filter: `user_id=in.(${athletes.map(a => a.athlete_id).join(',') || 'none'})`,
        }, (payload) => {
          const { new: row } = payload
          // Optimistic update: patch that athlete's last_session_date
          setAthletes(prev => prev.map(a =>
            a.athlete_id === row.user_id
              ? { ...a, last_session_date: row.date }
              : a
          ))
          const ath = athletes.find(a => a.athlete_id === row.user_id)
          const name = ath?.display_name || 'Athlete'
          const toast = `${name} just checked in — Fatigue ${row.soreness ?? '—'}/5, ACWR ${ath?.acwr_ratio ?? '—'}`
          setRtToast(toast)
          setTimeout(() => setRtToast(''), 6000)
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40)
          setLastUpdated(new Date().toLocaleTimeString())
        })
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'training_log',
          filter: `user_id=in.(${athletes.map(a => a.athlete_id).join(',') || 'none'})`,
        }, () => {
          setLastUpdated(new Date().toLocaleTimeString())
        })
        .subscribe((status) => {
          if (!active) return
          if (status === 'SUBSCRIBED') {
            setRtStatus('live')
            rtRetryRef.current = 0
            setLastUpdated(new Date().toLocaleTimeString())
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            setRtStatus('reconnecting')
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
            const delay = Math.min(1000 * Math.pow(2, rtRetryRef.current), 30000)
            rtRetryRef.current++
            clearTimeout(rtTimerRef.current)
            rtTimerRef.current = setTimeout(() => { if (active) connectRealtime() }, delay)
          }
        })

      rtChannelRef.current = channel
    }

    connectRealtime()

    return () => {
      active = false
      clearTimeout(rtTimerRef.current)
      if (rtChannelRef.current) {
        supabase.removeChannel(rtChannelRef.current)
        rtChannelRef.current = null
      }
      setRtStatus('disconnected')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, isDemo, athletes.length])

  // Persist flagged set
  const toggleFlag = useCallback((id) => {
    setFlagged(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem('sporeus-coach-flagged', JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  // Sorting
  const SORT_FNS = {
    name:       (a, b) => a.display_name.localeCompare(b.display_name),
    readiness:  (a, b) => (hrvToReadiness(b.last_hrv_score) || 0) - (hrvToReadiness(a.last_hrv_score) || 0),
    tsb:        (a, b) => (b.today_tsb || 0) - (a.today_tsb || 0),
    acwr:       (a, b) => (b.acwr_ratio || 0) - (a.acwr_ratio || 0),
    adherence:  (a, b) => (b.adherence_pct || 0) - (a.adherence_pct || 0),
    status:     defaultSort,
  }

  const sorted = useMemo(() => {
    const fn = SORT_FNS[sort.col] || defaultSort
    const activeTeam = activeTeamId === 'all' ? null : teams.find(t => t.id === activeTeamId) || null
    const filtered = filterByTeam(athletes, activeTeam)
    return [...filtered].sort((a, b) => fn(a, b) * sort.dir)
  }, [athletes, sort, activeTeamId, teams])

  function handleSort(col) {
    setSort(prev => prev.col === col ? { col, dir: -prev.dir } : { col, dir: 1 })
  }

  const sortArrow = col => sort.col === col ? (sort.dir === 1 ? ' ↓' : ' ↑') : ''

  const coachId = authUser?.id

  // Athlete comparison
  function toggleCompare(id) {
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (next.size < 5) { next.add(id) }
      return next
    })
  }

  // Digest
  function toggleDigest() {
    if (!digestOpen) setDigest(generateSquadDigest(sorted))
    setDigestOpen(prev => !prev)
    setCopied(false)
  }

  function copyDigest() {
    if (!digest?.text) return
    navigator.clipboard.writeText(digest.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  // Empty state (no athletes connected)
  const inviteCode = coachId ? coachId.slice(0, 8).toUpperCase() : null
  const tier = getTierSync()
  const inviteBlocked = !canAddAthlete(athletes.length, tier)
  const teamGated = isFeatureGated('multi_team', tier)

  // ── Column header helper ────────────────────────────────────────────────────
  function ColHdr({ col, children, style }) {
    return (
      <th
        onClick={() => handleSort(col)}
        style={{
          fontFamily: MONO, fontSize: 9, color: sort.col === col ? ORANGE : '#555',
          letterSpacing: '0.08em', padding: '6px 8px', cursor: 'pointer',
          whiteSpace: 'nowrap', userSelect: 'none', background: 'transparent',
          border: 'none', textAlign: 'left', ...style,
        }}
      >
        {children}{sortArrow(col)}
      </th>
    )
  }

  if (loading) {
    return (
      <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
        <div style={S.cardTitle}>SQUAD</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#555', padding: '12px 0' }}>Loading squad…</div>
      </div>
    )
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap', gap:'6px' }}>
        <div style={S.cardTitle}>SQUAD</div>
        {/* Realtime status */}
        {!isDemo && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontFamily: MONO, fontSize: 9, color: rtStatus === 'live' ? GREEN : rtStatus === 'reconnecting' ? YELLOW : '#555' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background: rtStatus === 'live' ? GREEN : rtStatus === 'reconnecting' ? YELLOW : '#333', display:'inline-block', flexShrink:0 }}/>
            {rtStatus === 'live' ? 'Live' : rtStatus === 'reconnecting' ? 'Reconnecting…' : '●'}
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
      {isDemo && (
        <div style={{
          fontFamily: MONO, fontSize: 10, padding: '6px 10px', borderRadius: '3px', marginBottom: '12px',
          background: 'rgba(245, 197, 66, 0.08)', border: '1px solid #f5c54244', color: '#f5c542',
        }}>
          DEMO DATA — connect real athletes to see live metrics
        </div>
      )}

      {/* Team selector — shown when teams exist and not gated */}
      {teamGated && teams.length > 0 && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: YELLOW, marginBottom: 8, padding: '4px 8px', border: `1px solid ${YELLOW}44`, borderRadius: 3 }}>
          {getUpgradePrompt('multi_team')}
        </div>
      )}
      {!teamGated && teams.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>TEAM</span>
          {[{ id: 'all', name: 'All', sport: '', age_group: '' }, ...teams].map(t => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTeamId(t.id)
                try { localStorage.setItem('sporeus-active-team', t.id) } catch {}
              }}
              style={{
                fontFamily: MONO, fontSize: 9, padding: '2px 9px', borderRadius: 2, cursor: 'pointer',
                background: activeTeamId === t.id ? ORANGE : 'transparent',
                color:      activeTeamId === t.id ? '#fff' : '#666',
                border:     `1px solid ${activeTeamId === t.id ? ORANGE : '#333'}`,
                fontWeight: activeTeamId === t.id ? 700 : 400,
              }}
            >
              {t.name}
              {t.age_group ? ` (${t.age_group})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Athlete limit gate */}
      {inviteBlocked && !isDemo && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: YELLOW, marginBottom: 8, padding: '4px 8px', border: `1px solid ${YELLOW}44`, borderRadius: 3 }}>
          {getUpgradePrompt('multi_team').replace('Multi-team management', 'Adding more athletes')}
        </div>
      )}

      {/* Empty state */}
      {!isDemo && athletes.length === 0 && inviteCode && !inviteBlocked && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#888', marginBottom: 8 }}>
            No athletes connected yet.
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#555', marginBottom: 6 }}>
            Share this invite code with your athletes:
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 16, fontWeight: 700, color: ORANGE,
            letterSpacing: '0.2em', padding: '8px 12px', background: '#1a1a1a',
            border: '1px solid #2a2a2a', borderRadius: 4, display: 'inline-block',
          }}>
            {inviteCode}
          </div>
        </div>
      )}

      {/* Athlete Comparison */}
      {compareIds.size >= 2 && (() => {
        const selected = sorted.filter(a => compareIds.has(a.athlete_id))
        const COLORS = ['#ff6600','#0064ff','#5bc25b','#f5c542','#b060ff']
        const maxCTL  = Math.max(...selected.map(a => a.today_ctl || 0), 1)
        const maxACWR = Math.max(...selected.map(a => a.acwr_ratio || 0), 0.1)
        const maxWell = 100
        const metrics = [
          { label: 'CTL',       get: a => a.today_ctl || 0,      fmt: v => String(Math.round(v)), max: maxCTL  },
          { label: 'ACWR',      get: a => a.acwr_ratio || 0,     fmt: v => v.toFixed(2),           max: maxACWR },
          { label: 'WELLNESS%', get: a => wellnessAvg(a),        fmt: v => `${v}%`,                max: maxWell },
          { label: 'TSB',       get: a => (a.today_tsb ?? 0) + 50, fmt: (v, a) => `${a.today_tsb > 0 ? '+' : ''}${a.today_tsb}`, max: 100 },
        ]
        return (
          <div style={{ marginBottom: 12, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>
                ◈ COMPARISON — {selected.length} ATHLETES
              </span>
              <button
                onClick={() => setCompareIds(new Set())}
                style={{ fontFamily: MONO, fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}
              >
                × CLEAR
              </button>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              {selected.map((a, i) => (
                <div key={a.athlete_id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i] }}/>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: COLORS[i] }}>{a.display_name}</span>
                </div>
              ))}
            </div>
            {/* Metric rows */}
            {metrics.map(m => (
              <div key={m.label} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: '#555', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                {selected.map((a, i) => {
                  const raw  = m.get(a)
                  const pct  = Math.min(100, Math.round(raw / m.max * 100))
                  return (
                    <div key={a.athlete_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: '#555', minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.display_name.split(' ')[0]}
                      </span>
                      <div style={{ flex: 1, height: 8, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: COLORS[i], borderRadius: 2, transition: 'width 0.3s' }}/>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: COLORS[i], minWidth: 40, textAlign: 'right' }}>
                        {m.fmt(raw, a)}
                      </span>
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
          <button
            onClick={toggleDigest}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
              padding: '5px 12px', background: 'transparent',
              border: `1px solid ${digestOpen ? ORANGE : '#333'}`,
              borderRadius: 3, color: digestOpen ? ORANGE : '#555',
              cursor: 'pointer',
            }}
          >
            ◈ WEEKLY DIGEST {digestOpen ? '▲' : '▼'}
          </button>

          {digestOpen && digest && (
            <div style={{
              marginTop: 8, background: '#0d0d0d',
              border: '1px solid #2a2a2a', borderRadius: 4, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>
                  {digest.date} · {digest.lines.length} ATHLETES
                </span>
                <button
                  onClick={copyDigest}
                  style={{
                    fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                    padding: '3px 10px', cursor: 'pointer',
                    background: copied ? GREEN : 'transparent',
                    border: `1px solid ${copied ? GREEN : '#444'}`,
                    borderRadius: 2, color: copied ? '#0a0a0a' : '#888',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  {copied ? '✓ COPIED' : 'COPY ALL'}
                </button>
              </div>
              <pre style={{
                fontFamily: MONO, fontSize: 10, color: '#aaa', lineHeight: 1.7,
                margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {digest.text}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Table / card stack */}
      {sorted.length > 0 && (
        isMobile ? (
          /* ── Mobile card stack ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(ath => {
              const readiness = hrvToReadiness(ath.last_hrv_score)
              const isFlagged = flagged.has(ath.athlete_id)
              const noCheckIn = missedCheckIn(ath)
              return (
                <div key={ath.athlete_id} style={{
                  background: 'var(--surface)', borderRadius: 4,
                  border: `1px solid ${isFlagged ? ORANGE : '#2a2a2a'}`,
                  borderLeft: `3px solid ${isFlagged ? ORANGE : noCheckIn ? YELLOW : '#2a2a2a'}`,
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setExpanded(expanded === ath.athlete_id ? null : ath.athlete_id)}
                    style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}
                  >
                    <ReadinessCircle score={readiness} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: '#eee', fontWeight: 600 }}>{ath.display_name}</span>
                        {(() => {
                          const rl = getReadinessLabel(ath.acwr_ratio, wellnessAvg(ath))
                          const alerts = getAthleteInsights({ acwr: ath.acwr_ratio, wellnessAvg: wellnessAvg(ath) })
                          const hasAlert = alerts.some(a => a.flag && a.key !== 'readiness')
                          return (
                            <>
                              <span style={{ fontFamily: MONO, fontSize: 8, color: rl.color, border: `1px solid ${rl.color}55`, borderRadius: 2, padding: '1px 5px', letterSpacing: '0.04em', fontWeight: 700 }}>
                                {rl.level.toUpperCase()}
                              </span>
                              {hasAlert && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED, display: 'inline-block', flexShrink: 0 }} title="Active alerts" />
                              )}
                            </>
                          )
                        })()}
                        {noCheckIn && (
                          <span style={{ fontFamily: MONO, fontSize: 8, color: YELLOW, border: `1px solid ${YELLOW}55`, borderRadius: 2, padding: '1px 5px' }}>
                            ⚠ NO CHECK-IN
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: statusColor(ath.training_status),
                          padding: '1px 6px', border: `1px solid ${statusColor(ath.training_status)}44`, borderRadius: 2 }}>
                          {ath.training_status}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: acwrColor(ath.acwr_status) }}>
                          ACWR {ath.acwr_ratio ?? '—'}
                        </span>
                        <TsbBar value={ath.today_tsb} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleFlag(ath.athlete_id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: isFlagged ? ORANGE : '#333' }}
                      >★</button>
                      <button
                        onClick={e => { e.stopPropagation(); setMsgFor(ath) }}
                        title={`Message ${ath.display_name}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#444', padding: 0 }}
                      >✉</button>
                      <input
                        type="checkbox"
                        checked={compareIds.has(ath.athlete_id)}
                        onChange={() => toggleCompare(ath.athlete_id)}
                        disabled={!compareIds.has(ath.athlete_id) && compareIds.size >= 5}
                        onClick={e => e.stopPropagation()}
                        style={{ accentColor: ORANGE, cursor: 'pointer', width: 12, height: 12 }}
                      />
                    </div>
                  </div>
                  {expanded === ath.athlete_id && (
                    <ExpandedRow athlete={ath} coachId={coachId} onNote={setNoteFor} />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Desktop table ── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: '#333', padding: '6px 8px' }} title="Select for comparison (max 5)">CMP</th>
                  <ColHdr col="name">ATHLETE</ColHdr>
                  <ColHdr col="readiness" style={{ textAlign: 'center' }}>READINESS</ColHdr>
                  <ColHdr col="tsb">TSB</ColHdr>
                  <ColHdr col="acwr">ACWR</ColHdr>
                  <ColHdr col="adherence">ADHERENCE</ColHdr>
                  <ColHdr col="status">STATUS</ColHdr>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: '#333', padding: '6px 8px' }}>FLAG</th>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: '#333', padding: '6px 8px' }}>MSG</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(ath => {
                  const readiness = hrvToReadiness(ath.last_hrv_score)
                  const isFlagged = flagged.has(ath.athlete_id)
                  const isExp = expanded === ath.athlete_id
                  const sessions7 = Math.round(ath.adherence_pct * 7 / 100)
                  const noCheckIn = missedCheckIn(ath)
                  return [
                    <tr
                      key={ath.athlete_id}
                      onClick={() => setExpanded(isExp ? null : ath.athlete_id)}
                      style={{
                        cursor: 'pointer', borderLeft: isFlagged ? `3px solid ${ORANGE}` : noCheckIn ? `3px solid ${YELLOW}` : '3px solid transparent',
                        background: isExp ? 'var(--surface)' : 'transparent',
                        borderBottom: '1px solid #1a1a1a',
                        transition: 'background 0.1s',
                      }}
                    >
                      {/* Compare checkbox */}
                      <td style={{ padding: '8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={compareIds.has(ath.athlete_id)}
                          onChange={() => toggleCompare(ath.athlete_id)}
                          disabled={!compareIds.has(ath.athlete_id) && compareIds.size >= 5}
                          style={{ accentColor: ORANGE, cursor: 'pointer', width: 12, height: 12 }}
                        />
                      </td>
                      {/* Athlete name */}
                      <td style={{ padding: '8px 8px 8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: '#eee', fontWeight: 600 }}>
                            {ath.display_name}
                          </span>
                          {(() => {
                            const rl = getReadinessLabel(ath.acwr_ratio, wellnessAvg(ath))
                            const alerts = getAthleteInsights({ acwr: ath.acwr_ratio, wellnessAvg: wellnessAvg(ath) })
                            const hasAlert = alerts.some(a => a.flag && a.key !== 'readiness')
                            return (
                              <>
                                <span style={{ fontFamily: MONO, fontSize: 8, color: rl.color, border: `1px solid ${rl.color}55`, borderRadius: 2, padding: '1px 5px', fontWeight: 700 }}>
                                  {rl.level.toUpperCase()}
                                </span>
                                {hasAlert && (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED, display: 'inline-block', flexShrink: 0 }} title="Active alerts" />
                                )}
                              </>
                            )
                          })()}
                          {noCheckIn && (
                            <span style={{ fontFamily: MONO, fontSize: 8, color: YELLOW, border: `1px solid ${YELLOW}55`, borderRadius: 2, padding: '1px 5px', letterSpacing: '0.05em' }}>
                              ⚠ NO CHECK-IN
                            </span>
                          )}
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: '#444' }}>
                          {fmtDate(ath.last_session_date)}
                        </span>
                      </td>
                      {/* Readiness */}
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <ReadinessCircle score={readiness} />
                      </td>
                      {/* TSB */}
                      <td style={{ padding: '8px' }}>
                        <TsbBar value={ath.today_tsb} />
                      </td>
                      {/* ACWR */}
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 9,
                          padding: '2px 7px', borderRadius: 2,
                          border: `1px solid ${acwrColor(ath.acwr_status)}44`,
                          color: acwrColor(ath.acwr_status),
                        }}>
                          {ath.acwr_ratio !== null ? ath.acwr_ratio.toFixed(2) : '—'}
                        </span>
                      </td>
                      {/* Adherence */}
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: adherenceColor(ath.adherence_pct) }}>
                          {sessions7}/7
                        </span>
                      </td>
                      {/* Status */}
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 9, fontWeight: 600,
                          padding: '2px 7px', borderRadius: 2,
                          border: `1px solid ${statusColor(ath.training_status)}44`,
                          color: statusColor(ath.training_status),
                        }}>
                          {ath.training_status}
                        </span>
                      </td>
                      {/* Flag */}
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); toggleFlag(ath.athlete_id) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 14, color: isFlagged ? ORANGE : '#2a2a2a',
                            padding: 0,
                          }}
                        >
                          ★
                        </button>
                      </td>
                      {/* Message */}
                      <td style={{ padding: '8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMsgFor(ath)}
                          title={`Message ${ath.display_name}`}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 13, color: '#2a2a2a',
                            padding: 0, lineHeight: 1,
                          }}
                        >
                          ✉
                        </button>
                      </td>
                    </tr>,
                    isExp && (
                      <tr key={ath.athlete_id + '-exp'}>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <ExpandedRow athlete={ath} coachId={coachId} onNote={setNoteFor} />
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* AI Coach chatbot — visible in demo mode or when authenticated as coach */}
      {(isDemo || authUser) && <ChatPanel squad={sorted} isDemo={isDemo} />}

      {/* Note panel overlay */}
      {noteFor && (
        <>
          <div
            onClick={() => setNoteFor(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299 }}
          />
          <NotePanel athlete={noteFor} coachId={coachId} onClose={() => setNoteFor(null)} />
        </>
      )}

      {/* Message panel overlay */}
      {msgFor && (
        <CoachMessage athlete={msgFor} coachId={coachId} onClose={() => setMsgFor(null)} />
      )}
    </div>
  )
}
