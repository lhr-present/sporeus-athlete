// ─── src/lib/athlete/sleepConsistency.js ─────────────────────────────────────
// 28-day sleep CONSISTENCY tracker — i.e. how *regular* an athlete's sleep
// duration is, not how much they sleep on average.
//
// Distinct from:
//   - sleepDebt.js          — cumulative shortfall vs target (Walker / Milewski)
//   - preRaceSleepBanking.js — race-window surplus protocol (Mah 2011)
//
// This card measures REGULARITY. Even an athlete who averages an OK 7.5h
// can be hurting recovery if their nightly duration swings between 4h and
// 10h — the variance is what disrupts the circadian rhythm. The Sleep
// Regularity Index literature (Lunsford-Avery 2018) operationalised this
// as "the more consistent the timing & duration, the better the
// downstream physiology." Walker 2017 (Why We Sleep, chapter on sleep
// regularity) makes the same point for performance/recovery.
//
// Method:
//   - take the trailing `windowDays` recovery window (default 28)
//   - keep only entries where sleepHrs is a finite number > 0
//   - need at least 7 valid entries (else return null — sample too small)
//   - compute mean + population stdev (σ, divisor N) of sleepHrs
//   - classify into a regularity band:
//       TIGHT   — σ < 0.75h (within ~45 min variation)
//       LOOSE   — 0.75 ≤ σ < 1.5h
//       ERRATIC — σ ≥ 1.5h (90+ min swings)
//   - surface shortest + longest nights so the card can show the range
//
// References:
//   Walker 2017          — Why We Sleep (sleep regularity chapter)
//   Hirshkowitz 2015     — NSF sleep duration recommendations
//   Lunsford-Avery 2018  — Validation of the Sleep Regularity Index

export const SLEEP_CONSISTENCY_CITATION = 'Walker 2017; Lunsford-Avery 2018'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Match the existing sleepDebt.js / preRaceSleepBanking.js convention so
// recovery rows read identically across all sleep cards. Primary field is
// `sleepHrs`; long-form `sleepHours` is accepted as a fallback. Same
// sanity bounds (0 < v < 24).
function pickSleepHours(entry) {
  if (!entry) return null
  const raw = entry.sleepHrs ?? entry.sleepHours
  const v = parseFloat(raw)
  if (!Number.isFinite(v)) return null
  if (v <= 0 || v >= 24) return null
  return Math.round(v * 10) / 10
}

function parseISODate(s) {
  if (typeof s !== 'string' || s.length < 10) return null
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function toISO(d) { return d.toISOString().slice(0, 10) }

function classify(stdSleepHrs) {
  if (stdSleepHrs < 0.75) return 'TIGHT'
  if (stdSleepHrs < 1.5) return 'LOOSE'
  return 'ERRATIC'
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse the 28-day variance of sleep duration.
 *
 * @param {Object} params
 * @param {Array}  params.recovery         Recovery entries (date, sleepHrs, ...)
 * @param {string} [params.today]          ISO date 'YYYY-MM-DD'; defaults to system today
 * @param {number} [params.windowDays=28]  Trailing days to include
 * @returns {{
 *   band:'TIGHT'|'LOOSE'|'ERRATIC',
 *   avgSleepHrs:number,
 *   stdSleepHrs:number,
 *   shortestHrs:number,
 *   longestHrs:number,
 *   sampleCount:number,
 *   citation:string,
 * } | null}
 */
export function analyzeSleepConsistency({
  recovery,
  today,
  windowDays = 28,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  const windowN = Math.max(1, Math.floor(Number(windowDays) || 28))

  const todayDate = parseISODate(today) || (() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    return d
  })()
  const todayISO = toISO(todayDate)

  const cutoff = new Date(todayDate.getTime())
  cutoff.setUTCDate(cutoff.getUTCDate() - (windowN - 1))
  const cutoffISO = toISO(cutoff)

  // De-dupe by date — one recovery row per day (latest write wins).
  const recoveryByDate = new Map()
  for (const r of recovery) {
    if (!r || typeof r.date !== 'string') continue
    const d = r.date.slice(0, 10)
    if (d < cutoffISO || d > todayISO) continue
    recoveryByDate.set(d, r)
  }

  // Collect valid sleepHrs values.
  const vals = []
  for (const r of recoveryByDate.values()) {
    const v = pickSleepHours(r)
    if (v !== null) vals.push(v)
  }

  if (vals.length < 7) return null

  // Mean + population stdev (divisor N, not N-1 — we treat the window as
  // the full population, not a sample of a larger one).
  const n = vals.length
  const sum = vals.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const variance = vals.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n
  const stdev = Math.sqrt(variance)

  const shortest = Math.min(...vals)
  const longest = Math.max(...vals)

  // Round to one decimal so the card renders clean.
  const avgSleepHrs = Math.round(mean * 10) / 10
  const stdSleepHrs = Math.round(stdev * 100) / 100  // 2dp for σ
  const shortestHrs = Math.round(shortest * 10) / 10
  const longestHrs = Math.round(longest * 10) / 10

  return {
    band: classify(stdev),
    avgSleepHrs,
    stdSleepHrs,
    shortestHrs,
    longestHrs,
    sampleCount: n,
    citation: SLEEP_CONSISTENCY_CITATION,
  }
}
