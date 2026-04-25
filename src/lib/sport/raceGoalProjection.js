/**
 * Project CTL at a future race date using the Banister (1975) exponential model.
 * CTL decays with time constant τ=42 days when no load is applied.
 * Ref: Banister E.W. et al. (1975). A systems model of training for athletic performance.
 *
 * @param {number} currentCTL - current CTL value
 * @param {number} avgWeeklyTSS - average weekly TSS over last 4 weeks (used as projected load)
 * @param {number} daysUntilRace - days from today to race date
 * @returns {number} projected CTL at race date (rounded to 1 decimal)
 */
export function projectCTLAtRace(currentCTL, avgWeeklyTSS, daysUntilRace) {
  // CTL response: each day adds (dailyTSS / 42) * (1 - e^(-1/42)) to CTL
  // over daysUntilRace, assuming constant daily TSS = avgWeeklyTSS / 7
  // CTL(t) = CTL(0) * e^(-t/42) + (dailyTSS * 42) * (1 - e^(-t/42))
  const TAU = 42
  const dailyTSS = avgWeeklyTSS / 7
  const decay = Math.exp(-daysUntilRace / TAU)
  const projected = currentCTL * decay + dailyTSS * TAU * (1 - decay)
  return Math.round(projected * 10) / 10
}

/**
 * Assess race readiness based on projected vs target CTL.
 * @param {number} projectedCTL
 * @param {number} targetCTL
 * @returns {{ status: 'on_track'|'at_risk'|'needs_attention', pct: number }}
 */
export function assessRaceReadiness(projectedCTL, targetCTL) {
  const pct = targetCTL > 0 ? Math.round((projectedCTL / targetCTL) * 100) : 0
  if (pct >= 95) return { status: 'on_track', pct }
  if (pct >= 80) return { status: 'at_risk', pct }
  return { status: 'needs_attention', pct }
}

/**
 * Compute average weekly TSS from last N weeks of training log.
 * @param {Array} log - training log entries with { date, tss }
 * @param {number} weeks - number of weeks to average (default 4)
 * @returns {number} average weekly TSS
 */
export function avgWeeklyTSSFromLog(log, weeks = 4) {
  if (!log || log.length === 0) return 0
  const cutoff = new Date(Date.now() - weeks * 7 * 86400000).toISOString().slice(0, 10)
  const recent = log.filter(e => e.date >= cutoff)
  const totalTSS = recent.reduce((s, e) => s + (e.tss || 0), 0)
  return totalTSS / weeks
}
