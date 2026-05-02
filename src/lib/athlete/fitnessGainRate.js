// ─── fitnessGainRate.js — E124: Fitness Gain Rate Detector (28d window) ──────
// Linear regression of CTL over the last 28 days. Surfaces whether the athlete
// is detraining, maintaining, building, or spiking, complementing the
// staleZones / workoutDensity / sessionVariety trio with CTL trajectory.
//
// CTL is computed via the same TrainingPeaks Banister impulse-response decay
// used by calculatePMC in src/lib/trainingLoad.js (K_CTL ≈ 0.02353,
// τ ≈ 42d). We compute inline here so the function honors a caller-supplied
// `today` and remains a UTC-pure, deterministic function for testing.
//
// Citation: Banister 1991; Coggan PMC
// ─────────────────────────────────────────────────────────────────────────────

import { BANISTER } from '../sport/constants.js'

export const FITNESS_GAIN_RATE_CITATION = 'Banister 1991; Coggan PMC'

const K_CTL     = BANISTER.K_CTL          // ≈ 0.02353 fitness decay factor
const DECAY_CTL = 1 - K_CTL               // ≈ 0.97647

const WINDOW_DAYS = 28
const PRIME_DAYS  = 180   // matches calculatePMC priming window
const RELIABLE_MIN_DAYS = 21

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Daily CTL series for the trailing 28 days ───────────────────────────────
/**
 * Compute the 28-day daily CTL series ending on `today` (inclusive), priming
 * with 180 days of zeros / log history before the window for accuracy.
 * Mirrors the impulse-response model in calculatePMC.
 *
 * @param {Array}  log     - training log entries [{ date, tss }]
 * @param {string} today   - YYYY-MM-DD reference (UTC)
 * @returns {number[]}     - 28 daily CTL values, oldest → newest
 */
function ctlSeries28d(log, today) {
  const byDate = {}
  for (const e of (log || [])) {
    if (e?.date) {
      const d = e.date.slice(0, 10)
      byDate[d] = (byDate[d] || 0) + (Number(e.tss) || 0)
    }
  }

  const primeStart  = addDaysStr(today, -(WINDOW_DAYS - 1) - PRIME_DAYS)
  const windowStart = addDaysStr(today, -(WINDOW_DAYS - 1))

  let ctl = 0
  const series = []
  let cursor = primeStart
  while (cursor <= today) {
    const tss = byDate[cursor] || 0
    ctl = ctl * DECAY_CTL + tss * K_CTL
    if (cursor >= windowStart) series.push(ctl)
    cursor = addDaysStr(cursor, 1)
  }
  return series
}

// ─── Linear regression on a numeric series ───────────────────────────────────
/**
 * Ordinary least-squares fit of y = m·x + b where x is the day index 0..n-1.
 * Returns slope (per day) and r² (clamped ≥ 0). Falls back to {0,0} for
 * degenerate input (≤1 point or zero variance in x).
 */
function linRegress(y) {
  const n = y.length
  if (n < 2) return { slope: 0, r2: 0 }

  let sumX = 0, sumY = 0
  for (let i = 0; i < n; i++) { sumX += i; sumY += y[i] }
  const meanX = sumX / n
  const meanY = sumY / n

  let num = 0, denX = 0
  for (let i = 0; i < n; i++) {
    const dx = i - meanX
    num  += dx * (y[i] - meanY)
    denX += dx * dx
  }
  if (denX === 0) return { slope: 0, r2: 0 }

  const slope = num / denX
  const intercept = meanY - slope * meanX

  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    const yhat = slope * i + intercept
    ssRes += (y[i] - yhat) ** 2
    ssTot += (y[i] - meanY) ** 2
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0
  return { slope, r2 }
}

// ─── Band classification ─────────────────────────────────────────────────────
//   detraining   : slopeWeek < -1.0
//   maintaining  : -1.0 ≤ slopeWeek ≤ +0.5    (strict > for building)
//   building     : +0.5 < slopeWeek ≤ +2.0    (strict > for spiking)
//   spiking      : slopeWeek > +2.0
function classify(slopeWeek) {
  if (slopeWeek < -1.0) return 'detraining'
  if (slopeWeek <= 0.5) return 'maintaining'
  if (slopeWeek <= 2.0) return 'building'
  return 'spiking'
}

// Format a slope for embedding in messages: always 2 decimal places, signed
// only when positive (negative carries its own sign already).
function fmtSlope(slope) {
  const v = (Math.round(slope * 100) / 100).toFixed(2)
  return slope > 0 ? `+${v}` : v   // negatives print as "-1.23"; zero as "0.00"
}

function buildMessage(band, slopeWeek) {
  const v = fmtSlope(slopeWeek)
  switch (band) {
    case 'detraining':
      return {
        en: `Fitness declining: ${v} CTL/week. Resume training.`,
        tr: `Form düşüyor: ${v} CTL/hafta. Antrenmana devam et.`,
      }
    case 'building':
      return {
        en: `Fitness building: ${v} CTL/week. Healthy gains.`,
        tr: `Form gelişiyor: ${v} CTL/hafta. Sağlıklı kazanım.`,
      }
    case 'spiking':
      return {
        en: `Fitness spiking: ${v} CTL/week. Watch ACWR for injury risk.`,
        tr: `Form ani yükseliyor: ${v} CTL/hafta. Yaralanma riski için ACWR'a dikkat.`,
      }
    case 'maintaining':
    default:
      return {
        en: 'Fitness stable. Maintaining current level.',
        tr: 'Form sabit. Mevcut seviye korunuyor.',
      }
  }
}

// ─── detectFitnessGainRate ───────────────────────────────────────────────────
/**
 * Compute the athlete's CTL gain rate over the last 28 days via linear
 * regression.
 *
 * Bands (CTL gain per week, where +1 CTL/week is a meaningful build):
 *   detraining   < -1.0
 *   maintaining  -1.0 to +0.5
 *   building     +0.5 to +2.0
 *   spiking      > +2.0  (potentially unsafe — coupled with ACWR caveat)
 *
 * @param {Array} log - training_log entries [{ date, tss }]
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date (UTC)
 * @returns {{
 *   slope: number,
 *   ctl28dStart: number, ctl28dEnd: number,
 *   r2: number,
 *   band: 'detraining'|'maintaining'|'building'|'spiking',
 *   message: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectFitnessGainRate(log, today = todayStr()) {
  // Empty log → safe defaults
  if (!Array.isArray(log) || log.length === 0) {
    return {
      slope: 0,
      ctl28dStart: 0,
      ctl28dEnd: 0,
      r2: 0,
      band: 'maintaining',
      message: buildMessage('maintaining', 0),
      reliable: false,
      citation: FITNESS_GAIN_RATE_CITATION,
    }
  }

  // Daily CTL series for the 28-day window
  const series = ctlSeries28d(log, today)

  // Reliability: ≥ 21 distinct dates with log entries within the window
  const start28 = addDaysStr(today, -(WINDOW_DAYS - 1))
  const distinctDays = new Set()
  for (const e of log) {
    if (!e?.date) continue
    const d = e.date.slice(0, 10)
    if (d >= start28 && d <= today) distinctDays.add(d)
  }
  const reliable = distinctDays.size >= RELIABLE_MIN_DAYS

  // Linear regression on daily CTL → slope per day, r²
  const { slope: slopePerDay, r2 } = linRegress(series)
  const slopePerWeek = slopePerDay * 7
  const slopeRounded = Math.round(slopePerWeek * 100) / 100

  const band = classify(slopeRounded)

  return {
    slope:       slopeRounded,
    ctl28dStart: Math.round((series[0]                 || 0) * 10) / 10,
    ctl28dEnd:   Math.round((series[series.length - 1] || 0) * 10) / 10,
    r2:          Math.round(r2 * 100) / 100,
    band,
    message:     buildMessage(band, slopeRounded),
    reliable,
    citation:    FITNESS_GAIN_RATE_CITATION,
  }
}
