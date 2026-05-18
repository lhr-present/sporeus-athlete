// ─── src/lib/athlete/preRaceSleepBanking.js ──────────────────────────────────
// Pre-race sleep banking detector — the race-specific protocol of accumulating
// EXTRA sleep in the days before a race to buffer against the (almost
// inevitable) poor race-night sleep caused by nerves / unfamiliar room /
// early alarm.
//
// Distinct from `sleepDebt.js` (rolling shortfall vs target). Banking is a
// pre-race performance protocol, not a chronic-deficit metric.
//
// Protocol (Mah 2011 / Walker 2017 / Halson 2014):
//   - In the 7-day pre-race window, target sleep ≥ (sleepTargetHours + 0.5h).
//   - Mah 2011 (Sleep 34:943): elite basketball players who extended sleep
//     to 9h+ for 5–7 weeks improved shooting accuracy and reaction time.
//   - Race-night sleep is typically poor (nerves, novel environment,
//     early start). Banking 1–2h surplus per night across the prior week
//     partially compensates for the deficit on race night itself.
//   - "Successful banking" = ≥ 4 of the 7 pre-race nights at or above
//     the banking threshold.
//
// This pure-fn returns null when:
//   - no race date (athlete hasn't entered one)
//   - the race is in the past
//   - the race is > `windowDays` days away (too early to surface)
//
// References:
//   Mah 2011    — Sleep extension improves athletic performance (Sleep 34:943)
//   Walker 2017 — Why We Sleep
//   Halson 2014 — Sleep and the elite athlete

import { getProfileRaceDate } from '../validate.js'

export const PRE_RACE_SLEEP_BANKING_CITATION = 'Mah 2011; Walker 2017; Halson 2014'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Match the existing sleepDebt.js helper so this card and SleepDebtCard read
// recovery rows identically. Primary field is `sleepHrs`; long-form
// `sleepHours` is accepted as a fallback. Same sanity bounds (0 < v < 24).
function pickSleepHours(entry) {
  if (!entry) return null
  const raw = entry.sleepHrs ?? entry.sleepHours
  const v = parseFloat(raw)
  if (!Number.isFinite(v)) return null
  if (v <= 0 || v >= 24) return null
  return Math.round(v * 10) / 10
}

function parseISODate(s) {
  if (typeof s !== 'string' || s.length < 10) return null
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function toISO(d) { return d.toISOString().slice(0, 10) }

function todayUTC(today) {
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  }
  if (typeof today === 'string' && today) {
    return parseISODate(today)
  }
  if (today == null) {
    const n = new Date()
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
  }
  return null
}

const MS_PER_DAY = 86400000

function classify(nightsBanked) {
  if (nightsBanked >= 4) return 'BANKED'
  if (nightsBanked >= 2) return 'PARTIAL'
  return 'NEEDS_FOCUS'
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect pre-race sleep banking — count nights ≥ (target + 0.5h) in the
 * trailing `windowDays` window leading into a race.
 *
 * @param {Object} params
 * @param {Array}  params.recovery        Recovery entries (date + sleepHrs / sleepHours).
 * @param {Object} [params.profile]       Profile object; reads `raceDate` /
 *                                        `nextRaceDate` + `sleepTargetHours`.
 * @param {string|Date} [params.today]    ISO date 'YYYY-MM-DD' or Date.
 * @param {number} [params.windowDays=7]  Window of pre-race nights to inspect.
 * @returns {{
 *   daysToRace:number,
 *   nightsBanked:number,
 *   nightsTotal:number,
 *   status:'BANKED'|'PARTIAL'|'NEEDS_FOCUS',
 *   perNight:Array<{ date:string, sleepHrs:number, isBanked:boolean }>,
 *   citation:string
 * } | null}
 */
export function detectPreRaceSleepBanking({
  recovery,
  profile,
  today,
  windowDays = 7,
} = {}) {
  const windowN = Math.max(1, Math.floor(Number(windowDays) || 7))

  // Race date — null when missing, past, or > windowDays out.
  const raceISO = getProfileRaceDate(profile || null)
  const raceDate = parseISODate(raceISO)
  if (!raceDate) return null

  const todayDate = todayUTC(today)
  if (!todayDate) return null

  const daysToRace = Math.floor((raceDate.getTime() - todayDate.getTime()) / MS_PER_DAY)
  if (daysToRace < 0) return null
  if (daysToRace > windowN) return null

  // Sleep target — fall back to 8h, sanity-bounded.
  const rawTarget = parseFloat(profile?.sleepTargetHours)
  const targetHours = Number.isFinite(rawTarget) && rawTarget >= 4 && rawTarget <= 12
    ? Math.round(rawTarget * 10) / 10
    : 8
  const bankingThreshold = Math.round((targetHours + 0.5) * 10) / 10

  // Build the trailing windowN-day window ending at today (inclusive).
  const cutoff = new Date(todayDate.getTime())
  cutoff.setUTCDate(cutoff.getUTCDate() - (windowN - 1))
  const cutoffISO = toISO(cutoff)
  const todayISO = toISO(todayDate)

  // De-dupe by date — one recovery row per day (latest write wins).
  const recoveryByDate = new Map()
  if (Array.isArray(recovery)) {
    for (const r of recovery) {
      if (!r || typeof r.date !== 'string') continue
      const d = r.date.slice(0, 10)
      if (d < cutoffISO || d > todayISO) continue
      recoveryByDate.set(d, r)
    }
  }

  // Walk the window oldest-first, accumulate per-night data.
  const perNight = []
  let nightsBanked = 0
  let nightsTotal = 0
  const cursor = new Date(cutoff.getTime())
  while (cursor <= todayDate) {
    const iso = toISO(cursor)
    const entry = recoveryByDate.get(iso)
    const sleep = pickSleepHours(entry)
    if (sleep !== null) {
      const isBanked = sleep >= bankingThreshold
      perNight.push({ date: iso, sleepHrs: sleep, isBanked })
      if (isBanked) nightsBanked += 1
      nightsTotal += 1
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return {
    daysToRace,
    nightsBanked,
    nightsTotal,
    status: classify(nightsBanked),
    perNight,
    citation: PRE_RACE_SLEEP_BANKING_CITATION,
  }
}
