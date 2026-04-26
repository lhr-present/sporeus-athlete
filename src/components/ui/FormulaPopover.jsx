// src/components/ui/FormulaPopover.jsx — E71: ⓘ formula info popover
// Renders an ⓘ button that opens a popover with formula, explanation, citation, EŞİK ref.
// Safe to render anywhere — returns null for unknown metricKey.
import { useState, useEffect, useRef } from 'react'
import { FORMULA_INFO } from '../../lib/formulaInfo.js'

const MONO = "'IBM Plex Mono', monospace"

export function FormulaPopover({ metricKey, lang = 'en' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const info = FORMULA_INFO[metricKey]

  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!info) return null

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label={`Formula info: ${info.name[lang]}`}
        style={{
          fontFamily: MONO, fontSize: '9px',
          color: open ? '#ff6600' : '#444',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 2px', lineHeight: 1, userSelect: 'none',
          transition: 'color 0.15s',
        }}
      >ⓘ</button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, top: '100%', zIndex: 9999,
            background: '#111', border: '1px solid #2a2a2a',
            borderRadius: '4px', padding: '10px 12px', width: '260px',
            fontFamily: MONO, boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
            aria-label="Close"
          >×</button>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#ff6600', marginBottom: '5px', paddingRight: '16px' }}>
            {info.name[lang]}
          </div>
          <div style={{ fontSize: '8px', color: '#888', fontStyle: 'italic', marginBottom: '6px', wordBreak: 'break-word', lineHeight: 1.5 }}>
            {info.formula}
          </div>
          <div style={{ fontSize: '10px', color: '#bbb', lineHeight: 1.6, marginBottom: info.citation ? '6px' : 0 }}>
            {info.explanation[lang]}
          </div>
          {info.citation && (
            <div style={{ fontSize: '8px', color: '#444', marginBottom: info.esik ? '3px' : 0, lineHeight: 1.5 }}>
              {info.citation}
            </div>
          )}
          {info.esik && (
            <div style={{ fontSize: '8px', color: '#ff6600', opacity: 0.8 }}>
              EŞİK {info.esik[lang]}
            </div>
          )}
        </div>
      )}
    </span>
  )
}
