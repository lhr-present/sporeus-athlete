// src/components/today/ARaceCountdownPeek.jsx
//
// Leaf component. One-liner peek for TodayView surfacing the athlete's
// next A-race when ≤28 days away, with taper-window status.
// Renders null when:
//   - no race set anywhere
//   - race in the past
//   - race >28 days out
//
// Bilingual EN/TR via LangCtx. Inline styles only (project convention).
// See `aRaceCountdown.js` for the pure-fn logic and protocol grounding.

import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeARaceCountdown } from '../../lib/athlete/aRaceCountdown.js'

const TAPER_COLOR = {
  RACE_DAY:  '#e03030', // red
  RACE_WEEK: '#ff6600', // orange
  TAPER:     '#0064ff', // blue
  BUILD:     '#888888', // muted
}

const TAPER_LABEL_TR = {
  RACE_DAY:  'YARIŞ GÜNÜ',
  RACE_WEEK: 'YARIŞ HAFTASI',
  TAPER:     'TAPER',
  BUILD:     'YAPILANMA',
}

const TAPER_LABEL_EN = {
  RACE_DAY:  'RACE DAY',
  RACE_WEEK: 'RACE WEEK',
  TAPER:     'TAPER',
  BUILD:     'BUILD',
}

export default function ARaceCountdownPeek({ profile, multiPeakSeason, today }) {
  const ctx = useContext(LangCtx) || { lang: 'en' }
  const lang = ctx.lang === 'tr' ? 'tr' : 'en'

  const result = computeARaceCountdown({
    profile: profile || null,
    multiPeakSeason: multiPeakSeason || null,
    today,
  })
  if (!result) return null

  const { daysToRace, raceName, taperWindow } = result
  const color = TAPER_COLOR[taperWindow] || '#888888'
  const isTR = lang === 'tr'

  const labelARace = isTR ? 'A-YARIŞ' : 'A-RACE'
  const labelDays = isTR ? `${daysToRace}g` : `${daysToRace}d`
  const taperLabel = (isTR ? TAPER_LABEL_TR : TAPER_LABEL_EN)[taperWindow] || taperWindow
  const fallbackName = isTR ? 'A-Yarış' : 'A-race'
  const displayName = raceName && raceName.trim() ? raceName : fallbackName

  return (
    <div
      data-today-a-race-countdown-peek
      data-taper-window={taperWindow}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '11px',
        padding: '6px 10px',
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        background: 'var(--card-bg, transparent)',
        color: 'var(--text, #ddd)',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span aria-hidden="true">🏁</span>
      <span style={{ fontWeight: 700, color }}>{labelARace}</span>
      <span style={{ color: 'var(--muted, #888)' }}>·</span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '40%',
        }}
        title={displayName}
      >
        {displayName}
      </span>
      <span style={{ color: 'var(--muted, #888)' }}>·</span>
      <span style={{ fontWeight: 700 }}>{labelDays}</span>
      <span style={{ color: 'var(--muted, #888)' }}>·</span>
      <span style={{ color, fontWeight: 700 }}>{taperLabel}</span>
    </div>
  )
}
