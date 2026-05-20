// ─── peakWeekFrequency.js — Near-peak week frequency (block density) ─────────
// Counts how many of the last `lookbackWeeks` (default 26 ≈ 6 months) ISO weeks
// reached ≥ peakThresholdPct × the athlete's LIFETIME peak weekly TSS.
//
// Why a separate card from WeeklyVolumeRecord:
//   - WeeklyVolumeRecord asks "is THIS week a record?" — single-point snapshot.
//   - PeakWeekFrequency asks "have you been TRAINING at near-peak level
//     consistently?" — block density. Issurin 2010 (block periodization) and
//     Bompa 2018 argue that a build phase shows MULTIPLE near-peak weeks
//     clustered, not a single one-off peak. Lifetime peak alone does not say
//     whether the athlete sustained training at that level or briefly touched
//     it.
//
// Bands:
//   NO_BLOCK       — 0 near-peak weeks in lookback
//   SPARSE         — 1-2 near-peak weeks (occasional spikes)
//   BLOCK_DENSITY  — 3-6 near-peak weeks (genuine build block)
//   PEAK_PHASE     — ≥7 near-peak weeks (sustained near-peak training)
//
// Pure — no React, no globals.
//
// Cite: Issurin 2010 — block periodization concentrated loading windows;
//       Bompa 2018 — periodization of training, peaking microcycles.
// ─────────────────────────────────────────────────────────────────────────────

export const PEAK_WEEK_FREQUENCY_CITATION = 'Issurin 2010; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// Need a reasonable lifetime baseline before claiming what the "peak" is.
const MIN_DISTINCT_WEEKS = 8

// ─── Helpers ────────────────────────────────────────────────────────────────
function toDate(input) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    return new Date(input.getTime())
  }
  if (typeof input === 'string' && input.length > 0) {
    const d = new Date(input.length === 10 ? input + 'T00:00:00Z' : input)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** Monday of the training week (Mon-Sun) containing `date`, UTC midnight. */
function mondayOfWeekUTC(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const js = d.getUTCDay() // 0=Sun..6=Sat
  const back = (js + 6) % 7
  d.setUTCDate(d.getUTCDate() - back)
  return d
}

function toIsoDate(d) {
  return d.toISOString().slice(0, 10)
}

function entryTss(e) {
  if (!e) return 0
  const v = Number(e.tss)
  return Number.isFinite(v) && v > 0 ? v : 0
}

function round4(v) {
  return Math.round(v * 10000) / 10000
}

// ─── analyzePeakWeekFrequency ───────────────────────────────────────────────
/**
 * @param {Object} args
 * @param {Array<{date:string, tss?:number}>} args.log
 * @param {Date|string} [args.today]
 * @param {number} [args.lookbackWeeks=26]
 * @param {number} [args.peakThresholdPct=0.90]
 * @returns {{
 *   band: 'NO_BLOCK' | 'SPARSE' | 'BLOCK_DENSITY' | 'PEAK_PHASE',
 *   weeks: Array<{weekStart:string, tss:number, isNearPeak:boolean}>,
 *   lifetimePeakTss: number,
 *   lifetimePeakWeekStart: string | null,
 *   nearPeakWeekCount: number,
 *   lookbackWeeksAnalyzed: number,
 *   nearPeakWeekRate: number,
 *   nearPeakThreshold: number,
 *   peakThresholdPct: number,
 *   citation: string,
 * } | null}
 */
export function analyzePeakWeekFrequency({
  log,
  today,
  lookbackWeeks = 26,
  peakThresholdPct = 0.90,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayDate = toDate(today === undefined ? new Date() : today)
  if (!todayDate) return null

  const safeLookback = Number.isFinite(lookbackWeeks) && lookbackWeeks > 0
    ? Math.floor(lookbackWeeks)
    : 26
  const safePct = Number.isFinite(peakThresholdPct) && peakThresholdPct > 0 && peakThresholdPct <= 1
    ? peakThresholdPct
    : 0.90

  const currentWeekMonday = mondayOfWeekUTC(todayDate)
  const currentWeekMondayIso = toIsoDate(currentWeekMonday)

  // Accumulate weekly TSS keyed by ISO date of Monday.
  const weeklySumByMonday = new Map()

  for (const e of log) {
    if (!e || !e.date) continue
    const dateStr = String(e.date).slice(0, 10)
    if (!ISO_RE.test(dateStr)) continue
    const tss = entryTss(e)
    if (tss <= 0) continue

    const d = new Date(dateStr + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) continue

    const monIso = toIsoDate(mondayOfWeekUTC(d))
    weeklySumByMonday.set(monIso, (weeklySumByMonday.get(monIso) || 0) + tss)
  }

  // Need at least MIN_DISTINCT_WEEKS distinct weeks of log history overall.
  if (weeklySumByMonday.size < MIN_DISTINCT_WEEKS) return null

  // lifetimePeakTss = max weekly TSS, EXCLUDING current week (may be partial).
  // Earliest tie wins.
  let lifetimePeakTss = 0
  let lifetimePeakWeekStart = null
  // Iterate in sorted-by-monIso order so the earliest tie naturally wins.
  const sortedEntries = Array.from(weeklySumByMonday.entries())
    .filter(([monIso]) => monIso !== currentWeekMondayIso)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  for (const [monIso, sum] of sortedEntries) {
    if (sum > lifetimePeakTss) {
      lifetimePeakTss = sum
      lifetimePeakWeekStart = monIso
    }
  }

  if (lifetimePeakTss <= 0) return null

  const nearPeakThreshold = lifetimePeakTss * safePct

  // Iterate over the last `lookbackWeeks` ISO weeks ENDING ONE WEEK BEFORE
  // currentWeekMonday (so the current partial week is excluded).
  // Most recent first → reverse to chronological for return.
  const weeks = []
  let nearPeakWeekCount = 0
  for (let i = 1; i <= safeLookback; i++) {
    const wk = new Date(currentWeekMonday.getTime())
    wk.setUTCDate(wk.getUTCDate() - 7 * i)
    const wkIso = toIsoDate(wk)
    const tss = weeklySumByMonday.get(wkIso) || 0
    const isNearPeak = tss > 0 && tss >= nearPeakThreshold
    if (isNearPeak) nearPeakWeekCount++
    weeks.push({ weekStart: wkIso, tss, isNearPeak })
  }

  // Chronological (oldest → newest) for the UI.
  weeks.reverse()

  const lookbackWeeksAnalyzed = safeLookback
  const nearPeakWeekRate = round4(nearPeakWeekCount / Math.max(lookbackWeeksAnalyzed, 1))

  let band
  if (nearPeakWeekCount === 0) band = 'NO_BLOCK'
  else if (nearPeakWeekCount <= 2) band = 'SPARSE'
  else if (nearPeakWeekCount <= 6) band = 'BLOCK_DENSITY'
  else band = 'PEAK_PHASE'

  // Round numeric outputs for stable UI.
  const round1 = v => Math.round(v * 10) / 10

  return {
    band,
    weeks,
    lifetimePeakTss: round1(lifetimePeakTss),
    lifetimePeakWeekStart,
    nearPeakWeekCount,
    lookbackWeeksAnalyzed,
    nearPeakWeekRate,
    nearPeakThreshold: round1(nearPeakThreshold),
    peakThresholdPct: safePct,
    citation: PEAK_WEEK_FREQUENCY_CITATION,
  }
}

export default analyzePeakWeekFrequency
