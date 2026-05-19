// ─── calendarHoles.js — Multi-day gap detection (90d window) ─────────────────
// Detects training gaps in the last 90 days. Distinct from streak cards (which
// only track the *current* streak): this counts ALL gaps ≥3 consecutive zero-
// training days inside the window, identifies the longest gap, and reports the
// 7-day TSS load both BEFORE and AFTER each gap.
//
// Why before+after TSS? Foster 2017 reflects on long-term training-monotony
// findings: gaps interact with load. A 5-day hole sandwiched between a heavy
// pre-gap week and a heavy post-gap ramp is the classic overuse / re-injury
// setup. Soligard 2016 ("How much is too much?") frames the gap → spike
// pattern as the dominant injury-risk signature in week-to-week load.
//
// Activity definition: a day is ACTIVE if ANY log entry for that date has
// tss > 0 OR duration_min > 0 OR distance_km > 0. A session-of-any-kind counts
// as activity (a 20-min easy spin with no TSS still breaks a hole).
//
// Citations:
//   Foster C. et al. (2017). 25 years of session rating of perceived
//     exertion: historical perspective and development. Int J Sports Physiol
//     Perform 12(s2).
//   Soligard T. et al. (2016). How much is too much? (Part 1) International
//     Olympic Committee consensus statement on load in sport and risk of
//     injury. Br J Sports Med 50(17):1030-1041.
// ─────────────────────────────────────────────────────────────────────────────

export const CALENDAR_HOLES_CITATION = 'Foster 2017; Soligard 2016'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function toIso(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    // Accept "YYYY-MM-DD" or any ISO-prefix string
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (
      !Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) ||
      mo < 1 || mo > 12 || d < 1 || d > 31
    ) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    if (Number.isNaN(dt.getTime())) return null
    // Reject e.g. Feb 30 silently rolling forward
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) return null
    return dt.toISOString().slice(0, 10)
  }
  return null
}

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Activity check ──────────────────────────────────────────────────────────
function isActiveEntry(e) {
  if (!e || typeof e !== 'object') return false
  const tss = Number(e.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  const dur = Number(e.duration_min ?? e.durationMin ?? e.duration)
  if (Number.isFinite(dur) && dur > 0) return true
  const dist = Number(e.distance_km ?? e.distanceKm ?? e.distance)
  if (Number.isFinite(dist) && dist > 0) return true
  return false
}

// Round to 4 decimal places
function round4(n) {
  return Math.round(n * 10000) / 10000
}

// ─── Band classification ─────────────────────────────────────────────────────
function classifyBand(totalHoles, longestHoleDays) {
  // CLEAN:            ≤1 hole AND longest ≤5
  // FRAGMENTED:       ≥4 holes OR longest >7
  // OCCASIONAL_HOLES: everything else
  // (Spec wording listed OCCASIONAL as "≤3 OR ≤7" but FRAGMENTED's
  //  "otherwise (≥4 holes OR longest > 7)" is the load-bearing rule;
  //  taking the complement gives OCCASIONAL = ≤3 AND ≤7 AND not CLEAN.)
  if (totalHoles <= 1 && longestHoleDays <= 5) return 'CLEAN'
  if (totalHoles >= 4 || longestHoleDays > 7) return 'FRAGMENTED'
  return 'OCCASIONAL_HOLES'
}

// ─── analyzeCalendarHoles ────────────────────────────────────────────────────
/**
 * Detect multi-day training gaps in a trailing window.
 *
 * @param {object} options
 * @param {Array}  options.log        - training log entries
 * @param {Date|string} options.today - reference "today"
 * @param {number} [options.windowDays=90]
 * @param {number} [options.minGapDays=3]
 * @returns {{
 *   band: 'CLEAN'|'OCCASIONAL_HOLES'|'FRAGMENTED',
 *   holes: Array<{ startDate, endDate, lengthDays, precededBy7dTss, followedBy7dTss }>,
 *   totalHoles: number,
 *   longestHoleDays: number,
 *   totalGapDays: number,
 *   activeDayRatio: number,
 *   citation: string,
 * } | null}
 */
export function analyzeCalendarHoles({
  log,
  today,
  windowDays = 90,
  minGapDays = 3,
} = {}) {
  const todayIso = toIso(today)
  if (!todayIso) return null
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null
  if (!Number.isFinite(minGapDays) || minGapDays < 1) return null

  const logArr = Array.isArray(log) ? log : []
  const windowStart = addDaysIso(todayIso, -(windowDays - 1))

  // Bucket entries by ISO date — store activity flag + TSS sum per day.
  // We also need to consult dates *outside* the window for the pre/post-7d
  // TSS sums (spec: "clamp to window start" for pre; "clamp to today" for post).
  const dayActive = new Map()  // date → bool
  const dayTss    = new Map()  // date → number
  for (const e of logArr) {
    const dIso = toIso(e?.date)
    if (!dIso) continue
    if (isActiveEntry(e)) {
      dayActive.set(dIso, true)
    } else if (!dayActive.has(dIso)) {
      dayActive.set(dIso, false)
    }
    const tss = Number(e?.tss)
    if (Number.isFinite(tss) && tss > 0) {
      dayTss.set(dIso, (dayTss.get(dIso) || 0) + tss)
    }
  }

  // Build the active flag array for the window in chronological order.
  const dates = []
  const active = []
  for (let i = 0; i < windowDays; i++) {
    const iso = addDaysIso(windowStart, i)
    dates.push(iso)
    active.push(dayActive.get(iso) === true)
  }

  // Find maximal consecutive inactive runs inside the window.
  const holes = []
  let runStart = -1
  for (let i = 0; i < active.length; i++) {
    if (!active[i]) {
      if (runStart === -1) runStart = i
      // last index OR next day active → close run
      if (i === active.length - 1 || active[i + 1]) {
        const length = i - runStart + 1
        if (length >= minGapDays) {
          const startDate = dates[runStart]
          const endDate   = dates[i]

          // precededBy7dTss = sum over [startDate - 7 .. startDate - 1],
          // clamped to window start (skip days before windowStart).
          let preTss = 0
          for (let k = 7; k >= 1; k--) {
            const iso = addDaysIso(startDate, -k)
            if (iso < windowStart) continue
            preTss += dayTss.get(iso) || 0
          }

          // followedBy7dTss = sum over [endDate + 1 .. endDate + 7],
          // clamped to today (skip days after todayIso).
          let postTss = 0
          for (let k = 1; k <= 7; k++) {
            const iso = addDaysIso(endDate, k)
            if (iso > todayIso) break
            postTss += dayTss.get(iso) || 0
          }

          holes.push({
            startDate,
            endDate,
            lengthDays: length,
            precededBy7dTss: Math.round(preTss * 100) / 100,
            followedBy7dTss: Math.round(postTss * 100) / 100,
          })
        }
        runStart = -1
      }
    }
  }

  // Sort oldest-first by startDate (already in order from the linear scan, but
  // be explicit for safety).
  holes.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))

  const totalHoles      = holes.length
  const longestHoleDays = holes.reduce((m, h) => Math.max(m, h.lengthDays), 0)
  const totalGapDays    = holes.reduce((s, h) => s + h.lengthDays, 0)
  const activeDayRatio  = round4((windowDays - totalGapDays) / windowDays)
  const band            = classifyBand(totalHoles, longestHoleDays)

  return {
    band,
    holes,
    totalHoles,
    longestHoleDays,
    totalGapDays,
    activeDayRatio,
    citation: CALENDAR_HOLES_CITATION,
  }
}
