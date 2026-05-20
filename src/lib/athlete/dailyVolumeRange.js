// src/lib/athlete/dailyVolumeRange.js
//
// Pure-fn: measure DAY-LEVEL training-load variability.
//
// The existing monotony / weekly-variance cards operate at the WEEK level
// (Foster 2001 monotony index = mean weekly TSS / stdev of weekly TSS).
// But a perfectly hard-easy week (high day-to-day swing, healthy) and a
// flat-all-week (low day-to-day swing, monotonous) can have IDENTICAL
// weekly totals — so weekly summaries alone hide the recovery-dynamics
// signal that lives in the day-to-day pattern.
//
// This function exposes that signal:
//   - recentMin / recentMax / recentMean / recentStdDev across the last
//     `windowDays` (default 28).
//   - recentRange = max - min over non-zero days, the SWING amplitude.
//   - trendRangeDelta = % change in range vs the prior period (the
//     `comparisonWindowDays - windowDays` days BEFORE the recent window).
//   - zeroDayCount — number of rest days inside the recent window.
//
// Citations:
//   - Foster 2001 — first defined training monotony at the weekly level;
//     this function generalises the same intuition (variability vs. dose)
//     to a daily-level view.
//   - Halson 2014 — variability of daily training load is one of the
//     core dose-response inputs to overreaching / recovery dynamics.
//
// Bands (recentStdDev across ALL window days, zeros included):
//   FLAT          recentStdDev < 15 AND recentMax > 0
//                 — training is happening but every day looks the same;
//                   classic monotony-trap territory.
//   STEADY        15 ≤ recentStdDev < 35
//                 — modest day-to-day variation; normal aerobic base.
//   PULSED        35 ≤ recentStdDev < 70
//                 — healthy hard-easy oscillation, the textbook pattern.
//   EXTREME_SWING recentStdDev ≥ 70
//                 — very high day-to-day variation; can indicate cramming,
//                   under-recovered hard days, or unstable scheduling.
//
// Returns null when:
//   - `today` is unresolvable.
//   - All days in the recent window have zero TSS (i.e. no training
//     happened in the window at all).

export const DAILY_VOLUME_RANGE_CITATION = 'Foster 2001; Halson 2014'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── helpers ────────────────────────────────────────────────────────────

function resolveToday(today) {
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    const y = today.getUTCFullYear()
    const m = String(today.getUTCMonth() + 1).padStart(2, '0')
    const d = String(today.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof today === 'string' && today.length >= 10) {
    const slice = today.slice(0, 10)
    if (!ISO_RE.test(slice)) return null
    const t = Date.parse(`${slice}T00:00:00Z`)
    if (Number.isNaN(t)) return null
    return slice
  }
  return null
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Daily TSS map keyed by ISO date. Multi-session days are summed.
// Non-finite TSS entries and non-positive contributions are discarded
// (the spec sums entries with `tss` finite AND > 0, and treats no-entry
// or no-positive-entry days as 0).
function buildTssMap(log) {
  const map = Object.create(null)
  if (!Array.isArray(log)) return map
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const tss = Number(e.tss)
    if (!Number.isFinite(tss)) continue
    if (tss <= 0) continue
    map[key] = (map[key] || 0) + tss
  }
  return map
}

// Inclusive [startIso .. endIso] daily TSS array (zero-filled).
function dailyTssSeries(tssMap, startIso, endIso) {
  const out = []
  const start = new Date(startIso + 'T00:00:00Z')
  const end   = new Date(endIso   + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    out.push({ date: iso, tss: tssMap[iso] || 0 })
  }
  return out
}

function classifyBand(stdDev, recentMax) {
  if (!Number.isFinite(stdDev)) return null
  if (recentMax <= 0) return null
  if (stdDev < 15) return 'FLAT'
  if (stdDev < 35) return 'STEADY'
  if (stdDev < 70) return 'PULSED'
  return 'EXTREME_SWING'
}

const round2 = v => Math.round(v * 100) / 100
const round4 = v => Math.round(v * 10000) / 10000

/**
 * @param {{
 *   log: Array<{date:string, tss:number}>,
 *   today: string | Date,
 *   windowDays?: number,
 *   comparisonWindowDays?: number,
 * }} args
 * @returns {{
 *   band: 'FLAT' | 'STEADY' | 'PULSED' | 'EXTREME_SWING',
 *   recentMin: number,
 *   recentMax: number,
 *   recentMean: number,
 *   recentStdDev: number,
 *   recentRange: number,
 *   trendRangeDelta: number,
 *   zeroDayCount: number,
 *   dailyTss: Array<{ date: string, tss: number }>,
 *   windowDays: number,
 *   comparisonWindowDays: number,
 *   citation: string,
 * } | null}
 */
export function analyzeDailyVolumeRange({
  log,
  today,
  windowDays = 28,
  comparisonWindowDays = 56,
} = {}) {
  const todayIso = resolveToday(today)
  if (!todayIso) return null

  const w = Math.floor(Number(windowDays))
  if (!Number.isFinite(w) || w < 1) return null

  const cw = Math.floor(Number(comparisonWindowDays))
  if (!Number.isFinite(cw) || cw <= w) {
    // We still accept cw === w as "no prior period" but the spec says
    // comparisonWindowDays > windowDays. Be strict: equal or smaller is
    // unusable.
    if (!Number.isFinite(cw) || cw < w) return null
  }

  const tssMap = buildTssMap(log)

  // Recent window: [todayIso - (w-1) .. todayIso]
  const recentStart = isoMinusDays(todayIso, w - 1)
  const recentSeries = dailyTssSeries(tssMap, recentStart, todayIso)

  // Recent stats.
  const allValues = recentSeries.map(d => d.tss) // includes zeros
  const nonZero = allValues.filter(v => v > 0)
  const recentMax = nonZero.length ? Math.max(...nonZero) : 0
  const recentMin = nonZero.length ? Math.min(...nonZero) : 0
  const recentRange = recentMax - recentMin

  const meanAll = allValues.reduce((a, b) => a + b, 0) / Math.max(allValues.length, 1)
  // Population stdev across ALL window days (zeros included).
  const variance = allValues.reduce((acc, v) => acc + (v - meanAll) ** 2, 0)
    / Math.max(allValues.length, 1)
  const stdDev = Math.sqrt(variance)

  const zeroDayCount = allValues.filter(v => v === 0).length

  // Null when no training at all in window.
  if (recentMax === 0) return null

  // Comparison window: the (cw - w) days BEFORE the recent window.
  // i.e. [todayIso - (cw - 1) .. todayIso - w]
  let comparisonRange = 0
  if (cw > w) {
    const compStart = isoMinusDays(todayIso, cw - 1)
    const compEnd   = isoMinusDays(todayIso, w)
    const compSeries = dailyTssSeries(tssMap, compStart, compEnd)
    const compNonZero = compSeries.map(d => d.tss).filter(v => v > 0)
    if (compNonZero.length) {
      comparisonRange = Math.max(...compNonZero) - Math.min(...compNonZero)
    }
  }

  const trendRangeDelta = comparisonRange === 0
    ? 0
    : (recentRange - comparisonRange) / Math.max(comparisonRange, 1)

  const band = classifyBand(stdDev, recentMax)
  if (!band) return null

  return {
    band,
    recentMin: round2(recentMin),
    recentMax: round2(recentMax),
    recentMean: round2(meanAll),
    recentStdDev: round2(stdDev),
    recentRange: round2(recentRange),
    trendRangeDelta: round4(trendRangeDelta),
    zeroDayCount,
    dailyTss: recentSeries,
    windowDays: w,
    comparisonWindowDays: cw,
    citation: DAILY_VOLUME_RANGE_CITATION,
  }
}
