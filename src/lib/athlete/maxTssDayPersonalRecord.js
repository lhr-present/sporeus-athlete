// ─── maxTssDayPersonalRecord.js — Peak single-day TSS vs lifetime dist ──────
// Surfaces the BIGGEST single-day TSS in the last `recentWindowDays` (default
// 90) and ranks it against the athlete's lifetime distribution of daily TSS
// totals.
//
// Why a separate card from WeeklyVolumeRecord / PeakWeekFrequency:
//   - WeeklyVolumeRecord asks "where does CURRENT week sit?" — weekly grain.
//   - PeakWeekFrequency asks "how dense are near-peak weeks?" — block grain.
//   - This card asks "what is your biggest single-day load lately, and how
//     does that one day compare to every day you've ever trained?". A
//     280-TSS Saturday on top of a quiet week is a distinct physiological
//     event from spreading the same load across 3 days. Issurin 2010 and
//     Daniels 2014 both treat single-day peak intensity as separable from
//     peak weekly volume.
//
// Bands (when sufficient history):
//   NEW_RECORD       — recent peak > lifetime peak day
//   TOP_5            — recent peak ranks 1..5 in lifetime distribution
//   TOP_20_PERCENT   — percentile ≥ 80 (and not TOP_5)
//   TYPICAL          — 20 ≤ percentile < 80
//   BELOW_TYPICAL    — percentile < 20
//
// INSUFFICIENT_HISTORY: fewer than 30 lifetime days (i.e. outside the recent
// window) with dayTss > 0. The recent peak is still surfaced when available.
//
// Pure — no React, no globals.
//
// Cite: Issurin 2010 — block periodization concentrated loading windows;
//       Daniels 2014 — single-day peak intensity in run-training design.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_TSS_DAY_PERSONAL_RECORD_CITATION = 'Issurin 2010; Daniels 2014'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

const MIN_LIFETIME_DAYS = 30

// ─── Helpers ────────────────────────────────────────────────────────────────
function toDate(input) {
  if (input === undefined || input === null) return null
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    return new Date(input.getTime())
  }
  if (typeof input === 'string' && input.length > 0) {
    const d = new Date(input.length === 10 ? input + 'T00:00:00Z' : input)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function toIsoDate(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

function entryTss(e) {
  if (!e) return 0
  const v = Number(e.tss)
  return Number.isFinite(v) && v > 0 ? v : 0
}

function emptyInsufficient({ recentPeakTss = 0, recentPeakDate = '' } = {}) {
  return {
    band: 'INSUFFICIENT_HISTORY',
    recentPeakTss,
    recentPeakDate,
    lifetimePeakTss: 0,
    lifetimePeakDate: '',
    recentRank: 0,
    recentPercentile: 0,
    totalHistoricalDays: 0,
    citation: MAX_TSS_DAY_PERSONAL_RECORD_CITATION,
  }
}

// ─── analyzeMaxTssDayPersonalRecord ─────────────────────────────────────────
/**
 * @param {Object} args
 * @param {Array<{date:string, tss?:number}>} args.log
 * @param {Date|string} [args.today]
 * @param {number} [args.recentWindowDays=90]
 * @returns {{
 *   band: 'NEW_RECORD' | 'TOP_5' | 'TOP_20_PERCENT' | 'TYPICAL' | 'BELOW_TYPICAL' | 'INSUFFICIENT_HISTORY',
 *   recentPeakTss: number,
 *   recentPeakDate: string,
 *   lifetimePeakTss: number,
 *   lifetimePeakDate: string,
 *   recentRank: number,
 *   recentPercentile: number,
 *   totalHistoricalDays: number,
 *   citation: string,
 * } | null}
 */
export function analyzeMaxTssDayPersonalRecord({
  log,
  today,
  recentWindowDays = 90,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayDate = toDate(today === undefined ? new Date() : today)
  if (!todayDate) return null

  const safeWindow = Number.isFinite(recentWindowDays) && recentWindowDays > 0
    ? Math.floor(recentWindowDays)
    : 90

  const todayIso = toIsoDate(todayDate)

  // Recent window = [todayIso - (recentWindowDays-1) .. todayIso] inclusive.
  const windowStart = new Date(Date.UTC(
    todayDate.getUTCFullYear(),
    todayDate.getUTCMonth(),
    todayDate.getUTCDate(),
  ))
  windowStart.setUTCDate(windowStart.getUTCDate() - (safeWindow - 1))
  const windowStartIso = toIsoDate(windowStart)

  // Group entries by date.
  const dayTssByDate = new Map()
  for (const e of log) {
    if (!e || !e.date) continue
    const dateStr = String(e.date).slice(0, 10)
    if (!ISO_RE.test(dateStr)) continue
    const tss = entryTss(e)
    if (tss <= 0) continue
    // Validate the calendar date itself (e.g. reject 2026-13-99).
    const d = new Date(dateStr + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) continue
    if (toIsoDate(d) !== dateStr) continue
    dayTssByDate.set(dateStr, (dayTssByDate.get(dateStr) || 0) + tss)
  }

  // Partition into recent vs lifetime (lifetime = all days strictly outside
  // the recent window). Both halves only count days with dayTss > 0.
  const recentDays = [] // { date, tss }
  const lifetimeDays = []
  for (const [date, tss] of dayTssByDate) {
    if (tss <= 0) continue
    if (date >= windowStartIso && date <= todayIso) {
      recentDays.push({ date, tss })
    } else {
      lifetimeDays.push({ date, tss })
    }
  }

  // Find recent peak first (so the INSUFFICIENT_HISTORY return can include
  // it). Tie-break: LATEST date wins (show most recent peak).
  let recentPeakTss = 0
  let recentPeakDate = ''
  for (const d of recentDays) {
    if (d.tss > recentPeakTss) {
      recentPeakTss = d.tss
      recentPeakDate = d.date
    } else if (d.tss === recentPeakTss && d.date > recentPeakDate) {
      recentPeakDate = d.date
    }
  }

  // If the recent window has no positive-TSS days, we have no peak to
  // evaluate at all — caller should hide this card.
  if (recentDays.length === 0) return null

  // Need enough lifetime history for the distribution to mean anything.
  if (lifetimeDays.length < MIN_LIFETIME_DAYS) {
    return emptyInsufficient({
      recentPeakTss: Math.round(recentPeakTss),
      recentPeakDate,
    })
  }

  // Find lifetime peak. Tie-break: EARLIEST date wins (the original
  // achievement, not the most recent matching day).
  let lifetimePeakTss = 0
  let lifetimePeakDate = ''
  for (const d of lifetimeDays) {
    if (d.tss > lifetimePeakTss) {
      lifetimePeakTss = d.tss
      lifetimePeakDate = d.date
    } else if (d.tss === lifetimePeakTss && (lifetimePeakDate === '' || d.date < lifetimePeakDate)) {
      lifetimePeakDate = d.date
    }
  }

  // Rank: count of lifetime days strictly > recentPeakTss, +1.
  // Strict greater means ties slot recent into the top.
  let strictlyGreater = 0
  let strictlyLess = 0
  for (const d of lifetimeDays) {
    if (d.tss > recentPeakTss) strictlyGreater++
    else if (d.tss < recentPeakTss) strictlyLess++
  }
  const recentRank = strictlyGreater + 1
  const recentPercentile = Math.round((strictlyLess / lifetimeDays.length) * 100)

  // Band classification.
  let band
  if (recentPeakTss > lifetimePeakTss) {
    band = 'NEW_RECORD'
  } else if (recentRank <= 5) {
    band = 'TOP_5'
  } else if (recentPercentile >= 80) {
    band = 'TOP_20_PERCENT'
  } else if (recentPercentile >= 20) {
    band = 'TYPICAL'
  } else {
    band = 'BELOW_TYPICAL'
  }

  return {
    band,
    recentPeakTss: Math.round(recentPeakTss),
    recentPeakDate,
    lifetimePeakTss: Math.round(lifetimePeakTss),
    lifetimePeakDate,
    recentRank,
    recentPercentile,
    totalHistoricalDays: lifetimeDays.length,
    citation: MAX_TSS_DAY_PERSONAL_RECORD_CITATION,
  }
}

export default analyzeMaxTssDayPersonalRecord
