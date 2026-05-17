// ─── VO2max Plateau Detector ──────────────────────────────────────────────────
// Block-periodization plateau signal. When the last N VO2max test results
// span a small range over enough weeks, the current training stimulus has
// stopped producing aerobic-ceiling gains and the athlete needs to change
// the regime (Issurin 2010 block periodization; Bompa 2009 periodization;
// Daniels 2014 VDOT progression).
//
// Pure module — no React, no I/O, fully testable.

export const VO2MAX_PLATEAU_CITATION = 'Bompa 2009; Issurin 2010; Daniels 2014'

const RECOMMENDATIONS = ['change-stimulus', 'deload-restart', 'add-hills']

// ── isVO2maxEntry ─────────────────────────────────────────────────────────────
// Match `type === 'VO2max'` exactly OR any case-insensitive variant matching
// /vo2.?max/i (handles 'vo2max', 'VO2 Max', 'vo2-max', etc.).
function isVO2maxEntry(entry) {
  if (!entry || typeof entry.type !== 'string') return false
  if (entry.type === 'VO2max') return true
  return /vo2.?max/i.test(entry.type)
}

// ── weeksBetween ──────────────────────────────────────────────────────────────
// Whole-number-tolerant week distance between two ISO date strings (YYYY-MM-DD).
function weeksBetween(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00Z').getTime()
  const b = new Date(dateB + 'T00:00:00Z').getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  const days = Math.abs(b - a) / (1000 * 60 * 60 * 24)
  return days / 7
}

// ── detectVO2maxPlateau ───────────────────────────────────────────────────────
// Returns plateau summary or null when the gate fails (not enough tests, or
// most recent test is too fresh to call a plateau).
export function detectVO2maxPlateau({
  testResults = [],
  today = new Date().toISOString().slice(0, 10),
  minTests = 3,
  plateauWeeks = 6,
  varianceThresholdPct = 2,
} = {}) {
  if (!Array.isArray(testResults) || testResults.length === 0) return null

  // Filter + sort chronologically (oldest first) — handle out-of-order input.
  const vo2 = testResults
    .filter(isVO2maxEntry)
    .filter(e => e && typeof e.date === 'string' && Number.isFinite(Number(e.value)))
    .map(e => ({ ...e, value: Number(e.value) }))
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))

  if (vo2.length < minTests) return null

  const recentTests = vo2.slice(-minTests)
  const newest = recentTests[recentTests.length - 1]

  // Gate: most-recent test must be at least `plateauWeeks` old. If the
  // athlete only just started measuring, a small range tells us nothing.
  const sinceNewest = weeksBetween(newest.date, today)
  if (sinceNewest < plateauWeeks) {
    // Still need enough span across the recent tests; if the most recent
    // test is fresh we cannot claim a plateau yet.
    return null
  }

  const values = recentTests.map(t => t.value)
  const maxV = Math.max(...values)
  const minV = Math.min(...values)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const varianceMlKgMin = Math.round((maxV - minV) * 10) / 10
  const variancePct = mean > 0
    ? Math.round((varianceMlKgMin / mean) * 1000) / 10
    : 0

  const weekSpan = Math.round(weeksBetween(recentTests[0].date, newest.date) * 10) / 10

  const isPlateau = weekSpan >= plateauWeeks && variancePct <= varianceThresholdPct

  // Rotate recommendation deterministically from inputs so successive calls
  // surface different stimuli to try. Use newest test date as seed so the
  // hint is stable for a given dataset but rotates as new tests arrive.
  let recommendation = null
  if (isPlateau) {
    const seed = (newest.date || '').replace(/\D/g, '')
    const idx = (Number(seed.slice(-3)) || 0) % RECOMMENDATIONS.length
    recommendation = RECOMMENDATIONS[idx]
  }

  return {
    isPlateau,
    recentTests,
    varianceMlKgMin,
    variancePct,
    weekSpan,
    recommendation,
    citation: VO2MAX_PLATEAU_CITATION,
  }
}

export default detectVO2maxPlateau
