// ─── sessionGapVariance.js — Inter-Session Interval Rhythm (30d window) ──────
// Measures the standard deviation of inter-session gaps (in days) across ALL
// training sessions in the trailing 30 days. Foster 2017 + Halson 2014:
// training adapts best when stimulus arrives on a predictable cadence.
// An athlete who trains every other day accumulates more durable adaptation
// than one who clusters 5 sessions in 3 days then takes 4 days off — even at
// matched total volume.
//
// Distinct from:
//   hardDaySpacing.js     (only HARD sessions, looks at 48h recovery rule)
//   calendarHoles.js      (multi-day gaps ≥3 only, 90d window)
//   sessionDensity.js     (sessions per week count, not rhythm)
//   logStreakBreaker.js   (the moment a streak broke)
//
// This card measures *variance of rhythm* — the dispersion of gaps between
// every consecutive pair of training days, regardless of intensity.
//
// Citations:
//   Foster C. et al. (2017). 25 years of session rating of perceived exertion:
//     historical perspective and development. Int J Sports Physiol Perform 12(s2).
//   Halson S.L. (2014). Monitoring training load to understand fatigue in
//     athletes. Sports Med 44(Suppl 2):S139-147.
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_GAP_VARIANCE_CITATION = 'Foster 2017; Halson 2014'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function toIso(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (
      !Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) ||
      mo < 1 || mo > 12 || d < 1 || d > 31
    ) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    if (Number.isNaN(dt.getTime())) return null
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) return null
    return dt.toISOString().slice(0, 10)
  }
  return null
}

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dayDiff(aIso, bIso) {
  const a = new Date(aIso + 'T00:00:00Z').getTime()
  const b = new Date(bIso + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

// ─── Training-day classification ─────────────────────────────────────────────
// A log entry counts as training if ANY of:
//   - tss > 0
//   - duration_min / durationMin > 0
//   - distance_km / distanceKm > 0
function isTrainingEntry(e) {
  if (!e || typeof e !== 'object') return false
  const tss = Number(e.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  const dur = Number(e.duration_min ?? e.durationMin ?? e.duration)
  if (Number.isFinite(dur) && dur > 0) return true
  const dist = Number(e.distance_km ?? e.distanceKm ?? e.distance)
  if (Number.isFinite(dist) && dist > 0) return true
  return false
}

// ─── Rounding helpers ────────────────────────────────────────────────────────
function round2(n) {
  return Math.round(n * 100) / 100
}
function round4(n) {
  return Math.round(n * 10000) / 10000
}

// ─── Band classification ─────────────────────────────────────────────────────
function classifyBand(cv) {
  if (cv < 0.30) return 'METRONOME'
  if (cv < 0.70) return 'STEADY'
  return 'CHAOTIC'
}

// ─── analyzeSessionGapVariance ──────────────────────────────────────────────
/**
 * Measure the standard deviation of inter-session gaps over a trailing
 * window.
 *
 * @param {object} options
 * @param {Array}  options.log         - training log entries
 * @param {Date|string} options.today  - reference "today"
 * @param {number} [options.windowDays=30]
 * @returns {{
 *   band: 'METRONOME'|'STEADY'|'CHAOTIC'|'INSUFFICIENT_SESSIONS',
 *   trainingDays: string[],
 *   gaps: number[],
 *   meanGapDays: number,
 *   stdGapDays: number,
 *   cv: number,
 *   sessionCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzeSessionGapVariance({ log, today, windowDays = 30 } = {}) {
  const todayIso = toIso(today)
  if (!todayIso) return null
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null

  const logArr = Array.isArray(log) ? log : []
  const windowStart = addDaysIso(todayIso, -(windowDays - 1))

  // Collect unique training-day ISO dates within window.
  const trainingDaySet = new Set()
  for (const e of logArr) {
    const dIso = toIso(e?.date)
    if (!dIso) continue
    if (dIso < windowStart || dIso > todayIso) continue
    if (isTrainingEntry(e)) {
      trainingDaySet.add(dIso)
    }
  }

  const trainingDays = Array.from(trainingDaySet).sort()
  const sessionCount = trainingDays.length

  // Insufficient sessions → zeroed structured response with band sentinel.
  if (sessionCount < 6) {
    return {
      band: 'INSUFFICIENT_SESSIONS',
      trainingDays,
      gaps: [],
      meanGapDays: 0,
      stdGapDays: 0,
      cv: 0,
      sessionCount,
      citation: SESSION_GAP_VARIANCE_CITATION,
    }
  }

  // Compute inter-session gaps in days (consecutive pairs).
  const gaps = []
  for (let i = 1; i < trainingDays.length; i++) {
    gaps.push(dayDiff(trainingDays[i - 1], trainingDays[i]))
  }

  // Mean of gaps.
  let mean = 0
  if (gaps.length > 0) {
    let s = 0
    for (const g of gaps) s += g
    mean = s / gaps.length
  }

  // Population stdev (gaps.length < 2 → 0 by spec).
  let std = 0
  if (gaps.length >= 2) {
    let sq = 0
    for (const g of gaps) {
      const d = g - mean
      sq += d * d
    }
    std = Math.sqrt(sq / gaps.length)
  }

  const meanGapDays = round2(mean)
  const stdGapDays = round2(std)
  const cv = round4(stdGapDays / Math.max(meanGapDays, 0.01))
  const band = classifyBand(cv)

  return {
    band,
    trainingDays,
    gaps,
    meanGapDays,
    stdGapDays,
    cv,
    sessionCount,
    citation: SESSION_GAP_VARIANCE_CITATION,
  }
}
