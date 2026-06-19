// ─── RaceMentalRehearsalCard.jsx — Race-week mental rehearsal protocol ─────
//
// Surfaces `buildRaceMentalRehearsal` — the 5-component race-week protocol
// (Williams 2014 / Behncke 2004 / Cumming 2017). Renders null until the
// race is inside the 0-7 day window, then shows each component with a
// daily checkbox persisted to localStorage by ISO date.
//
// Distinct from MentalTools (journal / mantras / breathing): this card is
// the race-week PROTOCOL — imagery + cue word + arousal regulation +
// contingency plan + post-race reflection.

import { memo, useContext, useMemo  } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { buildRaceMentalRehearsal } from '../../lib/athlete/raceMentalRehearsal.js'

const STORAGE_KEY = 'sporeus-raceMentalRehearsalChecks'
const MONO = "'IBM Plex Mono', monospace"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function RaceMentalRehearsalCard({ profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const today = todayISO()
  const result = useMemo(
    () => buildRaceMentalRehearsal({ profile, today }),
    [profile, today]
  )

  const [checks, setChecks] = useLocalStorage(STORAGE_KEY, {})

  if (!result) return null

  const { daysToRace, protocol, citation } = result

  const toggleCheck = (componentId) => {
    const map = (checks && typeof checks === 'object') ? checks : {}
    const byComponent = { ...(map[componentId] || {}) }
    byComponent[today] = !byComponent[today]
    setChecks({ ...map, [componentId]: byComponent })
  }

  const isDone = (componentId) => {
    const map = (checks && typeof checks === 'object') ? checks : {}
    return !!(map[componentId] && map[componentId][today])
  }

  const heading = isTR
    ? `ZİHİNSEL HAZIRLIK · T-${daysToRace} GÜN`
    : `RACE MENTAL REHEARSAL · T-${daysToRace} DAYS`
  const ariaLabel = isTR
    ? 'Yarış haftası zihinsel hazırlık protokolü'
    : 'Race-week mental rehearsal protocol'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-race-mental-rehearsal-card
      data-days-to-race={daysToRace}
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
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          marginBottom: 4,
          color: 'var(--text, #ccc)',
        }}
      >
        <span style={{ color: '#ff6600', marginRight: 6 }}>◢</span>
        {heading}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        {isTR
          ? 'Yarış haftası 5-parçalı zihinsel protokol — her gün işaretle.'
          : 'Race-week 5-component mental protocol — check off daily.'}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {protocol.map((c) => {
          const done = isDone(c.id)
          const labelText = isTR ? c.label.tr : c.label.en
          const hintText = isTR ? c.hint.tr : c.hint.en
          return (
            <li
              key={c.id}
              data-component-id={c.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 0',
                borderBottom: '1px solid var(--border, #222)',
              }}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleCheck(c.id)}
                aria-label={`${labelText} — ${isTR ? 'bugün tamamlandı' : 'done today'}`}
                data-checkbox-id={c.id}
                style={{
                  marginTop: 3,
                  accentColor: '#ff6600',
                  cursor: 'pointer',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: done ? 'var(--muted, #888)' : 'var(--text, #ccc)',
                      textDecoration: done ? 'line-through' : 'none',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {labelText}
                  </span>
                  <span
                    data-dose-minutes={c.doseMinutes}
                    style={{
                      fontSize: 10,
                      color: '#0064ff',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {c.doseMinutes} {isTR ? 'dk' : 'min'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--muted, #888)',
                    lineHeight: 1.5,
                  }}
                >
                  {hintText}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div
        style={{
          fontSize: 9,
          color: '#555',
          fontStyle: 'italic',
          marginTop: 10,
        }}
      >
        {citation}
      </div>
    </div>
  )
}

export default memo(RaceMentalRehearsalCard)
