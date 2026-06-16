// ─── swimSwolfTrend.js — SWOLF 28-day efficiency trend (Maglischo 2003) ──────
//
// SWOLF = strokes per length + seconds per length. Lower = more efficient.
// A falling SWOLF trend over 28d signals technique improvement (more
// distance per stroke at a given pace). A rising SWOLF trend during a
// heavy training block flags fatigue-driven technique breakdown.
//
// References: Maglischo (2003) "Swimming Even Faster"; Wakayoshi et al.
// (1992). Bands here are descriptive heuristics, not normative limits.

export const SWOLF_TREND_CITATION = 'Maglischo 2003; Wakayoshi 1992'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSwimEntry(e) {
  if (!e) return false
  if (/swim/i.test(e.type || '')) return true
  if (/swim/i.test(e.sport || '')) return true
  return false
}

function isoMinusDays(today, days) {
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Derive a SWOLF value from a swim log entry. Returns null when not
 * derivable or outside the sanity range [20, 150].
 *
 * Prefers the direct `entry.swolf` field. Otherwise computes:
 *   strokes_per_length = strokes / (distance / poolLength)
 *   seconds_per_length = (duration * 60) / (distance / poolLength)
 *   SWOLF = strokes_per_length + seconds_per_length
 */
// NOTE (dead-card audit 2026-06-16): SWOLF derivation needs `swolf` directly,
// OR `strokes` + `poolLength` (+ distance + duration). As of this writing NO
// capture path produces any of those three fields: parseFIT/parseGPX/
// parseBulkCSV/parseConcept2CSV (fileImport.js) emit none, QuickAddModal has no
// swim-stroke inputs, and sanitizeLogEntry would strip them anyway. So this
// card returns null on every real entry. It reads the sanitizer-emitted
// `duration`/`distance`/`distanceM` below, but those alone can't yield SWOLF.
// To make this card live we need a swim-detail capture path that records
// strokes-per-length + pool length (FIT length messages, or manual swim fields
// in QuickAddModal), then whitelist `swolf`/`strokes`/`poolLength` in
// validate.js. Until then the card is intentionally inert — not faked.
function deriveSwolf(e) {
  if (!e) return null

  // Prefer the direct field when it looks sane
  const direct = Number(e.swolf)
  if (Number.isFinite(direct) && direct >= 20 && direct <= 150) {
    return direct
  }

  const strokes    = Number(e.strokes)
  const distance   = Number(e.distance ?? e.distanceM)
  const duration   = Number(e.duration)
  const poolLength = Number(e.poolLength)

  if (!Number.isFinite(strokes) || strokes <= 0) return null
  if (!Number.isFinite(distance) || distance <= 0) return null
  if (!Number.isFinite(duration) || duration <= 0) return null
  if (!Number.isFinite(poolLength) || poolLength <= 0) return null

  const lengths = distance / poolLength
  if (lengths <= 0) return null

  const strokesPerLen = strokes / lengths
  const secondsPerLen = (duration * 60) / lengths
  const swolf = strokesPerLen + secondsPerLen

  if (!Number.isFinite(swolf)) return null
  if (swolf < 20 || swolf > 150) return null
  return swolf
}

function classifyBand(avgSwolf) {
  if (avgSwolf < 45) return 'ELITE'
  if (avgSwolf < 55) return 'COMPETITIVE'
  if (avgSwolf < 65) return 'TRAINED'
  if (avgSwolf <= 80) return 'RECREATIONAL'
  return 'BEGINNER'
}

function round1(x) {
  return Math.round(x * 10) / 10
}

// ─── computeSwimSwolfTrend ────────────────────────────────────────────────────
/**
 * Compute the rolling SWOLF trend over the last `windowDays` days.
 *
 * @param {object} args
 * @param {Array}  args.log        - full training log
 * @param {string} args.today      - YYYY-MM-DD anchor for the window
 * @param {number} [args.windowDays=28]
 * @returns {{
 *   avgSwolf:    number,
 *   n:           number,
 *   band:        'ELITE'|'COMPETITIVE'|'TRAINED'|'RECREATIONAL'|'BEGINNER',
 *   weeklyMeans: number[],
 *   trend:       'improving'|'stable'|'declining',
 *   citation:    string,
 * } | null}
 */
export function computeSwimSwolfTrend({ log, today, windowDays = 28 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  if (!today) return null

  const cutoff = isoMinusDays(today, windowDays)

  // Filter to swim sessions inside the window with a derivable SWOLF and
  // a non-recovery RPE.
  const entries = []
  for (const e of log) {
    if (!isSwimEntry(e)) continue
    if (!e.date) continue
    if (e.date < cutoff || e.date > today) continue
    const rpe = Number(e.rpe)
    if (Number.isFinite(rpe) && rpe < 3) continue
    const swolf = deriveSwolf(e)
    if (swolf == null) continue
    entries.push({ date: e.date, swolf })
  }

  if (entries.length < 3) return null

  // Sort ascending by date so the first bucket = oldest week.
  entries.sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const n = entries.length
  const avgSwolf = round1(entries.reduce((s, e) => s + e.swolf, 0) / n)
  const band = classifyBand(avgSwolf)

  // ── 4 weekly buckets (oldest → newest) ─────────────────────────────────────
  // Use today as the anchor: bucket index 3 = last 7 days, bucket 2 = 8–14,
  // bucket 1 = 15–21, bucket 0 = 22–28.
  const todayTs = new Date(today + 'T00:00:00Z').getTime()
  const DAY_MS  = 24 * 60 * 60 * 1000
  const buckets = [[], [], [], []]
  for (const e of entries) {
    const eTs    = new Date(e.date + 'T00:00:00Z').getTime()
    const ageDay = Math.floor((todayTs - eTs) / DAY_MS)
    let idx
    if      (ageDay <  7) idx = 3
    else if (ageDay < 14) idx = 2
    else if (ageDay < 21) idx = 1
    else                  idx = 0
    if (idx < 0) idx = 0
    if (idx > 3) idx = 3
    buckets[idx].push(e.swolf)
  }

  const weeklyMeans = buckets.map(b => (
    b.length === 0 ? null : round1(b.reduce((s, v) => s + v, 0) / b.length)
  ))

  // Pick the first non-null bucket (oldest week with data) and the last
  // non-null bucket (newest week with data) for the trend comparison.
  const firstMean = weeklyMeans.find(m => m != null) ?? null
  const lastMean  = [...weeklyMeans].reverse().find(m => m != null) ?? null

  let trend
  if (firstMean == null || lastMean == null || firstMean === lastMean) {
    trend = 'stable'
  } else {
    const delta = lastMean - firstMean
    if (delta <= -2) trend = 'improving'
    else if (delta >=  2) trend = 'declining'
    else trend = 'stable'
  }

  return {
    avgSwolf,
    n,
    band,
    weeklyMeans,
    trend,
    citation: SWOLF_TREND_CITATION,
  }
}
