// ─── recentBest.js — v8.95.0 ─────────────────────────────────────────────────
// Pure helper: scan the training log and return the athlete's best recent
// effort (per sport, per canonical distance bucket) so the Elite Program form
// can offer a "USE MY RECENT BEST" autofill chip instead of forcing the
// athlete to retype data they already logged.
//
// Distance/duration unit conventions in this codebase are mixed across log
// entries (Strava import vs FIT vs manual vs CSV). We accept all common keys:
//   • distanceM   — meters (preferred)
//   • distanceKm  — kilometres
//   • distance    — heuristic: > 1000 ⇒ meters, otherwise kilometres
//                   (matches vdotTracker.getDistanceM and seasonStats logic)
//   • duration    — minutes (default — matches sanitizeLogEntry)
//   • durationSec — seconds (preferred when present)
// Output is always canonical: distanceM (meters) + timeSec (seconds).
// ─────────────────────────────────────────────────────────────────────────────

const RUN_RE   = /run|jog/i
const BIKE_RE  = /bike|cycl|ride/i
const SWIM_RE  = /swim/i
// v9.490 (program-dataflow F1): rowing existed everywhere EXCEPT here — the
// founder's entire imported 'row' history was invisible to USE MY RECENT BEST.
const ROW_RE   = /row|erg|kayak|canoe/i

const BUCKETS = {
  run:  [5000, 10000, 15000, 21097, 42195],
  bike: [20000, 40000, 100000],
  swim: [400, 800, 1500, 3000],
  rowing: [500, 1000, 2000, 5000, 6000, 10000],
}

const TOL = 0.15

/** Classify an entry's sport from its `type` (preferred) or `sport` field. */
function classifySport(entry) {
  const s = `${entry?.type || ''} ${entry?.sport || ''}`
  // Row first: 'row' would otherwise be shadowed by nothing here, but keep it
  // ahead of run so free-form names like "Tempo row" classify as rowing
  // (v9.487 F14 lesson).
  if (ROW_RE.test(s))  return 'rowing'
  if (RUN_RE.test(s))  return 'run'
  if (BIKE_RE.test(s)) return 'bike'
  if (SWIM_RE.test(s)) return 'swim'
  return null
}

/** Normalize an entry's distance to meters, or null if unavailable. */
function getDistanceM(entry) {
  const dm = Number(entry?.distanceM)
  if (Number.isFinite(dm) && dm > 0) return dm
  const dk = Number(entry?.distanceKm)
  if (Number.isFinite(dk) && dk > 0) return dk * 1000
  const d  = Number(entry?.distance)
  if (Number.isFinite(d) && d > 0) {
    // Heuristic: distance > 1000 implies the value is already in meters,
    // otherwise treat it as kilometres (the dominant convention from manual
    // input and seasonStats import paths).
    return d > 1000 ? d : d * 1000
  }
  return null
}

/** Normalize an entry's duration to seconds, or null if unavailable. */
function getDurationSec(entry) {
  const ds = Number(entry?.durationSec)
  if (Number.isFinite(ds) && ds > 0) return ds
  const d = Number(entry?.duration)
  if (Number.isFinite(d) && d > 0) return d * 60
  return null
}

/** Match a meters value to the closest bucket within ±TOL, else null. */
function bucketize(distanceM, sport) {
  const bs = BUCKETS[sport]
  if (!bs) return null
  let best = null
  let bestDiff = Infinity
  for (const b of bs) {
    const diff = Math.abs(distanceM - b) / b
    if (diff <= TOL && diff < bestDiff) {
      best = b
      bestDiff = diff
    }
  }
  return best
}

/** Days between two YYYY-MM-DD strings (positive when `today` >= `date`). */
function daysBetween(date, today) {
  const a = new Date(date + 'T12:00:00Z')
  const b = new Date(today + 'T12:00:00Z')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return Infinity
  return Math.round((b - a) / 86400000)
}

/**
 * @typedef {Object} RecentBest
 * @property {'run'|'bike'|'swim'} sport
 * @property {number} distanceM   - canonical bucket distance in meters
 * @property {number} timeSec     - best time at that bucket in seconds
 * @property {string} sessionDate - 'YYYY-MM-DD'
 * @property {number} daysAgo
 */

/**
 * Find the athlete's recent best effort across sports.
 *
 * @param {Array}  log
 * @param {Object} [options]
 * @param {string} [options.today]          - 'YYYY-MM-DD' (default: today)
 * @param {number} [options.lookbackDays]   - default 90
 * @param {'run'|'bike'|'swim'|'triathlon'|null} [options.primarySport]
 * @returns {RecentBest|null}
 */
export function findRecentBest(log, options = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  const today = options.today || new Date().toISOString().slice(0, 10)
  const lookback = Number.isFinite(options.lookbackDays) ? options.lookbackDays : 90
  const primarySport = options.primarySport || null

  // bestPerBucket: { [sport]: Map<bucketM, { timeSec, sessionDate, daysAgo }> }
  const bestPerBucket = { run: new Map(), bike: new Map(), swim: new Map(), rowing: new Map() }
  const sportCount    = { run: 0, bike: 0, swim: 0, rowing: 0 }  // v9.490 F1
  const lastDate      = { run: null, bike: null, swim: null, rowing: null }

  for (const e of log) {
    if (!e || typeof e !== 'object') continue
    if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue

    const sport = classifySport(e)
    if (!sport) continue

    const days = daysBetween(e.date, today)
    if (!Number.isFinite(days)) continue
    if (days < 0) continue                // future-dated session
    if (days > lookback) continue         // older than window

    const distM = getDistanceM(e)
    if (distM == null || !Number.isFinite(distM) || distM <= 0) continue

    const timeSec = getDurationSec(e)
    if (timeSec == null || !Number.isFinite(timeSec) || timeSec <= 0) continue

    const bucket = bucketize(distM, sport)
    if (bucket == null) continue

    sportCount[sport] += 1
    if (lastDate[sport] == null || e.date > lastDate[sport]) lastDate[sport] = e.date

    const cur = bestPerBucket[sport].get(bucket)
    if (!cur || timeSec < cur.timeSec) {
      bestPerBucket[sport].set(bucket, {
        timeSec,
        sessionDate: e.date,
        daysAgo: days,
      })
    }
  }

  // Choose which sport's best to surface.
  function bestForSport(sport) {
    const m = bestPerBucket[sport]
    if (!m || m.size === 0) return null
    // Pick the bucket whose best is most recent (smallest daysAgo); ties → largest distance.
    let pick = null
    for (const [bucketM, info] of m.entries()) {
      if (!pick) { pick = { bucketM, ...info }; continue }
      if (info.daysAgo < pick.daysAgo ||
          (info.daysAgo === pick.daysAgo && bucketM > pick.bucketM)) {
        pick = { bucketM, ...info }
      }
    }
    if (!pick) return null
    return {
      sport,
      distanceM: pick.bucketM,
      timeSec: pick.timeSec,
      sessionDate: pick.sessionDate,
      daysAgo: pick.daysAgo,
    }
  }

  // 1. primarySport (when set + has data) wins. Triathlon → most-trained tri sport.
  if (primarySport && primarySport !== 'triathlon') {
    const r = bestForSport(primarySport)
    if (r) return r
  }

  // 2. Otherwise pick the most-trained sport (tiebreak: most recent activity).
  const order = ['run', 'bike', 'swim', 'rowing']  // v9.490 F1
    .filter(s => sportCount[s] > 0)
    .sort((a, b) => {
      if (sportCount[b] !== sportCount[a]) return sportCount[b] - sportCount[a]
      // Tiebreak by most recent activity date (lexicographic on YYYY-MM-DD)
      const la = lastDate[a] || ''
      const lb = lastDate[b] || ''
      if (lb !== la) return lb.localeCompare(la)
      return 0
    })

  for (const s of order) {
    const r = bestForSport(s)
    if (r) return r
  }
  return null
}
