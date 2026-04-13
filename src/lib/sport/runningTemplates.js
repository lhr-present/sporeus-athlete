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
export function getRunningTemplate(id) {
  return RUNNING_TEMPLATES.find(t => t.id === id) || null
}

export function getTemplatesByPhase(phase) {
  return RUNNING_TEMPLATES.filter(t => t.phase === phase)
}

export function getTemplatesByTag(tag) {
  return RUNNING_TEMPLATES.filter(t => t.tags?.includes(tag))
}

// ── Instantiate a template for an athlete ────────────────────────────────────
// Given a template ID and VDOT, returns the template with target paces in
// both sec/km and formatted mm:ss/km.
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
// Returns ordered weekly template IDs for a race build from `weeksToRace` weeks out.
// Follows Daniels periodization: base → build → peak → taper
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

export { secKmToString, fmtSeconds }
