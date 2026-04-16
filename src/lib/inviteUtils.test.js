// ─── inviteUtils.test.js ───────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'
import {
  generateInviteCode,
  buildInviteUrl,
  parseInviteParam,
  createInvite,
  listInvites,
  revokeInvite,
} from './inviteUtils.js'

// ── generateInviteCode ────────────────────────────────────────────────────────

describe('generateInviteCode', () => {
  it('returns SP- prefix', () => {
    const code = generateInviteCode()
    expect(code.startsWith('SP-')).toBe(true)
  })

  it('has exactly 8 chars after SP-', () => {
    const code = generateInviteCode()
    expect(code.slice(3).length).toBe(8)
  })

  it('contains no ambiguous chars: 0, O, 1, I', () => {
    // Run 200 times to get decent coverage
    for (let i = 0; i < 200; i++) {
      const chars = generateInviteCode().slice(3)
      expect(chars).not.toMatch(/[01OI]/)
    }
  })

  it('produces unique codes across 1000 calls', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateInviteCode()))
    expect(codes.size).toBe(1000)
  })

  it('uses only chars from the expected alphabet', () => {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for (let i = 0; i < 50; i++) {
      const chars = generateInviteCode().slice(3)
      for (const c of chars) expect(ALPHABET).toContain(c)
    }
  })
})

// ── buildInviteUrl ────────────────────────────────────────────────────────────

describe('buildInviteUrl', () => {
  it('returns empty string in non-browser env', () => {
    const origWindow = global.window
    delete global.window
    expect(buildInviteUrl('SP-ABC12345')).toBe('')
    global.window = origWindow
  })

  it('encodes code in URL when window is available', () => {
    // Simulate browser env with a minimal window mock
    const origWindow = global.window
    global.window = { location: { origin: 'https://app.sporeus.com', pathname: '/' } }
    const url = buildInviteUrl('SP-ABC12345')
    expect(url).toContain('invite=SP-ABC12345')
    global.window = origWindow
  })
})

// ── parseInviteParam ──────────────────────────────────────────────────────────

describe('parseInviteParam', () => {
  it('returns null when no invite param', () => {
    // jsdom defaults to http://localhost/ with no query params
    expect(parseInviteParam()).toBeNull()
  })
})

// ── createInvite (mocked Supabase) ────────────────────────────────────────────

describe('createInvite', () => {
  function makeClient(insertError = null) {
    return {
      from: () => ({
        insert: vi.fn().mockResolvedValue({ error: insertError }),
      }),
    }
  }

  it('returns code and inviteUrl on success', async () => {
    const client = makeClient(null)
    const result = await createInvite(client, 'coach-uuid')
    expect(result.code).toMatch(/^SP-[A-Z2-9]{8}$/)
    expect(result.inviteUrl).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  it('returns error on Supabase failure', async () => {
    const client = makeClient({ message: 'duplicate key' })
    const result = await createInvite(client, 'coach-uuid')
    expect(result.error).toBe('duplicate key')
    expect(result.code).toBeUndefined()
  })

  it('passes label and maxUses to insert', async () => {
    let captured = null
    const client = {
      from: () => ({
        insert: vi.fn().mockImplementation(row => {
          captured = row
          return Promise.resolve({ error: null })
        }),
      }),
    }
    await createInvite(client, 'coach-uuid', { label: 'Squad A', maxUses: 5 })
    expect(captured.label).toBe('Squad A')
    expect(captured.max_uses).toBe(5)
  })

  it('null label and max_uses when not provided', async () => {
    let captured = null
    const client = {
      from: () => ({
        insert: vi.fn().mockImplementation(row => {
          captured = row
          return Promise.resolve({ error: null })
        }),
      }),
    }
    await createInvite(client, 'coach-uuid')
    expect(captured.label).toBeNull()
    expect(captured.max_uses).toBeNull()
  })
})

// ── revokeInvite ──────────────────────────────────────────────────────────────

describe('revokeInvite', () => {
  it('returns success:true on ok', async () => {
    const client = {
      from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }
    const r = await revokeInvite(client, 'invite-id')
    expect(r.success).toBe(true)
  })

  it('returns success:false with error message on failure', async () => {
    const client = {
      from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: { message: 'RLS denied' } }) }) }),
    }
    const r = await revokeInvite(client, 'invite-id')
    expect(r.success).toBe(false)
    expect(r.error).toBe('RLS denied')
  })
})

// ── listInvites ───────────────────────────────────────────────────────────────

describe('listInvites', () => {
  it('returns empty array on error', async () => {
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ is: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'fail' } }) }) }) }) }),
    }
    const r = await listInvites(client, 'coach-uuid')
    expect(r).toEqual([])
  })

  it('returns rows on success', async () => {
    const rows = [{ id: '1', code: 'SP-ABCD1234' }]
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ is: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }),
    }
    const r = await listInvites(client, 'coach-uuid')
    expect(r).toEqual(rows)
  })
})

// ── Edge function validation logic (pure) ─────────────────────────────────────

describe('invite validation logic', () => {
  function validate(invite, athleteId) {
    if (invite.revoked_at)                                     return 'REVOKED'
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return 'EXPIRED'
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) return 'MAX_USES_REACHED'
    if (invite.coach_id === athleteId)                         return 'SELF_INVITE'
    return 'OK'
  }

  const base = { coach_id: 'coach-1', revoked_at: null, expires_at: null, max_uses: null, uses_count: 0 }

  it('OK for valid invite', () => {
    expect(validate(base, 'athlete-1')).toBe('OK')
  })

  it('REVOKED when revoked_at is set', () => {
    expect(validate({ ...base, revoked_at: new Date().toISOString() }, 'athlete-1')).toBe('REVOKED')
  })

  it('EXPIRED when expires_at is in the past', () => {
    expect(validate({ ...base, expires_at: '2020-01-01T00:00:00Z' }, 'athlete-1')).toBe('EXPIRED')
  })

  it('MAX_USES_REACHED when uses_count >= max_uses', () => {
    expect(validate({ ...base, max_uses: 3, uses_count: 3 }, 'athlete-1')).toBe('MAX_USES_REACHED')
  })

  it('OK when uses_count < max_uses', () => {
    expect(validate({ ...base, max_uses: 3, uses_count: 2 }, 'athlete-1')).toBe('OK')
  })

  it('SELF_INVITE when coach tries to redeem own invite', () => {
    expect(validate(base, 'coach-1')).toBe('SELF_INVITE')
  })
})
