// @vitest-environment jsdom
// Combined unit tests for small lib modules
// Covers: announcementHelpers, realtimeStatus, storage/keys, observability/performanceBudget, orientation

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { validateAnnouncement, isUnread } from '../announcementHelpers.js'
import { reportStatus, removeStatus, getStatuses, subscribeToStatuses } from '../realtimeStatus.js'
import { STORAGE_KEYS, ALL_STATIC_KEYS } from '../storage/keys.js'
import { BUNDLE_BUDGETS, LIGHTHOUSE_BUDGETS, CWV_BUDGETS } from '../observability/performanceBudget.js'
import { getOrientationStep, ORIENTATION_MESSAGES } from '../orientation.js'

// ─── announcementHelpers ──────────────────────────────────────────────────────

describe('validateAnnouncement', () => {
  it('returns invalid for empty string', () => {
    const result = validateAnnouncement('')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns invalid for null', () => {
    const result = validateAnnouncement(null)
    expect(result.valid).toBe(false)
  })

  it('returns invalid for a number', () => {
    const result = validateAnnouncement(42)
    expect(result.valid).toBe(false)
  })

  it('returns valid for a normal message', () => {
    const result = validateAnnouncement('Hello')
    expect(result.valid).toBe(true)
  })

  it('returns valid for exactly 280 characters', () => {
    const result = validateAnnouncement('x'.repeat(280))
    expect(result.valid).toBe(true)
  })

  it('returns invalid for 281 characters (one over limit)', () => {
    const result = validateAnnouncement('x'.repeat(281))
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('isUnread', () => {
  it('returns true when read_by is null', () => {
    expect(isUnread({ read_by: null }, 'user1')).toBe(true)
  })

  it('returns true when read_by is empty array', () => {
    expect(isUnread({ read_by: [] }, 'user1')).toBe(true)
  })

  it('returns false when athleteId is in read_by', () => {
    expect(isUnread({ read_by: ['user1'] }, 'user1')).toBe(false)
  })

  it('returns true when only a different user has read it', () => {
    expect(isUnread({ read_by: ['user2'] }, 'user1')).toBe(true)
  })
})

// ─── realtimeStatus ───────────────────────────────────────────────────────────

describe('realtimeStatus', () => {
  // Use unique channel names per test to avoid cross-test interference from module-level state
  const ch = (suffix) => `test-realtime-${Date.now()}-${suffix}`

  afterEach(() => {
    // Clean up any channels we may have set
    const statuses = getStatuses()
    Object.keys(statuses)
      .filter(k => k.startsWith('test-realtime-'))
      .forEach(k => removeStatus(k))
  })

  it('getStatuses returns an object', () => {
    expect(typeof getStatuses()).toBe('object')
  })

  it('reportStatus sets the channel status', () => {
    const channel = ch('a')
    reportStatus(channel, 'live')
    expect(getStatuses()[channel]).toBe('live')
    removeStatus(channel)
  })

  it('removeStatus deletes the channel entry', () => {
    const channel = ch('b')
    reportStatus(channel, 'live')
    removeStatus(channel)
    expect(getStatuses()[channel]).toBeUndefined()
  })

  it('subscribeToStatuses calls fn when reportStatus fires', () => {
    const channel = ch('c')
    let called = 0
    let lastSnapshot = null
    const unsub = subscribeToStatuses((s) => {
      if (channel in s) { called++; lastSnapshot = s }
    })
    reportStatus(channel, 'connecting')
    unsub()
    removeStatus(channel)
    expect(called).toBeGreaterThanOrEqual(1)
    expect(lastSnapshot[channel]).toBe('connecting')
  })

  it('listener is NOT called after unsubscribe', () => {
    const channel = ch('d')
    let callCount = 0
    const unsub = subscribeToStatuses(() => { callCount++ })
    unsub()
    const before = callCount
    reportStatus(channel, 'live')
    removeStatus(channel)
    expect(callCount).toBe(before)
  })

  it('snapshot passed to listener is a plain object (not internal ref)', () => {
    const channel = ch('e')
    let snapshot = null
    const unsub = subscribeToStatuses((s) => { snapshot = s })
    reportStatus(channel, 'live')
    unsub()
    // Mutating snapshot should not affect internal state
    if (snapshot) snapshot.__test_mutation = true
    expect(getStatuses().__test_mutation).toBeUndefined()
    removeStatus(channel)
  })

  it('reportStatus updates status from one value to another', () => {
    const channel = ch('f')
    reportStatus(channel, 'connecting')
    reportStatus(channel, 'live')
    expect(getStatuses()[channel]).toBe('live')
    removeStatus(channel)
  })
})

// ─── storage/keys ─────────────────────────────────────────────────────────────

describe('STORAGE_KEYS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(true)
  })

  it('LOG === "sporeus_log"', () => {
    expect(STORAGE_KEYS.LOG).toBe('sporeus_log')
  })

  it('PROFILE === "sporeus_profile" (legacy underscore)', () => {
    expect(STORAGE_KEYS.PROFILE).toBe('sporeus_profile')
  })

  it('AI_CACHE("mykey") returns "sporeus-ai-mykey"', () => {
    expect(STORAGE_KEYS.AI_CACHE('mykey')).toBe('sporeus-ai-mykey')
  })

  it('WEEK_NOTE("2025-01-06") returns "sporeus-week-2025-01-06"', () => {
    expect(STORAGE_KEYS.WEEK_NOTE('2025-01-06')).toBe('sporeus-week-2025-01-06')
  })

  it('POWER_ZONE("low") returns "sporeus-power-low"', () => {
    expect(STORAGE_KEYS.POWER_ZONE('low')).toBe('sporeus-power-low')
  })
})

describe('ALL_STATIC_KEYS', () => {
  it('is an array', () => {
    expect(Array.isArray(ALL_STATIC_KEYS)).toBe(true)
  })

  it('contains only strings (no functions)', () => {
    ALL_STATIC_KEYS.forEach(v => expect(typeof v).toBe('string'))
  })

  it('includes "sporeus_log"', () => {
    expect(ALL_STATIC_KEYS).toContain('sporeus_log')
  })

  it('includes "sporeus-recovery"', () => {
    expect(ALL_STATIC_KEYS).toContain('sporeus-recovery')
  })

  it('does NOT include function values (AI_CACHE, WEEK_NOTE, POWER_ZONE are functions)', () => {
    ALL_STATIC_KEYS.forEach(v => {
      expect(typeof v).not.toBe('function')
    })
  })
})

// ─── observability/performanceBudget ─────────────────────────────────────────

describe('BUNDLE_BUDGETS', () => {
  it('is a plain object', () => {
    expect(typeof BUNDLE_BUDGETS).toBe('object')
    expect(BUNDLE_BUDGETS).not.toBeNull()
  })

  it('mainBundleGzipMaxKB is a positive number', () => {
    expect(typeof BUNDLE_BUDGETS.mainBundleGzipMaxKB).toBe('number')
    expect(BUNDLE_BUDGETS.mainBundleGzipMaxKB).toBeGreaterThan(0)
  })
})

describe('LIGHTHOUSE_BUDGETS', () => {
  it('is a plain object', () => {
    expect(typeof LIGHTHOUSE_BUDGETS).toBe('object')
    expect(LIGHTHOUSE_BUDGETS).not.toBeNull()
  })

  it('performance score >= 80', () => {
    expect(LIGHTHOUSE_BUDGETS.performance).toBeGreaterThanOrEqual(80)
  })
})

describe('CWV_BUDGETS', () => {
  it('is a plain object', () => {
    expect(typeof CWV_BUDGETS).toBe('object')
    expect(CWV_BUDGETS).not.toBeNull()
  })

  it('LCP_ms > 0', () => {
    expect(CWV_BUDGETS.LCP_ms).toBeGreaterThan(0)
  })

  it('CLS < 1 (valid CLS value)', () => {
    expect(CWV_BUDGETS.CLS).toBeLessThan(1)
  })
})

// ─── orientation.js ───────────────────────────────────────────────────────────
// jsdom provides window.localStorage so these are testable

describe('getOrientationStep', () => {
  beforeEach(() => {
    // Clear all sporeus orientation keys before each test
    Object.keys(localStorage)
      .filter(k => k.startsWith('sporeus-'))
      .forEach(k => localStorage.removeItem(k))
    localStorage.clear()
  })

  it('returns "set_profile" when no sport is set', () => {
    expect(getOrientationStep([], null, [])).toBe('set_profile')
  })

  it('returns "set_profile" when profile exists but has no sport', () => {
    expect(getOrientationStep([], { name: 'Athlete' }, [])).toBe('set_profile')
  })

  it('returns "log_first_session" when sport set but no log entries', () => {
    expect(getOrientationStep([], { sport: 'running' }, [])).toBe('log_first_session')
  })

  it('returns "log_wellness" when log has entries but no recent wellness', () => {
    const log = [{ date: '2025-01-01', tss: 50 }]
    const profile = { sport: 'running' }
    // Empty wellness history — should ask to log wellness
    const result = getOrientationStep(log, profile, [])
    expect(result).toBe('log_wellness')
  })

  it('returns null or a later step when all early steps satisfied', () => {
    const today = new Date().toISOString().slice(0, 10)
    const log = [{ date: today, tss: 50 }]
    const profile = { sport: 'running' }
    const wellnessHistory = [{ date: today }]
    // With recent wellness and single session, run_predictor condition needs 3+ sessions
    const result = getOrientationStep(log, profile, wellnessHistory)
    // Not set_profile, not log_first_session, not log_wellness — could be null or run_predictor
    expect(['run_predictor', 'view_load', null]).toContain(result)
  })

  it('respects dismissal via localStorage for set_profile step', () => {
    localStorage.setItem('sporeus-oriented-set_profile', '1')
    // With no sport but step dismissed, should advance to next step
    const result = getOrientationStep([], null, [])
    expect(result).not.toBe('set_profile')
  })
})

describe('ORIENTATION_MESSAGES', () => {
  const EXPECTED_STEPS = ['set_profile', 'log_first_session', 'log_wellness', 'run_predictor', 'view_load']

  it('has keys for all 5 orientation steps', () => {
    EXPECTED_STEPS.forEach(step => {
      expect(ORIENTATION_MESSAGES).toHaveProperty(step)
    })
  })

  it('each step has an "en" string', () => {
    EXPECTED_STEPS.forEach(step => {
      expect(typeof ORIENTATION_MESSAGES[step].en).toBe('string')
      expect(ORIENTATION_MESSAGES[step].en.length).toBeGreaterThan(0)
    })
  })

  it('each step has a "tr" string', () => {
    EXPECTED_STEPS.forEach(step => {
      expect(typeof ORIENTATION_MESSAGES[step].tr).toBe('string')
      expect(ORIENTATION_MESSAGES[step].tr.length).toBeGreaterThan(0)
    })
  })

  it('each step has a "tab" string', () => {
    EXPECTED_STEPS.forEach(step => {
      expect(typeof ORIENTATION_MESSAGES[step].tab).toBe('string')
    })
  })
})
