// src/lib/athlete/sessionStructure.js
//
// v9.88.0 — Derive structured interval breakdown for a planned session.
//
// The plan generator (src/lib/plan/generatePlan.js) emits sessions as
// { type, duration, rpe, zone, ... } — natural-language `type` strings
// like "Threshold 2x20", "VO2max 5x3", "Intervals 6x800m" carry the
// reps/duration intent but as text only. Athletes need a clear
// warm-up + reps + recovery + cool-down breakdown to execute, not just
// a label.
//
// This module pattern-matches the `type` string for known interval
// formats and returns a structured breakdown the athlete can read at a
// glance. For sessions that aren't structured-rep workouts (Easy / Long
// / Recovery / Tempo with no NxM), it returns null and the UI falls
// back to the existing description.
//
// Pure function. No side effects. No data-model migration required —
// the structure is DERIVED at render time from text the plan already
// produces.

// Specific qualifiers (cruise, race-pace) precede the generic catch-all
// (intervals) so e.g. "Cruise intervals 4x10" matches Z4 not Z5.
const ZONE_FOR_KEYWORD = {
  threshold:   { effort: 'Z4', recoveryMin: 1.5,  label: { en: 'threshold', tr: 'eşik' } },
  vo2max:      { effort: 'Z5', recoveryMin: null, label: { en: 'VO2max',    tr: 'VO2max' } },
  'race-pace': { effort: 'Z4', recoveryMin: 2,    label: { en: 'race-pace', tr: 'yarış tempo' } },
  racepace:    { effort: 'Z4', recoveryMin: 2,    label: { en: 'race-pace', tr: 'yarış tempo' } },
  cruise:      { effort: 'Z4', recoveryMin: 1.5,  label: { en: 'cruise',    tr: 'cruise'   } },
  intervals:   { effort: 'Z5', recoveryMin: null, label: { en: 'interval',  tr: 'interval' } },
  vo2:         { effort: 'Z5', recoveryMin: null, label: { en: 'VO2max',    tr: 'VO2max'   } },
  tempo:       { effort: 'Z3', recoveryMin: 1,    label: { en: 'tempo',     tr: 'tempo'    } },
}

// Convert a (repValue, repUnit) into estimated minutes per rep.
// Unit-aware: 'min' uses value directly; 'km' assumes ~4 min/km;
// 'm' assumes 250 m/min (≈3:20 /km, treadmill-friendly). Floors at 2.
function repMinFromValueUnit(value, unit) {
  if (!Number.isFinite(value) || value <= 0) return null
  const u = (unit || 'min').toLowerCase()
  if (u === 'min' || u === 'm' && value <= 30)  return value
  if (u === 'km')                                return Math.max(2, Math.round(value * 4))
  if (u === 'm')                                 return Math.max(2, Math.round(value / 250))
  return null
}

/**
 * Derive a session-structure breakdown from a planned session.
 *
 * @param {object|null} plannedSession - shape from getTodayPlannedSession or
 *   similar: { type: string, duration: number, ... }. Tolerant of null.
 * @returns {{
 *   blocks: Array<{
 *     kind: 'wu'|'rep'|'cd',
 *     durationMin?: number,
 *     count?: number,
 *     recoveryMin?: number,
 *     zone?: string,
 *     label: { en: string, tr: string },
 *   }>,
 *   estimate: true,
 * } | null}
 */
export function deriveSessionStructure(plannedSession) {
  if (!plannedSession || typeof plannedSession.type !== 'string') return null
  const typeStr = plannedSession.type.toLowerCase()

  // Match "NxM" or "N x M" with optional unit (min, m, km, s).
  // Examples matched: "2x20", "5 x 3min", "6x800m", "4x1km"
  const m = typeStr.match(/(\d+)\s*x\s*(\d+)\s*(min|km|m|s)?/i)
  if (!m) return null

  const reps     = parseInt(m[1], 10)
  const repValue = parseInt(m[2], 10)
  const repUnit  = m[3] || 'min'

  if (!Number.isFinite(reps) || reps < 1 || reps > 30) return null

  // 's' (seconds) — only honor if value is reasonable (15-180s typical for strides/short reps)
  let repMin
  if (repUnit.toLowerCase() === 's') {
    if (repValue < 10 || repValue > 300) return null
    repMin = Math.max(0.25, repValue / 60)
  } else {
    repMin = repMinFromValueUnit(repValue, repUnit)
    if (repMin == null) return null
  }

  // Find matching zone keyword. Order matters: longer keys first so
  // 'vo2max' matches before 'vo2' and 'cruise' before nothing.
  let zone = null
  for (const k of Object.keys(ZONE_FOR_KEYWORD)) {
    if (typeStr.includes(k)) { zone = ZONE_FOR_KEYWORD[k]; break }
  }
  if (!zone) return null

  // Recovery duration: null in the zone map = equal to rep duration
  // (VO2max / interval default — Laursen 2002 polarized recovery).
  const recoveryMin = zone.recoveryMin == null ? repMin : zone.recoveryMin

  // Budget WU + CD from the remaining duration after reps + inter-rep
  // recovery. WU gets ~60% of remaining, capped at [10, 20] minutes;
  // CD gets the rest, floored at 0.
  const total      = Number(plannedSession.duration || 0)
  const repsTime   = reps * repMin
  const recTime    = Math.max(0, reps - 1) * recoveryMin
  const remaining  = Math.max(0, total - repsTime - recTime)
  const wu         = total > 0 ? Math.min(20, Math.max(10, Math.round(remaining * 0.6))) : 0
  // CD is the exact remainder so WU + reps + recovery + CD == total
  // (avoids double-rounding mismatch when the budget has half-minute leftovers).
  const cd         = Math.max(0, remaining - wu)

  return {
    blocks: [
      { kind: 'wu',  durationMin: wu, label: { en: 'WU easy', tr: 'Isınma kolay' } },
      {
        kind:        'rep',
        count:       reps,
        durationMin: repMin,
        recoveryMin,
        zone:        zone.effort,
        label:       zone.label,
      },
      { kind: 'cd',  durationMin: cd, label: { en: 'CD easy', tr: 'Soğuma kolay' } },
    ],
    estimate: true,
  }
}
