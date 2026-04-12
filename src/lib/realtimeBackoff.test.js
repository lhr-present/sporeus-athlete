import { describe, it, expect } from 'vitest'
import { computeBackoff } from './realtimeBackoff.js'

describe('computeBackoff', () => {
  it('attempt 0 → 1000ms', () => {
    expect(computeBackoff(0)).toBe(1000)
  })

  it('attempt 3 → 8000ms', () => {
    expect(computeBackoff(3)).toBe(8000)
  })

  it('caps at maxMs (attempt 10 → 30000ms)', () => {
    expect(computeBackoff(10)).toBe(30000)
  })
})
