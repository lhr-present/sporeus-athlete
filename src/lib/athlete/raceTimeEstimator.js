// src/lib/athlete/raceTimeEstimator.js
//
// Race-time projection across canonical distances (5K, 10K, half, full
// marathon) derived from the athlete's BEST recent running effort.
//
// We pick the best (lowest-pace) qualifying running session in a
// rolling window (default 90 days) where distanceKm >= 3 and
// durationMin > 0, then apply Riegel's 1981 endurance equation:
//
//   T2 = T1 * (D2 / D1) ^ 1.06
//
// Riegel R. (1981) "Athletic Records and Human Endurance"
//   American Scientist 69:285.
// Daniels J. (2014) Daniels' Running Formula, 3rd ed. — equivalent-
//   performance tables that mirror the Riegel exponent.
//
// Reliability is capped by extrapolation ratio (D2 / D1):
//   ratio <= 2.0  → HIGH
//   <= 5.0        → MEDIUM
//   > 5.0         → LOW   (heavy extrapolation; e.g. 5K → marathon)
//
// In addition, any target distance with a *similar-distance* effort
// in the window (a run whose distanceKm sits within +/- 20% of the
// target) is promoted to HIGH regardless of ratio — the projection
// is no longer pure extrapolation, it's anchored by a nearby data
// point.
//
// Pure function. No I/O, no React.

const MS_PER_DAY = 86400000
const DEFAULT_WINDOW_DAYS = 90
const MIN_REF_DISTANCE_KM = 3

/**
 * @description Riegel exponent. The original 1981 paper fitted ~1.06
 *   to world-record data across distances 800m–marathon; subsequent
 *   work (Daniels, Vickers) treats 1.06 as a reasonable population
 *   average for trained runners.
 */
export const RIEGEL_EXPONENT = 1.06

/**
 * @description Canonical race-distance targets, in km.
 */
export const RACE_TARGETS = Object.freeze([
  { name: '5K',   distanceKm: 5.0     },
  { name: '10K',  distanceKm: 10.0    },
  { name: 'HALF', distanceKm: 21.0975 },
  { name: 'FULL', distanceKm: 42.195  },
])

/**
 * @description A target is considered "calibrated" by a similar-
 *   distance effort if any run in the window has distanceKm within
 *   +/- this fraction of the target distance. 0.20 → +/-20%.
 */
const CALIBRATION_BAND = 0.20

function dayMs(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function isRunning(entry) {
  if (!entry) return false
  const type = String(entry.type || '')
  const sport = String(entry.sport || '')
  return /run|jog/i.test(type) || /run/i.test(sport)
}

/**
 * @description Apply Riegel projection.
 * @param {number} t1 - reference time in minutes
 * @param {number} d1 - reference distance in km
 * @param {number} d2 - target distance in km
 * @returns {number|null} projected time in minutes (null on bad input)
 */
export function riegelProject(t1, d1, d2) {
  if (!Number.isFinite(t1) || t1 <= 0) return null
  if (!Number.isFinite(d1) || d1 <= 0) return null
  if (!Number.isFinite(d2) || d2 <= 0) return null
  return t1 * Math.pow(d2 / d1, RIEGEL_EXPONENT)
}

/**
 * @description Classify reliability from the extrapolation ratio
 *   (D2/D1). Larger ratios = heavier extrapolation = lower trust.
 * @param {number} ratio
 * @returns {'HIGH'|'MEDIUM'|'LOW'}
 */
export function reliabilityFromRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'LOW'
  if (ratio <= 2.0) return 'HIGH'
  if (ratio <= 5.0) return 'MEDIUM'
  return 'LOW'
}

/**
 * @description Estimate race times across canonical distances.
 *
 * @param {{
 *   log:        Array,
 *   today?:     string,   // 'YYYY-MM-DD'; defaults to today UTC
 *   windowDays?: number,  // default 90
 * }} opts
 * @returns {null | {
 *   reference: {
 *     distanceKm: number,
 *     timeMin:    number,
 *     paceMinKm:  number,
 *     date:       string,
 *   },
 *   projections: Array<{
 *     name: '5K'|'10K'|'HALF'|'FULL',
 *     distanceKm: number,
 *     projectedMinutes: number,
 *     reliability: 'HIGH'|'MEDIUM'|'LOW',
 *   }>,
 *   citation: string,
 * }}
 */
export function estimateRaceTimes(opts) {
  const o = opts || {}
  const log = Array.isArray(o.log) ? o.log : []
  const windowDays = Number.isFinite(o.windowDays) && o.windowDays > 0
    ? o.windowDays
    : DEFAULT_WINDOW_DAYS

  const todayIso = o.today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(todayIso)
  if (todayMs == null) return null
  const cutoffMs = todayMs - windowDays * MS_PER_DAY

  // 1. Filter to running sessions in the window with both distance and
  //    duration present and a sane minimum reference distance.
  const runs = []
  for (const e of log) {
    if (!isRunning(e)) continue
    const dMs = dayMs(e?.date)
    if (dMs == null || dMs < cutoffMs || dMs > todayMs) continue
    const dist = Number(e?.distanceKm ?? (Number(e?.distanceM) > 0 ? Number(e.distanceM) / 1000 : NaN))  // v9.483: distanceM fallback (contract sweep A1)
    const dur  = Number(e?.durationMin ?? e?.duration)  // v9.483: canonical key fallback (contract sweep A1)
    if (!Number.isFinite(dist) || dist <= 0) continue
    if (!Number.isFinite(dur)  || dur  <= 0) continue
    runs.push({
      date: String(e.date).slice(0, 10),
      distanceKm: dist,
      durationMin: dur,
      paceMinKm: dur / dist,
    })
  }
  if (runs.length === 0) return null

  // 2. Reference: best pace among runs with distance >= MIN_REF_DISTANCE_KM.
  const eligible = runs.filter(r => r.distanceKm >= MIN_REF_DISTANCE_KM)
  if (eligible.length === 0) return null

  let ref = eligible[0]
  for (const r of eligible) {
    if (r.paceMinKm < ref.paceMinKm) ref = r
  }

  // 3. Project each canonical target.
  const projections = RACE_TARGETS.map(target => {
    const projectedMinutes = riegelProject(
      ref.durationMin,
      ref.distanceKm,
      target.distanceKm,
    )
    const ratio = target.distanceKm / ref.distanceKm
    let reliability = reliabilityFromRatio(ratio)

    // Promote to HIGH when the window contains an effort within
    // +/- CALIBRATION_BAND of the target.
    const low  = target.distanceKm * (1 - CALIBRATION_BAND)
    const high = target.distanceKm * (1 + CALIBRATION_BAND)
    const hasCalibratingRun = runs.some(r => r.distanceKm >= low && r.distanceKm <= high)
    if (hasCalibratingRun) reliability = 'HIGH'

    return {
      name: target.name,
      distanceKm: target.distanceKm,
      projectedMinutes,
      reliability,
    }
  })

  return {
    reference: {
      distanceKm: ref.distanceKm,
      timeMin:    ref.durationMin,
      paceMinKm:  ref.paceMinKm,
      date:       ref.date,
    },
    projections,
    citation: 'Riegel 1981; Daniels 2014',
  }
}
