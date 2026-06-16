// src/lib/athlete/lifetimeTotals.js
//
// Lifetime training totals — entire log aggregated, no window.
//
// Distinct from SeasonStats (annual snapshot) and MonthlyProgress
// (month-over-month comparison): this is the cumulative "training
// capital" view across the athlete's whole logged history.
//
// Refs:
//   Bandura A. (1997). Self-efficacy: The exercise of control.
//     New York: W.H. Freeman. — Mastery experiences (the visible
//     accumulation of one's own past performance) are the strongest
//     source of self-efficacy. Surfacing lifetime totals operationalizes
//     that mastery record.
//   Issurin V.B. (2010). New horizons for the methodology and physiology
//     of training periodization. Sports Medicine 40(3):189–206. —
//     Long-term training residuals (years of accumulated stimulus)
//     underwrite present capacity; the timeline of accumulation
//     matters as much as the per-block load.
//
// Pure function. No I/O. No React.

const MS_PER_DAY = 86400000

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toISODate(v) {
  if (!v) return null
  // Accept either an ISO date string ("YYYY-MM-DD" / full ISO) or a Date.
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return v.toISOString().slice(0, 10)
  }
  if (typeof v !== 'string') return null
  // Anchor at noon UTC to dodge DST and timezone-rollover edge cases.
  const d = new Date(`${v.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function dayDiffInclusive(firstISO, todayISO) {
  // Both anchored at noon UTC for stability.
  const a = new Date(`${firstISO}T12:00:00Z`).getTime()
  const b = new Date(`${todayISO}T12:00:00Z`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  const diff = Math.round((b - a) / MS_PER_DAY)
  // Inclusive: a single-day log has tenureDays = 1.
  return Math.max(1, diff + 1)
}

/**
 * @description Aggregate the full training log into lifetime totals.
 *   No window — every well-formed entry counts.
 *
 * @param {{ log?: Array, today?: string }} args
 * @returns {null | {
 *   totalSessions: number,
 *   totalMinutes: number,
 *   totalHours: number,
 *   totalDistanceKm: number,
 *   totalTss: number,
 *   firstSessionDate: string,
 *   lastSessionDate: string,
 *   tenureDays: number,
 *   tenureYears: number,
 *   tenureMonths: number,
 *   citation: 'Bandura 1997'
 * }}
 */
export function analyzeLifetimeTotals({ log, today } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  let totalSessions = 0
  let totalMinutes = 0
  let totalDistanceKm = 0
  let totalTss = 0
  let firstISO = null
  let lastISO = null

  for (const entry of log) {
    if (!entry || typeof entry !== 'object') continue
    const dateISO = toISODate(entry.date)
    if (!dateISO) continue

    totalSessions += 1
    totalMinutes    += toNum(entry.duration ?? entry.durationMin ?? (entry.durationSec ? entry.durationSec / 60 : 0))
    totalDistanceKm += toNum(entry.distanceKm)
    totalTss        += toNum(entry.tss)

    if (firstISO === null || dateISO < firstISO) firstISO = dateISO
    if (lastISO  === null || dateISO > lastISO ) lastISO  = dateISO
  }

  if (totalSessions === 0 || !firstISO) return null

  const todayISO = toISODate(today) || toISODate(new Date())
  if (!todayISO) return null

  const tenureDays   = dayDiffInclusive(firstISO, todayISO)
  const tenureYears  = Math.round((tenureDays / 365.25)  * 100) / 100
  const tenureMonths = Math.round((tenureDays / 30.4375) * 10)  / 10
  const totalHours   = totalMinutes / 60

  return {
    totalSessions,
    totalMinutes,
    totalHours,
    totalDistanceKm,
    totalTss,
    firstSessionDate: firstISO,
    lastSessionDate:  lastISO,
    tenureDays,
    tenureYears,
    tenureMonths,
    citation: 'Bandura 1997',
  }
}
