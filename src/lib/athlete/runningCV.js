// ─── src/lib/athlete/runningCV.js — Critical Velocity wrapper (E42) ────────────
import { criticalVelocity } from '../sport/running.js'

// ── Distance buckets ──────────────────────────────────────────────────────────
const DISTANCE_BUCKETS = [
  { label: '1K',  min: 900,   max: 1200  },
  { label: '3K',  min: 2700,  max: 3300  },
  { label: '5K',  min: 4500,  max: 5500  },
  { label: '10K', min: 9000,  max: 11000 },
  { label: 'HM',  min: 18000, max: 22500 },
  { label: 'M',   min: 38000, max: 46000 },
]

/**
 * Assigns distanceM to a distance bucket label, or null if no bucket matches.
 * @param {number} distanceM
 * @returns {string|null}
 */
function assignBucket(distanceM) {
  if (!distanceM || distanceM <= 0) return null
  const bucket = DISTANCE_BUCKETS.find(b => distanceM >= b.min && distanceM <= b.max)
  return bucket ? bucket.label : null
}

/**
 * Returns true when a session is a run session.
 * @param {object} session
 * @returns {boolean}
 */
function isRunSession(session) {
  if (!session) return false
  if ((session.type || '').toLowerCase() === 'run') return true
  if ((session.sport || '').toLowerCase().includes('running')) return true
  return false
}

/**
 * Extracts best (fastest) run efforts per distance bucket from log.
 * Each returned entry: { distanceM, timeSec, label, date }
 * One entry per bucket — lowest timeSec wins.
 * Sanity: pace must be > 120 sec/km AND < 700 sec/km.
 *
 * @param {Array} log - Training log entries
 * @returns {Array<{distanceM:number, timeSec:number, label:string, date:string}>}
 */
export function extractRunEfforts(log) {
  if (!Array.isArray(log) || log.length === 0) return []

  // best effort per bucket label → { distanceM, timeSec, label, date }
  const bestPerBucket = {}

  for (const session of log) {
    if (!isRunSession(session)) continue
    const dist = session.distanceM
    const dur  = session.duration   // minutes
    if (!dist || dist <= 0) continue
    if (!dur  || dur  <= 0) continue

    const label = assignBucket(dist)
    if (!label) continue

    const timeSec = dur * 60

    // Sanity: pace (sec/km) = timeSec / (dist / 1000)
    const paceSecKm = timeSec / (dist / 1000)
    if (paceSecKm <= 120 || paceSecKm >= 700) continue

    if (!bestPerBucket[label] || timeSec < bestPerBucket[label].timeSec) {
      bestPerBucket[label] = {
        distanceM: dist,
        timeSec,
        label,
        date: session.date || null,
      }
    }
  }

  return Object.values(bestPerBucket)
}

/**
 * Computes critical velocity from the training log.
 * Returns null if < 2 distance buckets available.
 *
 * @param {Array} log - Training log entries
 * @returns {{CV:number, DAna:number, CVPaceSecKm:number, effortsUsed:number, efforts:Array}|null}
 */
export function computeRunningCV(log) {
  const efforts = extractRunEfforts(log)
  if (efforts.length < 2) return null

  const result = criticalVelocity(
    efforts.map(e => ({ distanceM: e.distanceM, timeSec: e.timeSec }))
  )
  if (!result) return null

  return {
    CV:            result.CV,
    DAna:          result.DAna,
    CVPaceSecKm:   result.CVPaceSecKm,
    effortsUsed:   efforts.length,
    efforts,
  }
}

/**
 * Formats sec/km pace as "M:SS /km".
 * e.g. 267 → "4:27 /km", 300 → "5:00 /km"
 *
 * @param {number} secPerKm
 * @returns {string}
 */
export function fmtPace(secPerKm) {
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

/**
 * Classifies CV performance relative to typical recreational thresholds.
 * Based on CV pace (sec/km):
 *   < 240 (< 4:00/km)  → 'elite'
 *   240–300             → 'advanced'
 *   300–360             → 'intermediate'
 *   > 360               → 'recreational'
 *
 * @param {number} cvPaceSecKm
 * @returns {'elite'|'advanced'|'intermediate'|'recreational'}
 */
export function classifyCV(cvPaceSecKm) {
  if (cvPaceSecKm < 240) return 'elite'
  if (cvPaceSecKm < 300) return 'advanced'
  if (cvPaceSecKm < 360) return 'intermediate'
  return 'recreational'
}
