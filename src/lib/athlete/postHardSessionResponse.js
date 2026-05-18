// src/lib/athlete/postHardSessionResponse.js
//
// Post-Hard-Session Response analyzer — tracks next-morning recovery
// markers (sleep hours, resting HR, HRV) after each hard session
// (RPE >= 7) over a 28-day window, then bands the average delta vs
// per-field baseline as STRONG / NORMAL / WEAK.
//
// Reference:
//   Plews D.J. et al. (2013) — Heart-rate variability and training
//     intensity distribution in elite rowers.
//   Buchheit M. (2014) — Monitoring training status with HR-derived
//     measures: rationale and practical recommendations.
//
// Pure function. No React. No I/O.

const MS_PER_DAY = 86400000
const WINDOW_DAYS = 28
const HARD_RPE = 7
const MIN_PAIRS = 3

function dayMs(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function msToISO(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

function median(vals) {
  const arr = vals.filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b)
  if (arr.length === 0) return null
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid]
}

function average(vals) {
  const arr = vals.filter(v => Number.isFinite(v))
  if (arr.length === 0) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

/**
 * @description Classify the averaged next-day-recovery deltas.
 *   - STRONG: avg sleepDelta >= +0.2h AND avg rhrDelta <= -1 bpm
 *             (or HRV >= +5 ms when rhrDelta missing)
 *   - WEAK:   avg rhrDelta >= +3 bpm OR avg sleepDelta <= -0.5h
 *   - NORMAL: otherwise
 */
export function classifyResponseBand({ avgSleepDelta, avgRhrDelta, avgHrvDelta }) {
  // WEAK takes priority — clear stress markers
  if (Number.isFinite(avgRhrDelta) && avgRhrDelta >= 3) return 'WEAK'
  if (Number.isFinite(avgSleepDelta) && avgSleepDelta <= -0.5) return 'WEAK'

  // STRONG — sleep up AND (RHR down or HRV up if RHR missing)
  const sleepUp = Number.isFinite(avgSleepDelta) && avgSleepDelta >= 0.2
  const rhrDown = Number.isFinite(avgRhrDelta) && avgRhrDelta <= -1
  const hrvUp = Number.isFinite(avgHrvDelta) && avgHrvDelta >= 5
  if (sleepUp && rhrDown) return 'STRONG'
  if (sleepUp && !Number.isFinite(avgRhrDelta) && hrvUp) return 'STRONG'

  return 'NORMAL'
}

/**
 * @description Analyze post-hard-session recovery response.
 *
 * @param {{
 *   log:      Array<{ date?: string, rpe?: number, tss?: number, type?: string }>,
 *   recovery: Array<{ date?: string, sleepHrs?: number, restingHR?: number, hrv?: number }>,
 *   today?:   string  // 'YYYY-MM-DD'; defaults to today UTC
 * }} input
 * @returns {null | {
 *   band: 'STRONG'|'NORMAL'|'WEAK',
 *   pairCount: number,
 *   avgSleepDelta: number|null,
 *   avgRhrDelta: number|null,
 *   avgHrvDelta: number|null,
 *   baseline: { sleep: number|null, rhr: number|null, hrv: number|null },
 *   citation: string
 * }}
 */
export function analyzePostHardSessionResponse({ log, recovery, today } = {}) {
  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(tToday)
  if (todayMs == null) return null

  const cutoffMs = todayMs - WINDOW_DAYS * MS_PER_DAY

  const logArr = Array.isArray(log) ? log : []
  const recArr = Array.isArray(recovery) ? recovery : []

  // Build a recovery lookup by date for O(1) next-day pairing
  const recByDate = new Map()
  for (const r of recArr) {
    const ms = dayMs(r?.date)
    if (ms == null) continue
    recByDate.set(msToISO(ms), r)
  }

  // Baseline: median across the full window of recovery entries
  // (per field). Allow recovery entries even slightly outside the
  // session-pair window to inform baseline, but cap on today.
  const recoveryInWindow = recArr.filter(r => {
    const ms = dayMs(r?.date)
    return ms != null && ms >= cutoffMs && ms <= todayMs
  })

  const sleepVals = recoveryInWindow.map(r => {
    const v = Number(r?.sleepHrs)
    return Number.isFinite(v) && v > 0 && v < 24 ? v : NaN
  })
  const rhrVals = recoveryInWindow.map(r => {
    const v = Number(r?.restingHR)
    return Number.isFinite(v) && v >= 30 && v <= 120 ? v : NaN
  })
  const hrvVals = recoveryInWindow.map(r => {
    const v = Number(r?.hrv)
    return Number.isFinite(v) && v > 0 && v < 300 ? v : NaN
  })

  const baselineSleep = median(sleepVals)
  const baselineRHR = median(rhrVals)
  const baselineHRV = median(hrvVals)

  // Find hard sessions in window, pair with next-day recovery
  const sleepDeltas = []
  const rhrDeltas = []
  const hrvDeltas = []
  let pairCount = 0

  for (const e of logArr) {
    const sessMs = dayMs(e?.date)
    if (sessMs == null || sessMs < cutoffMs || sessMs > todayMs) continue
    const rpe = Number(e?.rpe)
    if (!Number.isFinite(rpe) || rpe < HARD_RPE) continue

    const nextDayMs = sessMs + MS_PER_DAY
    if (nextDayMs > todayMs) continue
    const nextDayISO = msToISO(nextDayMs)
    const rec = recByDate.get(nextDayISO)
    if (!rec) continue

    let hasAnyField = false

    const sHrs = Number(rec.sleepHrs)
    if (Number.isFinite(sHrs) && sHrs > 0 && sHrs < 24 && Number.isFinite(baselineSleep)) {
      sleepDeltas.push(sHrs - baselineSleep)
      hasAnyField = true
    }
    const rhr = Number(rec.restingHR)
    if (Number.isFinite(rhr) && rhr >= 30 && rhr <= 120 && Number.isFinite(baselineRHR)) {
      rhrDeltas.push(rhr - baselineRHR)
      hasAnyField = true
    }
    const hrv = Number(rec.hrv)
    if (Number.isFinite(hrv) && hrv > 0 && hrv < 300 && Number.isFinite(baselineHRV)) {
      hrvDeltas.push(hrv - baselineHRV)
      hasAnyField = true
    }

    if (hasAnyField) pairCount++
  }

  // Require enough pairs in at least one field to be diagnostic
  const maxFieldPairs = Math.max(sleepDeltas.length, rhrDeltas.length, hrvDeltas.length)
  if (pairCount < MIN_PAIRS || maxFieldPairs < MIN_PAIRS) return null

  const avgSleepDelta = sleepDeltas.length >= MIN_PAIRS ? average(sleepDeltas) : null
  const avgRhrDelta = rhrDeltas.length >= MIN_PAIRS ? average(rhrDeltas) : null
  const avgHrvDelta = hrvDeltas.length >= MIN_PAIRS ? average(hrvDeltas) : null

  const band = classifyResponseBand({ avgSleepDelta, avgRhrDelta, avgHrvDelta })

  return {
    band,
    pairCount,
    avgSleepDelta,
    avgRhrDelta,
    avgHrvDelta,
    baseline: {
      sleep: baselineSleep,
      rhr: baselineRHR,
      hrv: baselineHRV,
    },
    citation: 'Plews 2013; Buchheit 2014',
  }
}

export const POST_HARD_RESPONSE_CITATION = 'Plews 2013; Buchheit 2014'
