// src/lib/athlete/ctlSlope.js
//
// Pure-fn: fit a linear regression to the trailing-window CTL series and
// surface the slope (TSS/day, plus its weekly companion). This is a
// smoother measure of fitness trajectory than week-over-week ramp:
// noise in a single training week averages out across the regression
// fit, and the slope is directly interpretable as "CTL growth per day".
//
// Scientific grounding:
//   - Banister 1991 — TRIMP-driven exponentially-weighted CTL/ATL model.
//   - Coggan 2010 (Training and Racing with a Power Meter) — 42-day CTL
//     time constant, k = 1/42 form (the canonical "simple-EWMA" recursion
//     where CTL[d] = CTL[d-1] + (TSS[d] - CTL[d-1]) / 42).
//
// Companion cards in this codebase:
//   - ctlRampRate.js     — week-over-week deltas vs Gabbett sweet spot.
//   - ctlTrajectory.js   — forward projection to end of week.
//   This card           — linear-regression slope over a trailing window.
//
// Inputs:
//   log         — training log [{ date: 'YYYY-MM-DD', tss: number }]
//   today       — ISO date YYYY-MM-DD anchoring the trailing window
//   windowDays  — trailing window length to regress over (default 42)
//
// Returns:
//   {
//     band:          'CLIMBING' | 'STEADY_UP' | 'PLATEAU' | 'DECLINING',
//     slope:         number,   // TSS/day  (regression coefficient m)
//     slopePerWeek:  number,   // slope * 7 (TSS/week growth)
//     intercept:     number,   // CTL at the start of the window (b)
//     recentCtl:     number,   // CTL[today]
//     windowDays:    number,   // echoed back
//     citation:      string,
//   } | null

export const CTL_SLOPE_CITATION = 'Banister 1991; Coggan 2010'

// Banister/Coggan CTL time constant (days) in the simple-EWMA form:
//   CTL[d] = CTL[d-1] + (TSS[d] - CTL[d-1]) / TAU
const CTL_TAU = 42

// Need ≥ 28 days of history (4 weeks) before a slope is meaningful.
const MIN_LOG_DAYS = 28

// Band thresholds expressed in TSS / week (slopePerWeek).
const CLIMBING_MIN  = 3.0    // slopePerWeek ≥ +3.0
const STEADY_UP_MIN = 0.5    // +0.5 ≤ slopePerWeek < +3.0
const PLATEAU_HALF  = 0.5    // |slopePerWeek| < 0.5
const DECLINING_MAX = -0.5   // slopePerWeek ≤ -0.5

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function daysBetweenIso(startIso, endIso) {
  const a = new Date(startIso + 'T00:00:00Z').getTime()
  const b = new Date(endIso   + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

function classifyBand(slopePerWeek) {
  if (!Number.isFinite(slopePerWeek)) return null
  if (slopePerWeek >= CLIMBING_MIN)              return 'CLIMBING'
  if (slopePerWeek >= STEADY_UP_MIN)             return 'STEADY_UP'
  if (slopePerWeek <= DECLINING_MAX)             return 'DECLINING'
  if (Math.abs(slopePerWeek) < PLATEAU_HALF)     return 'PLATEAU'
  // Fallthrough should never trigger because every sub-band above
  // covers a contiguous slice of the real line, but guard anyway.
  return 'PLATEAU'
}

// Build a daily TSS map keyed by ISO date (sums multi-session days).
function buildTssMap(log) {
  const map = Object.create(null)
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const tss = Number(e.tss)
    if (!Number.isFinite(tss)) continue
    map[key] = (map[key] || 0) + tss
  }
  return map
}

// Walk CTL from `startIso` through `endIso` (inclusive) using the
// canonical Banister/Coggan recursion. Returns an object keyed by ISO
// date holding end-of-day CTL.
//
// Convention: CTL[startIso - 1 day] = 0, so CTL[startIso] = TSS[startIso] / TAU.
function walkCtl(tssMap, startIso, endIso) {
  const out = Object.create(null)
  let ctl = 0
  const start = new Date(startIso + 'T00:00:00Z')
  const end   = new Date(endIso   + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    const tss = tssMap[iso] || 0
    ctl = ctl + (tss - ctl) / CTL_TAU
    out[iso] = ctl
  }
  return out
}

// Ordinary least-squares regression of y on x.
// Returns { slope, intercept }. x and y must be same length, ≥ 2.
function linearRegression(xs, ys) {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] || 0 }
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    sx  += xs[i]
    sy  += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
  }
  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n }
  const slope     = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return { slope, intercept }
}

/**
 * @param {{log: Array<{date:string, tss:number}>, today: string, windowDays?: number}} args
 * @returns {{
 *   band: 'CLIMBING' | 'STEADY_UP' | 'PLATEAU' | 'DECLINING',
 *   slope: number,
 *   slopePerWeek: number,
 *   intercept: number,
 *   recentCtl: number,
 *   windowDays: number,
 *   citation: string,
 * } | null}
 */
export function analyzeCtlSlope({ log, today, windowDays = 42 } = {}) {
  if (!isValidIso(today)) return null
  if (!Array.isArray(log) || log.length === 0) return null
  const w = Math.floor(Number(windowDays))
  if (!Number.isFinite(w) || w < 2) return null

  // Find earliest log date — needed both as the CTL walk's start and to
  // gate the ≥ MIN_LOG_DAYS history check.
  let earliestLogIso = null
  for (const e of log) {
    if (!e || !e.date) continue
    const k = String(e.date).slice(0, 10)
    if (!ISO_RE.test(k)) continue
    if (earliestLogIso === null || k < earliestLogIso) earliestLogIso = k
  }
  if (!earliestLogIso) return null

  // Need at least MIN_LOG_DAYS of history to fit a meaningful slope.
  const historyDays = daysBetweenIso(earliestLogIso, today) + 1
  if (!Number.isFinite(historyDays) || historyDays < MIN_LOG_DAYS) return null

  // Build TSS map and walk CTL from earliest log date → today.
  const tssMap = buildTssMap(log)
  const ctlByDate = walkCtl(tssMap, earliestLogIso, today)

  // Extract the last `windowDays` of CTL ending on `today`. If the log
  // is shorter than `windowDays`, we use the full available span (still
  // ≥ MIN_LOG_DAYS thanks to the gate above).
  const effectiveSpan = Math.min(w, historyDays)

  const xs = []
  const ys = []
  for (let i = 0; i < effectiveSpan; i++) {
    const iso = isoMinusDays(today, effectiveSpan - 1 - i)
    const v = ctlByDate[iso]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      // Defensive: if the walk somehow didn't populate this date, abort.
      return null
    }
    xs.push(i)
    ys.push(v)
  }

  const { slope, intercept } = linearRegression(xs, ys)
  const slopePerWeek = slope * 7
  const band = classifyBand(slopePerWeek)
  if (!band) return null

  const recentCtl = ctlByDate[today]
  if (typeof recentCtl !== 'number' || !Number.isFinite(recentCtl)) return null

  const round1 = v => Math.round(v * 10) / 10
  const round2 = v => Math.round(v * 100) / 100

  return {
    band,
    slope:        round2(slope),
    slopePerWeek: round1(slopePerWeek),
    intercept:    round1(intercept),
    recentCtl:    round1(recentCtl),
    windowDays:   effectiveSpan,
    citation:     CTL_SLOPE_CITATION,
  }
}
