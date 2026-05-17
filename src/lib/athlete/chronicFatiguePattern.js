// src/lib/athlete/chronicFatiguePattern.js
//
// v9.203.0 — Detect a chronic low-readiness pattern from the recovery log.
//
// `comebackDetector` measures days WITHOUT training. The Recovery
// Protocols Card surfaces for ACUTE low readiness (today). Neither
// catches the muddier middle: athletes who *are* training but log
// drained quick-taps for several days in a row — early-warning
// staleness / sympathetic overload / under-recovery before the OTRS
// threshold is crossed.
//
// Pure function. Counts distinct calendar days within the last 7 that
// had a low-readiness entry. Low = score ≤ 30 (matches the v9.196
// Recovery Protocols quick-tap gate). Returns { isChronic, lowDayCount,
// daysExamined, lastLowDate } — `isChronic` true when count ≥ 3.
//
// Scientific framing:
//   - Halson 2014 (Sports Med 44 Suppl 2:S139-47): subjective wellness
//     ratings ≥3 consecutive days of decline are early markers of
//     under-recovery, sensitive earlier than HRV or performance tests.
//   - Saw 2016 (BJSM 50:281-91): self-report wellness > objective
//     monitoring for predicting load tolerance.
//   - Hooper-Mackinnon questionnaire uses 1–7 scale; we approximate
//     "drained" (1–2 on Hooper) by quick-tap ≤ 30 on our 0–100 scale.

export const CHRONIC_FATIGUE_CITATION =
  'Halson 2014; Saw 2016; Hooper & Mackinnon 1995'

const WINDOW_DAYS = 7
const LOW_DAY_THRESHOLD = 3        // ≥3 low days within the 7-day window
const LOW_SCORE_CUTOFF = 30        // matches v9.196 RP-card quick-tap threshold

function dayKey(iso) {
  if (typeof iso !== 'string') return null
  const d = new Date(iso + 'T12:00:00Z')
  const t = d.getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor(t / 86400000)
}

/**
 * @description Detect a chronic low-readiness pattern.
 * @param {Array} recovery - recovery entries (each { date, score, source, ... })
 * @param {string} [today] - YYYY-MM-DD; defaults to today UTC
 * @returns {{ isChronic: boolean, lowDayCount: number, daysExamined: number, lastLowDate: string | null }}
 */
export function detectChronicFatiguePattern(recovery, today) {
  const tIso = today || new Date().toISOString().slice(0, 10)
  const todayKey = dayKey(tIso)
  if (todayKey == null) {
    return { isChronic: false, lowDayCount: 0, daysExamined: 0, lastLowDate: null }
  }

  const rows = Array.isArray(recovery) ? recovery : []
  // Bucket the latest entry per day (most recent wins by index, since we
  // don't trust ordering of input). Then keep only entries within the
  // last WINDOW_DAYS-1 days inclusive of today.
  const byDay = new Map()
  for (const r of rows) {
    const k = dayKey(r?.date)
    if (k == null) continue
    if (k > todayKey) continue                        // future dates: skip
    if (k < todayKey - (WINDOW_DAYS - 1)) continue    // outside the window
    byDay.set(k, r)
  }

  let lowDayCount = 0
  let lastLowKey = null
  for (const [k, r] of byDay.entries()) {
    const score = Number(r?.score)
    if (!Number.isFinite(score)) continue
    if (score <= LOW_SCORE_CUTOFF) {
      lowDayCount += 1
      if (lastLowKey == null || k > lastLowKey) lastLowKey = k
    }
  }

  const lastLowDate = lastLowKey != null
    ? new Date(lastLowKey * 86400000).toISOString().slice(0, 10)
    : null

  return {
    isChronic:    lowDayCount >= LOW_DAY_THRESHOLD,
    lowDayCount,
    daysExamined: byDay.size,
    lastLowDate,
  }
}

/**
 * v9.208.0 — Trend wrapper.
 *
 * Compares the current 7-day window to the previous 7-day window (days
 * 8–14 back). Returns the detector result for today plus a `delta`
 * (currentLowDays − priorLowDays) and a `direction`:
 *   'worsening' when delta > 0,
 *   'improving' when delta < 0,
 *   'stable'    when delta == 0.
 *
 * Lets the banner tell the athlete whether the pattern is escalating
 * (act now — back off load) or de-escalating (recovery already
 * working — stay the course).
 *
 * @param {Array} recovery
 * @param {string} [today] - YYYY-MM-DD; defaults to today UTC
 * @returns {{ isChronic: boolean, lowDayCount: number, daysExamined: number,
 *             lastLowDate: string|null, prior: { lowDayCount: number },
 *             delta: number, direction: 'worsening'|'improving'|'stable' }}
 */
export function detectChronicFatigueTrend(recovery, today) {
  const tIso = today || new Date().toISOString().slice(0, 10)
  const tKey = dayKey(tIso)
  const current = detectChronicFatiguePattern(recovery, tIso)
  if (tKey == null) {
    return { ...current, prior: { lowDayCount: 0 }, delta: 0, direction: 'stable' }
  }
  // Prior window anchor: 7 days before today.
  const priorKey = tKey - WINDOW_DAYS
  const priorIso = new Date(priorKey * 86400000).toISOString().slice(0, 10)
  const prior = detectChronicFatiguePattern(recovery, priorIso)
  const delta = current.lowDayCount - prior.lowDayCount
  const direction = delta > 0 ? 'worsening' : delta < 0 ? 'improving' : 'stable'
  return {
    ...current,
    prior: { lowDayCount: prior.lowDayCount },
    delta,
    direction,
  }
}

export { WINDOW_DAYS, LOW_DAY_THRESHOLD, LOW_SCORE_CUTOFF }
