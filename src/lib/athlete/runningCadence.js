// ─── runningCadence.js — Running cadence (spm) 28-day trend ──────────────────
//
// Cadence (steps per minute, spm) is a biomechanical efficiency signal.
//   - Daniels 2014 / Heiderscheit 2011 (MSSE): elite/efficient runners
//     cluster around 175–185 spm at moderate effort.
//   - <165 spm → over-striding, higher impact loading, injury risk.
//   - 165–170  → slightly long stride, can be improved.
//   - 170–185  → TARGET BAND (efficient).
//   - >185     → short stride (fine at fast paces, suboptimal for easy).
//
// computeRunningCadenceTrend filters the last `windowDays` (default 28) of
// log to running sessions that carry a parseable cadence field
// (`entry.cadence` / `entry.spm` / `entry.avgCadence`), excludes
// recovery/walk/very-easy entries (RPE < 3), then returns the mean cadence,
// band classification, 4-week weekly-mean sparkline, and citation. Returns
// null when there are fewer than 3 qualifying entries OR no running
// sessions at all.

export const RUNNING_CADENCE_CITATION = 'Daniels 2014; Heiderscheit 2011; Schubert 2014'

const CADENCE_MIN = 100
const CADENCE_MAX = 250

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True when an entry's type/sport indicates a running session. */
function isRunSession(entry) {
  if (!entry) return false
  const type  = String(entry.type  || '').toLowerCase()
  const sport = String(entry.sport || '').toLowerCase()
  if (/run/.test(type))  return true
  if (/run/.test(sport)) return true
  return false
}

/** Extract a numeric cadence value from any of the supported fields. */
function pickCadence(entry) {
  const candidates = [entry?.cadence, entry?.spm, entry?.avgCadence]
  for (const raw of candidates) {
    if (raw === null || raw === undefined || raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    if (n < CADENCE_MIN || n > CADENCE_MAX) continue
    return n
  }
  return null
}

/** True if this entry should be excluded (recovery / walk / very easy). */
function isExcludedEffort(entry) {
  const type = String(entry?.type || '').toLowerCase()
  if (/recovery/.test(type)) return true
  if (/walk/.test(type))     return true
  if (/very[-_\s]?easy/.test(type)) return true
  // v9.484: null rpe must not read as 0 and classify the run as recovery
  const rpe = entry?.rpe == null ? NaN : Number(entry.rpe)
  if (Number.isFinite(rpe) && rpe < 3) return true
  return false
}

/** Classify mean cadence into a band. */
function classifyBand(avgCadence) {
  if (avgCadence < 165) return 'OVERSTRIDING'
  if (avgCadence < 170) return 'LONG_STRIDE'   // 165–169.99
  if (avgCadence <= 185) return 'TARGET'        // 170–185 inclusive
  return 'SHORT_STRIDE'                         // >185
}

/** Days between two YYYY-MM-DD strings (b - a). Negative if b < a. */
function daysBetween(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00Z').getTime()
  const b = new Date(bISO + 'T00:00:00Z').getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN
  return Math.floor((b - a) / 86400000)
}

/**
 * Compute the 28-day running cadence trend.
 *
 * @param {object} params
 * @param {Array}  params.log         - training log entries
 * @param {string} [params.today]     - reference date 'YYYY-MM-DD' (default = today)
 * @param {number} [params.windowDays=28] - look-back window in days
 * @returns {{
 *   avgCadence: number,
 *   n: number,
 *   band: 'OVERSTRIDING'|'LONG_STRIDE'|'TARGET'|'SHORT_STRIDE',
 *   weeklyMeans: number[],
 *   citation: string
 * } | null}
 */
export function computeRunningCadenceTrend({ log, today, windowDays = 28 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayISO = today || new Date().toISOString().slice(0, 10)
  const win = Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 28

  // First pass: is there any run session at all in the log?
  const anyRun = log.some(isRunSession)
  if (!anyRun) return null

  // Filter to qualifying entries: running, in-window, has cadence, not excluded.
  const qualifying = []
  for (const entry of log) {
    if (!isRunSession(entry)) continue
    if (isExcludedEffort(entry)) continue
    const date = entry?.date
    if (!date) continue
    const delta = daysBetween(date, todayISO)
    if (!Number.isFinite(delta)) continue
    if (delta < 0 || delta >= win) continue
    const cadence = pickCadence(entry)
    if (cadence === null) continue
    qualifying.push({ date, cadence, delta })
  }

  if (qualifying.length < 3) return null

  // Mean cadence (rounded to 1dp)
  const sum = qualifying.reduce((acc, q) => acc + q.cadence, 0)
  const avgCadence = Math.round((sum / qualifying.length) * 10) / 10

  // Weekly means — 4 buckets, oldest → newest.
  // Bucket k (0..3) covers daysAgo in [(3-k)*7, (4-k)*7). So:
  //   k=0 (oldest)  → daysAgo 21..27
  //   k=1           → daysAgo 14..20
  //   k=2           → daysAgo 7..13
  //   k=3 (newest)  → daysAgo 0..6
  const buckets = [[], [], [], []]
  for (const q of qualifying) {
    const k = 3 - Math.floor(q.delta / 7)
    if (k >= 0 && k <= 3) buckets[k].push(q.cadence)
  }
  const weeklyMeans = buckets.map(arr => {
    if (arr.length === 0) return null
    const m = arr.reduce((a, b) => a + b, 0) / arr.length
    return Math.round(m * 10) / 10
  })

  return {
    avgCadence,
    n: qualifying.length,
    band: classifyBand(avgCadence),
    weeklyMeans,
    citation: RUNNING_CADENCE_CITATION,
  }
}
