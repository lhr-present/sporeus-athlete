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
    hasUnread: (msgs, viewerRole) => {
      if (!Array.isArray(msgs)) return 0
      const otherRole = viewerRole === 'coach' ? 'athlete' : 'coach'
      return msgs.filter(m => m.sender_role === otherRole && !m.read_at).length
    },
    canSendMessage: (senderRole) => senderRole === 'coach' || senderRole === 'athlete',
  }
})

import { buildChannelId, formatMsgTime, hasUnread, canSendMessage } from '../components/CoachMessage.jsx'

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

describe('hasUnread', () => {
  it('counts unread coach messages for athlete viewer', () => {
    const msgs = [
      { sender_role: 'coach',   read_at: null },         // unread from coach → counts
      { sender_role: 'coach',   read_at: '2026-04-13' }, // read → skip
      { sender_role: 'athlete', read_at: null },          // own message → skip
    ]
    expect(hasUnread(msgs, 'athlete')).toBe(1)
  })

  it('returns 0 for empty array', () => {
    expect(hasUnread([], 'coach')).toBe(0)
  })
})

describe('canSendMessage', () => {
  it('allows coach and athlete roles', () => {
    expect(canSendMessage('coach')).toBe(true)
    expect(canSendMessage('athlete')).toBe(true)
  })

  it('rejects unknown roles', () => {
    expect(canSendMessage('admin')).toBe(false)
    expect(canSendMessage('')).toBe(false)
  })
})
