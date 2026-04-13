import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateInviteToken,
  buildInviteUrl,
  parseInviteParam,
  redeemInvite,
  getMyCoach,
  getMyAthletes,
} from '../inviteUtils.js'

// Helper: stub window.location for tests that need it
function stubLocation(search = '', extra = {}) {
  globalThis.window = { location: { search, pathname: '/', origin: 'https://test.com', ...extra } }
}
function clearWindow() {
  delete globalThis.window
}

// ── generateInviteToken ───────────────────────────────────────────────────────
describe('generateInviteToken', () => {
  it('returns a 16-character string', () => {
    expect(generateInviteToken()).toHaveLength(16)
  })

  it('returns only lowercase hex characters [0-9a-f]', () => {
    expect(generateInviteToken()).toMatch(/^[0-9a-f]{16}$/)
  })

  it('generates unique tokens — 100 calls produce 100 distinct values', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateInviteToken()))
    expect(tokens.size).toBe(100)
  })
})

// ── buildInviteUrl ────────────────────────────────────────────────────────────
describe('buildInviteUrl', () => {
  beforeEach(() => stubLocation(''))
  afterEach(clearWindow)

  it('returns a URL containing ?invite= param', () => {
    expect(buildInviteUrl('abc123')).toContain('?invite=')
  })

  it('appends token value correctly', () => {
    expect(buildInviteUrl('deadbeef12345678')).toContain('invite=deadbeef12345678')
  })

  it('handles empty string token without throwing', () => {
    expect(() => buildInviteUrl('')).not.toThrow()
  })
})

// ── parseInviteParam ──────────────────────────────────────────────────────────
describe('parseInviteParam', () => {
  afterEach(clearWindow)

  it('returns token when ?invite=abc123 present', () => {
    stubLocation('?invite=abc123')
    expect(parseInviteParam()).toBe('abc123')
  })

  it('returns null when ?invite= param absent', () => {
    stubLocation('')
    expect(parseInviteParam()).toBeNull()
  })

  it('returns null when window is undefined (SSR safe)', () => {
    // No window set — clearWindow already removed it above
    expect(parseInviteParam()).toBeNull()
  })

  it('returns null for empty ?invite= value', () => {
    stubLocation('?invite=')
    expect(parseInviteParam()).toBeNull()
  })
})

// ── redeemInvite ──────────────────────────────────────────────────────────────
describe('redeemInvite', () => {
  it('calls supabase with correct code and returns success shape', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    const mockInvite = { id: 'inv1', coach_id: 'c1', expires_at: futureDate, used_by: null, code: 'testcode' }
    let singleCall = 0
    const mock = {
      from:   vi.fn(() => mock),
      select: vi.fn(() => mock),
      eq:     vi.fn(() => mock),
      single: vi.fn(() => {
        singleCall++
        if (singleCall === 1) return Promise.resolve({ data: mockInvite, error: null })
        return Promise.resolve({ data: { display_name: 'Coach Bob' }, error: null })
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => mock),
    }
    const result = await redeemInvite(mock, 'testcode', 'athlete1')
    expect(result.success).toBe(true)
    expect(result.coachId).toBe('c1')
    expect(result.coachName).toBe('Coach Bob')
  })

  it('returns { success: false, error } on network failure — never throws', async () => {
    const mock = {
      from:   vi.fn(() => mock),
      select: vi.fn(() => mock),
      eq:     vi.fn(() => mock),
      single: vi.fn().mockRejectedValue(new Error('Network error')),
    }
    const result = await redeemInvite(mock, 'badcode', 'athlete1')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

// ── getMyCoach ────────────────────────────────────────────────────────────────
describe('getMyCoach', () => {
  it('returns null if no coach linked', async () => {
    const mock = {
      from:   vi.fn(() => mock),
      select: vi.fn(() => mock),
      eq:     vi.fn(() => mock),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    expect(await getMyCoach(mock, 'athlete1')).toBeNull()
  })
})

// ── getMyAthletes ─────────────────────────────────────────────────────────────
describe('getMyAthletes', () => {
  it('returns empty array if none connected', async () => {
    // Chain: .from().select().eq().eq() → { data: [], error: null }
    let eqCall = 0
    const mock = {
      from:   vi.fn(() => mock),
      select: vi.fn(() => mock),
      eq:     vi.fn(() => {
        eqCall++
        if (eqCall < 2) return mock
        return Promise.resolve({ data: [], error: null })
      }),
    }
    const result = await getMyAthletes(mock, 'coach1')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(0)
  })
})
