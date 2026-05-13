// src/lib/plan/versionTracking.js
//
// v9.104.0 (Prompt FF) — Plan version provenance.
//
// Pre-v9.104 every plan mutation (regenerate, deload, recalibrate) wrote
// localStorage.sporeus-plan in place with no provenance. A coach pulling
// up an athlete's plan compliance couldn't tell whether the prescription
// they were looking at was the original 12-week build, the day-3 regen,
// or the week-4 deload. This module attaches a versionTag and pushes a
// rolling history so the audit trail exists.

// The string used in versionTag — pinned to the current ship rather than
// imported from package.json so test snapshots stay stable.
const VERSION = '9.104.0'
const HISTORY_KEY = 'sporeus-plan-history'
const HISTORY_LIMIT = 5

/**
 * @description Build a versionTag string from a mutation kind.
 *   Kinds: 'starter' | 'regen' | 'deload' | 'recalibrate' | 'manual'
 * @returns {string} e.g. '9.104.0-starter', '9.103.0-deload-w3'
 */
export function makeVersionTag(kind, suffix = null) {
  const base = `${VERSION}-${String(kind || 'manual')}`
  return suffix ? `${base}-${suffix}` : base
}

/**
 * @description Push a plan history entry. Keeps last HISTORY_LIMIT.
 *   Each entry: { versionTag, ts, weeks: number, goal }
 *
 *   Pure with respect to the plan arg — only writes localStorage.
 */
export function recordPlanVersion(plan, kind, suffix = null) {
  if (!plan) return
  const versionTag = makeVersionTag(kind, suffix)
  // Mutate the plan's own versionTag so anyone reading it later can see
  // which mutation produced it without needing the history array.
  plan.versionTag = versionTag
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history = raw ? JSON.parse(raw) : []
    const entry = {
      versionTag,
      ts:    new Date().toISOString(),
      weeks: Array.isArray(plan.weeks) ? plan.weeks.length : 0,
      goal:  plan.goal || null,
    }
    history.push(entry)
    // Drop oldest so the array never grows unbounded
    while (history.length > HISTORY_LIMIT) history.shift()
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch { /* fail open — provenance is best-effort */ }
}

/**
 * @description Read the plan history array. Returns [] on missing/malformed.
 */
export function readPlanHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
