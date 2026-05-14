// src/lib/athlete/diagnosticPriority.js
//
// v9.110.0 (Prompt AAA) — Rank Mission 1 diagnostic detectors by severity
// so TodayView shows ONE primary diagnosis instead of stacking 4 peer cards.
//
// Pre-v9.110 each detector (goal-mismatch, stale-plan, plan-drift, comeback)
// rendered its own peer card with no ordering. A worst-case athlete saw 4
// red/amber cards above the actual training session card — cognitive
// overload, athletes stopped reading past card 4, the chain became invisible.
//
// This ranks them: the highest-severity diagnosis renders inline at full
// weight; the rest collapse under a "▼ N more diagnostics" disclosure.
//
// Pure function. No I/O.

// ── Severity tiers ──────────────────────────────────────────────────────────
// critical > warning > info (info is suppressed entirely so it never adds
// noise — the underlying detector still runs for telemetry).
const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 }

// ── Canonical order within a severity tier ──────────────────────────────────
// Used as a stable tie-breaker so the rendered top card is deterministic
// across renders. Order chosen by upstream-ness — goal-mismatch is the most
// upstream Mission 1 diagnostic ("is the goal even right?"), so when it
// ties on severity it wins. comeback last because it's contextual, not
// corrective.
const CANONICAL_ORDER = ['goal-mismatch', 'stale-plan', 'plan-drift', 'comeback']

/**
 * @description Derive the severity for a diagnostic result. Returns null
 *   when the input is empty / not-flagged.
 *
 * Stale-plan ('age', 'ctl', 'both'):
 *   - 'both' → critical (both anchors gone)
 *   - 'age' or 'ctl' alone → warning
 *
 * Plan-drift (computePlanDrift's `action`):
 *   - 'regenerate' → critical (drift too large to absorb)
 *   - 'reduce-next' / 'monitor-fatigue' → warning
 *   - 'continue' → info (suppressed)
 *
 * Goal-mismatch: only fires when `mismatched: true`, always critical.
 *
 * Comeback: only fires when `isComeback: true`, always warning (it's a
 * context hint, not a corrective action — athlete still chose to come back).
 */
export function getDiagnosticSeverity(key, payload) {
  if (!payload) return null
  switch (key) {
    case 'goal-mismatch':
      return payload.mismatched ? 'critical' : null
    case 'stale-plan': {
      if (!payload.stale) return null
      return payload.reason === 'both' ? 'critical' : 'warning'
    }
    case 'plan-drift': {
      if (!payload || payload.status === 'pending') return null
      if (payload.action === 'regenerate')               return 'critical'
      if (payload.action === 'reduce-next')              return 'warning'
      if (payload.action === 'monitor-fatigue')          return 'warning'
      // 'continue' (action) maps to info, suppressed
      return null
    }
    case 'comeback':
      return payload.isComeback ? 'warning' : null
    default:
      return null
  }
}

/**
 * @description Sort key for canonical-order tie-breaking. Lower wins
 *   (= renders first). Unknown keys go to the end.
 */
function canonicalIdx(key) {
  const i = CANONICAL_ORDER.indexOf(key)
  return i === -1 ? CANONICAL_ORDER.length : i
}

/**
 * @description Rank a list of diagnostic results by severity, returning
 *   the single top diagnosis and the rest in sorted order.
 *
 * @param {Array<{ key, payload }>} diagnostics
 * @returns {{
 *   top: { key, severity, payload } | null,
 *   rest: Array<{ key, severity, payload }>,
 * }}
 */
export function rankDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return { top: null, rest: [] }
  }

  // Annotate each diagnostic with its computed severity, dropping nulls.
  const annotated = []
  for (const d of diagnostics) {
    if (!d || !d.key) continue
    const severity = getDiagnosticSeverity(d.key, d.payload)
    if (!severity) continue
    annotated.push({ key: d.key, severity, payload: d.payload })
  }

  if (annotated.length === 0) return { top: null, rest: [] }

  // Sort: severity descending, then canonical order ascending.
  annotated.sort((a, b) => {
    const sa = SEVERITY_RANK[a.severity] || 0
    const sb = SEVERITY_RANK[b.severity] || 0
    if (sa !== sb) return sb - sa
    return canonicalIdx(a.key) - canonicalIdx(b.key)
  })

  return { top: annotated[0], rest: annotated.slice(1) }
}
