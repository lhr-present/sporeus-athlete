// ─── planMilestones.js — phase-transition + race-week markers ────────────────
//
// v9.5.0. Pure data-in/data-out helper. Walks a program's phase split and
// emits a small set of dated milestones the athlete should anchor to:
//
//   field-test       — end of Base (or mid-Build if no Base): tests fitness
//                      gain → recalibrate VDOT/FTP/CSS for downstream phases
//   race-pace-primer — mid-Peak: race-pace specific session under fatigue
//   taper-start      — first day of Taper: cut volume, preserve intensity
//   race-day         — raceDate (or feasibility.effectiveRaceDate)
//
// Bilingual labels. No React, no I/O.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   dateISO: string,
 *   type: 'field-test' | 'race-pace-primer' | 'taper-start' | 'race-day',
 *   label: Bilingual,
 *   weekNum: number,
 *   phase: string,
 * }} PlanMilestone
 */

const LABELS = {
  'field-test': {
    en: 'Field test — recalibrate fitness',
    tr: 'Saha testi — fitness yeniden kalibrasyonu',
  },
  'race-pace-primer': {
    en: 'Race-pace primer — specific intensity rehearsal',
    tr: 'Yarış-tempo açılışı — özgül şiddet provası',
  },
  'taper-start': {
    en: 'Taper begins — volume cut, intensity preserved',
    tr: 'Taper başlar — hacim azalır, şiddet korunur',
  },
  'race-day': {
    en: 'RACE DAY',
    tr: 'YARIŞ GÜNÜ',
  },
}

function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function ymd(d) {
  if (!d || !(d instanceof Date)) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function addDays(d, n) {
  return new Date(d.getTime() + n * 86400000)
}

/**
 * @public
 * @param {object} program          buildEliteProgram result
 * @param {string} programStart     ISO YYYY-MM-DD (Monday of week 1)
 * @returns {PlanMilestone[]}       Ordered chronologically. Empty array on bad input.
 */
export function buildPlanMilestones(program, programStart) {
  if (!program || typeof program !== 'object') return []
  if (!Array.isArray(program.phases) || program.phases.length === 0) return []
  const start = parseISO(programStart)
  if (!start) return []

  const out = []

  // Resolve each phase's first + last week numbers.
  // phases[].weeks is Array<number> (1-indexed week numbers).
  const phaseSpan = program.phases.map(p => ({
    phase: p.phase,
    weeks: Array.isArray(p.weeks) ? p.weeks : [],
    firstWeek: Array.isArray(p.weeks) && p.weeks.length ? Math.min(...p.weeks) : null,
    lastWeek:  Array.isArray(p.weeks) && p.weeks.length ? Math.max(...p.weeks) : null,
  })).filter(p => p.firstWeek != null)

  // ── field-test: last Wednesday of Base; if no Base, mid-Build ──
  const base = phaseSpan.find(p => p.phase === 'Base')
  const build = phaseSpan.find(p => p.phase === 'Build')
  const ftAnchor = base || build
  if (ftAnchor) {
    const lastWeekIdx = ftAnchor.lastWeek - 1
    // Wednesday is dayIdx=2 (Mon=0). Place test on the Wednesday of the last
    // week of the chosen anchor phase.
    const dayOffset = lastWeekIdx * 7 + 2
    const dt = addDays(start, dayOffset)
    out.push({
      dateISO: ymd(dt),
      type: 'field-test',
      label: LABELS['field-test'],
      weekNum: ftAnchor.lastWeek,
      phase: ftAnchor.phase,
    })
  }

  // ── race-pace-primer: middle Saturday of Peak ──
  const peak = phaseSpan.find(p => p.phase === 'Peak')
  if (peak) {
    const midWeek = Math.floor((peak.firstWeek + peak.lastWeek) / 2)
    const midWeekIdx = midWeek - 1
    // Saturday = dayIdx=5
    const dayOffset = midWeekIdx * 7 + 5
    const dt = addDays(start, dayOffset)
    out.push({
      dateISO: ymd(dt),
      type: 'race-pace-primer',
      label: LABELS['race-pace-primer'],
      weekNum: midWeek,
      phase: 'Peak',
    })
  }

  // ── taper-start: Monday of first Taper week ──
  const taper = phaseSpan.find(p => p.phase === 'Taper')
  if (taper) {
    const dayOffset = (taper.firstWeek - 1) * 7
    const dt = addDays(start, dayOffset)
    out.push({
      dateISO: ymd(dt),
      type: 'taper-start',
      label: LABELS['taper-start'],
      weekNum: taper.firstWeek,
      phase: 'Taper',
    })
  }

  // ── race-day: explicit raceDate or feasibility.effectiveRaceDate ──
  const raceISO = program?.feasibility?.effectiveRaceDate
    || program?.input?.raceDate
    || null
  if (raceISO && /^\d{4}-\d{2}-\d{2}$/.test(raceISO)) {
    const raceDt = parseISO(raceISO)
    if (raceDt) {
      // Compute weekNum from offset.
      const offsetDays = Math.round((raceDt.getTime() - start.getTime()) / 86400000)
      const weekNum = Math.max(1, Math.floor(offsetDays / 7) + 1)
      out.push({
        dateISO: raceISO,
        type: 'race-day',
        label: LABELS['race-day'],
        weekNum,
        phase: 'Race',
      })
    }
  }

  // Sort chronologically.
  out.sort((a, b) => a.dateISO.localeCompare(b.dateISO))
  return out
}

/**
 * @public Returns the next milestone strictly after `today`, or null if none.
 */
export function getNextMilestone(milestones, today) {
  if (!Array.isArray(milestones) || milestones.length === 0) return null
  const todayISO = today || new Date().toISOString().slice(0, 10)
  for (const m of milestones) {
    if (m.dateISO > todayISO) return m
  }
  return null
}

/**
 * @public Days from `today` to `targetISO`. Negative if past.
 */
export function daysUntil(targetISO, today) {
  const target = parseISO(targetISO)
  if (!target) return null
  const todayISO = today || new Date().toISOString().slice(0, 10)
  const todayDt = parseISO(todayISO)
  if (!todayDt) return null
  return Math.round((target.getTime() - todayDt.getTime()) / 86400000)
}

export const PLAN_MILESTONE_CITATION = 'Mujika 2003; Bompa 2009; Daniels 2014'
