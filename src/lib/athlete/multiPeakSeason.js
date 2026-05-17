// src/lib/athlete/multiPeakSeason.js
//
// v9.170.0 (EP-4) — Multi-peak season skeleton.
//
// `buildEliteProgram` targets a single race. Real seasons have an A-race
// (primary, full periodization + 1-3 week taper), B-races (secondary,
// train-through with 5-7 day mini-taper), and C-races (developmental,
// race as a training day, no taper).
//
// This module emits a week-by-week season skeleton with phase tags,
// per-race priority, mini-tapers, recovery weeks immediately after each
// race, and maintenance blocks between races. Pure function. No daily
// sessions yet — the per-leg detail is left to `buildEliteProgram` once
// each race's specific PR target is locked in.
//
// Protocol grounding:
//   - Issurin 2010 (block periodization for multi-event seasons)
//   - Bompa 2009 (peak frequency: 2-3 peaks/year is the physiological
//     ceiling for endurance athletes; >3 dilutes each peak)
//   - Mujika 2010 (taper magnitude: A-race needs 14-21d, B-race 5-7d,
//     C-race 0d)
//   - Pyne 2009 (recovery week after major competition: 7-14d of
//     low-volume restoration)
//
// Output: an ordered array of weeks where each week is one of:
//   'Base' | 'Build' | 'Peak' | 'Taper' | 'Race' | 'Recovery' | 'Maintenance'
//
// The 'Race' week is the calendar week containing the race date. The
// 'Recovery' weeks come immediately after each Race week.

export const MULTI_PEAK_CITATION = 'Issurin 2010; Bompa 2009; Mujika 2010; Pyne 2009'

const VALID_PRIORITIES = new Set(['A', 'B', 'C'])

// Recovery weeks per priority (post-race)
const RECOVERY_WEEKS = { A: 2, B: 1, C: 0 }

// Taper weeks per priority (pre-race)
const TAPER_WEEKS = { A: 2, B: 1, C: 0 }

// ── Date helpers (UTC) ───────────────────────────────────────────────────────
function parseISO(s) {
  if (!s || typeof s !== 'string') return null
  const d = new Date(s + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function addDays(d, n) {
  const nd = new Date(d.getTime())
  nd.setUTCDate(nd.getUTCDate() + n)
  return nd
}

function isoOf(d) {
  return d.toISOString().slice(0, 10)
}

function weeksBetween(aISO, bISO) {
  const a = parseISO(aISO), b = parseISO(bISO)
  if (!a || !b) return 0
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (7 * 86400_000)))
}

// ── Phase split for a single leg ─────────────────────────────────────────────
//
// Given a leg of `legWeeks` weeks ending at a race of `priority`, allocate:
//   - Taper (per priority, fixed)
//   - Peak (~25-30% of remaining for A, 1-2 weeks for B, 0 for C)
//   - Build (~40% remaining)
//   - Base or Maintenance (remainder)
//
// `isFirstLeg` flag: subsequent legs start from a recovered athlete who
// already has fitness — emit Maintenance instead of Base.

function splitLeg(legWeeks, priority, isFirstLeg) {
  if (legWeeks <= 0) return []
  const taper = Math.min(legWeeks, TAPER_WEEKS[priority] || 0)
  const remaining = legWeeks - taper

  if (remaining <= 0) {
    return Array(taper).fill('Taper')
  }
  if (priority === 'C') {
    // Race-as-training: maintain only, no peak
    const block = isFirstLeg ? 'Build' : 'Maintenance'
    return [...Array(remaining).fill(block), ...Array(taper).fill('Taper')]
  }

  // A or B race — include Peak + Build (+ Base if first leg has room)
  let peak, build, baseOrMaint
  if (priority === 'A') {
    peak  = Math.max(1, Math.round(remaining * 0.30))
    build = Math.max(1, Math.round(remaining * 0.40))
    baseOrMaint = Math.max(0, remaining - peak - build)
  } else { // B
    peak  = Math.min(remaining, 2)
    build = Math.max(0, remaining - peak)
    baseOrMaint = 0
  }

  // Clamp: peak + build + baseOrMaint must equal remaining
  if (peak + build + baseOrMaint > remaining) {
    // Trim from base/maintenance, then build, then peak
    let over = peak + build + baseOrMaint - remaining
    const trim = (n, by) => Math.max(0, n - by)
    if (baseOrMaint >= over) { baseOrMaint -= over; over = 0 }
    else { over -= baseOrMaint; baseOrMaint = 0 }
    if (over > 0) {
      const trimBuild = Math.min(build - 1, over)
      build = trim(build, trimBuild); over -= trimBuild
    }
    if (over > 0) {
      peak = Math.max(1, peak - over)
    }
  }

  const baseLabel = isFirstLeg ? 'Base' : 'Maintenance'
  return [
    ...Array(baseOrMaint).fill(baseLabel),
    ...Array(build).fill('Build'),
    ...Array(peak).fill('Peak'),
    ...Array(taper).fill('Taper'),
  ]
}

/**
 * Build a multi-peak season skeleton.
 *
 * @param {{
 *   sport: 'run'|'bike'|'swim'|'triathlon'|'rowing',
 *   races: Array<{ date: string, label?: string, priority: 'A'|'B'|'C', targetPR?: object }>,
 *   options?: { today?: string }
 * }} input
 *
 * @returns {{
 *   sport: string,
 *   today: string,
 *   races: Array<{ date: string, label: string|null, priority: string, weekIdx: number }>,
 *   weeks: Array<{
 *     weekIdx: number,
 *     startISO: string,
 *     phase: 'Base'|'Build'|'Peak'|'Taper'|'Race'|'Recovery'|'Maintenance',
 *     legIdx: number,
 *     daysToNextRace: number,
 *     tssMultiplier: number,
 *   }>,
 *   totalWeeks: number,
 *   peakCount: number,
 *   warnings: Array<{ code: string, en: string, tr: string }>,
 *   citation: string,
 *   _rejected?: true,
 *   reason?: string,
 * } | null}
 */
export function buildMultiPeakSeason(input) {
  if (!input || typeof input !== 'object') return null
  const { sport, races, options = {} } = input

  if (!sport || typeof sport !== 'string') {
    return { _rejected: true, reason: 'missing-sport' }
  }
  if (!Array.isArray(races) || races.length === 0) {
    return { _rejected: true, reason: 'no-races' }
  }
  if (races.length > 6) {
    return { _rejected: true, reason: 'too-many-races' }
  }

  const today = options.today || isoOf(new Date())
  const todayD = parseISO(today)
  if (!todayD) return { _rejected: true, reason: 'invalid-today' }

  // Validate + sort races
  const normalized = []
  for (const r of races) {
    if (!r || typeof r !== 'object') return { _rejected: true, reason: 'invalid-race' }
    const d = parseISO(r.date)
    if (!d) return { _rejected: true, reason: 'invalid-race-date' }
    if (d.getTime() <= todayD.getTime()) return { _rejected: true, reason: 'race-in-past' }
    if (!VALID_PRIORITIES.has(r.priority)) return { _rejected: true, reason: 'invalid-priority' }
    normalized.push({ date: r.date, label: r.label || null, priority: r.priority })
  }
  normalized.sort((a, b) => a.date.localeCompare(b.date))

  // At most one A-race recommended; warn if >1
  const warnings = []
  const aCount = normalized.filter(r => r.priority === 'A').length
  if (aCount > 1) {
    warnings.push({
      code: 'multiple-A-races',
      en: 'More than one A-race per season usually dilutes peak performance (Bompa 2009). Consider down-prioritizing one to B.',
      tr: 'Sezonda birden fazla A-yarış genelde tepe performansı seyreltir (Bompa 2009). Birini B önceliğine düşürmeyi düşün.',
    })
  }
  if (normalized.length > 4) {
    warnings.push({
      code: 'too-many-peaks',
      en: 'More than 4 race-peaks in a season risks under-recovery. The body needs ≥6 weeks between true peaks.',
      tr: 'Sezonda 4 yarış-tepesinden fazlası yetersiz toparlanma riski yaratır. Vücut gerçek tepeler arasında ≥6 hafta ister.',
    })
  }

  // Walk the legs in order
  const weeks = []
  let cursorISO = today
  let weekIdx = 1
  let legIdx = 0
  let isFirstLeg = true

  for (const race of normalized) {
    legIdx += 1
    const totalLegWeeks = weeksBetween(cursorISO, race.date)

    // Insert recovery weeks IF this is not the first leg (recovery from prev race already happened)
    let recoveryUsed = 0
    if (!isFirstLeg) {
      // Recovery weeks come from the PREVIOUS race's priority. We assume
      // we already emitted them at the end of the previous leg below.
    }

    // Available weeks for buildup (after any pre-race recovery insertion)
    const buildupWeeks = Math.max(0, totalLegWeeks - recoveryUsed)
    if (buildupWeeks < TAPER_WEEKS[race.priority]) {
      warnings.push({
        code: 'leg-too-short',
        // v9.204.0 — Include `raceDate` so UIs can render a targeted action
        // (e.g. "remove this race"). Pre-fix the race identity was only in
        // the user-facing string, making it un-targetable from code.
        raceDate: race.date,
        en: `Only ${buildupWeeks} weeks until "${race.label || race.date}" — below the ${TAPER_WEEKS[race.priority]}-week taper minimum for ${race.priority}-race.`,
        tr: `"${race.label || race.date}" yarışına sadece ${buildupWeeks} hafta — ${race.priority}-yarış için ${TAPER_WEEKS[race.priority]}-haftalık taper alt sınırının altında.`,
      })
    }

    const phaseSeq = splitLeg(buildupWeeks, race.priority, isFirstLeg)
    for (const ph of phaseSeq) {
      const startD = parseISO(cursorISO)
      const daysToRace = weeksBetween(cursorISO, race.date) * 7
      weeks.push({
        weekIdx,
        startISO: cursorISO,
        phase: ph,
        legIdx,
        daysToNextRace: daysToRace,
        tssMultiplier: tssMultFor(ph),
      })
      cursorISO = isoOf(addDays(startD, 7))
      weekIdx += 1
    }

    // Race week
    const raceWeekStartD = parseISO(cursorISO)
    const raceDate = parseISO(race.date)
    // race week starts on cursor if cursor is within ≤7 days of race
    if (raceDate && raceWeekStartD) {
      weeks.push({
        weekIdx,
        startISO: cursorISO,
        phase: 'Race',
        legIdx,
        daysToNextRace: 0,
        tssMultiplier: 0.5,
        raceLabel: race.label || null,
        raceDate: race.date,
        racePriority: race.priority,
      })
      cursorISO = isoOf(addDays(raceWeekStartD, 7))
      weekIdx += 1
    }

    // Recovery weeks AFTER race, based on this race's priority
    const recovWeeks = RECOVERY_WEEKS[race.priority] || 0
    for (let i = 0; i < recovWeeks; i++) {
      const startD = parseISO(cursorISO)
      weeks.push({
        weekIdx,
        startISO: cursorISO,
        phase: 'Recovery',
        legIdx,
        daysToNextRace: -1,
        tssMultiplier: 0.4,
      })
      cursorISO = isoOf(addDays(startD, 7))
      weekIdx += 1
    }

    isFirstLeg = false
  }

  // Annotate races with their weekIdx
  const racesOut = normalized.map(r => {
    const wk = weeks.find(w => w.phase === 'Race' && w.raceDate === r.date)
    return { ...r, weekIdx: wk?.weekIdx ?? null }
  })

  return {
    sport,
    today,
    races: racesOut,
    weeks,
    totalWeeks: weeks.length,
    peakCount: normalized.filter(r => r.priority !== 'C').length,
    warnings,
    citation: MULTI_PEAK_CITATION,
  }
}

function tssMultFor(phase) {
  switch (phase) {
    case 'Base':         return 1.0
    case 'Build':        return 1.1
    case 'Peak':         return 1.15
    case 'Taper':        return 0.6
    case 'Race':         return 0.5
    case 'Recovery':     return 0.4
    case 'Maintenance':  return 0.85
    default:             return 1.0
  }
}
