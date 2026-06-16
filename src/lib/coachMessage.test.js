// ─── coachMessage.test.js — Pure helper tests for CoachMessage ────────────────
// round-3 test-integrity finding: this file previously vi.mock'd
// '../components/CoachMessage.jsx' with an INLINE reimplementation of
// buildChannelId/formatMsgTime, then asserted that inline copy — so the real
// helpers could change (or break) and the test would still pass. Now imports the
// REAL exports: buildChannelId from src/lib/db/messages.js (where it's defined and
// re-exported by CoachMessage.jsx) and formatMsgTime from CoachMessage.jsx itself.
import { describe, it, expect } from 'vitest'

import { buildChannelId } from './db/messages.js'
import { formatMsgTime } from '../components/CoachMessage.jsx'

describe('buildChannelId', () => {
  it('produces deterministic channel name', () => {
    expect(buildChannelId('abc', 'xyz')).toBe('msg-abc-xyz')
  })
})

describe('formatMsgTime', () => {
  it('extracts HH:MM from ISO string', () => {
    // local HH:MM varies by TZ, so assert the shape, not a fixed value
    const result = formatMsgTime('2026-04-13T09:05:00')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('returns empty string for falsy input', () => {
    expect(formatMsgTime(null)).toBe('')
    expect(formatMsgTime('')).toBe('')
  })

  it('returns empty string for an unparseable date', () => {
    expect(formatMsgTime('not-a-date')).toBe('')
  })
})
