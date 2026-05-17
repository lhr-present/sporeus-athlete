// ─── SessionTargetPeek.jsx — TodayView pace/power/HR target preview ─────────
//
// Compact one-liner that surfaces today's planned-session target window:
//   - Run sessions  → pace /km
//   - Bike sessions → power W
//   - Swim sessions → pace /100m
//   - HR (secondary) when paces aren't applicable / available
//   - Target IF as a single number
//
// EN:  🎯 TARGET · 4:35–4:45 /km · 145–155 BPM · IF 0.85
// TR:  🎯 HEDEF  · 4:35–4:45 /km · 145–155 BPM · IF 0.85
//
// Renders NULL when buildSessionTarget can't produce a target — the parent
// (TodayView) does not need to gate this, the component self-gates.
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { buildSessionTarget } from '../../lib/athlete/sessionTargets.js'

const MONO = "'IBM Plex Mono', monospace"

// Bloomberg-terminal swatch matched to the surrounding TodayView one-liners
// (readiness, cycle phase, deload tile).
const S = {
  wrap: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text, #ccc)',
    padding: '6px 10px',
    background: 'var(--surface, #111)',
    border: '1px solid var(--border, #222)',
    borderRadius: 4,
    marginBottom: 8,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  prefix: {
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#ff6600',
  },
  divider: {
    color: 'var(--muted, #666)',
  },
  value: {
    color: 'var(--text, #ddd)',
    fontVariantNumeric: 'tabular-nums',
  },
  ifNum: {
    color: '#0064ff',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  citation: {
    fontSize: 9,
    fontStyle: 'italic',
    color: 'var(--muted, #777)',
    marginLeft: 'auto',
  },
}

export default function SessionTargetPeek({ plannedSession, profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const target = buildSessionTarget({ plannedSession, profile })
  if (!target) return null

  const isTR = lang === 'tr'
  const prefixLabel = isTR ? 'HEDEF' : 'TARGET'

  // Compose value tokens in render order. Each token only appears when it has
  // a value, so the line stays compact for low-data athletes.
  const tokens = []
  if (target.paceTarget)  tokens.push(target.paceTarget)
  if (target.powerTarget) tokens.push(target.powerTarget)
  if (target.hrTarget)    tokens.push(target.hrTarget)

  return (
    <div
      role="status"
      aria-label={isTR ? 'Antrenman hedefi' : 'Session target preview'}
      data-today-session-target-peek={target.sport}
      style={S.wrap}
    >
      <span aria-hidden="true">🎯</span>
      <span style={S.prefix}>{prefixLabel}</span>
      {tokens.map((tok, i) => (
        <span key={`tok-${i}`} style={{ display: 'inline-flex', gap: 6 }}>
          <span style={S.divider}>·</span>
          <span style={S.value}>{tok}</span>
        </span>
      ))}
      {target.ifTarget != null ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <span style={S.divider}>·</span>
          <span style={S.ifNum}>IF {target.ifTarget.toFixed(2)}</span>
        </span>
      ) : null}
      {target.sourceLabel ? (
        <span style={S.citation} title={target.sourceLabel}>
          {target.sourceLabel.split('—')[0].trim()}
        </span>
      ) : null}
    </div>
  )
}
