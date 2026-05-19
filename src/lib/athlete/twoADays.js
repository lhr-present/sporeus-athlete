// ─── twoADays.js — Two-a-Day (Double-Session) Frequency Tracker ────────────
// Count days in the trailing window (default 60d) that contain two or more
// separate qualifying training sessions on the same calendar date. Surfaces
// the brick / double-session pattern that is deliberate in triathlon and
// well-developed cycling/running build phases, and flags when it tips toward
// overreaching territory.
//
// Cite: Cejuela 2013 — triathlon training distribution / brick frequency;
//       Issurin 2010 — block periodization accumulation patterns;
//       Skorski 2019 — repeated high-density days as overreaching risk.
//
// Pure module, no React, fully deterministic on `today` + `windowDays`.
// ─────────────────────────────────────────────────────────────────────────────

export const TWO_A_DAYS_CITATION = 'Cejuela 2013; Issurin 2010; Skorski 2019'

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function resolveTodayIso(today) {
  if (today == null) {
    return new Date().toISOString().slice(0, 10)
  }
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string') {
    if (today.length < 10) return null
    const iso = today.slice(0, 10)
    // Sanity-check it's a parseable date.
    const ts = Date.parse(iso + 'T00:00:00Z')
    if (!Number.isFinite(ts)) return null
    return iso
  }
  return null
}

function toDateStr(value) {
  if (typeof value !== 'string') return null
  if (value.length < 10) return null
  return value.slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── Session qualifier ──────────────────────────────────────────────────────
/**
 * A log entry counts as a "real session" if it has a finite positive duration
 * (camelCase `durationMin` preferred, snake_case `duration_min` as fallback)
 * OR a finite positive `tss`. Pure rest / wellness-only rows do not count.
 *
 * @param {object} entry
 * @returns {boolean}
 */
function isQualifyingSession(entry) {
  if (!entry || typeof entry !== 'object') return false
  const durRaw = entry.durationMin != null ? entry.durationMin : entry.duration_min
  const dur = Number(durRaw)
  if (Number.isFinite(dur) && dur > 0) return true
  const tss = Number(entry.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  return false
}

function normalizeSport(entry) {
  const raw = (entry && (entry.sport || entry.type)) || ''
  return String(raw).trim().toLowerCase()
}

// ─── Band classifier ────────────────────────────────────────────────────────
function classifyBand(totalDoubleDays) {
  if (totalDoubleDays <= 0) return 'NONE'
  if (totalDoubleDays <= 5) return 'OCCASIONAL'
  if (totalDoubleDays <= 15) return 'ROUTINE'
  return 'EXCESSIVE'
}

// ─── analyzeTwoADays ────────────────────────────────────────────────────────
/**
 * Count two-a-day sessions across a trailing window.
 *
 * @param {{
 *   log?: Array<object>,
 *   today?: string | Date,
 *   windowDays?: number,
 * }} args
 * @returns {{
 *   band: 'NONE'|'OCCASIONAL'|'ROUTINE'|'EXCESSIVE',
 *   doubleDays: Array<{
 *     date: string,
 *     sessionCount: number,
 *     totalDayTss: number,
 *     sports: string[],
 *     isCrossSport: boolean,
 *   }>,
 *   totalDoubleDays: number,
 *   crossSportDoubleDays: number,
 *   meanDayTssOnDoubles: number,
 *   citation: string,
 * } | null}
 */
export function analyzeTwoADays({ log, today, windowDays = 60 } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const win = Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 60
  const startIso = isoMinusDays(todayIso, win - 1)

  // Group qualifying entries by date, preserving input order for sport list.
  const byDate = new Map()
  if (Array.isArray(log)) {
    for (const entry of log) {
      if (!isQualifyingSession(entry)) continue
      const dateStr = toDateStr(entry?.date)
      if (!dateStr) continue
      if (dateStr < startIso || dateStr > todayIso) continue
      if (!byDate.has(dateStr)) byDate.set(dateStr, [])
      byDate.get(dateStr).push(entry)
    }
  }

  const doubleDays = []
  for (const [date, entries] of byDate) {
    if (entries.length < 2) continue
    let totalDayTss = 0
    const seenSports = new Set()
    const sports = []
    for (const e of entries) {
      const tss = Number(e.tss)
      if (Number.isFinite(tss) && tss > 0) totalDayTss += tss
      const sport = normalizeSport(e)
      if (sport && !seenSports.has(sport)) {
        seenSports.add(sport)
        sports.push(sport)
      }
    }
    doubleDays.push({
      date,
      sessionCount: entries.length,
      totalDayTss,
      sports,
      isCrossSport: sports.length >= 2,
    })
  }

  // Oldest-first by date.
  doubleDays.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const totalDoubleDays = doubleDays.length
  const crossSportDoubleDays = doubleDays.reduce(
    (acc, d) => acc + (d.isCrossSport ? 1 : 0),
    0,
  )

  let meanDayTssOnDoubles = 0
  if (totalDoubleDays > 0) {
    const sum = doubleDays.reduce((acc, d) => acc + d.totalDayTss, 0)
    meanDayTssOnDoubles = Math.round((sum / totalDoubleDays) * 100) / 100
  }

  return {
    band: classifyBand(totalDoubleDays),
    doubleDays,
    totalDoubleDays,
    crossSportDoubleDays,
    meanDayTssOnDoubles,
    citation: TWO_A_DAYS_CITATION,
  }
}

export default analyzeTwoADays
