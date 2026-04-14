// ─── src/lib/sport/simulation.js — Training load simulation engine ─────────────
// Banister impulse-response model, Monte Carlo plan optimizer, TSS calculators.

import { BANISTER, ACWR } from './constants.js'

// ── Banister impulse-response constants ──────────────────────────────────────
// Standard Banister (1991) values; can be overridden per athlete.
const DEFAULT_TAU1 = BANISTER.TAU_CTL   // fitness decay time constant (days)
const DEFAULT_TAU2 = BANISTER.TAU_ATL   // fatigue decay time constant (days)
const DEFAULT_K1   = 1    // fitness gain coefficient
const DEFAULT_K2   = 2    // fatigue gain coefficient (fatigue rises ~2× faster)

// Precompute EWMA decay factors using TrainingPeaks impulse-response formula:
// K = 1 − e^(−1/τ)  (matches trainingLoad.js K_CTL/K_ATL exactly)
// BUG FIX: previously used 1/tau (≈0.02381 / 0.14286) — now uses correct
// exponential K (≈0.02353 / 0.13307), matching Hulin et al. 2016.
function kFromTau(tau) { return 1 - Math.exp(-1 / tau) }

// ── Single-day Banister update ────────────────────────────────────────────────
// Given yesterday's ATL/CTL and today's TSS, returns { CTL, ATL, TSB }.
// CTL (chronic training load) = fitness
// ATL (acute training load)   = fatigue
// TSB (training stress balance) = form = CTL − ATL
// Update: CTL(t) = CTL(t-1)×(1−K₁) + TSS(t)×K₁  where K₁ = 1−e^(−1/τ₁)
/**
 * @description Advances the Banister impulse-response model by one day given yesterday's state and today's TSS.
 *   Uses the exponential EWMA formula: CTL(t) = CTL(t-1)×(1−K₁) + TSS(t)×K₁.
 * @param {number} prevCTL - Previous day's chronic training load (fitness)
 * @param {number} prevATL - Previous day's acute training load (fatigue)
 * @param {number} tss - Today's Training Stress Score
 * @param {number} [tau1=42] - Fitness decay time constant in days (CTL)
 * @param {number} [tau2=7] - Fatigue decay time constant in days (ATL)
 * @returns {{CTL:number, ATL:number, TSB:number}|null} Updated loads and training stress balance
 * @source Banister & Calvert (1980) — Modeling elite athletic performance
 * @example
 * banisterDay(50, 60, 80) // => {CTL: ~51.9, ATL: ~66.6, TSB: ~-14.7}
 */
export function banisterDay(prevCTL, prevATL, tss, tau1 = DEFAULT_TAU1, tau2 = DEFAULT_TAU2) {
  if (prevCTL == null || prevATL == null || tss == null) return null
  const k1  = kFromTau(tau1)
  const k2  = kFromTau(tau2)
  const CTL = prevCTL * (1 - k1) + tss * k1
  const ATL = prevATL * (1 - k2) + tss * k2
  const TSB = CTL - ATL
  return {
    CTL: Math.round(CTL * 10) / 10,
    ATL: Math.round(ATL * 10) / 10,
    TSB: Math.round(TSB * 10) / 10,
  }
}

// ── Multi-day Banister simulation ─────────────────────────────────────────────
/**
 * @description Simulates CTL, ATL, and TSB over a sequence of daily TSS values using the Banister model.
 * @param {Array<number|null>} tssArray - Daily TSS values; null entries treated as rest days (TSS=0)
 * @param {number} [startCTL=0] - Initial CTL value
 * @param {number} [startATL=0] - Initial ATL value
 * @param {number} [tau1=42] - CTL time constant in days
 * @param {number} [tau2=7] - ATL time constant in days
 * @returns {Array<{day:number, tss:number, CTL:number, ATL:number, TSB:number}>}
 * @source Banister & Calvert (1980) — Modeling elite athletic performance
 * @example
 * simulateBanister([100, 0, 80], 40, 50) // => [{day:1,...}, {day:2,...}, {day:3,...}]
 */
export function simulateBanister(tssArray, startCTL = 0, startATL = 0, tau1 = DEFAULT_TAU1, tau2 = DEFAULT_TAU2) {
  if (!tssArray || tssArray.length === 0) return []
  let CTL = startCTL
  let ATL = startATL
  return tssArray.map((rawTss, i) => {
    const tss = rawTss ?? 0
    const next = banisterDay(CTL, ATL, tss, tau1, tau2)
    CTL = next.CTL
    ATL = next.ATL
    return { day: i + 1, tss, CTL, ATL, TSB: next.TSB }
  })
}

// ── Sport-specific TSS calculators ────────────────────────────────────────────
/**
 * @description Calculates running TSS (rTSS) from session HR relative to HR at threshold.
 *   rTSS = (durationHr) × IF² × 100 where IF = hrAvg / hrThresh.
 * @param {number} durationSec - Session duration in seconds
 * @param {number} hrAvg - Average heart rate during session (bpm)
 * @param {number} hrThresh - Heart rate at threshold (bpm)
 * @returns {number|null} rTSS value (1 decimal place), or null on invalid input
 * @source Banister & Calvert (1980) — Modeling elite athletic performance; Hulin et al. (2016) — The acute:chronic workload ratio predicts injury
 * @example
 * runningTSS(3600, 160, 175) // => ~83.7
 */
export function runningTSS(durationSec, hrAvg, hrThresh) {
  if (!durationSec || !hrAvg || !hrThresh || hrThresh <= 0) return null
  if (durationSec <= 0 || hrAvg <= 0) return null
  const IF  = hrAvg / hrThresh
  const tss = (durationSec / 3600) * IF * IF * 100
  return Math.round(tss * 10) / 10
}

/**
 * @description Calculates power-based TSS (cycling or rowing) using Coggan's formula.
 *   TSS = (durationHr) × IF² × 100 where IF = avgPower / FTP.
 * @param {number} durationSec - Session duration in seconds
 * @param {number} avgPowerW - Average power output in watts
 * @param {number} ftpW - Functional Threshold Power in watts
 * @returns {number|null} TSS value (1 decimal place), or null on invalid input
 * @source Banister & Calvert (1980) — Modeling elite athletic performance; Morton (1986) — A 3-parameter critical power model
 * @example
 * powerTSS(3600, 270, 300) // => 81.0
 */
export function powerTSS(durationSec, avgPowerW, ftpW) {
  if (!durationSec || !avgPowerW || !ftpW || ftpW <= 0) return null
  if (durationSec <= 0 || avgPowerW <= 0) return null
  const IF  = avgPowerW / ftpW
  const tss = (durationSec / 3600) * IF * IF * 100
  return Math.round(tss * 10) / 10
}

/**
 * @description Re-exports swim TSS calculation for convenience. sTSS = (durationHr) × IF² × 100 where IF = cssSecPer100m / currentSecPer100m.
 * @param {number} durationMin - Session duration in minutes
 * @param {number} currentSecPer100m - Session average pace in sec/100 m
 * @param {number} cssSecPer100m - CSS in sec/100 m
 * @returns {number|null} sTSS (rounded integer), or null on invalid input
 * @source Wakayoshi et al. (1992) — Determination and validity of critical velocity as swimming fatigue threshold
 * @example
 * swimTSS(60, 95, 90) // => ~100
 */
export function swimTSS(durationMin, currentSecPer100m, cssSecPer100m) {
  if (!durationMin || !currentSecPer100m || !cssSecPer100m) return null
  if (cssSecPer100m <= 0 || currentSecPer100m <= 0 || durationMin <= 0) return null
  const IF = cssSecPer100m / currentSecPer100m
  return Math.round((durationMin / 60) * IF * IF * 100)
}

// ── Score a training plan ─────────────────────────────────────────────────────
/**
 * @description Scores a weekly TSS training plan from 0–100 based on taper compliance,
 *   progressive overload, peak TSB, and training variety (coefficient of variation).
 * @param {number[]} weeklyTSS - Array of weekly TSS values (one per week)
 * @param {number} [startCTL=0] - Athlete's starting CTL
 * @param {number} [startATL=0] - Athlete's starting ATL
 * @returns {number|null} Plan score 0–100, or null if fewer than 2 weeks provided
 * @source Banister & Calvert (1980) — Modeling elite athletic performance; Hulin et al. (2016) — The acute:chronic workload ratio predicts injury
 * @example
 * scoreTrainingPlan([200, 250, 300, 180], 40, 45) // => ~65
 */
export function scoreTrainingPlan(weeklyTSS, startCTL = 0, startATL = 0) {
  if (!weeklyTSS || weeklyTSS.length < 2) return null
  // Expand weekly TSS to daily (divide evenly across 7 days)
  const dailyTSS = weeklyTSS.flatMap(wk => Array(7).fill((wk ?? 0) / 7))
  const sim = simulateBanister(dailyTSS, startCTL, startATL)

  // 1. Taper bonus: last-week avg ≤ 60% of peak week
  const peakWeek = Math.max(...weeklyTSS)
  const lastWeek = weeklyTSS[weeklyTSS.length - 1] ?? 0
  const taperBonus = lastWeek <= peakWeek * 0.6 ? 15 : 0

  // 2. Progressive overload: penalise >20% week-on-week jump in load
  let overloadPenalty = 0
  for (let i = 1; i < weeklyTSS.length - 1; i++) {
    const prev = weeklyTSS[i - 1] || 1
    const curr = weeklyTSS[i]    || 0
    if (curr > prev * 1.20) overloadPenalty += 10
  }

  // 3. Peak TSB penalty: want peak ATL−CTL (negative TSB) between −10 and −30
  const peakNegTSB = Math.min(...sim.map(d => d.TSB))
  let peakTSBScore = 0
  if (peakNegTSB <= -10 && peakNegTSB >= -30) peakTSBScore = 20
  else if (peakNegTSB < -30) peakTSBScore = 10  // overcooked
  else peakTSBScore = 5                          // undertrained

  // 4. Monotony: coefficient of variation of daily TSS (lower = better variety)
  const mean = dailyTSS.reduce((a, b) => a + b, 0) / dailyTSS.length
  if (mean > 0) {
    const variance = dailyTSS.reduce((a, x) => a + (x - mean) ** 2, 0) / dailyTSS.length
    const cv = Math.sqrt(variance) / mean
    // Reward CV > 0.5 (varied load); penalise CV < 0.2 (monotone)
    var monotonyScore = cv > 0.5 ? 15 : cv > 0.2 ? 10 : 0
  } else {
    var monotonyScore = 0
  }

  const raw = 50 + taperBonus + peakTSBScore + monotonyScore - overloadPenalty
  return Math.min(100, Math.max(0, Math.round(raw)))
}

// ── Monte Carlo plan optimizer ─────────────────────────────────────────────────
/**
 * @description Generates n random training plans within constraints, simulates each with the
 *   Banister model, scores them, and returns the best plan with distribution statistics.
 * @param {object} [constraints={}]
 * @param {number} [constraints.weeks=8] - Plan duration in weeks
 * @param {number} [constraints.minWeeklyTSS=30] - Minimum TSS for any week
 * @param {number} [constraints.maxWeeklyTSS=600] - Maximum TSS for peak week
 * @param {number[]} [constraints.recoveryWeeks=[]] - 0-indexed weeks forced to recovery load
 * @param {number} [constraints.startCTL=0] - Athlete's current CTL
 * @param {number} [constraints.startATL=0] - Athlete's current ATL
 * @param {number} [n=500] - Number of Monte Carlo simulations to run
 * @returns {{bestPlan:number[], bestScore:number, meanScore:number, p90Score:number, simulations:number, histogram:Array}|null}
 * @source Press et al. (2007) — Numerical Recipes: The Art of Scientific Computing; Banister & Calvert (1980) — Modeling elite athletic performance
 * @example
 * monteCarloOptimizer({weeks:8, minWeeklyTSS:100, maxWeeklyTSS:400}, 200)
 * // => {bestPlan:[...], bestScore:78, meanScore:52, ...}
 */
export function monteCarloOptimizer(constraints = {}, n = 500) {
  const {
    weeks        = 8,
    minWeeklyTSS = 30,
    maxWeeklyTSS = 600,
    recoveryWeeks = [],
    startCTL     = 0,
    startATL     = 0,
  } = constraints

  if (weeks < 1 || minWeeklyTSS >= maxWeeklyTSS || n < 1) return null

  let bestPlan  = null
  let bestScore = -Infinity
  const scores  = []

  for (let i = 0; i < n; i++) {
    // Generate random weekly TSS with a slight upward trend + recovery weeks
    const plan = Array.from({ length: weeks }, (_, w) => {
      if (recoveryWeeks.includes(w)) {
        return minWeeklyTSS + Math.random() * (minWeeklyTSS * 0.5)
      }
      const progressFactor = 1 + (w / weeks) * 0.4  // gentle linear build
      const raw = minWeeklyTSS * progressFactor + Math.random() * (maxWeeklyTSS - minWeeklyTSS)
      return Math.min(maxWeeklyTSS, Math.round(raw))
    })

    const score = scoreTrainingPlan(plan, startCTL, startATL)
    scores.push(score)
    if (score > bestScore) {
      bestScore = score
      bestPlan  = plan
    }
  }

  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length
  const sorted    = [...scores].sort((a, b) => a - b)
  const p90Score  = sorted[Math.floor(sorted.length * 0.9)]

  // Build a score histogram (10 buckets of width 10, 0–100)
  const histogram = Array.from({ length: 10 }, (_, i) => {
    const lo = i * 10
    const hi = lo + 10
    return { range: `${lo}–${hi}`, count: scores.filter(s => s >= lo && s < hi).length }
  })

  return {
    bestPlan,
    bestScore,
    meanScore:  Math.round(meanScore * 10) / 10,
    p90Score,
    simulations: n,
    histogram,
  }
}

// ── Peak-form window predictor ─────────────────────────────────────────────────
/**
 * @description Finds the day with optimal race form (highest TSB) in a Banister simulation
 *   of a given weekly TSS plan.
 * @param {number[]} weeklyTSS - Array of weekly TSS values
 * @param {number} [startCTL=0] - Athlete's starting CTL
 * @param {number} [startATL=0] - Athlete's starting ATL
 * @returns {{peakDay:number, peakTSB:number, trace:Array}|null} Day number (1-indexed), peak TSB, and full trace
 * @source Banister & Calvert (1980) — Modeling elite athletic performance
 * @example
 * peakFormWindow([300, 350, 200, 100], 50, 55) // => {peakDay: 28, peakTSB: 12.4, trace: [...]}
 */
export function peakFormWindow(weeklyTSS, startCTL = 0, startATL = 0) {
  if (!weeklyTSS || weeklyTSS.length === 0) return null
  const dailyTSS = weeklyTSS.flatMap(wk => Array(7).fill((wk ?? 0) / 7))
  const trace    = simulateBanister(dailyTSS, startCTL, startATL)
  // Peak form = highest TSB (least fatigued relative to fitness)
  let peakDay = 0
  let peakTSB = -Infinity
  trace.forEach((d, i) => {
    if (d.TSB > peakTSB) { peakTSB = d.TSB; peakDay = i + 1 }
  })
  return { peakDay, peakTSB: Math.round(peakTSB * 10) / 10, trace }
}

// ── Dual-discipline Banister model (triathletes) ──────────────────────────────
// Mujika et al. (2000): swim fatigue decays faster than cycling/running.
// τ2 for swim = 5d; τ2 for bike/run = 7d (DEFAULT_TAU2).
//
// swimLog:    Array<{ date: string, tss: number, type: string }>
// bikeRunLog: Array<{ date: string, tss: number, type: string }>
// options: { startSwimCTL, startSwimATL, startBikeRunCTL, startBikeRunATL, tau1, tau2Swim, tau2BikeRun }
//
// Returns array of { date, swimTSS, bikeRunTSS, swimCTL, swimATL, swimTSB, bikeRunCTL, bikeRunATL, bikeRunTSB, combinedLoad }
const SWIM_TAU2 = 5  // faster fatigue clearance for swim (Mujika 2000)

/**
 * @description Runs a dual-discipline Banister model for triathletes, tracking swim and bike/run
 *   loads separately (swim fatigue clears faster: τ2=5d vs 7d for bike/run per Mujika 2000).
 * @param {Array<{date:string, tss:number, type:string}>} swimLog - Swim session entries
 * @param {Array<{date:string, tss:number, type:string}>} bikeRunLog - Bike and run session entries
 * @param {object} [options={}] - Override starting CTL/ATL and time constants
 * @returns {Array<{date, swimTSS, bikeRunTSS, swimCTL, swimATL, swimTSB, bikeRunCTL, bikeRunATL, bikeRunTSB, combinedLoad}>}
 * @source Banister & Calvert (1980) — Modeling elite athletic performance
 * @example
 * dualBanister([{date:'2026-01-01',tss:60,type:'Swim'}], [{date:'2026-01-01',tss:80,type:'Ride'}])
 * // => [{date:'2026-01-01', swimCTL:..., bikeRunCTL:..., ...}]
 */
export function dualBanister(swimLog, bikeRunLog, options = {}) {
  const {
    startSwimCTL    = 0,
    startSwimATL    = 0,
    startBikeRunCTL = 0,
    startBikeRunATL = 0,
    tau1            = DEFAULT_TAU1,
    tau2Swim        = SWIM_TAU2,
    tau2BikeRun     = DEFAULT_TAU2,
  } = options

  // Build unified date range
  const allDates = new Set([
    ...(swimLog    || []).map(e => e.date),
    ...(bikeRunLog || []).map(e => e.date),
  ])
  if (allDates.size === 0) return []

  const dates = [...allDates].sort()
  const swimByDate    = Object.fromEntries((swimLog    || []).map(e => [e.date, e.tss || 0]))
  const bikeRunByDate = Object.fromEntries((bikeRunLog || []).map(e => [e.date, e.tss || 0]))

  let swimCTL    = startSwimCTL
  let swimATL    = startSwimATL
  let bikeRunCTL = startBikeRunCTL
  let bikeRunATL = startBikeRunATL

  return dates.map(date => {
    const swimTSS    = swimByDate[date]    ?? 0
    const bikeRunTSS = bikeRunByDate[date] ?? 0

    // Swim Banister update (faster fatigue decay)
    const swimNext = banisterDay(swimCTL, swimATL, swimTSS, tau1, tau2Swim)
    swimCTL = swimNext.CTL
    swimATL = swimNext.ATL

    // Bike+Run Banister update (standard fatigue decay)
    const brNext = banisterDay(bikeRunCTL, bikeRunATL, bikeRunTSS, tau1, tau2BikeRun)
    bikeRunCTL = brNext.CTL
    bikeRunATL = brNext.ATL

    return {
      date,
      swimTSS,
      bikeRunTSS,
      swimCTL:    swimNext.CTL,
      swimATL:    swimNext.ATL,
      swimTSB:    swimNext.TSB,
      bikeRunCTL: brNext.CTL,
      bikeRunATL: brNext.ATL,
      bikeRunTSB: brNext.TSB,
      combinedLoad: Math.round((swimTSS + bikeRunTSS) * 10) / 10,
    }
  })
}

// ── Discipline log splitter ────────────────────────────────────────────────────
// Given a mixed training log, splits into swim vs bike+run sub-logs.
// Detects discipline from session type field: 'Swim'→swim, 'Ride'|'Run'→bikeRun.
// Entries with no matching type are assigned to bikeRun.
//
// Returns { swimLog, bikeRunLog } each as Array<{ date, tss, type }>
const SWIM_TYPES    = new Set(['swim', 'swimming', 'open water', 'pool'])
const BIKERUN_TYPES = new Set(['ride', 'bike', 'cycling', 'run', 'running', 'trail run', 'brick'])

/**
 * @description Splits a mixed training log into separate swim and bike/run sub-logs
 *   based on session type string matching.
 * @param {Array<{date:string, tss:number, type:string}>} log - Mixed training log entries
 * @returns {{swimLog: Array, bikeRunLog: Array}} Two arrays partitioned by discipline
 * @example
 * splitDisciplineLogs([{date:'2026-01-01',tss:60,type:'Swim'},{date:'2026-01-02',tss:80,type:'Ride'}])
 * // => {swimLog:[{...}], bikeRunLog:[{...}]}
 */
export function splitDisciplineLogs(log) {
  const swimLog    = []
  const bikeRunLog = []

  for (const entry of (log || [])) {
    const type = (entry.type || '').toLowerCase().trim()
    const tss  = entry.tss || 0
    if (tss <= 0) continue
    if ([...SWIM_TYPES].some(t => type.includes(t))) {
      swimLog.push({ date: entry.date, tss, type: entry.type })
    } else {
      bikeRunLog.push({ date: entry.date, tss, type: entry.type })
    }
  }

  return { swimLog, bikeRunLog }
}

// ── addAdaptivePlanAdjustment ─────────────────────────────────────────────────
// Takes original weekly TSS plan, actual TSS per week, and current week index.
// Returns new plan array; each week has optional _adjusted flag + _reason.
// Rules:
//   Under-performance: actual < 80% of planned for 2+ consecutive weeks → reduce remaining by 10%
//   Over-performance:  actual > 115% of planned for 2+ consecutive weeks → increase remaining by 8%
//     but cap so simulated ACWR stays ≤ 1.3 (approximate: new week ≤ prevWeek * 1.3)
/**
 * @description Adjusts remaining weeks of a training plan based on athlete compliance history.
 *   Under-performance (actual < 80% of planned for 2+ weeks) reduces remaining load by 10%;
 *   over-performance (actual > 115% for 2+ weeks) increases by 8%, capped at ACWR 1.3.
 * @param {number[]} originalPlan - Original weekly TSS plan array
 * @param {number[]} actualTSS - Actual TSS achieved per week
 * @param {number} currentWeekIdx - 0-indexed index of the current week
 * @returns {Array<{tss:number, _adjusted:boolean, _reason:string|null, _week:number}>}
 * @source Hulin et al. (2016) — The acute:chronic workload ratio predicts injury
 * @example
 * addAdaptivePlanAdjustment([200,200,200,200], [100,110], 2)
 * // => weeks 2–3 reduced by 10% with _adjusted:true
 */
export function addAdaptivePlanAdjustment(originalPlan, actualTSS, currentWeekIdx) {
  if (!Array.isArray(originalPlan) || originalPlan.length === 0) return []
  if (!Array.isArray(actualTSS) || currentWeekIdx < 0) return [...originalPlan]

  const plan = originalPlan.map((tss, i) => ({ tss, _adjusted: false, _reason: null, _week: i }))

  // Check last 2 completed weeks for pattern
  const checkStart = Math.max(0, currentWeekIdx - 2)
  const checkEnd   = currentWeekIdx  // exclusive
  if (checkEnd - checkStart < 2) return plan.map(w => ({ ...w }))

  let underCount = 0, overCount = 0
  for (let i = checkStart; i < checkEnd; i++) {
    const planned = originalPlan[i] ?? 0
    const actual  = actualTSS[i] ?? 0
    if (planned > 0 && actual < planned * 0.80) underCount++
    if (planned > 0 && actual > planned * 1.15) overCount++
  }

  if (underCount >= 2) {
    // Reduce remaining weeks by 10%
    for (let i = currentWeekIdx; i < plan.length; i++) {
      plan[i].tss      = Math.round(plan[i].tss * 0.90)
      plan[i]._adjusted = true
      plan[i]._reason   = 'Reduced 10% — under-performance last 2 weeks'
    }
  } else if (overCount >= 2) {
    // Increase remaining by 8%, cap at ACWR.OPTIMAL_MAX
    for (let i = currentWeekIdx; i < plan.length; i++) {
      const proposed = Math.round(plan[i].tss * 1.08)
      const prevTSS  = i > 0 ? plan[i - 1].tss : plan[i].tss
      const cap      = Math.round(prevTSS * ACWR.OPTIMAL_MAX)
      plan[i].tss      = Math.min(proposed, cap)
      plan[i]._adjusted = true
      plan[i]._reason   = 'Increased 8% — over-performance last 2 weeks'
    }
  }

  return plan
}
