// ─── SemanticSearch.jsx — Semantic session search powered by pgvector ─────────
// Opens on Ctrl+Shift+K or via the show prop.
// Calls embed-query edge function → returns top-k sessions by cosine similarity.
// Gated: coach or club tier required (free tier sees upgrade prompt).
//
// Props:
//   show          boolean         — controlled open state
//   onClose       () => void
//   onJumpToSession (sessionId: string) => void — called when user selects a result
//   tier          'free'|'coach'|'club'
//   authUser      Supabase user object

import { useState, useEffect, useRef, useCallback } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { S } from '../styles.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { isFeatureGated } from '../lib/subscription.js'
import { injectCitations } from '../lib/ragPrompts.js'
import { logger } from '../lib/logger.js'

const DEBOUNCE_MS  = 350
const MIN_QUERY_LEN = 3

// Session type → color mapping
const TYPE_COLOR = {
  run:    '#5bc25b',
  ride:   '#0064ff',
  swim:   '#4a90d9',
  row:    '#f5c542',
  hike:   '#a78bfa',
  gym:    '#ff6600',
  rest:   '#666',
}

function typeColor(type = '') {
  return TYPE_COLOR[type.toLowerCase()] || '#888'
}

function simBar(similarity) {
  const pct = Math.round((similarity ?? 0) * 100)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9, color:'#888' }}>
      <span style={{
        display:         'inline-block',
        width:           Math.max(2, pct * 0.4),
        height:          4,
        background:      pct >= 70 ? '#5bc25b' : pct >= 45 ? '#f5c542' : '#555',
        borderRadius:    2,
        verticalAlign:   'middle',
      }} />
      {pct}%
    </span>
  )
}

export default function SemanticSearch({ show, onClose, onJumpToSession, tier = 'free', authUser }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [sel,      setSel]      = useState(0)

  const inputRef   = useRef(null)
  const panelRef   = useRef(null)
  const timerRef   = useRef(null)
  const abortRef   = useRef(null)

  useFocusTrap(panelRef, { onEscape: onClose })

  const gated = isFeatureGated('semantic_search', tier)

  // Focus input on open
  useEffect(() => {
    if (show) {
      setQuery(''); setResults([]); setError(null); setSel(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [show])

  // Ctrl+Shift+K global shortcut
  useEffect(() => {
    function handler(e) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!show) return  // parent controls open state; this just prevents default
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [show])

  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < MIN_QUERY_LEN) { setResults([]); return }
    if (!isSupabaseReady() || !authUser) return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('embed-query', {
        body: { query: q.trim(), k: 8 },
      })

      if (ctrl.signal.aborted) return
      if (fnErr) throw new Error(fnErr.message || 'Search failed')

      setResults(data?.sessions || [])
      setSel(0)
    } catch (e) {
      if (!ctrl.signal.aborted) {
        logger.error('SemanticSearch:', e.message)
        setError(e.message || 'Search failed')
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [authUser])

  // Debounce input
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length >= MIN_QUERY_LEN) {
      timerRef.current = setTimeout(() => search(query), DEBOUNCE_MS)
    } else {
      setResults([])
    }
    return () => clearTimeout(timerRef.current)
  }, [query, search])

  // Keyboard navigation
  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[sel]) selectResult(results[sel])
    if (e.key === 'Escape') onClose()
  }

  function selectResult(session) {
    onJumpToSession?.(session.session_id)
    onClose()
  }

  if (!show) return null

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'10vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Semantic search"
        aria-modal="true"
        style={{ ...S.card, width:'min(640px, 95vw)', maxHeight:'70vh', display:'flex', flexDirection:'column', padding:0, overflow:'hidden', border:'1px solid #333' }}
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderBottom:'1px solid #222' }}>
          <span style={{ color:'#ff6600', fontSize:13, fontWeight:700 }}>&#x2318;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions by meaning… (e.g. 'hard interval week')"
            aria-label="Semantic search query"
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontFamily:'IBM Plex Mono, monospace', fontSize:12, padding:0 }}
          />
          {loading && (
            <span style={{ fontSize:10, color:'#888' }}>searching…</span>
          )}
          <button
            onClick={onClose}
            aria-label="Close semantic search"
            style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:16, lineHeight:1, padding:0 }}
          >×</button>
        </div>

        {/* Upgrade gate */}
        {gated && (
          <div style={{ padding:'20px 16px', color:'#f5c542', fontSize:11, textAlign:'center' }}>
            Semantic search requires a Coach or Club plan.{' '}
            <a href="https://sporeus.com/upgrade" target="_blank" rel="noreferrer" style={{ color:'#ff6600' }}>Upgrade</a>
          </div>
        )}

        {/* Results */}
        {!gated && (
          <div style={{ overflowY:'auto', flex:1 }}>
            {error && (
              <div style={{ padding:'10px 14px', color:'#e03030', fontSize:11 }}>
                {error}
              </div>
            )}

            {!loading && !error && query.length >= MIN_QUERY_LEN && results.length === 0 && (
              <div style={{ padding:'16px 14px', color:'#666', fontSize:11 }}>
                No matching sessions found.
              </div>
            )}

            {!loading && query.length > 0 && query.length < MIN_QUERY_LEN && (
              <div style={{ padding:'16px 14px', color:'#555', fontSize:11 }}>
                Type at least {MIN_QUERY_LEN} characters to search.
              </div>
            )}

            {results.map((session, idx) => (
              <button
                key={session.session_id}
                onClick={() => selectResult(session)}
                aria-selected={idx === sel}
                style={{
                  display:        'block',
                  width:          '100%',
                  textAlign:      'left',
                  padding:        '9px 14px',
                  background:     idx === sel ? '#1a1a1a' : 'transparent',
                  border:         'none',
                  borderBottom:   '1px solid #1c1c1c',
                  cursor:         'pointer',
                  fontFamily:     'IBM Plex Mono, monospace',
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:10, color: typeColor(session.type), fontWeight:600, textTransform:'uppercase', minWidth:40 }}>
                    {session.type || '—'}
                  </span>
                  <span style={{ fontSize:11, color:'var(--text)' }}>
                    {session.date}
                  </span>
                  <span style={{ fontSize:10, color:'#888' }}>
                    {session.duration_min ? `${session.duration_min}min` : ''}
                    {session.tss ? ` · TSS ${session.tss}` : ''}
                  </span>
                  <span style={{ marginLeft:'auto' }}>
                    {simBar(session.similarity)}
                  </span>
                </div>
                {session.notes && (
                  <div style={{ fontSize:10, color:'#666', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:'100%' }}>
                    {session.notes.slice(0, 120)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop:'1px solid #1c1c1c', padding:'6px 14px', display:'flex', gap:16, fontSize:10, color:'#555' }}>
          <span>↑↓ navigate</span>
          <span>↵ jump to session</span>
          <span>Esc close</span>
          <span style={{ marginLeft:'auto' }}>Ctrl+Shift+K</span>
        </div>
      </div>
    </div>
  )
}
