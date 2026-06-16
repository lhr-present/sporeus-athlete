// ─── GlobalSearch.jsx — Global FTS content search modal ──────────────────────
// Shortcut: Ctrl+Shift+F (distinct from Ctrl+K → SearchPalette, Ctrl+Shift+K → SemanticSearch)
// Calls search_everything() RPC — tsvector union of sessions / notes / messages /
// announcements / athletes, normalised for Turkish diacritics.
// Includes a "Search semantically →" toggle that routes to SemanticSearch in the Log tab.
//
// Props:
//   onNavigate (tab: string, sessionId?: string) => void  — tab navigation callback
//   tier       'free'|'coach'|'club'                      — for future tier-gated extensions

import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { normalizeForSearch } from '../lib/textNormalize.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { announce } from '../lib/a11y/announcer.js'
import { logger } from '../lib/logger.js'

const LISTBOX_ID = 'sporeus-gs-listbox'

const DEBOUNCE_MS  = 200
const MIN_CHARS    = 2
const MAX_RECENT   = 10
const STORAGE_KEY  = 'sporeus-recent-searches'

// Display order for grouped results
const KIND_ORDER = ['session', 'athlete_session', 'note', 'message', 'announcement', 'athlete']

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveRecent(query, prev) {
  const next = [query, ...prev.filter(q => q !== query)].slice(0, MAX_RECENT)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  return next
}

// ── snippet sanitiser — ts_headline emits <b>…</b>; map to safe mark spans ───
function renderSnippet(raw) {
  if (!raw) return null
  const safe = raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Postgres ts_headline uses <b>…</b> — we encoded it above so restore just those
    .replace(/&lt;b&gt;/g, '<mark style="background:#ff660026;color:#ff6600;border-radius:1px;padding:0 1px">')
    .replace(/&lt;\/b&gt;/g, '</mark>')
  return <span dangerouslySetInnerHTML={{ __html: safe }} />
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GlobalSearch({ onNavigate, tier: _tier = 'free' }) {
  const { t, lang } = useContext(LangCtx)

  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([]) // flat array from RPC
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [active,  setActive]  = useState(-1) // keyboard-selected flat index
  const [recent,  setRecent]  = useState(() => loadRecent())

  const inputRef    = useRef(null)
  const listRef     = useRef(null)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  useFocusTrap(containerRef, { active: open, onEscape: () => setOpen(false) })

  // ── Global shortcut: Ctrl+Shift+F ─────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Reset + focus on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40)
    } else {
      setQuery('')
      setResults([])
      setActive(-1)
      setError(null)
    }
  }, [open])

  // ── Debounced RPC call ─────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      if (!isSupabaseReady()) { setLoading(false); return }
      try {
        const { data, error: rpcErr } = await supabase.rpc('search_everything', {
          q:              normalizeForSearch(query),
          limit_per_kind: 10,
        })
        if (rpcErr) throw rpcErr
        const rows = data ?? []
        setResults(rows)
        setActive(rows.length > 0 ? 0 : -1)
        setError(null)
        // Announce result count for screen readers (bilingual)
        const count = rows.length
        const msg = lang === 'tr'
          ? `${count} ${t('gsResultsCount')}`
          : `${count} ${t('gsResultsCount')}`
        announce(msg, 'polite')
      } catch (e) {
        logger.error('GlobalSearch rpc:', e.message)
        setError(e.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query, lang, t])

  // ── Keyboard navigation inside the modal ──────────────────────────────────
  const handleKeyDown = useCallback(e => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
    // Ctrl+K / Cmd+K — re-focus the search input
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select?.()
      return
    }
    const n = results.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (n === 0) return
      setActive(a => (a < 0 ? 0 : (a + 1) % n)) // wrap last → first
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (n === 0) return
      setActive(a => (a <= 0 ? n - 1 : a - 1)) // wrap first → last
    } else if (e.key === 'Home') {
      if (n === 0) return
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      if (n === 0) return
      e.preventDefault()
      setActive(n - 1)
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      selectResult(results[active])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, active])

  // Scroll selected item into view
  useEffect(() => {
    if (active >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-gs-item]')
      items[active]?.scrollIntoView({ block: 'nearest' })
    }
  }, [active])

  // ── Actions ───────────────────────────────────────────────────────────────
  function selectResult(row) {
    if (!row) return
    setRecent(prev => saveRecent(query, prev))
    setOpen(false)
    // Route to the right tab; own session records open their expanded row in Log.
    // athlete_session is an athlete's session (coach view) → Log tab, but not the
    // coach's own row, so no record_id to expand (matches SearchPalette KIND_TAB).
    const tab = (row.kind === 'session' || row.kind === 'athlete_session') ? 'log' : 'coach'
    onNavigate?.(tab, row.kind === 'session' ? row.record_id : null)
  }

  function pickRecent(q) {
    setQuery(q)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function openSemantic() {
    // Navigate to Log tab first, then signal SemanticSearch to open with the current query
    onNavigate?.('log')
    setOpen(false)
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('sporeus:open-semantic-search', { detail: { query } })
      )
    }, 120) // brief delay so TrainingLog mounts before the event fires
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!open) return null

  const grouped = {}
  for (const r of results) {
    if (!grouped[r.kind]) grouped[r.kind] = []
    grouped[r.kind].push(r)
  }
  const presentKinds = KIND_ORDER.filter(k => grouped[k])
  const showRecent   = query.length < MIN_CHARS && recent.length > 0

  let flatIdx = 0 // track absolute index across all grouped rows for keyboard nav

  return (
    <div
      role="dialog"
      aria-label={t('gsTitle')}
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 10003,
        background: 'rgba(0,0,0,0.86)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '10vh 16px 16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%', maxWidth: 640,
          background: '#0f0f0f',
          border: '1px solid #2a2a2a',
          borderRadius: 6,
          overflow: 'hidden',
          fontFamily: "'IBM Plex Mono', monospace",
          boxShadow: '0 32px 96px rgba(0,0,0,0.35)',
        }}
      >
        {/* ── Input row ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid #1e1e1e', padding: '12px 14px',
        }}>
          <span style={{ color: '#555', fontSize: 15, flexShrink: 0, lineHeight: 1 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('gsPlaceholder')}
            aria-label={t('gsTitle')}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={active >= 0 ? `${LISTBOX_ID}-opt-${active}` : undefined}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e0e0e0', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13, lineHeight: 1.4,
            }}
          />
          {loading && (
            <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.05em' }}>
              {t('gsSearching')}
            </span>
          )}
          <button
            onClick={openSemantic}
            title={t('gsSemantic')}
            style={{
              background: 'none', border: '1px solid #2a2a2a', borderRadius: 3,
              color: '#666', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9, padding: '3px 7px', cursor: 'pointer',
              whiteSpace: 'nowrap', letterSpacing: '0.04em',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff6600'; e.currentTarget.style.borderColor = '#ff6600' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#2a2a2a' }}
          >
            {t('gsSemantic')}
          </button>
          <span style={{ fontSize: 9, color: '#333', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Ctrl+Shift+F
          </span>
        </div>

        {/* ── Results body ── */}
        <div
          ref={listRef}
          id={LISTBOX_ID}
          role="listbox"
          aria-label={t('gsResultsLabel')}
          style={{ maxHeight: 440, overflowY: 'auto' }}
        >

          {/* Recent searches */}
          {showRecent && (
            <div style={{ padding: '10px 14px 6px' }}>
              <div style={{
                fontSize: 9, color: '#444', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: 6,
              }}>
                {t('gsRecent')}
              </div>
              {recent.map((q, i) => (
                <div
                  key={i}
                  onClick={() => pickRecent(q)}
                  style={{
                    padding: '6px 8px', borderRadius: 3, cursor: 'pointer',
                    fontSize: 11, color: '#777',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#161616'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  ↩ {q}
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div style={{ padding: '20px 14px', fontSize: 11, color: '#ff6600' }}>
              {error}
            </div>
          )}

          {/* No results */}
          {!loading && !error && query.length >= MIN_CHARS && results.length === 0 && (
            <div style={{
              padding: '28px 14px', fontSize: 11, color: '#444',
              textAlign: 'center', lineHeight: 1.7,
            }}>
              {t('gsNoResults')}
            </div>
          )}

          {/* Grouped result sections */}
          {presentKinds.map(kind => {
            const rows = grouped[kind]
            return (
              <div key={kind}>
                <div style={{
                  padding: '10px 14px 3px',
                  fontSize: 9, color: '#444',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  {t(`gsKind_${kind}`) || kind}
                </div>
                {rows.map(row => {
                  const myIdx = flatIdx++
                  const isActive = myIdx === active
                  return (
                    <div
                      key={row.record_id}
                      id={`${LISTBOX_ID}-opt-${myIdx}`}
                      data-gs-item
                      data-gs-index={myIdx}
                      onClick={() => selectResult(row)}
                      onMouseEnter={() => setActive(myIdx)}
                      role="option"
                      aria-selected={isActive}
                      style={{
                        padding: '8px 14px', cursor: 'pointer',
                        background: isActive ? '#181818' : 'transparent',
                        borderLeft: `2px solid ${isActive ? '#ff6600' : 'transparent'}`,
                        transition: 'background 0.08s',
                      }}
                    >
                      <div style={{
                        fontSize: 11, color: '#c0c0c0',
                        marginBottom: row.snippet ? 3 : 0,
                        display: 'flex', justifyContent: 'space-between', gap: 8,
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.record_id?.slice(0, 8)}…
                        </span>
                        {row.date_hint && (
                          <span style={{ color: '#555', flexShrink: 0, fontSize: 9 }}>
                            {row.date_hint}
                          </span>
                        )}
                      </div>
                      {row.snippet && (
                        <div style={{ fontSize: 10, color: '#555', lineHeight: 1.5 }}>
                          {renderSnippet(row.snippet)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{
          borderTop: '1px solid #161616', padding: '7px 14px',
          display: 'flex', gap: 16, fontSize: 9, color: '#333',
        }}>
          <span>↑↓ navigate</span>
          <span>Home/End jump</span>
          <span>↵ open</span>
          <span>Tab cycle</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  )
}
