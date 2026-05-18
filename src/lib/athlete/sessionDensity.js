// ─── sessionDensity.js — 28-day session density (sessions per active day) ────
// Surfaces "session density" — average number of sessions per active training
// day across the trailing 28 days. Density > 1.0 means the athlete is regularly
// doing double-sessions, a hallmark of advanced / triathlon training.
//
// References:
//   - Bompa 2018 (twice-daily training in advanced periodization)
//   - Mujika 2014 (Olympic-distance triathlon training distributions)
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_DENSITY_CITATION = 'Bompa 2018; Mujika 2014'

const DEFAULT_WINDOW_DAYS = 28
const MIN_ACTIVE_DAYS = 5

// Band thresholds (single source of truth)
export const SINGLE_MAX = 1.10    // density < 1.10 → SINGLE_FOCUSED
export const MIXED_MAX  = 1.40    // 1.10 ≤ density < 1.40 → MIXED_DENSITY
                                  // density ≥ 1.40 → DOUBLE_HEAVY

// ─── Date helpers (UTC, string-based) ────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Band classifier ────────────────────────────────────────────────────────
function classifyBand(density) {
  if (density < SINGLE_MAX) return 'SINGLE_FOCUSED'
  if (density < MIXED_MAX)  return 'MIXED_DENSITY'
  return 'DOUBLE_HEAVY'
}

/**
 * Analyze 28-day session density.
 *
 * @param {Object} params
 * @param {Array}  params.log          - Training log entries with `date` field
 * @param {string} [params.today]      - Reference date 'YYYY-MM-DD' (defaults to current)
 * @param {number} [params.windowDays] - Trailing window length (default 28)
 *
 * @returns {Object|null} One of:
 *   - null when activeDays < 5 OR totalSessions === 0
 *   - {
 *       band: 'SINGLE_FOCUSED'|'MIXED_DENSITY'|'DOUBLE_HEAVY',
 *       density: number,        // totalSessions / activeDays
 *       totalSessions: number,
 *       activeDays: number,     // distinct session-dates within window
 *       doubleDays: number,     // days with ≥2 sessions
 *       doubleRate: number,     // doubleDays / activeDays in [0,1]
 *       citation: string,
 *     }
 */
export function analyzeSessionDensity({
  log,
  today = todayStr(),
  windowDays = DEFAULT_WINDOW_DAYS,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  // Window: trailing `windowDays` days INCLUDING today
  // e.g. windowDays=28, today=2026-05-18 → start=2026-04-21..end=2026-05-18 (28 days)
  const windowStart = addDaysStr(today, -(windowDays - 1))
  const windowEnd   = today

  // Per-day session counts within window
  const perDay = new Map()
  for (const entry of log) {
    const d = entry?.date
    if (!d || typeof d !== 'string') continue
    if (d < windowStart || d > windowEnd) continue
    perDay.set(d, (perDay.get(d) || 0) + 1)
  }

  const activeDays    = perDay.size
  let totalSessions   = 0
  let doubleDays      = 0
  for (const count of perDay.values()) {
    totalSessions += count
    if (count >= 2) doubleDays += 1
  }

  // Insufficient-data guards
  if (activeDays < MIN_ACTIVE_DAYS) return null
  if (totalSessions === 0)          return null

  const density    = totalSessions / activeDays
  const doubleRate = doubleDays / activeDays
  const band       = classifyBand(density)

  return {
    band,
    density,
    totalSessions,
    activeDays,
    doubleDays,
    doubleRate,
    citation: SESSION_DENSITY_CITATION,
  }
}
