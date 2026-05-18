// ─── longestSessionTrend.js — Longest Weekly Session 12-Week Trend ───────────
//
// For endurance athletes building toward a marathon / gran fondo / long-
// distance event, the "longest weekly session" is the single best
// indicator of aerobic-base development. Daniels (2014) and Lydiard
// (1978) both anchor the macrocycle around progressive long-run growth,
// and Maffetone (2010) frames the same idea in HR-controlled terms:
// the long, slow distance is the engine that builds capillary density,
// mitochondrial enzymes, and fatigue-resistance.
//
// This module looks across the trailing 12 ISO weeks ending in the week
// that contains `today`, finds the longest single-session duration in
// each week, and compares the early third (weeks 0–3) to the recent
// third (weeks 9–11) to classify the trend:
//
//   delta = (recentAvg − earlyAvg) / earlyAvg  (when earlyAvg > 0)
//
//   delta ≥ +0.10 → GROWING   (long-session base expanding)
//   |delta| < 0.10 → STABLE   (capacity steady; nudge upward to keep building)
//   delta ≤ -0.10 → SHRINKING (long-session base drifting; check schedule)
//
// Special case: if `earlyAvg = 0` but `recentAvg > 0`, the athlete is
// laying down a fresh base — that counts as STABLE rather than null
// (we can't compute a % delta against zero but the situation is healthy).
// In that case `delta` is returned as `null`.
//
// Returns null when fewer than 6 of the 12 weeks contain any sessions —
// too sparse to support any directional read.
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Lydiard A., Gilmour G. (1978). Run to the Top. Hodder & Stoughton.
//   Maffetone P. (2010). The Big Book of Endurance Training and Racing.
// ─────────────────────────────────────────────────────────────────────────────

export const LONGEST_SESSION_TREND_CITATION = 'Daniels 2014; Lydiard 1978'

const WINDOW_WEEKS_DEFAULT = 12
const MIN_ACTIVE_WEEKS = 6
const GROWING_THRESHOLD = 0.10
const SHRINKING_THRESHOLD = -0.10

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function parseISO(dateStr) {
  return new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z')
}

function addDaysStr(dateStr, days) {
  const d = parseISO(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ISO day-of-week: Mon=1 .. Sun=7.
function isoDow(dateStr) {
  const d = parseISO(dateStr)
  const js = d.getUTCDay()  // 0=Sun .. 6=Sat
  return js === 0 ? 7 : js
}

// Monday of the ISO week containing `dateStr` (returns YYYY-MM-DD).
function mondayOf(dateStr) {
  const dow = isoDow(dateStr)
  return addDaysStr(dateStr, -(dow - 1))
}

function entryDurationMin(entry) {
  const d = Number(entry?.durationMin)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function classifyBand(delta, earlyAvg, recentAvg) {
  // Early third has no data but recent third does → fresh base building.
  if (earlyAvg <= 0 && recentAvg > 0) return 'STABLE'
  if (delta == null) return null
  if (delta >= GROWING_THRESHOLD) return 'GROWING'
  if (delta <= SHRINKING_THRESHOLD) return 'SHRINKING'
  return 'STABLE'
}

/**
 * Analyze the trend of the longest weekly session over a trailing
 * 12-week (or `windowWeeks`-week) window ending in the week containing
 * `today`.
 *
 * @param {object} args
 * @param {Array}  args.log         - training_log entries (need `date`, `durationMin`)
 * @param {string} args.today       - YYYY-MM-DD reference date
 * @param {number} [args.windowWeeks=12] - number of trailing weeks
 *
 * @returns {{
 *   band: 'GROWING'|'STABLE'|'SHRINKING',
 *   delta: number | null,
 *   weeks: Array<{ weekStart: string, longestMin: number }>,
 *   peakWeek: string,
 *   peakMin: number,
 *   recentAvg: number,
 *   earlyAvg: number,
 *   citation: string
 * } | null}
 */
export function analyzeLongestSessionTrend({ log, today, windowWeeks = WINDOW_WEEKS_DEFAULT } = {}) {
  if (!Array.isArray(log)) return null
  if (!today || typeof today !== 'string') return null
  if (!Number.isFinite(windowWeeks) || windowWeeks < 3) return null

  // Build the per-week buckets (Mon-Sun) for the trailing `windowWeeks` window.
  const thisMon = mondayOf(today)
  const weekStarts = []
  for (let i = windowWeeks - 1; i >= 0; i--) {
    weekStarts.push(addDaysStr(thisMon, -i * 7))
  }
  const startMon = weekStarts[0]
  const endSun = addDaysStr(thisMon, 6)

  // Initialize buckets with longestMin = 0 for every week.
  const buckets = new Map()
  for (const ws of weekStarts) buckets.set(ws, 0)

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const d = String(e.date).slice(0, 10)
    if (d < startMon || d > endSun) continue
    const dur = entryDurationMin(e)
    if (dur <= 0) continue
    const ws = mondayOf(d)
    const prev = buckets.get(ws)
    if (prev === undefined) continue
    if (dur > prev) buckets.set(ws, dur)
  }

  const weeks = weekStarts.map(ws => ({
    weekStart: ws,
    longestMin: buckets.get(ws) || 0,
  }))

  // Coverage gate: need at least MIN_ACTIVE_WEEKS weeks with any sessions.
  const activeWeeks = weeks.filter(w => w.longestMin > 0).length
  if (activeWeeks < MIN_ACTIVE_WEEKS) return null

  // Compute early third (first 4 of 12 → indices 0-3) vs recent third
  // (last 4 of 12 → indices 9-11). We follow the spec literally: 4
  // early weeks (0..3) and 3 recent weeks (9..11). For other window
  // sizes we proportionally take the first 25% and last 25%, with a
  // floor of 2 weeks per slice.
  const earlySlice = weeks.slice(0, weeks.length === 12 ? 4 : Math.max(2, Math.floor(weeks.length / 3)))
  const recentSlice = weeks.slice(weeks.length === 12 ? 9 : weeks.length - Math.max(2, Math.floor(weeks.length / 3)))

  const avgOf = arr => arr.reduce((s, w) => s + (w.longestMin || 0), 0) / arr.length
  const earlyAvg = avgOf(earlySlice)
  const recentAvg = avgOf(recentSlice)

  let delta = null
  if (earlyAvg > 0) {
    delta = (recentAvg - earlyAvg) / earlyAvg
  }
  const band = classifyBand(delta, earlyAvg, recentAvg)
  if (!band) return null

  // Peak identification — first week with the maximum longestMin.
  let peakMin = 0
  let peakWeek = weeks[0].weekStart
  for (const w of weeks) {
    if (w.longestMin > peakMin) {
      peakMin = w.longestMin
      peakWeek = w.weekStart
    }
  }

  return {
    band,
    delta,
    weeks,
    peakWeek,
    peakMin,
    recentAvg,
    earlyAvg,
    citation: LONGEST_SESSION_TREND_CITATION,
  }
}
