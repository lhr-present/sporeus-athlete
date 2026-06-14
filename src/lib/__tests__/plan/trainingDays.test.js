import { describe, it, expect } from 'vitest'
import {
  normalizeTrainingDow,
  defaultDowForCount,
  sessionOrdinalForDay,
  DOW_LABELS,
} from '../../plan/trainingDays.js'

describe('normalizeTrainingDow', () => {
  it('sorts and de-duplicates valid weekday indices', () => {
    expect(normalizeTrainingDow([4, 0, 2, 0])).toEqual([0, 2, 4])
  })
  it('coerces numeric strings', () => {
    expect(normalizeTrainingDow(['1', '3', '5'])).toEqual([1, 3, 5])
  })
  it('drops out-of-range and non-numeric entries', () => {
    expect(normalizeTrainingDow([-1, 7, 2, 'x', null, 3.9])).toEqual([2, 3])
  })
  it('returns null for empty / non-array / all-invalid input', () => {
    expect(normalizeTrainingDow([])).toBeNull()
    expect(normalizeTrainingDow(null)).toBeNull()
    expect(normalizeTrainingDow('mon')).toBeNull()
    expect(normalizeTrainingDow([8, 9])).toBeNull()
  })
})

describe('defaultDowForCount', () => {
  it('produces a Mon-first consecutive set (legacy packing)', () => {
    expect(defaultDowForCount(5)).toEqual([0, 1, 2, 3, 4])
    expect(defaultDowForCount(3)).toEqual([0, 1, 2])
  })
  it('clamps to 7 and rejects non-positive', () => {
    expect(defaultDowForCount(9)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(defaultDowForCount(0)).toBeNull()
    expect(defaultDowForCount('x')).toBeNull()
  })
})

describe('sessionOrdinalForDay', () => {
  it('maps a weekday to its position in the training-day set', () => {
    const dow = [0, 2, 4, 6] // Mon, Wed, Fri, Sun
    expect(sessionOrdinalForDay(0, dow)).toBe(0)
    expect(sessionOrdinalForDay(4, dow)).toBe(2)
    expect(sessionOrdinalForDay(6, dow)).toBe(3)
  })
  it('returns -1 for a rest day (not in the set)', () => {
    expect(sessionOrdinalForDay(1, [0, 2, 4, 6])).toBe(-1) // Tue → rest
    expect(sessionOrdinalForDay(3, null)).toBe(-1)
  })
})

describe('DOW_LABELS', () => {
  it('has 7 Mon-first labels per language', () => {
    expect(DOW_LABELS.en).toHaveLength(7)
    expect(DOW_LABELS.tr).toHaveLength(7)
    expect(DOW_LABELS.en[0]).toBe('Mon')
    expect(DOW_LABELS.en[6]).toBe('Sun')
  })
})
