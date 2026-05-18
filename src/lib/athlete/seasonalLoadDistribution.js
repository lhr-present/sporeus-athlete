// src/lib/athlete/seasonalLoadDistribution.js
//
// Pure-fn: aggregate training load into a 12-month rolling window and
// classify the annual periodization pattern.
//
// Scientific grounding:
//   - Issurin 2010 — "New horizons for the methodology and physiology of
//     training periodization." Argues that modern annual plans converge
//     on either BLOCK periodization (sharp, single-peak loading) or
//     TRADITIONAL periodization (gradual ramp + taper).
//   - Bompa 2018 — "Periodization: Theory and Methodology of Training."
//     Classic baseline; gradual ramp + planned taper.
//
// Classification rules (applied in order):
//   FLAT       — coefficient of variation (stdev / mean) < 0.25
//   BLOCK      — CV > 0.5 AND a clear single peak month (peak > 1.8 * avg)
//   VOLATILE   — CV > 0.5 AND no single peak (multiple high months)
//   TRADITIONAL — gradual ramp + taper: ≥8 of 12 months have
//                 month-over-month change within 30 % of the prior month
//
// Inputs:
//   log    — array of session entries { date: 'YYYY-MM-DD', tss: number }
//   today  — optional ISO date string anchoring the window's end-month
//
// Returns null when fewer than 6 distinct months in the window have any
// sessions logged (insufficient signal to classify).

export const SEASONAL_LOAD_CITATION = 'Issurin 2010; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}/

const MONTH_LABEL_EN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseTodayIso(today) {
  if (typeof today === 'string' && ISO_DATE_RE.test(today)) return today
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

// Build the array of the 12 month keys ending at the today's month.
// Oldest first. Returns [{ year, month0, key: 'YYYY-MM' }] of length 12.
function build12MonthKeys(todayIso) {
  const d = new Date(todayIso + 'T00:00:00Z')
  const endY = d.getUTCFullYear()
  const endM = d.getUTCMonth() // 0-based
  const out = []
  for (let i = 11; i >= 0; i--) {
    // step back i months from (endY, endM)
    const total = endY * 12 + endM - i
    const y = Math.floor(total / 12)
    const m = total - y * 12
    out.push({
      year: y,
      month0: m,
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
    })
  }
  return out
}

function classifyPattern({ months, mean, cv }) {
  // FLAT first — low variability dominates
  if (cv < 0.25) return 'FLAT'

  // Find peak (highest TSS) month
  let peakVal = -Infinity
  for (let i = 0; i < months.length; i++) {
    if (months[i].tss > peakVal) {
      peakVal = months[i].tss
    }
  }

  if (cv > 0.5) {
    // Single dominant peak → BLOCK; multiple high months → VOLATILE
    const peakRatio = mean > 0 ? peakVal / mean : 0
    if (peakRatio > 1.8) return 'BLOCK'
    return 'VOLATILE'
  }

  // Gradual ramp / taper check: count months whose value is within 30 %
  // of the previous month's value. With 12 months we have 11 transitions.
  // Requirement: ≥8 of 12 months meet the test. The first month has no
  // prior so it always counts.
  let withinCount = 1 // first month
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1].tss
    const curr = months[i].tss
    if (prev <= 0) {
      // Treat zero baseline as "out of range" unless current is also zero
      if (curr === 0) withinCount++
      continue
    }
    const ratio = Math.abs(curr - prev) / prev
    if (ratio <= 0.3) withinCount++
  }
  if (withinCount >= 8) return 'TRADITIONAL'

  // Fallback: moderate variability with no dominant peak and no smooth ramp
  return 'VOLATILE'
}

/**
 * @param {{ log: Array<{date:string, tss:number}>, today?: string }} args
 * @returns {{
 *   pattern: 'BLOCK' | 'TRADITIONAL' | 'VOLATILE' | 'FLAT',
 *   months: Array<{ month: string, monthLabel: string, tss: number }>,
 *   peakMonth: { month: string, monthLabel: string, tss: number },
 *   troughMonth: { month: string, monthLabel: string, tss: number },
 *   avgTss: number,
 *   cv: number,
 *   citation: string,
 * } | null}
 */
export function analyzeSeasonalLoadDistribution({ log, today } = {}) {
  if (!Array.isArray(log)) return null
  const todayIso = parseTodayIso(today)

  const monthKeys = build12MonthKeys(todayIso)
  const keySet = new Set(monthKeys.map(m => m.key))

  // Aggregate TSS per month key.
  const tssByKey = {}
  for (const k of keySet) tssByKey[k] = 0

  for (const e of log) {
    if (!e || !e.date) continue
    const ds = String(e.date)
    if (!ISO_RE.test(ds)) continue
    const k = ds.slice(0, 7) // 'YYYY-MM'
    if (!keySet.has(k)) continue
    const tss = Number(e.tss) || 0
    if (tss <= 0) continue
    tssByKey[k] += tss
  }

  // Months array (chronological, oldest first).
  const months = monthKeys.map(({ key, month0 }) => ({
    month: key,
    monthLabel: MONTH_LABEL_EN[month0],
    tss: Math.round(tssByKey[key] * 10) / 10,
  }))

  // Gate: ≥6 of 12 months must have any sessions logged.
  const populated = months.filter(m => m.tss > 0).length
  if (populated < 6) return null

  // Summary stats.
  const total = months.reduce((s, m) => s + m.tss, 0)
  const mean = total / months.length
  const variance = months.reduce((s, m) => s + (m.tss - mean) ** 2, 0) / months.length
  const stdev = Math.sqrt(variance)
  const cv = mean > 0 ? stdev / mean : 0

  // Peak / trough.
  let peakIdx = 0
  let troughIdx = 0
  for (let i = 0; i < months.length; i++) {
    if (months[i].tss > months[peakIdx].tss) peakIdx = i
    if (months[i].tss < months[troughIdx].tss) troughIdx = i
  }

  const pattern = classifyPattern({ months, mean, cv })

  return {
    pattern,
    months,
    peakMonth: months[peakIdx],
    troughMonth: months[troughIdx],
    avgTss: Math.round(mean * 10) / 10,
    cv: Math.round(cv * 1000) / 1000,
    citation: SEASONAL_LOAD_CITATION,
  }
}
