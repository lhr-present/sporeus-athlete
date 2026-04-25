// ─── src/lib/athlete/triLoad.js — Triathlon load breakdown wrapper (E44) ──────
// Consumes calculateTriathlonTSS, brickFatigueAdjustment, TRIATHLON_DISTANCES
// from triathlon.js and derives a 28-day load picture for the TriathlonLoadCard.
//
// Approximation note: computeRepresentativeTSS uses mean session data from the
// last 28 days as proxy inputs for calculateTriathlonTSS.  Swim CSS is estimated
// from the fastest swim-pace session; bike NP is skipped when no power field is
// present; run hrThresh defaults to maxHR × 0.85 = 85% of an assumed 180 bpm.
// Results should be treated as indicative, not prescriptive.

import { calculateTriathlonTSS, brickFatigueAdjustment, TRIATHLON_DISTANCES, getTriathlonZones } from '../sport/triathlon.js'

// ── Sport classifier ──────────────────────────────────────────────────────────

/**
 * Classify a session into 'swim' | 'bike' | 'run' | null.
 * Checks session.type first, then session.sport as a fallback.
 */
function sessionSport(s) {
  if (!s) return null
  const type  = (s.type  || '').toLowerCase()
  const sport = (s.sport || '').toLowerCase()

  if (type === 'swim'  || sport.includes('swim'))                    return 'swim'
  if (type === 'bike'  || type === 'cycling' || sport.includes('cycl')) return 'bike'
  if (type === 'run'   || sport === 'running')                       return 'run'
  return null
}

// ── Cutoff date helper ────────────────────────────────────────────────────────

function cutoffDate(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// ── Extract sessions by discipline ────────────────────────────────────────────

/**
 * Filter log to last N days and group by discipline.
 * @param {Array} log
 * @param {number} days
 * @returns {{ swim: Array, bike: Array, run: Array }}
 */
export function extractDisciplineSessions(log, days = 28) {
  if (!Array.isArray(log) || log.length === 0) return { swim: [], bike: [], run: [] }
  const cutoff = cutoffDate(days)
  const result = { swim: [], bike: [], run: [] }
  for (const s of log) {
    if (!s.date || s.date < cutoff) continue
    const sp = sessionSport(s)
    if (sp && result[sp]) result[sp].push(s)
  }
  return result
}

// ── Detect brick sessions ─────────────────────────────────────────────────────

/**
 * Finds days where both a bike and a run session exist (same calendar date).
 * @param {Array} log
 * @param {number} days
 * @returns {Array<{date:string, bikeSession:object, runSession:object, brickFactor:number}>}
 */
export function detectBrickSessions(log, days = 28) {
  if (!Array.isArray(log) || log.length === 0) return []
  const { bike, run } = extractDisciplineSessions(log, days)
  if (bike.length === 0 || run.length === 0) return []

  // Index run sessions by date (keep last if multiple)
  const runByDate = {}
  for (const s of run) {
    if (s.date) runByDate[s.date] = s
  }

  const bricks = []
  for (const bs of bike) {
    const rs = bs.date ? runByDate[bs.date] : null
    if (!rs) continue
    const bikeTSS    = bs.tss  || 0
    const runDistKm  = (rs.distanceM || 0) / 1000
    const brickFactor = brickFatigueAdjustment(bikeTSS, runDistKm)
    bricks.push({ date: bs.date, bikeSession: bs, runSession: rs, brickFactor })
  }
  return bricks
}

// ── TSS summer ────────────────────────────────────────────────────────────────

function sumTSS(sessions) {
  return sessions.reduce((acc, s) => acc + (s.tss || 0), 0)
}

// ── Mean helper ───────────────────────────────────────────────────────────────

function mean(arr, key) {
  const vals = arr.map(s => s[key] || 0).filter(v => v > 0)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ── Representative TSS from 28-day mean data ──────────────────────────────────

/**
 * Compute a single representative TSS week via calculateTriathlonTSS using
 * mean session data from the last 28 days. Returns null if no discipline data.
 *
 * Approximation:
 *   - Swim: mean duration (min) + CSS estimated from fastest pace session
 *   - Bike: mean duration (min) → converted to sec; NP/FTP skipped if no power data → null
 *   - Run:  mean duration (min) → converted to sec; hrThresh defaults to 180 × 0.85
 */
function computeRepresentativeTSS({ swim, bike, run }) {
  // Swim
  let swimArg = null
  if (swim.length > 0) {
    const avgDurMin = mean(swim, 'duration')
    // Find fastest pace session (smallest sec/100m) for CSS estimate
    let bestPaceSec = null
    for (const s of swim) {
      if (s.distanceM > 0 && s.duration > 0) {
        const pace = (s.duration * 60) / (s.distanceM / 100)
        if (pace >= 40 && pace <= 300) {
          if (bestPaceSec === null || pace < bestPaceSec) bestPaceSec = pace
        }
      }
    }
    if (avgDurMin && bestPaceSec) {
      // current pace = CSS × 1.05 (5% above threshold as representative effort)
      swimArg = {
        durationMin:       avgDurMin,
        currentSecPer100m: bestPaceSec * 1.05,
        cssSecPer100m:     bestPaceSec,
      }
    }
  }

  // Bike
  let bikeArg = null
  if (bike.length > 0) {
    const avgDurMin = mean(bike, 'duration')
    // Check if any sessions carry power data
    const pwrVals = bike.map(s => s.avgNormalizedPower || s.avgPower || 0).filter(v => v > 0)
    const avgPwr  = pwrVals.length > 0 ? pwrVals.reduce((a, b) => a + b, 0) / pwrVals.length : null
    // FTP from session-level field or skip
    const ftpVals = bike.map(s => s.ftp || 0).filter(v => v > 0)
    const avgFtp  = ftpVals.length > 0 ? ftpVals.reduce((a, b) => a + b, 0) / ftpVals.length : null
    if (avgDurMin && avgPwr && avgFtp) {
      bikeArg = {
        durationSec:          avgDurMin * 60,
        avgNormalizedPowerW:  avgPwr,
        ftpW:                 avgFtp,
      }
    }
    // If no power data available, bikeArg stays null — calculateTriathlonTSS will skip this discipline
  }

  // Run
  let runArg = null
  if (run.length > 0) {
    const avgDurMin = mean(run, 'duration')
    const avgHR     = mean(run, 'hrAvg')
    if (avgDurMin && avgHR) {
      // hrThresh default: 85% of 180 bpm (common threshold estimate when no profile data)
      const hrThresh = 180 * 0.85
      runArg = {
        durationSec: avgDurMin * 60,
        hrAvg:       avgHR,
        hrThresh,
      }
    }
  }

  const result = calculateTriathlonTSS(swimArg, bikeArg, runArg)
  return result ? result.totalTSS : null
}

// ── Nearest race distance ─────────────────────────────────────────────────────

/**
 * Compare weekly avg TSS (totalTSS / 4) to typical TSS ranges in TRIATHLON_DISTANCES.
 * Returns the key of the closest distance, or null if no TSS.
 */
function nearestRaceDistance(totalTSS28) {
  if (!totalTSS28 || totalTSS28 <= 0) return null
  const weeklyAvg = totalTSS28 / 4
  const keys = Object.keys(TRIATHLON_DISTANCES)
  let best = null
  let bestDiff = Infinity
  for (const key of keys) {
    const { typicalTSS } = TRIATHLON_DISTANCES[key]
    const mid = (typicalTSS.lo + typicalTSS.hi) / 2
    const diff = Math.abs(weeklyAvg - mid)
    if (diff < bestDiff) { bestDiff = diff; best = key }
  }
  return best
}

// ── Tri zone system ───────────────────────────────────────────────────────────

/**
 * Compute all 3 discipline zones from profile data using getTriathlonZones.
 * CSS is not stored in profile; swimming zones are only shown when cssSecPer100m
 * is explicitly available (currently always null from profile alone).
 *
 * @param {object} profile - athlete profile (profile.ftp, profile.vdot checked)
 * @returns {{cycling?: Array, running?: Array, swimming?: Array}|null}
 */
export function computeTriZones(profile) {
  const ftpWatts      = parseFloat(profile?.ftp  || 0) || null
  const vdot          = parseFloat(profile?.vdot || 0) || null
  const cssSecPer100m = null  // not stored in profile; pass null
  const zones = getTriathlonZones(ftpWatts, vdot, cssSecPer100m)
  if (!zones || Object.keys(zones).length === 0) return null
  return zones  // {cycling?: [...], running?: [...], swimming?: [...]}
}

// ── Main compute function ─────────────────────────────────────────────────────

/**
 * Compute the full triathlon load picture for the last 28 days.
 *
 * Returns null when the athlete is not a triathlete and has fewer than 2
 * distinct disciplines in their recent log.
 *
 * @param {Array}  log       - full training log
 * @param {object} profile   - athlete profile (profile.primarySport checked)
 * @returns {object|null}
 */
export function computeTriLoad(log, profile = {}) {
  if (!Array.isArray(log)) return null

  const { swim, bike, run } = extractDisciplineSessions(log, 28)
  const disciplineCount = [swim, bike, run].filter(arr => arr.length > 0).length

  const isTriathlete = (profile.primarySport || '').toLowerCase().includes('tri')

  // Must be a triathlete profile OR have at least 2 disciplines active
  if (!isTriathlete && disciplineCount < 2) return null

  const swimTSS28  = sumTSS(swim)
  const bikeTSS28  = sumTSS(bike)
  const runTSS28   = sumTSS(run)
  const totalTSS28 = swimTSS28 + bikeTSS28 + runTSS28

  const bricks     = detectBrickSessions(log, 28)
  const repWeekTSS = computeRepresentativeTSS({ swim, bike, run })
  const nearestRace = nearestRaceDistance(totalTSS28)

  return {
    swimTSS:    swimTSS28,
    bikeTSS:    bikeTSS28,
    runTSS:     runTSS28,
    totalTSS:   totalTSS28,
    swimCount:  swim.length,
    bikeCount:  bike.length,
    runCount:   run.length,
    bricks,
    repWeekTSS,
    nearestRace,
    DISTANCES: TRIATHLON_DISTANCES,
  }
}
