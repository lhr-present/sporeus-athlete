// src/lib/science/neuromuscularFreshness.js
// E15 — Neuromuscular Freshness Index
//
// Quantifies accumulated high-intensity (Z4/Z5) neuromuscular load over the last
// 7 days relative to the athlete's 28-day weekly baseline. A high score means the
// athlete is neuromuscularly fresh; a low score indicates accumulated fatigue or
// overreaching.
//
// Scientific basis:
//   Cairns S.P. (2006) Lactic acid and exercise performance: culprit or innocent bystander?
//     Sports Med 36(4):279–291.
//   Seiler S. (2010) What is best practice for training intensity and duration distribution
//     in endurance athletes? Int J Sports Physiol Perform 5(3):276–291.
//
// Zone definitions (used by entry.zones):
//   Z4 = threshold zone (~ LT1→LT2)
//   Z5 = VO2max zone (> LT2)
//   RPE ≥ 8 treated as Z4/Z5-equivalent when zone data absent.

export const NM_FRESHNESS_CITATION =
  'Cairns S.P. (2006) Sports Med 36(4):279–291; Seiler S. (2010) IJSPP 5(3):276–291'

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Return YYYY-MM-DD date string offset by `days` from `isoDate`.
 * Negative `days` = in the past.
 */
function _offsetDate(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Extract high-intensity minutes from a single log entry.
 * Priority: zones.Z4 + zones.Z5; fallback: RPE ≥ 8 → +15 min equivalent.
 *
 * @param {Object} entry
 * @returns {number}
 */
function _hiMinutes(entry) {
  if (!entry) return 0
  const z4 = entry.zones?.Z4 ?? null
  const z5 = entry.zones?.Z5 ?? null
  if (z4 !== null || z5 !== null) {
    return (z4 ?? 0) + (z5 ?? 0)
  }
  // Fallback: RPE-based estimate
  if ((entry.rpe ?? 0) >= 8) return 15
  return 0
}

/**
 * Map fatigueRatio → freshness score (0–100).
 * Score formula (Cairns / Seiler context):
 *   ratio ≤ 0.5  → 95
 *   ratio ≤ 1.0  → linear 95→70 over [0.5, 1.0]
 *   ratio ≤ 1.5  → linear 70→40 over [1.0, 1.5]
 *   ratio ≤ 2.0  → linear 40→15 over [1.5, 2.0]
 *   ratio > 2.0  → 10
 *
 * @param {number} ratio
 * @returns {number}
 */
function _ratioToScore(ratio) {
  if (ratio <= 0.5) return 95
  if (ratio <= 1.0) return Math.round(95 - (ratio - 0.5) / 0.5 * (95 - 70))
  if (ratio <= 1.5) return Math.round(70 - (ratio - 1.0) / 0.5 * (70 - 40))
  if (ratio <= 2.0) return Math.round(40 - (ratio - 1.5) / 0.5 * (40 - 15))
  return 10
}

/**
 * Classify a freshness score.
 * @param {number} score
 * @returns {'fresh'|'normal'|'accumulated'|'overreached'}
 */
function _classify(score) {
  if (score >= 80) return 'fresh'
  if (score >= 60) return 'normal'
  if (score >= 35) return 'accumulated'
  return 'overreached'
}

// ── computeNMFatigue ──────────────────────────────────────────────────────────

/**
 * Compute neuromuscular freshness for today based on training log.
 *
 * @param {Object[]} log       - Array of training log entries, each with at least { date: 'YYYY-MM-DD' }.
 * @param {string}   [today]   - Reference date (YYYY-MM-DD). Defaults to system date.
 *
 * @returns {{
 *   nmLoad7d:               number,
 *   nmLoad28dWeeklyMean:    number,
 *   fatigueRatio:           number,
 *   score:                  number,
 *   classification:         'fresh'|'normal'|'accumulated'|'overreached',
 *   lastHardSessionDaysAgo: number|null,
 *   citation:               string,
 * }}
 */
export function computeNMFatigue(log, today = new Date().toISOString().slice(0, 10)) {
  const safeLog = Array.isArray(log) ? log : []

  // Window boundaries
  const day7Start  = _offsetDate(today, -7)   // today-7d inclusive
  const day28Start = _offsetDate(today, -28)  // today-28d inclusive

  // ── 7-day Z4/Z5 load ──────────────────────────────────────────────────────
  let nmLoad7d = 0
  for (const entry of safeLog) {
    const d = (entry.date ?? '').slice(0, 10)
    if (d >= day7Start && d <= today) {
      nmLoad7d += _hiMinutes(entry)
    }
  }

  // ── 28-day weekly mean ────────────────────────────────────────────────────
  // Sum per week across the 4 complete weeks ending today
  const weeklyTotals = [0, 0, 0, 0]
  for (const entry of safeLog) {
    const d = (entry.date ?? '').slice(0, 10)
    if (d >= day28Start && d <= today) {
      // Determine which of the 4 weeks this falls into (0 = most recent)
      const daysDiff = Math.floor(
        (new Date(today + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86_400_000
      )
      const weekIdx = Math.min(3, Math.floor(daysDiff / 7))
      weeklyTotals[weekIdx] += _hiMinutes(entry)
    }
  }
  const nmLoad28dWeeklyMean = weeklyTotals.reduce((s, v) => s + v, 0) / 4

  // ── Score ─────────────────────────────────────────────────────────────────
  let score
  let fatigueRatio
  if (nmLoad28dWeeklyMean === 0) {
    score = 80
    fatigueRatio = 0
  } else {
    fatigueRatio = nmLoad7d / nmLoad28dWeeklyMean
    score = _ratioToScore(fatigueRatio)
  }
  score = Math.max(0, Math.min(100, score))

  // ── lastHardSessionDaysAgo ────────────────────────────────────────────────
  // Most recent entry with Z4/Z5 > 0 OR RPE ≥ 8
  let lastHardSessionDaysAgo = null
  const sorted = [...safeLog]
    .filter(e => (e.date ?? '') <= today)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  for (const entry of sorted) {
    const isHard =
      (entry.zones?.Z4 ?? 0) > 0 ||
      (entry.zones?.Z5 ?? 0) > 0 ||
      (entry.rpe ?? 0) >= 8
    if (isHard) {
      const d = (entry.date ?? '').slice(0, 10)
      lastHardSessionDaysAgo = Math.floor(
        (new Date(today + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86_400_000
      )
      break
    }
  }

  return {
    nmLoad7d,
    nmLoad28dWeeklyMean: Math.round(nmLoad28dWeeklyMean * 10) / 10,
    fatigueRatio: Math.round(fatigueRatio * 1000) / 1000,
    score,
    classification: _classify(score),
    lastHardSessionDaysAgo,
    citation: NM_FRESHNESS_CITATION,
  }
}

// ── nmFatigueHistory ──────────────────────────────────────────────────────────

/**
 * Build a weekly history of NM load + freshness scores.
 *
 * @param {Object[]} log     - Training log entries.
 * @param {number}   [weeks] - Number of weeks to return (default 8), oldest first.
 * @param {string}   [today] - Reference date (YYYY-MM-DD).
 *
 * @returns {{ weekStart: string, nmLoad: number, score: number|null }[]}
 *   Array of `weeks` entries, oldest first.
 *   Weeks with < 2 sessions have score = null.
 */
export function nmFatigueHistory(log, weeks = 8, today = new Date().toISOString().slice(0, 10)) {
  const safeLog = Array.isArray(log) ? log : []
  const result = []

  for (let w = weeks - 1; w >= 0; w--) {
    // weekStart = today minus (w+1)*7 days (day after end of this week)
    // weekEnd   = today minus w*7 days (inclusive)
    const weekEnd   = _offsetDate(today, -(w * 7))
    const weekStart = _offsetDate(today, -((w + 1) * 7 - 1 + 1))  // 7 days before weekEnd + 1 day

    // Re-derive: week covers [weekStart, weekEnd) where weekEnd = today - w*7
    // weekStart = today - (w+1)*7 + 1 → but let's be explicit
    const wEnd   = _offsetDate(today, -w * 7)
    const wStart = _offsetDate(wEnd,  -6)  // 7-day window ending wEnd (inclusive)

    // Sessions in this week
    const sessionsInWeek = safeLog.filter(e => {
      const d = (e.date ?? '').slice(0, 10)
      return d >= wStart && d <= wEnd
    })

    const nmLoad = sessionsInWeek.reduce((s, e) => s + _hiMinutes(e), 0)

    // Score: null if < 2 sessions
    let score = null
    if (sessionsInWeek.length >= 2) {
      // Use computeNMFatigue with wEnd as "today" for that week's context
      const res = computeNMFatigue(safeLog, wEnd)
      score = res.score
    }

    result.push({ weekStart: wStart, nmLoad, score })
  }

  return result
}
