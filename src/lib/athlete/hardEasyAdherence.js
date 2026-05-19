// src/lib/athlete/hardEasyAdherence.js
//
// Hard/Easy Adherence — tracks *violations* of Daniels' (2014) hard-after-hard
// adjacency rule across the last 12 ISO weeks. Distinct from
// `hardDaySpacing.js` (which tracks mean spacing intervals between hard days)
// — this metric surfaces what % of weeks were "clean" (zero violations) given
// the athlete actually did hard work (≥ 2 hard days that week).
//
// Hard day = a calendar day where the day's *max-session TSS* (not sum)
// reaches `max(60, ctl × 0.9)`. The 60-TSS floor handles the CTL warmup
// period; once CTL is built up the threshold scales with chronic load so an
// elite athlete's "hard" stays meaningful.
//
// Violation = a (d, d+1) pair where both days are HARD. Counted only within
// the analysis window. A Sunday-Monday violation is attributed to the Sunday
// week (the *start* of the adjacency).
//
// Clean week = violations === 0 AND hardDays >= 2 (a week with 0 or 1 hard
// days is excluded from the denominator entirely — you can't "earn" cleanness
// without doing the work).
//
// Pure function. No React, no I/O.
//
// Citation:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Foster C. (2001). Monitoring training in athletes with reference to
//     overtraining syndrome. Med Sci Sports Exerc 30(7):1164-1168.

export const HARD_EASY_ADHERENCE_CITATION = 'Daniels 2014; Foster 2001'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const WINDOW_WEEKS_DEFAULT = 12
const CTL_HALFLIFE_DEFAULT = 42
const HARD_TSS_FLOOR = 60
const HARD_CTL_FRACTION = 0.9

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) return key
  }
  return null
}

function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoPlusDays(iso, days) {
  return isoMinusDays(iso, -days)
}

function classifyBand(cleanWeekRate, weeksAnalyzed) {
  if (cleanWeekRate >= 0.95 && weeksAnalyzed >= 4) return 'STRICT'
  if (cleanWeekRate >= 0.75) return 'GOOD'
  if (cleanWeekRate >= 0.50) return 'OCCASIONAL_VIOLATIONS'
  return 'CHRONIC_VIOLATIONS'
}

/**
 * Analyze hard/easy adherence over a rolling ISO-week window.
 *
 * @param {{
 *   log: Array<{ date: string, tss?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 *   ctlHalflifeDays?: number,
 * }} args
 * @returns {{
 *   band: 'STRICT' | 'GOOD' | 'OCCASIONAL_VIOLATIONS' | 'CHRONIC_VIOLATIONS',
 *   weeks: Array<{ weekStart: string, hardDays: number, violations: number }>,
 *   totalViolations: number,
 *   totalHardDays: number,
 *   cleanWeeks: number,
 *   weeksAnalyzed: number,
 *   cleanWeekRate: number,
 *   citation: string,
 * } | null}
 */
export function analyzeHardEasyAdherence({
  log,
  today,
  windowWeeks = WINDOW_WEEKS_DEFAULT,
  ctlHalflifeDays = CTL_HALFLIFE_DEFAULT,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(1, Math.floor(Number(windowWeeks) || WINDOW_WEEKS_DEFAULT))
  const safeHalflife = Math.max(1, Number(ctlHalflifeDays) || CTL_HALFLIFE_DEFAULT)

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, hardDays: 0, violations: 0 })
  }

  const windowStartIso = weeks[0].weekStart
  // Exclusive end = Monday of week AFTER current week.
  const windowEndExclusive = isoPlusDays(currentMonday, 7)

  if (!Array.isArray(log)) {
    return null
  }

  // ─── Build per-date max-TSS map across the entire log (we walk CTL from
  // earliest log entry, not just the window, so chronic load is accurate by
  // the time the window starts). ─────────────────────────────────────────────
  const daySumTss = new Map()    // date → sum of tss (drives CTL)
  const dayMaxTss = new Map()    // date → max single-session TSS (drives "hard" gate)
  let earliestDate = null
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const tss = Number(e.tss)
    if (!Number.isFinite(tss) || tss <= 0) continue
    daySumTss.set(key, (daySumTss.get(key) || 0) + tss)
    const prev = dayMaxTss.get(key) || 0
    if (tss > prev) dayMaxTss.set(key, tss)
    if (earliestDate === null || key < earliestDate) earliestDate = key
  }

  if (earliestDate === null) return null

  // ─── Walk CTL day-by-day from earliestDate up to last day of window
  // (the day before windowEndExclusive). For each date in window, decide
  // if it's a hard day using that day's max-session TSS vs the threshold.
  // ─────────────────────────────────────────────────────────────────────────
  const alpha = 1 - Math.exp(-1 / safeHalflife)
  const decay = Math.exp(-1 / safeHalflife)

  const windowLastIso = isoMinusDays(windowEndExclusive, 1)
  const walkStart = earliestDate < windowStartIso ? earliestDate : windowStartIso
  // The walk must extend through windowLastIso (or to today, whichever is
  // later). Safe upper bound: windowLastIso (today is always inside the
  // window since we anchored to its Monday).
  const walkEnd = windowLastIso

  const hardByDate = new Map() // date → true (only populated for in-window hard days)
  const weekIdxByStart = new Map()
  weeks.forEach((w, i) => weekIdxByStart.set(w.weekStart, i))

  let ctl = 0
  let cursor = walkStart
  // Safety: cap iterations defensively (avoid infinite loops on bad input).
  const MAX_ITERS = 20000
  let iters = 0
  while (cursor <= walkEnd && iters < MAX_ITERS) {
    iters++
    const daySum = daySumTss.get(cursor) || 0
    // CTL update: ctl_t = ctl_{t-1} * decay + tss_t * alpha
    ctl = ctl * decay + daySum * alpha

    // In-window classification.
    if (cursor >= windowStartIso && cursor < windowEndExclusive) {
      const threshold = Math.max(HARD_TSS_FLOOR, ctl * HARD_CTL_FRACTION)
      const maxTss = dayMaxTss.get(cursor) || 0
      if (maxTss >= threshold && maxTss > 0) {
        hardByDate.set(cursor, true)
        // Increment hardDays for the ISO week of this date.
        const wkStart = isoMondayOf(cursor)
        const idx = weekIdxByStart.get(wkStart)
        if (idx != null) weeks[idx].hardDays++
      }
    }
    cursor = isoPlusDays(cursor, 1)
  }

  // ─── Count adjacency violations in-window. A pair (d, d+1) where both are
  // hard counts as one violation, attributed to the ISO week of d (the
  // *first* of the pair). Both d and d+1 must lie in the window.
  // ─────────────────────────────────────────────────────────────────────────
  let totalViolations = 0
  let totalHardDays = 0
  for (const [date] of hardByDate) {
    totalHardDays++
    const next = isoPlusDays(date, 1)
    if (next >= windowEndExclusive) continue
    if (!hardByDate.has(next)) continue
    // Both in-window AND hard → violation
    totalViolations++
    const wkStart = isoMondayOf(date)
    const idx = weekIdxByStart.get(wkStart)
    if (idx != null) weeks[idx].violations++
  }

  // ─── Adherence stats — only weeks with ≥ 2 hard days count toward the
  // denominator. A "clean week" is such a week with zero violations.
  // ─────────────────────────────────────────────────────────────────────────
  let cleanWeeks = 0
  let weeksAnalyzed = 0
  for (const w of weeks) {
    if (w.hardDays >= 2) {
      weeksAnalyzed++
      if (w.violations === 0) cleanWeeks++
    }
  }

  if (weeksAnalyzed === 0) return null

  const cleanWeekRate = cleanWeeks / Math.max(weeksAnalyzed, 1)
  const cleanWeekRate4 = Math.round(cleanWeekRate * 10000) / 10000
  const band = classifyBand(cleanWeekRate, weeksAnalyzed)

  return {
    band,
    weeks: weeks.map(w => ({
      weekStart: w.weekStart,
      hardDays: w.hardDays,
      violations: w.violations,
    })),
    totalViolations,
    totalHardDays,
    cleanWeeks,
    weeksAnalyzed,
    cleanWeekRate: cleanWeekRate4,
    citation: HARD_EASY_ADHERENCE_CITATION,
  }
}

// Reverse compute helper — counts hard-by-d, then walks each by adjacency.
// (Implementation note: the loop over `hardByDate` does not give a
// deterministic order, but adjacency check is symmetric — we always look at
// "next day". Order does not affect totals.)
