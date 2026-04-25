// ─── src/lib/athlete/sleepRestingHR.js — E50 sleep + RHR computations ────────
// Reference: Plews et al. (2012) — RHR as autonomic recovery marker

// Parse sleep hours from a recovery entry (returns float or null)
export function parseSleepHrs(entry) {
  const v = parseFloat(entry?.sleepHrs)
  return !isNaN(v) && v > 0 && v < 24 ? Math.round(v * 10) / 10 : null
}

// Parse resting HR from a recovery entry (returns integer or null)
export function parseRHR(entry) {
  const v = parseInt(entry?.restingHR, 10)
  return !isNaN(v) && v >= 30 && v <= 120 ? v : null  // sanity: 30-120 bpm
}

// Last N entries with sleep data, sorted by date ascending
export function sleepHistory(recovery, days = 28) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutStr = cutoff.toISOString().slice(0, 10)
  return (recovery || [])
    .filter(e => e.date >= cutStr && parseSleepHrs(e) !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Last N entries with RHR data, sorted by date ascending
export function rhrHistory(recovery, days = 28) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutStr = cutoff.toISOString().slice(0, 10)
  return (recovery || [])
    .filter(e => e.date >= cutStr && parseRHR(e) !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Compute averages + trends for the card
export function computeSleepRHR(recovery, days = 28) {
  const sleep = sleepHistory(recovery, days)
  const rhr   = rhrHistory(recovery, days)
  if (sleep.length === 0 && rhr.length === 0) return null

  const sleepVals = sleep.map(e => parseSleepHrs(e))
  const rhrVals   = rhr.map(e => parseRHR(e))

  const avgSleep = sleepVals.length
    ? Math.round(sleepVals.reduce((s, v) => s + v, 0) / sleepVals.length * 10) / 10
    : null

  const avgRHR = rhrVals.length
    ? Math.round(rhrVals.reduce((s, v) => s + v, 0) / rhrVals.length)
    : null

  const latestRHR = rhrVals.length ? rhrVals[rhrVals.length - 1] : null

  // Sleep status: <6h = low, 6-7 = fair, ≥7 = good
  const sleepStatus = avgSleep === null ? null
    : avgSleep < 6 ? 'low' : avgSleep < 7 ? 'fair' : 'good'

  // RHR delta: latest vs 7-day avg
  const recentRHR = rhrVals.slice(-7)
  const rhrAvg7   = recentRHR.length ? Math.round(recentRHR.reduce((s, v) => s + v, 0) / recentRHR.length) : null

  return {
    avgSleep, sleepStatus,
    sleepEntries: sleep,        // full entries for sparkline
    avgRHR, latestRHR, rhrAvg7,
    rhrEntries: rhr,            // full entries for sparkline
    days,
  }
}
