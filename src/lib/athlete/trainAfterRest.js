// ─── trainAfterRest.js — Post-rest rebound load tracker ─────────────────────
// Common amateur pattern: feel guilty after a rest day, smash a hard workout
// the next day, end up over-stressed. Bompa 2018 (and Skorski 2019 in the
// specific context of high-intensity training spacing) argues that
// supercompensation is best harvested with a MODERATE session post-rest, not
// a maximal one — the athlete is detuned for high-intensity neural work
// after >24h off, but freshness can mask perceived effort and lead to
// overcommitment.
//
// What this module measures: mean session TSS the day AFTER a rest day,
// compared to overall mean training-day TSS, over the last `windowDays`
// (default 60).
//
//   reboundRatio = meanPostRestTss / max(meanTrainingDayTss, 1)
//
// Bands:
//   • CONSERVATIVE_REBOUND  (ratio ≤ 0.85)  — post-rest day is markedly easier
//   • BALANCED              (0.85 < r < 1.20)
//   • AGGRESSIVE_REBOUND    (ratio ≥ 1.20) — rebound overcommit pattern
//   • INSUFFICIENT_REBOUND_DAYS (postRestCount < 4)
//
// Why this is distinct from sibling cards:
//   • RestDayDistributionCard → does each rest day FOLLOW a hard day?
//   • HardDaySpacingCard       → gap between consecutive hard days
//   • TrainRestTrainPatternCard → isolated vs extended rest blocks
//   • TrainAfterRestCard (this) → mean session intensity the day AFTER a rest day
//
// Pure — no React, no I/O.
// ─────────────────────────────────────────────────────────────────────────────

export const TRAIN_AFTER_REST_CITATION = 'Bompa 2018; Skorski 2019'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_DAYS = 60
const MIN_POST_REST_DAYS = 4
const CONSERVATIVE_CEIL = 0.85
const AGGRESSIVE_FLOOR = 1.20

// ─── Date helpers (UTC, ISO YYYY-MM-DD) ─────────────────────────────────────
function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) {
      const y = Number(key.slice(0, 4))
      const m = Number(key.slice(5, 7))
      const d = Number(key.slice(8, 10))
      const dt = new Date(Date.UTC(y, m - 1, d))
      if (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
      ) return key
    }
  }
  return null
}

function isoAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}

// ─── Day-TSS bucket ─────────────────────────────────────────────────────────
// Sum finite tss > 0 across all entries for a given ISO date. Also tracks
// EVERY date that appears in the log (regardless of TSS) so we can tell
// "no log entry" (unobserved) apart from "log entry with zero TSS" (rest).
// Returns { tssByDay, seenDays, oldestSeen }.
function buildDayTssMap(log) {
  const tssByDay = new Map()
  const seenDays = new Set()
  let oldestSeen = null
  if (!Array.isArray(log)) return { tssByDay, seenDays, oldestSeen }
  for (const e of log) {
    if (!e) continue
    let dIso = null
    if (e.date instanceof Date && !Number.isNaN(e.date.getTime())) {
      dIso = e.date.toISOString().slice(0, 10)
    } else if (typeof e.date === 'string' && e.date) {
      const key = e.date.slice(0, 10)
      if (ISO_RE.test(key)) dIso = key
    }
    if (!dIso) continue
    seenDays.add(dIso)
    if (oldestSeen === null || dIso < oldestSeen) oldestSeen = dIso
    const tss = Number(e.tss)
    if (!Number.isFinite(tss) || tss <= 0) continue
    tssByDay.set(dIso, (tssByDay.get(dIso) ?? 0) + tss)
  }
  return { tssByDay, seenDays, oldestSeen }
}

// ─── analyzeTrainAfterRest ──────────────────────────────────────────────────
/**
 * @param {{
 *   log: Array<{ date: string|Date, tss?: number }>,
 *   today: string | Date,
 *   windowDays?: number,
 * }} args
 * @returns {{
 *   band: 'CONSERVATIVE_REBOUND'|'BALANCED'|'AGGRESSIVE_REBOUND'|'INSUFFICIENT_REBOUND_DAYS',
 *   postRestSessions: Array<{ date: string, dayTss: number, restDaysBefore: number }>,
 *   meanPostRestTss: number,
 *   meanTrainingDayTss: number,
 *   reboundRatio: number,
 *   postRestCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzeTrainAfterRest({
  log,
  today,
  windowDays = DEFAULT_WINDOW_DAYS,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    1,
    Math.floor(Number.isFinite(windowDays) ? windowDays : DEFAULT_WINDOW_DAYS)
  )

  const windowStartIso = isoAddDays(todayIso, -(safeWindow - 1))

  // Pre-bucket TSS + every observed date so the window walk + restDaysBefore
  // lookup are O(1) and unobserved-vs-rest is distinguishable.
  const { tssByDay, oldestSeen } = buildDayTssMap(log)

  // Walk every day from windowStart..today inclusive. Identify TRAINING days
  // (dayTss > 0) whose immediately-prior calendar day is a REST day
  // (dayTss === 0 / no entry). The immediate-prior-day lookup uses tssByDay
  // directly — which spans the full log including dates outside the window —
  // so a rest day sitting just before the window start CAN still mark the
  // first day of the window as "post-rest" when applicable.
  const postRestSessions = []
  let trainingDayCount = 0
  let trainingDayTssSum = 0

  for (let i = 0; i < safeWindow; i++) {
    const iso = isoAddDays(windowStartIso, i)
    const dayTss = tssByDay.get(iso) ?? 0
    if (dayTss <= 0) continue

    trainingDayCount += 1
    trainingDayTssSum += dayTss

    const priorIso = isoAddDays(iso, -1)
    const priorTss = tssByDay.get(priorIso) ?? 0
    if (priorTss > 0) continue  // prior day was training → not post-rest

    // Special-case the FIRST day of the window: its prior day is outside
    // the window, so we can only call it a "post-rest" day if there's
    // observed log history BEFORE windowStart (i.e. oldestSeen lies
    // strictly before windowStart). With no such history the prior day's
    // rest status is unverifiable → skip.
    if (priorIso < windowStartIso) {
      if (!oldestSeen || oldestSeen >= windowStartIso) continue
    }

    // Prior day was rest. Walk further back to count how many consecutive
    // rest days immediately precede this training day. For the FIRST-day
    // case we only walk back as far as the oldest observed log entry —
    // anything earlier is unobserved. For days IN the window, we still
    // bound the walk by oldestSeen when available (or windowStart) for
    // determinism. Hard cap at 365 for safety.
    let restDaysBefore = 1
    let cursor = isoAddDays(priorIso, -1)
    const walkFloor = oldestSeen && oldestSeen < windowStartIso
      ? oldestSeen
      : windowStartIso
    while (cursor >= walkFloor && restDaysBefore < 365) {
      const cTss = tssByDay.get(cursor) ?? 0
      if (cTss > 0) break
      restDaysBefore += 1
      cursor = isoAddDays(cursor, -1)
    }

    postRestSessions.push({
      date: iso,
      dayTss: round2(dayTss),
      restDaysBefore,
    })
  }

  // postRestSessions is already oldest-first because we iterated forward.

  const postRestCount = postRestSessions.length

  const meanPostRestTss = postRestCount > 0
    ? round2(
        postRestSessions.reduce((s, x) => s + x.dayTss, 0) / postRestCount
      )
    : 0

  const meanTrainingDayTss = trainingDayCount > 0
    ? round2(trainingDayTssSum / trainingDayCount)
    : 0

  const reboundRatio = meanPostRestTss === 0
    ? 0
    : round4(meanPostRestTss / Math.max(meanTrainingDayTss, 1))

  let band
  if (postRestCount < MIN_POST_REST_DAYS) {
    band = 'INSUFFICIENT_REBOUND_DAYS'
  } else if (reboundRatio <= CONSERVATIVE_CEIL) {
    band = 'CONSERVATIVE_REBOUND'
  } else if (reboundRatio >= AGGRESSIVE_FLOOR) {
    band = 'AGGRESSIVE_REBOUND'
  } else {
    band = 'BALANCED'
  }

  return {
    band,
    postRestSessions,
    meanPostRestTss,
    meanTrainingDayTss,
    reboundRatio,
    postRestCount,
    citation: TRAIN_AFTER_REST_CITATION,
  }
}

export default analyzeTrainAfterRest
