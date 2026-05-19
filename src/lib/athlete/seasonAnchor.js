// src/lib/athlete/seasonAnchor.js
//
// Pure-fn: find the athlete's "season anchor" — the lowest 4-week-rolling
// TSS sum in the last `lookbackDays` (default 180) — and quantify how far
// they've climbed from it. This complements absolute fitness metrics
// (CTL/ACWR) with a *relative* macrocycle framing: a 600-TSS week feels
// very different depending on whether the athlete just climbed from a
// 200-TSS nadir or just dropped from a 900-TSS peak.
//
// Scientific grounding:
//   - Hägglund 2013 — early-season ramp-from-baseline velocity correlates
//     with injury risk. Tracking ramp ratio from the rolling 4-week nadir
//     captures the same construct without needing a hand-curated
//     pre-season anchor.
//   - Bompa 2018 — periodization is *relative* to the macrocycle's
//     starting baseline, not to absolute training volumes. The
//     anchor-to-now ramp ratio is the cleanest scalar for that.
//
// Inputs:
//   log           — training log [{ date: 'YYYY-MM-DD', tss: number }]
//   today         — Date OR ISO 'YYYY-MM-DD' anchoring the window's end
//   lookbackDays  — window length to search (default 180 = ~6 months)
//
// Returns:
//   {
//     band:            'AT_ANCHOR' | 'EARLY_RAMP' | 'BUILDING'
//                    | 'PEAK_BLOCK' | 'ABOVE_HISTORY',
//     anchorDate:      string,   // YYYY-MM-DD — last day of lowest window
//     anchor4wTss:     number,   // TSS sum of that lowest 4-week window
//     currentLast4wTss:number,   // TSS sum of the 4-week window ending today
//     daysSinceAnchor: number,   // today - anchorDate, in days
//     rampRatio:       number,   // currentLast4wTss / max(anchor4wTss, 1), 2dp
//     peak4wTss:       number,   // highest 4-week-rolling TSS in lookback
//     peakDate:        string,   // YYYY-MM-DD — last day of peak window
//     citation:        string,
//   } | null

export const SEASON_ANCHOR_CITATION = 'Hägglund 2013; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// 28-day rolling window length.
const ROLL_DAYS = 28

// Need at least 56 days of total log history before today
// (28 warmup + 28 of actual data) for a meaningful season story.
const MIN_LOG_DAYS = 56

// Band thresholds on rampRatio = currentLast4wTss / max(anchor4wTss, 1).
const AT_ANCHOR_MAX   = 1.10
const EARLY_RAMP_MAX  = 1.60
const BUILDING_MAX    = 2.50
// PEAK_BLOCK also requires currentLast4wTss >= 0.95 * peak4wTss.
const PEAK_PROXIMITY  = 0.95

function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

// Resolve `today` (Date | ISO string) → 'YYYY-MM-DD' or null on failure.
function resolveToday(today) {
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    return new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    )).toISOString().slice(0, 10)
  }
  if (typeof today === 'string') {
    // Accept any ISO-ish prefix; require canonical YYYY-MM-DD shape.
    const trimmed = today.slice(0, 10)
    if (!isValidIso(trimmed)) return null
    // Verify the date is real (rejects '2026-02-31').
    const d = new Date(trimmed + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return null
    if (d.toISOString().slice(0, 10) !== trimmed) return null
    return trimmed
  }
  return null
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function daysBetweenIso(startIso, endIso) {
  const a = new Date(startIso + 'T00:00:00Z').getTime()
  const b = new Date(endIso   + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

// Build a daily TSS map keyed by ISO date (sums multi-session days).
function buildTssMap(log) {
  const map = Object.create(null)
  let earliest = null
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const tss = Number(e.tss)
    if (!Number.isFinite(tss)) continue
    map[key] = (map[key] || 0) + tss
    if (earliest === null || key < earliest) earliest = key
  }
  return { map, earliest }
}

function round2(v) { return Math.round(v * 100) / 100 }

/**
 * @param {{
 *   log: Array<{date: string, tss: number}>,
 *   today: Date | string,
 *   lookbackDays?: number,
 * }} args
 * @returns {{
 *   band: 'AT_ANCHOR'|'EARLY_RAMP'|'BUILDING'|'PEAK_BLOCK'|'ABOVE_HISTORY',
 *   anchorDate: string,
 *   anchor4wTss: number,
 *   currentLast4wTss: number,
 *   daysSinceAnchor: number,
 *   rampRatio: number,
 *   peak4wTss: number,
 *   peakDate: string,
 *   citation: string,
 * } | null}
 */
export function analyzeSeasonAnchor({ log, today, lookbackDays = 180 } = {}) {
  const todayIso = resolveToday(today)
  if (!todayIso) return null
  if (!Array.isArray(log) || log.length === 0) return null

  const lb = Math.floor(Number(lookbackDays))
  if (!Number.isFinite(lb) || lb < ROLL_DAYS + 1) return null

  const { map: tssMap, earliest: earliestLogIso } = buildTssMap(log)
  if (!earliestLogIso) return null

  // Require ≥ MIN_LOG_DAYS of history before today (warmup + data).
  const historyDays = daysBetweenIso(earliestLogIso, todayIso) + 1
  if (!Number.isFinite(historyDays) || historyDays < MIN_LOG_DAYS) return null

  // Search window = [todayIso - (lb-1) .. todayIso].
  const windowStartIso = isoMinusDays(todayIso, lb - 1)

  // For a candidate day `d` to have a valid 28-day rolling window, its
  // window's start (d - 27) must lie at-or-after earliestLogIso. We
  // iterate by date.
  let anchor4wTss = Infinity
  let anchorDate  = null
  let peak4wTss   = -Infinity
  let peakDate    = null
  let currentLast4wTss = null

  // Walk every day in the search window (or from earliest valid d, whichever later).
  const earliestValid = isoMinusDays(earliestLogIso, -(ROLL_DAYS - 1)) // earliestLogIso + 27
  const walkStart = windowStartIso > earliestValid ? windowStartIso : earliestValid

  // If walkStart > todayIso there's nothing to walk → null.
  if (walkStart > todayIso) return null

  // Iterate day-by-day from walkStart → todayIso.
  // Use a running 28-day sum that updates by adding today's TSS and
  // removing TSS from 28 days ago.
  let rolling = 0
  // Seed: sum [walkStart-27 .. walkStart-1] so we can add walkStart's
  // TSS on the first iteration.
  for (let i = ROLL_DAYS - 1; i >= 1; i--) {
    const iso = isoMinusDays(walkStart, i)
    rolling += tssMap[iso] || 0
  }

  const cur = new Date(walkStart + 'T00:00:00Z')
  const end = new Date(todayIso  + 'T00:00:00Z')
  while (cur <= end) {
    const isoDay = cur.toISOString().slice(0, 10)
    // Add today's TSS to the rolling window.
    rolling += tssMap[isoDay] || 0

    const isToday = isoDay === todayIso

    // Anchor includes today; earliest tie wins → strict less-than.
    if (rolling < anchor4wTss) {
      anchor4wTss = rolling
      anchorDate  = isoDay
    }
    // Peak EXCLUDES today so ABOVE_HISTORY ("current > historical peak")
    // is reachable. Latest tie wins → less-than-or-equal-to so a later
    // matching historical value overwrites an earlier one.
    if (!isToday && rolling >= peak4wTss) {
      peak4wTss = rolling
      peakDate  = isoDay
    }

    if (isToday) {
      currentLast4wTss = rolling
    }

    // Slide the window forward: remove TSS from the day that just fell
    // out of the trailing 28-day window (which is isoDay - 27).
    const dropIso = isoMinusDays(isoDay, ROLL_DAYS - 1)
    rolling -= tssMap[dropIso] || 0

    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  // Edge case: if peak was never set (walkStart === todayIso), fall back
  // to currentLast4wTss so downstream comparisons still work.
  if (peakDate === null) {
    peak4wTss = currentLast4wTss
    peakDate  = todayIso
  }

  if (anchorDate === null || peakDate === null || currentLast4wTss === null) {
    return null
  }
  if (!Number.isFinite(anchor4wTss) || !Number.isFinite(peak4wTss)) return null

  const anchor4w  = Math.round(anchor4wTss)
  const peak4w    = Math.round(peak4wTss)
  const current4w = Math.round(currentLast4wTss)

  const rampRatio = round2(current4w / Math.max(anchor4w, 1))
  const daysSinceAnchor = daysBetweenIso(anchorDate, todayIso)

  // Classify. Check ABOVE_HISTORY first; PEAK_BLOCK requires both the
  // 2.5× ramp AND proximity to peak.
  let band
  if (current4w > peak4w) {
    band = 'ABOVE_HISTORY'
  } else if (rampRatio >= BUILDING_MAX && current4w >= PEAK_PROXIMITY * peak4w) {
    band = 'PEAK_BLOCK'
  } else if (rampRatio >= BUILDING_MAX) {
    // Ramp is large but we're not near the peak — treat as BUILDING.
    band = 'BUILDING'
  } else if (rampRatio >= EARLY_RAMP_MAX) {
    band = 'BUILDING'
  } else if (rampRatio >= AT_ANCHOR_MAX) {
    band = 'EARLY_RAMP'
  } else {
    band = 'AT_ANCHOR'
  }

  return {
    band,
    anchorDate,
    anchor4wTss:      anchor4w,
    currentLast4wTss: current4w,
    daysSinceAnchor,
    rampRatio,
    peak4wTss:        peak4w,
    peakDate,
    citation:         SEASON_ANCHOR_CITATION,
  }
}
