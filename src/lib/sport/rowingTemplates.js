// ─── src/lib/sport/rowingTemplates.js — Evidence-based rowing session templates
// 7 templates covering full British Rowing intensity spectrum.
// Each template is sport-validated at the level specified in ROWING_ZONE_DEFS.

import { secToSplit, fmtSplit, rowingZones, paulsLaw } from './rowing.js'

// ── Template definitions ──────────────────────────────────────────────────────
// distanceM: total meters per session
// zones: array of { zone, pctOfSession } — must sum to 100
// rpe: typical Borg 6–20 RPE
// restMin: recovery between intervals (0 = continuous)
export const ROWING_TEMPLATES = [
  {
    id:          'ut2_steady',
    name:        'UT2 Steady State',
    zone:        1,
    description: 'Long, aerobic base-building row. Sub-threshold, conversational pace.',
    distanceM:   12000,
    intervals:   [{ distanceM: 12000, zone: 1 }],
    rpe:         11,
    restMin:     0,
    tssMultiplier: 0.55,  // approx TSS for 45–60min UT2
    tags:        ['base', 'aerobic', 'endurance'],
  },
  {
    id:          'ut1_steady',
    name:        'UT1 Moderate',
    zone:        2,
    description: 'Upper aerobic tempo. Sustained 60–70 min at UT1 split.',
    distanceM:   14000,
    intervals:   [{ distanceM: 14000, zone: 2 }],
    rpe:         13,
    restMin:     0,
    tssMultiplier: 0.80,
    tags:        ['aerobic', 'tempo'],
  },
  {
    id:          'at_threshold',
    name:        'AT Threshold Pieces',
    zone:        3,
    description: '4 × 2000m @ AT pace. Key lactate-threshold session.',
    distanceM:   8000,
    intervals:   Array(4).fill({ distanceM: 2000, zone: 3 }),
    rpe:         15,
    restMin:     3,
    tssMultiplier: 1.05,
    tags:        ['threshold', 'lactate'],
  },
  {
    id:          'tr_pieces',
    name:        'TR Race Pace Pieces',
    zone:        4,
    description: '6 × 1000m @ race-pace minus 1–2 sec/500m. Classic BR TR session.',
    distanceM:   6000,
    intervals:   Array(6).fill({ distanceM: 1000, zone: 4 }),
    rpe:         16,
    restMin:     4,
    tssMultiplier: 1.20,
    tags:        ['race-pace', 'specificity'],
  },
  {
    id:          'race_pace',
    name:        '2k Pace Intervals',
    zone:        5,
    description: '8 × 500m at 2000m race pace. Core race-preparation session.',
    distanceM:   4000,
    intervals:   Array(8).fill({ distanceM: 500, zone: 5 }),
    rpe:         17,
    restMin:     5,
    tssMultiplier: 1.35,
    tags:        ['race-pace', 'quality'],
  },
  {
    id:          'an_power',
    name:        'AN Power Intervals',
    zone:        6,
    description: '10 × 250m at AN pace. Develops anaerobic power and sprint finish.',
    distanceM:   2500,
    intervals:   Array(10).fill({ distanceM: 250, zone: 6 }),
    rpe:         18,
    restMin:     6,
    tssMultiplier: 1.50,
    tags:        ['anaerobic', 'power'],
  },
  {
    id:          'step_test',
    name:        'Step Test Protocol',
    zone:        null,
    description: '5-step incremental test: 4min each @ 120%→100% of 2k pace. Tests aerobic capacity.',
    distanceM:   null,  // distance varies with pace
    intervals:   [
      { pctOf2k: 1.20, durationMin: 4, zone: 1 },
      { pctOf2k: 1.12, durationMin: 4, zone: 2 },
      { pctOf2k: 1.06, durationMin: 4, zone: 3 },
      { pctOf2k: 1.01, durationMin: 4, zone: 4 },
      { pctOf2k: 0.97, durationMin: 4, zone: 5 },
    ],
    rpe:         null,
    restMin:     1,
    tssMultiplier: 1.10,
    tags:        ['test', 'assessment'],
  },
]

// ── Template lookup ────────────────────────────────────────────────────────────
/**
 * @description Looks up a rowing session template by ID.
 * @param {string} id - Template ID (e.g. 'ut2_steady', 'at_threshold')
 * @returns {object|null} Template definition object, or null if not found
 * @source Paul (1969) — International rowing performance prediction; British Rowing intensity zones
 * @example
 * getRowingTemplate('at_threshold') // => {id:'at_threshold', name:'AT Threshold Pieces', ...}
 */
export function getRowingTemplate(id) {
  return ROWING_TEMPLATES.find(t => t.id === id) || null
}

/**
 * @description Returns all rowing templates that include a given British Rowing zone.
 * @param {number} zone - Zone number 1–7
 * @returns {object[]} Array of matching template definitions
 * @example
 * getTemplatesByZone(3) // => [{id:'at_threshold', ...}]
 */
export function getTemplatesByZone(zone) {
  return ROWING_TEMPLATES.filter(t => t.zone === zone || t.intervals?.some(i => i.zone === zone))
}

/**
 * @description Returns all rowing templates that include a given tag.
 * @param {string} tag - Tag string (e.g. 'threshold', 'aerobic', 'race-pace')
 * @returns {object[]} Array of matching template definitions
 * @example
 * getTemplatesByTag('anaerobic') // => [{id:'an_power', ...}]
 */
export function getTemplatesByTag(tag) {
  return ROWING_TEMPLATES.filter(t => t.tags?.includes(tag))
}

// ── Instantiate a template for an athlete ────────────────────────────────────
/**
 * @description Instantiates a rowing session template for a specific athlete by computing
 *   per-interval target splits from the athlete's 2000 m race split and zone boundaries.
 *   Also estimates session TSS using the template's TSS multiplier.
 * @param {string} templateId - Template ID from ROWING_TEMPLATES
 * @param {number} split2000Sec - Athlete's 2000 m race split in sec/500 m
 * @returns {object|null} Template with populated intervals, splits, and estimated TSS; null on invalid input
 * @source Paul (1969) — International rowing performance prediction; British Rowing intensity zones
 * @example
 * instantiateTemplate('at_threshold', 100)
 * // => {intervals:[{targetSplitSec:106, targetSplitFmt:'1:46',...}], estimatedTSS:~87, ...}
 */
export function instantiateTemplate(templateId, split2000Sec) {
  const tmpl = getRowingTemplate(templateId)
  if (!tmpl || !split2000Sec || split2000Sec <= 0) return null

  const zones = rowingZones(split2000Sec)
  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]))

  const intervals = tmpl.intervals.map(iv => {
    // Step test uses pctOf2k directly
    if (iv.pctOf2k != null) {
      const targetSplit = split2000Sec * iv.pctOf2k
      return {
        ...iv,
        targetSplitSec: Math.round(targetSplit * 10) / 10,
        targetSplitFmt: fmtSplit(targetSplit),
        durationMin: iv.durationMin,
      }
    }
    // Regular intervals use zone midpoint split
    const z = zoneMap[iv.zone]
    if (!z) return iv
    const mid = z.splitMin && z.splitMax
      ? (z.splitMin + z.splitMax) / 2
      : z.splitMax || z.splitMin || split2000Sec
    return {
      ...iv,
      targetSplitSec: Math.round(mid * 10) / 10,
      targetSplitFmt: fmtSplit(mid),
      estimatedDistanceM: iv.distanceM,
    }
  })

  // Estimate TSS: TSS ≈ tssMultiplier × 100 × (work_duration_hr)
  const totalWorkM = tmpl.distanceM || intervals.reduce((s, iv) => s + (iv.distanceM || 0), 0)
  const avgSplitSec = split2000Sec  // approximation for total session time
  const totalSec = totalWorkM > 0 ? (totalWorkM / 500) * avgSplitSec : 60 * 60
  const estimatedTSS = Math.round(tmpl.tssMultiplier * 100 * (totalSec / 3600) * 10) / 10

  return {
    ...tmpl,
    split2000Sec,
    split2000Fmt: fmtSplit(split2000Sec),
    intervals,
    estimatedTSS,
    totalWorkM,
  }
}

// ── Weekly template set ───────────────────────────────────────────────────────
/**
 * @description Returns a suggested weekly session mix (array of template IDs) for a given training phase.
 * @param {'base'|'build'|'peak'|'taper'} phase - Training phase name
 * @returns {string[]} Array of template IDs for the weekly plan
 * @source Paul (1969) — International rowing performance prediction; British Rowing periodization model
 * @example
 * weeklyTemplatePlan('peak') // => ['at_threshold', 'tr_pieces', 'race_pace', 'ut2_steady']
 */
export function weeklyTemplatePlan(phase) {
  const plans = {
    base:  ['ut2_steady', 'ut2_steady', 'ut1_steady', 'at_threshold'],
    build: ['ut2_steady', 'at_threshold', 'tr_pieces', 'ut1_steady'],
    peak:  ['at_threshold', 'tr_pieces', 'race_pace', 'ut2_steady'],
    taper: ['ut1_steady', 'race_pace', 'ut2_steady'],
  }
  return plans[phase] || plans.base
}
