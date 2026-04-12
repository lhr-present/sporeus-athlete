// ─── Periodization Engine ─────────────────────────────────────────────────────
// Pure JS — no React, no DOM, no external dependencies.
// Builds 52-week yearly training plans from race calendar + athlete profile.

// ─── Zone distributions per model + phase ────────────────────────────────────
const TRAD_ZONES = {
  Base:       { Z1: 0.70, Z2: 0.20, Z3: 0.08, Z4: 0.02, Z5: 0.00 },
  Build:      { Z1: 0.55, Z2: 0.20, Z3: 0.12, Z4: 0.10, Z5: 0.03 },
  Peak:       { Z1: 0.50, Z2: 0.15, Z3: 0.10, Z4: 0.18, Z5: 0.07 },
  Race:       { Z1: 0.40, Z2: 0.20, Z3: 0.10, Z4: 0.20, Z5: 0.10 },
  Recovery:   { Z1: 0.85, Z2: 0.12, Z3: 0.03, Z4: 0.00, Z5: 0.00 },
  Transition: { Z1: 0.90, Z2: 0.10, Z3: 0.00, Z4: 0.00, Z5: 0.00 },
}
const POL_ZONES   = { Z1: 0.80, Z2: 0.00, Z3: 0.00, Z4: 0.15, Z5: 0.05 }
const BLOCK_ACCUM = { Z1: 0.60, Z2: 0.25, Z3: 0.10, Z4: 0.05, Z5: 0.00 }
const BLOCK_INTEN = { Z1: 0.50, Z2: 0.10, Z3: 0.05, Z4: 0.25, Z5: 0.10 }
const BLOCK_REAL  = { Z1: 0.45, Z2: 0.10, Z3: 0.05, Z4: 0.25, Z5: 0.15 }

function getZoneDistribution(model, phase, weekNum) {
  if (model === 'polarized') return { ...POL_ZONES }
  if (model === 'block') {
    const cycle = (weekNum - 1) % 5
    if (cycle <= 2) return { ...BLOCK_ACCUM }
    if (cycle === 3) return { ...BLOCK_INTEN }
    return { ...BLOCK_REAL }
  }
  // traditional
  return { ...(TRAD_ZONES[phase] || TRAD_ZONES.Base) }
}

// ─── Internal: CTL forward projection ────────────────────────────────────────
// Spreads each week's targetTSS across trainingDays, runs EWMA from startCTL.
function projectForwardCTL(startCTL, weeks, trainingDays) {
  const K_CTL  = 1 - Math.exp(-1 / 42)
  const DECAY  = 1 - K_CTL
  let ctl = startCTL
  const days = Math.min(trainingDays, 7)
  for (const week of weeks) {
    const tssPerDay = days > 0 ? week.targetTSS / days : 0
    for (let d = 0; d < 7; d++) {
      const todayTSS = d < days ? tssPerDay : 0
      ctl = ctl * DECAY + todayTSS * K_CTL
    }
  }
  return Math.round(ctl * 10) / 10
}

// ─── 1. buildYearlyPlan ───────────────────────────────────────────────────────
// Returns { weeks: Week[], warnings: string[], projectedCTL: number }
export function buildYearlyPlan(params) {
  const {
    startDate,
    races       = [],
    currentCTL  = 40,
    targetCTL:  _tCTL,
    maxHoursPerWeek = 10,
    trainingDays    = 5,
    model           = 'traditional',
  } = params || {}

  const targetCTL = _tCTL ?? (currentCTL + 15)

  // Normalize startDate to Monday of that week
  const startD    = new Date(startDate)
  const dow       = startD.getDay() || 7   // 1=Mon … 7=Sun
  const monday    = new Date(startD)
  monday.setDate(startD.getDate() - (dow - 1))
  monday.setHours(0, 0, 0, 0)

  // Generate 52 week skeletons
  const weeks = []
  for (let w = 0; w < 52; w++) {
    const ws = new Date(monday)
    ws.setDate(monday.getDate() + w * 7)
    weeks.push({
      weekStart:        ws.toISOString().slice(0, 10),
      weekNum:          w + 1,
      phase:            'Base',
      targetTSS:        0,
      plannedHours:     0,
      zoneDistribution: { ...TRAD_ZONES.Base },
      isDeload:         false,
      raceName:         null,
      raceDate:         null,
      priority:         null,
      note:             '',
    })
  }

  // ── Index races by week ────────────────────────────────────────────────────
  const PRANK = { A: 0, B: 1, C: 2 }
  const raceWeekMap = new Map()  // weekIndex → race object

  for (const race of races) {
    if (!race.date) continue
    const rd = new Date(race.date)
    for (let w = 0; w < 52; w++) {
      const ws = new Date(weeks[w].weekStart)
      const we = new Date(ws)
      we.setDate(ws.getDate() + 6)
      if (rd >= ws && rd <= we) {
        const existing = raceWeekMap.get(w)
        if (!existing || PRANK[race.priority] < PRANK[existing.priority]) {
          raceWeekMap.set(w, race)
        }
        break
      }
    }
  }

  const aRaceWeeks = []
  for (const [w, r] of raceWeekMap) {
    if (r.priority === 'A') aRaceWeeks.push(w)
  }
  aRaceWeeks.sort((a, b) => a - b)

  const lastRaceWeek = raceWeekMap.size > 0 ? Math.max(...raceWeekMap.keys()) : -1

  // ── Phase assignment (priority order from spec) ────────────────────────────
  for (let w = 0; w < 52; w++) {
    const race = raceWeekMap.get(w)

    // Rule 1: Race week
    if (race) {
      weeks[w].phase    = 'Race'
      weeks[w].raceName = race.name
      weeks[w].raceDate = race.date
      weeks[w].priority = race.priority
      continue
    }

    // Rule 2: Week after A/B race
    const prevRace = raceWeekMap.get(w - 1)
    if (prevRace && (prevRace.priority === 'A' || prevRace.priority === 'B')) {
      weeks[w].phase = 'Recovery'
      continue
    }

    // Rule 5: After last race → Transition
    if (lastRaceWeek >= 0 && w > lastRaceWeek) {
      weeks[w].phase = 'Transition'
      continue
    }

    // Rule 4: No A races defined
    if (aRaceWeeks.length === 0) {
      weeks[w].phase = w >= 50 ? 'Peak' : 'Base'
      continue
    }

    // Rule 3: Count back from nearest upcoming A race
    let nearestA = null
    for (const r of aRaceWeeks) {
      if (r > w) { nearestA = r; break }
    }

    if (nearestA === null) {
      // Past all A races (e.g. only B/C remain)
      weeks[w].phase = 'Base'
      continue
    }

    const weeksToRace = nearestA - w
    if (weeksToRace <= 2)       weeks[w].phase = 'Peak'
    else if (weeksToRace <= 10) weeks[w].phase = 'Build'
    else                        weeks[w].phase = 'Base'
  }

  // ── TSS calculation ────────────────────────────────────────────────────────
  const baseTSS      = Math.max(currentCTL * 7, maxHoursPerWeek * 45)
  const maxAllowed   = maxHoursPerWeek * 65
  const peakTSS      = Math.min(targetCTL * 7, maxAllowed)

  let prevTSS = baseTSS

  for (let w = 0; w < 52; w++) {
    const phase   = weeks[w].phase
    const weekNum = w + 1

    let tss
    if (phase === 'Build') {
      // Linear progression within the current build block
      let blockStart = w
      while (blockStart > 0 && weeks[blockStart - 1].phase === 'Build') blockStart--
      let blockEnd = w
      while (blockEnd < 51 && weeks[blockEnd + 1].phase === 'Build') blockEnd++
      const blockLen = blockEnd - blockStart + 1
      const pos  = w - blockStart
      const frac = blockLen > 1 ? pos / (blockLen - 1) : 1
      tss = baseTSS + (peakTSS - baseTSS) * frac
    } else if (phase === 'Peak')       { tss = peakTSS * 0.85 }
    else if (phase === 'Race')         { tss = peakTSS * 0.45 }
    else if (phase === 'Recovery')     { tss = baseTSS * 0.55 }
    else if (phase === 'Transition')   { tss = baseTSS * 0.40 }
    else                               { tss = baseTSS }  // Base

    // Deload every 4th week (not Race / Recovery / Transition)
    const canDeload = !['Race', 'Recovery', 'Transition'].includes(phase)
    if (canDeload && weekNum % 4 === 0) {
      tss = prevTSS * 0.6
      weeks[w].isDeload = true
    }

    tss = Math.min(tss, maxAllowed)
    tss = Math.max(tss, 0)

    weeks[w].targetTSS    = Math.round(tss)
    weeks[w].plannedHours = Math.round(tss / 60 * 10) / 10

    prevTSS = tss
  }

  // ── Zone distributions ─────────────────────────────────────────────────────
  for (let w = 0; w < 52; w++) {
    weeks[w].zoneDistribution = getZoneDistribution(model, weeks[w].phase, w + 1)
  }

  // ── CTL projection ─────────────────────────────────────────────────────────
  const projectedCTL = projectForwardCTL(currentCTL, weeks, trainingDays)

  // ── Warnings ───────────────────────────────────────────────────────────────
  const warnings = validatePlan(weeks, currentCTL)

  return { weeks, warnings, projectedCTL }
}

// ─── 2. validatePlan ─────────────────────────────────────────────────────────
export function validatePlan(weeks, _currentCTL = 0) {
  const warnings = []

  if (!weeks || weeks.length === 0) return warnings

  // Plan too short
  if (weeks.length < 8) {
    warnings.push(`Plan is ${weeks.length} weeks — minimum 8 weeks recommended for meaningful adaptation`)
  }

  // TSS spike > 50% between consecutive weeks
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1].targetTSS
    const curr = weeks[i].targetTSS
    if (prev > 0 && curr > prev * 1.5) {
      warnings.push(`Week ${weeks[i].weekNum}: TSS jumps >50% vs prior week — injury risk`)
    }
  }

  // Races too close together
  const raceWeeks = weeks.filter(w => w.phase === 'Race' && w.raceDate)
  for (let i = 0; i < raceWeeks.length; i++) {
    for (let j = i + 1; j < raceWeeks.length; j++) {
      const dA   = new Date(raceWeeks[i].raceDate)
      const dB   = new Date(raceWeeks[j].raceDate)
      const days = Math.round(Math.abs(dB - dA) / 86400000)
      if (days < 10) {
        warnings.push(
          `Races "${raceWeeks[i].raceName}" and "${raceWeeks[j].raceName}" are ${days} days apart — minimum 10 days needed`
        )
      }
    }
  }

  // No deload in 5+ consecutive build/base weeks
  let streak = 0
  for (let i = 0; i < weeks.length; i++) {
    const ph = weeks[i].phase
    if ((ph === 'Build' || ph === 'Base') && !weeks[i].isDeload) {
      streak++
      if (streak === 5) {
        warnings.push(`No deload in ${streak} consecutive build weeks (max recommended: 4)`)
      }
    } else {
      streak = 0
    }
  }

  return warnings
}

// ─── 3. updateWeekTSS ────────────────────────────────────────────────────────
// Pure — returns new array; original is untouched.
export function updateWeekTSS(weeks, weekIndex, newTSS) {
  return weeks.map((w, i) => {
    if (i !== weekIndex) return w
    const tss        = Math.max(0, Math.round(newTSS))
    const canDeload  = !['Race', 'Recovery', 'Transition'].includes(w.phase)
    const isDeload   = canDeload && w.weekNum % 4 === 0
    return {
      ...w,
      targetTSS:    tss,
      plannedHours: Math.round(tss / 60 * 10) / 10,
      isDeload,
    }
  })
}

// ─── 4. exportPlanCSV ────────────────────────────────────────────────────────
export function exportPlanCSV(weeks) {
  const header = 'Week,Start,Phase,TargetTSS,Hours,Z1%,Z2%,Z3%,Z4%,Z5%,Race,Priority,Notes'
  const rows   = (weeks || []).map(w => {
    const z = w.zoneDistribution || {}
    return [
      w.weekNum,
      w.weekStart,
      w.phase,
      w.targetTSS,
      w.plannedHours,
      Math.round((z.Z1 || 0) * 100),
      Math.round((z.Z2 || 0) * 100),
      Math.round((z.Z3 || 0) * 100),
      Math.round((z.Z4 || 0) * 100),
      Math.round((z.Z5 || 0) * 100),
      w.raceName   || '',
      w.priority   || '',
      (w.note || '').replace(/,/g, ';'),  // escape commas in notes
    ].join(',')
  })
  return [header, ...rows].join('\n')
}
