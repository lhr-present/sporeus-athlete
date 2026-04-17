import { Fragment, useState, useEffect, useRef, useMemo } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { logger } from '../lib/logger.js'
import { S } from '../styles.js'
import { SEARCH_INDEX } from '../lib/constants.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { normalizeForSearch } from '../lib/textNormalize.js'

const KIND_TAB   = { session: 'log', note: 'coach', message: 'coach', announcement: 'coach', athlete: 'coach' }
const KIND_COLOR = { session: '#5bc25b', note: '#ff6600', message: '#0064ff', announcement: '#f5c542', athlete: '#a78bfa' }
const KIND_LABEL = { session: 'Sessions', note: 'Notes', message: 'Messages', announcement: 'Announcements', athlete: 'Athletes' }

// ── Fuzzy search over feature index ──────────────────────────────────────────
function fuzzyMatch(items, q) {
  if (!q.trim()) return items
  const lower = q.toLowerCase()
  return items.filter(item =>
    item.name.toLowerCase().includes(lower) ||
    item.desc.toLowerCase().includes(lower)
  )
}

// ── Command prefix triggers (/export /dark /lang /sync) ───────────────────────
const COMMANDS = [
  { id:'cmd-export', name:'/export — Download training data', desc:'Export all data as JSON', action:'export', shortcut:'⌘E' },
  { id:'cmd-dark',   name:'/dark — Toggle dark mode',         desc:'Switch light / dark theme',   action:'dark',   shortcut:'⌘D' },
  { id:'cmd-lang',   name:'/lang — Switch language',          desc:'Toggle EN / TR',              action:'lang',   shortcut:'⌘L' },
  { id:'cmd-sync',   name:'/sync — Sync now',                 desc:'Push pending log to cloud',   action:'sync',   shortcut:'⌘S' },
]

const TAB_COLORS = {
  dashboard: '#ff6600', zones: '#0064ff', log: '#5bc25b',
  tests: '#f5c542', recovery: '#4a90d9', plan: '#e03030',
  periodization: '#a78bfa', profile: '#888', glossary: '#888',
}

// ── Recent searches (localStorage 'sporeus-recent-searches') ─────────────────
function loadRecent() {
  try { return JSON.parse(localStorage.getItem('sporeus-recent-searches') || '[]') } catch { return [] }
}
function saveRecent(q) {
  if (!q.trim() || q.startsWith('/')) return
  try {
    const prev = loadRecent().filter(s => s !== q)
    localStorage.setItem('sporeus-recent-searches', JSON.stringify([q, ...prev].slice(0, 10)))
  } catch (e) { logger.warn('localStorage:', e.message) }
}

export default function SearchPalette({ onNavigate, onToggleDark, onToggleLang, onClose, log = [], onSync, onExport, authUser, tier = 'free' }) {
  const [query, setQuery]           = useState('')
  const [sel, setSel]               = useState(0)
  const [recent, setRecent]         = useState(loadRecent)
  const [dbResults, setDbResults]   = useState([])
  const [dbLoading, setDbLoading]   = useState(false)
  const [semanticMode, setSemanticMode]       = useState(false)
  const [semanticResults, setSemanticResults] = useState([])
  const [semanticLoading, setSemanticLoading] = useState(false)
  const inputRef  = useRef(null)
  const palRef    = useRef(null)
  const dbTimer   = useRef(null)
  const semTimer  = useRef(null)
  const itemRefs  = useRef([])
  useFocusTrap(palRef, { onEscape: onClose })

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setSel(0); itemRefs.current = [] }, [query])

  // Debounced FTS: fire when query >= 3 chars, not a command/log-prefix, and not in semantic mode
  useEffect(() => {
    if (semanticMode) { setDbResults([]); return }
    const q = query.trim()
    if (q.length < 3 || q.startsWith('/') || q.startsWith('#') || /^\d{4}/.test(q)) {
      setDbResults([])
      return
    }
    clearTimeout(dbTimer.current)
    dbTimer.current = setTimeout(async () => {
      if (!isSupabaseReady()) return
      setDbLoading(true)
      try {
        const normalized = normalizeForSearch(q)
        const { data, error } = await supabase.rpc('search_everything', {
          q: normalized, limit_per_kind: 5,
        })
        if (error) { logger.warn('FTS:', error.message); return }
        setDbResults((data || []).map(r => ({
          id:       `db-${r.kind}-${r.record_id}`,
          name:     r.snippet || `${r.kind} result`,
          desc:     `${r.kind} · ${r.date_hint || ''}`,
          tab:      KIND_TAB[r.kind] || 'log',
          _dbKind:  r.kind,
          _dbId:    r.record_id,
        })))
      } catch (e) { logger.warn('FTS:', e.message) }
      finally { setDbLoading(false) }
    }, 250)
    return () => clearTimeout(dbTimer.current)
  }, [query, semanticMode])

  // Debounced semantic search: embed-query (vector), coach/club tier only
  useEffect(() => {
    if (!semanticMode) { setSemanticResults([]); return }
    const q = query.trim()
    if (q.length < 3 || q.startsWith('/') || q.startsWith('#')) {
      setSemanticResults([])
      return
    }
    clearTimeout(semTimer.current)
    semTimer.current = setTimeout(async () => {
      if (!isSupabaseReady()) return
      setSemanticLoading(true)
      try {
        const { data, error } = await supabase.functions.invoke('embed-query', {
          body: { query: normalizeForSearch(q), k: 8 },
        })
        if (error) { logger.warn('Semantic:', error.message); return }
        const sessions = data?.sessions || []
        setSemanticResults(sessions.map(s => ({
          id:       `sem-${s.id || s.session_id}`,
          name:     s.notes ? s.notes.slice(0, 80) : `${s.type || 'session'} · ${s.date}`,
          desc:     `${s.date} · ${s.tss ?? 0} TSS (vector match)`,
          tab:      'log',
          _dbKind:  'session',
          _dbId:    s.id || s.session_id,
          _semantic: true,
        })))
      } catch (e) { logger.warn('Semantic:', e.message) }
      finally { setSemanticLoading(false) }
    }, 300)
    return () => clearTimeout(semTimer.current)
  }, [query, semanticMode])

  // Scroll selected item into view using per-item refs (avoids header div offset issues)
  useEffect(() => {
    itemRefs.current[sel]?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  // ── Build results list ─────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim()

    // Command mode: starts with /
    if (q.startsWith('/')) {
      const cmd = q.toLowerCase()
      return COMMANDS.filter(c => c.name.toLowerCase().includes(cmd) || c.action.toLowerCase().includes(cmd.slice(1)))
    }

    // Log entry search: starts with '#' or contains date-like pattern
    if (q.startsWith('#') || /^\d{4}/.test(q)) {
      const term = q.replace(/^#/, '').toLowerCase()
      return (log || [])
        .filter(e => {
          const label = `${e.date} ${e.type || ''} ${e.notes || ''}`.toLowerCase()
          return label.includes(term)
        })
        .slice(0, 20)
        .map(e => ({
          id:     `log-${e.date}-${e.tss}`,
          name:   `${e.date} · ${e.type || 'Session'} · ${e.tss ?? 0} TSS`,
          desc:   e.notes || `RPE ${e.rpe ?? '—'} · ${Math.round((e.durationSec || 0) / 60)} min`,
          tab:    'log',
        }))
    }

    // Empty query → recent searches as quick-picks + feature results
    if (!q) {
      const recentItems = recent.map((r, i) => ({
        id:     `recent-${i}`,
        name:   r,
        desc:   'Recent search',
        _recentQuery: r,
      }))
      return [...recentItems, ...SEARCH_INDEX.slice(0, 8)]
    }

    // Default: feature fuzzy match + commands + db/semantic results
    const activeDbResults = semanticMode ? semanticResults : dbResults
    return [
      ...fuzzyMatch(SEARCH_INDEX, q),
      ...COMMANDS.filter(c => c.action.includes(q.toLowerCase())),
      ...activeDbResults,
    ]
  }, [query, log, recent, dbResults, semanticMode, semanticResults])

  function handleSelect(item) {
    if (!item) return
    // Recent search re-run
    if (item._recentQuery) { setQuery(item._recentQuery); return }
    // Commands
    if (item.action === 'dark')   { onToggleDark?.(); onClose(); return }
    if (item.action === 'lang')   { onToggleLang?.(); onClose(); return }
    if (item.action === 'sync')   { onSync?.();       onClose(); return }
    if (item.action === 'export') { onExport?.();     onClose(); return }
    // Feature / log tab navigation
    if (item.tab) {
      saveRecent(query)
      setRecent(loadRecent())
      onNavigate(item.tab)
      onClose()
      return
    }
    onClose()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape')    { onClose(); return }
    if (e.key === 'ArrowDown') { setSel(s => Math.min(s + 1, results.length - 1)); e.preventDefault(); return }
    if (e.key === 'ArrowUp')   { setSel(s => Math.max(s - 1, 0)); e.preventDefault(); return }
    if (e.key === 'Enter')     { handleSelect(results[sel]); return }
  }

  const isCommand   = query.startsWith('/')
  const isLogSearch = query.startsWith('#') || /^\d{4}/.test(query)
  const isFTS       = !isCommand && !isLogSearch && query.trim().length >= 3
  const isLoading   = semanticMode ? semanticLoading : dbLoading
  const activeDbCount = semanticMode ? semanticResults.length : dbResults.length

  // Semantic toggle: only available for authenticated coach/club tier users
  const canSemantic = authUser && (tier === 'coach' || tier === 'club')

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:10100 }}/>

      {/* Palette */}
      <div ref={palRef} role="dialog" aria-modal="true" aria-label="Search" style={{
        position:'fixed', top:'12vh', left:'50%', transform:'translateX(-50%)',
        width:'min(640px, 94vw)', zIndex:10101,
        background:'#0d0d0d', border:'1px solid #333', borderRadius:'8px',
        overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.9)',
      }}>
        {/* Input row */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderBottom:'1px solid #1e1e1e' }}>
          <span style={{ color: isCommand ? '#5bc25b' : isLogSearch ? '#0064ff' : '#ff6600', fontSize:'16px', lineHeight:1 }}>
            {isCommand ? '/' : isLogSearch ? '#' : '◈'}
          </span>
          <input
            ref={inputRef}
            aria-label="Search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCommand ? 'command… /export /dark /lang /sync' : isLogSearch ? 'log entry search… date or notes' : 'Search features, /commands, #log entries…'}
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', color:'#e5e5e5',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:0 }}>×</button>
          )}
          <span style={{ ...S.mono, fontSize:'10px', color:'#444', border:'1px solid #333', borderRadius:'3px', padding:'2px 6px', whiteSpace:'nowrap' }}>ESC</span>
        </div>

        {/* Results list */}
        <div style={{ maxHeight:'360px', overflowY:'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding:'28px', textAlign:'center', ...S.mono, fontSize:'12px', color:'#555' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (() => {
            let lastKind = null
            return results.map((item, i) => {
              const showKindHeader = isFTS && item._dbKind && item._dbKind !== lastKind
              if (item._dbKind) lastKind = item._dbKind
              return (
                <Fragment key={item.id}>
                  {showKindHeader && (
                    <div style={{
                      padding:'5px 16px 3px', background:'#0a0a0a',
                      ...S.mono, fontSize:'9px', color:'#444',
                      letterSpacing:'0.12em', textTransform:'uppercase',
                      borderBottom:'1px solid #0f0f0f',
                    }}>
                      {KIND_LABEL[item._dbKind] || item._dbKind}
                      {item._semantic ? ' (vector)' : ''}
                    </div>
                  )}
                  <div
                    ref={el => { itemRefs.current[i] = el }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSel(i)}
                    style={{
                      padding:'10px 16px', cursor:'pointer',
                      background: i === sel ? '#1a1a1a' : 'transparent',
                      borderBottom:'1px solid #0f0f0f',
                      display:'flex', alignItems:'center', gap:'12px',
                      borderLeft: i === sel ? '3px solid #ff6600' : '3px solid transparent',
                      transition:'background 0.1s',
                    }}
                  >
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ ...S.mono, fontSize:'13px', color: i === sel ? '#ff6600' : '#d0d0d0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {item._recentQuery ? `↩ ${item.name}` : item.name}
                      </div>
                      <div style={{ ...S.mono, fontSize:'10px', color:'#555', marginTop:'2px' }}>
                        {item.desc}
                      </div>
                    </div>
                    {/* Shortcut hint (commands) */}
                    {item.shortcut && (
                      <span style={{ ...S.mono, fontSize:'9px', color:'#5bc25b', border:'1px solid #5bc25b44', borderRadius:'3px', padding:'2px 7px', whiteSpace:'nowrap', flexShrink:0 }}>
                        {item.shortcut}
                      </span>
                    )}
                    {/* Tab badge */}
                    {item.tab && !item.shortcut && !item._dbKind && (
                      <span style={{ ...S.mono, fontSize:'9px', color: TAB_COLORS[item.tab] || '#888', border:`1px solid ${TAB_COLORS[item.tab] || '#888'}44`, borderRadius:'3px', padding:'2px 7px', whiteSpace:'nowrap', flexShrink:0 }}>
                        {item.tab}
                      </span>
                    )}
                    {/* Action badge */}
                    {item.action && !item.shortcut && (
                      <span style={{ ...S.mono, fontSize:'9px', color:'#888', border:'1px solid #33333344', borderRadius:'3px', padding:'2px 7px', whiteSpace:'nowrap', flexShrink:0 }}>
                        action
                      </span>
                    )}
                    {/* DB kind badge */}
                    {item._dbKind && (
                      <span style={{ ...S.mono, fontSize:'9px', color: KIND_COLOR[item._dbKind] || '#888', border:`1px solid ${KIND_COLOR[item._dbKind] || '#888'}44`, borderRadius:'3px', padding:'2px 7px', whiteSpace:'nowrap', flexShrink:0 }}>
                        {item._dbKind}
                      </span>
                    )}
                  </div>
                </Fragment>
              )
            })
          })()}
        </div>

        {/* Footer with shortcut hints + semantic toggle */}
        <div style={{ padding:'7px 16px', borderTop:'1px solid #111', ...S.mono, fontSize:'9px', color:'#383838', display:'flex', gap:'14px', alignItems:'center', flexWrap:'wrap' }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>ESC close</span>
          <span style={{ color:'#2a2a2a' }}>|</span>
          <span style={{ color:'#333' }}>/cmd</span>
          <span style={{ color:'#333' }}>#log</span>
          {isFTS && isLoading && <span style={{ color:'#555' }}>searching{semanticMode ? ' semantically' : ' db'}…</span>}
          {isFTS && !isLoading && activeDbCount > 0 && <span style={{ color: semanticMode ? '#a78bfa44' : '#2a5c2a' }}>{activeDbCount} {semanticMode ? 'vector' : 'db'} results</span>}
          {recent.length > 0 && <span style={{ color:'#2a2a2a' }}>↩ recent</span>}

          {/* Semantic toggle — visible when authenticated and tier allows */}
          {isFTS && canSemantic && (
            <button
              onClick={() => setSemanticMode(m => !m)}
              aria-pressed={semanticMode}
              style={{
                marginLeft:'auto', background:'none', border:`1px solid ${semanticMode ? '#a78bfa' : '#333'}`,
                borderRadius:'3px', padding:'2px 8px', cursor:'pointer',
                ...S.mono, fontSize:'9px', color: semanticMode ? '#a78bfa' : '#444',
                transition:'all 0.15s',
              }}
            >
              {semanticMode ? '◉ semantic' : '○ semantic'}
            </button>
          )}
          {!canSemantic && <span style={{ marginLeft:'auto', color:'#2a2a2a' }}>Ctrl+K</span>}
        </div>
      </div>
    </>
  )
}
