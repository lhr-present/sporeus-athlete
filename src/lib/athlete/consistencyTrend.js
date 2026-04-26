// ─── consistencyTrend.js — E24: 8-week rolling consistency history ────────────
import { calculateConsistency as _calculateConsistency } from '../trainingLoad.js'

// ─── Tier classification ──────────────────────────────────────────────────────
/**
 * Classify a consistency score (0–100) into a tier label.
 * @param {number} score
 * @returns {'excellent'|'good'|'fair'|'poor'}
 */
export function classifyConsistency(score) {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

// ─── ISO week string ──────────────────────────────────────────────────────────
/**
 * Return ISO week string 'YYYY-Www' for the week containing the given date.
 * ISO weeks start Monday; the week number follows ISO 8601.
 * @param {Date} d
 * @returns {string}
 */
function toISOWeekStr(d) {
  // Copy so we don't mutate
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1)
  const dayOfWeek = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * Return the most recent Sunday on or before the given date string 'YYYY-MM-DD'.
 * @param {string} dateStr
 * @returns {Date} UTC midnight on that Sunday
 */
function prevSunday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=Sun, 6=Sat
  d.setUTCDate(d.getUTCDate() - day)
  return d
}

// ─── consistencyHistory ───────────────────────────────────────────────────────
/**
 * Compute 8-week rolling consistency history.
 *
 * For each of the last `weeks` ISO weeks (week ending on Sunday),
 * compute calculateConsistency using the log sliced up to that Sunday.
 * The 'days' parameter passed to calculateConsistency is 28.
 *
 * @param {Array}  log   - full training log [{date: 'YYYY-MM-DD', ...}]
 * @param {number} weeks - number of weeks to compute (default 8)
 * @param {string} today - 'YYYY-MM-DD' date string
 * @returns {{ isoWeek: string, score: number, tier: string }[]} oldest→newest
 */
export function consistencyHistory(log = [], weeks = 8, today = new Date().toISOString().slice(0, 10)) {
  if (log.length < 14) return []

  const results = []
  // Start from the most recent Sunday
  const baseSunday = prevSunday(today)

  for (let w = weeks - 1; w >= 0; w--) {
    // Sunday for this week slot (oldest to newest: w goes weeks-1 → 0)
    const sunday = new Date(baseSunday)
    sunday.setUTCDate(sunday.getUTCDate() - w * 7)

    const sundayStr = sunday.toISOString().slice(0, 10)
    const isoWeek   = toISOWeekStr(sunday)

    // Slice log up to and including this Sunday
    const sliced = log.filter(e => e.date <= sundayStr)

    // calculateConsistency uses new Date() internally, so we need to patch it.
    // We compute the score by reimplementing the window logic using sundayStr as the reference.
    const score = scoreAtDate(sliced, 28, sundayStr)

    if (score === null) continue

    results.push({ isoWeek, score, tier: classifyConsistency(score) })
  }

  return results
}

/**
 * Compute consistency pct at a specific reference date (instead of today).
 * Mirrors calculateConsistency logic but uses refDateStr as "today".
 * @param {Array}  log
 * @param {number} days
 * @param {string} refDateStr 'YYYY-MM-DD'
 * @returns {number|null}
 */
function scoreAtDate(log, days, refDateStr) {
  if (!log || log.length === 0) return null
  const refDate = new Date(refDateStr + 'T00:00:00Z')
  const cutoff  = new Date(refDate)
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recent = log.filter(e => e.date > cutoffStr && e.date <= refDateStr)
  if (recent.length === 0) return null

  const sessionDates = new Set(recent.map(e => e.date))
  const sessionDays  = sessionDates.size

  return Math.round((sessionDays / days) * 100)
}

// ─── consistencyTrendSlope ────────────────────────────────────────────────────
/**
 * OLS linear regression on consistency scores.
 * @param {{ score: number }[]} history
 * @returns {{ slope: number, weeklyChange: number, improving: boolean }|null}
 */
export function consistencyTrendSlope(history = []) {
  if (history.length < 4) return null

  const n  = history.length
  const xs = history.map((_, i) => i)
  const ys = history.map(h => h.score)

  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }

  const slope = den === 0 ? 0 : num / den

  return {
    slope,
    weeklyChange: Math.round(slope * 10) / 10,
    improving: slope > 0.5,
  }
}

// ─── computeConsistencyTrend ──────────────────────────────────────────────────
/**
 * Top-level summary for the ConsistencyTrendCard.
 * @param {Array}  log
 * @param {number} nWeeks
 * @param {string} today
 * @returns {{ weeks, currentScore, currentTier, trendSlope, improving, streak, citation }|null}
 */
export function computeConsistencyTrend(log = [], nWeeks = 8, today = new Date().toISOString().slice(0, 10)) {
  if (log.length < 14) return null

  const weeks = consistencyHistory(log, nWeeks, today)
  if (weeks.length === 0) return null

  const latest        = weeks[weeks.length - 1]
  const currentScore  = latest.score
  const currentTier   = latest.tier
  const trendSlope    = consistencyTrendSlope(weeks)
  const improving     = trendSlope ? trendSlope.improving : false

  // Streak: consecutive weeks at 'good' or 'excellent' counting back from latest
  let streak = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].tier === 'good' || weeks[i].tier === 'excellent') {
      streak++
    } else {
      break
    }
  }

  return {
    weeks,
    currentScore,
    currentTier,
    trendSlope,
    improving,
    streak,
    citation: 'Bangsbo 2006 · Issurin 2008',
  }
}
