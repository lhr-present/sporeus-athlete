// ─── CoachOverview.jsx — Coach's bird's-eye view of all connected athletes ────
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { predictInjuryRisk, computeRaceReadiness } from '../lib/intelligence.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const YELLOW = '#f5c542'
const RED    = '#e03030'

function daysBefore(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function computeLoad(log = []) {
  if (!log.length) return { ctl: 0, atl: 0, tsb: 0 }
  const sorted = [...log].sort((a, b) => (a.date > b.date ? 1 : -1))
  let ctl = 0, atl = 0
  for (const s of sorted) {
    const tss = s.tss || 0
    ctl = ctl + (tss - ctl) / 42
    atl = atl + (tss - atl) / 7
  }
  return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(ctl - atl) }
}

function loadTrend(log = []) {
  const d7 = daysBefore(7), d14 = daysBefore(14)
  const tss7 = log.filter(e => e.date >= d7).reduce((s, e) => s + (e.tss || 0), 0)
  const tssP7 = log.filter(e => e.date >= d14 && e.date < d7).reduce((s, e) => s + (e.tss || 0), 0)
  if (tssP7 === 0) return '→'
  const ratio = tss7 / tssP7
  return ratio > 1.1 ? '↑' : ratio < 0.9 ? '↓' : '→'
}

function riskColor(level) {
  return level === 'HIGH' ? RED : level === 'MODERATE' ? YELLOW : GREEN
}

export default function CoachOverview({ coachId, onSelectAthlete }) {
  const [athletes, setAthletes] = useState([])   // [{profile, link, log, recovery, metrics}]
  const [loading, setLoading]   = useState(true)
  const [notes, setNotes]       = useState({})   // {[athlete_id]: text}
  const [savingNote, setSavingNote] = useState(null)

  const load = useCallback(async () => {
    if (!supabase || !coachId) { setLoading(false); return }
    setLoading(true)

    // 1. Fetch linked athletes
    const { data: links } = await supabase
      .from('coach_athletes')
      .select('athlete_id, status, profiles!coach_athletes_athlete_id_fkey(id, display_name, email)')
      .eq('coach_id', coachId)
      .eq('status', 'active')

    if (!links?.length) { setLoading(false); return }

    const ids = links.map(l => l.athlete_id)

    // 2. Fetch last 90d training data for all athletes in parallel
    const [{ data: allLog }, { data: allRecovery }, { data: allNotes }] = await Promise.all([
      supabase.from('training_log').select('*').in('user_id', ids).gte('date', daysBefore(90)),
      supabase.from('recovery').select('*').in('user_id', ids).gte('date', daysBefore(30)),
      supabase.from('coach_notes').select('*').eq('coach_id', coachId).in('athlete_id', ids),
    ])

    // 3. Group by athlete
    const enriched = links.map(link => {
      const aid   = link.athlete_id
      const log   = (allLog || []).filter(e => e.user_id === aid)
      const rec   = (allRecovery || []).filter(e => e.user_id === aid)
      const metrics = computeLoad(log)
      const trend   = loadTrend(log)
      const lastSession = log.sort((a,b) => b.date.localeCompare(a.date))[0]?.date ?? null
      const daysSince = lastSession ? Math.floor((Date.now() - new Date(lastSession)) / 86400000) : 999
      const injRisk = predictInjuryRisk(log, rec, {})
      const readiness = computeRaceReadiness(log, rec, {}, null)
      const needsAttention = injRisk?.level === 'HIGH' || daysSince >= 5
      return { link, profile: link.profiles, log, recovery: rec, metrics, trend, lastSession, daysSince, injRisk, readiness, needsAttention }
    })

    // Sort: needs attention first, then by daysSince
    enriched.sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1
      return a.daysSince - b.daysSince
    })

    setAthletes(enriched)

    // Load notes
    const noteMap = {}
    ;(allNotes || []).forEach(n => { noteMap[n.athlete_id] = n.note })
    setNotes(noteMap)

    setLoading(false)
  }, [coachId])

  useEffect(() => { load() }, [load])

  async function saveNote(athleteId, text) {
    if (!supabase) return
    setSavingNote(athleteId)
    await supabase.from('coach_notes').upsert({
      coach_id: coachId, athlete_id: athleteId, note: text, updated_at: new Date().toISOString(),
    }, { onConflict: 'coach_id,athlete_id' })
    setSavingNote(null)
  }

  const attentionCount = athletes.filter(a => a.needsAttention).length

  if (loading) {
    return (
      <div style={{ fontFamily: MONO, padding: '40px 20px', textAlign: 'center', color: '#444', letterSpacing: '0.1em' }}>
        LOADING ATHLETES…
      </div>
    )
  }

  if (!athletes.length) {
    return (
      <div style={{ fontFamily: MONO, padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: '#444', marginBottom: '8px' }}>No connected athletes yet.</div>
        <div style={{ fontSize: '10px', color: '#333' }}>Generate an invite link in Coach Dashboard to connect athletes.</div>
      </div>
    )
  }

  return (
    <div className="sp-fade" style={{ fontFamily: MONO }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: BLUE, letterSpacing: '0.1em' }}>
          ◈ COACH OVERVIEW · {athletes.length} ATHLETES
        </div>
        <button onClick={load} style={{ fontSize: '9px', color: '#555', background: 'transparent', border: '1px solid #333', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontFamily: MONO }}>
          ↻ REFRESH
        </button>
      </div>

      {/* Alert banner */}
      {attentionCount > 0 && (
        <div style={{ background: `${RED}18`, border: `1px solid ${RED}44`, borderRadius: '6px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px' }}>⚠</span>
          <span style={{ fontSize: '11px', color: RED, fontWeight: 700 }}>
            {attentionCount} athlete{attentionCount > 1 ? 's' : ''} need{attentionCount === 1 ? 's' : ''} attention
            {' '}(HIGH injury risk or no session in 5+ days)
          </span>
        </div>
      )}

      {/* Athlete grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {athletes.map(({ link, profile, metrics, trend, lastSession, daysSince, injRisk, readiness, needsAttention }) => (
          <div
            key={link.athlete_id}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${needsAttention ? RED + '66' : 'var(--border)'}`,
              borderRadius: '8px', padding: '16px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onClick={() => onSelectAthlete?.(link.athlete_id)}
            onMouseOver={e => e.currentTarget.style.borderColor = BLUE}
            onMouseOut={e => e.currentTarget.style.borderColor = needsAttention ? RED + '66' : 'var(--border)'}
          >
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#e0e0e0', letterSpacing: '0.06em' }}>
                  {profile?.display_name || 'Athlete'}
                </div>
                <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
                  {lastSession ? `Last session: ${lastSession} (${daysSince}d ago)` : 'No sessions recorded'}
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: needsAttention ? RED : GREEN, flexShrink: 0 }} />
            </div>

            {/* Metrics row */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
              <Stat label="CTL" value={metrics.ctl} color={ORANGE} />
              <Stat label="7D TREND" value={trend} color={trend === '↑' ? GREEN : trend === '↓' ? YELLOW : '#888'} />
              <Stat label="INJURY" value={injRisk?.level ?? '—'} color={riskColor(injRisk?.level)} />
              {readiness?.score != null && (
                <Stat label="READINESS" value={`${readiness.score}%`} color={readiness.score >= 75 ? GREEN : readiness.score >= 50 ? YELLOW : RED} />
              )}
            </div>

            {/* Coach note */}
            <textarea
              placeholder="Coach note…"
              value={notes[link.athlete_id] ?? ''}
              onChange={e => setNotes(prev => ({ ...prev, [link.athlete_id]: e.target.value }))}
              onBlur={e => saveNote(link.athlete_id, e.target.value)}
              onClick={e => e.stopPropagation()}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: '1px solid #222',
                borderRadius: '3px', color: '#888', fontFamily: MONO, fontSize: '10px',
                padding: '6px 8px', resize: 'none', outline: 'none',
              }}
            />
            {savingNote === link.athlete_id && (
              <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>saving…</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: color || '#e0e0e0' }}>{value}</div>
      <div style={{ fontSize: '7px', color: '#555', letterSpacing: '0.08em', marginTop: '2px' }}>{label}</div>
    </div>
  )
}
