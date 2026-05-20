// ─── trainRestTrainPattern.js — Isolated vs extended rest detection ──────────
// Surfaces the fraction of rest days that are ISOLATED (single rest day flanked
// by training on BOTH sides — the classic "train → rest → train" sandwich) vs
// EXTENDED (≥ 2 consecutive rest days, the only window long enough to drive
// meaningful supercompensation).
//
// Why this is distinct from the other rest cards:
//   • CalendarHolesCard.jsx → multi-day GAPS (≥3 consecutive zero-training)
//   • HardDaySpacingCard.jsx → spacing between HARD days
//   • RestDayDistributionCard.jsx → does each rest day follow a hard day?
//   • DeloadCadenceCard.jsx → ~weekly micro-deload rhythm
//
// This card looks at a different shape entirely: single isolated rest days
// sandwiched between training days. Issurin 2010 and Bompa 2018 argue that a
// single isolated rest day produces minimal supercompensation — the body
// barely has time to begin glycogen replenishment, let alone tissue
// remodelling. Extended rest (≥ 2 consecutive days) is what drives meaningful
// adaptation. A calendar dominated by isolated rest days looks "well-rested"
// to a naive observer but actually leaks adaptation.
//
// Window: last `windowWeeks` ISO weeks (Mon–Sun) ending in the week containing
// `today`, matching the convention used by weeklyTssVariance.js. The day-strip
// itself spans from the Monday of the oldest week through `today` inclusive.
//
// Pure function — no React, no I/O.
// ─────────────────────────────────────────────────────────────────────────────

export const TRAIN_REST_TRAIN_PATTERN_CITATION = 'Issurin 2010; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 12
const MIN_TOTAL_REST_DAYS = 6
const EXTENDED_DOMINANT_SHARE_CEIL = 0.30
const EXTENDED_DOMINANT_MIN_BLOCKS = 2
const ISOLATED_DOMINANT_SHARE_FLOOR = 0.70

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) {
      // Reject calendar-impossible dates (e.g. Feb 30).
      const y = Number(key.slice(0, 4))
      const m = Number(key.slice(5, 7))
      const d = Number(key.slice(8, 10))
      const dt = new Date(Date.UTC(y, m - 1, d))
      if (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
      ) return key
    }
  }
  return null
}

function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7  // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00Z').getTime()
  const b = new Date(isoB + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}

// ─── Active-day check ───────────────────────────────────────────────────────
// A calendar day counts as ACTIVE if ANY log entry on that date has a finite
// tss > 0, duration_min/durationMin > 0, OR distance_km/distanceKm > 0.
// Otherwise the day is REST. Matches the rule used by calendarHoles.js.
function isActiveEntry(e) {
  if (!e || typeof e !== 'object') return false
  const tss = Number(e.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  const dur = Number(e.duration_min ?? e.durationMin ?? e.duration)
  if (Number.isFinite(dur) && dur > 0) return true
  const dist = Number(e.distance_km ?? e.distanceKm ?? e.distance)
  if (Number.isFinite(dist) && dist > 0) return true
  return false
}

// ─── Band classification ────────────────────────────────────────────────────
function classifyBand({
  totalRestDays,
  isolatedShare,
  extendedRestBlocks,
}) {
  if (totalRestDays < MIN_TOTAL_REST_DAYS) return 'INSUFFICIENT_REST_DAYS'
  if (
    isolatedShare <= EXTENDED_DOMINANT_SHARE_CEIL &&
    extendedRestBlocks >= EXTENDED_DOMINANT_MIN_BLOCKS
  ) return 'EXTENDED_REST_DOMINANT'
  if (isolatedShare >= ISOLATED_DOMINANT_SHARE_FLOOR) return 'ISOLATED_REST_DOMINANT'
  return 'BALANCED'
}

// ─── analyzeTrainRestTrainPattern ───────────────────────────────────────────
/**
 * Classify a 12-week rest-day pattern as isolated-vs-extended dominant.
 *
 * @param {{
 *   log: Array<{ date: string|Date, tss?: number, duration_min?: number,
 *                durationMin?: number, duration?: number,
 *                distance_km?: number, distanceKm?: number, distance?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'EXTENDED_REST_DOMINANT'|'BALANCED'|'ISOLATED_REST_DOMINANT'|'INSUFFICIENT_REST_DAYS',
 *   isolatedRestDays: number,
 *   extendedRestBlocks: number,
 *   extendedRestDaysTotal: number,
 *   totalRestDays: number,
 *   isolatedShare: number,
 *   longestRestBlockDays: number,
 *   citation: string,
 * } | null}
 */
export function analyzeTrainRestTrainPattern({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWeeks = Math.max(
    1,
    Math.floor(Number.isFinite(windowWeeks) ? windowWeeks : DEFAULT_WINDOW_WEEKS)
  )

  // Window spans from the Monday of (currentMonday - (safeWeeks-1) weeks)
  // through today inclusive — i.e. the calendar-day span used by the strip.
  const currentMonday = isoMondayOf(todayIso)
  const windowStart = isoAddDays(currentMonday, -(safeWeeks - 1) * 7)
  const spanDays = daysBetween(windowStart, todayIso) + 1
  if (spanDays <= 0) return null

  // Bucket activity by date for O(1) lookup.
  const activeSet = new Set()
  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e) continue
      let dIso = null
      if (e.date instanceof Date && !Number.isNaN(e.date.getTime())) {
        dIso = e.date.toISOString().slice(0, 10)
      } else if (typeof e.date === 'string' && e.date) {
        const key = e.date.slice(0, 10)
        if (ISO_RE.test(key)) dIso = key
      }
      if (!dIso) continue
      if (isActiveEntry(e)) activeSet.add(dIso)
    }
  }

  // Build the day-strip: true = ACTIVE, false = REST.
  const active = new Array(spanDays)
  for (let i = 0; i < spanDays; i++) {
    const iso = isoAddDays(windowStart, i)
    active[i] = activeSet.has(iso)
  }

  // Walk the strip and identify maximal consecutive REST runs ("blocks").
  let isolatedRestDays = 0
  let extendedRestBlocks = 0
  let extendedRestDaysTotal = 0
  let totalRestDays = 0
  let longestRestBlockDays = 0

  let runStart = -1
  for (let i = 0; i < spanDays; i++) {
    const isRest = !active[i]
    if (isRest && runStart === -1) runStart = i
    const atEnd = i === spanDays - 1
    const closesRun = isRest && (atEnd || active[i + 1])
    if (closesRun) {
      const length = i - runStart + 1
      totalRestDays += length
      if (length > longestRestBlockDays) longestRestBlockDays = length

      const isLeadingEdge = runStart === 0
      const isTrailingEdge = i === spanDays - 1

      if (length === 1) {
        // Isolated rest = length-1 block with BOTH neighbours ACTIVE in-window.
        // Leading or trailing edge → cannot satisfy "both neighbours" → not
        // classified as isolated. (Still counted under totalRestDays above.)
        if (!isLeadingEdge && !isTrailingEdge) {
          // Safe to read [runStart - 1] and [runStart + 1] — both in-window.
          if (active[runStart - 1] && active[runStart + 1]) {
            isolatedRestDays += 1
          }
        }
      } else {
        // Extended rest block (length ≥ 2) is counted regardless of edge
        // status — per spec, edge blocks of length ≥ 2 ARE classified as
        // extended.
        extendedRestBlocks += 1
        extendedRestDaysTotal += length
      }
      runStart = -1
    }
  }

  const isolatedShare = round4(
    isolatedRestDays / Math.max(totalRestDays, 1)
  )

  const band = classifyBand({
    totalRestDays,
    isolatedShare,
    extendedRestBlocks,
  })

  return {
    band,
    isolatedRestDays,
    extendedRestBlocks,
    extendedRestDaysTotal,
    totalRestDays,
    isolatedShare,
    longestRestBlockDays,
    citation: TRAIN_REST_TRAIN_PATTERN_CITATION,
  }
}

export default analyzeTrainRestTrainPattern
