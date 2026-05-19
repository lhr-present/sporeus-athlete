// ─── dayOfWeekAvailability.js — Weekday availability over last 12 weeks ─────
// Surfaces the athlete's TRAINING FREQUENCY per day-of-week: % of Mondays
// trained, % of Tuesdays trained, etc., over the trailing 12 completed weeks.
// Reveals "anchor days" (always trained) vs "weak days" (often missed) so
// coaches/athletes can plan around realistic availability.
//
// Distinct from averageWeekShape (typical TSS load per day) — this is purely
// frequency: did a session happen on that weekday at all?
//
// Pure — no React, no globals. `today` is required to make the sliding window
// deterministic for tests; defaults to `new Date()`.
//
// Cite: Bompa 2018 (microcycle availability); Issurin 2010 (block
// periodization weekly scheduling).
// ─────────────────────────────────────────────────────────────────────────────

export const DAY_OF_WEEK_AVAILABILITY_CITATION = 'Bompa 2018; Issurin 2010'

// Mon=0 ... Sun=6 (training-week convention; differs from JS getUTCDay)
const DAY_LABELS_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_LABELS_TR = ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ']

const ANCHOR_THRESHOLD = 0.75 // rate ≥ 0.75 → anchor day
const WEAK_THRESHOLD   = 0.25 // rate ≤ 0.25 → weak day
const SPARSE_THRESHOLD = 0.30 // averageRate < 0.30 → SPARSE
const MIN_ACTIVE_WEEKS = 6    // need ≥6 of 12 weeks with sessions

// ─── Helpers ────────────────────────────────────────────────────────────────
function toDate(input) {
  if (input instanceof Date) return new Date(input.getTime())
  if (typeof input === 'string') {
    return new Date(input.length === 10 ? input + 'T00:00:00Z' : input)
  }
  return new Date()
}

/** JS Sun=0..Sat=6 → Mon=0..Sun=6 */
function trainingDayIndex(date) {
  const js = date.getUTCDay() // 0=Sun..6=Sat
  return (js + 6) % 7         // Mon=0..Sun=6
}

function mean(arr) {
  if (!arr.length) return 0
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

// ─── Pattern classification ─────────────────────────────────────────────────
function classifyPattern(rates, anchorCount, weakCount, avg) {
  // STRUCTURED — ≥3 anchor days AND ≥1 weak day
  if (anchorCount >= 3 && weakCount >= 1) return 'STRUCTURED'
  // SPARSE — overall frequency is low
  if (avg < SPARSE_THRESHOLD) return 'SPARSE'
  // OPPORTUNISTIC — training happens but without clear weekly anchors
  return 'OPPORTUNISTIC'
}

// ─── analyzeDayOfWeekAvailability ───────────────────────────────────────────
/**
 * Compute the percent-of-weeks-trained for each day-of-week over the trailing
 * `windowWeeks` completed ISO weeks (Mon-Sun) ending in the week containing
 * `today`.
 *
 * @param {Object}  args
 * @param {Array}   args.log              - session entries with `date`
 * @param {Date|string} [args.today]      - reference "now"
 * @param {number} [args.windowWeeks=12]
 * @returns {{
 *   pattern: 'STRUCTURED'|'OPPORTUNISTIC'|'SPARSE',
 *   days: Array<{ dayIndex: number, dayLabelEn: string, dayLabelTr: string, count: number, rate: number }>,
 *   anchorDays: Array<{ dayIndex: number, dayLabelEn: string, dayLabelTr: string, count: number, rate: number }>,
 *   weakDays:   Array<{ dayIndex: number, dayLabelEn: string, dayLabelTr: string, count: number, rate: number }>,
 *   averageRate: number,
 *   weeksInWindow: number,
 *   citation: string
 * } | null}
 */
export function analyzeDayOfWeekAvailability({ log, today, windowWeeks = 12 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  const N = Math.max(1, Math.floor(windowWeeks || 12))

  const todayDate = toDate(today || new Date())

  // Window end = Sunday of the ISO week containing `today` (Mon-Sun).
  // Per spec: "last 12 completed ISO weeks (Mon-Sun) ending in week containing today".
  // We use the Sunday of `today`'s own training week as inclusive end so a
  // session logged earlier this week is still counted.
  const todayIdx = trainingDayIndex(todayDate)
  const todayUtc = new Date(Date.UTC(
    todayDate.getUTCFullYear(),
    todayDate.getUTCMonth(),
    todayDate.getUTCDate(),
  ))
  // Monday of today's week:
  const mondayThisWeek = new Date(todayUtc)
  mondayThisWeek.setUTCDate(mondayThisWeek.getUTCDate() - todayIdx)
  // Sunday of today's week (window end):
  const windowEnd = new Date(mondayThisWeek)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 6)
  // Monday of the oldest week in the N-week window:
  const windowStart = new Date(mondayThisWeek)
  windowStart.setUTCDate(windowStart.getUTCDate() - (N - 1) * 7)

  const startStr = windowStart.toISOString().slice(0, 10)
  const endStr   = windowEnd.toISOString().slice(0, 10)

  // For each weekday, collect the SET of unique dates within the window that
  // had at least one session. We count unique dates so two sessions on the
  // same Monday count as one trained Monday.
  const dateSetByDay = [new Set(), new Set(), new Set(), new Set(),
                       new Set(), new Set(), new Set()]
  const activeWeekSet = new Set()

  for (const entry of log) {
    if (!entry || !entry.date) continue
    const dateStr = String(entry.date).slice(0, 10)
    if (dateStr < startStr || dateStr > endStr) continue

    const d = new Date(dateStr + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) continue

    const idx = trainingDayIndex(d)
    dateSetByDay[idx].add(dateStr)

    // Week index 0..N-1 from windowStart
    const daysFromStart = Math.floor((d - windowStart) / 86400000)
    if (daysFromStart >= 0 && daysFromStart < N * 7) {
      activeWeekSet.add(Math.floor(daysFromStart / 7))
    }
  }

  if (activeWeekSet.size < MIN_ACTIVE_WEEKS) return null

  const weeksInWindow = N
  const counts = dateSetByDay.map(s => s.size)
  const rates  = counts.map(c => c / weeksInWindow)

  const days = rates.map((rate, i) => ({
    dayIndex: i,
    dayLabelEn: DAY_LABELS_EN[i],
    dayLabelTr: DAY_LABELS_TR[i],
    count: counts[i],
    rate: Math.round(rate * 10000) / 10000,
  }))

  const anchorDays = days.filter(d => d.rate >= ANCHOR_THRESHOLD)
  const weakDays   = days.filter(d => d.rate <= WEAK_THRESHOLD)
  const averageRate = mean(rates)

  const pattern = classifyPattern(rates, anchorDays.length, weakDays.length, averageRate)

  return {
    pattern,
    days,
    anchorDays,
    weakDays,
    averageRate: Math.round(averageRate * 10000) / 10000,
    weeksInWindow,
    citation: DAY_OF_WEEK_AVAILABILITY_CITATION,
  }
}

export default analyzeDayOfWeekAvailability
