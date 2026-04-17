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

// ── generateInviteToken (alias for generateInviteCode) ───────────────────────
describe('generateInviteToken', () => {
  it('returns SP-XXXXXXXX format', () => {
    expect(generateInviteToken()).toMatch(/^SP-[A-Z2-9]{8}$/)
  })

  it('generates unique codes — 100 calls produce 100 distinct values', () => {
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

// ── redeemInvite (calls edge function via functions.invoke) ───────────────────
describe('redeemInvite', () => {
  it('returns { success: false } when edge function returns error (e.g. 401)', async () => {
    // Simulates unauthenticated call: SDK sends no auth header, edge fn returns error
    const mock = {
      functions: { invoke: vi.fn().mockResolvedValue({ data: { error: 'Unauthorized', code: 'UNAUTHENTICATED' }, error: null }) },
    }
    const result = await redeemInvite(mock, 'SP-ABC12345')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    // getSession must NOT be called
    expect(mock.functions.invoke).toHaveBeenCalledWith('redeem-invite', { body: { code: 'SP-ABC12345' } })
  })

  it('returns { success: false, error } on network failure — never throws', async () => {
    const mock = {
      functions: { invoke: vi.fn().mockRejectedValue(new Error('Network error')) },
    }
    const result = await redeemInvite(mock, 'SP-BADCODE')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.code).toBe('NETWORK_ERROR')
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
