// ─── lib/athlete/workoutDeviation.js — 28-day actual vs planned TSS adherence ─
//
// Rolling actual-vs-planned TSS adherence over the last N days (default 28).
// Distinct from `planAdherence.js` (which buckets compliance week-by-week and
// caps at 150% per week): this is a single rolling-window adherence percent
// with science-backed adherence bands.
//
// Foster 2001 (session-RPE / training load) + Hopkins 2002 (probabilistic
// thresholds for athletic outcomes) — internal-load adherence is the strongest
// predictor of fitness outcomes; tracking the ratio over a ~4-week window is
// the standard application.
//
// Bands (% = actual / planned * 100, rounded):
//   ≥111 → SURPLUS    (overshooting plan — risk equal to undershooting)
//   ≥ 90 → EXCELLENT
//   ≥ 75 → GOOD
//   ≥ 60 → MODERATE
//   < 60 → POOR
//
// Plan iteration matches `getTodayPlannedSession` (intelligence.js):
//   - plan.weeks[weekIdx].sessions[dayIdx] where dayIdx is Mon=0 … Sun=6.
//   - weekIdx = floor((day - plan.generatedAt) / 7).
//   - Sessions out of range (weekIdx >= plan.weeks.length, or weekIdx < 0)
//     contribute 0 planned TSS.
// Pure: no React, no I/O, no Date.now() reads.

export const WORKOUT_DEVIATION_CITATION = 'Foster 2001; Hopkins 2002'

function parseISO(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function isoOf(d) {
  return d.toISOString().slice(0, 10)
}

function bandOf(pct) {
  if (pct > 110) return 'SURPLUS'
  if (pct >= 90) return 'EXCELLENT'
  if (pct >= 75) return 'GOOD'
  if (pct >= 60) return 'MODERATE'
  return 'POOR'
}

/**
 * Compute rolling 28-day actual vs planned TSS adherence.
 *
 * @param {Object}  args
 * @param {Array}   args.log         training log entries [{ date, tss }]
 * @param {Object}  args.plan        plan with { generatedAt, weeks:[{ sessions:[{tss}] }] }
 * @param {string}  args.today       'YYYY-MM-DD' anchor for the rolling window
 * @param {number}  [args.windowDays=28]
 * @returns {{
 *   actualTss: number,
 *   plannedTss: number,
 *   adherencePct: number,
 *   band: 'EXCELLENT'|'GOOD'|'MODERATE'|'POOR'|'SURPLUS',
 *   daysCounted: number,
 *   citation: string,
 * } | null}
 *   null when:
 *     - plan missing or has no weeks/generatedAt
 *     - log empty or has no entries in window
 *     - planned TSS in window is 0
 */
export function computeWorkoutDeviation({ log, plan, today, windowDays = 28 } = {}) {
  if (!plan || typeof plan !== 'object') return null
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : null
  if (!weeks || weeks.length === 0) return null
  const generatedAt = plan.generatedAt || plan.start_date
  if (!generatedAt) return null

  const planStart = parseISO(generatedAt)
  if (!planStart) return null

  const todayD = parseISO(today)
  if (!todayD) return null

  const win = Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 28

  // Window: last `win` days INCLUDING today → [today - (win-1), today].
  const safeLog = Array.isArray(log) ? log : []
  if (safeLog.length === 0) return null

  const windowStart = new Date(todayD.getTime() - (win - 1) * 86400000)
  const windowStartMs = windowStart.getTime()
  const windowEndMs   = todayD.getTime()

  // ── Actual TSS: sum log entries with date in window ──
  let actualTss = 0
  let logEntriesInWindow = 0
  for (const e of safeLog) {
    if (!e || typeof e !== 'object') continue
    const d = parseISO((e.date || '').slice(0, 10))
    if (!d) continue
    const t = d.getTime()
    if (t < windowStartMs || t > windowEndMs) continue
    const tss = Number(e.tss)
    if (Number.isFinite(tss)) actualTss += tss
    logEntriesInWindow += 1
  }
  if (logEntriesInWindow === 0) return null

  // ── Planned TSS: iterate each day in window, look up plan session ──
  let plannedTss = 0
  let daysCounted = 0
  for (let i = 0; i < win; i++) {
    const dayMs = windowStartMs + i * 86400000
    const dayD = new Date(dayMs)
    const daysFromPlanStart = Math.floor((dayMs - planStart.getTime()) / 86400000)
    if (daysFromPlanStart < 0) continue
    const weekIdx = Math.floor(daysFromPlanStart / 7)
    if (weekIdx >= weeks.length) continue
    const week = weeks[weekIdx]
    if (!week || !Array.isArray(week.sessions)) continue
    // dayIdx: Mon=0 … Sun=6
    const dayIdx = (dayD.getUTCDay() + 6) % 7
    const session = week.sessions[dayIdx]
    if (!session) continue
    const sessTss = Number(session.tss)
    if (Number.isFinite(sessTss) && sessTss > 0) {
      plannedTss += sessTss
    }
    daysCounted += 1
  }

  if (plannedTss <= 0) return null

  const adherencePct = Math.round(100 * actualTss / plannedTss)
  const band = bandOf(adherencePct)

  return {
    actualTss: Math.round(actualTss),
    plannedTss: Math.round(plannedTss),
    adherencePct,
    band,
    daysCounted,
    citation: WORKOUT_DEVIATION_CITATION,
    // expose window anchor so card can label the range without re-parsing today
    windowStart: isoOf(windowStart),
    windowEnd: isoOf(todayD),
  }
}
