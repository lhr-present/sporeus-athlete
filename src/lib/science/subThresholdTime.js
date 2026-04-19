// src/lib/science/subThresholdTime.js
// E12 — Sub-threshold time: weekly Z1+Z2 minutes (polarized model).
//
// The Seiler (2010) polarized model prescribes that ~80% of training should
// occur BELOW lactate threshold (Zone 1 + Zone 2 in a 3-zone model), with
// ~20% ABOVE threshold (Zone 3: high-intensity). This split — not the
// traditional pyramidal distribution — is associated with superior endurance
// adaptation in elite athletes.
//
// This module quantifies weekly sub-threshold time to support polarization
// analysis. It accepts either HR-zone or power-zone session data.
//
// Zone definitions (3-zone model, Seiler 2010):
//   Zone 1: < VT1 / LT1 (easy, conversational)
//   Zone 2: VT1–VT2 / LT1–LT2 (threshold drift)
//   Zone 3: > VT2 / LT2 (above threshold, true high-intensity)
//
// Sub-threshold = Zone 1 + Zone 2 (everything below VT2/LT2).
//
// References:
//   Seiler S. (2010). What is best practice for training intensity distribution?
//     Int J Sports Physiol Perform 5(3):276–291.
//   Seiler K.S. & Kjerland G.Ø. (2006). Quantifying training intensity distribution
//     in endurance athletes. Scand J Med Sci Sports 16(1):49–56.

// ── Citation ──────────────────────────────────────────────────────────────────

export const SUB_THRESHOLD_CITATION =
  'Seiler S. (2010) Int J Sports Physiol Perform 5(3):276–291; ' +
  'Seiler & Kjerland (2006) Scand J Med Sci Sports 16(1):49–56.'

// ── _weekBoundaries ───────────────────────────────────────────────────────────

function _parseDate(str) {
  // Returns a comparable ISO date string: 'YYYY-MM-DD'
  return typeof str === 'string' ? str.slice(0, 10) : null
}

function _addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── _subThresholdFraction ─────────────────────────────────────────────────────

/**
 * Estimate fraction of a session spent below threshold from a 1-Hz HR stream.
 * Returns seconds below threshold.
 */
function _subThresholdSecsFromHR(hrStream, thresholdHR) {
  if (!Array.isArray(hrStream) || hrStream.length === 0) return null
  return hrStream.filter(v => v < thresholdHR).length
}

/**
 * Estimate fraction from a 1-Hz power stream.
 */
function _subThresholdSecsFromPower(powerStream, thresholdPower) {
  if (!Array.isArray(powerStream) || powerStream.length === 0) return null
  return powerStream.filter(v => v < thresholdPower).length
}

// ── weekSubThresholdMin ───────────────────────────────────────────────────────

/**
 * Compute total sub-threshold (Z1+Z2) minutes in a given calendar week.
 *
 * Sessions without a stream (HR or power) use the session's durationSec if
 * the session's zone type or RPE suggests below-threshold work; otherwise
 * the session is skipped.
 *
 * @param {Object[]} sessions - Training log entries
 * @param {string}   sessions[].date         - ISO date 'YYYY-MM-DD'
 * @param {number}   [sessions[].durationSec] - Total duration
 * @param {number[]} [sessions[].hrStream]    - 1-Hz HR stream (preferred)
 * @param {number[]} [sessions[].powerStream] - 1-Hz power stream (preferred)
 * @param {number}   [sessions[].avgHR]       - Fallback: average HR
 * @param {string}   [sessions[].zoneType]    - 'z1'|'z2'|'z3'|'z4'|'z5' label (optional fast-path)
 *
 * @param {string}   weekStart - ISO date for Monday of the target week ('YYYY-MM-DD')
 *
 * @param {Object}   zones
 * @param {number}   [zones.thresholdHR]     - VT2/LT2 HR boundary (bpm). Used with HR stream.
 * @param {number}   [zones.thresholdPower]  - VT2/LT2 power boundary (W). Used with power stream.
 *
 * @returns {{ minutes: number, sessionsIncluded: number } | null}
 *   null when no sessions fall in the week or zones are not provided
 */
export function weekSubThresholdMin(sessions, weekStart, zones) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null
  if (!weekStart) return null
  if (!zones || (!zones.thresholdHR && !zones.thresholdPower)) return null

  const weekEnd = _addDays(weekStart, 7)

  const weekSessions = sessions.filter(s => {
    const d = _parseDate(s.date)
    return d !== null && d >= weekStart && d < weekEnd
  })

  if (weekSessions.length === 0) return null

  let totalSecs = 0
  let sessionsIncluded = 0

  for (const s of weekSessions) {
    let subSecs = null

    // Priority 1: power stream + power threshold
    if (zones.thresholdPower && Array.isArray(s.powerStream) && s.powerStream.length > 0) {
      subSecs = _subThresholdSecsFromPower(s.powerStream, zones.thresholdPower)
    }
    // Priority 2: HR stream + HR threshold
    else if (zones.thresholdHR && Array.isArray(s.hrStream) && s.hrStream.length > 0) {
      subSecs = _subThresholdSecsFromHR(s.hrStream, zones.thresholdHR)
    }
    // Priority 3: avg HR as proxy — if avgHR < threshold, count full session duration
    else if (zones.thresholdHR && s.avgHR != null && s.durationSec != null) {
      subSecs = s.avgHR < zones.thresholdHR ? s.durationSec : 0
    }
    // Priority 4: zoneType label
    else if (s.zoneType != null && (s.zoneType === 'z1' || s.zoneType === 'z2') && s.durationSec != null) {
      subSecs = s.durationSec
    }

    if (subSecs !== null && subSecs >= 0) {
      totalSecs += subSecs
      sessionsIncluded++
    }
  }

  if (sessionsIncluded === 0) return null

  return {
    minutes: Math.round(totalSecs / 60),
    sessionsIncluded,
  }
}

// ── subThresholdTrend ─────────────────────────────────────────────────────────

/**
 * Compute sub-threshold minutes for each of the last N calendar weeks,
 * starting from the Monday of the most recent complete week.
 *
 * @param {Object[]} sessions - Same shape as weekSubThresholdMin
 * @param {Object}   zones    - Same shape as weekSubThresholdMin
 * @param {number}   [weeks=8] - Number of full weeks to analyse
 *
 * @returns {Array<{
 *   weekStart: string,
 *   minutes: number | null,
 *   sessionsIncluded: number,
 * }>}  Array of length `weeks`, chronological order (oldest first)
 */
export function subThresholdTrend(sessions, zones, weeks = 8) {
  if (!Array.isArray(sessions) || sessions.length === 0) return []

  // Find most recent Monday at or before today
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon, …
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const lastMonday = new Date(now)
  lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday)
  const lastMondayStr = lastMonday.toISOString().slice(0, 10)

  const result = []
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = _addDays(lastMondayStr, -7 * w)
    const entry = weekSubThresholdMin(sessions, weekStart, zones)
    result.push({
      weekStart,
      minutes: entry?.minutes ?? null,
      sessionsIncluded: entry?.sessionsIncluded ?? 0,
    })
  }

  return result
}
