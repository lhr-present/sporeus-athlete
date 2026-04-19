// src/lib/garmin/schemaMapper.js — E10: Garmin spike
// Maps Garmin Connect API activity schema → training_log schema.
// PROTOTYPE ONLY — not production code. Part of the v9 discovery spike.
//
// Garmin Connect API activity shape (v1 Garmin Health API):
// https://developer.garmin.com/health-api/api-docs/api-reference/#tag/Activity
//
// Key mismatches vs Strava (documented for GO/NO-GO decision):
//   + Garmin provides TSS natively (activityType + training effect)
//   + Garmin provides body battery, HRV daily, stress score (Strava doesn't)
//   + Garmin provides aerobicTrainingEffect (0–5) which maps loosely to RPE
//   - Garmin power data format differs: avgPower vs normalizedPower
//   - Garmin activity type strings differ from Sporeus type strings
//   - Garmin timestamps are local time, not UTC (need timezone handling)

// ── Activity type mapping ──────────────────────────────────────────────────

const GARMIN_TYPE_MAP = {
  running:                'Running',
  indoor_running:         'Running',
  treadmill_running:      'Running',
  trail_running:          'Running',
  cycling:                'Cycling',
  road_biking:            'Cycling',
  indoor_cycling:         'Cycling',
  mountain_biking:        'Cycling',
  gravel_cycling:         'Cycling',
  virtual_ride:           'Cycling',
  swimming:               'Swimming',
  open_water_swimming:    'Swimming',
  pool_swimming:          'Swimming',
  lap_swimming:           'Swimming',
  rowing:                 'Rowing',
  indoor_rowing:          'Rowing',
  triathlon:              'Triathlon',
  strength_training:      'Strength',
  fitness_equipment:      'Strength',
  yoga:                   'Strength',
  hiit:                   'Strength',
}

/**
 * Map Garmin activity type key to Sporeus type string.
 * @param {string} garminType  — Garmin typeKey (e.g. 'running', 'cycling')
 * @returns {string}  Sporeus type string (e.g. 'Running')
 */
export function mapActivityType(garminType) {
  if (!garminType) return 'Other'
  const key   = garminType.toLowerCase().replace(/[-\s]/g, '_')
  return GARMIN_TYPE_MAP[key] || 'Other'
}

/**
 * Convert aerobic training effect (Garmin ATE, 0–5 scale) to RPE equivalent.
 * Mapping is approximate — ATE measures aerobic stimulus, not perceived effort.
 * @param {number} ate  — Garmin aerobicTrainingEffect (0–5)
 * @returns {number}  RPE 1–10
 */
export function ateToRpe(ate) {
  if (ate == null || isNaN(ate)) return null
  // 0–1 → RPE 1–2 (recovery)
  // 1–2 → RPE 3–4 (easy)
  // 2–3 → RPE 5–6 (moderate)
  // 3–4 → RPE 7–8 (hard)
  // 4–5 → RPE 9–10 (very hard)
  const rpe = Math.round(ate * 2) + 1
  return Math.min(10, Math.max(1, rpe))
}

/**
 * Extract a YYYY-MM-DD date from a Garmin local timestamp.
 * Garmin provides startTimeLocal as 'YYYY-MM-DD HH:MM:SS' or Unix ms.
 * @param {string|number} garminTs
 * @returns {string|null}
 */
export function garminDateToLocal(garminTs) {
  if (!garminTs) return null
  // Already a string like '2024-06-01 07:30:00'
  if (typeof garminTs === 'string' && garminTs.match(/^\d{4}-\d{2}-\d{2}/)) {
    return garminTs.slice(0, 10)
  }
  // Unix ms
  if (typeof garminTs === 'number') {
    const d = new Date(garminTs)
    if (isNaN(d.getTime())) return null
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  return null
}

/**
 * Map a Garmin Connect API activity object → Sporeus training_log row.
 * Returns partial row — caller merges with user_id before DB insert.
 *
 * @param {Object} garminActivity  — raw Garmin Connect API activity
 * @returns {{
 *   date: string,
 *   type: string,
 *   duration: number,       // minutes
 *   tss: number|null,
 *   rpe: number|null,
 *   bpm_avg: number|null,
 *   bpm_max: number|null,
 *   power_norm: number|null,
 *   distance_km: number|null,
 *   notes: string,
 *   garmin_activity_id: string,
 *   _unmapped: Object,      // Garmin fields with no training_log equivalent
 * }}
 */
export function mapGarminActivity(garminActivity) {
  if (!garminActivity) return null
  const g = garminActivity

  const date     = garminDateToLocal(g.startTimeLocal || g.startTimeGMT)
  const durationSec = Number(g.duration || g.movingDuration) || 0
  const duration = Math.round(durationSec / 60)
  const type     = mapActivityType(g.activityType?.typeKey || g.activityType)
  const bpmAvg   = g.averageHR ? Math.round(g.averageHR) : null
  const bpmMax   = g.maxHR ? Math.round(g.maxHR) : null
  const normPower= g.normPower || g.normalizedPower || null
  const distM    = g.distance || 0
  const distKm   = distM > 0 ? Math.round(distM / 10) / 100 : null
  const ate      = g.aerobicTrainingEffect
  const rpe      = ateToRpe(ate)
  // Garmin TSS: available as 'trainingStressScore' for cycling; not for all types
  const tss      = g.trainingStressScore ? Math.round(g.trainingStressScore) : null

  // Garmin-specific fields with no direct training_log mapping
  const unmapped = {}
  if (g.bodyBattery != null)         unmapped.bodyBattery = g.bodyBattery
  if (g.stressScore != null)         unmapped.stressScore = g.stressScore
  if (g.hrvWeeklyAverage != null)    unmapped.hrvWeeklyAverage = g.hrvWeeklyAverage
  if (g.anaerobicTrainingEffect != null) unmapped.anaerobicTE = g.anaerobicTrainingEffect
  if (g.trainingEffect != null)      unmapped.trainingEffect = g.trainingEffect

  return {
    date,
    type,
    duration,
    tss,
    rpe,
    bpm_avg:           bpmAvg,
    bpm_max:           bpmMax,
    power_norm:        normPower ? Math.round(normPower) : null,
    distance_km:       distKm,
    notes:             `[Garmin] ${g.activityName || ''}`.trim(),
    garmin_activity_id: String(g.activityId || ''),
    _unmapped:         unmapped,
  }
}

/**
 * Batch map an array of Garmin activities.
 * Filters out null results (missing dates, zero duration).
 * @param {Object[]} activities
 * @returns {Object[]}
 */
export function mapGarminActivities(activities) {
  if (!Array.isArray(activities)) return []
  return activities
    .map(mapGarminActivity)
    .filter(row => row && row.date && row.duration > 0)
}
