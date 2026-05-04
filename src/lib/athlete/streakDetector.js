// ─── streakDetector.js — Training-Streak Detector ────────────────────────────
// Positive-framed signal showing consecutive training days, with risk
// escalation when an unbroken streak overlaps with no rest days. Distinct
// from gap-flag detectors (detraining, vo2Gap, easyDayCompliance): this is
// a *pattern* detector that recognizes both consistency wins and over-
// grinding risk. Risk band is derived ONLY from streak length and rest-day
// pattern; deeper risk synthesis belongs in coachingSummaryScore.
//
// Bands:
//   celebrating  1-7       habit forming
//   consistent   8-14      strong consistency
//   monitoring   15-21     watch fatigue (rest day exists in last 14)
//   risk         ≥22 OR (≥15 AND no rest in last 14)
//   recovery     0, last train within 1 day (yesterday) — active rest today
//   broken       0, last train >1 day ago — informational
// Cite: Habit-formation training research; Foster 2001 monotony
// ─────────────────────────────────────────────────────────────────────────────

export const STREAK_DETECTOR_CITATION =
  'Habit-formation training research; Foster 2001 monotony'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDays(laterStr, earlierStr) {
  const a = new Date(laterStr + 'T00:00:00Z').getTime()
  const b = new Date(earlierStr + 'T00:00:00Z').getTime()
  return Math.round((a - b) / 86400000)
}

// ─── Entry classification ────────────────────────────────────────────────────
function isTrainingEntry(entry) {
  const tss = Number(entry?.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  const dur = Number(entry?.duration)
  if (Number.isFinite(dur) && dur > 0) return true
  return false
}

// ─── Band classification ─────────────────────────────────────────────────────
function bandFor(currentStreak, daysSinceLastRest, lastTrainingDateStr, today) {
  if (currentStreak === 0) {
    if (lastTrainingDateStr && diffDays(today, lastTrainingDateStr) === 1) {
      return 'recovery'
    }
    return 'broken'
  }
  if (currentStreak >= 22) return 'risk'
  if (currentStreak >= 15) {
    if (daysSinceLastRest == null || daysSinceLastRest >= 14) return 'risk'
    return 'monitoring'
  }
  if (currentStreak >= 8) return 'consistent'
  return 'celebrating'
}

// ─── Bilingual messages (with {N} / {X} substitution) ────────────────────────
const MESSAGES = {
  celebrating: {
    en: '{N}-day streak — building habit',
    tr: '{N} günlük seri — alışkanlık inşası',
  },
  consistent: {
    en: '{N}-day streak — strong consistency',
    tr: '{N} günlük seri — güçlü süreklilik',
  },
  monitoring: {
    en: '{N}-day streak — watch fatigue',
    tr: '{N} günlük seri — yorgunluğa dikkat',
  },
  risk: {
    en: '{N}-day streak — schedule a rest day',
    tr: '{N} günlük seri — bir dinlenme günü planla',
  },
  recovery: {
    en: 'Active recovery today',
    tr: 'Bugün aktif toparlanma',
  },
  broken: {
    en: 'Streak ended {X}d ago',
    tr: 'Seri {X} gün önce sona erdi',
  },
}

const RECOMMENDATIONS = {
  celebrating: { en: '', tr: '' },
  consistent: {
    en: 'Maintain — keep one easy day per week',
    tr: 'Sürdür — haftada bir kolay gün koru',
  },
  monitoring: {
    en: 'Insert one full rest day in the next 7 days',
    tr: 'Önümüzdeki 7 günde bir tam dinlenme günü ekle',
  },
  risk: {
    en: 'Take a full rest day within 48h',
    tr: '48 saat içinde tam dinlenme günü al',
  },
  recovery: { en: '', tr: '' },
  broken: {
    en: 'Resume base aerobic — short, easy session',
    tr: 'Temel aerobiğe dön — kısa ve kolay seans',
  },
}

function fillMessage(tpl, n, x) {
  return tpl.replace('{N}', String(n)).replace('{X}', String(x))
}

// ─── detectStreak ────────────────────────────────────────────────────────────
/**
 * Detect training streak and rest-day pattern.
 *
 * A "training day" = at least one log entry on that date with TSS > 0
 * (or duration > 0 if no TSS).
 *
 * currentStreak       consecutive training days ending on today (today must
 *                     have an entry, else 0)
 * longestStreakIn90d  max run of consecutive training days within last 90d
 * lastRestDate        most recent date in last 90d with NO training entry
 *                     (null if streak ≥ 90 days)
 *
 * @param {Array} log
 * @param {string} [today] - YYYY-MM-DD reference; deterministic override
 * @returns {{
 *   currentStreak: number,
 *   longestStreakIn90d: number,
 *   lastRestDate: string|null,
 *   daysSinceLastRest: number|null,
 *   trainingDaysIn28d: number,
 *   riskBand: 'celebrating'|'consistent'|'monitoring'|'risk'|'recovery'|'broken',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectStreak(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    currentStreak: 0,
    longestStreakIn90d: 0,
    lastRestDate: null,
    daysSinceLastRest: null,
    trainingDaysIn28d: 0,
    riskBand: 'broken',
    message: { ...MESSAGES.broken },
    recommendation: { ...RECOMMENDATIONS.broken },
    reliable: false,
    citation: STREAK_DETECTOR_CITATION,
  }
  // Pre-fill the {X} placeholder for the empty default so consumers don't see literal "{X}"
  empty.message = {
    en: MESSAGES.broken.en.replace('{X}', '∞'),
    tr: MESSAGES.broken.tr.replace('{X}', '∞'),
  }

  if (!Array.isArray(log) || log.length === 0) return empty

  // Build set of training days (distinct dates ≤ today)
  const trainingDays = new Set()
  const allDates = new Set()
  for (const e of log) {
    const d = e?.date
    if (typeof d !== 'string' || d.length < 10) continue
    const ds = d.slice(0, 10)
    if (ds > today) continue
    allDates.add(ds)
    if (isTrainingEntry(e)) trainingDays.add(ds)
  }

  if (trainingDays.size === 0 && allDates.size === 0) return empty

  // ── Current streak: walk back from today
  let currentStreak = 0
  let cursor = today
  while (trainingDays.has(cursor)) {
    currentStreak++
    cursor = addDaysStr(cursor, -1)
  }

  // ── Most recent training date (any time ≤ today)
  let lastTrainingDate = null
  for (const d of trainingDays) {
    if (lastTrainingDate == null || d > lastTrainingDate) lastTrainingDate = d
  }

  // ── 90-day window analysis
  const start90 = addDaysStr(today, -89)
  let longestStreakIn90d = 0
  let runLen = 0
  let lastRestDate = null
  for (let i = 0; i < 90; i++) {
    const ds = addDaysStr(start90, i)
    if (trainingDays.has(ds)) {
      runLen++
      if (runLen > longestStreakIn90d) longestStreakIn90d = runLen
    } else {
      runLen = 0
      if (lastRestDate == null || ds > lastRestDate) lastRestDate = ds
    }
  }
  if (longestStreakIn90d < currentStreak) longestStreakIn90d = currentStreak

  const daysSinceLastRest = lastRestDate ? diffDays(today, lastRestDate) : null

  // ── 28-day training-day count
  const start28 = addDaysStr(today, -27)
  let trainingDaysIn28d = 0
  for (const d of trainingDays) {
    if (d >= start28 && d <= today) trainingDaysIn28d++
  }

  // ── Reliability: log spans ≥ 14 days
  let minDate = null
  let maxDate = null
  for (const d of allDates) {
    if (minDate == null || d < minDate) minDate = d
    if (maxDate == null || d > maxDate) maxDate = d
  }
  const span = minDate && maxDate ? diffDays(maxDate, minDate) + 1 : 0
  const reliable = span >= 14

  // ── Band selection
  const riskBand = bandFor(currentStreak, daysSinceLastRest, lastTrainingDate, today)

  // ── Message + recommendation with substitution
  const xDays = lastTrainingDate ? Math.max(0, diffDays(today, lastTrainingDate) - 1) : 0
  const msgTpl = MESSAGES[riskBand]
  const message = {
    en: fillMessage(msgTpl.en, currentStreak, xDays),
    tr: fillMessage(msgTpl.tr, currentStreak, xDays),
  }
  const recommendation = { ...RECOMMENDATIONS[riskBand] }

  return {
    currentStreak,
    longestStreakIn90d,
    lastRestDate,
    daysSinceLastRest,
    trainingDaysIn28d,
    riskBand,
    message,
    recommendation,
    reliable,
    citation: STREAK_DETECTOR_CITATION,
  }
}
