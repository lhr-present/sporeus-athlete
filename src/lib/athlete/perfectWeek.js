// ─── perfectWeek.js — Perfect-week ratio: structure (not just volume) ────────
//
// Counts how often the athlete's last 12 completed ISO weeks (Mon-Sun) hit
// ALL THREE quality criteria simultaneously:
//   1. sessionCount ≥ 3            — enough touches per week
//   2. hadHard      (RPE ≥ 7)      — at least one high-intensity session
//   3. hadLong      (≥ 90 min)     — at least one long aerobic session
//
// The "perfect week" is a structural construct, not a volume target. An
// athlete can ride 20 hours on the weekend (massive volume) and still miss
// the perfect-week criteria if no session crossed RPE 7. Tracking the rate
// surfaces *whether the right week SHAPE is the default* — which is what
// downstream adaptations actually need.
//
// References:
//   Hellard P. et al. (2019). Training-related risk of common illnesses in
//     elite swimmers over a 4-yr period: structure of the weekly load and
//     adaptation. Front Physiol 10:1485.
//   Seiler S. (2010). What is best practice for training intensity and
//     duration distribution in endurance athletes? IJSPP 5(3):276-291.
//
// Patterns:
//   HABITUAL_QUALITY  perfectRate ≥ 0.50  — structure is the default (green)
//   OCCASIONAL        0.20 ≤ rate < 0.50  — hits sometimes, misses often (blue)
//   SPORADIC          perfectRate < 0.20  — structure rarely lands (orange)
//
// Null gate: fewer than 6 of the 12 weeks have any sessions at all.
// ─────────────────────────────────────────────────────────────────────────────

export const PERFECT_WEEK_CITATION = 'Hellard 2019; Seiler 2010'

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function parseISO(dateStr) {
  return new Date(dateStr + 'T00:00:00Z')
}

function addDaysStr(dateStr, days) {
  const d = parseISO(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Day-of-week (Mon=1 .. Sun=7) — ISO 8601 numbering.
function isoDow(dateStr) {
  const d = parseISO(dateStr)
  const js = d.getUTCDay() // 0=Sun .. 6=Sat
  return js === 0 ? 7 : js
}

// Monday of the ISO week containing `dateStr` (returns YYYY-MM-DD).
function mondayOf(dateStr) {
  const dow = isoDow(dateStr)
  return addDaysStr(dateStr, -(dow - 1))
}

function entryDurationMin(entry) {
  const d = Number(entry?.durationMin ?? entry?.duration)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function entryRpe(entry) {
  const r = Number(entry?.rpe)
  return Number.isFinite(r) ? r : 0
}

function patternFor(rate) {
  if (rate >= 0.5) return 'HABITUAL_QUALITY'
  if (rate >= 0.2) return 'OCCASIONAL'
  return 'SPORADIC'
}

/**
 * Analyze "perfect weeks" across the trailing 12 completed ISO weeks (Mon-Sun)
 * ending in the week that contains `today`.
 *
 * Criteria per week:
 *   - sessionCount = number of sessions that week
 *   - hadHard      = any session with rpe ≥ 7
 *   - hadLong      = any session with durationMin ≥ 90
 *   - isPerfect    = sessionCount ≥ 3 AND hadHard AND hadLong
 *
 * @param {object} args
 * @param {Array}  args.log              - sessions with `date`, `rpe`, `durationMin`
 * @param {string} args.today            - YYYY-MM-DD reference date
 * @param {number} [args.windowWeeks=12] - number of trailing weeks
 * @returns {{
 *   pattern: 'HABITUAL_QUALITY'|'OCCASIONAL'|'SPORADIC',
 *   perfectRate: number,
 *   perfectWeeks: number,
 *   weeks: Array<{weekStart: string, sessionCount: number, hadHard: boolean, hadLong: boolean, isPerfect: boolean}>,
 *   mostCommonGap: 'sessions'|'hard'|'long'|null,
 *   citation: string
 * } | null}
 *
 * Returns null when fewer than 6 of the `windowWeeks` weeks have any sessions.
 */
export function analyzePerfectWeek({ log, today, windowWeeks = 12 } = {}) {
  if (!Array.isArray(log)) return null
  if (!today || typeof today !== 'string') return null
  if (!Number.isFinite(windowWeeks) || windowWeeks < 1) return null

  // Build the ordered list of week-start Mondays (oldest → newest).
  const thisMon = mondayOf(today)
  const startMon = addDaysStr(thisMon, -(windowWeeks - 1) * 7)
  const endSun = addDaysStr(thisMon, 6)

  const weekStarts = []
  for (let i = 0; i < windowWeeks; i++) {
    weekStarts.push(addDaysStr(startMon, i * 7))
  }

  // Bucket entries by their week-start Monday.
  const buckets = new Map()
  for (const ws of weekStarts) buckets.set(ws, [])

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    if (e.date < startMon || e.date > endSun) continue
    const ws = mondayOf(e.date)
    if (buckets.has(ws)) buckets.get(ws).push(e)
  }

  // Build per-week summaries.
  const weeks = weekStarts.map(ws => {
    const entries = buckets.get(ws) || []
    const sessionCount = entries.length
    let hadHard = false
    let hadLong = false
    for (const e of entries) {
      if (entryRpe(e) >= 7) hadHard = true
      if (entryDurationMin(e) >= 90) hadLong = true
    }
    const isPerfect = sessionCount >= 3 && hadHard && hadLong
    return { weekStart: ws, sessionCount, hadHard, hadLong, isPerfect }
  })

  // Null gate: fewer than 6 weeks with ANY sessions → not enough signal.
  const activeWeeks = weeks.filter(w => w.sessionCount > 0).length
  if (activeWeeks < 6) return null

  const perfectWeeks = weeks.filter(w => w.isPerfect).length
  const perfectRate = perfectWeeks / windowWeeks

  // Identify most common gap among NON-perfect weeks.
  let countMissingSessions = 0
  let countMissingHard = 0
  let countMissingLong = 0
  for (const w of weeks) {
    if (w.isPerfect) continue
    if (w.sessionCount < 3) countMissingSessions += 1
    if (!w.hadHard)         countMissingHard += 1
    if (!w.hadLong)         countMissingLong += 1
  }

  // Tie-break order: sessions → hard → long.
  let mostCommonGap = null
  if (perfectWeeks < windowWeeks) {
    const maxCount = Math.max(countMissingSessions, countMissingHard, countMissingLong)
    if (maxCount > 0) {
      if (countMissingSessions === maxCount) mostCommonGap = 'sessions'
      else if (countMissingHard === maxCount) mostCommonGap = 'hard'
      else mostCommonGap = 'long'
    }
  }

  return {
    pattern: patternFor(perfectRate),
    perfectRate,
    perfectWeeks,
    weeks,
    mostCommonGap,
    citation: PERFECT_WEEK_CITATION,
  }
}
