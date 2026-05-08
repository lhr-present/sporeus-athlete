// ─── calendarProgress.js — match log entries to calendar cells ──────────────
//
// v9.5.0. For a given calendar weeks[] array (yearlyPlan shape) and a log,
// returns:
//   • per-day map: dateISO → { logged, plannedTSS, actualTSS, complianceRatio }
//   • per-week map: weekStart → { plannedTSS, actualTSS, daysLogged, daysPlanned, adherencePct }
//
// Pure data-in/data-out. No React. Sport-aware via the existing
// entryMatchesProgramSport helper from _logSport.

import { entryMatchesProgramSport, logEntrySport } from './_logSport.js'

function safeNum(v) {
  const n = Number(v)
  return isFinite(n) && n > 0 ? n : 0
}

function ymd(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  if (d instanceof Date) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  return null
}

function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function addDays(d, n) {
  return new Date(d.getTime() + n * 86400000)
}

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * @typedef {{
 *   dateISO: string,
 *   logged: boolean,
 *   plannedTSS: number,
 *   actualTSS: number,
 *   plannedDuration: number,
 *   actualDuration: number,
 *   complianceRatio: number,    // 0-2+ (capped at 2 for visual)
 *   sportMatched: boolean,
 * }} DayProgress
 *
 * @typedef {{
 *   weekStart: string,
 *   weekNum: number,
 *   plannedTSS: number,
 *   actualTSS: number,
 *   daysLogged: number,
 *   daysPlanned: number,
 *   adherencePct: number,        // 0-100 (rounded)
 * }} WeekProgress
 *
 * @typedef {{
 *   byDay:  Record<string, DayProgress>,
 *   byWeek: Record<string, WeekProgress>,
 *   overall: { plannedTSS: number, actualTSS: number, adherencePct: number },
 * }} CalendarProgress
 */

/**
 * @public
 * @param {Array} weeks  yearlyPlan-shape weeks (each with weekStart, weekNum, sessionsBlueprint, targetTSS)
 * @param {Array} log    training log entries (each with date, type/sport, tss?, durationMin/durationMinutes)
 * @param {{ sport?: string, today?: string }} [opts]
 * @returns {CalendarProgress}
 */
export function buildCalendarProgress(weeks, log, opts = {}) {
  const out = { byDay: {}, byWeek: {}, overall: { plannedTSS: 0, actualTSS: 0, adherencePct: 0 } }
  if (!Array.isArray(weeks) || weeks.length === 0) return out

  const safeLog = Array.isArray(log) ? log : []
  const todayISO = opts.today || new Date().toISOString().slice(0, 10)
  const programSport = opts.sport ? String(opts.sport).toLowerCase() : null

  // Pre-bucket logs by date for O(1) lookup
  const logsByDate = {}
  for (const e of safeLog) {
    if (!e || typeof e !== 'object') continue
    const d = ymd(e.date)
    if (!d) continue
    if (!logsByDate[d]) logsByDate[d] = []
    logsByDate[d].push(e)
  }

  for (const w of weeks) {
    const weekStart = parseISO(w.weekStart)
    if (!weekStart) continue

    let weekPlanned = 0
    let weekActual = 0
    let daysLogged = 0
    let daysPlanned = 0

    const sessions = Array.isArray(w.sessionsBlueprint) ? w.sessionsBlueprint : []
    for (let i = 0; i < 7; i++) {
      const dt = addDays(weekStart, i)
      const dISO = ymd(dt)
      const dayKey = DAY_KEYS[i]
      const session = sessions.find(s => s?.day === dayKey) || null
      const plannedDuration = session ? safeNum(session.durationMin) : 0
      const plannedTSS = plannedDuration > 0 ? estimateTSSFromSession(session) : 0

      // Logged entries on this date that match the program sport (if specified)
      const dayLogs = logsByDate[dISO] || []
      const matchedLogs = programSport
        ? dayLogs.filter(e => entryMatchesProgramSport(e, programSport))
        : dayLogs

      const actualTSS = matchedLogs.reduce((acc, e) => acc + safeNum(e.tss), 0)
      const actualDuration = matchedLogs.reduce((acc, e) =>
        acc + safeNum(e.durationMin || e.durationMinutes || 0), 0)
      const logged = matchedLogs.length > 0
      const sportMatched = programSport
        ? matchedLogs.some(e => logEntrySport(e) === programSport)
        : logged

      const complianceRatio = plannedTSS > 0
        ? Math.min(2, actualTSS / plannedTSS)
        : (logged ? 1 : 0)

      out.byDay[dISO] = {
        dateISO: dISO,
        logged,
        plannedTSS: Math.round(plannedTSS),
        actualTSS: Math.round(actualTSS),
        plannedDuration,
        actualDuration: Math.round(actualDuration),
        complianceRatio: Math.round(complianceRatio * 100) / 100,
        sportMatched,
      }

      weekPlanned += plannedTSS
      weekActual += actualTSS
      if (plannedDuration > 0) daysPlanned++
      if (logged) daysLogged++
    }

    // Per-week summary — only count past+today weeks for adherence
    const weekStartISO = ymd(weekStart)
    const adherencePct = weekPlanned > 0
      ? Math.round((weekActual / weekPlanned) * 100)
      : 0

    out.byWeek[weekStartISO] = {
      weekStart: weekStartISO,
      weekNum: Number(w.weekNum) || 0,
      plannedTSS: Math.round(weekPlanned),
      actualTSS: Math.round(weekActual),
      daysLogged,
      daysPlanned,
      adherencePct,
    }

    // Overall counts only completed weeks (week ends before today)
    const weekEnd = addDays(weekStart, 6)
    if (ymd(weekEnd) <= todayISO) {
      out.overall.plannedTSS += weekPlanned
      out.overall.actualTSS  += weekActual
    }
  }

  out.overall.plannedTSS = Math.round(out.overall.plannedTSS)
  out.overall.actualTSS  = Math.round(out.overall.actualTSS)
  out.overall.adherencePct = out.overall.plannedTSS > 0
    ? Math.round((out.overall.actualTSS / out.overall.plannedTSS) * 100)
    : 0

  return out
}

/**
 * Estimate TSS from a session blueprint when it doesn't carry a TSS field
 * directly. Uses zone-weighted intensity factors per Coggan TSS formula:
 *   TSS = (durationHr * NP * IF * 100) / FTP
 * but since blueprint sessions only carry zone minutes, we approximate
 * IF^2 as a weighted sum of per-zone IF^2.
 *
 * Zone-weighted IF^2 lookup (rough Coggan):
 *   Z1 → 0.50²=0.25 · Z2 → 0.65²=0.42 · Z3 → 0.80²=0.64
 *   Z4 → 0.95²=0.90 · Z5 → 1.10²=1.21
 *
 * For sessions with no zone breakdown, falls back to:
 *   100 TSS / hour for hard sessions, 50 for easy.
 */
function estimateTSSFromSession(session) {
  if (!session) return 0
  const dur = safeNum(session.durationMin)
  if (dur <= 0) return 0
  if (session.zones && typeof session.zones === 'object') {
    const z = session.zones
    const zMin = (safeNum(z.Z1) + safeNum(z.Z2) + safeNum(z.Z3) + safeNum(z.Z4) + safeNum(z.Z5))
    if (zMin > 0) {
      const if2 = (safeNum(z.Z1) * 0.25
        + safeNum(z.Z2) * 0.42
        + safeNum(z.Z3) * 0.64
        + safeNum(z.Z4) * 0.90
        + safeNum(z.Z5) * 1.21) / zMin
      return Math.round((dur / 60) * if2 * 100)
    }
  }
  // Fallback heuristic
  const intent = session.intent && (session.intent.en || session.intent)
  if (typeof intent === 'string' && /Threshold|Tempo|VO2|Race|Cruise|Interval/i.test(intent)) {
    return Math.round((dur / 60) * 80)
  }
  return Math.round((dur / 60) * 50)
}

export const CALENDAR_PROGRESS_CITATION = 'Coggan 2003 (TSS); Daniels 2014; Sporeus v9.5.0'
