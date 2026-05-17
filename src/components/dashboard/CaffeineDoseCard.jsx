// ─── CaffeineDoseCard.jsx — Pre-session caffeine dose guidance ─────────────
// Surfaces `computeCaffeineDose` for the dashboard. Renders only when:
//   - profile.weight is set
//   - today's planned session is a hard session (RPE ≥ 7 or hard type)
// Otherwise renders null — the card is intentionally invisible on easy/rest
// days so it doesn't push caffeine on athletes who don't need it.
//
// Reference: Burke 2017; Stear 2010; IOC 2018 consensus.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { getTodayPlannedSession } from '../../lib/intelligence.js'
import { computeCaffeineDose } from '../../lib/athlete/caffeineDose.js'

const MONO = "'IBM Plex Mono', monospace"
const ACCENT = '#0064ff'  // blue — informational

export default function CaffeineDoseCard({ profile = {}, plan = null }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = new Date().toISOString().slice(0, 10)
  const plannedSession = useMemo(
    () => getTodayPlannedSession(plan, today),
    [plan, today],
  )

  const dose = useMemo(
    () => computeCaffeineDose({ profile, plannedSession, today }),
    [profile, plannedSession, today],
  )

  if (!dose) return null

  const title    = isTR ? 'KAFEİN · BUGÜN' : 'CAFFEINE · TODAY'
  const aria     = isTR ? 'Bugünkü kafein dozu önerisi' : 'Today caffeine dose guidance'
  const rangeLbl = isTR ? 'aralık' : 'range'
  const timingTxt = isTR
    ? `${dose.timingMinutesPre} dk önce`
    : `${dose.timingMinutesPre} min pre-session`
  const splitTxt = isTR
    ? 'Uzun seans: yarısını seans öncesi, yarısını seans sırasında al.'
    : 'Long session: take half pre-session, half during.'
  const safetyTxt = isTR
    ? 'Hassasiyetin varsa veya 14:00 sonrası alma.'
    : 'Skip if caffeine-sensitive or after 2 PM.'

  return (
    <div
      role="region"
      aria-label={aria}
      data-caffeine-dose-card
      data-dose-typical={dose.doseTypicalMg}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{
        fontSize: 12,
        letterSpacing: '0.06em',
        fontWeight: 700,
        marginBottom: 10,
        color: 'var(--text)',
      }}>
        <span style={{ color: ACCENT, marginRight: 6 }}>◢</span>
        {title}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 28,
          fontWeight: 700,
          color: ACCENT,
          lineHeight: 1,
        }}>
          {dose.doseTypicalMg} mg
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          · {rangeLbl} {dose.doseMinMg}–{dose.doseMaxMg} mg
        </span>
      </div>

      <div style={{
        fontSize: 11,
        color: 'var(--text)',
        marginBottom: 6,
      }}>
        ⏱ {timingTxt}
      </div>

      {dose.longSessionSplit ? (
        <div
          data-caffeine-split-note
          style={{
            fontSize: 10,
            color: 'var(--text)',
            background: `${ACCENT}14`,
            border: `1px solid ${ACCENT}55`,
            borderRadius: 3,
            padding: '6px 8px',
            marginBottom: 6,
            lineHeight: 1.4,
          }}
        >
          ↳ {splitTxt}
        </div>
      ) : null}

      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        lineHeight: 1.5,
        marginBottom: 8,
      }}>
        ⚠ {safetyTxt}
      </div>

      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        {dose.citation}
      </div>
    </div>
  )
}
