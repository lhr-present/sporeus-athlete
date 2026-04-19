// ─── sentry.test.js ───────────────────────────────────────────────────────────
// Tests for src/lib/sentry.js (backward-compat shim → observability/sentry.js).
// scrubData now delegates to scrubPII (value-based scrubbing, not key stripping).
// sanitiseBeforeSend removed; use _scrubSentryEvent from observability/sentry.js.
import { describe, it, expect } from 'vitest'
import {
  scrubData,
  captureException,
  setUser,
  clearUser,
  addBreadcrumb,
} from './sentry.js'
import { _scrubSentryEvent } from './observability/sentry.js'

// ── scrubData (now = scrubPII — value scrubbing, keys preserved) ──────────────

describe('scrubData', () => {
  it('passes through non-PII fields unchanged', () => {
    const out = scrubData({ operation: 'profiles:fetch', code: 'PGRST116', count: 3 })
    expect(out).toEqual({ operation: 'profiles:fetch', code: 'PGRST116', count: 3 })
  })

  it('scrubs email address in value (key preserved)', () => {
    const out = scrubData({ id: 'uuid-123', email: 'user@example.com' })
    expect(out.email).toBe('[email]')   // value scrubbed, key kept
    expect(out.id).toBe('uuid-123')
  })

  it('scrubs phone number value', () => {
    const out = scrubData({ athleteId: 'abc', contact: '+905551234567' })
    expect(out.contact).toBe('[phone]')
    expect(out.athleteId).toBe('abc')
  })

  it('scrubs email in a string value', () => {
    const out = scrubData({ info: 'contact: user@sporeus.com', code: 'ABCD' })
    expect(out.info).toContain('[email]')
    expect(out.info).not.toContain('@')
    expect(out.code).toBe('ABCD')
  })

  it('returns plain object when no PII', () => {
    const input = { duration: 60, tss: 80, acwr: 1.1 }
    expect(scrubData(input)).toEqual(input)
  })

  it('returns non-object values unchanged', () => {
    expect(scrubData(null)).toBeNull()
    expect(scrubData(42)).toBe(42)
  })

  it('does not mutate the original object', () => {
    const original = { email: 'a@b.com', id: '1' }
    scrubData(original)
    expect(original.email).toBe('a@b.com')  // original unchanged
  })
})

// ── _scrubSentryEvent (replaces sanitiseBeforeSend) ───────────────────────────

describe('_scrubSentryEvent', () => {
  it('returns null for /debug/ URLs', () => {
    const event = { request: { url: 'https://sporeus.com/debug/rls' } }
    expect(_scrubSentryEvent(event)).toBeNull()
  })

  it('scrubs access_token from request URL', () => {
    const event = { request: { url: 'https://app.sporeus.com/?access_token=eyJhbGc.abc.def' } }
    const out = _scrubSentryEvent(event)
    expect(out.request.url).not.toContain('access_token=')
  })

  it('scrubs email from event message', () => {
    const event = { message: 'auth failed for user@test.com', request: {} }
    const out = _scrubSentryEvent(event)
    expect(out.message).not.toContain('@')
    expect(out.message).toContain('[email]')
  })

  it('leaves clean events unchanged', () => {
    const event = { message: 'TypeError: null ref', request: { url: 'https://sporeus.com/log' } }
    const out = _scrubSentryEvent(event)
    expect(out.message).toBe('TypeError: null ref')
  })

  it('handles missing request gracefully', () => {
    const event = { message: 'test error' }
    expect(() => _scrubSentryEvent(event)).not.toThrow()
  })
})

// ── Public API graceful no-ops (Sentry not initialized) ──────────────────────

describe('captureException before initSentry', () => {
  it('does not throw when called before init', () => {
    expect(() => captureException(new Error('test'))).not.toThrow()
  })

  it('does not throw with non-Error argument', () => {
    expect(() => captureException('string error')).not.toThrow()
  })

  it('does not throw with undefined', () => {
    expect(() => captureException(undefined, { ctx: 'test' })).not.toThrow()
  })
})

describe('setUser before initSentry', () => {
  it('does not throw when called before init', () => {
    expect(() => setUser('user-uuid-123')).not.toThrow()
  })

  it('does not throw with null', () => {
    expect(() => setUser(null)).not.toThrow()
  })
})

describe('clearUser before initSentry', () => {
  it('does not throw when called before init', () => {
    expect(() => clearUser()).not.toThrow()
  })
})

describe('addBreadcrumb before initSentry', () => {
  it('does not throw when called before init', () => {
    expect(() => addBreadcrumb('user signed in', 'auth', { id: 'uuid' })).not.toThrow()
  })

  it('does not throw with PII-shaped data', () => {
    expect(() => addBreadcrumb('updated', 'profile', { email: 'a@b.com', id: '1' })).not.toThrow()
  })
})
