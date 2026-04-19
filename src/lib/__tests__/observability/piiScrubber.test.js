// src/lib/__tests__/observability/piiScrubber.test.js
// E15 — PII scrubber tests. Every test is traceable to a real scrubbing rule.
import { describe, it, expect } from 'vitest'
import { scrubPII } from '../../observability/piiScrubber.js'

describe('scrubPII — emails', () => {
  it('replaces email in plain string', () => {
    expect(scrubPII('error from user@example.com during load')).toBe('error from [email] during load')
  })

  it('replaces email in nested object value', () => {
    const result = scrubPII({ user: { contact: 'test@sporeus.com' } })
    expect(result.user.contact).toBe('[email]')
  })

  it('replaces multiple emails in one string', () => {
    const result = scrubPII('coach@team.com sent to athlete@club.org')
    expect(result).not.toMatch(/@/)
    expect(result).toContain('[email]')
  })
})

describe('scrubPII — JWTs', () => {
  it('replaces JWT in Authorization header value (JWT_RE fires before BEARER_RE)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    // JWT_RE runs before BEARER_RE, so the JWT part is replaced first → 'Bearer [jwt]'
    expect(scrubPII(`Bearer ${jwt}`)).toBe('Bearer [jwt]')
  })

  it('replaces bare JWT in string', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    expect(scrubPII(jwt)).toBe('[jwt]')
  })
})

describe('scrubPII — API keys', () => {
  it('replaces Anthropic sk-ant- key', () => {
    expect(scrubPII('key: sk-ant-api03-abcdefgh12345678')).toBe('key: [api_key]')
  })

  it('replaces Stripe pk_live_ key', () => {
    expect(scrubPII('pk_live_abcdefghijklmnop')).toBe('[api_key]')
  })

  it('replaces sk_live_ key', () => {
    expect(scrubPII('config sk_live_test12345678')).toBe('config [api_key]')
  })
})

describe('scrubPII — Supabase tokens in URLs', () => {
  it('strips access_token query param', () => {
    const url = 'https://pvicq.supabase.co/auth/v1?access_token=eyJhbGciOiJIUzI1NiJ9.abc.def&refresh_token=xyz123'
    const result = scrubPII(url)
    expect(result).not.toContain('access_token=')
    expect(result).not.toContain('refresh_token=')
  })
})

describe('scrubPII — UUIDs', () => {
  it('replaces UUID v4', () => {
    expect(scrubPII('session 550e8400-e29b-41d4-a716-446655440000 loaded')).toBe('session [uuid] loaded')
  })

  it('does not replace non-v4 UUID-like strings', () => {
    // v4 has "4" as 13th hex digit — a v1 UUID should not match
    const v1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    // v1 doesn't start with 4 in the third group, so regex won't match
    const result = scrubPII(v1)
    expect(result).toBe(v1)
  })
})

describe('scrubPII — phone numbers', () => {
  it('replaces E.164 phone number', () => {
    expect(scrubPII('contact +14155551234 for support')).toBe('contact [phone] for support')
  })

  it('replaces Turkish phone number', () => {
    expect(scrubPII('+905321234567 registered')).toBe('[phone] registered')
  })
})

describe('scrubPII — hex hashes', () => {
  it('replaces 32-char hex string (MD5)', () => {
    expect(scrubPII('hash: d41d8cd98f00b204e9800998ecf8427e')).toBe('hash: [hash]')
  })

  it('replaces 64-char hex string (SHA-256)', () => {
    const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    expect(scrubPII(sha256)).toBe('[hash]')
  })

  it('does NOT replace short hex color codes', () => {
    // #ff6600 is 6 chars — way below the 32-char threshold
    expect(scrubPII('color: #ff6600 bg: #0a0a0a')).toBe('color: #ff6600 bg: #0a0a0a')
  })
})

describe('scrubPII — non-string leaf values', () => {
  it('passes numbers through unchanged', () => {
    expect(scrubPII({ tss: 120, ctl: 85.3 })).toEqual({ tss: 120, ctl: 85.3 })
  })

  it('passes booleans through unchanged', () => {
    expect(scrubPII({ active: true, verified: false })).toEqual({ active: true, verified: false })
  })

  it('passes null through unchanged', () => {
    expect(scrubPII(null)).toBe(null)
  })

  it('returns empty string for empty string input', () => {
    expect(scrubPII('')).toBe('')
  })
})

describe('scrubPII — special types pass through', () => {
  it('passes Date objects through unchanged', () => {
    const d = new Date('2026-04-19')
    expect(scrubPII(d)).toBe(d)
  })

  it('passes function values through unchanged', () => {
    const fn = () => {}
    expect(scrubPII(fn)).toBe(fn)
  })

  it('passes Map through unchanged', () => {
    const m = new Map([['k', 'v']])
    expect(scrubPII(m)).toBe(m)
  })
})

describe('scrubPII — arrays', () => {
  it('scrubs emails inside arrays', () => {
    const result = scrubPII(['ok', 'user@test.com', 42])
    expect(result).toEqual(['ok', '[email]', 42])
  })

  it('handles array of mixed types', () => {
    const d = new Date()
    const result = scrubPII([1, 'hello', d, null, true])
    expect(result[0]).toBe(1)
    expect(result[1]).toBe('hello')
    expect(result[2]).toBe(d)
    expect(result[3]).toBe(null)
    expect(result[4]).toBe(true)
  })
})

describe('scrubPII — depth cap', () => {
  it('does not infinite-loop on deeply nested object', () => {
    const deep = { a: { b: { c: { d: { e: 'user@deep.com' } } } } }
    // At depth=3 the scrubber stops — no infinite loop
    expect(() => scrubPII(deep, 3)).not.toThrow()
  })

  it('stops recursing at depth 0 and returns depth-limit marker', () => {
    const nested = { x: 'user@example.com' }
    const result = scrubPII(nested, 0)
    expect(result).toBe('[depth limit]')
  })
})

describe('scrubPII — multiple PII types in one string', () => {
  it('scrubs email and UUID from same string', () => {
    const s = 'user user@test.com session 550e8400-e29b-41d4-a716-446655440000'
    const result = scrubPII(s)
    expect(result).not.toMatch(/@/)
    expect(result).not.toMatch(/550e8400/)
    expect(result).toContain('[email]')
    expect(result).toContain('[uuid]')
  })
})
