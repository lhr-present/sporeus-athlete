// ─── coachEditEngine.js — Coach-edit creation, validation, merge ──────────────
//
// Wave B (v9.3.0). Manages the lifecycle of a CoachEdit:
//   build → validate → apply (merge into program) → revert (per-edit rollback).
//
// Edit types (v=2 envelope):
//   'phase-tss-bias'     — multiplier 0.5-1.5 applied to a phase's weeklyTSS slice
//   'phase-note'         — bilingual coach annotation attached to a phase
//   'key-session-swap'   — replace one library entry with a custom session
//   'general-note'       — free-form coach annotation on the whole plan
//
// Pure functions, no React, no I/O. Deterministic.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   id: string,
 *   type: 'phase-tss-bias'|'phase-note'|'key-session-swap'|'general-note',
 *   target: string,             // phase name, key-session key, or '*'
 *   prev: any,                  // pre-edit value (for revert)
 *   next: any,                  // post-edit value
 *   note: Bilingual,
 *   timestamp: string,          // ISO 8601 when the edit was authored
 *   accepted?: boolean,         // athlete-side flag: applied vs rejected
 * }} CoachEdit
 */

const VALID_EDIT_TYPES = new Set([
  'phase-tss-bias', 'phase-note', 'key-session-swap', 'general-note',
])
const VALID_PHASES = new Set(['Base', 'Build', 'Peak', 'Taper'])

/**
 * @public Build a new CoachEdit. Returns null if input is invalid.
 */
export function buildCoachEdit({ type, target, prev, next, noteEn, noteTr }) {
  if (!VALID_EDIT_TYPES.has(type)) return null
  if (typeof target !== 'string' || target.length === 0) return null
  if (type === 'phase-tss-bias') {
    const n = Number(next)
    if (!isFinite(n) || n < 0.5 || n > 1.5) return null
    if (!VALID_PHASES.has(target)) return null
  }
  if (type === 'phase-note' && !VALID_PHASES.has(target)) return null
  return {
    id: `edit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    target,
    prev: prev ?? null,
    next: next ?? null,
    note: { en: typeof noteEn === 'string' ? noteEn : '', tr: typeof noteTr === 'string' ? noteTr : '' },
    timestamp: new Date().toISOString(),
    accepted: undefined,
  }
}

/**
 * @public Validate a CoachEdit shape. Used both at coach export and athlete merge time.
 */
export function validateCoachEdit(e) {
  if (!e || typeof e !== 'object') return { ok: false, reason: 'not-object' }
  if (!VALID_EDIT_TYPES.has(e.type)) return { ok: false, reason: 'unknown-type' }
  if (typeof e.target !== 'string') return { ok: false, reason: 'no-target' }
  if (e.type === 'phase-tss-bias') {
    const n = Number(e.next)
    if (!isFinite(n) || n < 0.5 || n > 1.5) return { ok: false, reason: 'bias-out-of-range' }
    if (!VALID_PHASES.has(e.target)) return { ok: false, reason: 'invalid-phase' }
  }
  if (e.type === 'phase-note' && !VALID_PHASES.has(e.target)) return { ok: false, reason: 'invalid-phase' }
  return { ok: true, reason: null }
}

/**
 * @public Apply a list of accepted CoachEdits to a program result.
 *   Returns a new program object — does not mutate input.
 *
 * Edits with `accepted === false` are skipped.
 * Edits not yet decided (accepted === undefined) are skipped (athlete must explicitly accept).
 */
export function applyCoachEdits(program, edits) {
  if (!program || typeof program !== 'object') return program
  if (!Array.isArray(edits) || edits.length === 0) return program

  // Defensive deep clone of the parts we may modify.
  const out = { ...program }
  if (program.weeklyTSS) out.weeklyTSS = [...program.weeklyTSS]
  if (program.phases)    out.phases    = program.phases.map(p => ({ ...p }))
  if (program.keySessionLibrary) {
    out.keySessionLibrary = {
      Base:  Array.isArray(program.keySessionLibrary.Base)  ? [...program.keySessionLibrary.Base]  : [],
      Build: Array.isArray(program.keySessionLibrary.Build) ? [...program.keySessionLibrary.Build] : [],
      Peak:  Array.isArray(program.keySessionLibrary.Peak)  ? [...program.keySessionLibrary.Peak]  : [],
      Taper: Array.isArray(program.keySessionLibrary.Taper) ? [...program.keySessionLibrary.Taper] : [],
    }
  }
  out.coachAppliedEdits = []
  out.coachNotes = { phase: {}, general: [] }

  for (const e of edits) {
    if (e.accepted !== true) continue
    const v = validateCoachEdit(e)
    if (!v.ok) continue

    if (e.type === 'phase-tss-bias') {
      // Multiply weeklyTSS at each week index belonging to this phase.
      // phase.weeks is an Array<number> of 1-indexed week numbers.
      const phase = out.phases?.find(p => p.phase === e.target)
      if (!phase || !Array.isArray(phase.weeks) || !Array.isArray(out.weeklyTSS)) continue
      const bias = Number(e.next)
      for (const w of phase.weeks) {
        const idx = w - 1
        if (idx >= 0 && idx < out.weeklyTSS.length) {
          out.weeklyTSS[idx] = Math.round(out.weeklyTSS[idx] * bias)
        }
      }
      out.coachAppliedEdits.push(e)
    } else if (e.type === 'phase-note') {
      out.coachNotes.phase[e.target] = out.coachNotes.phase[e.target] || []
      out.coachNotes.phase[e.target].push(e.note || { en: '', tr: '' })
      out.coachAppliedEdits.push(e)
    } else if (e.type === 'key-session-swap') {
      // target = "Base/run-base-long-aerobic"; next = full session object
      const [phase, key] = e.target.split('/')
      if (!phase || !key) continue
      const lib = out.keySessionLibrary?.[phase]
      if (!Array.isArray(lib)) continue
      const idx = lib.findIndex(s => s.key === key)
      if (idx < 0) continue
      lib[idx] = { ...e.next, key, _swappedByCoach: true }
      out.coachAppliedEdits.push(e)
    } else if (e.type === 'general-note') {
      out.coachNotes.general.push(e.note || { en: '', tr: '' })
      out.coachAppliedEdits.push(e)
    }
  }

  return out
}

/**
 * @public Revert a single edit by id. Returns a new edits[] array
 * with that edit's `accepted=false`.
 */
export function revertCoachEdit(edits, editId) {
  if (!Array.isArray(edits)) return []
  return edits.map(e => e.id === editId ? { ...e, accepted: false } : e)
}

/**
 * @public Accept a single edit by id. Returns a new edits[] array
 * with that edit's `accepted=true`.
 */
export function acceptCoachEdit(edits, editId) {
  if (!Array.isArray(edits)) return []
  return edits.map(e => e.id === editId ? { ...e, accepted: true } : e)
}

/**
 * @public Accept all pending edits at once.
 */
export function acceptAllCoachEdits(edits) {
  if (!Array.isArray(edits)) return []
  return edits.map(e => e.accepted === undefined ? { ...e, accepted: true } : e)
}

/**
 * @public Count edits by status. Useful for the lifecycle pill.
 */
export function summarizeCoachEdits(edits) {
  if (!Array.isArray(edits)) return { total: 0, accepted: 0, pending: 0, rejected: 0 }
  let accepted = 0, pending = 0, rejected = 0
  for (const e of edits) {
    if (e.accepted === true) accepted++
    else if (e.accepted === false) rejected++
    else pending++
  }
  return { total: edits.length, accepted, pending, rejected }
}

export const COACH_EDIT_CITATION = 'Sporeus v9.3.0 coach-edit protocol; envelope v=2'
