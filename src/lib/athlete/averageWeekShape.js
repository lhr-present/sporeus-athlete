// ─── averageWeekShape.js — Typical microcycle shape over trailing 8 weeks ─────
// Surfaces the athlete's TYPICAL weekly training rhythm: which weekdays they
// tend to train hardest, which are rest days. Pattern classification:
// WEEKEND_HEAVY, MIDWEEK_HEAVY, EVENLY_DISTRIBUTED, POLARIZED, MIXED.
//
// Pure — no React, no globals. `today` is required to make sliding window
// deterministic for tests; defaults to `new Date()`.
//
// Cite: Bompa 2018 (microcycle design); Issurin 2010 (within-week load
// distribution in block periodization).
// ─────────────────────────────────────────────────────────────────────────────

export const AVERAGE_WEEK_SHAPE_CITATION = 'Bompa 2018; Issurin 2010'

// Mon=0 ... Sun=6 (training-week convention; differs from JS getUTCDay)
const DAY_LABELS_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_LABELS_TR = ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ']

// ─── Helpers ────────────────────────────────────────────────────────────────
function toDate(input) {
  if (input instanceof Date) return new Date(input.getTime())
  if (typeof input === 'string') {
    // Accept 'YYYY-MM-DD' or full ISO
    return new Date(input.length === 10 ? input + 'T00:00:00Z' : input)
  }
  return new Date()
}

/** JS Sun=0..Sat=6 → Mon=0..Sun=6 */
function trainingDayIndex(date) {
  const js = date.getUTCDay() // 0=Sun..6=Sat
  return (js + 6) % 7         // Mon=0..Sun=6
}

/** Return UTC midnight of the most recent Sunday on or before `date`. */
function lastSundayUTC(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const js = d.getUTCDay() // 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() - js)
  return d
}

function mean(arr) {
  if (!arr.length) return 0
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

function stdev(arr) {
  const n = arr.length
  if (n === 0) return 0
  const m = mean(arr)
  let v = 0
  for (const x of arr) v += (x - m) * (x - m)
  return Math.sqrt(v / n)
}

// ─── Pattern classification ─────────────────────────────────────────────────
function classifyShape(avgTss) {
  // avgTss: array length 7, Mon=0..Sun=6
  const m = mean(avgTss)
  if (m <= 0) return 'MIXED'

  const weekdayAvg = mean(avgTss.slice(0, 5))           // Mon-Fri
  const weekendSum = avgTss[5] + avgTss[6]              // Sat + Sun
  const midweekSum = avgTss[2] + avgTss[3]              // Wed + Thu
  const monTueAvg  = (avgTss[0] + avgTss[1]) / 2
  const sd = stdev(avgTss)

  // EVENLY_DISTRIBUTED — stdev < 30% of mean. Checked first because by
  // definition no day deviates much; weekend/midweek "heavy" rules would
  // misfire when the load is actually flat across the week.
  if (sd < 0.3 * m) return 'EVENLY_DISTRIBUTED'

  // WEEKEND_HEAVY — combined Sat+Sun > 1.5 × weekday avg
  if (weekendSum > 1.5 * weekdayAvg) return 'WEEKEND_HEAVY'

  // MIDWEEK_HEAVY — Wed+Thu > 1.5 × Mon+Tue avg
  if (monTueAvg > 0 && midweekSum > 1.5 * monTueAvg) return 'MIDWEEK_HEAVY'
  if (monTueAvg === 0 && midweekSum > 0) return 'MIDWEEK_HEAVY'

  // POLARIZED — ≥2 days >1.5× mean AND ≥2 days <0.3× mean
  const highDays = avgTss.filter(v => v > 1.5 * m).length
  const lowDays  = avgTss.filter(v => v < 0.3 * m).length
  if (highDays >= 2 && lowDays >= 2) return 'POLARIZED'

  return 'MIXED'
}

// ─── analyzeAverageWeekShape ────────────────────────────────────────────────
/**
 * Compute the athlete's typical weekly microcycle shape over the trailing
 * `windowWeeks` (default 8). The window is anchored to the Monday of the
 * week containing `today` minus (windowWeeks-1) full weeks, ending at the
 * Sunday of `today`'s week.
 *
 * @param {Object}  args
 * @param {Array}   args.log          - session entries `{ date: 'YYYY-MM-DD', tss }`
 * @param {Date|string} [args.today]  - reference "now" (defaults to new Date())
 * @param {number} [args.windowWeeks=8]
 * @returns {{
 *   pattern: 'WEEKEND_HEAVY'|'MIDWEEK_HEAVY'|'EVENLY_DISTRIBUTED'|'POLARIZED'|'MIXED',
 *   days: Array<{ dayIndex: number, dayLabelEn: string, dayLabelTr: string, avgTss: number }>,
 *   peakDay: { dayIndex: number, dayLabelEn: string, dayLabelTr: string, avgTss: number },
 *   restDay: { dayIndex: number, dayLabelEn: string, dayLabelTr: string, avgTss: number },
 *   mean: number,
 *   citation: string
 * } | null}
 */
export function analyzeAverageWeekShape({ log, today, windowWeeks = 8 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  const N = Math.max(1, Math.floor(windowWeeks || 8))

  const todayDate = toDate(today || new Date())
  // Window ends at Sunday of today's training week (Mon-Sun)
  const lastSunday = lastSundayUTC(todayDate)
  // If today IS Sunday, lastSundayUTC returns same day → end-inclusive
  // If today is mid-week, the current (in-progress) week is EXCLUDED from
  // the trailing window so we look at completed weeks.
  // We want the *last N completed weeks*: end = Sunday before today's Mon.
  const todayTrainIdx = trainingDayIndex(todayDate)
  const lastCompletedSunday = new Date(lastSunday)
  if (todayTrainIdx !== 6) {
    // not Sunday → step back to previous Sunday (the most recent completed
    // week's Sun). lastSundayUTC already gave us that since today < Sun.
    // No-op.
  }
  // Compute window start: Monday of the oldest week in the N-week window.
  const windowEnd = new Date(lastCompletedSunday)
  const windowStart = new Date(windowEnd)
  windowStart.setUTCDate(windowStart.getUTCDate() - (N * 7 - 1))

  const startStr = windowStart.toISOString().slice(0, 10)
  const endStr   = windowEnd.toISOString().slice(0, 10)

  // Accumulate per-weekday TSS sums + count active weeks
  const sumByDay = [0, 0, 0, 0, 0, 0, 0]
  const activeWeekSet = new Set() // ISO date of week-start Monday containing the session
  let totalTss = 0

  for (const entry of log) {
    if (!entry || !entry.date) continue
    const dateStr = String(entry.date).slice(0, 10)
    if (dateStr < startStr || dateStr > endStr) continue
    const t = Number(entry.tss)
    if (!Number.isFinite(t) || t <= 0) continue

    const d = new Date(dateStr + 'T00:00:00Z')
    const idx = trainingDayIndex(d)
    sumByDay[idx] += t
    totalTss += t

    // Identify which week-of-window this falls into (0..N-1)
    const daysFromStart = Math.floor((d - windowStart) / 86400000)
    const weekIdx = Math.floor(daysFromStart / 7)
    activeWeekSet.add(weekIdx)
  }

  if (totalTss === 0) return null
  if (activeWeekSet.size < 4) return null

  // Average per-weekday across the FULL window (N weeks), not just active
  const avgTss = sumByDay.map(s => s / N)

  // Build day objects
  const days = avgTss.map((v, i) => ({
    dayIndex: i,
    dayLabelEn: DAY_LABELS_EN[i],
    dayLabelTr: DAY_LABELS_TR[i],
    avgTss: Math.round(v * 10) / 10,
  }))

  // Peak = max avgTss; rest = min (possibly zero). Ties → earliest weekday.
  let peakIdx = 0
  let restIdx = 0
  for (let i = 1; i < 7; i++) {
    if (avgTss[i] > avgTss[peakIdx]) peakIdx = i
    if (avgTss[i] < avgTss[restIdx]) restIdx = i
  }

  const pattern = classifyShape(avgTss)
  const overallMean = mean(avgTss)

  return {
    pattern,
    days,
    peakDay: days[peakIdx],
    restDay: days[restIdx],
    mean: Math.round(overallMean * 10) / 10,
    citation: AVERAGE_WEEK_SHAPE_CITATION,
  }
}

export default analyzeAverageWeekShape
