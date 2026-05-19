// ─── weeklyVolumeRecord.js — All-time peak weekly TSS + current-week rank ────
// Surfaces where the athlete's CURRENT week ranks against their lifetime
// distribution of completed weekly TSS totals. Different intent from
// weeklyVolumeRamp.js: that one is week-over-week injury safety. This one is
// celebratory/contextual — "is this one of your biggest weeks ever, or a
// quiet one?".
//
// Bands:
//   NEW_RECORD       — currentWeekTss > all historical weeks
//   TOP_5            — rank 1..5 in lifetime distribution
//   TOP_20_PERCENT   — percentile ≥ 80 (but not top 5)
//   TYPICAL          — percentile 20-80
//   LOW              — percentile < 20
//
// Pure — no React, no globals.
//
// Cite: Hellard 2019 — "Quantifying the relationship between training load
// and performance" (lifetime training-load distribution as performance
// reference); Issurin 2010 — block periodization, peak microcycle context.
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKLY_VOLUME_RECORD_CITATION = 'Hellard 2019; Issurin 2010'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// Need a reasonable lifetime baseline before this card has anything to say.
const MIN_COMPLETED_WEEKS = 8

// ─── Helpers ────────────────────────────────────────────────────────────────
function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

function toDate(input) {
  if (input instanceof Date) return new Date(input.getTime())
  if (typeof input === 'string') {
    return new Date(input.length === 10 ? input + 'T00:00:00Z' : input)
  }
  return new Date()
}

/** Monday of the training week (Mon-Sun) containing `date`, UTC midnight. */
function mondayOfWeekUTC(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const js = d.getUTCDay() // 0=Sun..6=Sat
  // Distance back to Monday: Sun=6, Mon=0, Tue=1, ..., Sat=5
  const back = (js + 6) % 7
  d.setUTCDate(d.getUTCDate() - back)
  return d
}

function toIsoDate(d) {
  return d.toISOString().slice(0, 10)
}

function entryTss(e) {
  if (!e) return 0
  const v = Number(e.tss)
  return Number.isFinite(v) && v > 0 ? v : 0
}

// ─── analyzeWeeklyVolumeRecord ──────────────────────────────────────────────
/**
 * @param {Object} args
 * @param {Array<{date:string, tss?:number}>} args.log
 * @param {Date|string} [args.today]
 * @returns {{
 *   band: 'NEW_RECORD' | 'TOP_5' | 'TOP_20_PERCENT' | 'TYPICAL' | 'LOW',
 *   peakWeekTss: number,
 *   peakWeekStart: string,
 *   currentWeekTss: number,
 *   currentRank: number,
 *   currentPercentile: number,
 *   totalCompletedWeeks: number,
 *   citation: string,
 * } | null}
 */
export function analyzeWeeklyVolumeRecord({ log, today } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayDate = toDate(today || new Date())
  if (Number.isNaN(todayDate.getTime())) return null

  const currentWeekMonday = mondayOfWeekUTC(todayDate)
  const currentWeekMondayIso = toIsoDate(currentWeekMonday)

  // Accumulate weekly TSS, keyed by ISO date of Monday of that week.
  const weeklySumByMonday = new Map()

  for (const e of log) {
    if (!e || !e.date) continue
    const dateStr = String(e.date).slice(0, 10)
    if (!ISO_RE.test(dateStr)) continue
    const tss = entryTss(e)
    if (tss <= 0) continue

    const d = new Date(dateStr + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) continue
    // Discard entries in the future (after today). The "current week" still
    // counts even if some days haven't happened yet — but a session dated
    // beyond today is nonsense.
    if (d > todayDate) continue

    const monIso = toIsoDate(mondayOfWeekUTC(d))
    weeklySumByMonday.set(monIso, (weeklySumByMonday.get(monIso) || 0) + tss)
  }

  // Current-week TSS (week containing today). May be 0 if no sessions yet
  // this week; that's a valid signal.
  const currentWeekTss = weeklySumByMonday.get(currentWeekMondayIso) || 0

  // Lifetime distribution = ALL weeks with > 0 TSS, EXCLUDING current week.
  const lifetime = []
  for (const [monIso, sum] of weeklySumByMonday) {
    if (monIso === currentWeekMondayIso) continue
    if (sum > 0) lifetime.push({ monIso, tss: sum })
  }

  if (lifetime.length < MIN_COMPLETED_WEEKS) return null

  // Sort lifetime descending by TSS for rank computation.
  // Tie-breaker: earlier monIso wins (so the historical peak is the
  // FIRST time the athlete reached that volume, not the most recent).
  lifetime.sort((a, b) => {
    if (b.tss !== a.tss) return b.tss - a.tss
    return a.monIso < b.monIso ? -1 : 1
  })

  const peakWeek = lifetime[0]
  const peakWeekTss = peakWeek.tss
  const peakWeekStart = peakWeek.monIso

  // Round all values for stable assertions / UI.
  const round1 = v => Math.round(v * 10) / 10
  const roundCurrentWeekTss = round1(currentWeekTss)
  const roundPeakWeekTss = round1(peakWeekTss)

  // Rank within lifetime distribution. Standard competition ranking
  // (tied values share the lower rank). If currentWeekTss > peakWeekTss
  // → rank 1, NEW_RECORD.
  let currentRank
  if (currentWeekTss > peakWeekTss) {
    currentRank = 1
  } else {
    // Number of historical weeks strictly greater than current → those
    // many beat us; our rank is (that count) + 1.
    let strictlyGreater = 0
    for (const w of lifetime) {
      if (w.tss > currentWeekTss) strictlyGreater++
    }
    currentRank = strictlyGreater + 1
  }

  // Percentile: portion of lifetime weeks strictly less than current,
  // normalised to 0..100. Higher = bigger.
  // We use "strict less" so the peak week sits at 100 only if current
  // exceeds it; ties slot in just below.
  const lessCount = lifetime.filter(w => w.tss < currentWeekTss).length
  const currentPercentile = Math.round((lessCount / lifetime.length) * 100)

  // Band classification.
  let band
  if (currentWeekTss > peakWeekTss) {
    band = 'NEW_RECORD'
  } else if (currentRank <= 5) {
    band = 'TOP_5'
  } else if (currentPercentile >= 80) {
    band = 'TOP_20_PERCENT'
  } else if (currentPercentile >= 20) {
    band = 'TYPICAL'
  } else {
    band = 'LOW'
  }

  return {
    band,
    peakWeekTss: roundPeakWeekTss,
    peakWeekStart,
    currentWeekTss: roundCurrentWeekTss,
    currentRank,
    currentPercentile,
    totalCompletedWeeks: lifetime.length,
    citation: WEEKLY_VOLUME_RECORD_CITATION,
  }
}

export default analyzeWeeklyVolumeRecord
