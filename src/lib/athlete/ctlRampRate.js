// src/lib/athlete/ctlRampRate.js
//
// Pure-fn: detect when the WEEK-OVER-WEEK CTL ramp rate (Chronic Training
// Load / fitness build-up rate) exceeds Gabbett's safe-ramp threshold.
//
// Scientific grounding:
//   - Banister 1975 — exponentially-weighted CTL with 42-day time constant.
//   - Gabbett 2016 — "sweet spot": CTL ramp of 3–8 TSS/week; above 8–10
//     the injury risk rises sharply.
//
// We compute a daily CTL walk from the log (primed 180d before the
// trailing window so the EWMA has converged), sample CTL at the end of
// each trailing week, then return the mean week-over-week delta.
//
// Inputs:
//   log    — training log array of { date: 'YYYY-MM-DD', tss: number }
//   today  — ISO date string YYYY-MM-DD anchoring the trailing window
//   weeks  — trailing weeks to average (default 4)
//
// Returns:
//   {
//     rampRate:      number,           // mean weekly delta (TSS/week)
//     currentCtl:    number,           // CTL on `today`
//     baselineCtl:   number,           // CTL `weeks` weeks before today
//     band:          string,           // UNDERTRAINED | OPTIMAL | AGGRESSIVE | HIGH_RISK
//     weeklyDeltas:  number[],         // length === weeks, oldest first
//     citation:      string,
//   } | null

export const CTL_RAMP_RATE_CITATION = 'Gabbett 2016; Banister 1975'

// Gabbett 2016 sweet-spot thresholds (TSS / week, mean over 4 weeks).
const BAND_UNDER  = 3     // <3       → UNDERTRAINED
const BAND_OPT    = 8     // 3..<8    → OPTIMAL
const BAND_AGG    = 12    // 8..<12   → AGGRESSIVE; ≥12 → HIGH_RISK

// Banister 1975 CTL time constant (days). Match formulas.js conventions.
const CTL_TAU = 42
const K_CTL = 2 / (CTL_TAU + 1)

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function classifyBand(rampRate) {
  if (!Number.isFinite(rampRate)) return null
  if (rampRate < BAND_UNDER) return 'UNDERTRAINED'
  if (rampRate < BAND_OPT)   return 'OPTIMAL'
  if (rampRate <= BAND_AGG)  return 'AGGRESSIVE'
  return 'HIGH_RISK'
}

// Build daily TSS map keyed by ISO date.
function buildTssMap(log) {
  const map = {}
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const tss = Number(e.tss) || 0
    map[key] = (map[key] || 0) + tss
  }
  return map
}

// Walk CTL day-by-day from `startIso` to `endIso` (inclusive) using the
// EMA recursion `ctl_{n+1} = ctl_n + (tss_n - ctl_n) * k`. Returns an
// object keyed by ISO date with the end-of-day CTL value.
function walkCtl(tssMap, startIso, endIso) {
  const out = {}
  let ctl = 0
  const start = new Date(startIso + 'T00:00:00Z')
  const end   = new Date(endIso   + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    const tss = tssMap[iso] || 0
    ctl = ctl + (tss - ctl) * K_CTL
    out[iso] = ctl
  }
  return out
}

/**
 * @param {{log: Array<{date:string, tss:number}>, today: string, weeks?: number}} args
 * @returns {{
 *   rampRate: number,
 *   currentCtl: number,
 *   baselineCtl: number,
 *   band: 'UNDERTRAINED' | 'OPTIMAL' | 'AGGRESSIVE' | 'HIGH_RISK',
 *   weeklyDeltas: number[],
 *   citation: string,
 * } | null}
 */
export function computeCtlRampRate({ log, today, weeks = 4 } = {}) {
  if (!isValidIso(today)) return null
  if (!Array.isArray(log) || log.length === 0) return null
  const w = Math.floor(Number(weeks))
  if (!Number.isFinite(w) || w < 1) return null

  // Need at least `weeks` weeks of history to produce `weeks` deltas
  // (one delta per week, comparing end-of-week to start-of-week).
  const windowDays = w * 7
  // Window start is `weeks` weeks before today; we sample CTL at days
  // {0, 7, 14, …, windowDays}. The number of samples is weeks+1 →
  // weeks deltas.
  const windowStartIso = isoMinusDays(today, windowDays)

  // Find the earliest log date (if any) so we can detect logs that are
  // too short to populate `weeks` of trailing CTL meaningfully. If the
  // log doesn't cover the entire trailing window we abort — a partial
  // window would make the early weekly deltas reflect "fitness
  // building from zero" rather than a genuine ramp rate.
  let earliestLogIso = null
  for (const e of log) {
    if (!e || !e.date) continue
    const k = String(e.date).slice(0, 10)
    if (!ISO_RE.test(k)) continue
    if (earliestLogIso === null || k < earliestLogIso) earliestLogIso = k
  }
  if (!earliestLogIso) return null
  if (earliestLogIso > windowStartIso) return null

  // Prime 180 days before windowStart so CTL has converged.
  const primeStartIso = isoMinusDays(windowStartIso, 180)
  const tssMap = buildTssMap(log)
  const ctlByDate = walkCtl(tssMap, primeStartIso, today)

  // Sample CTL at weeks+1 anchors (oldest → newest).
  const anchors = []
  for (let i = w; i >= 0; i--) {
    const iso = isoMinusDays(today, i * 7)
    const v = ctlByDate[iso]
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    anchors.push(v)
  }

  // weeklyDeltas oldest-first: anchors[i+1] - anchors[i]
  const weeklyDeltas = []
  for (let i = 0; i < w; i++) {
    weeklyDeltas.push(anchors[i + 1] - anchors[i])
  }

  const sum = weeklyDeltas.reduce((s, v) => s + v, 0)
  const rampRate = sum / w
  const band = classifyBand(rampRate)
  if (!band) return null

  // Round to one decimal for stable UI / test assertions.
  const round1 = v => Math.round(v * 10) / 10
  return {
    rampRate:     round1(rampRate),
    currentCtl:   round1(anchors[anchors.length - 1]),
    baselineCtl:  round1(anchors[0]),
    band,
    weeklyDeltas: weeklyDeltas.map(round1),
    citation:     CTL_RAMP_RATE_CITATION,
  }
}
