// ─── _logSport.js — Shared log-entry sport classifier ────────────────────────
// Single source of truth for inferring the sport of a log entry. Used by
// planLifecycle, planAdherence, recentBest, and any future sport-aware
// reconciliation. Underscore prefix marks this as an internal cross-lib helper.

/**
 * Classify the sport of a single training-log entry.
 *
 * @param {Object} e  log entry (may have .sport and/or .type free-text fields)
 * @returns {'run'|'bike'|'swim'|'triathlon'|null}
 *   null when the entry has no recognizable sport tag
 *
 * @internal
 */
export function logEntrySport(e) {
  if (!e || typeof e !== 'object') return null
  const t = (e.sport || e.type || '').toString().toLowerCase()
  if (/swim/.test(t)) return 'swim'
  if (/bike|cycl|ride/.test(t)) return 'bike'
  if (/tri/.test(t)) return 'triathlon'
  if (/run|jog/.test(t)) return 'run'
  return null
}

/**
 * Decide whether a log entry should count toward a program of `programSport`.
 * Triathlon programs accept all three single-sport entries.
 * Single-sport programs accept only matching entries OR null (unclassified —
 * treat as same-sport to avoid dropping legitimate entries with sparse tags).
 *
 * @param {Object} entry        log entry
 * @param {string} programSport 'run'|'bike'|'swim'|'triathlon'
 * @returns {boolean}
 *
 * @internal
 */
export function entryMatchesProgramSport(entry, programSport) {
  if (!programSport) return true
  const sp = logEntrySport(entry)
  if (sp == null) return true
  if (programSport === 'triathlon') {
    return sp === 'run' || sp === 'bike' || sp === 'swim' || sp === 'triathlon'
  }
  return sp === programSport
}
