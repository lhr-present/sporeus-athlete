// ─── RaceDayFuelingTimelineCard.jsx — Pre-race hourly fueling timeline ─────
//
// Wraps `buildRaceDayFuelingTimeline` (Burke 2017 / Jeukendrup 2014 /
// Hawley & Burke 2010). Surfaces the hour-by-hour countdown the existing
// FuelingCard (per-phase daily g/kg) and RaceStrategyCard (in-race g/hr)
// do not.
//
// Render rules:
//   - profile.weight required (kg) — renders null otherwise.
//   - profile.raceDate (or nextRaceDate) required — renders null otherwise.
//   - Renders only during race week (race ≤ 7 days from today, and not past).
//
// Heading: "RACE FUELING · T-N DAYS" / "YARIŞ BESLENME · T-N GÜN".
// Color: blue (#0064ff) — informational.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  buildRaceDayFuelingTimeline,
} from '../../lib/athlete/raceDayFuelingTimeline.js'
import { getProfileRaceDate } from '../../lib/validate.js'

const MONO = "'IBM Plex Mono', monospace"
const BLUE = '#0064ff'

function RaceDayFuelingTimelineCard({ profile }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const raceDate = getProfileRaceDate(profile)

  const daysToRace = useMemo(() => {
    if (!raceDate) return null
    const a = Date.parse(`${todayISO}T00:00:00Z`)
    const b = Date.parse(`${raceDate}T00:00:00Z`)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    return Math.round((b - a) / 86400000)
  }, [todayISO, raceDate])

  const result = useMemo(
    () => buildRaceDayFuelingTimeline({ profile, today: todayISO }),
    [profile, todayISO]
  )

  // Render nothing when pure-fn null OR race is in the past.
  if (!result) return null
  if (daysToRace == null || daysToRace < 0) return null

  const heading = isTR
    ? `YARIŞ BESLENME · T-${daysToRace} GÜN`
    : `RACE FUELING · T-${daysToRace} DAYS`
  const ariaLabel = isTR
    ? 'Yarış öncesi beslenme zaman çizelgesi'
    : 'Pre-race fueling timeline'
  const choLabel    = isTR ? 'KH'    : 'CHO'
  const fluidLabel  = isTR ? 'Sıvı'  : 'Fluid'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-race-day-fueling-timeline-card
      data-days-to-race={daysToRace}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: `1px solid ${BLUE}55`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 12,
          fontSize: 12, letterSpacing: '0.06em', fontWeight: 700,
          color: BLUE,
        }}
      >
        <span aria-hidden="true">◆</span>
        <span>{heading}</span>
      </div>

      <ol
        style={{
          listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {result.timeline.map((row, idx) => (
          <li
            key={row.tMinus}
            data-timeline-row={idx}
            data-t-minus={row.tMinus}
            style={{
              borderLeft: `2px solid ${BLUE}`,
              paddingLeft: 10,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            <div
              style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 11, fontWeight: 700,
                  color: BLUE, letterSpacing: '0.04em',
                  fontFamily: MONO, whiteSpace: 'nowrap',
                }}
              >
                {row.tMinus}
              </span>
              <span
                style={{
                  fontSize: 11, color: 'var(--text, #ccc)',
                  fontWeight: 600,
                }}
              >
                {isTR ? row.label.tr : row.label.en}
              </span>
              <span
                style={{
                  fontSize: 10, color: 'var(--muted, #888)',
                  fontFamily: MONO, marginLeft: 'auto',
                }}
                data-targets
              >
                {row.choTargetG != null ? `${choLabel} ${row.choTargetG} g` : ''}
                {row.choTargetG != null && row.fluidMl != null ? ' · ' : ''}
                {row.fluidMl != null ? `${fluidLabel} ${row.fluidMl} mL` : ''}
              </span>
            </div>
            <div
              style={{
                fontSize: 10, color: 'var(--muted, #888)',
                lineHeight: 1.5, marginTop: 4,
              }}
              data-hint
            >
              {isTR ? row.hint.tr : row.hint.en}
            </div>
          </li>
        ))}
      </ol>

      <div
        style={{
          fontSize: 9, color: '#555', fontStyle: 'italic',
          marginTop: 12, paddingTop: 8,
          borderTop: '1px solid var(--border, #222)',
        }}
      >
        {result.citation}
      </div>
    </div>
  )
}

export default memo(RaceDayFuelingTimelineCard)
