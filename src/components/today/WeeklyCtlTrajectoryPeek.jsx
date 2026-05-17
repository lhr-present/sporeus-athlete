// src/components/today/WeeklyCtlTrajectoryPeek.jsx
//
// Leaf component: one-line forward look on where the athlete's CTL
// (fitness, 42-day EMA) will land by Sunday given the remaining
// planned sessions this week. Renders null when there's no signal.
//
// Example: "📈 CTL · 58 → 61 by Sun (+3.2)"
// TR:      "📈 CTL · 58 → 61 Paz'a kadar (+3.2)"

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { projectCtlTrajectory } from '../../lib/athlete/ctlTrajectory.js'

const MONO = "'IBM Plex Mono', monospace"

const DIRECTION_GLYPH = {
  rising:  '↑', // ↑
  falling: '↓', // ↓
  stable:  '→', // →
}

const DIRECTION_COLOR = {
  rising:  '#5bc25b',
  falling: '#e03030',
  stable:  '#888888',
}

function formatNum(n) {
  // 58.0 → "58", 60.5 → "60.5"
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatDelta(d) {
  const sign = d > 0 ? '+' : (d < 0 ? '−' : '±') // +, −, ±
  return sign + formatNum(Math.abs(d))
}

export default function WeeklyCtlTrajectoryPeek({ log, plan, today }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const todayIso = useMemo(
    () => today || new Date().toISOString().slice(0, 10),
    [today],
  )

  const result = useMemo(
    () => projectCtlTrajectory({ log, plan, today: todayIso }),
    [log, plan, todayIso],
  )

  if (!result) return null

  const { currentCtl, projectedCtl, delta, direction } = result
  const glyph = DIRECTION_GLYPH[direction] || '→'
  const color = DIRECTION_COLOR[direction] || '#888888'
  const sundayLabel = isTR ? "Paz'a kadar" : 'by Sun'

  return (
    <div
      data-today-ctl-trajectory-peek
      data-ctl-direction={direction}
      style={{
        fontFamily: MONO,
        fontSize: 11,
        color: 'var(--muted, #888)',
        letterSpacing: '0.04em',
        padding: '4px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      <span aria-hidden="true">{'📈'}</span>
      <span style={{ color: 'var(--text, #ccc)', fontWeight: 600 }}>CTL</span>
      <span style={{ color: 'var(--muted, #888)' }}>·</span>
      <span style={{ color: 'var(--text, #ccc)' }}>{formatNum(currentCtl)}</span>
      <span style={{ color, fontWeight: 700 }} aria-hidden="true">{glyph}</span>
      <span style={{ color: 'var(--text, #ccc)', fontWeight: 700 }}>{formatNum(projectedCtl)}</span>
      <span style={{ color: 'var(--muted, #888)' }}>{sundayLabel}</span>
      <span style={{ color }}>({formatDelta(delta)})</span>
    </div>
  )
}
