import { describe, it, expect } from 'vitest'
import {
  shouldMoveToDlq,
  getRetryDelay,
  validateAiBatchMessage,
  buildRetryMessage,
  MAX_RETRIES,
  RETRY_DELAYS,
} from '../queueWorker.js'

describe('shouldMoveToDlq', () => {
  it('returns false when retry_count < MAX_RETRIES', () => {
    expect(shouldMoveToDlq(0)).toBe(false)
    expect(shouldMoveToDlq(1)).toBe(false)
    expect(shouldMoveToDlq(2)).toBe(false)
  })

  it('returns true when retry_count equals MAX_RETRIES', () => {
    expect(shouldMoveToDlq(MAX_RETRIES)).toBe(true)
  })

  it('returns true when retry_count exceeds MAX_RETRIES', () => {
    expect(shouldMoveToDlq(MAX_RETRIES + 1)).toBe(true)
    expect(shouldMoveToDlq(99)).toBe(true)
  })

  it('respects custom maxRetries parameter', () => {
    expect(shouldMoveToDlq(2, 5)).toBe(false)
    expect(shouldMoveToDlq(5, 5)).toBe(true)
    expect(shouldMoveToDlq(0, 1)).toBe(false)
    expect(shouldMoveToDlq(1, 1)).toBe(true)
  })
})

describe('getRetryDelay', () => {
  it('returns RETRY_DELAYS[0] for retry_count 0', () => {
    expect(getRetryDelay(0)).toBe(RETRY_DELAYS[0])
  })

  it('returns RETRY_DELAYS[1] for retry_count 1', () => {
    expect(getRetryDelay(1)).toBe(RETRY_DELAYS[1])
  })

  it('returns RETRY_DELAYS[2] for retry_count 2', () => {
    expect(getRetryDelay(2)).toBe(RETRY_DELAYS[2])
  })

  it('clamps to last delay for out-of-range retry_count', () => {
    const last = RETRY_DELAYS[RETRY_DELAYS.length - 1]
    expect(getRetryDelay(99)).toBe(last)
    expect(getRetryDelay(1000)).toBe(last)
  })

  it('clamps negative retry_count to first delay', () => {
    expect(getRetryDelay(-1)).toBe(RETRY_DELAYS[0])
    expect(getRetryDelay(-99)).toBe(RETRY_DELAYS[0])
  })

  it('RETRY_DELAYS has expected values [30, 120, 480]', () => {
    expect(RETRY_DELAYS).toEqual([30, 120, 480])
  })
})

describe('validateAiBatchMessage', () => {
  const valid = { coach_id: 'abc-123', week_start: '2026-04-14', retry_count: 0 }

  it('accepts a fully valid message', () => {
    expect(validateAiBatchMessage(valid)).toEqual({ valid: true, error: null })
  })

  it('accepts retry_count > 0', () => {
    expect(validateAiBatchMessage({ ...valid, retry_count: 2 })).toEqual({ valid: true, error: null })
  })

  it('rejects null payload', () => {
    const r = validateAiBatchMessage(null)
    expect(r.valid).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it('rejects string payload', () => {
    expect(validateAiBatchMessage('string')).toMatchObject({ valid: false })
  })

  it('rejects missing coach_id', () => {
    const { coach_id, ...rest } = valid
    const r = validateAiBatchMessage(rest)
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/coach_id/)
  })

  it('rejects empty string coach_id', () => {
    const r = validateAiBatchMessage({ ...valid, coach_id: '' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/coach_id/)
  })

  it('rejects missing week_start', () => {
    const { week_start, ...rest } = valid
    const r = validateAiBatchMessage(rest)
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/week_start/)
  })

  it('rejects invalid week_start format (DD-MM-YYYY)', () => {
    const r = validateAiBatchMessage({ ...valid, week_start: '14-04-2026' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/YYYY-MM-DD/)
  })

  it('rejects invalid week_start format (no dashes)', () => {
    const r = validateAiBatchMessage({ ...valid, week_start: '20260414' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/YYYY-MM-DD/)
  })

  it('rejects string retry_count', () => {
    const r = validateAiBatchMessage({ ...valid, retry_count: '0' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/retry_count/)
  })

  it('rejects undefined retry_count', () => {
    const { retry_count, ...rest } = valid
    const r = validateAiBatchMessage(rest)
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/retry_count/)
  })
})

describe('buildRetryMessage', () => {
  it('increments retry_count from 0 to 1', () => {
    const result = buildRetryMessage({ coach_id: 'x', week_start: '2026-04-14', retry_count: 0 })
    expect(result.retry_count).toBe(1)
  })

  it('increments retry_count from 2 to 3', () => {
    const result = buildRetryMessage({ coach_id: 'x', week_start: '2026-04-14', retry_count: 2 })
    expect(result.retry_count).toBe(3)
  })

  it('defaults missing retry_count to 0 then increments to 1', () => {
    const result = buildRetryMessage({ coach_id: 'x', week_start: '2026-04-14' })
    expect(result.retry_count).toBe(1)
  })

  it('preserves all original fields', () => {
    const original = { coach_id: 'abc', week_start: '2026-04-14', retry_count: 1, coach_name: 'Test Coach', kind: 'weekly_digest' }
    const result   = buildRetryMessage(original)
    expect(result.coach_id).toBe('abc')
    expect(result.week_start).toBe('2026-04-14')
    expect(result.coach_name).toBe('Test Coach')
    expect(result.kind).toBe('weekly_digest')
  })

  it('adds retried_at ISO timestamp', () => {
    const result = buildRetryMessage({ coach_id: 'x', week_start: '2026-04-14', retry_count: 0 })
    expect(typeof result.retried_at).toBe('string')
    expect(() => new Date(result.retried_at)).not.toThrow()
    expect(new Date(result.retried_at).getFullYear()).toBeGreaterThanOrEqual(2026)
  })

  it('does not mutate the original payload', () => {
    const original = { coach_id: 'x', week_start: '2026-04-14', retry_count: 0 }
    buildRetryMessage(original)
    expect(original.retry_count).toBe(0)
    expect(original).not.toHaveProperty('retried_at')
  })
})
