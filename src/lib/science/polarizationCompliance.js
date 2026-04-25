// src/lib/science/polarizationCompliance.js
// E16 — Week-by-Week Polarization Compliance
//
// Scientific basis:
//   Seiler S. & Kjerland G.Ø. (2006) Characterising the exercise intensity
//     distribution in elite endurance athletes: is there evidence for an
//     "optimal" distribution? Scand J Med Sci Sports 16(1):49–56.
//   Stöggl T. & Sperlich B. (2014) Polarized training has greater impact on
//     key endurance variables than threshold, high intensity, or high volume
//     training. Front Physiol 5:33.

const CITATION =
  'Seiler S. & Kjerland G.Ø. (2006) Scand J Med Sci Sports 16(1):49–56'

export const SEILER_TARGET = { easy: 80, hard: 20 }

// ── weekStart ─────────────────────────────────────────────────────────────────

/**
 * Returns the Monday ISO date string (YYYY-MM-DD) of the week containing dateStr.
 *
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {string}        YYYY-MM-DD of the preceding (or same-day) Monday
 */
export function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  // getUTCDay(): 0=Sun, 1=Mon, …, 6=Sat
  const dow = d.getUTCDay()
  // Days to subtract to get to Monday (0 → 6, 1 → 0, 2 → 1, …)
  const toMon = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - toMon)
  return d.toISOString().slice(0, 10)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract {easyMin, threshMin, hardMin} from a single log entry.
 * Priority: entry.zones (Z1–Z5); fallback: RPE-based; fallback: skip.
 *
 * Duration detection: if value > 600 → assume seconds, convert to minutes.
 *                     if value ≤ 600 → assume already minutes.
 *
 * @param {Object} entry
 * @returns {{ easyMin: number, threshMin: number, hardMin: number } | null}
 *   Returns null when no zone or RPE data is available.
 */
function _zoneMinutes(entry) {
  if (!entry) return null

  // ── Zone data path ─────────────────────────────────────────────────────────
  const z1 = entry.zones?.Z1 ?? null
  const z2 = entry.zones?.Z2 ?? null
  const z3 = entry.zones?.Z3 ?? null
  const z4 = entry.zones?.Z4 ?? null
  const z5 = entry.zones?.Z5 ?? null

  const hasZones = z1 !== null || z2 !== null || z3 !== null ||
                   z4 !== null || z5 !== null

  if (hasZones) {
    return {
      easyMin:   (z1 ?? 0) + (z2 ?? 0),
      threshMin: (z3 ?? 0),
      hardMin:   (z4 ?? 0) + (z5 ?? 0),
    }
  }

  // ── RPE fallback ───────────────────────────────────────────────────────────
  const rpe = entry.rpe ?? null
  if (rpe === null || rpe === undefined) return null

  // Determine session duration in minutes
  let rawDur = entry.duration ?? null
  if (rawDur === null || rawDur === undefined) return null
  const durMin = rawDur > 600 ? rawDur / 60 : rawDur

  if (rpe <= 5) {
    return { easyMin: durMin, threshMin: 0, hardMin: 0 }
  }
  if (rpe <= 7) {
    return { easyMin: 0, threshMin: durMin, hardMin: 0 }
  }
  // rpe >= 8
  return { easyMin: 0, threshMin: 0, hardMin: durMin }
}

// ── weeklyPolarizationScore ───────────────────────────────────────────────────

/**
 * Compute polarization compliance for the 7-day block starting weekStartISO.
 *
 * @param {Object[]} log           Training log entries with at least { date }.
 * @param {string}   weekStartISO  Monday ISO date (YYYY-MM-DD).
 * @returns {{
 *   weekStart:       string,
 *   easyPct:         number,
 *   hardPct:         number,
 *   thresholdPct:    number,
 *   totalMin:        number,
 *   complianceScore: number | null,
 *   model:           'polarized'|'pyramidal'|'threshold'|'unstructured'|'insufficient_data',
 *   citation:        string,
 * }}
 */
export function weeklyPolarizationScore(log, weekStartISO) {
  const safeLog = Array.isArray(log) ? log : []

  // 7-day window: weekStartISO (Mon) through weekStartISO+6 (Sun)
  const d = new Date(weekStartISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 6)
  const weekEndISO = d.toISOString().slice(0, 10)

  let easyMin   = 0
  let threshMin = 0
  let hardMin   = 0

  for (const entry of safeLog) {
    const date = (entry.date ?? '').slice(0, 10)
    if (date < weekStartISO || date > weekEndISO) continue
    const mins = _zoneMinutes(entry)
    if (!mins) continue   // no usable zone/RPE data — skip
    easyMin   += mins.easyMin
    threshMin += mins.threshMin
    hardMin   += mins.hardMin
  }

  const totalMin = easyMin + threshMin + hardMin

  // Percentages (guard against division by zero)
  const easyPct      = totalMin > 0 ? (easyMin   / totalMin) * 100 : 0
  const thresholdPct = totalMin > 0 ? (threshMin / totalMin) * 100 : 0
  const hardPct      = totalMin > 0 ? (hardMin   / totalMin) * 100 : 0

  // ── Model classification ───────────────────────────────────────────────────
  let model
  let complianceScore

  if (totalMin < 60) {
    model           = 'insufficient_data'
    complianceScore = null
  } else {
    // Determine model
    if (easyPct >= 75 && hardPct >= 10) {
      model = 'polarized'
    } else if (easyPct >= 60 && thresholdPct >= 20) {
      model = 'pyramidal'
    } else if (thresholdPct > 40) {
      model = 'threshold'
    } else {
      model = 'unstructured'
    }

    // ── Compliance score ───────────────────────────────────────────────────
    // Weighted deviation from Seiler 80/20 target
    const easyDev = Math.abs(easyPct - 80) / 80
    const hardDev = Math.abs(hardPct - 20) / 20
    const raw     = 1 - (easyDev * 0.6 + hardDev * 0.4)
    complianceScore = Math.max(0, Math.min(100, Math.round(raw * 100)))
  }

  return {
    weekStart:      weekStartISO,
    easyPct:        Math.round(easyPct * 10) / 10,
    hardPct:        Math.round(hardPct * 10) / 10,
    thresholdPct:   Math.round(thresholdPct * 10) / 10,
    totalMin:       Math.round(totalMin * 10) / 10,
    complianceScore,
    model,
    citation:       CITATION,
  }
}

// ── polarizationTrend ─────────────────────────────────────────────────────────

/**
 * Build an array of weeklyPolarizationScore for the last `weeks` Mondays,
 * oldest first.
 *
 * @param {Object[]} log
 * @param {number}   [weeks]  Number of weeks (default 8).
 * @param {string}   [today]  Reference date YYYY-MM-DD. Defaults to system date.
 * @returns {Object[]}  Array of length `weeks`.
 */
export function polarizationTrend(
  log,
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  // Compute the Monday of the week that contains today
  const currentWeekMon = weekStart(today)

  // Build array oldest → newest
  const result = []
  for (let w = weeks - 1; w >= 0; w--) {
    const d = new Date(currentWeekMon + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - w * 7)
    const mon = d.toISOString().slice(0, 10)
    result.push(weeklyPolarizationScore(log, mon))
  }
  return result
}

// ── overallPolarizationCompliance ─────────────────────────────────────────────

/**
 * Aggregate compliance across the last `weeks` weeks.
 *
 * @param {Object[]} log
 * @param {number}   [weeks]  Default 8.
 * @param {string}   [today]  Default system date.
 * @returns {{
 *   meanScore:      number | null,
 *   weeksAnalyzed:  number,
 *   modelCounts:    { polarized: number, pyramidal: number, threshold: number, unstructured: number, insufficient_data: number },
 * }}
 */
export function overallPolarizationCompliance(
  log,
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  const trend = polarizationTrend(log, weeks, today)

  const modelCounts = {
    polarized:         0,
    pyramidal:         0,
    threshold:         0,
    unstructured:      0,
    insufficient_data: 0,
  }

  let scoreSum      = 0
  let weeksAnalyzed = 0

  for (const week of trend) {
    modelCounts[week.model] = (modelCounts[week.model] ?? 0) + 1
    if (week.complianceScore !== null) {
      scoreSum += week.complianceScore
      weeksAnalyzed++
    }
  }

  return {
    meanScore:     weeksAnalyzed > 0 ? Math.round(scoreSum / weeksAnalyzed) : null,
    weeksAnalyzed,
    modelCounts,
  }
}
