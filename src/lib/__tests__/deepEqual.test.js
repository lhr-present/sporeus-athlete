import { describe, it, expect } from 'vitest'
import { deepEqual } from '../deepEqual.js'

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(true, true)).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(undefined, undefined)).toBe(true)
  })

  it('returns false for differing primitives', () => {
    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual('a', 'b')).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual(0, '0')).toBe(false)
  })

  it('treats NaN as equal to NaN (so it is not seen as "changed")', () => {
    expect(deepEqual(NaN, NaN)).toBe(true)
  })

  it('is insensitive to object key order — the core reason this exists', () => {
    const a = { id: 1, type: 'Easy run', tss: 80, rpe: 4 }
    const b = { rpe: 4, tss: 80, type: 'Easy run', id: 1 }
    expect(deepEqual(a, b)).toBe(true)
    // JSON.stringify would have reported these as different:
    expect(JSON.stringify(a) === JSON.stringify(b)).toBe(false)
  })

  it('detects a genuine value change', () => {
    expect(deepEqual({ id: 1, tss: 80 }, { id: 1, tss: 81 })).toBe(false)
  })

  it('detects added / removed keys', () => {
    expect(deepEqual({ id: 1 }, { id: 1, tss: 80 })).toBe(false)
    expect(deepEqual({ id: 1, tss: 80 }, { id: 1 })).toBe(false)
  })

  it('compares nested objects and arrays', () => {
    expect(deepEqual(
      { id: 1, zones: [10, 20, 30], meta: { hr: 150 } },
      { meta: { hr: 150 }, zones: [10, 20, 30], id: 1 },
    )).toBe(true)
    expect(deepEqual(
      { id: 1, zones: [10, 20, 30] },
      { id: 1, zones: [10, 20, 31] },
    )).toBe(false)
  })

  it('keeps arrays order-sensitive', () => {
    expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false)
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
  })

  it('distinguishes arrays from objects', () => {
    expect(deepEqual([], {})).toBe(false)
  })

  it('compares Dates by time value', () => {
    expect(deepEqual(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(true)
    expect(deepEqual(new Date('2026-01-01'), new Date('2026-01-02'))).toBe(false)
  })
})
