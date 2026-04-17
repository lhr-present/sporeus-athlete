// ─── attribution.test.js — Unit tests for src/lib/attribution.js ──────────────
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  parseUtmFromLocation,
  getOrCreateAnonId,
  recordFirstTouch,
  getFirstTouch,
  emitEvent,
  hasSignupFired,
  markSignupFired,
} from '../attribution.js'

// ── localStorage mock ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {}
  return {
    getItem:    (k) => store[k] ?? null,
    setItem:    (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear:      () => { store = {} },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// ── window.location stub ──────────────────────────────────────────────────────
Object.defineProperty(global, 'window', {
  value: { location: { search: '', pathname: '/', hostname: 'localhost' } },
  writable: true,
})
Object.defineProperty(global, 'document', {
  value: { referrer: '' },
  writable: true,
})
Object.defineProperty(global, 'navigator', {
  value: { userAgent: 'Mozilla/5.0 (Linux; Android 12) Mobile Safari' },
  writable: true,
})

beforeEach(() => {
  localStorageMock.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

// ── parseUtmFromLocation ──────────────────────────────────────────────────────
describe('parseUtmFromLocation', () => {
  it('extracts utm_source and utm_campaign from query string', () => {
    const result = parseUtmFromLocation('?utm_source=kitapyurdu&utm_campaign=esik_launch')
    expect(result.utm_source).toBe('kitapyurdu')
    expect(result.utm_campaign).toBe('esik_launch')
  })

  it('returns only present UTM keys (no undefined pollution)', () => {
    const result = parseUtmFromLocation('?utm_source=podcast')
    expect(result.utm_source).toBe('podcast')
    expect(result.utm_medium).toBeUndefined()
    expect(result.utm_campaign).toBeUndefined()
  })

  it('captures all five UTM dimensions', () => {
    const qs = '?utm_source=s&utm_medium=m&utm_campaign=c&utm_content=co&utm_term=t'
    const r = parseUtmFromLocation(qs)
    expect(r.utm_source).toBe('s')
    expect(r.utm_medium).toBe('m')
    expect(r.utm_campaign).toBe('c')
    expect(r.utm_content).toBe('co')
    expect(r.utm_term).toBe('t')
  })

  it('includes landing_path', () => {
    const result = parseUtmFromLocation('')
    expect(result.landing_path).toBe('/')
  })

  it('returns empty object when no UTMs present', () => {
    const result = parseUtmFromLocation('')
    expect(result.utm_source).toBeUndefined()
    expect(result.utm_medium).toBeUndefined()
  })

  it('handles malformed query string without throwing', () => {
    expect(() => parseUtmFromLocation('not_a_query')).not.toThrow()
  })
})

// ── getOrCreateAnonId ─────────────────────────────────────────────────────────
describe('getOrCreateAnonId', () => {
  it('creates and persists an anon_id in localStorage', () => {
    const id = getOrCreateAnonId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
    expect(localStorageMock.getItem('spa_anon')).toBe(id)
  })

  it('returns the same id on subsequent calls (stable)', () => {
    const id1 = getOrCreateAnonId()
    const id2 = getOrCreateAnonId()
    expect(id1).toBe(id2)
  })

  it('generates different ids for different "users" (different localStorage states)', () => {
    const id1 = getOrCreateAnonId()
    localStorageMock.clear()
    const id2 = getOrCreateAnonId()
    expect(id1).not.toBe(id2)
  })

  it('id looks like a UUID (contains hyphens)', () => {
    const id = getOrCreateAnonId()
    expect(id).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
  })
})

// ── recordFirstTouch ──────────────────────────────────────────────────────────
describe('recordFirstTouch', () => {
  it('saves first-touch context to localStorage', () => {
    const ctx = { utm_source: 'twitter', utm_campaign: 'launch' }
    const saved = recordFirstTouch(ctx)
    expect(saved.utm_source).toBe('twitter')
    expect(saved.utm_campaign).toBe('launch')
    expect(saved.anon_id).toBeTruthy()
    expect(saved.captured_at).toBeTruthy()
  })

  it('is a no-op on second call (preserves first-touch, 30d TTL)', () => {
    const first = recordFirstTouch({ utm_source: 'first' })
    const second = recordFirstTouch({ utm_source: 'second' })
    // Second call returns same first-touch, not overwritten
    expect(second.utm_source).toBe('first')
    expect(second.utm_source).toBe(first.utm_source)
  })

  it('overwrites after TTL expires', () => {
    // Inject an expired entry
    localStorageMock.setItem('spa_first_touch', JSON.stringify({
      data: { utm_source: 'old' },
      expires_at: Date.now() - 1000, // already expired
    }))
    const result = recordFirstTouch({ utm_source: 'new' })
    expect(result.utm_source).toBe('new')
  })

  it('returns the stored data if called again within TTL', () => {
    recordFirstTouch({ utm_source: 'first_call' })
    const second = recordFirstTouch({ utm_source: 'ignored' })
    expect(second.utm_source).toBe('first_call')
  })
})

// ── getFirstTouch ─────────────────────────────────────────────────────────────
describe('getFirstTouch', () => {
  it('returns null when nothing stored', () => {
    expect(getFirstTouch()).toBeNull()
  })

  it('returns stored data after recordFirstTouch()', () => {
    recordFirstTouch({ utm_source: 'kitapyurdu' })
    const ft = getFirstTouch()
    expect(ft?.utm_source).toBe('kitapyurdu')
  })
})

// ── emitEvent ─────────────────────────────────────────────────────────────────
describe('emitEvent', () => {
  it('does not throw when called without a supabase URL', () => {
    expect(() => emitEvent('test_event', {}, null)).not.toThrow()
  })

  it('calls fetch with the correct URL and event name', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('ok'))
    recordFirstTouch({ utm_source: 'test' })
    emitEvent('landing', { version: '8.0.0' }, 'https://fake.supabase.co')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://fake.supabase.co/functions/v1/attribution-log',
      expect.objectContaining({
        method: 'POST',
        body:   expect.stringContaining('"event_name":"landing"'),
      })
    )
  })

  it('includes first_touch data in the payload when present', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('ok'))
    recordFirstTouch({ utm_source: 'esik_book' })
    emitEvent('signup_completed', {}, 'https://fake.supabase.co')
    const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(callBody.utm_source).toBe('esik_book')
    expect(callBody.anon_id).toBeTruthy()
  })

  it('swallows fetch errors without throwing', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'))
    expect(() => emitEvent('landing', {}, 'https://fake.supabase.co')).not.toThrow()
    // let the promise reject without crashing
    await new Promise(r => setTimeout(r, 10))
  })
})

// ── signup gate helpers ───────────────────────────────────────────────────────
describe('hasSignupFired / markSignupFired', () => {
  it('hasSignupFired returns false before markSignupFired', () => {
    expect(hasSignupFired()).toBe(false)
  })

  it('hasSignupFired returns true after markSignupFired', () => {
    markSignupFired()
    expect(hasSignupFired()).toBe(true)
  })
})
