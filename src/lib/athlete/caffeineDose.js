// ─── caffeineDose.js — Pre-session caffeine dose calculator ─────────────────
// Surfaces evidence-based caffeine dose guidance for athletes preparing for a
// hard session or race. Pre-exercise caffeine (3-6 mg/kg, 30-60 min pre)
// is one of the few ergogenic aids with consistent endurance + high-intensity
// performance benefit. The ceiling is ~6 mg/kg — above that, side effects
// (jitters, GI distress, sleep disruption) appear without additional gain.
// Athletes with known sensitivity should stay at 2-3 mg/kg.
//
// Reference: Burke 2017 (Caffeine and Sport Performance);
//            Stear 2010 (BJSM A-Z of supplements);
//            IOC 2018 Consensus Statement (Dietary Supplements and the
//            High-Performance Athlete).
// ─────────────────────────────────────────────────────────────────────────────

export const CAFFEINE_DOSE_CITATION = 'Burke 2017; Stear 2010; IOC 2018'

// Doses are rounded to the nearest 25 mg increment so athletes can map them
// directly to common caffeine sources (espresso shot ~75 mg, strong coffee
// ~150-200 mg, gel ~25-100 mg, tablet ~50-200 mg).
const DOSE_STEP_MG  = 25
const DOSE_MIN_MG   = 100
const DOSE_MAX_MG   = 600
const TIMING_PRE_MIN = 45     // mid-range of 30-60 min pre-exercise window
const LONG_SESSION_MIN = 90   // > 90 min benefits from split dosing

// Hard-session detection keywords on session.type. Endurance/race/threshold
// or any RPE ≥ 7 session qualifies as caffeine-eligible.
const HARD_TYPE_RE = /interval|vo2|threshold|tempo|race/i
const HARD_RPE_THRESHOLD = 7

function roundTo25(mg) {
  if (!Number.isFinite(mg) || mg <= 0) return 0
  return Math.round(mg / DOSE_STEP_MG) * DOSE_STEP_MG
}

function clampDose(mg) {
  if (mg < DOSE_MIN_MG) return DOSE_MIN_MG
  if (mg > DOSE_MAX_MG) return DOSE_MAX_MG
  return mg
}

function isHardSession(session) {
  if (!session) return false
  const rpe = Number(session.rpe)
  if (Number.isFinite(rpe) && rpe >= HARD_RPE_THRESHOLD) return true
  const type = typeof session.type === 'string' ? session.type : ''
  if (HARD_TYPE_RE.test(type)) return true
  return false
}

/**
 * Compute pre-session caffeine dose guidance.
 *
 * Rules (Burke 2017, Stear 2010, IOC 2018):
 *   - Pre-exercise: 3-6 mg/kg, taken 30-60 min before high-intensity / race work
 *   - Typical: 5 mg/kg (mid-band)
 *   - Sensitivity 'high' → cap typical at 3 mg/kg to avoid jitters / GI distress
 *   - Sessions > 90 min → split dosing (half pre, half during)
 *   - All doses rounded to 25 mg increments, clamped 100-600 mg
 *
 * @param {Object} input
 * @param {Object} input.profile - athlete profile: { weight, caffeineSensitivity? }
 * @param {Object|null} input.plannedSession - today's planned session shape
 * @param {string} [input.today] - ISO yyyy-mm-dd (unused but accepted for API symmetry)
 * @returns {Object|null} dose recommendation or null when not eligible
 */
// eslint-disable-next-line no-unused-vars
export function computeCaffeineDose({ profile, plannedSession, today } = {}) {
  const weight = Number(profile?.weight)
  if (!Number.isFinite(weight) || weight <= 0) return null
  if (!plannedSession) return null
  if (!isHardSession(plannedSession)) return null

  const sensitivity = profile?.caffeineSensitivity

  // Raw mg/kg multipliers (Burke 2017): 3 (low), 5 (typical), 6 (max).
  let typicalPerKg = 5
  if (sensitivity === 'high') typicalPerKg = 3
  // 'low' sensitivity → keep 5x typical (no boost above evidence range).

  const rawMin     = 3 * weight
  const rawTypical = typicalPerKg * weight
  const rawMax     = 6 * weight

  const doseMinMg     = clampDose(roundTo25(rawMin))
  const doseTypicalMg = clampDose(roundTo25(rawTypical))
  const doseMaxMg     = clampDose(roundTo25(rawMax))

  const duration = Number(plannedSession?.duration)
  const longSessionSplit = Number.isFinite(duration) && duration > LONG_SESSION_MIN

  return {
    doseMinMg,
    doseTypicalMg,
    doseMaxMg,
    timingMinutesPre: TIMING_PRE_MIN,
    longSessionSplit,
    citation: CAFFEINE_DOSE_CITATION,
    eligibleSession: plannedSession,
  }
}
