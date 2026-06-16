// ─── longRunFrequency.js — Long-Session Frequency (6-Month Monthly Count) ────
//
// Endurance base-building requires REPEATED exposure to long sessions, not a
// single occasional outlier. Daniels (2014), Lydiard (1978) and Maffetone
// (2010) all anchor base development on the *cadence* of long sessions —
// typically one true long session per week, with a minimum-viable habit of
// ≥3 long sessions per month sustained over a multi-month base block.
//
// This module distills that into a per-calendar-month count of qualifying
// "long" sessions (durationMin ≥ longMinThreshold, default 90) across the
// last `monthsWindow` calendar months ending in `today`'s month. It is
// deliberately distinct from:
//
//   - longestSessionTrend.js  → MAX length of a session per week (length trend)
//   - longSessionShare.js     → SHARE of weekly volume in the long session
//
// `longRunFrequency` measures *frequency*: how many qualifying long sessions
// did the athlete actually complete each month? That's the cadence question.
//
// Bands (avgPerMonth across the 6-month window):
//   STRONG_BASE  avgPerMonth ≥ 3.0   — consistent ≥3 long sessions/mo
//   DEVELOPING   1.5 ≤ avgPerMonth < 3.0
//   THIN         avgPerMonth < 1.5
//
// Coverage gate: returns null when fewer than 3 of the 6 months contain
// ANY logged sessions (not just long ones — *any* sessions). A sparse log
// can't support a meaningful frequency read.
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Lydiard A., Gilmour G. (1978). Run to the Top. Hodder & Stoughton.
//   Maffetone P. (2010). The Big Book of Endurance Training and Racing.
// ─────────────────────────────────────────────────────────────────────────────

export const LONG_RUN_FREQUENCY_CITATION = 'Daniels 2014; Lydiard 1978; Maffetone 2010'

const DEFAULT_MONTHS_WINDOW = 6
const DEFAULT_LONG_MIN_THRESHOLD = 90
const STRONG_BASE_THRESHOLD = 3.0
const DEVELOPING_THRESHOLD = 1.5
const MIN_MONTHS_WITH_DATA = 3

// English 3-letter month labels — index 0 = JAN. The component re-localizes
// to Turkish where needed; we keep the canonical English labels here so the
// pure-fn output is locale-agnostic and trivially comparable in tests.
const MONTH_LABELS_EN = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function parseISO(dateStr) {
  return new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z')
}

function entryDurationMin(entry) {
  // Sanitizer stores duration in minutes as `duration`; accept that first.
  const raw = entry?.duration ?? entry?.durationMin ??
    (entry?.durationSec ? entry.durationSec / 60 : undefined)
  const d = Number(raw)
  return Number.isFinite(d) && d > 0 ? d : 0
}

// Returns 'YYYY-MM' for a Date instance.
function ymOf(date) {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  return `${y}-${m < 10 ? '0' : ''}${m}`
}

// Returns 'YYYY-MM' for a YYYY-MM-DD string. Returns null on invalid input.
function ymOfDateStr(dateStr) {
  if (typeof dateStr !== 'string' || dateStr.length < 7) return null
  const d = parseISO(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return ymOf(d)
}

function classifyBand(avgPerMonth) {
  if (avgPerMonth >= STRONG_BASE_THRESHOLD) return 'STRONG_BASE'
  if (avgPerMonth >= DEVELOPING_THRESHOLD) return 'DEVELOPING'
  return 'THIN'
}

/**
 * Analyze long-session frequency across the last `monthsWindow` calendar
 * months ending in `today`'s month.
 *
 * @param {object} args
 * @param {Array}  args.log                     - training_log entries (need `date`, `durationMin`)
 * @param {string} args.today                   - YYYY-MM-DD reference date
 * @param {number} [args.monthsWindow=6]        - number of trailing calendar months
 * @param {number} [args.longMinThreshold=90]   - minimum durationMin to count as a long session
 *
 * @returns {{
 *   band: 'STRONG_BASE'|'DEVELOPING'|'THIN',
 *   totalLongSessions: number,
 *   avgPerMonth: number,
 *   months: Array<{ month: string, monthLabel: string, count: number }>,
 *   longMinThreshold: number,
 *   citation: string
 * } | null}
 *
 * Returns null when:
 *   - log is not an array, OR
 *   - today is missing/invalid, OR
 *   - monthsWindow / longMinThreshold are not positive finite numbers, OR
 *   - fewer than 3 of the 6 months in the window contain ANY logged
 *     sessions (sparse log; no meaningful frequency read).
 */
export function analyzeLongRunFrequency({
  log,
  today,
  monthsWindow = DEFAULT_MONTHS_WINDOW,
  longMinThreshold = DEFAULT_LONG_MIN_THRESHOLD,
} = {}) {
  if (!Array.isArray(log)) return null
  if (!today || typeof today !== 'string') return null
  if (!Number.isFinite(monthsWindow) || monthsWindow < 1) return null
  if (!Number.isFinite(longMinThreshold) || longMinThreshold <= 0) return null

  const todayDate = parseISO(today)
  if (Number.isNaN(todayDate.getTime())) return null

  // Build the list of trailing calendar months (oldest first).
  const todayY = todayDate.getUTCFullYear()
  const todayM = todayDate.getUTCMonth() // 0-indexed
  const months = []
  for (let i = monthsWindow - 1; i >= 0; i--) {
    // Step back i months from today's month.
    const total = todayY * 12 + todayM - i
    const y = Math.floor(total / 12)
    const mIdx = ((total % 12) + 12) % 12
    const monthStr = `${y}-${mIdx + 1 < 10 ? '0' : ''}${mIdx + 1}`
    months.push({
      month: monthStr,
      monthLabel: MONTH_LABELS_EN[mIdx],
      monthIdx: mIdx,
      count: 0,
      anySessions: 0,
    })
  }
  const monthByKey = new Map(months.map(m => [m.month, m]))

  // Single pass — bucket each entry by its YYYY-MM.
  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const ym = ymOfDateStr(e.date)
    if (!ym) continue
    const bucket = monthByKey.get(ym)
    if (!bucket) continue
    const dur = entryDurationMin(e)
    if (dur <= 0) continue
    bucket.anySessions += 1
    if (dur >= longMinThreshold) bucket.count += 1
  }

  // Coverage gate: need ≥3 months in the window with ANY logged sessions.
  const monthsWithAnyData = months.filter(m => m.anySessions > 0).length
  if (monthsWithAnyData < MIN_MONTHS_WITH_DATA) return null

  const totalLongSessions = months.reduce((s, m) => s + m.count, 0)
  const avgPerMonth = Math.round((totalLongSessions / monthsWindow) * 100) / 100

  return {
    band: classifyBand(avgPerMonth),
    totalLongSessions,
    avgPerMonth,
    months: months.map(m => ({
      month: m.month,
      monthLabel: m.monthLabel,
      count: m.count,
    })),
    longMinThreshold,
    citation: LONG_RUN_FREQUENCY_CITATION,
  }
}
