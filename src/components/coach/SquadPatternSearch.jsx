// ─── SquadPatternSearch.jsx — Coach-only semantic search across squad sessions ──
// Lets a coach find patterns across all athlete sessions using natural language.
// Calls embed-query with { squad: true, athlete_ids }.
// Gated: coach or club tier; free-tier coaches see an upgrade prompt.
//
// Props:
//   athleteIds    string[]        — array of athlete user IDs (from coach_athletes)
//   tier          'free'|'coach'|'club'
//   authUser      Supabase user object

import { useState, useRef, useCallback, useEffect, useContext } from 'react'
import { S } from '../../styles.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { isFeatureGated } from '../../lib/subscription.js'
import { logger } from '../../lib/logger.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'

const DEBOUNCE_MS   = 400
const MIN_QUERY_LEN = 3

const TYPE_COLOR = {
  run:  '#5bc25b', ride: '#0064ff', swim: '#4a90d9',
  row:  '#f5c542', gym:  '#ff6600', rest: '#555',
}
const typeColor = (t = '') => TYPE_COLOR[t.toLowerCase()] || '#888'

function SimDot({ similarity }) {
  const pct = Math.round((similarity ?? 0) * 100)
  const color = pct >= 70 ? '#5bc25b' : pct >= 45 ? '#f5c542' : '#888'
  return (
    <span style={{ fontSize:9, color, fontWeight:600 }}>{pct}%</span>
  )
}

export default function SquadPatternSearch({ athleteIds = [], tier = 'free', authUser }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])    // flat list with athlete_id + athlete_name
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [expanded, setExpanded] = useState(null)  // session_id of expanded row
  const { t } = useContext(LangCtx)

  const timerRef = useRef(null)
  const abortRef = useRef(null)

  const gated = isFeatureGated('squad_pattern_search', tier)
  const inputId = 'squad-pattern-search-input'

  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < MIN_QUERY_LEN) { setResults([]); return }
    if (!isSupabaseReady() || !authUser || !athleteIds.length) return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('embed-query', {
        body: {
          query:       q.trim(),
          k:           12,
          squad:       true,
          athlete_ids: athleteIds,
        },
      })

      if (ctrl.signal.aborted) return
      if (fnErr) throw new Error(fnErr.message || 'Search failed')

      setResults(data?.sessions || [])
    } catch (e) {
      if (!ctrl.signal.aborted) {
        logger.error('SquadPatternSearch:', e.message)
        setError(e.message || 'Search failed')
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [authUser, athleteIds])

  // Debounce
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length >= MIN_QUERY_LEN) {
      timerRef.current = setTimeout(() => search(query), DEBOUNCE_MS)
    } else {
      setResults([])
      setError(null)
    }
    return () => clearTimeout(timerRef.current)
  }, [query, search])

  // Group results by athlete_id for display
  const byAthlete = results.reduce((acc, s) => {
    const key = s.athlete_id || 'unknown'
    if (!acc[key]) acc[key] = { name: s.athlete_name || key.slice(0, 8), sessions: [] }
    acc[key].sessions.push(s)
    return acc
  }, {})

  // ── Render ──────────────────────────────────────────────────────────────────

  if (gated) {
    return (
      <div style={{ ...S.card, padding:'14px 16px', textAlign:'center' }}>
        <div style={{ color:'#f5c542', fontSize:11, marginBottom:8 }}>
          {t('squadSearchUpgrade')}
        </div>
        <a
          href="https://sporeus.com/upgrade"
          target="_blank"
          rel="noreferrer"
          style={{ color:'#ff6600', fontSize:11 }}
        >
          Upgrade at sporeus.com
        </a>
      </div>
    )
  }

  if (!athleteIds.length) {
    return (
      <div style={{ ...S.card, padding:'14px 16px', color:'#555', fontSize:11 }}>
        {t('squadSearchNoAthletes')}
      </div>
    )
  }

  return (
    <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid #222', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color:'#a78bfa', fontSize:11, fontWeight:700 }}>{t('squadPatternSearch')}</span>
        <span style={{ color:'#555', fontSize:10 }}>— {athleteIds.length} athletes</span>
      </div>

      {/* Search input */}
      <div style={{ padding:'8px 14px', borderBottom:'1px solid #1c1c1c' }}>
        <label htmlFor={inputId} style={{ ...S.label }}>
          {t('squadSearchLabel')}
        </label>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          <input
            id={inputId}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('squadSearchPlaceholder')}
            style={{ ...S.input, flex:1, fontSize:11 }}
          />
          {loading && <span style={{ fontSize:10, color:'#888' }}>…</span>}
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div style={{ padding:'8px 14px', color:'#e03030', fontSize:11 }}>
          {error}
        </div>
      )}
      {!loading && !error && query.length >= MIN_QUERY_LEN && results.length === 0 && (
        <div style={{ padding:'12px 14px', color:'#555', fontSize:11 }}>
          {t('squadSearchNoResults')}
        </div>
      )}

      {/* Results grouped by athlete */}
      {Object.entries(byAthlete).map(([athleteId, { name, sessions }]) => (
        <div key={athleteId} style={{ borderBottom:'1px solid #1c1c1c' }}>
          <div style={{ padding:'6px 14px', background:'#0d0d0d', fontSize:10, color:'#a78bfa', fontWeight:700, letterSpacing:'0.08em' }}>
            {name.toUpperCase()} — {sessions.length} match{sessions.length !== 1 ? 'es' : ''}
          </div>
          {sessions.map(session => (
            <div
              key={session.session_id}
              style={{ padding:'7px 14px', borderBottom:'1px solid #111', cursor:'pointer', background: expanded === session.session_id ? '#181818' : 'transparent' }}
              onClick={() => setExpanded(expanded === session.session_id ? null : session.session_id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') setExpanded(expanded === session.session_id ? null : session.session_id) }}
              aria-expanded={expanded === session.session_id}
            >
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:9, color: typeColor(session.type), fontWeight:700, textTransform:'uppercase', minWidth:32 }}>
                  {session.type || '—'}
                </span>
                <span style={{ fontSize:11, color:'var(--text)' }}>{session.date}</span>
                <span style={{ fontSize:10, color:'#888' }}>
                  {session.duration_min ? `${session.duration_min}min` : ''}
                  {session.tss ? ` TSS:${session.tss}` : ''}
                </span>
                <span style={{ marginLeft:'auto' }}>
                  <SimDot similarity={session.similarity} />
                </span>
              </div>

              {/* Expanded notes */}
              {expanded === session.session_id && session.notes && (
                <div style={{ marginTop:5, fontSize:10, color:'#888', paddingLeft:4, borderLeft:'2px solid #333', lineHeight:1.5 }}>
                  {session.notes.slice(0, 400)}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Footer */}
      {results.length > 0 && (
        <div style={{ padding:'6px 14px', fontSize:9, color:'#444' }}>
          {results.length} sessions matched · click to expand notes
        </div>
      )}
    </div>
  )
}
