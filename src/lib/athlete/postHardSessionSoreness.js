// src/lib/athlete/postHardSessionSoreness.js
//
// Post-Hard-Session Soreness — surfaces the athlete's typical SORENESS
// score the morning AFTER each hard training session, over a 60-day
// window.
//
// Scientific premise:
//   - Kellmann (2018) — muscle soreness the day after a hard session is
//     normal; the *pattern* over many sessions (rather than any single
//     value) is what discriminates healthy adaptation from accumulated
//     fatigue.
//   - Lemyre (2007) — chronically elevated post-hard soreness (beyond
//     baseline) is a precursor signature of overtraining and incomplete
//     recovery. Conversely, soreness that never moves above baseline
//     after hard work can signal an under-training stimulus or that the
//     "hard" sessions are not actually hard enough to drive adaptation.
//
// Distinct from sibling cards:
//   - PostHardSessionResponseCard — uses sleep / RHR / HRV deltas vs a
//     baseline median; this card targets the simpler, lower-friction
//     subjective soreness scale that many athletes track even when no
//     wearable data is available.
//   - EnergySorenessDivergenceCard — uses 1-5 Likert quadrants over 28d
//     across both energy AND soreness; this card focuses solely on the
//     post-hard soreness *delta* over 60d.
//
// Inputs:
//   - log       — training log entries  ({date, tss?, ...})
//   - recovery  — recovery log entries  ({date, soreness?, ...})
//   - today     — Date or YYYY-MM-DD ISO string
//   - windowDays         (default 60)
//   - hardTssThreshold   (default 80) — single-session TSS at or above this counts a day as "hard"
//
// Algorithm:
//   1. Resolve today → todayIso. Window = [todayIso - (windowDays-1) .. todayIso].
//   2. For each day in window, dayMaxTss = max over log entries on that
//      date of Number(entry.tss) (finite, >0). dayMaxTss is per-session
//      max (NOT sum) so a multi-easy-session day cannot inflate into
//      "hard" territory.
//   3. A day is HARD if dayMaxTss >= hardTssThreshold.
//   4. For each hard day, look up the next day (hardDate + 1) in the
//      recovery log. soreness = Number(rec.soreness) if finite AND > 0,
//      else null.
//   5. baselineMeanSoreness = mean of Number(rec.soreness) (finite, >0)
//      across ALL recovery entries within the window (regardless of
//      whether they fall post-hard or not), 2dp. 0 if no entries.
//   6. meanNextDaySoreness = mean of non-null nextDaySoreness across
//      events, 2dp. 0 if no non-null events.
//   7. sorenessElevation = meanNextDaySoreness - baselineMeanSoreness, 2dp.
//   8. hardEventCount = number of events with non-null nextDaySoreness.
//   9. If hardEventCount < 5 → INSUFFICIENT_HARD_DATA with zeroed agg.
//  10. Bands (sufficient data):
//        PROLONGED_SORENESS — sorenessElevation >= 1.5
//        NORMAL             — 0.5 <= sorenessElevation < 1.5
//        FAST_RECOVERY      — sorenessElevation < 0.5
//  11. Returns null when `today` is unresolvable.
//
// Pure function. No React, no I/O.

export const POST_HARD_SESSION_SORENESS_CITATION = 'Kellmann 2018; Lemyre 2007'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_DAYS = 60
const DEFAULT_HARD_TSS_THRESHOLD = 80
const MIN_HARD_EVENTS = 5
const PROLONGED_THRESHOLD = 1.5
const NORMAL_THRESHOLD = 0.5

function resolveTodayIso(today) {
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    const y = today.getUTCFullYear()
    const m = String(today.getUTCMonth() + 1).padStart(2, '0')
    const d = String(today.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof today === 'string' && today.length >= 10) {
    const key = today.slice(0, 10)
    if (!ISO_RE.test(key)) return null
    const ts = Date.parse(`${key}T00:00:00Z`)
    if (Number.isNaN(ts)) return null
    return key
  }
  return null
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoPlusDays(iso, days) {
  return isoMinusDays(iso, -days)
}

function round2(x) {
  return Math.round(x * 100) / 100
}

function classifyBand(hardEventCount, sorenessElevation) {
  if (hardEventCount < MIN_HARD_EVENTS) return 'INSUFFICIENT_HARD_DATA'
  if (sorenessElevation >= PROLONGED_THRESHOLD) return 'PROLONGED_SORENESS'
  if (sorenessElevation >= NORMAL_THRESHOLD) return 'NORMAL'
  return 'FAST_RECOVERY'
}

function emptyResult(citation) {
  return {
    band: 'INSUFFICIENT_HARD_DATA',
    events: [],
    meanNextDaySoreness: 0,
    baselineMeanSoreness: 0,
    sorenessElevation: 0,
    hardEventCount: 0,
    citation,
  }
}

/**
 * @param {{
 *   log: Array<{date:string, tss?:number}>,
 *   recovery: Array<{date:string, soreness?:number|string}>,
 *   today: string | Date,
 *   windowDays?: number,
 *   hardTssThreshold?: number,
 * }} args
 * @returns {{
 *   band: 'FAST_RECOVERY'|'NORMAL'|'PROLONGED_SORENESS'|'INSUFFICIENT_HARD_DATA',
 *   events: Array<{
 *     hardDate: string,
 *     hardDayTss: number,
 *     nextDaySoreness: number | null,
 *   }>,
 *   meanNextDaySoreness: number,
 *   baselineMeanSoreness: number,
 *   sorenessElevation: number,
 *   hardEventCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzePostHardSessionSoreness({
  log,
  recovery,
  today,
  windowDays = DEFAULT_WINDOW_DAYS,
  hardTssThreshold = DEFAULT_HARD_TSS_THRESHOLD,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    1,
    Math.floor(Number(windowDays) || DEFAULT_WINDOW_DAYS),
  )
  const thrRaw = Number(hardTssThreshold)
  const safeThr =
    Number.isFinite(thrRaw) && thrRaw > 0 ? thrRaw : DEFAULT_HARD_TSS_THRESHOLD

  const windowStart = isoMinusDays(todayIso, safeWindow - 1)

  // ── Build dayMaxTss across log entries inside the window ───────────────
  const dayMaxTss = Object.create(null)
  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < windowStart) continue
      if (key > todayIso) continue
      const tss = Number(e.tss)
      if (!Number.isFinite(tss) || tss <= 0) continue
      const prev = dayMaxTss[key]
      if (prev == null || tss > prev) dayMaxTss[key] = tss
    }
  }

  // ── Build per-date soreness map (only finite, >0 values count) ─────────
  const sorenessByDate = Object.create(null)
  const baselineSamples = []
  if (Array.isArray(recovery)) {
    for (const r of recovery) {
      if (!r || !r.date) continue
      const key = String(r.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < windowStart) continue
      if (key > todayIso) continue
      const s = Number(r.soreness)
      if (!Number.isFinite(s) || s <= 0) continue
      // If duplicate entries on the same date, keep the first non-null one.
      if (sorenessByDate[key] == null) sorenessByDate[key] = s
      baselineSamples.push(s)
    }
  }

  // ── Detect hard days and their next-day soreness ──────────────────────
  const events = []
  const hardDates = Object.keys(dayMaxTss).sort()
  for (const date of hardDates) {
    const max = dayMaxTss[date]
    if (!(max >= safeThr)) continue
    const next = isoPlusDays(date, 1)
    let nextDaySoreness = null
    const raw = sorenessByDate[next]
    if (Number.isFinite(raw) && raw > 0) nextDaySoreness = raw
    events.push({
      hardDate: date,
      hardDayTss: max,
      nextDaySoreness,
    })
  }

  const nonNullSorenesses = events
    .map((ev) => ev.nextDaySoreness)
    .filter((v) => v != null)
  const hardEventCount = nonNullSorenesses.length

  if (hardEventCount < MIN_HARD_EVENTS) {
    const out = emptyResult(POST_HARD_SESSION_SORENESS_CITATION)
    out.events = events
    return out
  }

  const meanNextDaySoreness = round2(
    nonNullSorenesses.reduce((a, b) => a + b, 0) / nonNullSorenesses.length,
  )

  const baselineMeanSoreness = baselineSamples.length
    ? round2(
        baselineSamples.reduce((a, b) => a + b, 0) / baselineSamples.length,
      )
    : 0

  const sorenessElevation = round2(meanNextDaySoreness - baselineMeanSoreness)

  const band = classifyBand(hardEventCount, sorenessElevation)

  return {
    band,
    events,
    meanNextDaySoreness,
    baselineMeanSoreness,
    sorenessElevation,
    hardEventCount,
    citation: POST_HARD_SESSION_SORENESS_CITATION,
  }
}
