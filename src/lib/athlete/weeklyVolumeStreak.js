// ─── weeklyVolumeStreak.js — Above-own-mean weekly volume streak tracker ─────
// Counts the LONGEST consecutive run of ISO weeks (in the last `lookbackWeeks`)
// where weekly TSS was ≥ the athlete's OWN 26-week mean weekly TSS.
//
// Self-referenced "good week" definition: a week ≥ athlete's own 26-week
// baseline. Streaks of these surface PERIODS of sustained training intent
// (block-style construction). This is more meaningful than absolute thresholds
// because what counts as "a lot" depends on the athlete's baseline.
//
// Why a separate card from StreakCard / PeakWeekFrequencyCard:
//   - StreakCard tracks daily logging streaks.
//   - PeakWeekFrequencyCard counts DENSITY of near-LIFETIME-peak weeks (the
//     ceiling).
//   - WeeklyVolumeStreak measures the LONGEST consecutive run of weeks above
//     the athlete's OWN AVERAGE — momentum relative to the athlete's normal,
//     not relative to their lifetime ceiling.
//
// Bands:
//   NO_STREAK        — ≤1 longest consecutive (no real momentum)
//   BUILDING         — 2–3 consecutive weeks above own mean
//   STRONG_MOMENTUM  — 4–6 consecutive weeks above own mean
//   PEAK_BLOCK       — >6 consecutive weeks above own mean (sustained block)
//
// Pure — no React, no globals.
//
// Cite: Bompa 2018 — periodization, momentum and consecutive on-target weeks
//       signal training momentum; Issurin 2010 — block periodization
//       concentrated loading windows.
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKLY_VOLUME_STREAK_CITATION = 'Bompa 2018; Issurin 2010'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

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

function round2(v) {
  return Math.round(v * 100) / 100
}

// ─── analyzeWeeklyVolumeStreak ──────────────────────────────────────────────
/**
 * @param {Object} args
 * @param {Array<{date:string, tss?:number}>} args.log
 * @param {Date|string} [args.today]
 * @param {number} [args.lookbackWeeks=26]
 * @returns {{
 *   band: 'NO_STREAK' | 'BUILDING' | 'STRONG_MOMENTUM' | 'PEAK_BLOCK',
 *   baselineTss: number,
 *   longestStreakWeeks: number,
 *   currentStreakWeeks: number,
 *   totalAtOrAboveWeeks: number,
 *   weeks: Array<{weekStart:string, tss:number, aboveBaseline:boolean}>,
 *   citation: string,
 * } | null}
 */
export function analyzeWeeklyVolumeStreak({
  log,
  today,
  lookbackWeeks = 26,
} = {}) {
  if (!Array.isArray(log)) return null

  const todayDate = toDate(today === undefined ? new Date() : today)
  if (!todayDate) return null

  const safeLookback = Number.isFinite(lookbackWeeks) && lookbackWeeks > 0
    ? Math.floor(lookbackWeeks)
    : 26

  const currentWeekMonday = mondayOfWeekUTC(todayDate)

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

  // Iterate over the last `lookbackWeeks` ISO weeks ENDING ONE WEEK BEFORE
  // currentWeekMonday (so the current partial week is excluded). Build
  // chronological (oldest → newest) array.
  const weeks = []
  for (let i = safeLookback; i >= 1; i--) {
    const wk = new Date(currentWeekMonday.getTime())
    wk.setUTCDate(wk.getUTCDate() - 7 * i)
    const wkIso = toIsoDate(wk)
    const tss = weeklySumByMonday.get(wkIso) || 0
    weeks.push({ weekStart: wkIso, tss, aboveBaseline: false })
  }

  // baselineTss = mean tss across all iterated weeks (zero weeks INCLUDED).
  const sumTss = weeks.reduce((acc, w) => acc + w.tss, 0)
  const baselineTss = round2(sumTss / Math.max(weeks.length, 1))
  if (baselineTss === 0) return null

  // Mark aboveBaseline (tss ≥ baseline counts as above).
  for (const w of weeks) {
    w.aboveBaseline = w.tss >= baselineTss
  }

  // Longest consecutive aboveBaseline run.
  let longestStreakWeeks = 0
  let run = 0
  for (const w of weeks) {
    if (w.aboveBaseline) {
      run++
      if (run > longestStreakWeeks) longestStreakWeeks = run
    } else {
      run = 0
    }
  }

  // Current streak: consecutive aboveBaseline weeks ENDING at the last index.
  let currentStreakWeeks = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].aboveBaseline) currentStreakWeeks++
    else break
  }

  const totalAtOrAboveWeeks = weeks.reduce(
    (acc, w) => acc + (w.aboveBaseline ? 1 : 0),
    0
  )

  let band
  if (longestStreakWeeks <= 1) band = 'NO_STREAK'
  else if (longestStreakWeeks <= 3) band = 'BUILDING'
  else if (longestStreakWeeks <= 6) band = 'STRONG_MOMENTUM'
  else band = 'PEAK_BLOCK'

  return {
    band,
    baselineTss,
    longestStreakWeeks,
    currentStreakWeeks,
    totalAtOrAboveWeeks,
    weeks,
    citation: WEEKLY_VOLUME_STREAK_CITATION,
  }
}

export default analyzeWeeklyVolumeStreak
