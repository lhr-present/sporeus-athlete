// src/lib/__tests__/athlete/coachConfirmFlow.test.js — E91
import { describe, it, expect } from 'vitest'
import {
  STATUS, createDraft, submitForReview, coachConfirm, activatePlan, resetConfirmation,
  isPlanActive, isPlanConfirmed, isGated, statusLabel, statusColor,
} from '../../athlete/coachConfirmFlow.js'

describe('createDraft', () => {
  const r = createDraft('10k-24w', '2026-05-01')
  it('sets programId', () => expect(r.programId).toBe('10k-24w'))
  it('sets planStart', () => expect(r.planStart).toBe('2026-05-01'))
  it('status is DRAFT', () => expect(r.status).toBe(STATUS.DRAFT))
  it('createdAt is set', () => expect(r.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/))
  it('confirmedAt is null', () => expect(r.confirmedAt).toBeNull())
  it('modifiedWeeks is empty object', () => expect(r.modifiedWeeks).toEqual({}))
})

describe('submitForReview — solo mode', () => {
  const draft = createDraft('10k-24w', '2026-05-01')
  const r = submitForReview(draft, true)
  it('status becomes CONFIRMED', () => expect(r.status).toBe(STATUS.CONFIRMED))
  it('confirmedAt is set', () => expect(r.confirmedAt).toBeTruthy())
  it('coachName indicates solo', () => expect(r.coachName).toContain('Solo'))
})

describe('submitForReview — coach mode', () => {
  const draft = createDraft('10k-24w', '2026-05-01')
  const r = submitForReview(draft, false)
  it('status becomes PENDING', () => expect(r.status).toBe(STATUS.PENDING))
  it('submittedAt is set', () => expect(r.submittedAt).toBeTruthy())
  it('confirmedAt is still null', () => expect(r.confirmedAt).toBeNull())
})

describe('submitForReview — null safety', () => {
  it('returns null for null record', () => expect(submitForReview(null)).toBeNull())
})

describe('coachConfirm — without modifications', () => {
  const draft = createDraft('10k-24w', '2026-05-01')
  const pending = submitForReview(draft, false)
  const r = coachConfirm(pending, { coachName: 'Ahmet Koç', coachNotes: 'Looks good' })
  it('status becomes CONFIRMED', () => expect(r.status).toBe(STATUS.CONFIRMED))
  it('coachName is set', () => expect(r.coachName).toBe('Ahmet Koç'))
  it('coachNotes is set', () => expect(r.coachNotes).toBe('Looks good'))
  it('confirmedAt is set', () => expect(r.confirmedAt).toBeTruthy())
})

describe('coachConfirm — with modifications', () => {
  const r = coachConfirm(createDraft('10k-24w', '2026-05-01'), {
    modifiedWeeks: { '3': { notes: 'Week 3 adjusted for injury' } }
  })
  it('status becomes MODIFIED', () => expect(r.status).toBe(STATUS.MODIFIED))
  it('modifiedWeeks saved', () => expect(r.modifiedWeeks['3'].notes).toBe('Week 3 adjusted for injury'))
})

describe('activatePlan', () => {
  const confirmed = coachConfirm(submitForReview(createDraft('10k-24w', '2026-05-01'), false))
  const active = activatePlan(confirmed)
  it('status becomes ACTIVE', () => expect(active.status).toBe(STATUS.ACTIVE))
  it('startedAt is set', () => expect(active.startedAt).toBeTruthy())
})

describe('activatePlan — blocked when not confirmed', () => {
  const draft = createDraft('10k-24w', '2026-05-01')
  it('returns same record (not active) if still DRAFT', () => {
    const r = activatePlan(draft)
    expect(r.status).toBe(STATUS.DRAFT)
  })
  it('returns same record if PENDING', () => {
    const pending = submitForReview(draft, false)
    expect(activatePlan(pending).status).toBe(STATUS.PENDING)
  })
})

describe('resetConfirmation', () => {
  it('returns null', () => expect(resetConfirmation()).toBeNull())
})

describe('isPlanActive', () => {
  it('false for null', () => expect(isPlanActive(null)).toBe(false))
  it('false for DRAFT', () => expect(isPlanActive(createDraft('10k-24w', '2026-05-01'))).toBe(false))
  it('true for ACTIVE', () => {
    const r = activatePlan(coachConfirm(submitForReview(createDraft('10k-24w', '2026-05-01'), false)))
    expect(isPlanActive(r)).toBe(true)
  })
})

describe('isPlanConfirmed', () => {
  it('false for DRAFT', () => expect(isPlanConfirmed(createDraft('10k-24w', '2026-05-01'))).toBe(false))
  it('false for PENDING', () => expect(isPlanConfirmed(submitForReview(createDraft('10k-24w', '2026-05-01'), false))).toBe(false))
  it('true for CONFIRMED', () => expect(isPlanConfirmed(coachConfirm(submitForReview(createDraft('10k-24w', '2026-05-01'), false)))).toBe(true))
  it('true for ACTIVE', () => {
    const r = activatePlan(coachConfirm(submitForReview(createDraft('10k-24w', '2026-05-01'), false)))
    expect(isPlanConfirmed(r)).toBe(true)
  })
})

describe('isGated', () => {
  it('true for null', () => expect(isGated(null)).toBe(true))
  it('true for DRAFT', () => expect(isGated(createDraft('10k-24w', '2026-05-01'))).toBe(true))
  it('true for PENDING', () => expect(isGated(submitForReview(createDraft('10k-24w', '2026-05-01'), false))).toBe(true))
  it('false for CONFIRMED', () => {
    const r = coachConfirm(submitForReview(createDraft('10k-24w', '2026-05-01'), false))
    expect(isGated(r)).toBe(false)
  })
  it('false for ACTIVE', () => {
    const r = activatePlan(coachConfirm(submitForReview(createDraft('10k-24w', '2026-05-01'), false)))
    expect(isGated(r)).toBe(false)
  })
})

describe('statusLabel', () => {
  it('returns string for each status', () => {
    for (const s of Object.values(STATUS)) {
      expect(typeof statusLabel({ status: s })).toBe('string')
      expect(typeof statusLabel({ status: s }, true)).toBe('string')
    }
  })
  it('returns string for null record', () => expect(typeof statusLabel(null)).toBe('string'))
})

describe('statusColor', () => {
  it('returns hex color for confirmed', () => {
    expect(statusColor({ status: STATUS.CONFIRMED })).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('returns color for null', () => expect(typeof statusColor(null)).toBe('string'))
})
