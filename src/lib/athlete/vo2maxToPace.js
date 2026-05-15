// src/lib/athlete/vo2maxToPace.js
//
// v9.159.0 (Prompt E) — Daniels' VDOT-to-threshold-pace lookup.
//
// VDOT (per Daniels' "Vee-dot-O2max") is the athlete's race-equivalent
// VO2max. For an endurance runner the lab-measured VO2max and the
// race-equivalent VDOT are close enough to use interchangeably — this
// helper treats them as equal.
//
// Used to fill the v9.155 `thresholdDerived` slot when an athlete has a
// VO2max reading (from any of the 6 protocol tests — Cooper, Beep, YYIR1,
// Åstrand, Ramp, ...) but no manually-entered threshold pace. The 2026-05-15
// physiology audit found vo2max was the largest dead-input: collected from
// six different protocols, consumed by zero downstream code.
//
// Source: Daniels' Running Formula (4th ed, 2014) — T-pace column,
// approximately 88% VO2max effort. Values are seconds-per-km.
// Linear interpolation between table anchors.

const VDOT_T_PACE_SEC = Object.freeze([
  [30, 334],  // 5:34/km
  [35, 309],  // 5:09
  [40, 287],  // 4:47
  [45, 269],  // 4:29
  [50, 251],  // 4:11
  [55, 235],  // 3:55
  [60, 222],  // 3:42
  [65, 211],  // 3:31
  [70, 202],  // 3:22
  [75, 194],  // 3:14
  [80, 186],  // 3:06
  [85, 180],  // 3:00
])

const MIN_VDOT = VDOT_T_PACE_SEC[0][0]
const MAX_VDOT = VDOT_T_PACE_SEC[VDOT_T_PACE_SEC.length - 1][0]

/**
 * @param {number|string} vdot - VO2max / VDOT value (mL/kg/min).
 * @returns {number|null} Threshold pace in seconds-per-km, or null
 *   when vdot is missing, malformed, or out of physiological range
 *   (clamped to [30, 85] inclusive).
 */
export function vdotToThresholdSec(vdot) {
  const v = Number(vdot)
  if (!Number.isFinite(v) || v < MIN_VDOT || v > MAX_VDOT) return null
  // Walk to the first anchor ≥ v, interpolate between it and the previous one
  for (let i = 1; i < VDOT_T_PACE_SEC.length; i++) {
    const [hi, hiPace] = VDOT_T_PACE_SEC[i]
    if (v <= hi) {
      const [lo, loPace] = VDOT_T_PACE_SEC[i - 1]
      if (v === lo) return loPace
      const frac = (v - lo) / (hi - lo)
      return Math.round(loPace + (hiPace - loPace) * frac)
    }
  }
  return VDOT_T_PACE_SEC[VDOT_T_PACE_SEC.length - 1][1]
}

/**
 * Format seconds-per-km as "M:SS" (matches the on-form threshold input).
 * @param {number} secPerKm
 * @returns {string|null}
 */
export function formatPaceStr(secPerKm) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return null
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  if (s === 60) return `${m + 1}:00`
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Convenience: VDOT → "M:SS" pace string, or null when invalid.
 */
export function vdotToThresholdStr(vdot) {
  const sec = vdotToThresholdSec(vdot)
  return sec == null ? null : formatPaceStr(sec)
}
