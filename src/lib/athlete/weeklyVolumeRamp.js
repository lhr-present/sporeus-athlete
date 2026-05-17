// src/lib/athlete/weeklyVolumeRamp.js
//
// Pure-fn: detect when the WEEK-OVER-WEEK volume (training duration in
// minutes) ramp exceeds the safe-ramp threshold from the running /
// endurance injury literature.
//
// Scientific grounding:
//   - Gabbett 2016 — general framework for week-over-week training-load
//     ramps and injury risk.
//   - Foster 2001 — the canonical "10% rule": don't increase weekly
//     training volume by more than ~10% over the previous week.
//   - Bertelsen 2017 — running-injury risk scales more tightly with
//     VOLUME ramps (distance/duration) than with intensity-weighted load.
//
// This complements ctlRampRate.js (which tracks TSS / fitness ramp via
// the Banister EWMA). Volume ramp is the raw "how many more minutes
// this week than last" signal — coarser, but very robust and the
// quantity most directly cited in the 10%-rule advice your athletes
// have already heard.
//
// Inputs:
//   log    — training log array of { date: 'YYYY-MM-DD',
//                                    duration?: number,   // minutes
//                                    time?: number }      // minutes fallback
//   today  — ISO date string YYYY-MM-DD anchoring the trailing window
//   weeks  — trailing weeks to average deltas over (default 4)
//
// Returns:
//   {
//     rampPct:           number,    // mean weekly delta % (e.g. +8.2)
//     weeklyMinutes:     number[],  // length === weeks + 1, oldest first
//     weeklyDeltasPct:   number[],  // length === weeks, oldest first
//     band:              string,    // DECLINING | GENTLE | PRODUCTIVE | AGGRESSIVE | OVERSHOOT
//     citation:          string,
//   } | null

export const WEEKLY_VOLUME_RAMP_CITATION = 'Gabbett 2016; Foster 2001; Bertelsen 2017'

// Band thresholds — see Foster 2001 (10% rule) and Bertelsen 2017.
//   <0   → DECLINING  (taper or detraining)
//   0..5 → GENTLE     (base period)
//   5..10 → PRODUCTIVE (build period)
//   10..15 → AGGRESSIVE (caution)
//   >15  → OVERSHOOT  (high injury risk)
const BAND_GENTLE_MIN     = 0
const BAND_PRODUCTIVE_MIN = 5
const BAND_AGGRESSIVE_MIN = 10
const BAND_OVERSHOOT_MIN  = 15

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function classifyBand(rampPct) {
  if (!Number.isFinite(rampPct)) return null
  if (rampPct < BAND_GENTLE_MIN)        return 'DECLINING'
  if (rampPct < BAND_PRODUCTIVE_MIN)    return 'GENTLE'
  if (rampPct < BAND_AGGRESSIVE_MIN)    return 'PRODUCTIVE'
  if (rampPct <= BAND_OVERSHOOT_MIN)    return 'AGGRESSIVE'
  return 'OVERSHOOT'
}

// Extract duration in minutes from a log entry. Prefer `.duration`,
// fall back to `.time`. Coerce to number; treat NaN as zero so a
// stray missing field doesn't poison the weekly sum.
function entryMinutes(e) {
  if (!e) return 0
  const dur = e.duration
  if (dur !== undefined && dur !== null && dur !== '') {
    const v = Number(dur)
    return Number.isFinite(v) ? v : 0
  }
  const t = e.time
  if (t !== undefined && t !== null && t !== '') {
    const v = Number(t)
    return Number.isFinite(v) ? v : 0
  }
  return 0
}

// Build daily minutes map keyed by ISO date.
function buildMinutesMap(log) {
  const map = {}
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    map[key] = (map[key] || 0) + entryMinutes(e)
  }
  return map
}

// Sum minutes over [startIso, endIso] (inclusive).
function sumRange(minutesMap, startIso, endIso) {
  let sum = 0
  const start = new Date(startIso + 'T00:00:00Z')
  const end   = new Date(endIso   + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    sum += minutesMap[iso] || 0
  }
  return sum
}

/**
 * @param {{log: Array<{date:string, duration?:number, time?:number}>, today: string, weeks?: number}} args
 * @returns {{
 *   rampPct: number,
 *   weeklyMinutes: number[],
 *   weeklyDeltasPct: number[],
 *   band: 'DECLINING' | 'GENTLE' | 'PRODUCTIVE' | 'AGGRESSIVE' | 'OVERSHOOT',
 *   citation: string,
 * } | null}
 */
export function computeWeeklyVolumeRamp({ log, today, weeks = 4 } = {}) {
  if (!isValidIso(today)) return null
  if (!Array.isArray(log) || log.length === 0) return null
  const w = Math.floor(Number(weeks))
  if (!Number.isFinite(w) || w < 1) return null

  // Need weeks+1 weekly buckets to derive `weeks` week-over-week deltas.
  const needWeeks = w + 1
  const windowDays = needWeeks * 7
  const windowStartIso = isoMinusDays(today, windowDays - 1)

  // Earliest log entry must be on/before the window start — partial
  // history would otherwise show a fake "ramp from zero" on the first
  // week.
  let earliestLogIso = null
  for (const e of log) {
    if (!e || !e.date) continue
    const k = String(e.date).slice(0, 10)
    if (!ISO_RE.test(k)) continue
    if (earliestLogIso === null || k < earliestLogIso) earliestLogIso = k
  }
  if (!earliestLogIso) return null
  if (earliestLogIso > windowStartIso) return null

  const minutesMap = buildMinutesMap(log)

  // Weekly buckets oldest-first.
  // Week i (0-indexed) spans [today - (needWeeks - i) * 7 + 1, today - (needWeeks - i - 1) * 7]
  const weeklyMinutes = []
  for (let i = 0; i < needWeeks; i++) {
    const startOffset = (needWeeks - i) * 7 - 1
    const endOffset   = (needWeeks - i - 1) * 7
    const startIso = isoMinusDays(today, startOffset)
    const endIso   = isoMinusDays(today, endOffset)
    weeklyMinutes.push(sumRange(minutesMap, startIso, endIso))
  }

  // weeklyDeltasPct: pct change between consecutive buckets.
  // If a prior week is exactly zero, % is undefined → return null
  // (the user genuinely had no baseline volume to ramp from).
  const weeklyDeltasPct = []
  for (let i = 1; i < weeklyMinutes.length; i++) {
    const prev = weeklyMinutes[i - 1]
    const cur  = weeklyMinutes[i]
    if (prev <= 0) return null
    const pct = ((cur - prev) / prev) * 100
    if (!Number.isFinite(pct)) return null
    weeklyDeltasPct.push(pct)
  }

  const sum = weeklyDeltasPct.reduce((s, v) => s + v, 0)
  const rampPct = sum / weeklyDeltasPct.length
  const band = classifyBand(rampPct)
  if (!band) return null

  // Round to one decimal for stable UI / test assertions.
  const round1 = v => Math.round(v * 10) / 10
  return {
    rampPct:         round1(rampPct),
    weeklyMinutes:   weeklyMinutes.map(round1),
    weeklyDeltasPct: weeklyDeltasPct.map(round1),
    band,
    citation:        WEEKLY_VOLUME_RAMP_CITATION,
  }
}
