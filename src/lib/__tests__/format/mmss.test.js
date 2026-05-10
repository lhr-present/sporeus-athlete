import { describe, it, expect } from 'vitest'
import { autoFormatMmSs, parseMmSs } from '../../format/mmss.js'

describe('autoFormatMmSs', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(autoFormatMmSs(null)).toBe('')
    expect(autoFormatMmSs(undefined)).toBe('')
    expect(autoFormatMmSs('')).toBe('')
  })

  it('strips non-digits before formatting', () => {
    expect(autoFormatMmSs('5a0:b00')).toBe('50:00')
    expect(autoFormatMmSs('50.00')).toBe('50:00')
  })

  it('keeps 1-2 digits raw (still typing) by default', () => {
    expect(autoFormatMmSs('5')).toBe('5')
    expect(autoFormatMmSs('50')).toBe('50')
  })

  it('inserts colon at 3+ digits — M:SS', () => {
    expect(autoFormatMmSs('500')).toBe('5:00')
  })

  it('formats 4 digits as MM:SS', () => {
    expect(autoFormatMmSs('5000')).toBe('50:00')
  })

  it('formats 5 digits as H:MM:SS', () => {
    expect(autoFormatMmSs('12345')).toBe('1:23:45')
  })

  it('formats 6 digits as HH:MM:SS', () => {
    expect(autoFormatMmSs('123456')).toBe('12:34:56')
  })

  it('caps at 6 digits — extra ignored', () => {
    expect(autoFormatMmSs('1234567')).toBe('12:34:56')
  })

  it('padOnBlur appends :00 to 1-2 digit values', () => {
    expect(autoFormatMmSs('5', { padOnBlur: true })).toBe('5:00')
    expect(autoFormatMmSs('50', { padOnBlur: true })).toBe('50:00')
  })

  it('padOnBlur does NOT change 3+ digit values', () => {
    expect(autoFormatMmSs('500', { padOnBlur: true })).toBe('5:00')
    expect(autoFormatMmSs('5000', { padOnBlur: true })).toBe('50:00')
  })
})

describe('parseMmSs — colon form (back-compat)', () => {
  it('parses MM:SS', () => {
    expect(parseMmSs('5:00')).toBe(300)
    expect(parseMmSs('50:00')).toBe(3000)
    expect(parseMmSs('59:59')).toBe(3599)
  })

  it('parses H:MM:SS', () => {
    expect(parseMmSs('1:23:45')).toBe(5025)
    expect(parseMmSs('2:00:00')).toBe(7200)
  })

  it('rejects seconds >= 60 in MM:SS', () => {
    expect(parseMmSs('5:60')).toBe(null)
    expect(parseMmSs('50:99')).toBe(null)
  })

  it('rejects minutes >= 60 when hours present', () => {
    expect(parseMmSs('1:60:00')).toBe(null)
  })

  it('returns null for empty/invalid', () => {
    expect(parseMmSs('')).toBe(null)
    expect(parseMmSs(null)).toBe(null)
    expect(parseMmSs('not a time')).toBe(null)
    expect(parseMmSs(':')).toBe(null)
  })
})

describe('parseMmSs — digit-only form (mobile-friendly v9.49.0)', () => {
  it('parses single digit as minutes', () => {
    expect(parseMmSs('5')).toBe(300)        // 5 minutes
  })

  it('parses double digit as minutes (the user-reported bug)', () => {
    expect(parseMmSs('50')).toBe(3000)      // 50 minutes
    expect(parseMmSs('99')).toBe(5940)      // 99 minutes
  })

  it('parses 3 digits as M:SS', () => {
    expect(parseMmSs('500')).toBe(300)      // 5:00 = 300 sec
    expect(parseMmSs('545')).toBe(345)      // 5:45 = 345 sec
  })

  it('parses 4 digits as MM:SS', () => {
    expect(parseMmSs('5000')).toBe(3000)    // 50:00 = 3000 sec
    expect(parseMmSs('1234')).toBe(754)     // 12:34 = 754 sec
  })

  it('parses 5 digits as H:MM:SS', () => {
    expect(parseMmSs('12345')).toBe(5025)   // 1:23:45 = 5025 sec
  })

  it('parses 6 digits as HH:MM:SS', () => {
    expect(parseMmSs('123456')).toBe(45296) // 12:34:56 = 45296 sec
  })

  it('rejects digit-only with seconds >= 60', () => {
    expect(parseMmSs('560')).toBe(null)     // 5:60 invalid
    expect(parseMmSs('5099')).toBe(null)    // 50:99 invalid
  })

  it('rejects digit-only with minutes >= 60 when hours present', () => {
    expect(parseMmSs('16000')).toBe(null)   // 1:60:00 invalid
  })

  it('rejects 7+ digits', () => {
    expect(parseMmSs('1234567')).toBe(null)
  })

  it('round-trips: autoFormatMmSs output must parse back', () => {
    for (const raw of ['5', '50', '500', '5000', '12345', '123456']) {
      expect(parseMmSs(autoFormatMmSs(raw))).not.toBe(null)
      expect(parseMmSs(raw)).not.toBe(null)
    }
  })
})
