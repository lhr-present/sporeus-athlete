// ─── batteryProgress.js — Fitness Battery Progress Helpers ───────────────────
// Reads stored field test results from localStorage and computes per-test
// delta vs. previous session using compareBatteryResults from testBattery.js.
// References: Cooper (1968), Kasch & Boyer (1970)
// ─────────────────────────────────────────────────────────────────────────────
import { getBatteryForDate, compareBatteryResults, deriveMetrics, TEST_BATTERY } from '../sport/testBattery.js'

export { getBatteryForDate }

/**
 * Load and parse battery history from localStorage key 'sporeus-test-battery'.
 * Returns array sorted by date descending (most recent first).
 * Returns [] on missing key or JSON parse error.
 * @returns {Array<{date:string, results:{[testId:string]:number}}>}
 */
export function loadBatteryHistory() {
  try {
    const raw = localStorage.getItem('sporeus-test-battery')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Sort descending — most recent first
    return [...parsed].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))
  } catch {
    return []
  }
}

/**
 * Get human-readable test name from TEST_BATTERY.
 * Falls back to the testId itself if unknown.
 * @param {string} testId
 * @returns {string}
 */
export function testName(testId) {
  return TEST_BATTERY.find(t => t.id === testId)?.name || testId
}

/**
 * Compute battery progress comparing the last two sessions.
 * @param {Array<{date:string, results:{[testId:string]:number}}>} storedBatteries
 * @param {{weight_kg?:number, height_cm?:number}} [profile]
 * @returns {{
 *   latestDate: string,
 *   prevDate: string|null,
 *   results: Array<{testId:string, name:string, rawValue:number, derived:{metric:string, value:number|string, unit:string}, delta_pct:number|null}>,
 *   sessionCount: number
 * }|null}
 */
export function computeBatteryProgress(storedBatteries, profile = {}) {
  if (!Array.isArray(storedBatteries) || storedBatteries.length === 0) return null

  // Sort descending so [0] = most recent
  const sorted = [...storedBatteries].sort((a, b) =>
    a.date > b.date ? -1 : a.date < b.date ? 1 : 0
  )

  const latestBattery   = sorted[0]
  const previousBattery = sorted[1] || null

  // Compute deltas vs. previous session
  const deltas = previousBattery
    ? compareBatteryResults(previousBattery, latestBattery)
    : []

  const deltaMap = Object.fromEntries(deltas.map(d => [d.testId, d.delta_pct]))

  const results = Object.entries(latestBattery.results || {}).map(([testId, rawValue]) => {
    const derived   = deriveMetrics(testId, rawValue, profile)
    const raw_delta = deltaMap[testId]
    // Infinity (new test, no previous value) → show null
    const delta_pct = raw_delta !== undefined && isFinite(raw_delta) ? raw_delta : null
    return {
      testId,
      name:     testName(testId),
      rawValue,
      derived,
      delta_pct,
    }
  })

  return {
    latestDate:   latestBattery.date,
    prevDate:     previousBattery?.date || null,
    results,
    sessionCount: storedBatteries.length,
  }
}
