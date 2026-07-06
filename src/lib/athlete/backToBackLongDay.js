// src/lib/athlete/backToBackLongDay.js
//
// Back-to-Back Long Days — counts weeks in the last `windowWeeks` ISO weeks
// (Mon–Sun, ending in the week containing `today`) where the athlete completed
// two long sessions (≥`longSessionMinThreshold` minutes) on consecutive
// calendar days.
//
// Why this exists:
//   - Issurin 2010 ("Block Periodization 2: Fundamental Concepts") frames
//     concentrated back-to-back high-load days as the canonical signature of
//     block accumulation (one specific physiological target loaded heavily
//     across consecutive sessions, not diluted across the week).
//   - Daniels 2014 ("Daniels' Running Formula", 3rd ed.) prescribes
//     back-to-back long days as a hallmark prep for late-race fatigue in
//     marathon build phases — the second long day simulates the depleted-
//     glycogen state of the closing miles.
//   - Skorski 2019 ("The Reliability of a Standardized Test Course Used in
//     Combined Training-Camp / Recovery Settings") underscores that
//     back-to-back long days WITHOUT a subsequent recovery window (≥48 h)
//     map onto sustained sympathetic drive and overreaching markers.
//
// This module therefore surfaces BOTH:
//   - the count of back-to-back long-day pairs (positive signal — block
//     accumulation is happening), AND
//   - the subset of those pairs that are NOT followed by ≥48 h of recovery
//     (negative signal — overreaching risk per Skorski 2019).
//
// Bands:
//   NONE         — totalOccurrences = 0
//   OCCASIONAL   — 1–3 occurrences in `windowWeeks`
//   BLOCK_STYLE  — 4–8 occurrences AND flaggedCount/totalOccurrences ≤ 0.5
//   EXCESSIVE    — ≥9 occurrences OR (>0 AND flaggedCount/totalOccurrences > 0.5)
//
// Pure function. No React, no I/O, no mutation of inputs.

export const BACK_TO_BACK_LONG_DAY_CITATION = 'Issurin 2010; Daniels 2014; Skorski 2019'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 12
const DEFAULT_LONG_THRESHOLD_MIN = 90
const NO_RECOVERY_TSS_CEIL = 100

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────

function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) {
      const d = new Date(key + 'T00:00:00Z')
      if (!Number.isNaN(d.getTime())) return key
    }
  }
  return null
}

// Monday-anchored ISO week start for a YYYY-MM-DD string.
function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  return isoAddDays(iso, -days)
}

// ─── Per-day aggregation ────────────────────────────────────────────────────

function entryDurationMin(entry) {
  const raw = entry?.durationMin ?? entry?.duration_min ?? entry?.duration  // v9.483: canonical entries store minutes under `duration` (contract sweep A1 — card was dead without this)
  const d = Number(raw)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function entryTss(entry) {
  const t = Number(entry?.tss)
  return Number.isFinite(t) && t > 0 ? t : 0
}

function entrySport(entry) {
  const s = entry?.sport
  if (typeof s === 'string' && s.trim()) return s.trim()
  const t = entry?.type
  if (typeof t === 'string' && t.trim()) return t.trim()
  return ''
}

function classifyBand(totalOccurrences, flaggedCount) {
  if (totalOccurrences === 0) return 'NONE'
  const flaggedRatio = totalOccurrences > 0 ? flaggedCount / totalOccurrences : 0
  if (totalOccurrences >= 9) return 'EXCESSIVE'
  if (totalOccurrences > 0 && flaggedRatio > 0.5) return 'EXCESSIVE'
  if (totalOccurrences >= 4 && totalOccurrences <= 8 && flaggedRatio <= 0.5) return 'BLOCK_STYLE'
  return 'OCCASIONAL'
}

/**
 * Analyze back-to-back long days across the last `windowWeeks` ISO weeks.
 *
 * @param {object} args
 * @param {Array}  args.log
 *   Training log entries. Each entry should provide:
 *     - date (YYYY-MM-DD)
 *     - duration_min (number, minutes)
 *     - sport / type (string)
 *     - tss (number, optional — used for recovery-flag detection)
 * @param {string|Date} args.today
 *   Reference date (YYYY-MM-DD ISO string or Date instance).
 * @param {number} [args.windowWeeks=12]
 *   Number of trailing ISO weeks (Mon–Sun) in the analysis window.
 * @param {number} [args.longSessionMinThreshold=90]
 *   Minimum duration_min for a day's longest session to count as a "long day".
 *
 * @returns {{
 *   band: 'NONE' | 'OCCASIONAL' | 'BLOCK_STYLE' | 'EXCESSIVE',
 *   occurrences: Array<{
 *     startDate: string,
 *     durationsMin: [number, number],
 *     sportPair: [string, string],
 *     followingTwoDaysTss: number,
 *     flaggedNoRecovery: boolean,
 *   }>,
 *   totalOccurrences: number,
 *   flaggedCount: number,
 *   weeksWithB2B: number,
 *   citation: string,
 * } | null}
 *
 * Returns null only when `today` is unresolvable. Empty / null log returns
 * a populated result with band='NONE' and an empty occurrences array.
 */
export function analyzeBackToBackLongDay({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
  longSessionMinThreshold = DEFAULT_LONG_THRESHOLD_MIN,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    1,
    Math.floor(Number.isFinite(windowWeeks) ? windowWeeks : DEFAULT_WINDOW_WEEKS)
  )
  const threshold = Number.isFinite(longSessionMinThreshold) && longSessionMinThreshold > 0
    ? Number(longSessionMinThreshold)
    : DEFAULT_LONG_THRESHOLD_MIN

  // Window: oldest week's Monday → current week's Sunday.
  const currentMonday = isoMondayOf(todayIso)
  const windowStart = isoMinusDays(currentMonday, (safeWindow - 1) * 7)
  const windowEnd = isoAddDays(currentMonday, 6) // Sunday of current week

  const dayCount = safeWindow * 7

  // Per-day aggregation across the window (and 2 trailing days for recovery
  // check on pairs that start on the last 2 days of the window).
  // dayInfo: { longest: number, sport: string, tss: number }
  const dayInfo = new Map()

  // We also need TSS for the 2 days AFTER the window's last day, so the
  // followingTwoDaysTss is correct when the pair starts on windowEnd-1.
  // Build a key set for all dates we care about (window + 2 trailing days).
  const recoveryEnd = isoAddDays(windowEnd, 2)

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || typeof e.date !== 'string') continue
      const key = e.date.slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < windowStart) continue
      if (key > recoveryEnd) continue

      const dur = entryDurationMin(e)
      const tss = entryTss(e)

      let info = dayInfo.get(key)
      if (!info) {
        info = { longest: 0, sport: '', tss: 0 }
        dayInfo.set(key, info)
      }
      info.tss += tss
      if (dur > info.longest) {
        info.longest = dur
        info.sport = entrySport(e)
      }
    }
  }

  // Build the ordered list of in-window date strings (oldest → newest).
  const windowDates = []
  for (let i = 0; i < dayCount; i++) {
    windowDates.push(isoAddDays(windowStart, i))
  }

  // Scan consecutive day pairs (d, d+1) — both inside the window.
  const occurrences = []
  for (let i = 0; i < windowDates.length - 1; i++) {
    const d1 = windowDates[i]
    const d2 = windowDates[i + 1]
    const info1 = dayInfo.get(d1)
    const info2 = dayInfo.get(d2)
    const day1Long = info1 ? info1.longest : 0
    const day2Long = info2 ? info2.longest : 0
    if (day1Long < threshold) continue
    if (day2Long < threshold) continue

    // Recovery window: TSS sum on [start+2 .. start+3].
    const r1 = isoAddDays(d1, 2)
    const r2 = isoAddDays(d1, 3)
    const r1Tss = (dayInfo.get(r1)?.tss) || 0
    const r2Tss = (dayInfo.get(r2)?.tss) || 0
    const followingTwoDaysTss = r1Tss + r2Tss
    const flaggedNoRecovery = followingTwoDaysTss > NO_RECOVERY_TSS_CEIL

    occurrences.push({
      startDate: d1,
      durationsMin: [day1Long, day2Long],
      sportPair: [info1?.sport || '', info2?.sport || ''],
      followingTwoDaysTss: Math.round(followingTwoDaysTss * 100) / 100,
      flaggedNoRecovery,
    })
  }

  // Distinct ISO weeks (Mon-anchored) containing any occurrence.
  const weekSet = new Set()
  for (const occ of occurrences) {
    weekSet.add(isoMondayOf(occ.startDate))
  }

  const totalOccurrences = occurrences.length
  const flaggedCount = occurrences.reduce((n, o) => n + (o.flaggedNoRecovery ? 1 : 0), 0)
  const weeksWithB2B = weekSet.size
  const band = classifyBand(totalOccurrences, flaggedCount)

  return {
    band,
    occurrences,
    totalOccurrences,
    flaggedCount,
    weeksWithB2B,
    citation: BACK_TO_BACK_LONG_DAY_CITATION,
  }
}
