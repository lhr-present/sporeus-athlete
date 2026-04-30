// src/lib/__tests__/announcementHelpers.test.js
// Pure logic tests for announcement helpers — no mocking.
import { describe, it, expect } from 'vitest'
import { validateAnnouncement, isUnread } from '../announcementHelpers.js'

// ── validateAnnouncement ──────────────────────────────────────────────────────

describe('validateAnnouncement — invalid inputs', () => {
  it('rejects empty string', () => {
    const result = validateAnnouncement('')
    expect(result.valid).toBe(false)
    expect(typeof result.error).toBe('string')
  })

  it('rejects string longer than 280 characters', () => {
    const long = 'a'.repeat(281)
    const result = validateAnnouncement(long)
    expect(result.valid).toBe(false)
    expect(typeof result.error).toBe('string')
  })

  it('rejects non-string (number)', () => {
    const result = validateAnnouncement(42)
    expect(result.valid).toBe(false)
    expect(typeof result.error).toBe('string')
  })

  it('rejects null', () => {
    const result = validateAnnouncement(null)
    expect(result.valid).toBe(false)
    expect(typeof result.error).toBe('string')
  })

  it('rejects undefined', () => {
    const result = validateAnnouncement(undefined)
    expect(result.valid).toBe(false)
    expect(typeof result.error).toBe('string')
  })
})

describe('validateAnnouncement — valid inputs', () => {
  it('accepts a single character string', () => {
    const result = validateAnnouncement('A')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts exactly 280 characters', () => {
    const boundary = 'x'.repeat(280)
    const result = validateAnnouncement(boundary)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts a normal message', () => {
    const result = validateAnnouncement('Team run tomorrow at 07:00.')
    expect(result.valid).toBe(true)
  })
})

// ── isUnread ──────────────────────────────────────────────────────────────────

describe('isUnread — treated as unread', () => {
  it('returns true when read_by is null', () => {
    expect(isUnread({ read_by: null }, 'athlete-1')).toBe(true)
  })

  it('returns true when read_by is an empty array', () => {
    expect(isUnread({ read_by: [] }, 'athlete-1')).toBe(true)
  })

  it('returns true when read_by does not contain athleteId', () => {
    expect(isUnread({ read_by: ['athlete-2', 'athlete-3'] }, 'athlete-1')).toBe(true)
  })

  it('returns true when announcement has no read_by key', () => {
    expect(isUnread({}, 'athlete-1')).toBe(true)
  })

  it('returns true when announcement is an empty object', () => {
    expect(isUnread({}, 'any-id')).toBe(true)
  })
})

describe('isUnread — treated as read', () => {
  it('returns false when athleteId is in read_by', () => {
    expect(isUnread({ read_by: ['athlete-1', 'athlete-2'] }, 'athlete-1')).toBe(false)
  })

  it('returns false when read_by contains only this athleteId', () => {
    expect(isUnread({ read_by: ['solo'] }, 'solo')).toBe(false)
  })
})
