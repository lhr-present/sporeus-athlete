// ─── restDayDistribution.js — Where do rest days fall in the microcycle? ────
// Analyzes the 28-day microcycle for the placement of REST days relative to
// HARD days. Classic hard-easy structure (Bompa 2018) calls for a rest /
// easy day immediately AFTER a hard session. This module quantifies how
// often the athlete actually follows that structure and surfaces the
// suboptimal "rest scattered randomly" pattern that drives monotony
// (Foster 2001).
//
// Pure — no React, no globals. `today` is required to make the trailing
// window deterministic for tests; defaults to `new Date()`.
//
// Cite: Bompa 2018 (microcycle planning + rest day placement); Foster 2001
// (training monotony — uniform load distribution increases illness/injury
// risk).
// ─────────────────────────────────────────────────────────────────────────────

export const REST_DAY_DISTRIBUTION_CITATION = 'Bompa 2018; Foster 2001'

const HARD_RPE_THRESHOLD = 7   // RPE >= 7 → HARD
const MIN_REST_DAYS      = 4   // < 4 rest in 28d → TOO_FEW_REST
const MIN_ACTIVE_DAYS    = 5   // < 5 active days → return null
const POST_HARD_RATE_OK  = 0.5 // >= 50% hard days followed by rest → WELL_PLACED

// ─── Helpers ────────────────────────────────────────────────────────────────
function toUTCDate(input) {
  if (input instanceof Date) {
    return new Date(Date.UTC(
      input.getUTCFullYear(),
      input.getUTCMonth(),
      input.getUTCDate(),
    ))
  }
  if (typeof input === 'string') {
    const s = input.length === 10 ? input + 'T00:00:00Z' : input
    const d = new Date(s)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function ymd(date) {
  return date.toISOString().slice(0, 10)
}

function addDaysUTC(date, days) {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

// ─── analyzeRestDayDistribution ─────────────────────────────────────────────
/**
 * Classify the placement of rest days over the trailing `windowDays`.
 *
 * @param {Object} args
 * @param {Array}  args.log         - sessions `{ date: 'YYYY-MM-DD', rpe }`
 * @param {Date|string} [args.today] - reference "now" (defaults to new Date())
 * @param {number} [args.windowDays=28]
 * @returns {{
 *   pattern: 'WELL_PLACED'|'MIXED'|'TOO_FEW_REST',
 *   restDayCount: number,
 *   hardDayCount: number,
 *   easyDayCount: number,
 *   postHardRestCount: number,
 *   postHardRestRate: number,
 *   citation: string
 * } | null}
 */
export function analyzeRestDayDistribution({ log, today, windowDays = 28 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  const N = Math.max(1, Math.floor(windowDays || 28))

  const todayUTC = toUTCDate(today || new Date())
  // Window: [windowStart, todayUTC] inclusive → N days total.
  const windowStart = addDaysUTC(todayUTC, -(N - 1))

  // Need a FULL window from the first log entry to today. Compute oldest log
  // date; require (today - oldest) >= (N - 1) days so we have at least N
  // calendar days of history to analyze.
  let oldestDate = null
  for (const entry of log) {
    if (!entry || !entry.date) continue
    const ds = String(entry.date).slice(0, 10)
    if (!oldestDate || ds < oldestDate) oldestDate = ds
  }
  if (!oldestDate) return null
  const oldestUTC = toUTCDate(oldestDate)
  const diffDays = Math.floor((todayUTC - oldestUTC) / 86400000)
  if (diffDays < N - 1) return null

  // Bucket sessions in-window by YMD, accumulating max RPE per day.
  const startStr = ymd(windowStart)
  const endStr   = ymd(todayUTC)
  const maxRpeByDay = new Map() // 'YYYY-MM-DD' → max RPE seen
  const hasSessionByDay = new Set()

  for (const entry of log) {
    if (!entry || !entry.date) continue
    const dateStr = String(entry.date).slice(0, 10)
    if (dateStr < startStr || dateStr > endStr) continue
    hasSessionByDay.add(dateStr)
    const rpe = Number(entry.rpe)
    if (Number.isFinite(rpe)) {
      const prev = maxRpeByDay.get(dateStr)
      if (prev == null || rpe > prev) maxRpeByDay.set(dateStr, rpe)
    } else if (!maxRpeByDay.has(dateStr)) {
      // session with no RPE → treat as 0 unless something higher exists
      maxRpeByDay.set(dateStr, 0)
    }
  }

  if (hasSessionByDay.size < MIN_ACTIVE_DAYS) return null

  // Walk the window day-by-day and classify each day.
  // 0 = REST, 1 = EASY, 2 = HARD
  const classes = new Array(N)
  let restDayCount = 0
  let hardDayCount = 0
  let easyDayCount = 0
  for (let i = 0; i < N; i++) {
    const dateStr = ymd(addDaysUTC(windowStart, i))
    if (!hasSessionByDay.has(dateStr)) {
      classes[i] = 0
      restDayCount++
    } else {
      const maxRpe = maxRpeByDay.get(dateStr) ?? 0
      if (maxRpe >= HARD_RPE_THRESHOLD) {
        classes[i] = 2
        hardDayCount++
      } else {
        classes[i] = 1
        easyDayCount++
      }
    }
  }

  // For each REST day, check whether the PRECEDING day was HARD.
  // Day 0 of the window has no preceding day in-window → cannot count it.
  let postHardRestCount = 0
  for (let i = 1; i < N; i++) {
    if (classes[i] === 0 && classes[i - 1] === 2) {
      postHardRestCount++
    }
  }

  const postHardRestRate = hardDayCount > 0
    ? postHardRestCount / hardDayCount
    : 0

  // Classify pattern.
  let pattern
  if (restDayCount < MIN_REST_DAYS) {
    pattern = 'TOO_FEW_REST'
  } else if (postHardRestRate >= POST_HARD_RATE_OK && restDayCount >= MIN_REST_DAYS) {
    pattern = 'WELL_PLACED'
  } else {
    pattern = 'MIXED'
  }

  return {
    pattern,
    restDayCount,
    hardDayCount,
    easyDayCount,
    postHardRestCount,
    postHardRestRate: Math.round(postHardRestRate * 1000) / 1000,
    citation: REST_DAY_DISTRIBUTION_CITATION,
  }
}

export default analyzeRestDayDistribution
