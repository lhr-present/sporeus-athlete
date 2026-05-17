// ─── dashboard/EliteRaceWeekCard.jsx — surface eliteProgramRaceWeek ──────────
//
// Standalone Dashboard card that surfaces `buildRaceWeekProtocol()` from
// `src/lib/athlete/eliteProgramRaceWeek.js`. The library was tested and
// shipped but had no production call site — this card lights it up for
// the final 7 days before an A-race.
//
// Distinct from the older `RaceWeekProtocolCard.jsx`, which surfaces a
// DIFFERENT library (`generateRaceWeekProtocol` from `src/lib/race/`).
// Both can coexist; sources are independent.
//
// Behaviour: render NULL unless 0 ≤ days-to-race ≤ 7. Outside that
// window or with no raceDate → renders nothing.
//
// Sources: Mujika 2003 (taper) · Bosquet et al. 2007 (taper meta) ·
// Stellingwerff 2018 (race-week fueling) · Burke 2017 (CHO loading).

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  buildRaceWeekProtocol,
  classifyDistanceTier,
  RACE_WEEK_CITATION,
} from '../../lib/athlete/eliteProgramRaceWeek.js'
import { getProfileRaceDate } from '../../lib/validate.js'

const MONO = "'IBM Plex Mono', monospace"

// Normalise profile.primarySport → canonical sport code accepted by the
// library. Mirrors the mapping in MultiPeakSeasonCard so behaviour stays
// consistent across cards.
const SPORT_FROM_PROFILE = {
  Running: 'run', running: 'run', run: 'run',
  Cycling: 'bike', cycling: 'bike', bike: 'bike',
  Swimming: 'swim', swimming: 'swim', swim: 'swim',
  Triathlon: 'triathlon', triathlon: 'triathlon',
  Rowing: 'rowing', rowing: 'rowing',
}

// Day-of-week labels: index = Date#getUTCDay() (0=Sun..6=Sat).
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

function todayUTCISO() {
  return new Date().toISOString().slice(0, 10)
}

function parseISODate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(iso + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function daysBetween(fromIso, toIso) {
  const a = parseISODate(fromIso)
  const b = parseISODate(toIso)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function addDaysISO(iso, n) {
  const d = parseISODate(iso)
  if (!d) return null
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function EliteRaceWeekCard({ profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const raceDate = getProfileRaceDate(profile)
  const today = todayUTCISO()
  const daysToRace = raceDate ? daysBetween(today, raceDate) : null

  const sport = useMemo(() => {
    const raw = profile?.primarySport || profile?.sport
    return SPORT_FROM_PROFILE[raw] || 'run'
  }, [profile?.primarySport, profile?.sport])

  const distanceM = Number(profile?.raceDistanceM) || undefined

  const protocol = useMemo(() => {
    if (raceDate === null) return null
    if (daysToRace === null) return null
    if (daysToRace < 0 || daysToRace > 7) return null
    return buildRaceWeekProtocol({ sport, raceDate, raceDistanceM: distanceM, today })
  }, [sport, raceDate, distanceM, today, daysToRace])

  // RACE-WEEK gate: 0 ≤ days-to-race ≤ 7 only.
  if (!raceDate) return null
  if (daysToRace === null) return null
  if (daysToRace < 0 || daysToRace > 7) return null
  if (!protocol) return null

  const tier = classifyDistanceTier(sport, distanceM)
  const ariaLabel = isTR ? 'Elit yarış haftası protokolü' : 'Elite race week protocol'
  const title = isTR ? 'ELİT YARIŞ HAFTASI' : 'ELITE RACE WEEK'
  const isRaceDay = daysToRace === 0
  const countLabel = isRaceDay
    ? (isTR ? 'YARIŞ GÜNÜ' : 'RACE DAY')
    : (isTR ? `YARIŞA ${daysToRace} GÜN` : `${daysToRace} DAY${daysToRace === 1 ? '' : 'S'} TO RACE`)

  // Each schedule entry has tMinus 7..0. Convert to a real calendar date
  // so we can attach a bilingual day-of-week label (Mon/Pzt etc.).
  const rows = protocol.schedule.map(d => {
    const dateISO = addDaysISO(raceDate, -d.tMinus)
    const parsed = parseISODate(dateISO)
    const dow = parsed ? parsed.getUTCDay() : null
    const dayLabel = dow === null
      ? d.day
      : (isTR ? DOW_TR[dow] : DOW_EN[dow])
    return { ...d, dateISO, dayLabel, isToday: dateISO === today }
  })

  const raceDay = protocol.raceDay

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-elite-race-week-card={isRaceDay ? 'race-day' : 'race-week'}
      style={{
        ...S.card,
        borderLeft: '4px solid #ff6600',
        background: '#ff660008',
        fontFamily: MONO,
      }}
    >
      {/* Header ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 12, flexWrap: 'wrap', marginBottom: 10,
      }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0, color: '#ff6600' }}>
          {title}
        </div>
        <div style={{ textAlign: 'center', minWidth: 60 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#ff6600', lineHeight: 1 }}>
            {daysToRace}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', letterSpacing: '0.08em', marginTop: 2 }}>
            {countLabel}
          </div>
        </div>
      </div>

      {tier ? (
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 10, letterSpacing: '0.04em' }}>
          {isTR ? 'MESAFE' : 'DISTANCE'}: {tier.toUpperCase()} · {sport.toUpperCase()}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 10, letterSpacing: '0.04em' }}>
          {isTR ? 'SPOR' : 'SPORT'}: {sport.toUpperCase()}
        </div>
      )}

      {/* 7-day schedule ─────────────────────────────────────────────── */}
      <table
        data-elite-race-week-schedule
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 10 }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--muted, #888)', fontSize: 9, letterSpacing: '0.06em' }}>
              {isTR ? 'GÜN' : 'DAY'}
            </th>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--muted, #888)', fontSize: 9, letterSpacing: '0.06em' }}>
              T-
            </th>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--muted, #888)', fontSize: 9, letterSpacing: '0.06em' }}>
              {isTR ? 'SEANS' : 'SESSION'}
            </th>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--muted, #888)', fontSize: 9, letterSpacing: '0.06em' }}>
              {isTR ? 'BESLENME' : 'FUELING'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(d => (
            <tr
              key={d.tMinus}
              data-elite-race-week-row
              data-t-minus={d.tMinus}
              data-is-today={d.isToday ? 'true' : 'false'}
              style={{
                borderBottom: '1px solid var(--border)',
                background: d.isToday ? '#ff660022' : 'transparent',
              }}
            >
              <td style={{ padding: '4px 6px', color: d.isToday ? '#ff6600' : 'var(--text)', fontWeight: d.isToday ? 700 : 400, whiteSpace: 'nowrap' }}>
                {d.dayLabel}
              </td>
              <td style={{ padding: '4px 6px', color: 'var(--muted, #888)', whiteSpace: 'nowrap' }}>
                T-{d.tMinus}
              </td>
              <td style={{ padding: '4px 6px', color: 'var(--text)', lineHeight: 1.4 }}>
                {isTR ? d.session.tr : d.session.en}
              </td>
              <td style={{ padding: '4px 6px', color: 'var(--muted, #888)', lineHeight: 1.4 }}>
                {isTR ? d.fueling.tr : d.fueling.en}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Race-day tags ──────────────────────────────────────────────── */}
      <div
        data-elite-race-week-raceday
        style={{
          display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10,
          padding: 8, background: 'var(--card-bg)',
          border: '1px solid #ff660033', borderRadius: 4,
        }}
      >
        <div style={{ fontSize: 9, color: '#ff6600', letterSpacing: '0.08em', fontWeight: 700 }}>
          {isTR ? 'YARIŞ GÜNÜ' : 'RACE DAY'}
        </div>
        <div data-elite-race-week-warmup style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
          <span style={{ color: '#0064ff', fontWeight: 600 }}>
            {isTR ? 'ISINMA' : 'WARM-UP'}:
          </span>{' '}
          {isTR ? raceDay.warmup.tr : raceDay.warmup.en}
        </div>
        <div data-elite-race-week-fueling style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
          <span style={{ color: '#5bc25b', fontWeight: 600 }}>
            {isTR ? 'BESLENME' : 'FUELING'}:
          </span>{' '}
          {isTR ? raceDay.fueling.tr : raceDay.fueling.en}
        </div>
      </div>

      {/* Citation ──────────────────────────────────────────────────── */}
      <div
        data-elite-race-week-citation
        style={{
          fontSize: 9, color: 'var(--muted, #888)', letterSpacing: '0.03em',
          borderTop: '1px solid var(--border)', paddingTop: 6, fontStyle: 'italic',
          lineHeight: 1.5,
        }}
      >
        {RACE_WEEK_CITATION}
      </div>
    </div>
  )
}
