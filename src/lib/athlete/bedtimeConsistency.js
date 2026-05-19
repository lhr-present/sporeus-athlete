// ─── src/lib/athlete/bedtimeConsistency.js ───────────────────────────────────
// 28-day BEDTIME consistency tracker — how regularly the athlete goes to bed
// at the same clock-time hour. Distinct from sleepConsistency.js (which
// measures variance in sleep DURATION). This one measures variance of
// circadian PHASE — the clock at which lights-out happens.
//
// Why a separate card: even at the same nightly duration, drifting bedtime
// shifts circadian phase, hurts recovery, and is the metric Lunsford-Avery
// 2018 operationalised as the Sleep Regularity Index. Walker 2017 (Why We
// Sleep) and Phillips 2017 (Sleep regularity vs academic performance) both
// argue that PHASE regularity matters as much as duration.
//
// Method:
//   - take the trailing `windowDays` recovery window (default 28)
//   - keep only entries where bedtime parses as a valid "HH:MM" (24h)
//   - need at least 7 valid entries (else return null — sample too small)
//   - convert each bedtime to "minutes-from-18:00" using an anchor that
//     keeps midnight-crossing math sane. 18:00–23:59 → 0..359;
//     00:00–05:59 → 360..719. (Bedtimes earlier than 18:00 or later than
//     06:00 are treated as the wraparound — but the function only checks
//     for parseable HH:MM, not the time-of-day plausibility — caller is
//     expected to supply real bedtimes.)
//   - compute mean (avgMinutes) + population stdev (stdMinutes)
//   - classify into a regularity band:
//       STEADY   — σ < 30 min
//       DRIFTING — 30 ≤ σ < 60 min
//       ERRATIC  — σ ≥ 60 min (1+ hour swings)
//   - surface earliest + latest bedtime as HH:MM strings
//
// References:
//   Walker 2017          — Why We Sleep (chronotype + phase regularity)
//   Lunsford-Avery 2018  — Sleep Regularity Index
//   Phillips 2017        — Irregular sleep/wake & academic performance

export const BEDTIME_CONSISTENCY_CITATION = 'Walker 2017; Lunsford-Avery 2018'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Parse "HH:MM" or "H:MM" (24-hour, optional leading zero) → { h, m } or null.
// Strict: rejects "7am", "7:30 pm", empty, non-strings, out-of-range values.
function parseHHMM(s) {
  if (typeof s !== 'string') return null
  const trimmed = s.trim()
  if (trimmed.length < 3) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  if (h < 0 || h > 23) return null
  if (min < 0 || min > 59) return null
  return { h, m: min }
}

// Convert clock-time to "minutes from 18:00", treating hours < 18 as next-day.
// 18:00 → 0, 23:30 → 330, 00:00 → 360, 02:00 → 480, 05:59 → 719.
function clockToMinutesFrom18(h, m) {
  const hour = h < 18 ? h + 24 : h
  return (hour - 18) * 60 + m
}

// Convert "minutes from 18:00" back to "HH:MM" 24-hour string.
function minutesFrom18ToHHMM(mins) {
  // Normalise to [0, 1440) just in case mean math nudges it slightly.
  let total = ((mins % 1440) + 1440) % 1440
  const totalHour = 18 + Math.floor(total / 60)
  const minute = Math.round(total) % 60
  // If rounding minute = 60 pushed us forward, carry it.
  let h = totalHour
  let mm = minute
  if (mm === 60) { mm = 0; h += 1 }
  h = ((h % 24) + 24) % 24
  const hStr = String(h).padStart(2, '0')
  const mStr = String(mm).padStart(2, '0')
  return `${hStr}:${mStr}`
}

function parseISODate(s) {
  if (typeof s !== 'string' || s.length < 10) return null
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function toISO(d) { return d.toISOString().slice(0, 10) }

function classify(stdMinutes) {
  if (stdMinutes < 30) return 'STEADY'
  if (stdMinutes < 60) return 'DRIFTING'
  return 'ERRATIC'
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse the 28-day variance of bedtime (circadian phase regularity).
 *
 * @param {Object} params
 * @param {Array}  params.recovery         Recovery entries (date, bedtime, ...)
 * @param {string} [params.today]          ISO date 'YYYY-MM-DD'; defaults to system today
 * @param {number} [params.windowDays=28]  Trailing days to include
 * @returns {{
 *   band:'STEADY'|'DRIFTING'|'ERRATIC',
 *   avgBedtimeHHMM:string,
 *   stdMinutes:number,
 *   earliestBedtime:string,
 *   latestBedtime:string,
 *   sampleCount:number,
 *   citation:string,
 * } | null}
 */
export function analyzeBedtimeConsistency({
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

  // Collect valid bedtime values, in minutes-from-18:00.
  const minutes = []
  for (const r of recoveryByDate.values()) {
    const parsed = parseHHMM(r.bedtime)
    if (!parsed) continue
    minutes.push(clockToMinutesFrom18(parsed.h, parsed.m))
  }

  if (minutes.length < 7) return null

  // Mean + population stdev (divisor N).
  const n = minutes.length
  const sum = minutes.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const variance = minutes.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n
  const stdev = Math.sqrt(variance)

  const earliest = Math.min(...minutes)
  const latest = Math.max(...minutes)

  // Round σ to 1dp; convert mean → HH:MM.
  const stdMinutes = Math.round(stdev * 10) / 10
  const avgBedtimeHHMM = minutesFrom18ToHHMM(mean)
  const earliestBedtime = minutesFrom18ToHHMM(earliest)
  const latestBedtime = minutesFrom18ToHHMM(latest)

  return {
    band: classify(stdev),
    avgBedtimeHHMM,
    stdMinutes,
    earliestBedtime,
    latestBedtime,
    sampleCount: n,
    citation: BEDTIME_CONSISTENCY_CITATION,
  }
}
