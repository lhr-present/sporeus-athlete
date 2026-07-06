// src/lib/athlete/postLongRunNextDay.js
//
// Post-Long-Run Next-Day Pattern — for each long run (≥`longRunMinThreshold`
// minutes of running) inside the last `windowWeeks` ISO weeks (Mon–Sun,
// ending in the week containing `today`), classifies what kind of session
// the athlete did the very next calendar day.
//
// Why this exists:
//   - Daniels 2014 ("Daniels' Running Formula", 3rd ed.) is unambiguous:
//     the day AFTER a long run determines recovery quality. Running easy
//     or resting allows the protein-turnover and glycogen-restoration
//     window to actually do its work. Hard work the day after a long run
//     accumulates fatigue without earning new adaptation and is the
//     canonical pre-injury setup.
//   - Pfitzinger 2014 ("Advanced Marathoning", 2nd ed.) reinforces the
//     same principle for marathon and half-marathon build phases — the
//     "recovery day" is the day after the long run, not a generic day
//     placed wherever it fits.
//
// This module surfaces, per long run:
//   - the date of the long run + its duration,
//   - the date of the next calendar day,
//   - the kind of session that next day was: 'rest' | 'easy' | 'moderate' | 'hard',
//   - the next-day TSS sum + next-day duration sum.
//
// Aggregate counts (restDays / easyDays / moderateDays / hardDays) feed the
// band:
//   INSUFFICIENT_LONG_RUNS — totalLongRuns < 4 (need 4+ to see a pattern)
//   IDEAL_RECOVERY         — restOrEasyShare ≥ 0.75
//   AGGRESSIVE_FOLLOWUP    — hardDays / totalLongRuns ≥ 0.40
//   MIXED                  — otherwise
//
// Pure function. No React, no I/O, no mutation of inputs.

export const POST_LONG_RUN_NEXT_DAY_CITATION = 'Daniels 2014; Pfitzinger 2014'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 12
const DEFAULT_LONG_RUN_THRESHOLD_MIN = 90
const RUN_RE = /run/i

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

function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
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

// ─── Entry helpers ──────────────────────────────────────────────────────────

function entryDurationMin(entry) {
  const raw = entry?.durationMin ?? entry?.duration_min ?? entry?.duration  // v9.483: canonical entries store minutes under `duration` (contract sweep A1 — card was dead without this)
  const d = Number(raw)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function entryTss(entry) {
  const t = Number(entry?.tss)
  return Number.isFinite(t) && t > 0 ? t : 0
}

function entryIsRun(entry) {
  if (!entry) return false
  const s = entry.sport
  if (typeof s === 'string' && RUN_RE.test(s)) return true
  const t = entry.type
  if (typeof t === 'string' && RUN_RE.test(t)) return true
  return false
}

function entryDateKey(entry) {
  if (!entry || typeof entry.date !== 'string') return null
  const k = entry.date.slice(0, 10)
  return ISO_RE.test(k) ? k : null
}

function classifyNextDayKind(nextDayTss, nextDayDurationMin) {
  if (nextDayTss === 0 && nextDayDurationMin === 0) return 'rest'
  if (nextDayTss < 40) return 'easy'
  if (nextDayTss < 80) return 'moderate'
  return 'hard'
}

function round4(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10000) / 10000
}

/**
 * Analyze the day-after pattern for each long run in the last `windowWeeks`
 * ISO weeks.
 *
 * @param {object} args
 * @param {Array}  args.log
 *   Training log entries. Each entry should provide:
 *     - date (YYYY-MM-DD)
 *     - durationMin or duration_min (number, minutes)
 *     - sport / type (string) — at least one must match /run/i to count as a
 *       run for long-run detection
 *     - tss (number, optional)
 * @param {string|Date} args.today
 *   Reference date (YYYY-MM-DD ISO string or Date instance).
 * @param {number} [args.windowWeeks=12]
 *   Number of trailing ISO weeks (Mon–Sun) in the analysis window.
 * @param {number} [args.longRunMinThreshold=90]
 *   Minimum duration_min for a running session to count as a "long run".
 *
 * @returns {{
 *   band: 'IDEAL_RECOVERY' | 'MIXED' | 'AGGRESSIVE_FOLLOWUP' | 'INSUFFICIENT_LONG_RUNS',
 *   longRuns: Array<{
 *     longRunDate: string,
 *     longRunMin: number,
 *     nextDay: {
 *       kind: 'rest' | 'easy' | 'moderate' | 'hard',
 *       nextDayTss: number,
 *       nextDayDurationMin: number,
 *     },
 *   }>,
 *   totalLongRuns: number,
 *   restDays: number,
 *   easyDays: number,
 *   moderateDays: number,
 *   hardDays: number,
 *   restOrEasyShare: number,
 *   citation: string,
 * } | null}
 *
 * Returns null when `today` is unresolvable, or when there are zero long
 * runs in the window (nothing to show).
 */
export function analyzePostLongRunNextDay({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
  longRunMinThreshold = DEFAULT_LONG_RUN_THRESHOLD_MIN,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  if (!Array.isArray(log) || log.length === 0) return null

  const safeWindow = Math.max(
    1,
    Math.floor(Number.isFinite(windowWeeks) && windowWeeks > 0 ? windowWeeks : DEFAULT_WINDOW_WEEKS)
  )
  const threshold = Number.isFinite(longRunMinThreshold) && longRunMinThreshold > 0
    ? Number(longRunMinThreshold)
    : DEFAULT_LONG_RUN_THRESHOLD_MIN

  const currentMonday = isoMondayOf(todayIso)
  const windowStart = isoMinusDays(currentMonday, (safeWindow - 1) * 7)
  const windowEnd = isoAddDays(currentMonday, 6)

  // Build a per-day map of ALL entries so we can compute next-day aggregates
  // (TSS + duration). We include 1 trailing day after windowEnd so that a
  // long run that lands on windowEnd can still be classified.
  // dayAgg: { tss: number, durationMin: number }
  const dayAgg = new Map()

  // Index of long runs by date (multiple long runs on the same day collapse
  // into one entry — the longest one's duration drives `longRunMin`).
  // longRunByDate: { longRunMin: number }
  const longRunByDate = new Map()

  for (const e of log) {
    const key = entryDateKey(e)
    if (!key) continue

    const dur = entryDurationMin(e)
    const tss = entryTss(e)

    // Aggregate per-day TSS + duration if inside [windowStart, windowEnd+1].
    // We need windowEnd+1 because the next-day for a long run on windowEnd
    // is windowEnd+1.
    const trailingEnd = isoAddDays(windowEnd, 1)
    if (key >= windowStart && key <= trailingEnd) {
      let agg = dayAgg.get(key)
      if (!agg) {
        agg = { tss: 0, durationMin: 0 }
        dayAgg.set(key, agg)
      }
      agg.tss += tss
      agg.durationMin += dur
    }

    // Long-run candidacy: must be inside the window proper.
    if (key < windowStart || key > windowEnd) continue
    if (!entryIsRun(e)) continue
    if (dur < threshold) continue

    const prev = longRunByDate.get(key)
    if (!prev || dur > prev.longRunMin) {
      longRunByDate.set(key, { longRunMin: dur })
    }
  }

  // Build long-runs list sorted oldest-first by date.
  const dates = Array.from(longRunByDate.keys()).sort()
  // No long runs in the window → nothing to show.
  if (dates.length === 0) return null
  const longRuns = dates.map(d => {
    const nextDayDate = isoAddDays(d, 1)
    const nextAgg = dayAgg.get(nextDayDate)
    const nextDayTss = nextAgg ? Math.round(nextAgg.tss * 100) / 100 : 0
    const nextDayDurationMin = nextAgg ? Math.round(nextAgg.durationMin * 100) / 100 : 0
    const kind = classifyNextDayKind(nextDayTss, nextDayDurationMin)
    return {
      longRunDate: d,
      longRunMin: longRunByDate.get(d).longRunMin,
      nextDay: { kind, nextDayTss, nextDayDurationMin },
    }
  })

  // Tally.
  let restDays = 0
  let easyDays = 0
  let moderateDays = 0
  let hardDays = 0
  for (const lr of longRuns) {
    switch (lr.nextDay.kind) {
      case 'rest': restDays++; break
      case 'easy': easyDays++; break
      case 'moderate': moderateDays++; break
      case 'hard': hardDays++; break
      default: break
    }
  }

  const totalLongRuns = longRuns.length
  const denom = Math.max(totalLongRuns, 1)
  const restOrEasyShare = round4((restDays + easyDays) / denom)

  // Band classification.
  let band
  if (totalLongRuns < 4) {
    band = 'INSUFFICIENT_LONG_RUNS'
  } else if (restOrEasyShare >= 0.75) {
    band = 'IDEAL_RECOVERY'
  } else if ((hardDays / denom) >= 0.40) {
    band = 'AGGRESSIVE_FOLLOWUP'
  } else {
    band = 'MIXED'
  }

  return {
    band,
    longRuns,
    totalLongRuns,
    restDays,
    easyDays,
    moderateDays,
    hardDays,
    restOrEasyShare,
    citation: POST_LONG_RUN_NEXT_DAY_CITATION,
  }
}
