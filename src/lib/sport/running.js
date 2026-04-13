// ─── src/lib/sport/running.js — Running sport-science engine ──────────────────
// Jack Daniels VDOT, race prediction via binary search, training paces,
// critical velocity, and race readiness scoring.

// ── Jack Daniels VDOT model ───────────────────────────────────────────────────
// pctVO2: fraction of VO2max sustainable at a given duration (t in minutes)
// Source: Daniels' Running Formula, 3rd ed., Chapter 3
function pctVO2atDuration(tMin) {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * tMin) +
    0.2989558 * Math.exp(-0.1932605 * tMin)
  )
}

// VO2 at a given pace: VO2 (mL/kg/min) = −4.60 + 0.182258×(d/t) + 0.000104×(d/t)²
// d in meters, t in minutes
function vo2AtPace(dM, tMin) {
  const v = dM / tMin  // m/min
  return -4.60 + 0.182258 * v + 0.000104 * v * v
}

// VDOT from a race result
export function vdotFromRace(distanceM, timeSec) {
  if (!distanceM || !timeSec || timeSec <= 0 || distanceM <= 0) return null
  const tMin = timeSec / 60
  const vo2  = vo2AtPace(distanceM, tMin)
  const pct  = pctVO2atDuration(tMin)
  if (pct <= 0) return null
  return Math.round((vo2 / pct) * 10) / 10
}

// ── Race time prediction via binary search ────────────────────────────────────
// Predicts finish time for targetDistanceM given VDOT.
export function predictRaceTime(vdot, targetDistanceM) {
  if (!vdot || !targetDistanceM || vdot <= 0 || targetDistanceM <= 0) return null
  // Binary search: find tMin such that vo2AtPace(d, tMin) / pctVO2atDuration(tMin) ≈ vdot
  let lo = 0.5, hi = 600  // 30s to 10h in minutes
  for (let i = 0; i < 50; i++) {
    const mid  = (lo + hi) / 2
    const pred = vo2AtPace(targetDistanceM, mid) / pctVO2atDuration(mid)
    if (pred > vdot) lo = mid
    else hi = mid
  }
  return Math.round(((lo + hi) / 2) * 60)  // seconds
}

// ── Training paces ────────────────────────────────────────────────────────────
// Returns training pace zones for a given VDOT (sec/km)
// Daniels' intensity definitions: E, M, T, I, R
export function trainingPaces(vdot) {
  if (!vdot || vdot <= 0) return null
  // Predict reference times for pace calculations
  // E pace: 59–74% of VO2max → corresponds to marathon+ effort
  // Using predictRaceTime as anchor
  const marathon = predictRaceTime(vdot, 42195)
  const half     = predictRaceTime(vdot, 21097)
  const t10k     = predictRaceTime(vdot, 10000)
  const t5k      = predictRaceTime(vdot, 5000)

  if (!marathon || !half || !t10k || !t5k) return null

  // E (Easy): 120–180s/km slower than M pace (rough)
  // M (Marathon): marathon pace
  // T (Threshold): ~1h race pace, roughly half-marathon to 10K range
  // I (Interval): ~5K to 3K race pace (~VO2max intensity)
  // R (Repetition): faster than 5K pace
  const mPaceSecKm  = marathon / 42.195
  const tPaceSecKm  = (half / 21.097 + t10k / 10) / 2 * 0.95  // weighted T pace
  const iPaceSecKm  = t5k / 5 * 0.98
  const rPaceSecKm  = t5k / 5 * 0.93
  const ePaceSecKm  = mPaceSecKm * 1.18  // easy = ~18% slower than marathon

  return {
    E: Math.round(ePaceSecKm),   // Easy (sec/km)
    M: Math.round(mPaceSecKm),   // Marathon pace (sec/km)
    T: Math.round(tPaceSecKm),   // Threshold (sec/km)
    I: Math.round(iPaceSecKm),   // Interval (sec/km)
    R: Math.round(rPaceSecKm),   // Repetition (sec/km)
    vdot,
    marathon5kRef: t5k,
    marathonRef:   marathon,
  }
}

// ── Critical Velocity (CV) model ──────────────────────────────────────────────
// Analogous to Critical Power: CV = work capacity / time model.
// From 2+ time trials: CV = (d2 − d1) / (t2 − t1) in m/s
export function criticalVelocity(efforts) {
  // efforts: [{ distanceM, timeSec }, ...]  — at least 2, different distances
  if (!efforts || efforts.length < 2) return null
  // Linear regression: distance = CV × time + D' (anaerobic distance capacity)
  const n    = efforts.length
  const xs   = efforts.map(e => e.timeSec)
  const ys   = efforts.map(e => e.distanceM)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-9) return null
  const CV   = (n * sumXY - sumX * sumY) / denom   // m/s
  const DAna = (sumY - CV * sumX) / n               // meters (D')
  if (CV <= 0 || DAna <= 0) return null
  return {
    CV:   Math.round(CV * 1000) / 1000,   // m/s, 3dp
    DAna: Math.round(DAna),               // meters
    CVPaceSecKm: Math.round(1000 / CV),   // sec/km
  }
}

// ── Race readiness score ──────────────────────────────────────────────────────
// Scores race readiness based on recent training metrics.
// Returns { score 0–100, flags: string[] }
export function raceReadiness({ recentLog = [], targetDistanceM = 10000, peakWeeklyVolM = 0, daysToRace = 14 }) {
  let score = 50
  const flags = []

  // 1. Volume adequacy: last 4 weeks vs peak week
  const recent4w = recentLog.filter(e => {
    const d = new Date(e.date)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28)
    return d >= cutoff && (e.type === 'Run' || e.source === 'strava')
  })
  const totalRecentM = recent4w.reduce((s, e) => s + (e.distanceM || 0), 0)
  const avgWeeklyM = totalRecentM / 4

  if (peakWeeklyVolM > 0) {
    const volRatio = avgWeeklyM / peakWeeklyVolM
    if (volRatio >= 0.7 && volRatio <= 1.0) { score += 15; flags.push('Volume adequate') }
    else if (volRatio < 0.5) { score -= 10; flags.push('Volume too low — possible detraining') }
    else if (volRatio > 1.0) { score -= 5; flags.push('Volume high — monitor fatigue') }
  }

  // 2. Taper check: should be reducing load in final 2 weeks
  if (daysToRace <= 14 && daysToRace > 0) {
    const lastWeek = recentLog.filter(e => {
      const d = new Date(e.date)
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
      return d >= cutoff
    })
    const lastWeekM = lastWeek.reduce((s, e) => s + (e.distanceM || 0), 0)
    const taperingOk = avgWeeklyM > 0 && lastWeekM < avgWeeklyM * 0.80
    if (taperingOk) { score += 15; flags.push('Tapering on track') }
    else { score -= 5; flags.push('Consider reducing volume for taper') }
  }

  // 3. Race-specific workouts: check for tempo/interval sessions in last 6 weeks
  const sixWeek = recentLog.filter(e => {
    const d = new Date(e.date)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 42)
    return d >= cutoff
  })
  const tempoCount = sixWeek.filter(e => e.rpe >= 7).length
  if (tempoCount >= 4) { score += 15; flags.push('Quality sessions present') }
  else if (tempoCount === 0) { score -= 10; flags.push('No high-quality sessions in 6 weeks') }

  // 4. Distance-specific check: longer races need longer long runs
  const longRunDist = 5000  // assume 5K minimum for any race
  const longestRun = Math.max(0, ...recent4w.map(e => e.distanceM || 0))
  if (targetDistanceM <= 10000) {
    if (longestRun >= targetDistanceM * 1.2) { score += 5; flags.push('Long run coverage adequate') }
  } else {
    if (longestRun >= targetDistanceM * 0.8) { score += 10; flags.push('Long run coverage adequate') }
    else if (longestRun < targetDistanceM * 0.5) { score -= 10; flags.push('Long run too short for target race') }
  }
  void longRunDist  // suppress unused warning

  return { score: Math.max(0, Math.min(100, score)), flags }
}
