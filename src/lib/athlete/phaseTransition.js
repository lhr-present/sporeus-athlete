// src/lib/athlete/phaseTransition.js
//
// Detects when the athlete's CURRENT training week is the first week of a
// new periodization phase versus the previous week. Reads the same weeks
// array shape that `buildMultiPeakSeason` emits and that TodayView already
// consumes for its season peek.
//
// Returns a small descriptor when a transition is active so TodayView can
// render a one-time banner — or `null` when there is no usable season
// data. The component layer (PhaseTransitionPeek.jsx) handles dismissal.
//
// Scientific grounding for the expected-TSS deltas:
//   - Bompa 2009 — General Theory of Training. Base→Build increases load
//     ~10–20% as intensity rises and volume holds or trims slightly.
//   - Issurin 2010 — Block periodization. Build→Peak shifts the stimulus
//     toward race-specific intensity at the cost of total volume (+~10%
//     load via density rather than hours).
//   - Mujika 2003 — The Science of Tapering. Taper sheds ~21–30% of
//     volume while preserving intensity (here labelled "-30%").
//
// The labels here are intentionally directional ("+15%", "-30%") rather
// than precise prescriptions — the banner is a heads-up, not a plan.

export const PHASE_TRANSITION_CITATION = 'Bompa 2009; Issurin 2010; Mujika 2003'

// Hard-coded expected-TSS-delta map for known phase pairs. Pairs missing
// from this map fall back to 'see plan' rather than guessing.
const TSS_DELTA_BY_PAIR = {
  'Base→Build':       '+15%',
  'Build→Peak':       '+10%',
  'Peak→Taper':       '-30%',
  'Taper→Race':       'race-day',
  'Race→Recovery':    'recovery',
  'Recovery→Base':    'new cycle',
}

/**
 * Detect whether the current training week marks a phase transition.
 *
 * Input shape (forward-compatible — only `weeks[].phase` is consumed):
 *   {
 *     multiPeakSeason: {
 *       weeks: [{ phase: 'Base'|'Build'|'Peak'|'Taper'|'Race'|'Recovery'|'Maintenance', ... }, ...]
 *     },
 *     today: 'YYYY-MM-DD'  // reserved for future use; not required by the detector
 *   }
 *
 * The detector treats `weeks[0]` as the current week (matching the
 * convention `buildMultiPeakSeason` uses when `options.today` anchors
 * week 1 at today) and `weeks[1]` as the *next* week. The "previous"
 * week is whichever week the season placed immediately before the
 * current one — when the season builder produces a contiguous array,
 * that is `weeks[-1]` semantically. We model that here by accepting an
 * optional `previousWeek` field on the input OR by reading
 * `multiPeakSeason.previousWeek` if present. Tests cover both shapes.
 *
 * @param {{
 *   multiPeakSeason: { weeks?: Array<{phase:string}>, previousWeek?: {phase:string} } | null | undefined,
 *   today?: string,
 *   previousWeek?: {phase:string} | null,
 * }} args
 *
 * @returns {{
 *   isTransition: boolean,
 *   fromPhase: string,
 *   toPhase: string,
 *   expectedTssDelta: string,
 *   citation: string,
 * } | null}
 */
export function detectPhaseTransition(args) {
  if (!args || typeof args !== 'object') return null
  const { multiPeakSeason, previousWeek: prevArg } = args
  if (!multiPeakSeason || typeof multiPeakSeason !== 'object') return null

  const weeks = Array.isArray(multiPeakSeason.weeks) ? multiPeakSeason.weeks : null
  if (!weeks || weeks.length === 0) return null

  const currentWeek = weeks[0]
  if (!currentWeek || typeof currentWeek.phase !== 'string') return null

  // The "previous" week can come from three places:
  //   1. explicit `previousWeek` arg (cleanest for unit tests + future
  //      consumers that store last week elsewhere),
  //   2. `multiPeakSeason.previousWeek` (forward-compat slot),
  //   3. `weeks[1]` ONLY when the season has been laid out such that
  //      index 0 is current and index 1 is previous-as-history. The
  //      builder today emits forward-only weeks, so this branch is
  //      *not* taken — we instead treat a missing previous week as "no
  //      transition signal yet" (returns isTransition=false).
  const previousWeek = prevArg
    || multiPeakSeason.previousWeek
    || null

  if (!previousWeek || typeof previousWeek.phase !== 'string') {
    return {
      isTransition: false,
      fromPhase: currentWeek.phase,
      toPhase: currentWeek.phase,
      expectedTssDelta: 'see plan',
      citation: PHASE_TRANSITION_CITATION,
    }
  }

  const fromPhase = previousWeek.phase
  const toPhase = currentWeek.phase
  const isTransition = fromPhase !== toPhase

  const pairKey = `${fromPhase}→${toPhase}`
  const expectedTssDelta = TSS_DELTA_BY_PAIR[pairKey] || 'see plan'

  return {
    isTransition,
    fromPhase,
    toPhase,
    expectedTssDelta,
    citation: PHASE_TRANSITION_CITATION,
  }
}

export default detectPhaseTransition
