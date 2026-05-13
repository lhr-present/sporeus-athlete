// src/lib/plan/starterPlan.js
//
// v9.95.0 — Mission 1 chain: ONBOARDING → TARGET.
//
// Before this module, a user could complete onboarding with a goal, threshold,
// FTP, and even a race date — and still land on the app with no plan.
// `finishOnboarding` (useAppState.js) just navigated them to the PLAN tab and
// asked them to fill in the same data again. The chain stalled at the very
// first link.
//
// This module bridges the gap: take the data the user already entered during
// onboarding and produce a complete, plan-shape object that TodayView,
// PlanGenerator, and the v9.94 adaptation engine can all read on day one.
//
// Pure function. No I/O. Returns null when inputs are insufficient.

import { generatePlan } from './generatePlan.js'
import { adaptE13PlanToLegacy } from './adapter.js'
import { calcLoad } from '../formulas.js'

// ── Map onboarding goal strings → E13 generatePlan goal keys ─────────────────
// Mirrors the (lossy) mapping that PlanGenerator.jsx:308 already does.
// The race-distance information that v9.92 added is preserved separately
// via `raceDistance` (the UI-facing string), which the generator uses to
// shape peak/build intent emphasis.
const ONBOARDING_GOAL_TO_E13 = {
  '5K':              'pr',
  '10K':             'pr',
  'Half Marathon':   'pr',
  'Marathon':        'pr',
  'Cycling Event':   'pr',
  'General Fitness': 'fitness',
}

// ── Map athlete-level vocabulary to generatePlan's level keys ────────────────
// Onboarding writes either ATHLETE_LEVELS keys (after v9.74 picker normalizes)
// or PLAN_LEVELS strings. Both routes converge here.
const LEVEL_TO_E13 = {
  beginner:     'beginner',
  recreational: 'beginner',
  competitive:  'intermediate',
  intermediate: 'intermediate',
  advanced:     'advanced',
  elite:        'elite',
}

// Default training days per week when onboarding didn't ask. Five is the
// sweet-spot for the Intermediate-tier template that's the default level.
const DEFAULT_AVAILABLE_DAYS = 5

// Default weeks-to-race when both data.weeks and raceDate are absent. Twelve
// matches a typical Half Marathon block (Daniels 2014) and stays inside the
// generator's [3, 52] valid range.
const DEFAULT_WEEKS = 12

/**
 * @description Best-effort weeks-to-race derivation from onboarding data.
 *
 * Priority:
 *   1. data.weeks (slider in onboarding step 7) — numeric, clamped [4, 52]
 *   2. data.raceDate vs today — fall back when slider is empty
 *   3. DEFAULT_WEEKS when both are missing
 */
function deriveWeeksToRace(data, todayISO) {
  // 1. Explicit weeks
  const weeksNum = Number(data?.weeks)
  if (Number.isFinite(weeksNum) && weeksNum >= 3 && weeksNum <= 52) {
    return Math.floor(weeksNum)
  }
  // 2. Race date → weeks
  if (data?.raceDate) {
    try {
      const raceMs = new Date(data.raceDate + 'T12:00:00Z').getTime()
      const todayMs = new Date(todayISO + 'T12:00:00Z').getTime()
      const days = Math.floor((raceMs - todayMs) / 86400000)
      const weeks = Math.floor(days / 7)
      if (weeks >= 3 && weeks <= 52) return weeks
    } catch { /* fall through */ }
  }
  // 3. Default
  return DEFAULT_WEEKS
}

/**
 * @description Decide whether onboarding provided enough data to seed a plan.
 *
 * Minimum: a `goal` from PLAN_GOALS. Without a goal the user is in fast-track
 * mode (skipped the full setup) and shouldn't get a surprise plan.
 *
 * @returns {boolean}
 */
export function canSeedStarterPlan(onboardingData) {
  return !!(onboardingData?.goal)
}

/**
 * @description Build a starter plan from onboarding data, ready to write to
 *   localStorage `sporeus-plan` so TodayView mounts with a populated chain.
 *
 * @param {Object} onboardingData  - the object passed to onFinish()
 * @param {string} [todayISO]      - 'YYYY-MM-DD'; defaults to today UTC
 * @param {'en'|'tr'} [lang='en']
 * @param {Array}  [log]           - optional training log; used to seed
 *   currentCTL when the athlete onboarded *after* importing Strava history.
 *   (v9.97.0 — Prompt I)
 * @returns {Object|null}
 *   Legacy plan shape:
 *   {
 *     goal, raceDistance, primarySport, weeks: [...],
 *     generatedAt, level, hoursPerWeek, isAdaptive,
 *     adaptiveMeta, fromOnboarding: true,
 *   }
 *   or null when canSeedStarterPlan() is false / generatePlan returns null.
 */
export function buildStarterPlan(onboardingData, todayISO, lang = 'en', log) {
  if (!canSeedStarterPlan(onboardingData)) return null
  const data = onboardingData
  const today = todayISO || new Date().toISOString().slice(0, 10)

  const goalKey      = ONBOARDING_GOAL_TO_E13[data.goal] || 'pr'
  const levelKey     = LEVEL_TO_E13[String(data.athleteLevel || data.level || '').toLowerCase()] || 'intermediate'
  const weeksToRace  = deriveWeeksToRace(data, today)
  const availableDays = Number(data.trainDays) >= 2 && Number(data.trainDays) <= 7
    ? Math.floor(Number(data.trainDays))
    : DEFAULT_AVAILABLE_DAYS

  // v9.97.0 (Prompt I): currentCTL from log when available. Pre-v9.97 this
  // was hardcoded to 20 — fine for blank-slate users, but if Strava history
  // synced before onboarding finished, a 30-CTL athlete got a 20-CTL plan
  // and v9.94's adaptation card fired "drift / regenerate" on day one
  // because actual training load far exceeded the seed's expectation.
  //
  // Reads ctl via calcLoad (same EWMA the rest of the app uses), floors at
  // 20 so brand-new users with empty logs still get a workable baseline.
  // Defensive Number() coerces NaN from malformed log entries back to 0 so
  // the Math.max floor still produces a finite currentCTL.
  const rawCtl = Array.isArray(log) && log.length > 0
    ? Number(calcLoad(log)?.ctl)
    : 0
  const ctlFromLog = Number.isFinite(rawCtl) ? rawCtl : 0
  const currentCTL = Math.max(20, ctlFromLog)

  const adaptive = generatePlan({
    goal:          goalKey,
    currentCTL,
    weeksToRace,
    availableDays,
    model:         'traditional',
    level:         levelKey,
    raceDistance:  data.goal,
    primarySport:  data.sport || data.primarySport || null,
  })
  if (!adaptive) return null

  const legacyWeeks = adaptE13PlanToLegacy(adaptive, lang, data.sport || data.primarySport || null) || []
  if (legacyWeeks.length === 0) return null

  return {
    goal:          data.goal,
    raceDistance:  data.goal,
    primarySport:  data.sport || data.primarySport || null,
    weeks:         legacyWeeks,
    generatedAt:   today,
    // v9.103.0 (Prompt AA): persist the CTL the plan was budgeted on so a
    // stale-plan detector can compare it against current CTL. Without
    // seedCTL the only signal we had was age, which underweighted athletes
    // whose absolute load doubled mid-block (their drift card said
    // "on-track" because *relative* compliance was fine).
    seedCTL:       Math.round(currentCTL),
    level:         data.athleteLevel || data.level || 'Intermediate',
    hoursPerWeek:  Math.max(3, Math.round(availableDays * 1.5)),
    isAdaptive:    true,
    fromOnboarding: true,
    adaptiveMeta:  { model: adaptive.model },
  }
}
