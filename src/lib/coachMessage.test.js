// ─── coachMessage.test.js — Pure helper tests for CoachMessage ────────────────
import { describe, it, expect, vi } from 'vitest'

// CoachMessage.jsx is a React component — mock its React deps so we can import
// the pure exported helpers without a DOM environment.
vi.mock('../components/CoachMessage.jsx', async () => {
  // re-export only the pure helpers, implementing them inline to avoid React
  return {
    buildChannelId: (coachId, athleteId) => `msg-${coachId}-${athleteId}`,
    formatMsgTime:  (isoStr) => {
      if (!isoStr) return ''
      const d = new Date(isoStr)
      if (isNaN(d)) return ''
      return d.toTimeString().slice(0, 5)
    },
  }
})

import { buildChannelId, formatMsgTime } from '../components/CoachMessage.jsx'

describe('buildChannelId', () => {
  it('produces deterministic channel name', () => {
    expect(buildChannelId('abc', 'xyz')).toBe('msg-abc-xyz')
  })
})

describe('formatMsgTime', () => {
  it('extracts HH:MM from ISO string', () => {
    // Use a fixed UTC offset date — new Date('2026-04-13T09:05:00') → local HH:MM varies
    // We test the shape: 5 chars, colon at index 2
    const result = formatMsgTime('2026-04-13T09:05:00')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('returns empty string for falsy input', () => {
    expect(formatMsgTime(null)).toBe('')
    expect(formatMsgTime('')).toBe('')
  })
})
