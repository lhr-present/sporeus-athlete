// ─── src/lib/athlete/sleepDebt.js ────────────────────────────────────────────
// Rolling sleep debt (cumulative shortfall vs target) over a trailing window.
//
// Most athletes need 8h sleep/night (some require 9–10h during heavy
// training blocks). A 7-day rolling deficit — i.e. the sum of
// max(0, target − actual) across each of the last 7 days — is the canonical
// "sleep debt" metric used in sport-science literature. 4h+ rolling deficit
// correlates with impaired adaptation and elevated injury risk
// (Milewski 2014).
//
// Surplus sleep (a 9h night when target is 8h) does NOT subtract from prior
// debt by default. The rationale: an athlete who slept 4h Monday cannot
// fully "make up" the adaptation hit by sleeping 10h Saturday — the
// physiological window for the missed night is gone. We surface the raw
// daily deficits so the card can show the texture; the headline number
// is the clamped sum.
//
// References:
//   Walker 2017   — Why We Sleep (recovery/adaptation pathways)
//   Mah 2011      — Sleep extension improves athletic performance
//   Halson 2014   — Sleep and the elite athlete
//   Milewski 2014 — Chronic lack of sleep & injury risk in athletes

export const SLEEP_DEBT_CITATION = 'Walker 2017; Mah 2011; Halson 2014; Milewski 2014'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Match SleepRestingHRCard precedent: primary field is `sleepHrs`; fall back
// to long-form `sleepHours` so any caller that names the field either way
// works. Same sanity bounds as `parseSleepHrs` in sleepRestingHR.js
// (0 < v < 24, 1-decimal precision).
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

function classify(debtHours) {
  if (debtHours <= 1) return 'NONE'
  if (debtHours <= 4) return 'MINOR'
  if (debtHours <= 8) return 'MODERATE'
  return 'SEVERE'
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the rolling sleep debt across a trailing `windowDays` window.
 *
 * @param {Object} params
 * @param {Array}  params.recovery         Recovery entries (date, sleepHrs, ...)
 * @param {Object} [params.profile]        Profile object; reads `sleepTargetHours`
 * @param {string} [params.today]          ISO date 'YYYY-MM-DD'; defaults to system today
 * @param {number} [params.windowDays=7]   Trailing days to include
 * @returns {{ debtHours:number, targetHours:number, daysCounted:number,
 *             dailyDeficits:Array<{date:string,deficit:number}>,
 *             band:'NONE'|'MINOR'|'MODERATE'|'SEVERE',
 *             citation:string } | null}
 */
export function computeSleepDebt({
  recovery,
  profile,
  today,
  windowDays = 7,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  const windowN = Math.max(1, Math.floor(Number(windowDays) || 7))

  // Profile override; fall back to 8h. Sanity-bounded to a sane range.
  const rawTarget = parseFloat(profile?.sleepTargetHours)
  const targetHours = Number.isFinite(rawTarget) && rawTarget >= 4 && rawTarget <= 12
    ? Math.round(rawTarget * 10) / 10
    : 8

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

  // Build the daily deficit array oldest-first by walking the window.
  const dailyDeficits = []
  let daysCounted = 0
  let debtHours = 0
  const cursor = new Date(cutoff.getTime())
  while (cursor <= todayDate) {
    const iso = toISO(cursor)
    const entry = recoveryByDate.get(iso)
    const sleep = pickSleepHours(entry)
    if (sleep !== null) {
      const deficit = Math.max(0, targetHours - sleep)
      dailyDeficits.push({
        date: iso,
        deficit: Math.round(deficit * 10) / 10,
      })
      debtHours += deficit
      daysCounted += 1
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (daysCounted === 0) return null

  // Surplus days don't subtract — already enforced by max(0, ...) above.
  // Round the headline to one decimal so the card renders clean.
  debtHours = Math.max(0, Math.round(debtHours * 10) / 10)

  return {
    debtHours,
    targetHours,
    daysCounted,
    dailyDeficits,
    band: classify(debtHours),
    citation: SLEEP_DEBT_CITATION,
  }
}
