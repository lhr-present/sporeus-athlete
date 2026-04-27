// src/lib/athlete/strengthTraining.js — Strength science primitives
// Pure functions, zero deps. Pattern: named exports, JSDoc, deterministic.

// ── 1RM Estimation ────────────────────────────────────────────────────────────

/**
 * Estimate 1RM using three published formulas.
 * @param {number} weight - lifted weight (kg)
 * @param {number} reps   - reps performed (1–30)
 * @returns {{ epley: number, brzycki: number, lombardi: number, median: number } | null}
 */
export function estimate1RM(weight, reps) {
  if (!weight || weight <= 0 || !reps || reps <= 0 || reps > 30) return null
  if (reps === 1) return { epley: weight, brzycki: weight, lombardi: weight, median: weight }

  const epley    = weight * (1 + reps / 30)
  const brzycki  = weight * (36 / (37 - reps))
  const lombardi = weight * Math.pow(reps, 0.1)

  const sorted = [epley, brzycki, lombardi].sort((a, b) => a - b)
  const median = sorted[1]

  return {
    epley:    Math.round(epley * 10) / 10,
    brzycki:  Math.round(brzycki * 10) / 10,
    lombardi: Math.round(lombardi * 10) / 10,
    median:   Math.round(median * 10) / 10,
  }
}

// ── Load from %1RM ────────────────────────────────────────────────────────────

/**
 * Calculate working load from a 1RM and a target percentage.
 * Rounds to nearest 2.5 kg.
 * @param {number} oneRM    - 1RM in kg
 * @param {number} percent  - 0–1 (e.g. 0.75 = 75%)
 * @returns {number | null}
 */
export function loadFromPercent1RM(oneRM, percent) {
  if (!oneRM || oneRM <= 0 || !percent || percent <= 0 || percent > 1) return null
  const raw = oneRM * percent
  return Math.round(raw / 2.5) * 2.5
}

// ── RIR → %1RM (Helms RPE/RIR chart) ─────────────────────────────────────────

// Helms et al. 2016 RPE chart approximation: reps × RIR → %1RM
const RIR_TABLE = {
  1:  { 0: 1.00, 1: 0.978, 2: 0.956, 3: 0.933, 4: 0.911, 5: 0.889 },
  2:  { 0: 0.955, 1: 0.933, 2: 0.911, 3: 0.889, 4: 0.867, 5: 0.844 },
  3:  { 0: 0.922, 1: 0.900, 2: 0.878, 3: 0.856, 4: 0.833, 5: 0.811 },
  4:  { 0: 0.889, 1: 0.867, 2: 0.844, 3: 0.822, 4: 0.800, 5: 0.778 },
  5:  { 0: 0.867, 1: 0.844, 2: 0.822, 3: 0.800, 4: 0.778, 5: 0.756 },
  6:  { 0: 0.844, 1: 0.822, 2: 0.800, 3: 0.778, 4: 0.756, 5: 0.733 },
  7:  { 0: 0.822, 1: 0.800, 2: 0.778, 3: 0.756, 4: 0.733, 5: 0.711 },
  8:  { 0: 0.800, 1: 0.778, 2: 0.756, 3: 0.733, 4: 0.711, 5: 0.689 },
  10: { 0: 0.756, 1: 0.733, 2: 0.711, 3: 0.689, 4: 0.667, 5: 0.644 },
  12: { 0: 0.711, 1: 0.689, 2: 0.667, 3: 0.644, 4: 0.622, 5: 0.600 },
  15: { 0: 0.644, 1: 0.622, 2: 0.600, 3: 0.578, 4: 0.556, 5: 0.533 },
}

/**
 * Estimate %1RM from reps and reps-in-reserve (Helms 2016 approximation).
 * @param {number} reps - reps performed
 * @param {number} rir  - reps left in tank (0–5)
 * @returns {number | null} - 0..1
 */
export function rirToPercent1RM(reps, rir) {
  if (reps == null || rir == null || reps < 1 || rir < 0 || rir > 5) return null
  // Find closest reps row
  const keys = Object.keys(RIR_TABLE).map(Number).sort((a, b) => a - b)
  let closest = keys[0]
  for (const k of keys) {
    if (Math.abs(k - reps) < Math.abs(closest - reps)) closest = k
  }
  return RIR_TABLE[closest][Math.min(rir, 5)] ?? null
}

// ── Weekly Hard Sets ──────────────────────────────────────────────────────────

/**
 * Count "hard sets" per muscle from a set list.
 * Hard set = RIR ≤ 3 AND reps ≥ 5 (Schoenfeld 2017 definition).
 * @param {Array<{muscle: string, rir: number, reps: number}>} sets
 * @returns {number}
 */
export function weeklyHardSets(sets) {
  if (!Array.isArray(sets)) return 0
  return sets.filter(s => s != null && s.rir <= 3 && s.reps >= 5).length
}

// ── Volume Landmarks ──────────────────────────────────────────────────────────

// Schoenfeld 2017 / Israetel RP defaults (hard sets/week per muscle)
const LANDMARKS = {
  chest:      { mev: 8,  mav: 14, mrv: 22 },
  back:       { mev: 8,  mav: 14, mrv: 22 },
  quads:      { mev: 8,  mav: 14, mrv: 22 },
  hamstrings: { mev: 8,  mav: 14, mrv: 22 },
  delts:      { mev: 8,  mav: 14, mrv: 22 },
  glutes:     { mev: 8,  mav: 14, mrv: 22 },
  biceps:     { mev: 6,  mav: 12, mrv: 20 },
  triceps:    { mev: 6,  mav: 12, mrv: 20 },
  calves:     { mev: 6,  mav: 12, mrv: 18 },
  core:       { mev: 6,  mav: 12, mrv: 18 },
  full:       { mev: 8,  mav: 14, mrv: 22 },
}

/**
 * MEV / MAV / MRV landmarks for a muscle group.
 * @param {string} muscle
 * @returns {{ mev: number, mav: number, mrv: number } | null}
 */
export function volumeLandmarks(muscle) {
  return LANDMARKS[muscle] ?? null
}

// ── Volume Status ─────────────────────────────────────────────────────────────

/**
 * Traffic-light volume status.
 * @param {number} weeklySets
 * @param {string} muscle
 * @returns {'under' | 'optimal' | 'over' | null}
 */
export function volumeStatus(weeklySets, muscle) {
  const lm = volumeLandmarks(muscle)
  if (!lm || weeklySets == null || weeklySets < 0) return null
  if (weeklySets < lm.mev) return 'under'
  if (weeklySets > lm.mrv) return 'over'
  return 'optimal'
}

// ── Linear Progression ────────────────────────────────────────────────────────

/**
 * Suggest next-session load for a loaded exercise.
 *
 * Two-axis decision:
 * 1. Performance history: overload / hold / stall-deload
 * 2. Gap (days since last session): caps or reduces load after long breaks
 *
 * Gap rules (never punishes the gap, only shapes the suggestion):
 *   < 14 days  → normal performance logic
 *   14–30 days → cap at last load (no overload)
 *   30–90 days → 90% of last load, rep range +2
 *   > 90 days  → 80% of last load, rep range +3, reorientation flag
 *
 * @param {Array<{reps: number, load_kg: number, rir: number|null, is_warmup: boolean}>} history
 * @param {{ reps_low: number, reps_high: number, is_bodyweight?: boolean }} exercise
 * @param {number|null} [gap_days] - days since last session for this exercise
 * @returns {{ load_kg: number|null, reps_low: number, reps_high: number, reason: string, reorientation?: boolean }}
 */
export function suggestNextLoad(history, exercise, gap_days = null) {
  const { reps_low, reps_high, is_bodyweight = false } = exercise ?? {}
  if (!Array.isArray(history) || history.length === 0 || !reps_low || !reps_high) {
    return { load_kg: null, reps_low, reps_high, reason: 'no_history' }
  }

  const workSets = history.filter(s => !s?.is_warmup)
  if (workSets.length === 0) {
    return { load_kg: null, reps_low, reps_high, reason: 'no_work_sets' }
  }

  const last = workSets[workSets.length - 1]
  const prev = workSets.length >= 2 ? workSets[workSets.length - 2] : null

  let stallCount = 0
  for (let i = workSets.length - 1; i >= Math.max(0, workSets.length - 3); i--) {
    if (workSets[i].reps < reps_high || workSets[i].rir === 0) stallCount++
    else break
  }

  const lastLoad  = parseFloat(last.load_kg ?? 0)
  const increment = is_bodyweight ? 0 : (lastLoad >= 60 ? 2.5 : 1.25)

  // ── Gap override (applied before performance logic) ────────────────────────
  if (!is_bodyweight && gap_days != null && gap_days > 13) {
    if (gap_days > 90) {
      const load = Math.round((lastLoad * 0.8) / 2.5) * 2.5
      return { load_kg: load, reps_low, reps_high: reps_high + 3, reason: 'gap_return', reorientation: true }
    }
    if (gap_days > 30) {
      const load = Math.round((lastLoad * 0.9) / 2.5) * 2.5
      return { load_kg: load, reps_low, reps_high: reps_high + 2, reason: 'gap_return' }
    }
    // 14–30 days: cap at last load
    return { load_kg: lastLoad, reps_low, reps_high, reason: 'hold' }
  }

  // Deload
  if (stallCount >= 3) {
    const deloadLoad = is_bodyweight ? null : Math.round((lastLoad * 0.8) / 2.5) * 2.5
    return { load_kg: deloadLoad, reps_low, reps_high, reason: 'deload' }
  }

  // Missed reps / failure
  if (last.reps < reps_low || last.rir === 0) {
    return { load_kg: is_bodyweight ? null : lastLoad, reps_low, reps_high, reason: 'hold' }
  }

  // Both last two sessions hit top range with RIR ≥ 1
  const lastHitTop = last.reps >= reps_high && (last.rir == null || last.rir >= 1)
  const prevHitTop = prev && prev.reps >= reps_high && (prev.rir == null || prev.rir >= 1)

  if (lastHitTop && (prevHitTop || workSets.length === 1)) {
    if (is_bodyweight) {
      return { load_kg: null, reps_low: reps_high, reps_high: reps_high + 2, reason: 'add_reps' }
    }
    return { load_kg: lastLoad + increment, reps_low, reps_high, reason: 'add_weight' }
  }

  // Default: hold
  return { load_kg: is_bodyweight ? null : lastLoad, reps_low, reps_high, reason: 'hold' }
}

// ── Program Suggestion ────────────────────────────────────────────────────────

/**
 * Suggest a template ID from onboarding answers.
 * @param {{ goal: string, days: number, equipment: string, experience: string }} params
 * @returns {string} - template ID
 */
export function suggestTemplate({ goal, days, equipment, experience } = {}) {
  const eq = equipment ?? 'gym'
  const exp = experience ?? 'beginner'

  if (eq === 'bw')                              return 'bw_starter_3day'
  if (eq === 'home' && days <= 3)               return 'home_db_3day'
  if (eq === 'home' && days >= 4)               return 'home_db_4day'

  if (goal === 'recomp')                        return 'recomp_4day'
  if (goal === 'muscle' && days >= 6)           return 'ppl_6day_intermediate'
  if (goal === 'muscle' && days === 5)          return 'ppl_6day_intermediate'
  if (goal === 'muscle' && days <= 3)           return 'ppl_3day_beginner'
  if (goal === 'muscle' && days === 4 && exp === 'intermediate') return 'ul_4day_intermediate'
  if (goal === 'muscle' && days === 4)          return 'ul_4day_beginner'

  if (goal === 'strength' && days <= 3)         return 'fb_3day_beginner'
  if (goal === 'strength' && days === 4)        return 'ul_4day_beginner'

  if (days <= 3)                                return 'fb_3day_beginner'
  return 'ul_4day_beginner'
}

// ── Rotation pointer ──────────────────────────────────────────────────────────

/**
 * Advance the rotation pointer after a logged session.
 * The pointer wraps modulo the number of template days — no calendar, no deadlines.
 * @param {{ next_day_index: number, sessions_completed: number, template_days_count: number }} program
 * @returns {{ next_day_index: number, sessions_completed: number }}
 */
export function advanceRotation(program) {
  const total = program?.template_days_count
  if (!total || total < 1) return { next_day_index: 0, sessions_completed: (program?.sessions_completed ?? 0) + 1 }
  return {
    next_day_index: (program.next_day_index + 1) % total,
    sessions_completed: (program.sessions_completed ?? 0) + 1,
  }
}

/**
 * Days since the user's last session. Returns null if they have never logged one.
 * Pure date math — no shame, no streak, no prescriptions.
 * @param {string|null} lastSessionDate - ISO date string "YYYY-MM-DD" or null
 * @param {Date} [today]
 * @returns {number|null}
 */
export function daysSinceLastSession(lastSessionDate, today = new Date()) {
  if (!lastSessionDate) return null
  const last = new Date(lastSessionDate)
  return Math.floor((today - last) / 86_400_000)
}
