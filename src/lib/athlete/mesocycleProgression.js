// src/lib/athlete/mesocycleProgression.js
//
// Mesocycle Progression — adherence detector for Issurin 2010 block
// periodization 3:1 work:recovery week pattern.
//
// A canonical mesocycle is 4 weeks: 3 progressive load weeks followed by
// 1 deload week (~50–70% of preceding peak). Detecting whether the
// athlete's actual training log clusters into clean 3:1 quartets (vs.
// drifting into chaotic or no-deload patterns) surfaces adherence to a
// well-grounded periodization model without forcing the athlete to plan
// it explicitly.
//
// Scientific grounding:
//   - Issurin V. (2010) "New Horizons for the Methodology and Physiology
//     of Training Periodization" — block periodization & 3:1 ratio.
//   - Bompa T. (2018) "Periodization: Theory and Methodology of
//     Training" — canonical 4-week microcycle stacking.
//
// Output bands:
//   ON_PATTERN        — ≥ 2 clean 3:1 mesocycles in window (adhering)
//   NO_DELOAD         — no deload weeks at all, non-trivial volume
//   CHAOTIC           — neither clean cycles nor a clear no-deload run
//   CONTINUOUS_LOAD   — sustained volume with only 1 deload in window
//   OVER_DELOADED     — > 40 % of weeks classified as deload weeks
//
// Pure function. No React, no I/O.

export const MESOCYCLE_PROGRESSION_CITATION = 'Issurin 2010; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const WINDOW_WEEKS = 12
const MIN_NON_ZERO_WEEKS = 8
const DELOAD_RATIO = 0.75              // deload week TSS < 0.75 × mean(prior 3)
const MIN_BUILD_TSS_FOR_DELOAD = 0     // each prior 3 week must have tss > 0
const NO_DELOAD_MEAN_FLOOR = 100       // mean weekly TSS to qualify NO_DELOAD
const OVER_DELOADED_FRACTION = 0.40    // > 40 % weeks deload → OVER_DELOADED
const CYCLE_LEN = 4

// Resolve `today` (YYYY-MM-DD string or Date) to a YYYY-MM-DD UTC key.
function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) return key
  }
  return null
}

// Monday (ISO-8601, Mon-anchored) of the week containing `iso`.
function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Test whether `weekIdx` is a deload week vs its three preceding weeks.
function isDeloadWeek(weeks, weekIdx) {
  if (weekIdx < 3) return false
  const w = weeks[weekIdx]
  if (!(w.tss >= 0)) return false
  const prior = [weeks[weekIdx - 3], weeks[weekIdx - 2], weeks[weekIdx - 1]]
  if (prior.some(p => !(p.tss > MIN_BUILD_TSS_FOR_DELOAD))) return false
  const mean = (prior[0].tss + prior[1].tss + prior[2].tss) / 3
  if (!(mean > 0)) return false
  return w.tss < DELOAD_RATIO * mean
}

/**
 * Analyze mesocycle progression across the last `windowWeeks` ISO weeks
 * (Mon–Sun) ending in the week containing `today`.
 *
 * @param {{
 *   log: Array<{ date: string, tss?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'ON_PATTERN' | 'NO_DELOAD' | 'CHAOTIC' | 'CONTINUOUS_LOAD' | 'OVER_DELOADED',
 *   weeks: Array<{ weekStart: string, tss: number, role: 'BUILD' | 'DELOAD' | 'PEAK' | 'UNKNOWN' }>,
 *   mesocyclesDetected: number,
 *   deloadDepth: number | null,
 *   citation: string,
 * } | null}
 */
export function analyzeMesocycleProgression({ log, today, windowWeeks = WINDOW_WEEKS } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(1, Math.floor(Number(windowWeeks) || WINDOW_WEEKS))

  // Build the window: oldest first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, tss: 0 })
  }

  const idxByWeekStart = {}
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue
      const wkStart = isoMondayOf(key)
      const idx = idxByWeekStart[wkStart]
      if (idx == null) continue
      const tss = Number(e.tss)
      if (!Number.isFinite(tss) || tss <= 0) continue
      weeks[idx].tss += tss
    }
  }

  // Min-signal gate: require ≥ MIN_NON_ZERO_WEEKS of `safeWindow` weeks
  // to carry any load. For smaller windows, require 2/3 of the window.
  const nonZeroWeeks = weeks.reduce((n, w) => n + (w.tss > 0 ? 1 : 0), 0)
  const minRequired = safeWindow >= MIN_NON_ZERO_WEEKS
    ? MIN_NON_ZERO_WEEKS
    : Math.ceil(safeWindow * (2 / 3))
  if (nonZeroWeeks < minRequired) return null

  // Build role tags + clean-cycle detection.
  const roles = new Array(weeks.length).fill('UNKNOWN')
  const deloadEntries = []   // { idx, depth }
  let mesocyclesDetected = 0

  // Slide a 4-week NON-OVERLAPPING window across `weeks`. Cycles end at
  // index 3, 7, 11, ... — i.e. each quartet covers indices
  // [start, start+1, start+2, start+3] with start ∈ {0, 4, 8, ...}.
  for (let start = 0; start + CYCLE_LEN - 1 < weeks.length; start += CYCLE_LEN) {
    const a = weeks[start]
    const b = weeks[start + 1]
    const c = weeks[start + 2]
    const d = weeks[start + 3]

    // Each build week must have positive TSS.
    if (!(a.tss > 0 && b.tss > 0 && c.tss > 0)) continue

    const peak = Math.max(a.tss, b.tss, c.tss)
    const mean3 = (a.tss + b.tss + c.tss) / 3
    if (!(mean3 > 0)) continue

    // Deload week criterion: < 0.75 × mean of preceding three weeks.
    if (!(d.tss < DELOAD_RATIO * mean3)) continue

    mesocyclesDetected += 1
    // Tag the BUILD trio.
    for (let i = start; i < start + 3; i++) {
      roles[i] = (weeks[i].tss === peak) ? 'PEAK' : 'BUILD'
    }
    // Tag the deload.
    roles[start + 3] = 'DELOAD'

    deloadEntries.push({ idx: start + 3, depth: d.tss / peak })
  }

  // Independent deload-week detection (rolling, not aligned to quartets)
  // — used to power the no-deload / over-deloaded heuristics. This may
  // catch deload weeks that didn't land in a clean quartet position.
  const rollingDeloadIdx = []
  for (let i = 3; i < weeks.length; i++) {
    if (roles[i] === 'DELOAD') {
      rollingDeloadIdx.push(i)
      continue
    }
    if (isDeloadWeek(weeks, i)) rollingDeloadIdx.push(i)
  }

  // deloadDepth — mean over CLEAN-CYCLE deload weeks of
  // (deloadWeekTss / max(precedingThreeWeeksTss)).
  let deloadDepth = null
  if (deloadEntries.length > 0) {
    const sum = deloadEntries.reduce((s, e) => s + e.depth, 0)
    const raw = sum / deloadEntries.length
    deloadDepth = Math.round(raw * 10000) / 10000
  }

  const meanWeekTss = weeks.reduce((s, w) => s + w.tss, 0) / weeks.length
  const deloadCount = rollingDeloadIdx.length
  const deloadFraction = deloadCount / weeks.length

  // ── Band classification ──────────────────────────────────────────────
  let band
  if (mesocyclesDetected >= 2) {
    band = 'ON_PATTERN'
  } else if (deloadFraction > OVER_DELOADED_FRACTION) {
    band = 'OVER_DELOADED'
  } else if (mesocyclesDetected === 0 && deloadCount === 0 && meanWeekTss > NO_DELOAD_MEAN_FLOOR) {
    band = 'NO_DELOAD'
  } else if (mesocyclesDetected <= 1 && deloadCount === 1 && meanWeekTss > NO_DELOAD_MEAN_FLOOR) {
    band = 'CONTINUOUS_LOAD'
  } else {
    band = 'CHAOTIC'
  }

  return {
    band,
    weeks: weeks.map((w, i) => ({
      weekStart: w.weekStart,
      tss: Math.round(w.tss),
      role: roles[i],
    })),
    mesocyclesDetected,
    deloadDepth,
    citation: MESOCYCLE_PROGRESSION_CITATION,
  }
}
