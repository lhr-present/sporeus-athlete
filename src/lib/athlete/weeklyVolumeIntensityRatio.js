// src/lib/athlete/weeklyVolumeIntensityRatio.js
//
// Pure-fn: weekly Volume ÷ Intensity ratio = (totalMinutes / totalTss).
//
// Interpretation:
//   - A FALLING ratio means TSS-per-minute is rising — i.e. INTENSITY CREEP.
//     The same training hours generate more physiological strain.
//   - A RISING ratio means longer / easier sessions — classic aerobic-base
//     building (more minutes per unit TSS).
//
// Scientific grounding:
//   - Foster C. (2001) — "Monitoring training in athletes with reference to
//     overtraining syndrome." (Foundation for session-load tracking.)
//   - Seiler S. (2010) — "What is best practice for training intensity and
//     duration distribution in endurance athletes?" (Polarized model: most
//     time should be low-intensity / high-volume; intensity creep erodes
//     the polarized distribution.)
//
// Inputs:
//   log         — sessions [{ date: 'YYYY-MM-DD', durationMin: number, tss: number }]
//   today       — ISO date string YYYY-MM-DD anchoring the trailing window
//   windowWeeks — number of ISO weeks (default 8)
//
// Returns null if fewer than 5 of `windowWeeks` weeks have a valid ratio
// (totalTss > 0). Otherwise:
//   {
//     band:        'CREEPING_INTENSITY' | 'STABLE' | 'VOLUME_GROWING',
//     delta:       number,                                // (recent-early)/early
//     weeks:       Array<{ weekStart, totalMinutes, totalTss, ratio }>,
//     avgRatio:    number,
//     earlyAvg:    number,
//     recentAvg:   number,
//     citation:    'Foster 2001; Seiler 2010',
//   }

export const WEEKLY_VOL_INT_RATIO_CITATION = 'Foster 2001; Seiler 2010'

// Band thresholds on the relative delta (recentAvg − earlyAvg) / earlyAvg:
//   delta ≤ -0.10  → CREEPING_INTENSITY (ratio shrinking → TSS/min rising)
//   |delta| < 0.10 → STABLE
//   delta ≥ +0.10  → VOLUME_GROWING (ratio expanding → more easy minutes)
export const CREEPING_INTENSITY_MAX_DELTA = -0.10
export const VOLUME_GROWING_MIN_DELTA     = +0.10

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

// Parse 'YYYY-MM-DD' as a UTC Date at 00:00.
function parseIsoUtc(iso) {
  return new Date(iso + 'T00:00:00Z')
}

function toIsoUtc(date) {
  return date.toISOString().slice(0, 10)
}

// Return the UTC Date for the Monday (ISO week start) containing `date`.
// ISO weeks run Mon–Sun. JS getUTCDay(): 0=Sun, 1=Mon … 6=Sat.
function mondayStartingWeek(date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, … 6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + offsetToMonday)
  return d
}

function addDaysUtc(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

// Coerce a numeric field; non-finite / missing → 0.
function num(v) {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mean(arr) {
  if (!arr.length) return 0
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

/**
 * @param {{
 *   log: Array<{date:string, durationMin?:number, tss?:number}>,
 *   today: string,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'CREEPING_INTENSITY' | 'STABLE' | 'VOLUME_GROWING',
 *   delta: number,
 *   weeks: Array<{weekStart:string, totalMinutes:number, totalTss:number, ratio:number|null}>,
 *   avgRatio: number,
 *   earlyAvg: number,
 *   recentAvg: number,
 *   citation: string,
 * } | null}
 */
export function analyzeWeeklyVolumeIntensityRatio({
  log,
  today,
  windowWeeks = 8,
} = {}) {
  if (!isValidIso(today)) return null
  if (!Array.isArray(log)) return null
  const n = Math.floor(Number(windowWeeks))
  if (!Number.isFinite(n) || n < 1) return null

  // Anchor: Monday of the ISO week containing `today`.
  const todayDate = parseIsoUtc(today)
  const currentWeekMonday = mondayStartingWeek(todayDate)

  // Build the n weekly buckets oldest-first.
  // Week i covers [Monday(today) - (n-1-i)*7  ..  Monday(today) - (n-1-i)*7 + 6].
  const weeks = []
  for (let i = 0; i < n; i++) {
    const weeksBack = (n - 1) - i
    const start = addDaysUtc(currentWeekMonday, -weeksBack * 7)
    const end   = addDaysUtc(start, 6)
    weeks.push({
      weekStart: toIsoUtc(start),
      weekEnd:   toIsoUtc(end),
      totalMinutes: 0,
      totalTss: 0,
      ratio: null,
    })
  }

  // Bucket each log entry into its week.
  // Lookup map: weekStart ISO → index.
  const startToIdx = new Map()
  weeks.forEach((w, idx) => startToIdx.set(w.weekStart, idx))

  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const monday = toIsoUtc(mondayStartingWeek(parseIsoUtc(key)))
    const idx = startToIdx.get(monday)
    if (idx === undefined) continue
    // sanitizeLogEntry emits `duration` (minutes); prefer it, fall back to raw.
    weeks[idx].totalMinutes += num(e.duration ?? e.durationMin ?? e.duration_min)
    weeks[idx].totalTss     += num(e.tss)
  }

  // Compute per-week ratio. weekEnd is only used internally; strip it
  // from the returned shape so the public contract stays narrow.
  for (const w of weeks) {
    w.ratio = w.totalTss > 0 ? w.totalMinutes / w.totalTss : null
  }

  const validRatios = weeks.filter(w => Number.isFinite(w.ratio))
  if (validRatios.length < 5) return null

  const avgRatio = mean(validRatios.map(w => w.ratio))

  // Split the window in half by INDEX (chronological), then take the
  // valid ratios within each half. Using positional halves keeps the
  // "early vs recent" comparison anchored to the calendar even if some
  // weeks in either half are null.
  const half = Math.floor(weeks.length / 2)
  const earlyValid  = weeks.slice(0, half).filter(w => Number.isFinite(w.ratio))
  const recentValid = weeks.slice(half).filter(w => Number.isFinite(w.ratio))

  // Need at least one valid ratio in each half to compare.
  if (earlyValid.length === 0 || recentValid.length === 0) return null

  const earlyAvg  = mean(earlyValid.map(w => w.ratio))
  const recentAvg = mean(recentValid.map(w => w.ratio))

  if (!(earlyAvg > 0)) return null
  const delta = (recentAvg - earlyAvg) / earlyAvg
  if (!Number.isFinite(delta)) return null

  let band
  if (delta <= CREEPING_INTENSITY_MAX_DELTA)   band = 'CREEPING_INTENSITY'
  else if (delta >= VOLUME_GROWING_MIN_DELTA)  band = 'VOLUME_GROWING'
  else                                          band = 'STABLE'

  // Public weeks payload — drop the internal weekEnd.
  const publicWeeks = weeks.map(w => ({
    weekStart:    w.weekStart,
    totalMinutes: w.totalMinutes,
    totalTss:     w.totalTss,
    ratio:        w.ratio,
  }))

  return {
    band,
    delta,
    weeks: publicWeeks,
    avgRatio,
    earlyAvg,
    recentAvg,
    citation: WEEKLY_VOL_INT_RATIO_CITATION,
  }
}
