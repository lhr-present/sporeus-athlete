// src/lib/athlete/coachConfirmFlow.js — E91
// Coach confirmation state machine — HARDCODED MAIN RULE.
//
// Every training plan MUST pass through this flow before becoming active:
//   none → draft → pending_review → confirmed → active
//
// Solo athletes (no coach) self-confirm, which counts as confirmed.
// Plans cannot be followed (active) without confirmation — enforced by CoachGateCard.
//
// localStorage key: 'sporeus-plan-confirm-v1'

export const STATUS = {
  NONE:    'none',           // no program selected yet
  DRAFT:   'draft',          // program selected, not yet submitted for review
  PENDING: 'pending_review', // submitted to coach, awaiting response
  CONFIRMED:'confirmed',     // coach (or athlete self) confirmed the plan
  MODIFIED: 'modified',      // coach confirmed with modifications
  ACTIVE:  'active',         // athlete has started following the plan
}

export const LS_KEY = 'sporeus-plan-confirm-v1'

// ── Factory functions ─────────────────────────────────────────────────────────

/**
 * Create a fresh confirmation record for a selected program.
 * Status starts at DRAFT — athlete must explicitly submit for review.
 */
export function createDraft(programId, planStart) {
  return {
    programId,
    planStart,
    status:       STATUS.DRAFT,
    createdAt:    new Date().toISOString().slice(0, 10),
    submittedAt:  null,
    confirmedAt:  null,
    coachId:      null,
    coachName:    null,
    coachNotes:   '',
    modifiedWeeks: {},   // { [weekNum]: { notes, sessions } }
    startedAt:    null,
  }
}

/**
 * Athlete submits the plan for coach review (or self-review in solo mode).
 * Returns updated record.
 */
export function submitForReview(record, isSolo = false) {
  if (!record) return null
  if (isSolo) {
    // Solo: bypass review, go straight to confirmed
    return {
      ...record,
      status:      STATUS.CONFIRMED,
      submittedAt: new Date().toISOString().slice(0, 10),
      confirmedAt: new Date().toISOString().slice(0, 10),
      coachName:   'Solo (self-confirmed)',
      coachNotes:  'Athlete self-confirmed — no coach assigned.',
    }
  }
  return {
    ...record,
    status:      STATUS.PENDING,
    submittedAt: new Date().toISOString().slice(0, 10),
  }
}

/**
 * Coach confirms the plan (optionally with notes and week modifications).
 */
export function coachConfirm(record, { coachName = '', coachNotes = '', modifiedWeeks = {} } = {}) {
  if (!record) return null
  const hasModifications = Object.keys(modifiedWeeks).length > 0
  return {
    ...record,
    status:        hasModifications ? STATUS.MODIFIED : STATUS.CONFIRMED,
    confirmedAt:   new Date().toISOString().slice(0, 10),
    coachName,
    coachNotes,
    modifiedWeeks,
  }
}

/**
 * Athlete marks the plan as active (starts following it).
 * Only allowed when status is CONFIRMED or MODIFIED.
 */
export function activatePlan(record) {
  if (!record) return null
  if (record.status !== STATUS.CONFIRMED && record.status !== STATUS.MODIFIED) return record
  return {
    ...record,
    status:    STATUS.ACTIVE,
    startedAt: new Date().toISOString().slice(0, 10),
  }
}

/**
 * Reset the confirmation record (athlete wants to pick a different program).
 */
export function resetConfirmation() {
  return null  // caller should save null to localStorage
}

// ── Status helpers ────────────────────────────────────────────────────────────

/** True if the plan is in a runnable state (athlete can follow it) */
export function isPlanActive(record) {
  return record?.status === STATUS.ACTIVE
}

/** True if the plan has been confirmed (including active) */
export function isPlanConfirmed(record) {
  return [STATUS.CONFIRMED, STATUS.MODIFIED, STATUS.ACTIVE].includes(record?.status)
}

/** True if the coach gate should block access to the training plan */
export function isGated(record) {
  return !record || record.status === STATUS.NONE || record.status === STATUS.DRAFT || record.status === STATUS.PENDING
}

/** Human-readable status label */
export function statusLabel(record, isTR = false) {
  const s = record?.status
  if (isTR) {
    switch (s) {
      case STATUS.DRAFT:    return 'Taslak — İncelemeye gönderilmedi'
      case STATUS.PENDING:  return 'Koç incelemesi bekleniyor…'
      case STATUS.CONFIRMED:return 'Koç onayladı ✓'
      case STATUS.MODIFIED: return 'Koç düzenledi ve onayladı ✓'
      case STATUS.ACTIVE:   return 'Plan aktif — antrenman başladı'
      default:              return 'Program seçilmedi'
    }
  }
  switch (s) {
    case STATUS.DRAFT:    return 'Draft — not submitted for review'
    case STATUS.PENDING:  return 'Awaiting coach review…'
    case STATUS.CONFIRMED:return 'Coach confirmed ✓'
    case STATUS.MODIFIED: return 'Coach confirmed with modifications ✓'
    case STATUS.ACTIVE:   return 'Plan active — training in progress'
    default:              return 'No program selected'
  }
}

export function statusColor(record) {
  switch (record?.status) {
    case STATUS.CONFIRMED:
    case STATUS.MODIFIED:
    case STATUS.ACTIVE:   return '#5bc25b'
    case STATUS.PENDING:  return '#f5c542'
    case STATUS.DRAFT:    return '#4a90d9'
    default:              return '#444'
  }
}
