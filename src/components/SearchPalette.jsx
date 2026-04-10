import { useState, useEffect, useRef } from 'react'
import { S } from '../styles.js'
import { SEARCH_INDEX } from '../lib/constants.js'

function fuzzyMatch(items, q) {
  if (!q.trim()) return items
  const lower = q.toLowerCase()
  return items.filter(item =>
    item.name.toLowerCase().includes(lower) ||
    item.desc.toLowerCase().includes(lower)
  )
}

const TAB_COLORS = {
  dashboard: '#ff6600', zones: '#0064ff', log: '#5bc25b',
  tests: '#f5c542', recovery: '#4a90d9', plan: '#e03030',
  periodization: '#a78bfa', profile: '#888', glossary: '#888',
}

export default function SearchPalette({ onNavigate, onToggleDark, onToggleLang, onClose }) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const results = fuzzyMatch(SEARCH_INDEX, query)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSel(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[sel]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [sel])

  function handleSelect(item) {
    if (!item) return
    if (item.action === 'dark')  { onToggleDark(); onClose(); return }
    if (item.action === 'lang')  { onToggleLang(); onClose(); return }
    if (item.tab)                { onNavigate(item.tab); onClose(); return }
    onClose()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape')    { onClose(); return }
    if (e.key === 'ArrowDown') { setSel(s => Math.min(s + 1, results.length - 1)); e.preventDefault(); return }
    if (e.key === 'ArrowUp')   { setSel(s => Math.max(s - 1, 0)); e.preventDefault(); return }
    if (e.key === 'Enter')     { handleSelect(results[sel]); return }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:10100 }}
      />
      {/* Palette container */}
      <div style={{
        position:'fixed', top:'12vh', left:'50%', transform:'translateX(-50%)',
        width:'min(620px, 94vw)', zIndex:10101,
        background:'#0d0d0d', border:'1px solid #333', borderRadius:'8px',
        overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.9)',
      }}>
        {/* Input row */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderBottom:'1px solid #1e1e1e' }}>
          <span style={{ color:'#ff6600', fontSize:'16px', lineHeight:1 }}>◈</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search features... (zones, recovery, export, dark mode...)"
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              fontFamily:"'IBM Plex Mono',monospace", fontSize:'14px', color:'#e5e5e5',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:0 }}>×</button>
          )}
          <span style={{ ...S.mono, fontSize:'10px', color:'#444', border:'1px solid #333', borderRadius:'3px', padding:'2px 6px', whiteSpace:'nowrap' }}>ESC</span>
        </div>

        {/* Results list */}
        <div ref={listRef} style={{ maxHeight:'360px', overflowY:'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding:'28px', textAlign:'center', ...S.mono, fontSize:'12px', color:'#555' }}>
              No results for "{query}"
            </div>
          ) : (
            results.map((item, i) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSel(i)}
                style={{
                  padding:'10px 16px', cursor:'pointer',
                  background: i === sel ? '#1a1a1a' : 'transparent',
                  borderBottom:'1px solid #0f0f0f',
                  display:'flex', alignItems:'center', gap:'12px',
                  borderLeft: i === sel ? `3px solid #ff6600` : '3px solid transparent',
                  transition:'background 0.1s',
                }}
              >
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ ...S.mono, fontSize:'13px', color: i === sel ? '#ff6600' : '#d0d0d0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ ...S.mono, fontSize:'10px', color:'#555', marginTop:'2px' }}>
                    {item.desc}
                  </div>
                </div>
                {item.tab && (
                  <span style={{ ...S.mono, fontSize:'9px', color: TAB_COLORS[item.tab] || '#888', border:`1px solid ${TAB_COLORS[item.tab] || '#888'}44`, borderRadius:'3px', padding:'2px 7px', whiteSpace:'nowrap', flexShrink:0 }}>
                    {item.tab}
                  </span>
                )}
                {item.action && (
                  <span style={{ ...S.mono, fontSize:'9px', color:'#888', border:'1px solid #33333', borderRadius:'3px', padding:'2px 7px', whiteSpace:'nowrap', flexShrink:0 }}>
                    action
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'7px 16px', borderTop:'1px solid #111', ...S.mono, fontSize:'9px', color:'#383838', display:'flex', gap:'14px', alignItems:'center' }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>ESC close</span>
          <span style={{ marginLeft:'auto' }}>Ctrl+K</span>
        </div>
      </div>
    </>
  )
}
