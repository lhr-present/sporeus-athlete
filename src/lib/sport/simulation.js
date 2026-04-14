// ─── src/lib/sport/simulation.js — Training load simulation engine ─────────────
// Banister impulse-response model, Monte Carlo plan optimizer, TSS calculators.

// ── Banister impulse-response constants ──────────────────────────────────────
// Standard Banister (1991) values; can be overridden per athlete.
const DEFAULT_TAU1 = 42   // fitness decay time constant (days)
const DEFAULT_TAU2 = 7    // fatigue decay time constant (days)
const DEFAULT_K1   = 1    // fitness gain coefficient
const DEFAULT_K2   = 2    // fatigue gain coefficient (fatigue rises ~2× faster)

// ── Single-day Banister update ────────────────────────────────────────────────
// Given yesterday's ATL/CTL and today's TSS, returns { CTL, ATL, TSB }.
// CTL (chronic training load) = fitness
// ATL (acute training load)   = fatigue
// TSB (training stress balance) = form = CTL − ATL
export function banisterDay(prevCTL, prevATL, tss, tau1 = DEFAULT_TAU1, tau2 = DEFAULT_TAU2) {
  if (prevCTL == null || prevATL == null || tss == null) return null
  const CTL = prevCTL + (tss - prevCTL) / tau1
  const ATL = prevATL + (tss - prevATL) / tau2
  const TSB = CTL - ATL
  return {
    CTL: Math.round(CTL * 10) / 10,
    ATL: Math.round(ATL * 10) / 10,
    TSB: Math.round(TSB * 10) / 10,
  }
}

// ── Multi-day Banister simulation ─────────────────────────────────────────────
// Simulates CTL/ATL/TSB over a sequence of daily TSS values.
// tssArray: [number | null] — null means rest day (TSS=0)
// Returns array of { day, tss, CTL, ATL, TSB }
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
// Running TSS (rTSS): based on HR or pace relative to threshold
// rTSS = (durationSec × hrAvg × hrAvg) / (hrThresh × hrThresh × 3600) × 100
export function runningTSS(durationSec, hrAvg, hrThresh) {
  if (!durationSec || !hrAvg || !hrThresh || hrThresh <= 0) return null
  if (durationSec <= 0 || hrAvg <= 0) return null
  const IF  = hrAvg / hrThresh
  const tss = (durationSec / 3600) * IF * IF * 100
  return Math.round(tss * 10) / 10
}

// Cycling/Rowing power TSS: standard formula (Coggan)
// TSS = (durationSec × NP × IF) / (FTP × 3600) × 100
// Simplified: IF = avgPower / FTP, TSS = durationHr × IF² × 100
export function powerTSS(durationSec, avgPowerW, ftpW) {
  if (!durationSec || !avgPowerW || !ftpW || ftpW <= 0) return null
  if (durationSec <= 0 || avgPowerW <= 0) return null
  const IF  = avgPowerW / ftpW
  const tss = (durationSec / 3600) * IF * IF * 100
  return Math.round(tss * 10) / 10
}

// Swim TSS (re-exported for convenience — same formula as swimming.js swimTSS)
// sTSS = (durationMin/60) × (cssSecPer100m/currentSecPer100m)² × 100
export function swimTSS(durationMin, currentSecPer100m, cssSecPer100m) {
  if (!durationMin || !currentSecPer100m || !cssSecPer100m) return null
  if (cssSecPer100m <= 0 || currentSecPer100m <= 0 || durationMin <= 0) return null
  const IF = cssSecPer100m / currentSecPer100m
  return Math.round((durationMin / 60) * IF * IF * 100)
}

// ── Score a training plan ─────────────────────────────────────────────────────
// Given a weekly TSS array (one entry per week), scores the plan 0–100.
// Scoring criteria:
//   - Progressive overload: each block builds before a recovery week (−10 per violation)
//   - Peak TSB: score highest ATL−CTL ratio achieved (wants ~−10 to −25 at peak)
//   - Taper: last week TSS ≤ 60% of peak week (+15 if satisfied)
//   - Monotony: stdev of week-to-week TSS ratios (lower = better)
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
// Generates `n` random training plans with the given constraints, simulates each,
// scores them, and returns the top plan with summary stats.
//
// constraints: {
//   weeks:          number   — plan duration in weeks
//   minWeeklyTSS:   number   — lower bound for any week's TSS
//   maxWeeklyTSS:   number   — upper bound for peak week TSS
//   recoveryWeeks:  number[] — 0-indexed week indices that must be recovery (TSS ≤ 60% of max)
//   startCTL:       number   — athlete's current CTL
//   startATL:       number   — athlete's current ATL
// }
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
// Given a simulated Banister trace, returns the day(s) where TSB is optimal
// for racing (typically −5 to +5 after a taper, meaning ATL has dropped enough).
// Returns { peakDay, peakTSB, trace } where trace is the full sim output.
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
