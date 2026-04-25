// ─── PriorityActionCard.jsx — E39: Today's Priority Action ───────────────────
// Wires computeNextAction() 12-rule engine directly into Dashboard.
// Shows only when an action is triggered (computeNextAction always returns an
// object, but rules with id='default' use muted color — we show all results
// since even default is informative).
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeNextAction } from '../../lib/nextAction.js'

// Color map for action.color values → display hex
const COLOR_MAP = {
  red:   '#e03030',
  amber: '#f5c542',
  green: '#5bc25b',
  blue:  '#0064ff',
  muted: '#444444',
}

/**
 * @param {{ log: object[], recovery: object[], profile: object }} props
 */
export default function PriorityActionCard({ log, recovery, profile }) {
  const { t, lang } = useContext(LangCtx)

  const action = computeNextAction(log, recovery, profile)
  if (!action) return null

  const borderColor = COLOR_MAP[action.color] || '#444444'

  // action.action may be { en, tr } or a plain string (safety guard)
  const actionText = typeof action.action === 'object'
    ? (action.action[lang] || action.action.en || '')
    : String(action.action || '')

  const rationaleText = typeof action.rationale === 'object'
    ? (action.rationale[lang] || action.rationale.en || '')
    : String(action.rationale || '')

  return (
    <div className="sp-card" style={{
      ...S.card,
      borderLeft: `4px solid ${borderColor}`,
      marginBottom: '12px',
    }}>
      {/* Title */}
      <div style={{
        ...S.mono,
        fontSize: '11px',
        fontWeight: 700,
        color: '#ff6600',
        letterSpacing: '0.08em',
        marginBottom: '8px',
      }}>
        {lang === 'tr' ? '◈ BUGÜNÜN ÖNCELİĞİ' : "◈ TODAY'S PRIORITY"}
      </div>

      {/* Action headline */}
      <div style={{
        ...S.mono,
        fontSize: '12px',
        fontWeight: 700,
        color: '#ccc',
        marginBottom: '6px',
        lineHeight: 1.5,
      }}>
        {actionText}
      </div>

      {/* Rationale — 2-line clamp */}
      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: '#888',
        lineHeight: 1.6,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        marginBottom: '6px',
      }}>
        {rationaleText}
      </div>

      {/* Citation */}
      {action.citation && (
        <div style={{ ...S.mono, fontSize: '8px', color: '#333', letterSpacing: '0.04em', borderTop: '1px solid var(--border)', paddingTop: '5px' }}>
          {action.citation}
        </div>
      )}
    </div>
  )
}
