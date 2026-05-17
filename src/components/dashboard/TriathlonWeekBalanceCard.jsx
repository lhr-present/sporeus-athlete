// ─── TriathlonWeekBalanceCard.jsx — surface tri-week-balance validator ────────
//
// Wraps `validateTriathlonWeek` from src/lib/athlete/triathlonWeekBalance.js
// (shipped v9.166.0, EP-11) which was tested but had no Dashboard surface.
//
// Behaviour:
//   - Sport gate: render NULL unless profile.primarySport === 'triathlon'
//     (case-insensitive) OR the log shows ≥3 distinct discipline types.
//   - Extracts the current Mon–Sun week (containing today) from `log`,
//     normalises each entry into the validator's session shape
//     ({ day, discipline, durationMin, zones }), and runs the validator.
//   - Renders NULL if the week has <4 sessions or zero findings (a clean
//     week stays out of the way).
//   - When the validator reports R1/R2/R3 violations, surfaces them as a
//     bilingual list with the day(s), the rule code and the explanation
//     from the validator (Lambert 1997 / Seiler 2010 / Mujika 2003).
//
// Citations: Lambert 1997; Seiler 2010; Mujika 2003 (re-exported from the
// pure-fn module as TRI_WEEK_BALANCE_CITATION).

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  validateTriathlonWeek,
  TRI_WEEK_BALANCE_CITATION,
} from '../../lib/athlete/triathlonWeekBalance.js'

const MONO = "'IBM Plex Mono', monospace"
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Map a log-entry's free-text `type`/`sport` to the validator's
// canonical discipline tokens.  Anything we don't recognise stays as the
// raw lowercased string so the validator's "easy" classifier still picks
// it up (it only special-cases bike/run/swim/strength/rest by name).
function disciplineOf(entry) {
  const type = String(entry?.type || '').toLowerCase()
  const sport = String(entry?.sport || '').toLowerCase()
  if (type === 'rest' || sport === 'rest') return 'rest'
  if (/swim/.test(type) || /swim/.test(sport)) return 'swim'
  if (/bike|cycl|ride/.test(type) || /cycl|bike/.test(sport)) return 'bike'
  if (/run/.test(type) || /run/.test(sport)) return 'run'
  if (/strength|gym|lift|weight/.test(type) || /strength/.test(sport)) return 'strength'
  return type || 'easy'
}

function durationMinOf(entry) {
  // Log entries in this app store duration in minutes under `duration`.
  // Defensive fallbacks for variants seen across importers.
  const d = entry?.duration ?? entry?.durationMin ?? entry?.minutes
  const n = Number(d)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function zonesOf(entry) {
  const z = entry?.zones
  if (!z) return {}
  if (Array.isArray(z)) {
    // [Z1,Z2,Z3,Z4,Z5] (minutes)
    return {
      Z1: Number(z[0]) || 0,
      Z2: Number(z[1]) || 0,
      Z3: Number(z[2]) || 0,
      Z4: Number(z[3]) || 0,
      Z5: Number(z[4]) || 0,
    }
  }
  return z
}

// Mon-anchored ISO week for `today` (UTC; matches how log dates are
// stored as YYYY-MM-DD strings).  Returns the array of 7 YYYY-MM-DD
// strings Mon..Sun.
function currentWeekISO(today = new Date()) {
  const d = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ))
  // JS Sunday=0, Monday=1, ...  We want Monday as start.
  const dow = d.getUTCDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + mondayOffset)
  const out = []
  for (let i = 0; i < 7; i++) {
    const di = new Date(monday)
    di.setUTCDate(monday.getUTCDate() + i)
    out.push(di.toISOString().slice(0, 10))
  }
  return out
}

function dayLabelForISO(iso, weekISO) {
  const idx = weekISO.indexOf(iso)
  return idx >= 0 ? DAYS[idx] : null
}

function isTriathleteProfile(profile) {
  const raw = String(profile?.primarySport || '').toLowerCase()
  return raw === 'triathlon'
}

function distinctDisciplineCount(log) {
  const set = new Set()
  for (const e of (Array.isArray(log) ? log : [])) {
    const d = disciplineOf(e)
    if (d && d !== 'rest') set.add(d)
  }
  return set.size
}

export default function TriathlonWeekBalanceCard({ log = [], profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  // Sport gate (computed before week extraction so we short-circuit cheaply).
  const isGated = useMemo(
    () => isTriathleteProfile(profile) || distinctDisciplineCount(log) >= 3,
    [profile, log]
  )

  const result = useMemo(() => {
    if (!isGated) return null
    const weekISO = currentWeekISO(new Date())
    const isoSet = new Set(weekISO)
    // One synthetic session per logged entry inside this week (we don't
    // collapse multi-session days — the validator orders by day index
    // and treats adjacent days as adjacent, so a Tue-hard + Tue-easy
    // pair is fine).
    const weekSessions = []
    for (const e of (Array.isArray(log) ? log : [])) {
      if (!e?.date || !isoSet.has(e.date)) continue
      const day = dayLabelForISO(e.date, weekISO)
      if (!day) continue
      weekSessions.push({
        day,
        discipline: disciplineOf(e),
        durationMin: durationMinOf(e),
        zones: zonesOf(e),
      })
    }
    if (weekSessions.length < 4) return null
    const v = validateTriathlonWeek(weekSessions)
    if (!v || !Array.isArray(v.violations) || v.violations.length === 0) return null
    return v
  }, [isGated, log])

  if (!isGated) return null
  if (!result) return null

  const title = isTR ? 'TRİATLON HAFTA DENGESİ' : 'TRIATHLON WEEK BALANCE'
  const ariaLabel = isTR ? 'Triatlon haftalık denge denetimi' : 'Triathlon weekly balance audit'
  const intro = isTR
    ? 'Bu haftanın seansları Lambert 1997 / Seiler 2010 ritmiyle çakışıyor:'
    : 'This week\'s sessions clash with the Lambert 1997 / Seiler 2010 rhythm:'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-triathlon-week-balance-card
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
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: '#ff6600',
        marginBottom: 8,
      }}>
        <span style={{ marginRight: 6 }}>◢</span>
        {title}
      </div>

      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        lineHeight: 1.5,
        marginBottom: 8,
      }}>
        {intro}
      </div>

      <ul
        data-triathlon-week-balance-violations
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          marginBottom: 10,
        }}
      >
        {result.violations.map((v, i) => (
          <li
            key={`${v.rule}-${i}`}
            data-violation-rule={v.rule}
            style={{
              fontSize: 11,
              color: 'var(--text)',
              lineHeight: 1.5,
              padding: '6px 8px',
              marginBottom: 4,
              background: '#f5c54214',
              border: '1px solid #f5c54255',
              borderRadius: 3,
            }}
          >
            <span style={{ color: '#f5c542', marginRight: 6, fontWeight: 700 }}>
              ⚠ {v.rule}
            </span>
            <span>{isTR ? v.msg?.tr : v.msg?.en}</span>
          </li>
        ))}
      </ul>

      <div
        data-triathlon-week-balance-citation
        style={{
          fontSize: 9,
          color: '#555',
          fontStyle: 'italic',
        }}
      >
        {TRI_WEEK_BALANCE_CITATION}
      </div>
    </div>
  )
}
