// ─── src/lib/sport/runningTemplates.js — Daniels-based running session templates
// 6 template types covering Daniels' E/M/T/I/R zones.
// Each template can be instantiated for an athlete given their VDOT.

import { trainingPaces, predictRaceTime, vdotFromRace } from './running.js'

// ── Template definitions ──────────────────────────────────────────────────────
// Pace keys map to Daniels' zone system:
//   E=Easy, M=Marathon, T=Threshold, I=Interval(VO2max), R=Repetition
export const RUNNING_TEMPLATES = [
  {
    id:          'easy_run',
    name:        'Easy Run',
    phase:       'base',
    paceKey:     'E',
    description: 'Aerobic base building at comfortable conversational pace.',
    distanceM:   10000,
    structure:   'Continuous',
    rpe:         10,
    tssMultiplier: 0.55,
    tags:        ['base', 'aerobic', 'easy'],
    danielsNote: 'Should feel easy; 59–74% of VO2max',
  },
  {
    id:          'marathon_tempo',
    name:        'Marathon Pace Run',
    phase:       'build',
    paceKey:     'M',
    description: 'Sustained marathon-pace effort. Builds lactate clearance.',
    distanceM:   16000,
    structure:   'Continuous',
    rpe:         13,
    tssMultiplier: 0.95,
    tags:        ['marathon', 'tempo', 'build'],
    danielsNote: '75–84% of VO2max',
  },
  {
    id:          'threshold_cruise',
    name:        'Threshold Cruise Intervals',
    phase:       'build',
    paceKey:     'T',
    description: '5 × 1 mile at threshold pace with 1-min rest. Classic Daniels T session.',
    distanceM:   8045,  // 5 miles
    intervals:   5,
    intervalDistM: 1609,  // 1 mile
    restMin:     1,
    structure:   'Intervals',
    rpe:         15,
    tssMultiplier: 1.05,
    tags:        ['threshold', 'lactate', 'build'],
    danielsNote: '83–88% of VO2max (comfortably hard)',
  },
  {
    id:          'vo2max_intervals',
    name:        'VO2max Intervals',
    phase:       'peak',
    paceKey:     'I',
    description: '6 × 1000m at I pace with 3-min jog recovery.',
    distanceM:   6000,
    intervals:   6,
    intervalDistM: 1000,
    restMin:     3,
    structure:   'Intervals',
    rpe:         17,
    tssMultiplier: 1.30,
    tags:        ['vo2max', 'quality', 'peak'],
    danielsNote: '97–100% of VO2max; 3–5 min reps',
  },
  {
    id:          'repetition_speed',
    name:        'R-Pace Repetitions',
    phase:       'peak',
    paceKey:     'R',
    description: '10 × 400m at R pace with full recovery (400m jog). Economy work.',
    distanceM:   4000,
    intervals:   10,
    intervalDistM: 400,
    restMin:     4,
    structure:   'Repetitions',
    rpe:         18,
    tssMultiplier: 1.20,
    tags:        ['speed', 'economy', 'peak'],
    danielsNote: 'Faster than race pace; full recovery between reps',
  },
  {
    id:          'long_run',
    name:        'Long Run',
    phase:       'base',
    paceKey:     'E',
    description: 'Long easy run. Build to ≤2.5h or 25% weekly volume, whichever is shorter.',
    distanceM:   25000,
    structure:   'Continuous',
    rpe:         11,
    tssMultiplier: 0.75,
    tags:        ['long', 'aerobic', 'base', 'easy'],
    danielsNote: 'Easy pace; never more than 30% of weekly mileage',
  },
]

// ── Template lookup ────────────────────────────────────────────────────────────
/**
 * @description Looks up a running session template by ID.
 * @param {string} id - Template ID (e.g. 'easy_run', 'threshold_cruise')
 * @returns {object|null} Template definition object, or null if not found
 * @source Daniels & Gilbert (1979) — Oxygen power: Performance tables for distance runners
 * @example
 * getRunningTemplate('threshold_cruise') // => {id:'threshold_cruise', paceKey:'T', ...}
 */
export function getRunningTemplate(id) {
  return RUNNING_TEMPLATES.find(t => t.id === id) || null
}

/**
 * @description Returns all running templates for a given training phase.
 * @param {'base'|'build'|'peak'} phase - Training phase name
 * @returns {object[]} Array of matching template definitions
 * @example
 * getTemplatesByPhase('peak') // => [{id:'vo2max_intervals',...}, {id:'repetition_speed',...}]
 */
export function getTemplatesByPhase(phase) {
  return RUNNING_TEMPLATES.filter(t => t.phase === phase)
}

/**
 * @description Returns all running templates that include a given tag.
 * @param {string} tag - Tag string (e.g. 'threshold', 'aerobic', 'vo2max')
 * @returns {object[]} Array of matching template definitions
 * @example
 * getTemplatesByTag('vo2max') // => [{id:'vo2max_intervals', ...}]
 */
export function getTemplatesByTag(tag) {
  return RUNNING_TEMPLATES.filter(t => t.tags?.includes(tag))
}

// ── Instantiate a template for an athlete ────────────────────────────────────
/**
 * @description Instantiates a running session template for a specific athlete by computing
 *   target pace from VDOT, estimating TSS, and building interval breakdowns where applicable.
 * @param {string} templateId - Template ID from RUNNING_TEMPLATES
 * @param {number} vdot - Athlete's VDOT value
 * @returns {object|null} Template with targetPaceSecKm, targetPaceFmt, estimatedTSS, intervalBreakdown; null on invalid input
 * @source Daniels & Gilbert (1979) — Oxygen power: Performance tables for distance runners
 * @example
 * instantiateRunningTemplate('threshold_cruise', 52)
 * // => {targetPaceFmt:'4:24', estimatedTSS:~87, intervalBreakdown:{count:5, ...}, ...}
 */
export function instantiateRunningTemplate(templateId, vdot) {
  const tmpl = getRunningTemplate(templateId)
  if (!tmpl || !vdot || vdot <= 0) return null

  const paces = trainingPaces(vdot)
  if (!paces) return null

  const targetPaceSecKm = paces[tmpl.paceKey]
  if (!targetPaceSecKm) return null

  const fmtPace = secKmToString(targetPaceSecKm)

  // Estimate session duration for TSS calculation
  const totalM = tmpl.distanceM || 0
  const durationSec = (totalM / 1000) * targetPaceSecKm
  const estimatedTSS = Math.round(tmpl.tssMultiplier * 100 * (durationSec / 3600) * 10) / 10

  // Generate interval breakdown if applicable
  let intervalBreakdown = null
  if (tmpl.intervals && tmpl.intervalDistM) {
    const intervalSec = (tmpl.intervalDistM / 1000) * targetPaceSecKm
    intervalBreakdown = {
      count:        tmpl.intervals,
      distanceM:    tmpl.intervalDistM,
      targetSecKm:  Math.round(targetPaceSecKm),
      targetPaceFmt: fmtPace,
      intervalTimeSec: Math.round(intervalSec),
      intervalTimeFmt: fmtSeconds(intervalSec),
      restMin:      tmpl.restMin,
    }
  }

  return {
    ...tmpl,
    vdot,
    targetPaceSecKm: Math.round(targetPaceSecKm),
    targetPaceFmt: fmtPace,
    estimatedTSS,
    intervalBreakdown,
  }
}

// ── Race-specific plan ────────────────────────────────────────────────────────
/**
 * @description Generates a periodized race build plan (base → build → peak → taper)
 *   from the given number of weeks to race day, following Daniels' phase structure.
 * @param {number} weeksToRace - Total weeks until the target race (minimum 4)
 * @returns {Array<{week:number, phase:string, templates:string[]}>|null} Weekly plan array, or null if < 4 weeks
 * @source Daniels & Gilbert (1979) — Oxygen power: Performance tables for distance runners
 * @example
 * raceSpecificPlan(12) // => [{week:1,phase:'base',templates:[...]}, ..., {week:12,phase:'taper',...}]
 */
export function raceSpecificPlan(weeksToRace) {
  if (!weeksToRace || weeksToRace < 4) return null
  const plan = []
  // Phase lengths (as fractions of total weeks)
  const taper  = Math.min(2, Math.floor(weeksToRace * 0.15))
  const peak   = Math.floor(weeksToRace * 0.25)
  const build  = Math.floor(weeksToRace * 0.30)
  const base   = weeksToRace - taper - peak - build

  for (let i = 0; i < base;  i++) plan.push({ week: plan.length + 1, phase: 'base',  templates: weeklyRunPlan('base') })
  for (let i = 0; i < build; i++) plan.push({ week: plan.length + 1, phase: 'build', templates: weeklyRunPlan('build') })
  for (let i = 0; i < peak;  i++) plan.push({ week: plan.length + 1, phase: 'peak',  templates: weeklyRunPlan('peak') })
  for (let i = 0; i < taper; i++) plan.push({ week: plan.length + 1, phase: 'taper', templates: weeklyRunPlan('taper') })

  return plan
}

// ── Weekly session mix by phase ───────────────────────────────────────────────
/**
 * @description Returns the weekly session template ID mix for a given Daniels training phase.
 * @param {'base'|'build'|'peak'|'taper'} phase - Training phase name
 * @returns {string[]} Array of template IDs for the weekly plan
 * @source Daniels & Gilbert (1979) — Oxygen power: Performance tables for distance runners
 * @example
 * weeklyRunPlan('build') // => ['easy_run', 'marathon_tempo', 'threshold_cruise', 'long_run']
 */
export function weeklyRunPlan(phase) {
  const plans = {
    base:  ['easy_run', 'easy_run', 'long_run'],
    build: ['easy_run', 'marathon_tempo', 'threshold_cruise', 'long_run'],
    peak:  ['easy_run', 'vo2max_intervals', 'threshold_cruise', 'repetition_speed'],
    taper: ['easy_run', 'threshold_cruise'],
  }
  return plans[phase] || plans.base
}

// ── Utility formatters ────────────────────────────────────────────────────────
function secKmToString(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return '--:--'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtSeconds(totalSec) {
  if (!totalSec || totalSec <= 0) return '--:--'
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// secKmToString and fmtSeconds are utility formatters re-exported for consumer use.
export { secKmToString, fmtSeconds }
