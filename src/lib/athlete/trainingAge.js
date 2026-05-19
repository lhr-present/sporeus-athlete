// src/lib/athlete/trainingAge.js
//
// Training Age — cumulative weeks of consistent training as a context lens
// for which physiology principles apply to a given athlete.
//
// Background:
//   Bompa & Buzzichelli (2018) "Periodization: Theory and Methodology of
//   Training" formalised training age as the cumulative volume of
//   consistent, structured training rather than calendar tenure — a
//   5-year endurance athlete and an 8-month beginner respond to the
//   same stimulus very differently. Tønnessen et al. (2014) "Training
//   Olympic-Level Elite Endurance Athletes" showed that elite
//   long-term performance is built across 8-10 years of accumulated
//   training weeks, with adaptation responsiveness dropping as
//   training age grows. Lloyd & Oliver (2015) "The Long-Term Athletic
//   Development model: Physiological Evidence and Application"
//   defines four developmental bands that map onto how an athlete
//   should be coached — habit before intensity for beginners,
//   marginal-gains precision for established athletes, recovery
//   primacy for veterans.
//
// The detector:
//   - groups sessions into ISO weeks (Mon-Sun) from the first logged
//     entry through the week containing `today`
//   - counts a week as "consistent" if it contains >= 3 sessions
//   - sums consistent weeks to derive trainingAgeWeeks
//   - converts to years (/52) and months (/4.345) for display
//   - tracks totalWeeksTracked and consistencyRate so the card can
//     contextualise how dense the log is vs how long it spans
//   - classifies the stage per Lloyd 2015 bands
//   - returns null on empty log
//
// Pure function. No I/O. No React. No external imports.

const MS_PER_DAY = 86400000
const WEEK_DAYS = 7
const CONSISTENT_SESSION_THRESHOLD = 3
const WEEKS_PER_YEAR = 52
const WEEKS_PER_MONTH = 4.345

/**
 * @description Citation marker shipped on every non-null return so
 *   downstream consumers can render attribution without hard-coding
 *   the literal in component code.
 */
export const TRAINING_AGE_CITATION = 'Bompa 2018; Tønnessen 2014; Lloyd 2015'

function dayMs(iso) {
  if (!iso) return null
  const s = String(iso).slice(0, 10)
  const d = new Date(s + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function isoFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * @description Return the UTC ms timestamp of the Monday at 12:00 UTC
 *   for the ISO week containing the given ms timestamp. ISO weeks run
 *   Mon-Sun.
 */
function isoWeekMondayMs(ms) {
  const d = new Date(ms)
  // getUTCDay: Sun=0, Mon=1, ... Sat=6. ISO Monday offset:
  //   Mon -> 0, Tue -> 1, ..., Sun -> 6
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  const monday = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - offset,
    12, 0, 0, 0,
  ))
  return monday.getTime()
}

/**
 * @description Classify training age in weeks into Lloyd 2015
 *   long-term athletic development stages.
 *
 * @param {number} weeks
 * @returns {'BEGINNER' | 'DEVELOPING' | 'ESTABLISHED' | 'VETERAN'}
 */
export function classifyDevelopmentStage(weeks) {
  if (weeks < 26)  return 'BEGINNER'
  if (weeks < 104) return 'DEVELOPING'
  if (weeks < 260) return 'ESTABLISHED'
  return 'VETERAN'
}

/**
 * @description Analyse training age from a session log.
 *
 * @param {{ log: Array, today?: string }} args
 * @returns {{
 *   stage:               'BEGINNER' | 'DEVELOPING' | 'ESTABLISHED' | 'VETERAN',
 *   trainingAgeWeeks:    number,
 *   trainingAgeYears:    number,
 *   trainingAgeMonths:   number,
 *   totalWeeksTracked:   number,
 *   consistencyRate:     number,
 *   citation:            string,
 * } | null}
 */
export function analyzeTrainingAge({ log, today } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(tToday)
  if (todayMs == null) return null

  // Collect valid session timestamps.
  const sessionMsList = []
  for (const e of log) {
    const m = dayMs(e?.date)
    if (m == null) continue
    sessionMsList.push(m)
  }
  if (sessionMsList.length === 0) return null

  // First-session Monday anchors the start of the tracked range.
  const earliestMs = Math.min(...sessionMsList)
  const firstMondayMs = isoWeekMondayMs(earliestMs)
  const currentMondayMs = isoWeekMondayMs(todayMs)

  // Defensive: if `today` predates the earliest session, treat the
  // tracked range as a single week (the one containing that session).
  const endMondayMs = currentMondayMs < firstMondayMs ? firstMondayMs : currentMondayMs

  const totalWeeksTracked =
    Math.round((endMondayMs - firstMondayMs) / (WEEK_DAYS * MS_PER_DAY)) + 1

  // Bucket session counts by ISO-week-Monday ms key.
  const weekCounts = new Map()
  for (const m of sessionMsList) {
    const wkKey = isoWeekMondayMs(m)
    weekCounts.set(wkKey, (weekCounts.get(wkKey) || 0) + 1)
  }

  // Walk every ISO week in [firstMondayMs .. endMondayMs] and count
  // those that meet the consistency threshold.
  let consistentWeeks = 0
  const stepMs = WEEK_DAYS * MS_PER_DAY
  for (let mondayMs = firstMondayMs; mondayMs <= endMondayMs; mondayMs += stepMs) {
    const count = weekCounts.get(mondayMs) || 0
    if (count >= CONSISTENT_SESSION_THRESHOLD) consistentWeeks += 1
  }

  const trainingAgeWeeks = consistentWeeks
  const trainingAgeYears  = Math.round((trainingAgeWeeks / WEEKS_PER_YEAR) * 100) / 100
  const trainingAgeMonths = Math.round((trainingAgeWeeks / WEEKS_PER_MONTH) * 10) / 10
  const consistencyRate   =
    totalWeeksTracked > 0
      ? Math.round((trainingAgeWeeks / totalWeeksTracked) * 1000) / 1000
      : 0

  const stage = classifyDevelopmentStage(trainingAgeWeeks)

  return {
    stage,
    trainingAgeWeeks,
    trainingAgeYears,
    trainingAgeMonths,
    totalWeeksTracked,
    consistencyRate,
    citation: TRAINING_AGE_CITATION,
    // Internal anchors for downstream debugging — not part of the
    // documented contract but stable across the file's lifetime.
    _firstWeekStart: isoFromMs(firstMondayMs),
    _lastWeekStart:  isoFromMs(endMondayMs),
  }
}
