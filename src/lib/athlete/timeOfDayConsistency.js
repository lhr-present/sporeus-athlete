// ─── timeOfDayConsistency.js — Training time-of-day consistency (4w window) ──
// Athletes who train at consistent times of day adapt faster and recover
// better. The circadian system anchors hormone release (cortisol, GH,
// testosterone), core temperature, and sleep architecture to a 24-hour
// rhythm; repeated exposure to a stimulus at the same clock-time strengthens
// the entrainment of these patterns. Scattered training times — early one
// day, late the next — denies the system a stable phase reference, which
// degrades sleep quality, hormonal adaptation, and performance readiness.
//
// Consistency metric: standard deviation of workout start-time across the
// last N weeks (default 4). Low SD = tightly anchored; high SD = scattered.
//
// Bands (minutes of SD):
//   TIGHT     < 60   — strong circadian alignment
//   MODERATE  60–120 — reasonably consistent
//   LOOSE     120–180 — variable timing; sleep + adaptation may suffer
//   SCATTERED > 180  — try to anchor training time
//
// Citations:
//   Mah C.D. et al. (2011). The effects of sleep extension on the athletic
//     performance of collegiate basketball players. Sleep 34(7):943-950.
//   Walker M. (2017). Why We Sleep: Unlocking the Power of Sleep and Dreams.
//     Scribner. (Circadian alignment, training-time entrainment chapters.)
//   Hammar M. et al. (2007). Circadian variation of muscular performance.
//     Eur J Appl Physiol 99(5):557-564.
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_OF_DAY_CONSISTENCY_CITATION = 'Mah 2011; Walker 2017; Hammar 2007'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Time parsing ────────────────────────────────────────────────────────────
// Accept HH:MM (24h) strings from any of `startTime`, `time`, or
// `timeOfDay`. Returns minutes-since-midnight, or null when unparseable.
function parseTimeToMinutes(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Match HH:MM or HH:MM:SS, 24-hour format
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1])
  const mins = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(mins)) return null
  if (h < 0 || h > 23) return null
  if (mins < 0 || mins > 59) return null
  return h * 60 + mins
}

function extractStartMinutes(entry) {
  if (!entry || typeof entry !== 'object') return null
  // Try in priority order: startTime → time → timeOfDay
  const candidates = [entry.startTime, entry.time, entry.timeOfDay]
  for (const c of candidates) {
    const parsed = parseTimeToMinutes(c)
    if (parsed != null) return parsed
  }
  return null
}

// ─── Band classification ─────────────────────────────────────────────────────
function bandFor(sdMinutes) {
  if (sdMinutes < 60) return 'TIGHT'
  if (sdMinutes < 120) return 'MODERATE'
  if (sdMinutes <= 180) return 'LOOSE'
  return 'SCATTERED'
}

// ─── computeTimeOfDayConsistency ─────────────────────────────────────────────
/**
 * Compute time-of-day consistency of training start times over the trailing
 * `weeks` weeks (default 4).
 *
 * Accepts start time from `entry.startTime`, `entry.time`, or
 * `entry.timeOfDay` (HH:MM 24-hour string). Entries without a parseable
 * start time are skipped.
 *
 * Returns null when fewer than 6 timed entries are available in the window.
 *
 * Bands (SD in minutes):
 *   TIGHT     < 60
 *   MODERATE  60–120
 *   LOOSE     120–180
 *   SCATTERED > 180
 *
 * @param {{ log: Array, today?: string, weeks?: number }} args
 * @returns {{
 *   meanHour: number,      // mean start hour, decimal 24h (e.g. 7.5 = 07:30)
 *   sdMinutes: number,     // sample SD in minutes
 *   band: 'TIGHT'|'MODERATE'|'LOOSE'|'SCATTERED',
 *   n: number,             // number of timed entries used
 *   citation: string,
 * } | null}
 */
export function computeTimeOfDayConsistency({ log, today, weeks = 4 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  const ref = today || new Date().toISOString().slice(0, 10)
  const windowDays = Math.max(1, Math.round(weeks * 7))
  const start = addDaysStr(ref, -(windowDays - 1))

  const minutesList = []
  for (const e of log) {
    if (!e || typeof e !== 'object') continue
    if (typeof e.date !== 'string') continue
    if (e.date < start || e.date > ref) continue
    const m = extractStartMinutes(e)
    if (m == null) continue
    minutesList.push(m)
  }

  const n = minutesList.length
  if (n < 6) return null

  const mean = minutesList.reduce((acc, v) => acc + v, 0) / n
  // Sample SD (n-1 denominator).
  let sumSq = 0
  for (const v of minutesList) {
    const d = v - mean
    sumSq += d * d
  }
  const variance = sumSq / (n - 1)
  const sdMinutes = Math.sqrt(variance)
  const meanHour = mean / 60

  return {
    meanHour,
    sdMinutes,
    band: bandFor(sdMinutes),
    n,
    citation: TIME_OF_DAY_CONSISTENCY_CITATION,
  }
}
