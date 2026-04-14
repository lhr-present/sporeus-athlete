import { describe, it, expect } from 'vitest'
import { validateAnnouncement, isUnread } from './announcementHelpers.js'

describe('validateAnnouncement', () => {
  it('"Hello team" → { valid: true }', () => {
    expect(validateAnnouncement('Hello team')).toEqual({ valid: true })
  })

  it('empty string → { valid: false }', () => {
    const result = validateAnnouncement('')
    expect(result.valid).toBe(false)
  })

  it('281-char string → { valid: false }', () => {
    const result = validateAnnouncement('x'.repeat(281))
    expect(result.valid).toBe(false)
  })
})

describe('isUnread', () => {
  it('athleteId not in read_by → true', () => {
    expect(isUnread({ read_by: ['user-a', 'user-b'] }, 'user-c')).toBe(true)
  })

  it('athleteId already in read_by → false', () => {
    expect(isUnread({ read_by: ['user-a'] }, 'user-a')).toBe(false)
  })
})
