// ─── fitnessConsistency.js — CTL Consistency Detector (90d window) ──────────
// Measures CTL stability between weeks across the trailing 90 days. Distinct
// from fitnessGainRate (slope/direction) and recoveryDebt (TSB integral): an
// athlete on a moderate slope may either be steadily building OR oscillating
// wildly. This detector surfaces that meta-pattern via the coefficient of
// variation (CV) of 13 weekly average CTL values.
//
// Cite: Banister 1991; Coggan PMC; Fitz-Clarke 1991 model stability
// ─────────────────────────────────────────────────────────────────────────────

export const FITNESS_CONSISTENCY_CITATION =
  'Banister 1991; Coggan PMC; Fitz-Clarke 1991 model stability'

const K_CTL = 1 - Math.exp(-1 / 42)
const WINDOW_DAYS = 90
const WEEKS_TARGET = 13
const MIN_WEEKS = 4
const MIN_MEAN_CTL = 5

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDays(laterStr, earlierStr) {
  const a = new Date(laterStr + 'T00:00:00Z').getTime()
  const b = new Date(earlierStr + 'T00:00:00Z').getTime()
  return Math.round((a - b) / 86400000)
}

const MESSAGES = {
  'rock-solid': {
    en: 'Rock-solid CTL — minimal variance',
    tr: 'Çok stabil CTL — minimum sapma',
  },
  stable: {
    en: 'Stable CTL — small week-to-week swings',
    tr: 'Stabil CTL — küçük haftalık dalgalanmalar',
  },
  oscillating: {
    en: 'Oscillating CTL — inconsistent build',
    tr: 'Dalgalı CTL — tutarsız yapım',
  },
  chaotic: {
    en: 'Chaotic CTL — pick a target and commit',
    tr: 'Kaotik CTL — bir hedef seç ve sürdür',
  },
}

const RECOMMENDATIONS = {
  'rock-solid': { en: '', tr: '' },
  stable: { en: '', tr: '' },
  oscillating: {
    en: 'Pick a 4-week base block and protect it from missed sessions',
    tr: '4-haftalık bir temel bloğu seç ve kaçan seanslardan koru',
  },
  chaotic: {
    en: 'Reset to a structured plan; sustained CTL needs ≥3 weeks consistent load',
    tr: 'Yapılandırılmış bir plana dön; sürekli CTL en az 3 hafta tutarlı yük gerektirir',
  },
}

function bandFor(cv) {
  if (cv < 0.05) return 'rock-solid'
  if (cv < 0.10) return 'stable'
  if (cv < 0.20) return 'oscillating'
  return 'chaotic'
}

// ─── detectFitnessConsistency ────────────────────────────────────────────────
/**
 * Compute CTL consistency over the trailing 90 days via week-to-week
 * coefficient of variation across 13 weekly average CTL values.
 *
 * @param {Array}  log   - training_log entries [{ date, tss }]
 * @param {string} today - YYYY-MM-DD reference (UTC); defaults to current date
 * @returns {{
 *   meanCTL: number, stdevCTL: number, minCTL: number, maxCTL: number,
 *   cv: number, rangePct: number, weeksAnalyzed: number,
 *   band: 'rock-solid'|'stable'|'oscillating'|'chaotic',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectFitnessConsistency(
  log,
  today = new Date().toISOString().slice(0, 10),
) {
  const empty = {
    meanCTL: 0,
    stdevCTL: 0,
    minCTL: 0,
    maxCTL: 0,
    cv: 0,
    rangePct: 0,
    weeksAnalyzed: 0,
    band: 'rock-solid',
    message: { ...MESSAGES['rock-solid'] },
    recommendation: { ...RECOMMENDATIONS['rock-solid'] },
    reliable: false,
    citation: FITNESS_CONSISTENCY_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  const dailyTSS = new Map()
  let minDate = null
  let maxDate = null
  for (const e of log) {
    const d = e?.date
    if (typeof d !== 'string' || d.length < 10) continue
    const ds = d.slice(0, 10)
    if (ds > today) continue
    const tss = Number(e?.tss)
    const t = Number.isFinite(tss) ? tss : 0
    dailyTSS.set(ds, (dailyTSS.get(ds) || 0) + t)
    if (minDate == null || ds < minDate) minDate = ds
    if (maxDate == null || ds > maxDate) maxDate = ds
  }

  if (minDate == null) return empty

  const windowStart = addDaysStr(today, -(WINDOW_DAYS - 1))
  const walkStart = minDate < windowStart ? minDate : windowStart
  const totalDays = diffDays(today, walkStart) + 1

  let ctl = 0
  const dailyCTL = new Map()
  for (let i = 0; i < totalDays; i++) {
    const ds = addDaysStr(walkStart, i)
    const tss = dailyTSS.get(ds) || 0
    ctl = ctl + K_CTL * (tss - ctl)
    if (ds >= windowStart) dailyCTL.set(ds, ctl)
  }

  // Build 13 weekly buckets ending on each Sunday at/within the 90-day window.
  // Anchor: most recent Sunday <= today. Then walk backwards 13 weeks.
  const todayDow = new Date(today + 'T00:00:00Z').getUTCDay()
  const lastSunday = todayDow === 0 ? today : addDaysStr(today, -todayDow)

  // A weekly bucket is only counted when the entire 7-day window lies within
  // both the 90-day analysis window AND the recorded log span — partial weeks
  // from the very start of a short log would otherwise dilute the CV.
  const earliestValidStart = minDate > windowStart ? minDate : windowStart
  const weeklyAverages = []
  for (let w = 0; w < WEEKS_TARGET; w++) {
    const weekEnd = addDaysStr(lastSunday, -7 * w)
    const weekStart = addDaysStr(weekEnd, -6)
    if (weekStart < earliestValidStart) break
    if (weekEnd > today) continue
    let sum = 0
    let n = 0
    for (let d = 0; d < 7; d++) {
      const ds = addDaysStr(weekStart, d)
      if (!dailyCTL.has(ds)) continue
      sum += dailyCTL.get(ds)
      n++
    }
    if (n === 7) weeklyAverages.push(sum / n)
  }

  const weeksAnalyzed = weeklyAverages.length
  const span = maxDate && minDate ? diffDays(maxDate, minDate) + 1 : 0

  if (weeksAnalyzed < MIN_WEEKS) {
    return {
      ...empty,
      weeksAnalyzed,
      reliable: false,
    }
  }

  const meanCTL = weeklyAverages.reduce((a, b) => a + b, 0) / weeksAnalyzed
  let varSum = 0
  for (const v of weeklyAverages) varSum += (v - meanCTL) ** 2
  const stdevCTL = weeksAnalyzed > 1 ? Math.sqrt(varSum / (weeksAnalyzed - 1)) : 0
  const minCTL = Math.min(...weeklyAverages)
  const maxCTL = Math.max(...weeklyAverages)

  const cv = meanCTL > 0 ? stdevCTL / meanCTL : 0
  const rangePctRaw = meanCTL > 0 ? ((maxCTL - minCTL) / meanCTL) * 100 : 0

  const band = bandFor(cv)

  const reliable = span >= WINDOW_DAYS && meanCTL > MIN_MEAN_CTL

  return {
    meanCTL: Math.round(meanCTL * 10) / 10,
    stdevCTL: Math.round(stdevCTL * 10) / 10,
    minCTL: Math.round(minCTL * 10) / 10,
    maxCTL: Math.round(maxCTL * 10) / 10,
    cv: Math.round(cv * 1000) / 1000,
    rangePct: Math.round(rangePctRaw * 10) / 10,
    weeksAnalyzed,
    band,
    message: { ...MESSAGES[band] },
    recommendation: { ...RECOMMENDATIONS[band] },
    reliable,
    citation: FITNESS_CONSISTENCY_CITATION,
  }
}
