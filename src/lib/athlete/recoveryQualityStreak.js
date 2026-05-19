// ─── recoveryQualityStreak.js — Dual-Marker Recovery Quality Streak ─────────
//
// Tracks consecutive days where the athlete had BOTH:
//   1. Sufficient sleep duration (sleepHrs ≥ profile.sleepTarget or 8h default)
//   2. A "fresh" resting heart rate (restingHR ≤ lifetime baseline mean)
//
// This is intentionally DIFFERENT from `recoveryStreak.js` (which counts days
// of high subjective readiness on a 0–100 scale). This card combines two
// objective physiological signals — sleep duration and resting HR — into a
// single "quality recovery" indicator.
//
// Scientific grounding:
//   Walker 2017 — sleep is the foundation of cardiovascular and metabolic
//     recovery; chronic short sleep blunts the adaptive response to training.
//   Buchheit 2014 — resting HR (especially morning RHR) is a low-cost
//     marker of autonomic balance; sustained elevation above an individual
//     baseline indicates incomplete recovery / accumulating fatigue.
//
// Combining the two filters out false positives from each marker alone:
//   - Long sleep with elevated RHR → physiological stress despite duration.
//   - Low RHR with short sleep    → may be cardiovascularly fine but
//     missing the sleep-driven hormonal / cognitive recovery window.
//
// Pure function. No I/O. No side effects.

export const RECOVERY_QUALITY_STREAK_CITATION = 'Walker 2017; Buchheit 2014'

const MS_PER_DAY = 86400000
const DEFAULT_SLEEP_TARGET = 8.0
const MIN_RHR_ENTRIES_FOR_BASELINE = 10
const QUALITY_WINDOW_DAYS = 28

// Stable UTC-noon day key to dodge DST / timezone boundary issues.
function dayKey(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null
  const d = new Date(iso.slice(0, 10) + 'T12:00:00Z')
  const t = d.getTime()
  if (Number.isNaN(t)) return null
  return Math.floor(t / MS_PER_DAY)
}

function num(v) {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * @description Compute the recovery QUALITY streak — consecutive days where
 * BOTH sleep ≥ target AND restingHR ≤ lifetime baseline.
 *
 * @param {Object}   args
 * @param {Array}    args.recovery - recovery entries; need `date`, `sleepHrs`, `restingHR`
 * @param {Object}   [args.profile] - profile, optional `sleepTarget`
 * @param {string}   [args.today]   - 'YYYY-MM-DD'; defaults to today (UTC)
 *
 * @returns {{
 *   status:               'DEEP_RECOVERY' | 'STEADY' | 'INCONSISTENT',
 *   currentStreak:        number,
 *   longestStreak:        number,
 *   totalQualityDays28:   number,
 *   sleepTarget:          number,
 *   lifetimeBaselineRHR:  number,
 *   citation:             string,
 * } | null}
 *
 * Returns null when:
 *   - recovery is empty / not an array
 *   - fewer than 10 entries have a valid restingHR (baseline can't be trusted)
 */
export function analyzeRecoveryQualityStreak({
  recovery,
  profile,
  today,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  // ── Sleep target: profile.sleepTarget if parseable, else 8h default ────────
  const profileTarget = num(profile?.sleepTarget)
  const sleepTarget = Number.isFinite(profileTarget) && profileTarget > 0
    ? profileTarget
    : DEFAULT_SLEEP_TARGET

  // ── Lifetime baseline RHR across ALL entries with restingHR > 0 ─────────────
  let rhrSum = 0
  let rhrCount = 0
  for (const e of recovery) {
    const rhr = num(e?.restingHR)
    if (Number.isFinite(rhr) && rhr > 0) {
      rhrSum += rhr
      rhrCount += 1
    }
  }
  if (rhrCount < MIN_RHR_ENTRIES_FOR_BASELINE) return null

  const lifetimeBaselineRHR = rhrSum / rhrCount

  // ── Bucket entries by day; latest by array index wins on collisions ────────
  // Keep both fields needed for the quality check.
  const dayMap = new Map()
  for (const e of recovery) {
    const k = dayKey(e?.date)
    if (k === null) continue
    const sleepHrs = num(e?.sleepHrs)
    const restingHR = num(e?.restingHR)
    dayMap.set(k, { sleepHrs, restingHR })
  }
  if (dayMap.size === 0) return null

  const isQualityDay = (rec) => {
    if (!rec) return false
    if (!Number.isFinite(rec.sleepHrs) || rec.sleepHrs < sleepTarget) return false
    if (!Number.isFinite(rec.restingHR) || rec.restingHR <= 0) return false
    if (rec.restingHR > lifetimeBaselineRHR) return false
    return true
  }

  const todayISO = (typeof today === 'string' && today.length >= 10)
    ? today.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const todayKey = dayKey(todayISO)
  if (todayKey === null) return null

  // ── Current streak: walk back from today; ANY non-quality day ends it. ────
  // Per spec: "if no entry for that day → streak ends" — strict, no grace day.
  let currentStreak = 0
  let cursor = todayKey
  while (dayMap.has(cursor)) {
    const rec = dayMap.get(cursor)
    if (!isQualityDay(rec)) break
    currentStreak += 1
    cursor -= 1
  }

  // ── Longest streak: scan every day from earliest to today ──────────────────
  // Use the sorted day-key range so missing days correctly break runs.
  let minKey = todayKey
  for (const k of dayMap.keys()) {
    if (k < minKey) minKey = k
  }
  let longestStreak = 0
  let run = 0
  for (let k = minKey; k <= todayKey; k++) {
    if (dayMap.has(k) && isQualityDay(dayMap.get(k))) {
      run += 1
      if (run > longestStreak) longestStreak = run
    } else {
      run = 0
    }
  }

  // ── Total quality days in the last 28 days (inclusive of today) ────────────
  let totalQualityDays28 = 0
  for (let k = todayKey - QUALITY_WINDOW_DAYS + 1; k <= todayKey; k++) {
    if (dayMap.has(k) && isQualityDay(dayMap.get(k))) totalQualityDays28 += 1
  }

  // ── Status classification ─────────────────────────────────────────────────
  let status
  if (currentStreak >= 5) status = 'DEEP_RECOVERY'
  else if (currentStreak >= 2) status = 'STEADY'
  else status = 'INCONSISTENT'

  return {
    status,
    currentStreak,
    longestStreak,
    totalQualityDays28,
    sleepTarget,
    lifetimeBaselineRHR,
    citation: RECOVERY_QUALITY_STREAK_CITATION,
  }
}
