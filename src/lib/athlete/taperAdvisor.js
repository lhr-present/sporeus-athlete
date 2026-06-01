// ─── src/lib/athlete/taperAdvisor.js — E38: Taper Advisor ────────────────────
// Computes taper recommendation based on race date proximity and athlete level.
// Uses volumeCutPct + applyVolumeReduction from planAdjust.js.
// References: Mujika & Padilla 2003, Bosquet 2007.

import { applyVolumeReduction, VOLUME_CUT_BY_LEVEL } from '../planAdjust.js'

// v9.365.0 (founder decision) — taper volume cut is ~50% FLAT (the Mujika 2003 /
// Bosquet 2007 performance-optimal 41–60% band), held independent of athlete
// level. Previously this reused planAdjust's INJURY-severity table (recreational
// 20% → elite 40%) — too shallow to shed accumulated fatigue, and conceptually
// wrong (taper depth isn't a function of training level). Intensity stays high;
// only volume drops.
const TAPER_VOLUME_CUT_PCT = 50

/**
 * Returns days until a 'YYYY-MM-DD' date from today.
 * Negative if the date is in the past. null if no date provided.
 * @param {string|null} dateStr — ISO date string
 * @param {string} today — ISO date string (default: today)
 * @returns {number|null}
 */
export function daysUntil(dateStr, today = new Date().toISOString().slice(0, 10)) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00Z')
  const base   = new Date(today   + 'T00:00:00Z')
  const diff   = Math.round((target - base) / (1000 * 60 * 60 * 24))
  return diff
}

/**
 * Compute taper recommendation for a given plan and profile.
 * Returns null when:
 *   - no plan or plan has no weeks
 *   - no race date in profile
 *   - race is already passed (daysUntilRace < 0)
 *   - race is > 90 days away
 *
 * @param {object|null} plan — plan object with .weeks array
 * @param {object} profile — { level, nextRaceDate, raceDate }
 * @param {string} today — ISO date override for testing
 * @returns {object|null}
 */
export function computeTaperAdvice(plan, profile = {}, today = new Date().toISOString().slice(0, 10)) {
  // Guard: plan must exist and have weeks
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return null

  // Race date — try nextRaceDate first, then raceDate
  const raceDate = profile?.nextRaceDate || profile?.raceDate || null
  if (!raceDate) return null

  const daysUntilRace = daysUntil(raceDate, today)
  if (daysUntilRace === null) return null
  if (daysUntilRace < 0)  return null    // race already passed
  if (daysUntilRace > 90) return null    // too far out

  const level    = profile?.level || profile?.athleteLevel || 'recreational'
  const cutPct   = TAPER_VOLUME_CUT_PCT   // ~50% flat (see top); level kept for display only

  // Taper start = 14 days before race
  const taperStartDate = (() => {
    const d = new Date(raceDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 14)
    return d.toISOString().slice(0, 10)
  })()

  const daysUntilTaperStart = daysUntil(taperStartDate, today)

  // Apply volume reduction to the taper window (14 days = 2 weeks)
  const taperedWeeks = applyVolumeReduction(plan.weeks, taperStartDate, 14, cutPct)

  // Status
  let status
  if (daysUntilRace <= 14) {
    status = 'taper_active'
  } else if (daysUntilRace <= 21) {
    status = 'taper_soon'
  } else {
    status = 'pre_taper'
  }

  return {
    raceDate,
    daysUntilRace,
    taperStartDate,
    cutPct:          cutPct / 100,
    cutPctDisplay:   `${cutPct}%`,
    level,
    taperedWeeks,
    daysUntilTaperStart,
    status,
    citation:        'Mujika & Padilla 2003 · Bosquet 2007',
  }
}

export { VOLUME_CUT_BY_LEVEL }
