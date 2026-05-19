// ─── sessionLengthDistribution.js — 90-Day Session-Duration Distribution ────
//
// While LongestSessionTrend / LongSessionShare / LongRunFrequency /
// LongRunConsistency each pick a single dimension of long-session
// progression, the athlete also needs to see the FULL distribution of
// session lengths to spot whether they only ever do short sessions, only
// ever do long sessions, or have a healthy range across the polarity
// spectrum.
//
// Issurin (2010) and Bompa (2018) frame this as "duration variety":
// a sustainable endurance base depends on training across multiple
// durations within the same mesocycle. Exclusively short (<45min)
// sessions cannot drive aerobic adaptation; exclusively long (>120min)
// sessions cannot sustain weekly load.
//
// This module bins the trailing 90 days of session durations into
// seven duration buckets, reports quartiles + mode bin, and classifies
// the distribution into one of five bands:
//
//   NARROW_SHORT       ≥80% sessions in <30 + 30-44 bins combined
//   NARROW_LONG        ≥60% sessions in 90-119 + 120-179 + 180+ bins
//   WIDE_RANGE         at least 5 of 7 bins have count ≥ 1
//   BALANCED           anything else with sufficient data
//   INSUFFICIENT_DATA  fewer than 15 sessions in the window
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Issurin V.B. (2010). New horizons for the methodology and physiology
//     of training periodization. Sports Med 40(3):189-206.
//   Bompa T.O., Buzzichelli C.A. (2018). Periodization: Theory and
//     Methodology of Training, 6th ed. Human Kinetics.
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_LENGTH_DISTRIBUTION_CITATION = 'Issurin 2010; Bompa 2018'

const BINS = [
  { id: 'sub30',     minLow: 0,   minHigh: 30,       label: '<30' },
  { id: 's30to44',   minLow: 30,  minHigh: 45,       label: '30-44' },
  { id: 's45to59',   minLow: 45,  minHigh: 60,       label: '45-59' },
  { id: 's60to89',   minLow: 60,  minHigh: 90,       label: '60-89' },
  { id: 's90to119',  minLow: 90,  minHigh: 120,      label: '90-119' },
  { id: 's120to179', minLow: 120, minHigh: 180,      label: '120-179' },
  { id: 'sup180',    minLow: 180, minHigh: Infinity, label: '180+' },
]

const NARROW_SHORT_BINS = ['sub30', 's30to44']
const NARROW_LONG_BINS = ['s90to119', 's120to179', 'sup180']
const MIN_SESSIONS = 15
const NARROW_SHORT_THRESHOLD = 0.80
const NARROW_LONG_THRESHOLD = 0.60
const WIDE_RANGE_MIN_BINS = 5

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function resolveTodayIso(today) {
  if (today == null) return null
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string') {
    const s = today.slice(0, 10)
    const d = new Date(s + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  return null
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function entryDurationMin(entry) {
  const raw = entry?.durationMin ?? entry?.duration_min
  const d = Number(raw)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function findBinId(durMin) {
  for (const b of BINS) {
    if (durMin >= b.minLow && durMin < b.minHigh) return b.id
  }
  return null
}

// Linear-interpolation percentile: standard "method 7" (R default, NumPy default).
// p ∈ [0,1]. Returns NaN for an empty array.
function percentile(sortedAsc, p) {
  const n = sortedAsc.length
  if (n === 0) return NaN
  if (n === 1) return sortedAsc[0]
  const h = (n - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  if (lo === hi) return sortedAsc[lo]
  const frac = h - lo
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo])
}

function round1(x) {
  return Math.round(x * 10) / 10
}

function round4(x) {
  return Math.round(x * 10000) / 10000
}

function classifyBand({ totalSessions, bins }) {
  if (totalSessions < MIN_SESSIONS) return 'INSUFFICIENT_DATA'
  const shareById = new Map(bins.map(b => [b.id, b.share]))
  const shortShare = NARROW_SHORT_BINS.reduce((s, id) => s + (shareById.get(id) || 0), 0)
  if (shortShare >= NARROW_SHORT_THRESHOLD) return 'NARROW_SHORT'
  const longShare = NARROW_LONG_BINS.reduce((s, id) => s + (shareById.get(id) || 0), 0)
  if (longShare >= NARROW_LONG_THRESHOLD) return 'NARROW_LONG'
  const populated = bins.filter(b => b.count >= 1).length
  if (populated >= WIDE_RANGE_MIN_BINS) return 'WIDE_RANGE'
  return 'BALANCED'
}

/**
 * Analyze the distribution of session durations over the trailing
 * `windowDays` ending at `today`.
 *
 * @param {object}        args
 * @param {Array}         args.log               training_log entries
 * @param {string|Date}   args.today             reference date
 * @param {number}        [args.windowDays=90]   trailing window length
 *
 * @returns {{
 *   band: 'NARROW_SHORT'|'NARROW_LONG'|'BALANCED'|'WIDE_RANGE'|'INSUFFICIENT_DATA',
 *   bins: Array<{ id: string, label: string, count: number, share: number }>,
 *   totalSessions: number,
 *   medianMin: number,
 *   q25Min: number,
 *   q75Min: number,
 *   iqrMin: number,
 *   modeBinId: string | null,
 *   citation: string
 * } | null}
 */
export function analyzeSessionLengthDistribution({ log, today, windowDays = 90 } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null
  if (!Array.isArray(log)) {
    return {
      band: 'INSUFFICIENT_DATA',
      bins: BINS.map(b => ({ id: b.id, label: b.label, count: 0, share: 0 })),
      totalSessions: 0,
      medianMin: 0,
      q25Min: 0,
      q75Min: 0,
      iqrMin: 0,
      modeBinId: null,
      citation: SESSION_LENGTH_DISTRIBUTION_CITATION,
    }
  }
  const wd = Number(windowDays)
  const effectiveWindow = Number.isFinite(wd) && wd >= 1 ? Math.floor(wd) : 90
  const startIso = addDaysStr(todayIso, -(effectiveWindow - 1))

  // ─── Collect durations within window ────────────────────────────────────────
  const durations = []
  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const d = e.date.slice(0, 10)
    if (d < startIso || d > todayIso) continue
    const dur = entryDurationMin(e)
    if (dur <= 0) continue
    durations.push(dur)
  }

  const totalSessions = durations.length

  // ─── Bin counts ────────────────────────────────────────────────────────────
  const counts = new Map(BINS.map(b => [b.id, 0]))
  for (const dur of durations) {
    const id = findBinId(dur)
    if (id) counts.set(id, counts.get(id) + 1)
  }
  const bins = BINS.map(b => {
    const count = counts.get(b.id) || 0
    const share = totalSessions > 0 ? round4(count / totalSessions) : 0
    return { id: b.id, label: b.label, count, share }
  })

  // ─── Mode bin (earliest tie wins) ──────────────────────────────────────────
  let modeBinId = null
  if (totalSessions > 0) {
    let maxCount = -1
    for (const b of bins) {
      if (b.count > maxCount) {
        maxCount = b.count
        modeBinId = b.id
      }
    }
    if (maxCount <= 0) modeBinId = null
  }

  // ─── Quartiles (linear interpolation, standard percentile method) ──────────
  let q25Min = 0
  let medianMin = 0
  let q75Min = 0
  if (totalSessions > 0) {
    const sorted = durations.slice().sort((a, b) => a - b)
    q25Min = round1(percentile(sorted, 0.25))
    medianMin = round1(percentile(sorted, 0.50))
    q75Min = round1(percentile(sorted, 0.75))
  }
  const iqrMin = round1(q75Min - q25Min)

  const band = classifyBand({ totalSessions, bins })

  return {
    band,
    bins,
    totalSessions,
    medianMin,
    q25Min,
    q75Min,
    iqrMin,
    modeBinId,
    citation: SESSION_LENGTH_DISTRIBUTION_CITATION,
  }
}
