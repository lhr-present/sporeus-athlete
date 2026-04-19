// src/lib/science/efficiencyFactor.js
// E12 — Efficiency Factor: aerobic output per unit of cardiac stress.
//
// Efficiency Factor (EF) measures how much work (power or speed) the
// cardiovascular system produces per heartbeat at steady aerobic intensities.
// A rising EF over a training block is the primary marker of aerobic adaptation.
//
// Cycling:  EF = NP (W) / avg_HR (bpm)      — Coggan (2003)
// Running:  EF = avg_pace (m/min) / avg_HR   — Coggan (2003) adapted
//
// A 2–5% EF increase over 4–6 weeks indicates meaningful aerobic development.
// CV < 5% across sessions confirms a stable, improving trend.
//
// References:
//   Coggan A.R. (2003). Training and Racing with a Power Meter. VeloPress.
//   Allen H. & Coggan A.R. (2010). Training and Racing with a Power Meter (2nd ed.). VeloPress.

// ── Citation ─────────────────────────────────────────────────────────────────

export const EF_CITATION =
  'Coggan A.R. (2003) Training & Racing with a Power Meter; Allen & Coggan (2010) 2nd ed.'

// ── Minimum valid avg HR (bpm). Below this the HR data is unusable. ──────────
const MIN_VALID_HR = 40

// ── computeEF ─────────────────────────────────────────────────────────────────

/**
 * Compute Efficiency Factor for a single session.
 *
 * @param {Object} session
 * @param {number}   session.avgHR          - Average heart rate (bpm)
 * @param {number}   [session.np]           - Normalized Power (W) — cycling preferred
 * @param {number}   [session.avgPower]     - Average Power (W) — used if np missing
 * @param {number}   [session.avgPaceMPerMin] - Average pace (m/min) — running
 * @param {'cycling'|'running'|string} [session.sport] - Sport type; auto-detected if omitted
 *
 * @returns {{
 *   ef: number,
 *   metric: 'np/hr'|'power/hr'|'pace/hr',
 *   sport: 'cycling'|'running',
 *   citation: string,
 * } | null}  null when insufficient data
 */
export function computeEF(session) {
  if (!session) return null

  const { avgHR, np, avgPower, avgPaceMPerMin, sport } = session

  if (!avgHR || avgHR < MIN_VALID_HR) return null

  // Cycling branch — prefer NP over average power
  const resolvedPower = np ?? avgPower
  const isCycling = sport === 'cycling' || (sport == null && resolvedPower != null && resolvedPower > 0)

  if (isCycling && resolvedPower != null && resolvedPower > 0) {
    const metric = np != null ? 'np/hr' : 'power/hr'
    return {
      ef: Math.round((resolvedPower / avgHR) * 1000) / 1000,
      metric,
      sport: 'cycling',
      citation: EF_CITATION,
    }
  }

  // Running branch
  const isRunning = sport === 'running' || (sport == null && avgPaceMPerMin != null)
  if (isRunning && avgPaceMPerMin != null && avgPaceMPerMin > 0) {
    return {
      ef: Math.round((avgPaceMPerMin / avgHR) * 1000) / 1000,
      metric: 'pace/hr',
      sport: 'running',
      citation: EF_CITATION,
    }
  }

  return null
}

// ── efTrend ───────────────────────────────────────────────────────────────────

/**
 * Compute EF trend across a window of sessions.
 *
 * Requires ≥8 valid EF sessions in the window to produce a meaningful result.
 * Uses coefficient of variation (CV) to flag unstable data.
 *
 * @param {Object[]} sessions - Array of session objects (same shape as computeEF input)
 *                              Each must also have a `date` string (ISO 'YYYY-MM-DD')
 * @param {number} [windowDays=30] - Look-back window in days from the most recent session
 *
 * @returns {{
 *   trend: 'improving'|'stable'|'declining',
 *   changePercent: number,    // % change from first to last half mean
 *   cv: number,               // coefficient of variation of EF values (0–1)
 *   sessionsN: number,        // number of valid sessions used
 *   mean: number,             // mean EF across window
 *   efValues: number[],       // all EF values in chronological order
 *   dates: string[],          // corresponding dates
 *   citation: string,
 * } | null}  null when < 8 valid sessions
 */
export function efTrend(sessions, windowDays = 30) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null

  // Sort chronologically
  const sorted = [...sessions].sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)

  // Determine window start from most recent session date
  const lastDate = sorted[sorted.length - 1]?.date
  if (!lastDate) return null
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - windowDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Filter to window and compute EF
  const windowed = sorted.filter(s => (s.date ?? '') >= cutoffStr)

  const efPairs = []
  for (const s of windowed) {
    const result = computeEF(s)
    if (result !== null) {
      efPairs.push({ date: s.date, ef: result.ef })
    }
  }

  if (efPairs.length < 8) return null

  const efValues = efPairs.map(p => p.ef)
  const dates    = efPairs.map(p => p.date)
  const n        = efValues.length

  // Mean
  const mean = efValues.reduce((s, v) => s + v, 0) / n

  // CV (coefficient of variation)
  const variance = efValues.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0

  // Trend: compare first-half mean vs second-half mean
  const half      = Math.floor(n / 2)
  const firstMean = efValues.slice(0, half).reduce((s, v) => s + v, 0) / half
  const lastMean  = efValues.slice(n - half).reduce((s, v) => s + v, 0) / half

  const changePercent = firstMean > 0
    ? Math.round(((lastMean - firstMean) / firstMean) * 100 * 10) / 10
    : 0

  // ≥2% improvement = improving; ≤−2% = declining; otherwise stable
  const trend = changePercent >= 2 ? 'improving'
              : changePercent <= -2 ? 'declining'
              : 'stable'

  return {
    trend,
    changePercent,
    cv: Math.round(cv * 1000) / 1000,
    sessionsN: n,
    mean: Math.round(mean * 1000) / 1000,
    efValues,
    dates,
    citation: EF_CITATION,
  }
}
