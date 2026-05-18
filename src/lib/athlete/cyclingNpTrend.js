// ─── cyclingNpTrend.js — Best NP-by-duration trend over 90 days ──────────────
//
// Surfaces the canonical Coggan & Allen fitness-progression signal: best
// Normalized Power held for a target duration (5/20/60 min) tracked across
// three ~30-day sub-windows inside the rolling 90d window. A rising
// 20-min best NP is FTP rising; a flat 90d trend at constant volume is a
// plateau. CPDecay tracks CP / W' bioenergetics; this card tracks the
// duration-bucketed fitness ceiling — they do not overlap.
//
// Sources:
//   Coggan A. & Allen H. (2010) Training and Racing with a Power Meter, 2e
//   Allen H. & Coggan A. (2019) Training and Racing with a Power Meter, 3e
//   Skiba P. (2008) Calculation of Power Output and Quantification of Training

export const CYCLING_NP_TREND_CITATION = 'Coggan & Allen 2010; Allen & Coggan 2019; Skiba 2008'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return YYYY-MM-DD `n` days before the reference date. */
function daysBefore(refISO, n) {
  const d = new Date(refISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Extract Normalized Power from a session entry — accepts `np` or `normalizedPower`. */
function getNP(entry) {
  const raw = entry?.np ?? entry?.normalizedPower
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Extract duration in minutes from a session entry. */
function getDurationMin(entry) {
  const raw = entry?.duration ?? entry?.durationMin ?? entry?.minutes
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** True iff the entry looks like a cycling session. */
function isBike(entry) {
  const t = String(entry?.type || '')
  const s = String(entry?.sport || '')
  return /bike|cycl|ride/i.test(t) || /bike|cycl|ride/i.test(s)
}

/** Best NP across sessions whose duration ≥ bucketMin. Null if none qualify. */
function bestNpAtBucket(sessions, bucketMin) {
  let best = null
  for (const s of sessions) {
    if (s.durationMin < bucketMin) continue
    if (best === null || s.np > best) best = s.np
  }
  return best
}

/** Trend classification: ≥3% rise/fall vs early sub-window. */
function classifyTrend(earlyBest, recentBest) {
  if (earlyBest === null || recentBest === null) return 'stable'
  if (earlyBest <= 0) return 'stable'
  const delta = (recentBest - earlyBest) / earlyBest
  if (delta >= 0.03) return 'rising'
  if (delta <= -0.03) return 'falling'
  return 'stable'
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Compute the 90d best-NP-by-duration trend.
 *
 * @param {object} args
 * @param {Array}  args.log         - training log [{date, type|sport, np|normalizedPower, duration|durationMin, ...}]
 * @param {string} [args.today]     - 'YYYY-MM-DD' reference date (default: today UTC)
 * @param {number} [args.windowDays] - rolling window (default 90)
 * @param {number[]} [args.bucketMins] - duration buckets in minutes (default [5,20,60])
 * @returns {{buckets, latestBest, trend, citation}|null}
 */
export function computeCyclingNpTrend({
  log = [],
  today = new Date().toISOString().slice(0, 10),
  windowDays = 90,
  bucketMins = [5, 20, 60],
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  // 1. Filter to bike sessions inside the 90d window with NP + duration.
  const cutoff = daysBefore(today, windowDays)
  const sessions = []
  for (const entry of log) {
    if (!entry || !entry.date) continue
    if (entry.date < cutoff || entry.date > today) continue
    if (!isBike(entry)) continue
    const np = getNP(entry)
    const durationMin = getDurationMin(entry)
    if (np === null || durationMin === null) continue
    sessions.push({ date: entry.date, np, durationMin })
  }
  if (sessions.length === 0) return null

  // 2. Split into 3 sub-windows (~windowDays/3 each).
  const subSize = windowDays / 3
  const subEarlyStart  = daysBefore(today, windowDays)
  const subMidStart    = daysBefore(today, Math.round(subSize * 2))
  const subRecentStart = daysBefore(today, Math.round(subSize))
  // early:  [subEarlyStart,  subMidStart)
  // mid:    [subMidStart,    subRecentStart)
  // recent: [subRecentStart, today]
  const earlySess  = sessions.filter(s => s.date >= subEarlyStart  && s.date < subMidStart)
  const midSess    = sessions.filter(s => s.date >= subMidStart    && s.date < subRecentStart)
  const recentSess = sessions.filter(s => s.date >= subRecentStart && s.date <= today)

  // 3. Per bucket, compute best NP per sub-window + trend + overall best.
  const buckets = []
  for (const bucket of bucketMins) {
    const bestNp     = bestNpAtBucket(sessions, bucket)
    if (bestNp === null) continue
    const earlyBest  = bestNpAtBucket(earlySess, bucket)
    // midBest reserved for future fine-grained UI; not in output contract today.
    const recentBest = bestNpAtBucket(recentSess, bucket)
    const trend      = classifyTrend(earlyBest, recentBest)
    buckets.push({
      duration: bucket,
      bestNp:   Math.round(bestNp),
      trend,
      earlyBest:  earlyBest  === null ? null : Math.round(earlyBest),
      recentBest: recentBest === null ? null : Math.round(recentBest),
    })
  }
  if (buckets.length === 0) return null
  // Silence unused warning while keeping midSess available for future use.
  void midSess

  // 4. latestBest: recent-window best at the *highest* bucket that has data.
  // Fall back to overall bestNp if the recent window itself is empty for that bucket.
  const topBucket = [...buckets].sort((a, b) => b.duration - a.duration)[0]
  const latestBest = topBucket.recentBest ?? topBucket.bestNp

  // 5. Overall trend: majority direction across buckets, stable on tie.
  const counts = { rising: 0, stable: 0, falling: 0 }
  for (const b of buckets) counts[b.trend]++
  let trend = 'stable'
  if (counts.rising > counts.falling && counts.rising > counts.stable) trend = 'rising'
  else if (counts.falling > counts.rising && counts.falling > counts.stable) trend = 'falling'
  // ties → stable (default)

  return {
    buckets,
    latestBest,
    trend,
    citation: CYCLING_NP_TREND_CITATION,
  }
}
