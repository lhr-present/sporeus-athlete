// src/lib/athlete/cyclePhaseGate.js
//
// v9.171.0 (EP-9) — Menstrual-cycle phase gate for the elite program.
//
// ── Privacy + opt-in ──────────────────────────────────────────────────────
// This module is **strictly opt-in per athlete profile** and returns null
// (no-op) unless BOTH conditions are met:
//   1. profile.gender === 'female'
//   2. profile.lastPeriodStart is set (the athlete has chosen to track)
//
// When this gate returns null, callers MUST use the unmodified elite
// program. The UI must NOT show any cycle-related card / control to
// non-female users or to female users who haven't entered tracking data
// — gate at the Card level via the same checks. No cycle data is computed,
// surfaced, or stored for athletes who haven't opted in.
//
// ── Scientific framing ────────────────────────────────────────────────────
// McNulty et al. 2020 meta-analysis (54 studies, n>5000) found small +
// uncertain effects of cycle phase on endurance performance — typically
// <2% mean shift, with **high inter-individual variability**. Sims 2016
// describes physiology (estrogen / progesterone / heat-load shifts) but
// concedes that prescription is highly individual.
//
// So this gate emits GENTLE recommendations (±5% TSS multiplier), not
// drastic ones. The athlete's own tracking + RPE should always override
// the predicted multiplier. The intent is to surface **awareness**, not
// to dictate workload.
//
// ── Output ────────────────────────────────────────────────────────────────
// For each of the next N weeks (default 4), the gate predicts cycle-phase
// coverage and emits a per-week recommendation. `applyCyclePhaseGate`
// applies those multipliers to a weekly-TSS array — and is a pure no-op
// when the gate is null.
//
// ── Citations ─────────────────────────────────────────────────────────────
//   McNulty K.L. et al. 2020. The effects of menstrual cycle phase on
//     exercise performance in eumenorrheic women: A systematic review and
//     meta-analysis. Sports Med 50:1813–1827.
//   Sims S.T. & Heather A.K. 2018. Myths and methodologies: Reducing
//     scientific design ambiguity in studies comparing sexes and/or
//     menstrual cycle phases. Exp Physiol 103(10):1309-1317.
//   Janse de Jonge X.A.K. 2003. Effects of the menstrual cycle on exercise
//     performance. Sports Med 33(11):833-851.
//   Bruinvels G. et al. 2017. The prevalence and impact of heavy menstrual
//     bleeding among athletes and mass start-runners of the 2015 London
//     Marathon. BJSM 50:566.

import { cycleDay, currentCyclePhase } from '../cycleUtils.js'

export const CYCLE_GATE_CITATION = 'McNulty 2020; Sims 2018; Janse de Jonge 2003; Bruinvels 2017'

const PHASE_DURATION_DAYS = (cycleLength) => {
  const ovDay = Math.round(cycleLength / 2)
  return {
    menstruation: 5,           // days 1-5
    follicular:   ovDay - 5,   // days 6 → ovDay-1
    ovulation:    2,           // days ovDay → ovDay+1
    luteal:       cycleLength - (ovDay + 2) + 1, // remainder
  }
}

// Gentle per-phase multipliers (±5%). McNulty 2020 cap.
const PHASE_TSS_MULT = {
  menstruation: 0.97,  // slight reduction if heavy bleeding common
  follicular:   1.03,  // rising estrogen — strength/interval window
  ovulation:    1.05,  // peak hormone + performance window
  luteal:       0.97,  // progesterone + heat-load → slightly reduced quality
}

const PHASE_INTENSITY_REC = {
  menstruation: 'low',
  follicular:   'high',
  ovulation:    'high',
  luteal:       'moderate',
}

const PHASE_NOTE = {
  menstruation: {
    en: 'Menstruation: low-intensity may feel better, monitor iron + hydration. Override if you feel strong.',
    tr: 'Adet: düşük yoğunluk daha rahat olabilir, demir + hidrasyona dikkat. Güçlü hissediyorsan değiştir.',
  },
  follicular: {
    en: 'Follicular: rising estrogen — favourable window for strength + intervals.',
    tr: 'Foliküler: östrojen yükseliyor — kuvvet + interval için uygun pencere.',
  },
  ovulation: {
    en: 'Ovulation: hormonal peak. Ideal for time trials / VO2max / race-pace sessions.',
    tr: 'Ovülasyon: hormonal tepe. Zaman denemesi / VO2max / yarış-tempo seansları için ideal.',
  },
  luteal: {
    en: 'Luteal: progesterone + heat-load rise — RPE may climb. Hydrate + accept higher perceived effort.',
    tr: 'Luteal: progesteron + ısı yükü artar — RPE yükselebilir. Hidrate ol + yüksek algılanan eforu kabul et.',
  },
}

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Predict cycle-phase coverage for a 7-day window starting at startISO.
 * Returns an object mapping each phase to its day count (0-7).
 */
function weekPhaseCoverage(startISO, lastPeriodStart, cycleLength) {
  const coverage = { menstruation: 0, follicular: 0, ovulation: 0, luteal: 0 }
  for (let d = 0; d < 7; d++) {
    const today = addDaysISO(startISO, d)
    const phase = currentCyclePhase(lastPeriodStart, cycleLength, today)
    if (phase && coverage[phase] != null) coverage[phase] += 1
  }
  return coverage
}

function dominantPhase(coverage) {
  let best = null, bestCount = -1
  for (const ph of Object.keys(coverage)) {
    if (coverage[ph] > bestCount) { best = ph; bestCount = coverage[ph] }
  }
  return best
}

/**
 * Build a 4-week (or N-week) cycle-phase forecast for a female athlete
 * who has opted in by entering lastPeriodStart.
 *
 * @param {{ gender?: string, lastPeriodStart?: string, cycleLength?: number }} profile
 * @param {{ today?: string, weeks?: number, startISO?: string }} options
 * @returns {{
 *   weeks: Array<{
 *     weekIdx: number,
 *     startISO: string,
 *     coverage: { menstruation: number, follicular: number, ovulation: number, luteal: number },
 *     dominantPhase: string,
 *     tssMultiplier: number,
 *     intensityRec: 'high'|'moderate'|'low',
 *     note: { en: string, tr: string },
 *   }>,
 *   citation: string,
 *   privacyNote: { en: string, tr: string },
 * } | null}
 */
export function buildCyclePhaseGate(profile, options = {}) {
  // ── Hard gate: only female + opted-in athletes get a non-null result.
  if (!profile || typeof profile !== 'object') return null
  if ((profile.gender || '').toLowerCase() !== 'female') return null
  if (!profile.lastPeriodStart) return null

  const cycleLength = Number(profile.cycleLength) || 28
  if (cycleLength < 20 || cycleLength > 40) return null

  // Validate lastPeriodStart parses
  const lps = String(profile.lastPeriodStart)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lps)) return null
  if (Number.isNaN(new Date(lps + 'T00:00:00Z').getTime())) return null

  const today = options.today || new Date().toISOString().slice(0, 10)
  // Sanity-check today
  if (cycleDay(lps, cycleLength, today) === null) return null

  const weeks = Math.max(1, Math.min(20, Number(options.weeks) || 4))
  const startISO = options.startISO || today

  const out = []
  for (let i = 0; i < weeks; i++) {
    const wkStart = addDaysISO(startISO, i * 7)
    const coverage = weekPhaseCoverage(wkStart, lps, cycleLength)
    const dom = dominantPhase(coverage)
    out.push({
      weekIdx: i + 1,
      startISO: wkStart,
      coverage,
      dominantPhase: dom,
      tssMultiplier: PHASE_TSS_MULT[dom],
      intensityRec: PHASE_INTENSITY_REC[dom],
      note: PHASE_NOTE[dom],
    })
  }

  return {
    weeks: out,
    citation: CYCLE_GATE_CITATION,
    privacyNote: {
      en: 'Cycle-aware recommendations are opt-in and visible only to you. They are gentle (±5%) — your own RPE always overrides.',
      tr: 'Döngü-duyarlı öneriler isteğe bağlıdır ve yalnızca sana görünür. Hafif (±%5) — kendi RPE\'n her zaman üstün.',
    },
  }
}

/**
 * Apply a cycle-phase gate to a weekly TSS array. PURE NO-OP if gate is
 * null (non-female, non-opted-in, or invalid profile data).
 *
 * @param {Array<{ week: number, phase: string, tss: number }>} weeklyTSS - elite program output
 * @param {ReturnType<typeof buildCyclePhaseGate> | null} gate
 * @returns {Array<{ week, phase, tss, cycleMultiplier?, cyclePhase?, cycleAdjustedTSS? }>}
 */
export function applyCyclePhaseGate(weeklyTSS, gate) {
  if (!Array.isArray(weeklyTSS)) return weeklyTSS
  if (!gate || !Array.isArray(gate.weeks) || gate.weeks.length === 0) {
    // Strict no-op: return the same array reference (callers get same object)
    return weeklyTSS
  }
  return weeklyTSS.map((w, i) => {
    const g = gate.weeks[i]
    if (!g) return w  // beyond the forecast horizon — leave unchanged
    // v9.489 (program-content HIGH F3): buildEliteProgram passes weeklyTSS as
    // an array of NUMBERS — spreading a number yields {}, so every opted-in
    // female athlete's program collapsed to cycleAdjustedTSS=0 across run/row/
    // bike. Accept both shapes; number weeks come back as annotated objects
    // with `tss` preserved.
    const base = typeof w === 'number' ? { tss: w } : w
    return {
      ...base,
      cycleMultiplier:   g.tssMultiplier,
      cyclePhase:        g.dominantPhase,
      cycleAdjustedTSS:  Math.round((Number(base.tss) || 0) * g.tssMultiplier),
    }
  })
}

/**
 * Convenience helper used by UI gates. Returns true only when both
 * conditions are met (gender=female + lastPeriodStart present). Use this
 * to decide whether to render any cycle-related UI element.
 *
 * @param {object} profile
 * @returns {boolean}
 */
export function isCycleGateAvailable(profile) {
  if (!profile || typeof profile !== 'object') return false
  if ((profile.gender || '').toLowerCase() !== 'female') return false
  if (!profile.lastPeriodStart) return false
  return true
}

/**
 * v9.209.0 — Publish gate for cycle/period tracker UI.
 *
 * The pure-fn library (buildCyclePhaseGate, applyCyclePhaseGate,
 * isCycleGateAvailable) stays exported so the science remains
 * reviewable + testable, but the consumer surfaces (TodayView
 * one-liner, CyclePhaseCard, CycleTracker, Profile cycle inputs,
 * EliteProgramCard CyclePhaseBlock) are dark in production.
 *
 * Flip to `true` to re-enable the entire feature in one place.
 * UI surfaces gate on `isCycleSurfaceVisible(profile)` rather than
 * `isCycleGateAvailable(profile)`; non-UI consumers (eliteProgram
 * planner, cyclePlanner, etc.) keep using `isCycleGateAvailable`.
 */
export const CYCLE_FEATURE_PUBLISHED = false

/**
 * Combined UI gate: must be both published AND the athlete must satisfy
 * the privacy contract.
 *
 * @param {object} profile
 * @returns {boolean}
 */
export function isCycleSurfaceVisible(profile) {
  if (!CYCLE_FEATURE_PUBLISHED) return false
  return isCycleGateAvailable(profile)
}

export { PHASE_TSS_MULT, PHASE_INTENSITY_REC, PHASE_DURATION_DAYS }
