// ─── recoveryRecommender.js — E26 recovery protocol recommendation helpers ───
import { getRecommendedProtocols, RECOVERY_PROTOCOLS } from '../recoveryProtocols.js'

/**
 * Compute wellness score (1–5) from a single recovery entry.
 * score = (sleep + energy + (6 - soreness)) / 3
 * Clamp to [1, 5], round to 1 decimal.
 * Returns null if entry is null/undefined or all fields are missing.
 */
export function wellnessFromEntry(entry) {
  if (entry == null) return null

  const sleep    = entry.sleep    != null ? Number(entry.sleep)    : null
  const energy   = entry.energy   != null ? Number(entry.energy)   : null
  const soreness = entry.soreness != null ? Number(entry.soreness) : null

  if (sleep == null && energy == null && soreness == null) return null

  const s = sleep    ?? 3
  const e = energy   ?? 3
  const r = soreness ?? 3

  const raw = (s + e + (6 - r)) / 3
  const clamped = Math.min(5, Math.max(1, raw))
  return Math.round(clamped * 10) / 10
}

/**
 * Hours elapsed since a 'YYYY-MM-DD' date string (measured from midnight of that date).
 * today: 'YYYY-MM-DD' — the reference date
 * Returns (todayMs - sessionMs) / 3600000 floored to 1 decimal.
 * Returns null if dateStr is falsy.
 */
export function hoursSince(dateStr, today = new Date().toISOString().slice(0, 10)) {
  if (!dateStr) return null
  const sessionMs = new Date(dateStr + 'T00:00:00Z').getTime()
  const todayMs   = new Date(today   + 'T00:00:00Z').getTime()
  const hours = (todayMs - sessionMs) / 3_600_000
  return Math.floor(hours * 10) / 10
}

/**
 * Get top N protocol recommendations given current state.
 * Derives inputs from the latest recovery entry and latest log entry.
 * @param {object|null} latestRecovery - most recent recovery entry (or null)
 * @param {object|null} latestSession  - most recent log entry (or null)
 * @param {number}      limit          - max protocols to return (default 3)
 * @param {string}      today          - reference date 'YYYY-MM-DD'
 * @returns {{ protocols: object[], wellnessScore: number|null, sessionTSS: number|null, hoursSinceSession: number|null }}
 */
export function getTopRecoveryProtocols(
  latestRecovery,
  latestSession,
  limit = 3,
  today = new Date().toISOString().slice(0, 10),
) {
  const wellnessScore      = wellnessFromEntry(latestRecovery)
  const sessionTSS         = latestSession?.tss       != null ? Number(latestSession.tss)  : null
  const hoursSinceSession  = latestSession?.date       != null ? hoursSince(latestSession.date, today) : null

  const protocols = getRecommendedProtocols(wellnessScore, sessionTSS, hoursSinceSession)
    .slice(0, limit)

  return { protocols, wellnessScore, sessionTSS, hoursSinceSession }
}
