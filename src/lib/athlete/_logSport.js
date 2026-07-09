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
  // v9.491 (program-dataflow F6): rowing had no class — rows worked only via
  // the null-passthrough accident. Row before run so "Tempo row" classifies
  // as rowing (v9.487 F14 lesson).
  // v9.495 (general-check F13): harmonized with recentBest + mapStravaType
  // (Kayaking/Canoeing→'row' at import — classifiers must agree).
  if (/row|erg|kayak|canoe/.test(t)) return 'rowing'
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
  // v9.491 (F6): the elite ROWING program prescribes run/bike cross-train days
  // — excluding those entries from its own compliance was the worst-possible
  // polarity (the athlete follows the plan and gets penalized). A rowing
  // program accepts all endurance work.
  if (programSport === 'rowing') return true
  return sp === programSport
}
