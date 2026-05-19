// src/lib/athlete/cumulativeFatigueWindows.js
//
// Pure-fn: count the number of 7-day rolling windows in the last 90 days
// where rolling-7d TSS exceeded 130% of the same-day CTL (the "functional
// overreaching dose" zone). This is a CHRONIC DOSE counter, not a
// point-in-time state: it answers "how OFTEN has this athlete visited the
// overreaching zone last quarter?" rather than "are they overreaching
// right now?".
//
// Scientific grounding:
//   - Halson 2014 — brief overreaching is adaptive, but REPEATED chronic
//     overreaching exposure raises non-functional overreaching /
//     overtraining risk.
//   - Meeusen 2013 — joint consensus on overtraining: the dose-response
//     curve matters more than any single overreaching episode.
//
// Distinct from existing ACWR / CTL cards:
//   ACWRCard / CtlRampRateCard / CtlSlopeCard answer "today's state".
//   This card answers "how many days of the last 90 sat above the
//   overreaching threshold".
//
// CTL recursion form: Banister/Coggan EWMA with TAU = 42 days, expressed
// as `ctl_t = ctl_{t-1} * exp(-1/42) + tss_t * (1 - exp(-1/42))`. This is
// mathematically equivalent to the canonical
// `ctl_t = ctl_{t-1} + (tss_t - ctl_{t-1}) / 42` form to ≈0.03% per step
// (the difference between exp(-1/42) and 1 - 1/42), but the spec uses the
// exponential form so we preserve it literally.
//
// Inputs:
//   log            — training log [{ date: 'YYYY-MM-DD', tss: number }]
//   today          — ISO string OR Date object
//   windowDays     — analysis window (default 90)
//   overreachRatio — strict-greater-than threshold on rolling7TSS/CTL
//                    (default 1.30)
//
// Returns: see analyzeCumulativeFatigueWindows JSDoc, or null when
// the log is empty, today is unresolvable, or fewer than 14 days of the
// window passed the CTL warmup gate.

export const CUMULATIVE_FATIGUE_WINDOWS_CITATION = 'Halson 2014; Meeusen 2013'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// Banister/Coggan CTL time constant (days).
const CTL_TAU = 42
const ALPHA = Math.exp(-1 / CTL_TAU)             // ctl_{t-1} weight
const BETA  = 1 - Math.exp(-1 / CTL_TAU)         // tss_t weight

// CTL values below this are still in the warmup phase and are excluded
// from BOTH the over-threshold counter AND the totalDays denominator —
// otherwise a brand-new log would report 100% overreach simply because
// ctl ≈ 0 makes every ratio explode.
const CTL_WARMUP_MIN = 10

// Need at least this many warm-CTL days in the window for the exposure
// rate to mean anything.
const MIN_WARM_DAYS = 14

// ─── helpers ────────────────────────────────────────────────────────────

function resolveToday(today) {
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    const y = today.getUTCFullYear()
    const m = String(today.getUTCMonth() + 1).padStart(2, '0')
    const d = String(today.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof today === 'string' && today.length >= 10) {
    const slice = today.slice(0, 10)
    if (!ISO_RE.test(slice)) return null
    // Sanity check: not NaN when parsed.
    const t = Date.parse(`${slice}T00:00:00Z`)
    if (Number.isNaN(t)) return null
    return slice
  }
  return null
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Build a daily TSS map keyed by ISO date (sums multi-session days,
// skips invalid entries / NaN / negative TSS / zero is allowed as a
// valid rest-day entry).
function buildTssMap(log) {
  const map = Object.create(null)
  let earliestIso = null
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const tssRaw = Number(e.tss)
    if (!Number.isFinite(tssRaw)) continue
    if (tssRaw < 0) continue
    map[key] = (map[key] || 0) + tssRaw
    if (earliestIso === null || key < earliestIso) earliestIso = key
  }
  return { map, earliestIso }
}

// Walk CTL from `startIso` through `endIso` (inclusive) using the
// exponential-EWMA recursion in the spec.
// Convention: CTL[startIso - 1 day] = 0.
function walkCtl(tssMap, startIso, endIso) {
  const out = Object.create(null)
  let ctl = 0
  const start = new Date(startIso + 'T00:00:00Z')
  const end   = new Date(endIso   + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    const tss = tssMap[iso] || 0
    ctl = ctl * ALPHA + tss * BETA
    out[iso] = ctl
  }
  return out
}

function classifyBand(exposureRate) {
  if (!Number.isFinite(exposureRate)) return null
  if (exposureRate >= 0.30) return 'CHRONIC_OVERREACH'
  if (exposureRate >= 0.15) return 'ELEVATED_EXPOSURE'
  if (exposureRate >= 0.03) return 'NORMAL'
  return 'CONSERVATIVE'
}

const round2 = v => Math.round(v * 100) / 100
const round4 = v => Math.round(v * 10000) / 10000

/**
 * @param {{
 *   log: Array<{date:string, tss:number}>,
 *   today: string | Date,
 *   windowDays?: number,
 *   overreachRatio?: number,
 * }} args
 * @returns {{
 *   band: 'CONSERVATIVE' | 'NORMAL' | 'ELEVATED_EXPOSURE' | 'CHRONIC_OVERREACH',
 *   windowsAboveThreshold: number,
 *   totalDays: number,
 *   peakRatio: number,
 *   peakRatioDate: string | null,
 *   exposureRate: number,
 *   dailyRatios: Array<{ date: string, ratio: number | null }>,
 *   overreachRatio: number,
 *   windowDays: number,
 *   citation: string,
 * } | null}
 */
export function analyzeCumulativeFatigueWindows({
  log,
  today,
  windowDays = 90,
  overreachRatio = 1.30,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayIso = resolveToday(today)
  if (!todayIso) return null

  const wRaw = Math.floor(Number(windowDays))
  if (!Number.isFinite(wRaw) || wRaw < 1) return null

  const thresh = Number(overreachRatio)
  if (!Number.isFinite(thresh) || thresh <= 0) return null

  const { map: tssMap, earliestIso } = buildTssMap(log)
  if (!earliestIso) return null

  // Window-start: max(today - (windowDays-1), earliestIso). Anything
  // earlier than the log's first entry can't have a CTL anyway.
  const naturalStart = isoMinusDays(todayIso, wRaw - 1)
  const windowStart = naturalStart > earliestIso ? naturalStart : earliestIso

  // CTL walk runs from the EARLIEST log date so CTL is warm before the
  // window — critical: we don't want spurious overreach signals just
  // because the window happens to start right after a long break.
  const ctlByDate = walkCtl(tssMap, earliestIso, todayIso)

  // For each day in the window:
  //   1. rolling7TSS = sum of TSS over [d-6 .. d] inclusive — this is the
  //      "acute load" in the Banister/Hulin ACWR formulation. To compare
  //      against CTL (a daily-equivalent EWMA), we normalise to a daily
  //      rate by dividing by 7. The resulting ratio is exactly the
  //      ACWR-style overreaching dose ratio (Hulin 2016 / Halson 2014)
  //      where 1.30 is the classic functional-overreaching threshold.
  //      Days that fall before the earliest log are treated as TSS=0
  //      (consistent with the CTL walk's "before-log = 0" convention).
  //   2. ratio = (rolling7TSS / 7) / max(ctl, 1)
  //   3. if ctl < CTL_WARMUP_MIN, day is excluded from totalDays and
  //      from the threshold counter (warmup phase).
  //   4. peakRatio updated only on warm days.
  let windowsAboveThreshold = 0
  let totalDays = 0
  let peakRatio = 0
  let peakRatioDate = null
  const dailyRatios = []

  let cursor = new Date(windowStart + 'T00:00:00Z')
  const endTs = new Date(todayIso + 'T00:00:00Z').getTime()

  while (cursor.getTime() <= endTs) {
    const iso = cursor.toISOString().slice(0, 10)

    // Sum TSS over the trailing 7-day window ending on `iso`.
    let rolling7 = 0
    for (let k = 0; k < 7; k++) {
      const ki = isoMinusDays(iso, k)
      rolling7 += tssMap[ki] || 0
    }

    const ctl = ctlByDate[iso] || 0
    if (ctl < CTL_WARMUP_MIN) {
      dailyRatios.push({ date: iso, ratio: null })
    } else {
      const denom = ctl < 1 ? 1 : ctl
      // Mean daily TSS over the trailing 7 days, normalised to CTL units.
      // This is the ACWR-style "acute / chronic" ratio (Hulin 2016) — the
      // overreaching dose interpretation of Halson 2014. Threshold 1.30
      // is the classic functional-overreaching line.
      const ratio = (rolling7 / 7) / denom
      dailyRatios.push({ date: iso, ratio })
      totalDays += 1
      if (ratio > thresh) windowsAboveThreshold += 1
      if (ratio > peakRatio) {
        peakRatio = ratio
        peakRatioDate = iso
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (totalDays < MIN_WARM_DAYS) return null

  const exposureRate = windowsAboveThreshold / Math.max(totalDays, 1)
  const band = classifyBand(exposureRate)
  if (!band) return null

  return {
    band,
    windowsAboveThreshold,
    totalDays,
    peakRatio: round2(peakRatio),
    peakRatioDate,
    exposureRate: round4(exposureRate),
    dailyRatios,
    overreachRatio: thresh,
    windowDays: wRaw,
    citation: CUMULATIVE_FATIGUE_WINDOWS_CITATION,
  }
}
