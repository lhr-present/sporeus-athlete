// ─── restDayEnergyTrend.js — rest-day vs training-day energy gap analyzer ────
//
// Pure analyzer that surfaces the Lemyre (2007) burnout signal: under healthy
// adaptation, REST days should restore — perceived energy on a rest day is
// reliably higher than on a training day. When an athlete drifts into
// overtraining / burnout, the restoration signal collapses: rest no longer
// produces an energy lift, gap shrinks, and in late-stage burnout the rest
// day can even feel WORSE than a training day (driven by depressive
// rumination and autonomic dysregulation).
//
// The card surfaces two numbers:
//
//   1. `energyGap` — recent-window (default 30d) mean energy on rest days
//      minus mean energy on training days. A healthy athlete clears +1.0
//      easily; ≥ +1.5 is the "well restored" zone.
//
//   2. `trendDeltaPerWeek` — slope of weekly `energyGap` over the trend
//      window (default 56d / 8 ISO weeks). Negative slope = restoration is
//      collapsing even if the current gap still looks acceptable.
//
// Bands:
//
//   BURNOUT_SIGNAL: energyGap < 0 OR trendDeltaPerWeek < -0.20
//                  → rest days now match or undershoot training days, or
//                    the restoration gap is shrinking fast.
//   WARNING:        0 ≤ energyGap < 0.5 AND trendDeltaPerWeek < -0.05
//                  → still positive but small and trending the wrong way.
//   WELL_RESTORED:  energyGap ≥ 1.5
//                  → textbook restoration, rest is doing its job.
//   NEUTRAL:        everything else (default fallback).
//
// Returns null when `today` is unresolvable OR both means are null (no
// usable energy data on either side of the rest/training split).
//
// Refs:
//   - Lemyre P.-N., Hall H.K., Roberts G.C. (2007) "A social cognitive
//     approach to burnout in elite athletes". Scand J Med Sci Sports 17.
//   - Kellmann M. et al. (2018) "Recovery and performance in sport:
//     consensus statement". Int J Sports Physiol Perform 13(2).

export const REST_DAY_ENERGY_TREND_CITATION = 'Lemyre 2007; Kellmann 2018'

/** Default recent window (days) over which we compute the means + gap. */
export const DEFAULT_WINDOW_DAYS = 30

/** Default trend window (days) over which we regress weekly gaps. */
export const DEFAULT_TREND_WINDOW_DAYS = 56

/** Minimum rest-day OR training-day samples in the recent window. */
export const MIN_DAY_COUNT = 3

/** Minimum within-week samples required to compute a weekly mean for the trend. */
export const MIN_WEEKLY_SAMPLES = 2

/** Minimum number of valid weekly buckets before we publish a slope. */
export const MIN_TREND_WEEKS = 4

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

/** Coerce a Date or ISO-like string to YYYY-MM-DD. null if unresolvable.
 *  When the caller omits `today` (undefined/null), we fall back to the
 *  system clock so dashboard cards don't have to thread "today" through. */
function resolveTodayIso(today) {
  if (today === undefined || today === null) {
    return new Date().toISOString().slice(0, 10)
  }
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today.length >= 10) {
    const slice = today.slice(0, 10)
    if (!ISO_RE.test(slice)) return null
    const d = new Date(`${slice}T12:00:00Z`)
    if (Number.isNaN(d.getTime())) return null
    return slice
  }
  return null
}

/** Coerce an ISO-date string to a UTC Date at noon. null on failure. */
function toDate(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null
  const slice = iso.slice(0, 10)
  if (!ISO_RE.test(slice)) return null
  const d = new Date(`${slice}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** ISO-day difference (a - b). null on bad inputs. */
function daysBetween(aIso, bIso) {
  const a = toDate(aIso)
  const b = toDate(bIso)
  if (!a || !b) return null
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

/** Round to 2 decimal places. */
function round2(n) {
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

/** Round to 4 decimal places. */
function round4(n) {
  if (!Number.isFinite(n)) return null
  return Math.round(n * 10000) / 10000
}

/** Arithmetic mean. Returns null on empty input. */
function mean(arr) {
  if (!arr.length) return null
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

/**
 * Detect whether a training-log entry represents an actually-trained day:
 * either tss > 0 or durationMin/duration_min > 0. Pure check, no side
 * effects.
 */
function isTrainingEntry(e) {
  if (!e || typeof e !== 'object') return false
  const tss = Number(e.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  const dur = Number(e.durationMin ?? e.duration_min)
  if (Number.isFinite(dur) && dur > 0) return true
  return false
}

/** Validate an energy value as a finite number (we accept 1-10 scale). */
function isFiniteEnergy(v) {
  return Number.isFinite(v)
}

/**
 * Compute the ISO-week key (Mon-Sun) for a YYYY-MM-DD date. The format is
 * "YYYY-Www" matching ISO 8601 week notation. We use this as a stable
 * bucket key for the trend regression.
 */
function isoWeekKey(iso) {
  const d = toDate(iso)
  if (!d) return null
  // ISO weeks start Monday. JS getUTCDay: Sun=0, Mon=1, ...
  // Adjust so that Monday = 0, Sunday = 6.
  const dayNum = (d.getUTCDay() + 6) % 7
  // Move to the Thursday of the current ISO week (Thursday determines year).
  const thursday = new Date(d.getTime())
  thursday.setUTCDate(thursday.getUTCDate() - dayNum + 3)
  const isoYear = thursday.getUTCFullYear()
  // Find the first Thursday of that ISO year.
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3)
  const weekIndex = Math.round(
    (thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000),
  ) + 1
  const ww = weekIndex < 10 ? `0${weekIndex}` : String(weekIndex)
  return `${isoYear}-W${ww}`
}

/**
 * Ordinary least-squares regression of ys on xs. Returns { slope, intercept }.
 * Falls back to slope=0 when xs is degenerate. xs and ys must be same length.
 */
function linearRegression(xs, ys) {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 }
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
  }
  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n }
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return { slope, intercept }
}

/**
 * Band classification. Applied strictly in order:
 *   1. BURNOUT_SIGNAL — gap < 0 OR trend < -0.20
 *   2. WARNING       — 0 ≤ gap < 0.5 AND trend < -0.05
 *   3. WELL_RESTORED — gap ≥ 1.5
 *   4. NEUTRAL       — fallback
 */
function classifyBand(energyGap, trendDeltaPerWeek) {
  const hasGap = Number.isFinite(energyGap)
  const hasTrend = Number.isFinite(trendDeltaPerWeek)

  if (hasGap && energyGap < 0) return 'BURNOUT_SIGNAL'
  if (hasTrend && trendDeltaPerWeek < -0.20) return 'BURNOUT_SIGNAL'

  if (hasGap && energyGap >= 0 && energyGap < 0.5
      && hasTrend && trendDeltaPerWeek < -0.05) {
    return 'WARNING'
  }

  if (hasGap && energyGap >= 1.5) return 'WELL_RESTORED'

  return 'NEUTRAL'
}

/**
 * Analyze the rest-day vs training-day energy gap from a recovery log,
 * cross-referenced against the training log for rest-day classification.
 *
 * @param {{
 *   log: Array<{date: string, tss?: number, durationMin?: number, duration_min?: number}>,
 *   recovery: Array<{date: string, energy?: number}>,
 *   today?: string|Date,
 *   windowDays?: number,
 *   trendWindowDays?: number,
 * }} args
 * @returns {null | {
 *   band: 'WELL_RESTORED'|'NEUTRAL'|'WARNING'|'BURNOUT_SIGNAL',
 *   recentRestDayMean: number|null,
 *   recentTrainingDayMean: number|null,
 *   energyGap: number|null,
 *   trendDeltaPerWeek: number|null,
 *   restDayCount: number,
 *   trainingDayCount: number,
 *   citation: string,
 * }}
 */
export function analyzeRestDayEnergyTrend({
  log,
  recovery,
  today,
  windowDays = DEFAULT_WINDOW_DAYS,
  trendWindowDays = DEFAULT_TREND_WINDOW_DAYS,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const w = Math.floor(Number(windowDays))
  if (!Number.isFinite(w) || w < 1) return null
  const tw = Math.floor(Number(trendWindowDays))
  if (!Number.isFinite(tw) || tw < 1) return null

  const logArr = Array.isArray(log) ? log : []
  const recoveryArr = Array.isArray(recovery) ? recovery : []

  // ─── 1. Build the training-days Set across the TREND window ─────────────
  // We use the trend window (the wider of the two) because both the recent
  // means and the weekly trend buckets need to classify days inside it.
  const trainingDaysSet = new Set()
  for (const e of logArr) {
    if (!e || typeof e.date !== 'string') continue
    const dateKey = e.date.slice(0, 10)
    if (!ISO_RE.test(dateKey)) continue
    const age = daysBetween(todayIso, dateKey)
    if (age === null) continue
    if (age < 0) continue          // future entries excluded
    if (age >= tw) continue        // outside trend window
    if (!isTrainingEntry(e)) continue
    trainingDaysSet.add(dateKey)
  }

  // ─── 2. Build recovery map keyed by date, only valid energy in trend window ──
  // Map<dateKey, energy>. If multiple entries land on the same date, take
  // the LAST one we encounter (deterministic per input ordering).
  const recoveryByDate = new Map()
  for (const r of recoveryArr) {
    if (!r || typeof r !== 'object') continue
    if (typeof r.date !== 'string') continue
    const dateKey = r.date.slice(0, 10)
    if (!ISO_RE.test(dateKey)) continue
    const energy = Number(r.energy)
    if (!isFiniteEnergy(energy)) continue
    const age = daysBetween(todayIso, dateKey)
    if (age === null) continue
    if (age < 0) continue
    if (age >= tw) continue
    recoveryByDate.set(dateKey, energy)
  }

  // ─── 3. Recent-window means (rest vs training) ──────────────────────────
  const recentRestEnergies = []
  const recentTrainingEnergies = []
  for (const [dateKey, energy] of recoveryByDate.entries()) {
    const age = daysBetween(todayIso, dateKey)
    if (age === null) continue
    if (age >= w) continue
    if (trainingDaysSet.has(dateKey)) {
      recentTrainingEnergies.push(energy)
    } else {
      recentRestEnergies.push(energy)
    }
  }

  const restDayCount = recentRestEnergies.length
  const trainingDayCount = recentTrainingEnergies.length

  const recentRestDayMean = restDayCount >= MIN_DAY_COUNT
    ? round2(mean(recentRestEnergies))
    : null
  const recentTrainingDayMean = trainingDayCount >= MIN_DAY_COUNT
    ? round2(mean(recentTrainingEnergies))
    : null

  // No usable data on either side → nothing to publish.
  if (recentRestDayMean === null && recentTrainingDayMean === null) return null

  const energyGap = (recentRestDayMean !== null && recentTrainingDayMean !== null)
    ? round2(recentRestDayMean - recentTrainingDayMean)
    : null

  // ─── 4. Weekly trend regression over the trend window ───────────────────
  // Bucket all recovery entries inside the trend window by ISO week key.
  // For each week, split into rest / training (using the same training-days
  // set) and compute a weekly gap only if BOTH halves have ≥ MIN_WEEKLY_SAMPLES.
  const weekBuckets = new Map() // wkKey → { rest: [], train: [] }
  for (const [dateKey, energy] of recoveryByDate.entries()) {
    const wk = isoWeekKey(dateKey)
    if (!wk) continue
    let bucket = weekBuckets.get(wk)
    if (!bucket) {
      bucket = { rest: [], train: [] }
      weekBuckets.set(wk, bucket)
    }
    if (trainingDaysSet.has(dateKey)) {
      bucket.train.push(energy)
    } else {
      bucket.rest.push(energy)
    }
  }

  // Sort week keys ascending — they're "YYYY-Www" so lexical sort works.
  const sortedWeekKeys = Array.from(weekBuckets.keys()).sort()
  const xs = []
  const ys = []
  let weekIndex = 0
  for (const wk of sortedWeekKeys) {
    const bucket = weekBuckets.get(wk)
    if (bucket.rest.length < MIN_WEEKLY_SAMPLES) {
      weekIndex++
      continue
    }
    if (bucket.train.length < MIN_WEEKLY_SAMPLES) {
      weekIndex++
      continue
    }
    const restMean = mean(bucket.rest)
    const trainMean = mean(bucket.train)
    if (!Number.isFinite(restMean) || !Number.isFinite(trainMean)) {
      weekIndex++
      continue
    }
    xs.push(weekIndex)
    ys.push(restMean - trainMean)
    weekIndex++
  }

  let trendDeltaPerWeek = null
  if (xs.length >= MIN_TREND_WEEKS) {
    const { slope } = linearRegression(xs, ys)
    trendDeltaPerWeek = round4(slope)
  }

  const band = classifyBand(energyGap, trendDeltaPerWeek)

  return {
    band,
    recentRestDayMean,
    recentTrainingDayMean,
    energyGap,
    trendDeltaPerWeek,
    restDayCount,
    trainingDayCount,
    citation: REST_DAY_ENERGY_TREND_CITATION,
  }
}
