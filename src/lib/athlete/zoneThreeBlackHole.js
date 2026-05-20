// src/lib/athlete/zoneThreeBlackHole.js
//
// Z3 "Black Hole" Detector — Seiler 2010 + Stöggl 2014 "fitness death zone".
//
// Detects the canonical self-coached endurance anti-pattern: spending
// substantial time in moderate-intensity (Z3 / tempo) without earning either
// the aerobic stimulus of Z1+Z2 (volume) or the VO2 / threshold stimulus of
// Z4+Z5 (intensity). The pure-polarized model says hard time should be
// specifically Z4–Z5; Z3 dominance is the classic mistake.
//
// Distinct from sibling zone cards:
//   - TimeInZoneCard         → all-zone share vs targets (28d snapshot)
//   - IntensityBalanceCard   → easy vs hard share (RPE 1–5 vs 6–10)
//   - PolarizationCompliance → distribution shape (polarized vs pyramidal …)
//
// This card *isolates* Z3 minutes vs (Z4+Z5) minutes over an 8-ISO-week
// window, and surfaces the ratio z3 / (z4+z5). Even if total easy time looks
// fine, a high Z3-vs-HARD ratio reveals the black-hole pattern.
//
// Citation:
//   Seiler S. (2010). What is best practice for training intensity and
//     duration distribution in endurance athletes?
//     Int J Sports Physiol Perform 5:276–291.
//   Stöggl T, Sperlich B. (2014). Polarized training has greater impact on
//     key endurance variables than threshold, high-intensity, or
//     high-volume training. Front Physiol 5:33.
//
// Pure function. No React, no I/O.

export const ZONE_THREE_BLACK_HOLE_CITATION = 'Seiler 2010; Stöggl 2014'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const WINDOW_WEEKS_DEFAULT = 8
const MIN_TOTAL_NON_EASY_MIN = 60
const Z3_SHARE_POLARIZED_CEIL = 25
const Z3_SHARE_BALANCED_CEIL = 60

// ─── Date helpers (UTC, ISO 8601 Monday-first weeks) ─────────────────────────
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

function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Classify a single entry into Z3 / HARD / SKIP.
// Returns: 'Z3' | 'HARD' | null (skip).
function classifyEntry(entry) {
  // Prefer explicit zone string when present.
  const z = entry?.zone
  if (typeof z === 'string' && z.length) {
    const norm = z.trim().toLowerCase()
    if (/^z3$/.test(norm)) return 'Z3'
    if (/^z[45]$/.test(norm)) return 'HARD'
    // Any other explicit zone (z1, z2, etc.) → not Z3 and not HARD.
    if (/^z[12]$/.test(norm)) return null
    // Fall through to RPE for unknown zone strings.
  }
  // Fallback to RPE.
  const rpeNum = Number(entry?.rpe)
  if (Number.isFinite(rpeNum)) {
    if (rpeNum >= 5 && rpeNum <= 6) return 'Z3'
    if (rpeNum >= 7) return 'HARD'
    // rpe ≤ 4 → easy, skip.
    return null
  }
  // Neither zone nor RPE present → skip.
  return null
}

function classifyBand({ totalZ3Min, totalHardMin, z3SharePct }) {
  if (totalZ3Min + totalHardMin < MIN_TOTAL_NON_EASY_MIN) {
    return 'INSUFFICIENT_HARD_VOLUME'
  }
  if (z3SharePct < Z3_SHARE_POLARIZED_CEIL) return 'POLARIZED'
  if (z3SharePct < Z3_SHARE_BALANCED_CEIL) return 'BALANCED'
  return 'BLACK_HOLE'
}

/**
 * Analyze Z3-vs-(Z4+Z5) split across the last `windowWeeks` ISO weeks.
 *
 * @param {{
 *   log: Array<{ date: string, zone?: string, rpe?: number,
 *     durationMin?: number, duration_min?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'POLARIZED' | 'BALANCED' | 'BLACK_HOLE' | 'INSUFFICIENT_HARD_VOLUME',
 *   weeks: Array<{ weekStart: string, z3Min: number, hardMin: number }>,
 *   totalZ3Min: number,
 *   totalHardMin: number,
 *   z3ToHardRatio: number | null,
 *   z3SharePct: number,
 *   citation: string,
 * } | null}
 */
export function analyzeZoneThreeBlackHole({
  log,
  today,
  windowWeeks = WINDOW_WEEKS_DEFAULT,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    1,
    Math.floor(Number(windowWeeks) || WINDOW_WEEKS_DEFAULT),
  )

  // Build window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, z3Min: 0, hardMin: 0 })
  }

  const idxByWeekStart = new Map()
  weeks.forEach((w, i) => idxByWeekStart.set(w.weekStart, i))

  const earliestWeekStart = weeks[0].weekStart
  // Exclusive end: Monday of the week AFTER current week.
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue

      const rawDur = e.durationMin ?? e.duration_min
      const dur = Number(rawDur)
      if (!Number.isFinite(dur) || dur <= 0) continue

      const cls = classifyEntry(e)
      if (!cls) continue

      const wkStart = isoMondayOf(key)
      const idx = idxByWeekStart.get(wkStart)
      if (idx == null) continue

      if (cls === 'Z3') weeks[idx].z3Min += dur
      else if (cls === 'HARD') weeks[idx].hardMin += dur
    }
  }

  let totalZ3Min = 0
  let totalHardMin = 0
  for (const w of weeks) {
    totalZ3Min += w.z3Min
    totalHardMin += w.hardMin
  }

  // Round per-week and totals to integer minutes for stable output.
  const roundedWeeks = weeks.map(w => ({
    weekStart: w.weekStart,
    z3Min: Math.round(w.z3Min),
    hardMin: Math.round(w.hardMin),
  }))
  const totalZ3MinR = Math.round(totalZ3Min)
  const totalHardMinR = Math.round(totalHardMin)

  // z3ToHardRatio: divide by max(totalHardMin, 0.0001) but expose null when
  // totalHardMin === 0 (so the UI can render "∞" instead of a huge number).
  const denom = Math.max(totalHardMinR, 0.0001)
  const z3ToHardRatio = totalHardMinR === 0
    ? null
    : Math.round((totalZ3MinR / denom) * 10000) / 10000

  // z3SharePct (2dp). When both buckets are zero → 0.
  let z3SharePct = 0
  if (totalZ3MinR + totalHardMinR > 0) {
    z3SharePct = Math.round(
      (totalZ3MinR / (totalZ3MinR + totalHardMinR)) * 10000,
    ) / 100
  }

  const band = classifyBand({
    totalZ3Min: totalZ3MinR,
    totalHardMin: totalHardMinR,
    z3SharePct,
  })

  return {
    band,
    weeks: roundedWeeks,
    totalZ3Min: totalZ3MinR,
    totalHardMin: totalHardMinR,
    z3ToHardRatio,
    z3SharePct,
    citation: ZONE_THREE_BLACK_HOLE_CITATION,
  }
}
