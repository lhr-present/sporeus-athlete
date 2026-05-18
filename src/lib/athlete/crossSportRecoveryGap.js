// ─── crossSportRecoveryGap.js — Cross-Sport Recovery Gap Tracker ────────────
// For each discipline (run / bike / swim / strength) report days since the
// most recent session and classify whether the gap is FRESH, OK, STALE or
// NEVER. Multi-sport athletes use this to detect a discipline drifting out
// of rotation before overuse risk creeps in via single-mode dominance.
//
// Cite: Bompa 2018 "Periodization: Theory and Methodology of Training" —
//       sport-specific recovery windows;
//       Hreljac 2004 "Impact and overuse injuries in runners" — variety
//       reduces cumulative loading on a single tissue chain.
//
// Pure module, no React, fully deterministic on `today`.
// ─────────────────────────────────────────────────────────────────────────────

export const CROSS_SPORT_RECOVERY_GAP_CITATION = 'Bompa 2018; Hreljac 2004'

// Sport-specific recovery windows (Bompa 2018 rule-of-thumb)
// idealMaxDays = upper bound of FRESH zone (still in-rotation)
// warnDays     = upper bound of OK zone (above → STALE)
export const SPORT_RECOVERY_WINDOWS = {
  run:      { idealMaxDays: 3, warnDays: 14 },
  bike:     { idealMaxDays: 2, warnDays: 21 },
  swim:     { idealMaxDays: 4, warnDays: 14 },
  strength: { idealMaxDays: 4, warnDays: 14 },
}

export const TRACKED_SPORTS = ['run', 'bike', 'swim', 'strength']

// ─── Classifier — derive a tracked-sport key from a log entry ───────────────
/**
 * Map a session entry to one of `'run' | 'bike' | 'swim' | 'strength' | 'other'`.
 * Inspects `entry.sport` first, then falls back to `entry.type`. Both are
 * matched case-insensitively against discipline keywords.
 *
 * @param {{ type?: string, sport?: string }} entry
 * @returns {'run'|'bike'|'swim'|'strength'|'other'}
 */
export function classifySport(entry) {
  if (!entry || typeof entry !== 'object') return 'other'
  const haystack = `${entry.sport || ''} ${entry.type || ''}`
  if (/bike|cycl|ride|spin/i.test(haystack)) return 'bike'
  if (/swim/i.test(haystack)) return 'swim'
  if (/strength|lift|gym/i.test(haystack)) return 'strength'
  if (/run|jog/i.test(haystack)) return 'run'
  return 'other'
}

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function toDateStr(value) {
  if (typeof value !== 'string') return null
  if (value.length < 10) return null
  return value.slice(0, 10)
}

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00Z').getTime()
  const b = new Date(toStr + 'T00:00:00Z').getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / 86_400_000)
}

function classifyStatus(daysSince, idealMaxDays, warnDays) {
  if (daysSince == null) return 'NEVER'
  if (daysSince <= idealMaxDays) return 'FRESH'
  if (daysSince <= warnDays) return 'OK'
  return 'STALE'
}

// ─── analyzeCrossSportRecoveryGap ───────────────────────────────────────────
/**
 * Compute days-since-last-session for each tracked discipline and classify
 * the gap. Sports never logged are returned as NEVER and filtered out of the
 * default display list unless every sport is NEVER (in which case the whole
 * result is null — there's nothing meaningful to show).
 *
 * @param {{
 *   log: Array<{ date: string, type?: string, sport?: string }>,
 *   today?: string,
 * }} args
 * @returns {{
 *   sports: Array<{
 *     key: 'run'|'bike'|'swim'|'strength',
 *     daysSince: number|null,
 *     status: 'FRESH'|'OK'|'STALE'|'NEVER',
 *     lastDate: string|null,
 *     idealMaxDays: number,
 *     warnDays: number,
 *   }>,
 *   citation: string,
 * } | null}
 */
export function analyzeCrossSportRecoveryGap({
  log,
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  const todayStr = toDateStr(today) || new Date().toISOString().slice(0, 10)

  // Find the most recent date per tracked sport.
  const lastDateBySport = Object.create(null)
  let anyLogged = false
  for (const entry of log) {
    const dateStr = toDateStr(entry?.date)
    if (!dateStr) continue
    if (dateStr > todayStr) continue
    const key = classifySport(entry)
    if (!TRACKED_SPORTS.includes(key)) continue
    anyLogged = true
    const prev = lastDateBySport[key]
    if (!prev || dateStr > prev) lastDateBySport[key] = dateStr
  }

  if (!anyLogged) return null

  const sports = TRACKED_SPORTS.map((key) => {
    const windowSpec = SPORT_RECOVERY_WINDOWS[key]
    const lastDate = lastDateBySport[key] || null
    let daysSince = null
    if (lastDate) {
      const diff = daysBetween(lastDate, todayStr)
      daysSince = diff == null ? null : Math.max(0, diff)
    }
    const status = classifyStatus(daysSince, windowSpec.idealMaxDays, windowSpec.warnDays)
    return {
      key,
      daysSince,
      status,
      lastDate,
      idealMaxDays: windowSpec.idealMaxDays,
      warnDays: windowSpec.warnDays,
    }
  }).filter((row) => row.status !== 'NEVER')

  if (sports.length === 0) return null

  return {
    sports,
    citation: CROSS_SPORT_RECOVERY_GAP_CITATION,
  }
}

export default analyzeCrossSportRecoveryGap
