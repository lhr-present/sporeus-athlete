// src/lib/race/readinessScore.js
// Composite race-readiness score 0–100 with explicit missing-data handling.
// Sources: Mujika (2010), Coggan PMC, Plews (2012), Fullagar (2015), Hooper & Mackinnon (1995)

const CITATION = 'Mujika I. (2010) Scand J Med Sci Sports 20(s2):24–31; Coggan PMC framework'

// ── Component functions (all exported for independent testing) ─────────────────

/**
 * Form component — Coggan PMC: how close current CTL is to 30-day peak.
 * Weight 0.30
 * @param {number} ctl
 * @param {number|null} peakCtl30d
 * @returns {number|null} 0–100
 */
export function formComponent(ctl, peakCtl30d) {
  if (ctl == null || peakCtl30d == null || peakCtl30d <= 0) return null
  return Math.min(100, Math.max(0, (ctl / peakCtl30d) * 100))
}

/**
 * TSB component — Mujika (2010) taper zone.
 * Weight 0.25
 * @param {number} tsb
 * @returns {number} 0–100
 */
export function tsbComponent(tsb) {
  if (tsb == null) return null
  if (tsb <= -10) return 0
  if (tsb < 5)    return ((tsb + 10) / 15) * 60   // linear 0→60 over [-10, +5)
  if (tsb <= 20)  return 100                         // sweet spot [+5, +20]
  if (tsb <= 35)  return 100 - ((tsb - 20) / 15) * 40  // linear 100→60 over (20, 35]
  return 30                                           // over-tapered
}

/**
 * HRV component — Plews et al. (2012) z-score method.
 * Weight 0.20
 * @param {number|null} hrv7dMean
 * @param {number|null} hrv28dMean
 * @param {number|null} hrv28dSd
 * @returns {number|null}
 */
export function hrvComponent(hrv7dMean, hrv28dMean, hrv28dSd) {
  if (hrv7dMean == null || hrv28dMean == null || hrv28dSd == null || hrv28dSd <= 0) return null
  const z = (hrv7dMean - hrv28dMean) / hrv28dSd
  if (z >= 0.5)             return 100
  if (z >= -0.5)            return 70
  if (z >= -1.5)            return 40
  return 10
}

/**
 * Sleep component — Fullagar et al. (2015) threshold piecewise.
 * Weight 0.15
 * @param {number|null} sleep7dMean hours/night
 * @returns {number|null}
 */
export function sleepComponent(sleep7dMean) {
  if (sleep7dMean == null) return null
  if (sleep7dMean >= 7.5) return 100
  if (sleep7dMean >= 7.0) return 80
  if (sleep7dMean >= 6.5) return 60
  if (sleep7dMean >= 6.0) return 40
  return 20
}

/**
 * Subjective wellbeing component — Hooper & Mackinnon (1995) linear scale.
 * Weight 0.10
 * @param {number|null} score1to10
 * @returns {number|null}
 */
export function subjectiveComponent(score1to10) {
  if (score1to10 == null) return null
  const clamped = Math.max(1, Math.min(10, score1to10))
  return ((clamped - 1) / 9) * 100
}

// ── Main composite function ────────────────────────────────────────────────────

const COMPONENTS_DEF = [
  { name: 'form',       weight: 0.30 },
  { name: 'tsb',        weight: 0.25 },
  { name: 'hrv_trend',  weight: 0.20 },
  { name: 'sleep',      weight: 0.15 },
  { name: 'subjective', weight: 0.10 },
]

const REASONS = {
  form:       'no_peak_ctl',
  hrv_trend:  'no_hrv_baseline',
  sleep:      'no_sleep_data',
  subjective: 'no_subjective_data',
}

function classifyScore(score) {
  if (score >= 85) return 'peaked'
  if (score >= 70) return 'ready'
  if (score >= 50) return 'needs_work'
  return 'overreached'
}

/**
 * Compute composite race-readiness score.
 * @param {Object} inputs
 * @param {number|null} inputs.ctl
 * @param {number|null} inputs.atl
 * @param {number|null} inputs.tsb
 * @param {number|null} inputs.peakCtl30d - max CTL in last 30 days (required for form component)
 * @param {number|null} inputs.hrv7dMean
 * @param {number|null} inputs.hrv28dMean
 * @param {number|null} inputs.hrv28dSd
 * @param {number|null} inputs.sleep7dMean
 * @param {number|null} inputs.subjective - 1–10
 * @param {string} inputs.raceDate - ISO date
 * @param {string} [inputs.today] - ISO date (for testability, defaults to now)
 * @returns {Object}
 */
export function computeReadinessScore(inputs) {
  const {
    ctl, tsb,
    peakCtl30d,
    hrv7dMean, hrv28dMean, hrv28dSd,
    sleep7dMean,
    subjective,
    raceDate,
    today = new Date().toISOString().slice(0, 10),
  } = inputs || {}

  const insufficient = (reason) => ({
    score: null,
    components: COMPONENTS_DEF.map(c => ({
      name: c.name, value: null, weight: c.weight, contribution: 0,
      available: false, reason: reason,
    })),
    missingWeight: 1,
    classification: 'insufficient_data',
    topDrivers: [],
    citation: CITATION,
    asOf: raceDate || today,
  })

  if (ctl == null || tsb == null) return insufficient('no_ctl_or_tsb')

  const rawValues = {
    form:       formComponent(ctl, peakCtl30d),
    tsb:        tsbComponent(tsb),
    hrv_trend:  hrvComponent(hrv7dMean, hrv28dMean, hrv28dSd),
    sleep:      sleepComponent(sleep7dMean),
    subjective: subjectiveComponent(subjective),
  }

  const components = COMPONENTS_DEF.map(c => {
    const value = rawValues[c.name]
    const available = value != null
    return {
      name: c.name,
      value,
      weight: c.weight,
      contribution: 0,
      available,
      reason: available ? null : (REASONS[c.name] || 'unavailable'),
    }
  })

  const availableWeight = components.filter(c => c.available).reduce((s, c) => s + c.weight, 0)
  const missingWeight   = 1 - availableWeight

  if (missingWeight > 0.5) return insufficient('insufficient_signals')

  // Re-normalise weights across available components
  for (const c of components) {
    if (c.available) {
      const normWeight  = c.weight / availableWeight
      c.contribution    = rawValues[c.name] * normWeight
    }
  }

  const score = Math.round(components.reduce((s, c) => s + c.contribution, 0))

  const topDrivers = [...components]
    .filter(c => c.available)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 2)

  return {
    score,
    components,
    missingWeight,
    classification: classifyScore(score),
    topDrivers,
    citation: CITATION,
    asOf: raceDate || today,
  }
}
