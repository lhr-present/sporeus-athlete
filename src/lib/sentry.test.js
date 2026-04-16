// ─── sentry.test.js ───────────────────────────────────────────────────────────
// Tests for the PII-safe Sentry wrapper.
// We test the exported pure helpers (scrubData, sanitiseBeforeSend) and verify
// that the public API no-ops gracefully before initSentry() is called.
// We do NOT mock @sentry/react internals.
import { describe, it, expect } from 'vitest'
import {
  scrubData,
  sanitiseBeforeSend,
  captureException,
  setUser,
  clearUser,
  addBreadcrumb,
} from './sentry.js'

// ── scrubData ─────────────────────────────────────────────────────────────────

describe('scrubData', () => {
  it('passes through non-PII fields', () => {
    const out = scrubData({ operation: 'profiles:fetch', code: 'PGRST116', count: 3 })
    expect(out).toEqual({ operation: 'profiles:fetch', code: 'PGRST116', count: 3 })
  })

  it('strips keys named email', () => {
    const out = scrubData({ id: 'uuid-123', email: 'user@example.com' })
    expect(out).not.toHaveProperty('email')
    expect(out.id).toBe('uuid-123')
  })

  it('strips keys named name and display_name', () => {
    const out = scrubData({ id: 'uuid-123', name: 'Alice', display_name: 'Alice B' })
    expect(out).not.toHaveProperty('name')
    expect(out).not.toHaveProperty('display_name')
  })

  it('strips keys named phone', () => {
    const out = scrubData({ athleteId: 'uuid', phone: '+90555555' })
    expect(out).not.toHaveProperty('phone')
  })

  it('strips values that look like email addresses', () => {
    const out = scrubData({ info: 'user@sporeus.com', code: 'ABCD' })
    expect(out).not.toHaveProperty('info')
    expect(out.code).toBe('ABCD')
  })

  it('returns obj unchanged when no PII', () => {
    const input = { duration: 60, tss: 80, acwr: 1.1 }
    expect(scrubData(input)).toEqual(input)
  })

  it('returns non-object values unchanged', () => {
    expect(scrubData(null)).toBeNull()
    expect(scrubData('string')).toBe('string')
    expect(scrubData(42)).toBe(42)
  })

  it('does not mutate the original object', () => {
    const original = { email: 'a@b.com', id: '1' }
    scrubData(original)
    expect(original).toHaveProperty('email')
  })
})

// ── sanitiseBeforeSend ────────────────────────────────────────────────────────

describe('sanitiseBeforeSend', () => {
  it('strips query string from request.url', () => {
    const event = { request: { url: 'https://app.sporeus.com/?invite=SP-ABC12345' } }
    const out = sanitiseBeforeSend(event)
    expect(out.request.url).toBe('https://app.sporeus.com/')
    expect(out.request.url).not.toContain('invite=')
  })

  it('strips email from user context if it leaked', () => {
    const event = { user: { id: 'uuid-1', email: 'leaked@example.com' } }
    const out = sanitiseBeforeSend(event)
    expect(out.user).not.toHaveProperty('email')
    expect(out.user.id).toBe('uuid-1')
  })

  it('leaves event unchanged when no URL or email', () => {
    const event = { level: 'error', message: 'test error' }
    const out = sanitiseBeforeSend(event)
    expect(out).toEqual(event)
  })

  it('handles missing request gracefully', () => {
    const event = { user: { id: 'uuid-2' } }
    expect(() => sanitiseBeforeSend(event)).not.toThrow()
  })
})

// ── Public API graceful no-ops (Sentry not loaded) ────────────────────────────

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
    expect(() => addBreadcrumb('auth', 'user signed in', { id: 'uuid' })).not.toThrow()
  })

  it('does not throw with PII-shaped data', () => {
    expect(() => addBreadcrumb('profile', 'updated', { email: 'a@b.com', id: '1' })).not.toThrow()
  })
})
