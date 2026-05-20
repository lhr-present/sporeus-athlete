// ─── microcycleVariety.js — Within-Week Stimulus Variety ────────────────────
//
// Complementary to sessionVariety.js (overall variety across all sessions in
// a window) and hardSessionTypePattern.js (Shannon entropy across HARD-only
// session types). This module asks a DIFFERENT question:
//
//   Within EACH individual microcycle (week), how many distinct session
//   types is the athlete hitting? And — across the last `windowWeeks`
//   ISO weeks — is that per-week count growing, steady, or shrinking?
//
// Issurin 2010 + Bompa 2018 block-periodization theory: within each
// microcycle (week) an athlete should hit MULTIPLE stimuli (long run +
// intervals + tempo + strength + …) to drive concurrent adaptations. A
// monotonous microcycle (all the same session type) ceiling-effects fast
// because only one adaptation pathway is being trained.
//
// Aggregate: per-week distinct session-TYPE counts over the last
// `windowWeeks` ISO weeks (Mon–Sun) ending in the week containing `today`
// — same windowing convention as weeklyTssVariance.js.
//
// TYPE normalization:
//   String(entry.type ?? '').trim().toLowerCase()
//   Empty-after-trim entries contribute to sessionCount only when they have
//   a date inside the window — but they are SKIPPED from the type set
//   (so they do NOT count toward uniqueTypes).
//
//   NOTE on sessionCount: a "session" requires a usable ISO date inside
//   the window. Entries without a date or with a non-ISO date are dropped
//   entirely (they cannot be assigned to any week).
//
// Bands (mean of uniqueTypes across weeks-with-sessions only):
//   INSUFFICIENT_DATA : trainingWeekCount < 4
//   MONOTONOUS        : mean ≤ 1.5
//   NARROW            : mean ≤ 2.5
//   BALANCED          : mean ≤ 4
//   WIDE_VARIETY      : mean > 4
//
// trendDeltaPerWeek: linear-regression slope of uniqueTypes (Y) vs week
// index (X, 0..windowWeeks-1) across ALL windowWeeks. Empty weeks count
// as Y=0 in the regression (Issurin's argument is that taking a complete
// rest week IS a reduction in stimulus variety vs. the rest of the block).
// Rounded to 4dp. When only one data point (safeWindow = 1), slope = 0.
//
// Pure function. No React, no I/O, no mutation of inputs.
//
// Citations:
//   Issurin V. (2010). New horizons for the methodology and physiology
//     of training periodization. Sports Med 40(3):189-206.
//   Bompa T., Buzzichelli C. (2018). Periodization: Theory and Methodology
//     of Training, 6th ed. Human Kinetics.
// ─────────────────────────────────────────────────────────────────────────────

export const MICROCYCLE_VARIETY_CITATION = 'Issurin 2010; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 12
const MIN_TRAINING_WEEKS = 4
const MONOTONOUS_CEIL = 1.5
const NARROW_CEIL = 2.5
const BALANCED_CEIL = 4

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) {
      const d = new Date(key + 'T00:00:00Z')
      if (!Number.isNaN(d.getTime())) return key
    }
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

// ─── Rounding helpers ───────────────────────────────────────────────────────
function round2(x) {
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function round4(x) {
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 10000) / 10000
}

// ─── Band classifier ────────────────────────────────────────────────────────
function classifyBand(trainingWeekCount, mean) {
  if (trainingWeekCount < MIN_TRAINING_WEEKS) return 'INSUFFICIENT_DATA'
  if (mean <= MONOTONOUS_CEIL) return 'MONOTONOUS'
  if (mean <= NARROW_CEIL) return 'NARROW'
  if (mean <= BALANCED_CEIL) return 'BALANCED'
  return 'WIDE_VARIETY'
}

// ─── Linear-regression slope (least squares) ────────────────────────────────
function slope(ys) {
  const n = ys.length
  if (n < 2) return 0
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += ys[i]
    sumXY += i * ys[i]
    sumXX += i * i
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

/**
 * Analyze within-week stimulus variety across the last `windowWeeks` ISO
 * weeks (Mon–Sun) ending in the week containing `today`.
 *
 * @param {object}      args
 * @param {Array}       args.log               training_log entries
 * @param {string|Date} args.today             reference date
 * @param {number}      [args.windowWeeks=12]  trailing window in ISO weeks
 *
 * @returns {{
 *   band: 'MONOTONOUS'|'NARROW'|'BALANCED'|'WIDE_VARIETY'|'INSUFFICIENT_DATA',
 *   weeks: Array<{ weekStart: string, sessionCount: number, uniqueTypes: number, types: string[] }>,
 *   meanUniqueTypesPerWeek: number,
 *   trendDeltaPerWeek: number,
 *   trainingWeekCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzeMicrocycleVariety({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const parsedWindow = Number(windowWeeks)
  const safeWindow = Number.isFinite(parsedWindow) && parsedWindow >= 1
    ? Math.floor(parsedWindow)
    : (Number.isFinite(parsedWindow) ? 1 : DEFAULT_WINDOW_WEEKS)

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({
      weekStart,
      sessionCount: 0,
      typeSet: new Set(),
    })
  }

  const idxByWeekStart = Object.create(null)
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || typeof e !== 'object') continue
      const dateRaw = e.date
      if (typeof dateRaw !== 'string') continue
      const key = dateRaw.slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue
      const wkStart = isoMondayOf(key)
      const idx = idxByWeekStart[wkStart]
      if (idx == null) continue

      // Session counted toward sessionCount regardless of type validity
      // (a logged entry IS a session, even if mis-typed).
      weeks[idx].sessionCount += 1

      const typeNorm = String(e.type ?? '').trim().toLowerCase()
      if (typeNorm.length > 0) {
        weeks[idx].typeSet.add(typeNorm)
      }
    }
  }

  // ─── Build output weeks array + derived stats ─────────────────────────────
  const outWeeks = weeks.map(w => ({
    weekStart: w.weekStart,
    sessionCount: w.sessionCount,
    uniqueTypes: w.typeSet.size,
    types: Array.from(w.typeSet).sort(),
  }))

  const trainingWeekCount = outWeeks.reduce(
    (n, w) => n + (w.sessionCount >= 1 ? 1 : 0),
    0,
  )

  let meanUniqueTypesPerWeek = 0
  if (trainingWeekCount > 0) {
    const sumUnique = outWeeks.reduce(
      (s, w) => s + (w.sessionCount >= 1 ? w.uniqueTypes : 0),
      0,
    )
    meanUniqueTypesPerWeek = round2(sumUnique / trainingWeekCount)
  }

  // Regression across ALL windowWeeks — empty weeks treated as Y=0.
  const trendDeltaPerWeek = round4(slope(outWeeks.map(w => w.uniqueTypes)))

  const band = classifyBand(trainingWeekCount, meanUniqueTypesPerWeek)

  return {
    band,
    weeks: outWeeks,
    meanUniqueTypesPerWeek,
    trendDeltaPerWeek,
    trainingWeekCount,
    citation: MICROCYCLE_VARIETY_CITATION,
  }
}
