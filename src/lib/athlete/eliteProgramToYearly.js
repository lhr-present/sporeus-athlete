// ─── eliteProgramToYearly.js ─────────────────────────────────────────────────
// Pure converter: buildEliteProgram() return → YearlyPlan-compatible state.
//
// EliteProgram returns { phases, weeklyTSS, sampleWeeks, ... } with phases
// keyed Base/Build/Peak/Taper. YearlyPlan reads `sporeus-yearly-plan` of
// shape { weeks: Week[], model, projectedCTL } where each Week is:
//   { weekStart, weekNum, phase, targetTSS, plannedHours, zoneDistribution,
//     isDeload, raceName, raceDate, priority, note, sessionsBlueprint? }
//
// Caveats:
// - YearlyPlan PHASE_COLORS / TRAD_ZONES do not include 'Taper'; we keep
//   'Taper' anyway because the test contract says final week before race is
//   'Taper'. YearlyPlan renders it with a default gray band (still readable).
// - We pad the resulting array to exactly 52 weeks with Recovery filler so
//   the calendar renders a full year.
//
// Pure function. No DOM. No I/O. Bilingual labels propagated via sessionsBlueprint.

const TARGET_LEN = 52

// Phase zone distributions mirrored from periodization.js TRAD_ZONES so the
// YearlyPlan zone bars render correctly.
const PHASE_ZONES = {
  Base:       { Z1: 0.70, Z2: 0.20, Z3: 0.08, Z4: 0.02, Z5: 0.00 },
  Build:      { Z1: 0.55, Z2: 0.20, Z3: 0.12, Z4: 0.10, Z5: 0.03 },
  Peak:       { Z1: 0.50, Z2: 0.15, Z3: 0.10, Z4: 0.18, Z5: 0.07 },
  Taper:      { Z1: 0.55, Z2: 0.15, Z3: 0.10, Z4: 0.15, Z5: 0.05 },
  Race:       { Z1: 0.40, Z2: 0.20, Z3: 0.10, Z4: 0.20, Z5: 0.10 },
  Recovery:   { Z1: 0.85, Z2: 0.12, Z3: 0.03, Z4: 0.00, Z5: 0.00 },
  Transition: { Z1: 0.90, Z2: 0.10, Z3: 0.00, Z4: 0.00, Z5: 0.00 },
}

// Snap a YYYY-MM-DD string backward to the Monday of its ISO week.
function snapToMondayUTC(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (isNaN(dt.getTime())) return null
  // Reject rollover (e.g. Feb 30 → Mar 2)
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  const dow = dt.getUTCDay() || 7   // 1=Mon … 7=Sun
  dt.setUTCDate(dt.getUTCDate() - (dow - 1))
  dt.setUTCHours(0, 0, 0, 0)
  return dt
}

// Add n days to a Date (UTC) and return a new Date.
function addDaysUTC(date, n) {
  const out = new Date(date)
  out.setUTCDate(date.getUTCDate() + n)
  return out
}

function ymd(date) {
  return date.toISOString().slice(0, 10)
}

// Find phase name (Base/Build/Peak/Taper) for a zero-based program week index
// by walking through program.phases in order. Returns null if out of range.
function phaseForWeekIdx(phases, weekIdx) {
  let cursor = 0
  for (const ph of phases) {
    const len = (ph.weeks && ph.weeks.length) || 0
    if (weekIdx < cursor + len) return ph.phase
    cursor += len
  }
  return null
}

// Heuristic: a week is a deload if its TSS is significantly below the
// surrounding (non-zero) weeks of the same phase trend. We use a simple test:
// tss < 0.75 * average of immediate non-zero neighbours.
function isDeloadWeek(weeklyTSS, idx) {
  const here = weeklyTSS[idx]
  if (!here || here <= 0) return false
  const neigh = []
  if (idx > 0 && weeklyTSS[idx - 1] > 0) neigh.push(weeklyTSS[idx - 1])
  if (idx < weeklyTSS.length - 1 && weeklyTSS[idx + 1] > 0) neigh.push(weeklyTSS[idx + 1])
  if (neigh.length === 0) return false
  const avg = neigh.reduce((a, b) => a + b, 0) / neigh.length
  return here < avg * 0.75
}

/**
 * Convert an eliteProgram result into YearlyPlan-compatible state.
 *
 * @param {object} program  Result of buildEliteProgram(). Must have phases,
 *                          weeklyTSS arrays.
 * @param {string} programStart  YYYY-MM-DD start date. Snapped backward to
 *                          the nearest Monday (UTC).
 * @param {object} [opts]
 * @param {string} [opts.raceDate]      YYYY-MM-DD of the goal race. If
 *                                      provided, an extra Race week is
 *                                      appended right after the last Taper.
 * @param {string} [opts.raceName='Goal Race']
 * @param {number} [opts.raceDistanceM] Optional distance metres (carried).
 * @param {string} [opts.model='traditional']  Yearly-plan model tag.
 * @returns {{ weeks: object[], model: string, projectedCTL: number,
 *             races: object[], startDate: string, raceDate: string|null,
 *             raceDistance: number|null }|null}
 *          Or null if input invalid.
 */
export function eliteProgramToYearlyWeeks(program, programStart, opts = {}) {
  if (!program || typeof program !== 'object') return null
  if (!Array.isArray(program.phases) || !Array.isArray(program.weeklyTSS)) return null
  if (program._rejected) return null

  const monday = snapToMondayUTC(programStart)
  if (!monday) return null

  const {
    raceDate: optRaceDate = null,
    raceName: optRaceName = 'Goal Race',
    raceDistanceM = null,
    model = 'traditional',
  } = opts

  // v8.96.0 — Synthetic-anchor passthrough. When the program was built without
  // a real race date (general-build mode), the orchestrator produced an
  // `effectiveRaceDate` synthesized from weeksOverride. Use it as the anchor
  // and downgrade the appended Race week to a "Final Week" priority C marker.
  const isSyntheticRace = !!(program.synthetic && program.synthetic.raceDate)
  let raceDate = optRaceDate
  let raceName = optRaceName
  let racePriority = 'A'
  if (isSyntheticRace && !optRaceDate && program.feasibility?.effectiveRaceDate) {
    raceDate = program.feasibility.effectiveRaceDate
    raceName = optRaceName === 'Goal Race' ? 'Final Week' : optRaceName
    racePriority = 'C'
  } else if (isSyntheticRace) {
    // explicit raceDate supplied via opts wins, but priority still C
    racePriority = 'C'
  }

  const tss = program.weeklyTSS
  const phases = program.phases
  const sampleWeeks = program.sampleWeeks || {}

  const weeks = []

  // Build one week object per program week.
  for (let i = 0; i < tss.length; i++) {
    const startDate = addDaysUTC(monday, i * 7)
    const phase = phaseForWeekIdx(phases, i) || 'Base'
    const targetTSS = Math.max(0, Math.round(Number(tss[i]) || 0))
    const plannedHours = Math.round((targetTSS / 60) * 10) / 10
    const isDeload = isDeloadWeek(tss, i)

    weeks.push({
      weekStart:        ymd(startDate),
      weekNum:          i + 1,
      phase,
      targetTSS,
      plannedHours,
      zoneDistribution: { ...(PHASE_ZONES[phase] || PHASE_ZONES.Base) },
      isDeload,
      raceName:         null,
      raceDate:         null,
      priority:         null,
      note:             '',
      sessionsBlueprint: Array.isArray(sampleWeeks[phase])
        ? sampleWeeks[phase].map(d => ({ ...d }))
        : [],
    })
  }

  // Append a Race week if a raceDate is provided. We place it directly after
  // the last program week so the YearlyPlan calendar shows the [R] marker.
  let appendedRace = false
  if (raceDate && /^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
    const lastWeekIdx = weeks.length - 1
    const lastStart = lastWeekIdx >= 0
      ? snapToMondayUTC(weeks[lastWeekIdx].weekStart)
      : monday
    const raceWeekStart = addDaysUTC(lastStart || monday, 7)
    weeks.push({
      weekStart:        ymd(raceWeekStart),
      weekNum:          weeks.length + 1,
      phase:            'Race',
      targetTSS:        Math.max(0, Math.round((tss[tss.length - 1] || 0) * 0.5)),
      plannedHours:     0,
      zoneDistribution: { ...PHASE_ZONES.Race },
      isDeload:         false,
      raceName,
      raceDate,
      priority:         racePriority,
      note:             '',
      sessionsBlueprint: Array.isArray(sampleWeeks.Taper)
        ? sampleWeeks.Taper.map(d => ({ ...d }))
        : [],
    })
    weeks[weeks.length - 1].plannedHours =
      Math.round((weeks[weeks.length - 1].targetTSS / 60) * 10) / 10
    appendedRace = true
  }

  // Pad to TARGET_LEN with Recovery filler so the 52-column calendar renders.
  while (weeks.length < TARGET_LEN) {
    const idx = weeks.length
    const startDate = addDaysUTC(monday, idx * 7)
    weeks.push({
      weekStart:        ymd(startDate),
      weekNum:          idx + 1,
      phase:            'Recovery',
      targetTSS:        Math.max(0, Math.round((program?.weeklyTSS?.[0] || 200) * 0.4)),
      plannedHours:     0,
      zoneDistribution: { ...PHASE_ZONES.Recovery },
      isDeload:         false,
      raceName:         null,
      raceDate:         null,
      priority:         null,
      note:             '',
      sessionsBlueprint: [],
    })
    weeks[idx].plannedHours =
      Math.round((weeks[idx].targetTSS / 60) * 10) / 10
  }

  // Trim if program ran longer than 52 weeks (rare but possible).
  if (weeks.length > TARGET_LEN) weeks.length = TARGET_LEN

  // Fill plannedHours for the recovery filler so all rows are uniform.
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].plannedHours == null) {
      weeks[i].plannedHours =
        Math.round((weeks[i].targetTSS / 60) * 10) / 10
    }
  }

  const races = (raceDate && /^\d{4}-\d{2}-\d{2}$/.test(raceDate))
    ? [{ date: raceDate, name: raceName, priority: racePriority }]
    : []

  return {
    weeks,
    model,
    projectedCTL: 0,                           // YearlyPlan recomputes locally
    races,
    startDate: ymd(monday),
    raceDate: raceDate || null,
    raceDistance: raceDistanceM ?? null,
    appendedRace,
  }
}
