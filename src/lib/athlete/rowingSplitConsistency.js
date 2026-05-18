// ─── rowingSplitConsistency.js — Split CV across same-distance rowing pieces ──
//
// Surfaces "split consistency" as a technique / training signal distinct
// from absolute pace (which RowingMetricsCard already covers). A trained
// rower at steady-state should hold their /500m split within ±2 seconds
// across same-distance pieces (Smith 2012 — rowing biomechanics). Foster
// (2001) generalises high pacing variability as a training-load /
// technique-breakdown red flag; Steinacker (1993) frames steady-state
// rowing physiology that justifies the RPE 4–7 gate (true UT/AT work,
// not all-out tests or recovery paddles).
//
// Method:
//   • Filter the log to rowing sessions within the last `windowDays`
//     (default 28d) that carry both distance + duration AND have an RPE
//     value in the 4–7 band (steady-state-like, not test / recovery).
//   • Bucket each session by piece-distance: 500, 1000, 2000, 5000,
//     10000 metres — ±5% tolerance per bucket so a 1.95 km piece still
//     groups with the 2 km bucket.
//   • Compute split-per-500m for each session via `splitPer500m` from
//     sport/rowing.js (reuse — no math duplication).
//   • For every bucket with ≥3 sessions: CV % = (stdDev / mean) × 100.
//   • avgCvPct = mean of qualifying bucket CVs.
//   • Returns null if no bucket clears the ≥3 threshold.
//
// Bands (per scientific grounding):
//   <1 %   → ELITE          (green)
//   1–2 %  → COMPETITIVE    (blue)
//   2–4 %  → DEVELOPING     (orange)
//   >4 %   → INCONSISTENT   (red — technique breakdown or extreme variation)
//
// References:
//   Foster C. (2001). Monitoring training in athletes with reference to
//     overtraining syndrome. Med Sci Sports Exerc.
//   Smith T.B. (2012). Biomechanics of rowing.
//   Steinacker J.M. (1993). Physiological aspects of training in rowing.
//     Int J Sports Med.

import { splitPer500m } from '../sport/rowing.js'

export const ROWING_SPLIT_CONSISTENCY_CITATION =
  'Foster 2001; Smith 2012; Steinacker 1993'

// Piece-distance buckets — metres. ±5 % tolerance is applied at runtime.
const PIECE_BUCKETS = [500, 1000, 2000, 5000, 10000]
const BUCKET_TOLERANCE = 0.05  // ±5 %

// Steady-state RPE band — exclude all-out tests (RPE >7) and recovery
// paddles (RPE <4). This is the Steinacker 1993 UT/AT window.
const RPE_MIN = 4
const RPE_MAX = 7

/**
 * Returns true when the entry looks like a rowing session.
 * @param {object} e
 * @returns {boolean}
 */
function isRowingSession(e) {
  if (!e) return false
  if ((e.sport || '').toLowerCase() === 'rowing') return true
  if (/row/i.test(e.type || '')) return true
  if (/row/i.test(e.sport || '')) return true
  if ((e.sport_type || '').toLowerCase() === 'rowing') return true
  return false
}

/**
 * Returns the bucket distance (one of PIECE_BUCKETS) that distanceM falls
 * into within ±BUCKET_TOLERANCE, or null if it matches no bucket.
 * @param {number} distanceM
 * @returns {number|null}
 */
function assignBucket(distanceM) {
  if (!distanceM || distanceM <= 0) return null
  for (const b of PIECE_BUCKETS) {
    const lo = b * (1 - BUCKET_TOLERANCE)
    const hi = b * (1 + BUCKET_TOLERANCE)
    if (distanceM >= lo && distanceM <= hi) return b
  }
  return null
}

/**
 * Returns days-difference (todayISO − entryDateISO). Negative or NaN → null.
 * Both inputs are 'YYYY-MM-DD' strings.
 * @param {string} todayISO
 * @param {string} entryDateISO
 * @returns {number|null}
 */
function daysAgo(todayISO, entryDateISO) {
  if (!todayISO || !entryDateISO) return null
  const t = new Date(todayISO + 'T00:00:00Z').getTime()
  const e = new Date(entryDateISO + 'T00:00:00Z').getTime()
  if (!Number.isFinite(t) || !Number.isFinite(e)) return null
  return Math.floor((t - e) / 86400000)
}

/**
 * Population standard deviation of a numeric array.
 * Uses n (not n-1) — appropriate for a complete observation set across
 * a closed time-window, and avoids divide-by-zero footguns at n=1.
 * @param {number[]} arr
 * @returns {number}
 */
function stdDev(arr) {
  if (!arr || arr.length === 0) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = arr.reduce((a, v) => a + (v - mean) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

/**
 * Returns the mean of an array (no guard — caller has confirmed length>0).
 * @param {number[]} arr
 */
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/**
 * Maps avgCvPct → band label.
 * @param {number} cvPct
 * @returns {'ELITE'|'COMPETITIVE'|'DEVELOPING'|'INCONSISTENT'}
 */
function classifyCv(cvPct) {
  if (cvPct < 1) return 'ELITE'
  if (cvPct < 2) return 'COMPETITIVE'
  if (cvPct <= 4) return 'DEVELOPING'
  return 'INCONSISTENT'
}

/**
 * Compute rowing-split coefficient-of-variation across same-distance pieces.
 *
 * Returns null when no piece-distance bucket has ≥3 qualifying sessions.
 *
 * @param {object} args
 * @param {Array}  args.log         — training log (entries with date/type/distance/duration/rpe)
 * @param {string} args.today       — 'YYYY-MM-DD' reference date
 * @param {number} [args.windowDays=28] — lookback window in days
 * @returns {{
 *   avgCvPct: number,
 *   bucketResults: Array<{distance:number, n:number, meanSplitSec:number, cvPct:number}>,
 *   band: 'ELITE'|'COMPETITIVE'|'DEVELOPING'|'INCONSISTENT',
 *   citation: string,
 * } | null}
 */
export function computeRowingSplitConsistency({ log, today, windowDays = 28 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  if (!today || typeof today !== 'string') return null

  // 1. Filter to rowing + steady-state-like + within window + has dist+dur.
  const qualifying = []
  for (const e of log) {
    if (!isRowingSession(e)) continue
    const dist = Number(e.distance)
    const dur  = Number(e.duration)
    if (!Number.isFinite(dist) || dist <= 0) continue
    if (!Number.isFinite(dur)  || dur  <= 0) continue
    const rpe = Number(e.rpe)
    if (!Number.isFinite(rpe)) continue
    if (rpe < RPE_MIN || rpe > RPE_MAX) continue
    const ago = daysAgo(today, e.date)
    if (ago == null || ago < 0 || ago > windowDays) continue
    const bucket = assignBucket(dist)
    if (bucket == null) continue
    const split = splitPer500m(dist, dur)
    if (!Number.isFinite(split) || split <= 0) continue
    qualifying.push({ bucket, split })
  }

  if (qualifying.length === 0) return null

  // 2. Group by bucket → array of split values.
  const byBucket = new Map()
  for (const q of qualifying) {
    if (!byBucket.has(q.bucket)) byBucket.set(q.bucket, [])
    byBucket.get(q.bucket).push(q.split)
  }

  // 3. For each bucket with ≥3 sessions, compute CV %.
  const bucketResults = []
  for (const b of PIECE_BUCKETS) {
    const splits = byBucket.get(b)
    if (!splits || splits.length < 3) continue
    const m   = mean(splits)
    const sd  = stdDev(splits)
    if (m <= 0) continue
    const cvPct = (sd / m) * 100
    bucketResults.push({
      distance:     b,
      n:            splits.length,
      meanSplitSec: Math.round(m * 100) / 100,
      cvPct:        Math.round(cvPct * 100) / 100,
    })
  }

  if (bucketResults.length === 0) return null

  const avgCvPct = Math.round(
    (bucketResults.reduce((a, r) => a + r.cvPct, 0) / bucketResults.length) * 100
  ) / 100

  return {
    avgCvPct,
    bucketResults,
    band: classifyCv(avgCvPct),
    citation: ROWING_SPLIT_CONSISTENCY_CITATION,
  }
}
