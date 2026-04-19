// src/lib/__tests__/realtime/presenceFormat.test.js
// E11 — Pure unit tests for presenceFormat.js.
// No mocks needed — all functions are deterministic (injectable `now` param).

import { describe, it, expect } from 'vitest'
import {
  formatViewedAt,
  presenceBucket,
  formatPresenceList,
} from '../../realtime/presenceFormat.js'

// ── Shared fixture ────────────────────────────────────────────────────────────
const NOW = new Date('2026-04-19T12:00:00Z')

function ago(ms) {
  return new Date(NOW.getTime() - ms)
}

// ── formatViewedAt ────────────────────────────────────────────────────────────

describe('formatViewedAt — edge cases', () => {
  it('returns empty string for null', () => {
    expect(formatViewedAt(null, 'en', NOW)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatViewedAt(undefined, 'en', NOW)).toBe('')
  })

  it('returns empty string for invalid date string', () => {
    expect(formatViewedAt('not-a-date', 'en', NOW)).toBe('')
  })
})

describe('formatViewedAt — EN recency buckets', () => {
  it('returns "Viewing now" for 30 seconds ago', () => {
    expect(formatViewedAt(ago(30_000), 'en', NOW)).toBe('Viewing now')
  })

  it('returns "Viewing now" for 90 seconds ago (< 2 min)', () => {
    expect(formatViewedAt(ago(90_000), 'en', NOW)).toBe('Viewing now')
  })

  it('returns "5 min ago" for 5 minutes ago', () => {
    expect(formatViewedAt(ago(5 * 60_000), 'en', NOW)).toBe('5 min ago')
  })

  it('returns "59 min ago" for 59 minutes ago', () => {
    expect(formatViewedAt(ago(59 * 60_000), 'en', NOW)).toBe('59 min ago')
  })

  it('returns "1 hour ago" for 61 minutes ago', () => {
    expect(formatViewedAt(ago(61 * 60_000), 'en', NOW)).toBe('1 hour ago')
  })

  it('returns "2 hours ago" for 2 hours ago', () => {
    expect(formatViewedAt(ago(2 * 3_600_000), 'en', NOW)).toBe('2 hours ago')
  })
})

describe('formatViewedAt — TR labels', () => {
  it('returns "Şu an görüntülüyor" for 30 seconds ago', () => {
    expect(formatViewedAt(ago(30_000), 'tr', NOW)).toBe('Şu an görüntülüyor')
  })

  it('returns "5 dk önce" for 5 minutes ago', () => {
    expect(formatViewedAt(ago(5 * 60_000), 'tr', NOW)).toBe('5 dk önce')
  })

  it('returns "2 saat önce" for 2 hours ago', () => {
    expect(formatViewedAt(ago(2 * 3_600_000), 'tr', NOW)).toBe('2 saat önce')
  })
})

describe('formatViewedAt — Date types', () => {
  it('accepts Date object', () => {
    // 2:01 ago → diffMin=2 → "2 min ago"
    expect(formatViewedAt(ago(2 * 60_000 + 1_000), 'en', NOW)).toBe('2 min ago')
  })

  it('accepts ISO string', () => {
    const iso = ago(5 * 60_000).toISOString()
    expect(formatViewedAt(iso, 'en', NOW)).toBe('5 min ago')
  })

  it('accepts Unix timestamp (number)', () => {
    const ts = ago(5 * 60_000).getTime()
    expect(formatViewedAt(ts, 'en', NOW)).toBe('5 min ago')
  })
})

describe('formatViewedAt — yesterday / days ago', () => {
  it('returns "Yesterday" for ~25 hours ago', () => {
    // yesterday relative to NOW (2026-04-19 12:00) → 2026-04-18 something
    const yd = new Date('2026-04-18T10:00:00Z')
    const result = formatViewedAt(yd, 'en', NOW)
    expect(result).toBe('Yesterday')
  })

  it('returns "X days ago" for 3 days ago', () => {
    const result = formatViewedAt(ago(3 * 86_400_000), 'en', NOW)
    expect(result).toContain('days ago')
  })
})

// ── presenceBucket ────────────────────────────────────────────────────────────

describe('presenceBucket', () => {
  it('returns "never" for null', () => {
    expect(presenceBucket(null, NOW)).toBe('never')
  })

  it('returns "now" for 1 minute ago', () => {
    expect(presenceBucket(ago(60_000), NOW)).toBe('now')
  })

  it('returns "now" for exactly 4:59 ago', () => {
    expect(presenceBucket(ago(4 * 60_000 + 59_000), NOW)).toBe('now')
  })

  it('returns "recent" for 10 minutes ago', () => {
    expect(presenceBucket(ago(10 * 60_000), NOW)).toBe('recent')
  })

  it('returns "recent" for 59 minutes ago', () => {
    expect(presenceBucket(ago(59 * 60_000), NOW)).toBe('recent')
  })

  it('returns "today" for same calendar day but > 60 min ago', () => {
    // NOW = 12:00. 2 hours ago = 10:00, same day.
    expect(presenceBucket(ago(2 * 3_600_000), NOW)).toBe('today')
  })

  it('returns "older" for yesterday', () => {
    const yd = new Date('2026-04-18T10:00:00Z')
    expect(presenceBucket(yd, NOW)).toBe('older')
  })
})

// ── formatPresenceList ────────────────────────────────────────────────────────

describe('formatPresenceList', () => {
  it('returns empty string for empty array', () => {
    expect(formatPresenceList([], 'en')).toBe('')
  })

  it('returns singular form for one name', () => {
    expect(formatPresenceList(['Alice'], 'en')).toBe('Alice viewing')
  })

  it('formats two names with "and"', () => {
    expect(formatPresenceList(['Alice', 'Bob'], 'en')).toBe('Alice and Bob viewing')
  })

  it('formats three names with comma+and', () => {
    expect(formatPresenceList(['Alice', 'Bob', 'Carol'], 'en'))
      .toBe('Alice, Bob and Carol viewing')
  })

  it('uses "ve" for Turkish', () => {
    expect(formatPresenceList(['Ali', 'Ayşe'], 'tr')).toBe('Ali ve Ayşe görüntülüyor')
  })
})
