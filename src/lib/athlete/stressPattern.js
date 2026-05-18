// ─── src/lib/athlete/stressPattern.js ────────────────────────────────────────
//
// Surface a 28-day perceived-stress trend AND its coupling with sleep
// duration. Stress + sleep are the dominant non-training inputs to
// recovery; either one shifting silently can mask training fatigue.
//
// Scientific framing:
//   - Selye 1956 (The Stress of Life) — General Adaptation Syndrome:
//     alarm → resistance → exhaustion. Trend matters more than absolute
//     stress level for predicting the exhaustion phase.
//   - Kallus & Kellmann 2016 (RESTQ-Sport) — Recovery-Stress
//     Questionnaire validates 1–5 Likert tracking of perceived stress
//     against objective recovery outcomes.
//   - Walker 2017 (Why We Sleep) — stress and sleep are reciprocal: high
//     stress fragments sleep, and sleep loss raises cortisol. The sign
//     of the correlation tells you which side is leading.
//
// Pure function. No React, no I/O.
//
// Recovery row contract (from the wellness log): `date` (YYYY-MM-DD
// string), `stress` (1–5 Likert, 5 = WORST), `sleepHrs` (number).

export const STRESS_PATTERN_CITATION = 'Selye 1956; Kallus & Kellmann 2016'

const DEFAULT_WINDOW_DAYS = 28
const HALF_WINDOW_DAYS = 14
const MIN_SAMPLES = 7
const TREND_DELTA_BAND = 0.3        // stress band: |delta| < 0.3 is STEADY
const CORR_COUPLING_BAND = 0.3      // |r| < 0.3 → DECOUPLED

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseISODate(s) {
  if (typeof s !== 'string' || s.length < 10) return null
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function toISO(d) { return d.toISOString().slice(0, 10) }

function pickStress(entry) {
  if (!entry) return null
  const v = Number(entry.stress)
  if (!Number.isFinite(v)) return null
  // 1–5 Likert; tolerate floats from any averaging upstream.
  if (v < 1 || v > 5) return null
  return v
}

function pickSleepHours(entry) {
  if (!entry) return null
  const v = Number(entry.sleepHrs ?? entry.sleepHours)
  if (!Number.isFinite(v)) return null
  if (v <= 0 || v >= 24) return null
  return v
}

function mean(arr) {
  if (!arr.length) return 0
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i]
  return s / arr.length
}

function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return 0
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i] }
  const mx = sx / n, my = sy / n
  let num = 0, dxs = 0, dys = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dxs += dx * dx
    dys += dy * dy
  }
  if (dxs === 0 || dys === 0) return 0
  const r = num / Math.sqrt(dxs * dys)
  if (!Number.isFinite(r)) return 0
  return Math.max(-1, Math.min(1, r))
}

function classifyTrend(delta) {
  if (delta <= -TREND_DELTA_BAND) return 'CALMING'
  if (delta >= TREND_DELTA_BAND) return 'MOUNTING'
  return 'STEADY'
}

function classifyPattern(trend, correlation) {
  // STRESS_DRIVEN — rising stress AND sleep visibly suffers.
  if (trend === 'MOUNTING' && correlation <= -CORR_COUPLING_BAND) {
    return 'STRESS_DRIVEN'
  }
  // DECOUPLED — stress and sleep moving independently.
  if (Math.abs(correlation) < CORR_COUPLING_BAND) {
    return 'DECOUPLED'
  }
  // PROTECTED — sleep holding up despite stress changes (r > -0.3,
  // i.e. not strongly negative; covers positive r and mildly-negative r).
  // Note: STRESS_DRIVEN already short-circuited the MOUNTING + strong-negative
  // combination, so anything reaching this branch with r > -0.3 means sleep
  // is not collapsing in lockstep with stress.
  return 'PROTECTED'
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze 28-day perceived stress + its coupling with sleep duration.
 *
 * @param {Object} params
 * @param {Array}  params.recovery     Recovery entries (date, stress, sleepHrs, ...)
 * @param {string} [params.today]      ISO date 'YYYY-MM-DD'; defaults to today (UTC)
 * @param {number} [params.windowDays=28]  Trailing window length in days
 * @returns {{
 *   stressTrend:      'CALMING'|'STEADY'|'MOUNTING',
 *   pattern:          'STRESS_DRIVEN'|'DECOUPLED'|'PROTECTED',
 *   avgStress:        number,           // 1-5, 2dp
 *   stressDelta:      number,           // recentHalfMean - earlyHalfMean, 2dp
 *   sleepCorrelation: number,           // Pearson r (stress vs sleepHrs), 2dp
 *   sampleCount:      number,
 *   citation:         string,
 * } | null}
 * Returns null when fewer than 7 entries with `stress` defined are
 * present inside the window.
 */
export function analyzeStressPattern({
  recovery,
  today,
  windowDays = DEFAULT_WINDOW_DAYS,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  const winN = Math.max(1, Math.floor(Number(windowDays) || DEFAULT_WINDOW_DAYS))
  const todayDate = parseISODate(today) || (() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    return d
  })()
  const todayISO = toISO(todayDate)

  // Window is [today - (winN-1), today] inclusive.
  const cutoff = new Date(todayDate.getTime())
  cutoff.setUTCDate(cutoff.getUTCDate() - (winN - 1))
  const cutoffISO = toISO(cutoff)

  // De-dupe by date: latest input entry per date wins (matches the
  // "one wellness row per day" expectation throughout the app).
  const byDate = new Map()
  for (const r of recovery) {
    if (!r || typeof r.date !== 'string') continue
    const d = r.date.slice(0, 10)
    if (d < cutoffISO || d > todayISO) continue
    byDate.set(d, r)
  }

  // Collect stress-only entries (sorted by date asc for half-split).
  const stressEntries = []
  for (const [date, entry] of byDate) {
    const s = pickStress(entry)
    if (s === null) continue
    stressEntries.push({ date, stress: s, sleepHrs: pickSleepHours(entry) })
  }
  if (stressEntries.length < MIN_SAMPLES) return null
  stressEntries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  // Half-split by CALENDAR DATE inside the window, not by entry index
  // — this keeps the trend honest when an athlete logs sporadically.
  const halfBoundary = new Date(todayDate.getTime())
  halfBoundary.setUTCDate(halfBoundary.getUTCDate() - (HALF_WINDOW_DAYS - 1))
  const halfBoundaryISO = toISO(halfBoundary)

  const earlyHalf = []
  const recentHalf = []
  for (const e of stressEntries) {
    if (e.date >= halfBoundaryISO) recentHalf.push(e.stress)
    else                            earlyHalf.push(e.stress)
  }

  const avgStress = mean(stressEntries.map(e => e.stress))
  // If either half is empty (rare — sparse logging), the delta degrades
  // gracefully to 0 (STEADY) rather than producing NaN.
  const earlyMean  = earlyHalf.length  ? mean(earlyHalf)  : avgStress
  const recentMean = recentHalf.length ? mean(recentHalf) : avgStress
  const stressDeltaRaw = recentMean - earlyMean
  // Classify on the rounded 2dp delta so floating-point boundaries
  // (e.g. 3.15 - 2.85 = 0.2999…) match the published thresholds.
  const stressDeltaRounded = Math.round(stressDeltaRaw * 100) / 100
  const stressTrend = classifyTrend(stressDeltaRounded)

  // Correlation: stress vs sleepHrs across entries where BOTH are defined.
  const xs = []
  const ys = []
  for (const e of stressEntries) {
    if (e.sleepHrs === null) continue
    xs.push(e.stress)
    ys.push(e.sleepHrs)
  }
  const rRaw = pearson(xs, ys)
  const sleepCorrelation = Math.round(rRaw * 100) / 100

  const pattern = classifyPattern(stressTrend, sleepCorrelation)

  return {
    stressTrend,
    pattern,
    avgStress:        Math.round(avgStress * 100) / 100,
    stressDelta:      stressDeltaRounded,
    sleepCorrelation,
    sampleCount:      stressEntries.length,
    citation:         STRESS_PATTERN_CITATION,
  }
}

export {
  DEFAULT_WINDOW_DAYS,
  HALF_WINDOW_DAYS,
  MIN_SAMPLES,
  TREND_DELTA_BAND,
  CORR_COUPLING_BAND,
}
