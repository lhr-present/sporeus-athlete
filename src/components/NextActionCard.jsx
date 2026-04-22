// ─── NextActionCard.jsx — G3 rules-based next-action card ─────────────────────
// Renders above the fold on TodayView. Dismissible per-rule for 24h.
// No props beyond lang; reads data from useData() and computes action inline.

import { useState, useMemo, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { computeNextAction, isDismissed, dismissRule } from '../lib/nextAction.js'

const MONO   = "'IBM Plex Mono', monospace"
const COLORS = {
  red:   { border: '#e03030', text: '#e03030', badge: '#3a1010' },
  amber: { border: '#f5c542', text: '#f5c542', badge: '#332a0a' },
  green: { border: '#5bc25b', text: '#5bc25b', badge: '#0d2a0d' },
  blue:  { border: '#0064ff', text: '#0064ff', badge: '#001a40' },
  muted: { border: '#333',    text: '#888',    badge: '#1a1a1a' },
}

export default function NextActionCard() {
  const { lang } = useContext(LangCtx)
  const { log, recovery, profile } = useData()

  const action = useMemo(
    () => computeNextAction(log, recovery, profile),
    [log, recovery, profile],
  )

  const [dismissed, setDismissed] = useState(() =>
    action ? isDismissed(action.id) : false,
  )

  if (!action || dismissed) return null

  const c = COLORS[action.color] || COLORS.muted

  function handleDismiss() {
    dismissRule(action.id)
    setDismissed(true)
  }

  return (
    <div style={{
      fontFamily: MONO,
      border: `1px solid ${c.border}`,
      borderLeft: `4px solid ${c.border}`,
      borderRadius: '3px',
      padding: '12px 16px',
      marginBottom: '14px',
      background: 'var(--card-bg, #111)',
    }}>
      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '3px' }}>
            {lang === 'tr' ? '▶ SONRAKİ ADIM' : '▶ NEXT ACTION'}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: c.text, lineHeight: 1.3 }}>
            {action.action[lang] || action.action.en}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label={lang === 'tr' ? '24 saat gizle' : 'Dismiss for 24h'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', fontSize: '12px', padding: '0', flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* ── Rationale ─────────────────────────────────────────────────────── */}
      <div style={{ fontSize: '10px', color: '#888', marginTop: '6px', lineHeight: 1.5 }}>
        {action.rationale[lang] || action.rationale.en}
      </div>

      {/* ── Citation ──────────────────────────────────────────────────────── */}
      <div style={{ fontSize: '9px', color: '#444', marginTop: '5px' }}>
        ℹ {action.citation}
      </div>

      {/* ── U1 — metrics dim strip ────────────────────────────────────────── */}
      {action.metrics && (() => {
        const { ctl, atl, tsb, acwr } = action.metrics
        const parts = []
        if (ctl > 0) parts.push(`CTL ${Math.round(ctl)}`)
        if (atl > 0) parts.push(`ATL ${Math.round(atl)}`)
        if (tsb !== undefined && tsb !== null) parts.push(`TSB ${tsb >= 0 ? '+' : ''}${Math.round(tsb)}`)
        if (acwr !== null && acwr !== undefined) parts.push(`ACWR ${acwr.toFixed(2)}`)
        if (!parts.length) return null
        return (
          <div style={{ fontSize: '9px', color: '#2a2a2a', fontFamily: MONO, marginTop: '5px', letterSpacing: '0.04em' }}>
            {parts.join(' · ')}
          </div>
        )
      })()}
    </div>
  )
}
