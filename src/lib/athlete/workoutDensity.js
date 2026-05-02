// ─── workoutDensity.js — E121: Workout Density Detector (4-week window) ──────
// Detects athletes who run 4+ days/week of moderate-or-harder sessions
// (RPE ≥ 6 OR Z3+Z4+Z5 share > 40%) for 2+ consecutive weeks — a pattern
// associated with elevated injury / overtraining risk.
// Based on Gabbett 2016 (training load + injury) and Hulin 2016 (ACWR).
// ─────────────────────────────────────────────────────────────────────────────

export const WORKOUT_DENSITY_CITATION = 'Gabbett 2016; Hulin 2016'

// High-intensity thresholds (single source of truth)
const RPE_THRESHOLD = 6           // RPE ≥ 6 counts as moderate-or-harder
const HI_ZONE_SHARE = 0.40        // Z3+Z4+Z5 must exceed 40% of session
const HI_DAYS_PER_WEEK = 4        // ≥ 4 hi-days/week = flagged week

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
/**
 * Add `days` to a 'YYYY-MM-DD' string and return new 'YYYY-MM-DD' (UTC).
 */
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Return the Monday-of-week ('YYYY-MM-DD') for any UTC date string.
 * ISO weeks: Mon=0, Sun=6. We map JS getUTCDay() (Sun=0..Sat=6) to ISO offset.
 */
function isoWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()         // Sun=0, Mon=1, ..., Sat=6
  const offset = dow === 0 ? 6 : dow - 1   // distance back to Monday
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

// ─── Zone parsing ────────────────────────────────────────────────────────────
/**
 * Compute the Z3+Z4+Z5 share (0..1) of a single entry's session.
 * Mirrors the parsing pattern in staleZones.js / intelligence.js:analyzeZoneBalance.
 *
 * Supports two zones shapes:
 *   1. entry.zones is an array of 5 numbers [Z1,Z2,Z3,Z4,Z5]
 *   2. entry.zones is an object {Z1, Z2, ...} or {z1, z2, ...}
 *
 * If zones are absent/empty, returns 0 (caller will fall back to RPE).
 *
 * @param {Object} entry
 * @returns {number} share of Z3+Z4+Z5 in [0, 1]
 */
function entryHiZoneShare(entry) {
  const z = entry?.zones
  let z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0
  if (Array.isArray(z) && z.some(v => Number(v) > 0)) {
    z1 = Number(z[0]) || 0
    z2 = Number(z[1]) || 0
    z3 = Number(z[2]) || 0
    z4 = Number(z[3]) || 0
    z5 = Number(z[4]) || 0
  } else if (z && typeof z === 'object') {
    z1 = Number(z.Z1 ?? z.z1 ?? 0) || 0
    z2 = Number(z.Z2 ?? z.z2 ?? 0) || 0
    z3 = Number(z.Z3 ?? z.z3 ?? 0) || 0
    z4 = Number(z.Z4 ?? z.z4 ?? 0) || 0
    z5 = Number(z.Z5 ?? z.z5 ?? 0) || 0
  } else {
    return 0
  }
  const total = z1 + z2 + z3 + z4 + z5
  if (total <= 0) return 0
  return (z3 + z4 + z5) / total
}

/**
 * Decide whether a single session entry is "high intensity":
 *   - RPE ≥ 6, OR
 *   - Z3+Z4+Z5 share strictly > 40% of session (when zones present)
 */
function isHiIntensitySession(entry) {
  const rpe = Number(entry?.rpe) || 0
  if (rpe >= RPE_THRESHOLD) return true
  const share = entryHiZoneShare(entry)
  return share > HI_ZONE_SHARE
}

// ─── detectWorkoutDensity ────────────────────────────────────────────────────
/**
 * Compute workout density (consecutive high-intensity day counts) over the
 * trailing 28 days and detect injury-risk patterns.
 *
 * High-intensity day = any session with RPE ≥ 6, OR zones Z3+Z4+Z5 share > 40%
 * of session duration. Multiple sessions on the same day are coalesced.
 *
 * Risk pattern: 4+ high-intensity days/week for 2+ consecutive ISO weeks.
 *
 * Risk levels (consecutiveFlagged ending most recent week):
 *   - 0  → 'low'
 *   - 1  → 'moderate'
 *   - ≥2 → 'high'
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   weeks: Array<{ weekStart: string, weekEnd: string, hiDays: number,
 *                  flagged: boolean }>,
 *   consecutiveFlagged: number,
 *   risk: 'low'|'moderate'|'high',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectWorkoutDensity(log, today = new Date().toISOString().slice(0, 10)) {
  const lowMsg = {
    en: 'Workout density healthy.',
    tr: 'Antrenman yoğunluğu sağlıklı.',
  }
  const lowRec = { en: '', tr: '' }

  const empty = {
    weeks: [],
    consecutiveFlagged: 0,
    risk: 'low',
    message: lowMsg,
    recommendation: lowRec,
    reliable: false,
    citation: WORKOUT_DENSITY_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  // ─── Determine the 4 ISO weeks ending today ────────────────────────────────
  // Week 4 (most recent) = ISO week containing today.
  const w4Start = isoWeekStart(today)
  const weekStarts = [
    addDaysStr(w4Start, -21),   // week 1 (oldest)
    addDaysStr(w4Start, -14),   // week 2
    addDaysStr(w4Start, -7),    // week 3
    w4Start,                    // week 4 (most recent)
  ]

  // 28-day window = oldest weekStart .. weekEnd of most-recent week
  const windowStart = weekStarts[0]
  const windowEnd   = addDaysStr(w4Start, 6)  // Sunday of week 4

  // ─── Coalesce sessions → set of high-intensity days within the window ──────
  const recent = log.filter(e =>
    e?.date && e.date >= windowStart && e.date <= windowEnd
  )

  const hiDays = new Set()
  for (const entry of recent) {
    if (isHiIntensitySession(entry)) hiDays.add(entry.date)
  }

  // Reliability: need ≥14 distinct days of any logged data in the window.
  const distinctDays = new Set(recent.map(e => e.date))
  const reliable = distinctDays.size >= 14

  // ─── Bucket hi-days into the 4 weeks ───────────────────────────────────────
  const weeks = weekStarts.map(weekStart => {
    const weekEnd = addDaysStr(weekStart, 6)
    let count = 0
    for (const d of hiDays) {
      if (d >= weekStart && d <= weekEnd) count++
    }
    return {
      weekStart,
      weekEnd,
      hiDays: count,
      flagged: count >= HI_DAYS_PER_WEEK,
    }
  })

  // ─── Consecutive flagged weeks ending most recent ──────────────────────────
  let consecutiveFlagged = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].flagged) consecutiveFlagged++
    else break
  }

  // ─── Risk classification + bilingual messages ──────────────────────────────
  let risk, message, recommendation
  if (consecutiveFlagged >= 2) {
    risk = 'high'
    message = {
      en: `${consecutiveFlagged} consecutive weeks of 4+ hard days — injury risk.`,
      tr: `Üst üste ${consecutiveFlagged} hafta 4+ ağır gün — yaralanma riski.`,
    }
    recommendation = {
      en: 'Take 1-2 easy days; reassess after recovery.',
      tr: '1-2 kolay gün geçir; toparlanma sonrası tekrar değerlendir.',
    }
  } else if (consecutiveFlagged === 1) {
    risk = 'moderate'
    message = {
      en: '1 week of high density — monitor recovery.',
      tr: '1 hafta yüksek yoğunluk — toparlanmayı izle.',
    }
    recommendation = {
      en: 'Add a recovery day this week.',
      tr: 'Bu hafta bir toparlanma günü ekle.',
    }
  } else {
    risk = 'low'
    message = lowMsg
    recommendation = lowRec
  }

  return {
    weeks,
    consecutiveFlagged,
    risk,
    message,
    recommendation,
    reliable,
    citation: WORKOUT_DENSITY_CITATION,
  }
}
