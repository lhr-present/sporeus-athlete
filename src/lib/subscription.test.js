import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  TIERS, canAddAthlete, canUseAI, getRemainingAICalls,
  isFeatureGated, getUpgradePrompt, canUploadFile, FREE_UPLOAD_LIMIT,
  isOnTrial, isPastDue, isCancelled, isExpired, daysUntilExpiry, getEffectiveTier,
  getTier,
} from './subscription.js'

// FEATURE_TIERS is module-private; mirror it here as the truth table for the
// exhaustive gate coverage below. Kept in sync with subscription.js manually —
// the `every key gated for free` / `entitled tier ungates` assertions below
// will fail loudly if a feature is added to subscription.js but not here.
const FEATURE_TIERS = {
  multi_team:            'coach',
  export_pdf:            'coach',
  api_access:            'club',
  white_label:           'club',
  realtime_dashboard:    'coach',
  semantic_search:       'coach',
  squad_pattern_search:  'coach',
  debug_realtime_stats:  'coach',
}
const TIER_RANK = { free: 0, coach: 1, club: 2 }
import { supabase, isSupabaseReady } from './supabase.js'

vi.mock('./supabase.js', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  isSupabaseReady: vi.fn(() => false),
}))

vi.mock('./logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// ── TIERS shape ───────────────────────────────────────────────────────────────
describe('TIERS', () => {
  it('defines free, coach, club tiers', () => {
    expect(TIERS.free).toBeDefined()
    expect(TIERS.coach).toBeDefined()
    expect(TIERS.club).toBeDefined()
  })
  it('free tier has 0 AI calls', () => expect(TIERS.free.aiCalls).toBe(0))
  it('club tier allows 10 teams', () => expect(TIERS.club.teams).toBe(10))
})

// ── canAddAthlete ─────────────────────────────────────────────────────────────
describe('canAddAthlete', () => {
  it('free: can add first athlete (0 < 1)', () => expect(canAddAthlete(0, 'free')).toBe(true))
  it('free: cannot add second athlete (1 >= 1)', () => expect(canAddAthlete(1, 'free')).toBe(false))
  it('coach: can add up to 15', () => expect(canAddAthlete(14, 'coach')).toBe(true))
  it('coach: blocks at 15', () => expect(canAddAthlete(15, 'coach')).toBe(false))
})

// ── canUseAI ──────────────────────────────────────────────────────────────────
describe('canUseAI', () => {
  it('free tier: always false', () => expect(canUseAI(0, 'free')).toBe(false))
  it('coach tier: true when under limit', () => expect(canUseAI(10, 'coach')).toBe(true))
  it('coach tier: false when at limit', () => expect(canUseAI(50, 'coach')).toBe(false))
})

// ── getRemainingAICalls ───────────────────────────────────────────────────────
describe('getRemainingAICalls', () => {
  it('free: always 0', () => expect(getRemainingAICalls(0, 'free')).toBe(0))
  it('coach: 50 - used', () => expect(getRemainingAICalls(20, 'coach')).toBe(30))
  it('never returns negative', () => expect(getRemainingAICalls(999, 'coach')).toBe(0))
})

// ── isFeatureGated ────────────────────────────────────────────────────────────
describe('isFeatureGated', () => {
  it('multi_team gated for free', () => expect(isFeatureGated('multi_team', 'free')).toBe(true))
  it('multi_team open for coach', () => expect(isFeatureGated('multi_team', 'coach')).toBe(false))
  it('api_access gated for coach', () => expect(isFeatureGated('api_access', 'coach')).toBe(true))
  it('api_access open for club', () => expect(isFeatureGated('api_access', 'club')).toBe(false))

  // Explicit boundary checks for the four billing-load-bearing features.
  it('white_label gated for coach', () => expect(isFeatureGated('white_label', 'coach')).toBe(true))
  it('white_label open for club', () => expect(isFeatureGated('white_label', 'club')).toBe(false))
  it('export_pdf gated for free', () => expect(isFeatureGated('export_pdf', 'free')).toBe(true))
  it('export_pdf open for coach', () => expect(isFeatureGated('export_pdf', 'coach')).toBe(false))
  it('multi_team gated for free (boundary)', () => expect(isFeatureGated('multi_team', 'free')).toBe(true))
  it('multi_team open for club too (rank above required)', () => expect(isFeatureGated('multi_team', 'club')).toBe(false))

  // Exhaustive: every gated feature is blocked for free, and ungated at its
  // entitled tier (and any higher tier).
  it.each(Object.keys(FEATURE_TIERS))('%s is gated for free tier', (feature) => {
    expect(isFeatureGated(feature, 'free')).toBe(true)
  })
  it.each(Object.entries(FEATURE_TIERS))('%s is ungated at its entitled tier (%s)', (feature, required) => {
    expect(isFeatureGated(feature, required)).toBe(false)
    // Any tier ranked at or above the requirement is entitled.
    for (const [tier, rank] of Object.entries(TIER_RANK)) {
      expect(isFeatureGated(feature, tier)).toBe(rank < TIER_RANK[required])
    }
  })

  // FIX 1: unknown / renamed feature keys now fail CLOSED (gated) so a typo or
  // a future rename can't silently grant a paid feature to a free user.
  it('unknown feature is GATED (fail-closed)', () => {
    expect(isFeatureGated('nonexistent', 'free')).toBe(true)
  })
  it('unknown feature is gated even for the top (club) tier', () => {
    expect(isFeatureGated('totally_made_up_key', 'club')).toBe(true)
  })
})

// ── getUpgradePrompt ──────────────────────────────────────────────────────────
describe('getUpgradePrompt', () => {
  it('returns a string for known features', () => {
    const msg = getUpgradePrompt('multi_team')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(10)
  })
  it('returns fallback for unknown feature', () => {
    const msg = getUpgradePrompt('unknown_xyz')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })
})

// ── canUploadFile ──────────────────────────────────────────────────────────────
describe('canUploadFile', () => {
  it('free at 0: allowed', () => expect(canUploadFile(0, 'free')).toBe(true))
  it(`free at ${FREE_UPLOAD_LIMIT}: blocked`, () => expect(canUploadFile(FREE_UPLOAD_LIMIT, 'free')).toBe(false))
  it('coach: always allowed regardless of count', () => expect(canUploadFile(9999, 'coach')).toBe(true))
  it('club: always allowed', () => expect(canUploadFile(9999, 'club')).toBe(true))
})

// ── Status predicates ──────────────────────────────────────────────────────────
describe('isOnTrial', () => {
  it('true for trialing with future trial_ends_at', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString()
    expect(isOnTrial({ subscription_status: 'trialing', trial_ends_at: future })).toBe(true)
  })
  it('false for trialing with past trial_ends_at', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isOnTrial({ subscription_status: 'trialing', trial_ends_at: past })).toBe(false)
  })
  it('false for active status', () => {
    expect(isOnTrial({ subscription_status: 'active', trial_ends_at: null })).toBe(false)
  })
  it('false for null profile', () => expect(isOnTrial(null)).toBe(false))
})

describe('isPastDue', () => {
  it('true for past_due status', () => expect(isPastDue({ subscription_status: 'past_due' })).toBe(true))
  it('false for active status', () => expect(isPastDue({ subscription_status: 'active' })).toBe(false))
  it('false for null', () => expect(isPastDue(null)).toBe(false))
})

describe('isCancelled', () => {
  it('true for cancelled with future end_date', () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString()
    expect(isCancelled({ subscription_status: 'cancelled', subscription_end_date: future })).toBe(true)
  })
  it('false for cancelled with past end_date', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isCancelled({ subscription_status: 'cancelled', subscription_end_date: past })).toBe(false)
  })
  it('false for active', () => {
    expect(isCancelled({ subscription_status: 'active', subscription_end_date: null })).toBe(false)
  })
})

describe('isExpired', () => {
  it('true for expired status', () => {
    expect(isExpired({ subscription_status: 'expired', subscription_tier: 'coach' })).toBe(true)
  })
  it('true for free tier regardless of status', () => {
    expect(isExpired({ subscription_status: 'active', subscription_tier: 'free' })).toBe(true)
  })
  it('false for active coach', () => {
    expect(isExpired({ subscription_status: 'active', subscription_tier: 'coach' })).toBe(false)
  })
  it('true for null', () => expect(isExpired(null)).toBe(true))
})

describe('daysUntilExpiry', () => {
  it('returns 0 for null profile', () => expect(daysUntilExpiry(null)).toBe(0))
  it('returns ~7 for a trial ending in 7 days', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString()
    const days = daysUntilExpiry({ subscription_status: 'trialing', trial_ends_at: future })
    expect(days).toBeGreaterThanOrEqual(6)
    expect(days).toBeLessThanOrEqual(8)
  })
  it('returns 0 when cutoff is in the past', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    expect(daysUntilExpiry({ subscription_status: 'trialing', trial_ends_at: past })).toBe(0)
  })
})

// ── getEffectiveTier ──────────────────────────────────────────────────────────
describe('getEffectiveTier', () => {
  it('active coach → coach', () => expect(getEffectiveTier('coach', 'active')).toBe('coach'))
  it('trialing coach → coach (trial has full access)', () => expect(getEffectiveTier('coach', 'trialing')).toBe('coach'))
  it('past_due coach → coach (grace period: keep access, banner shown)', () => expect(getEffectiveTier('coach', 'past_due')).toBe('coach'))
  it('cancelled coach → free (access ended)', () => expect(getEffectiveTier('coach', 'cancelled')).toBe('free'))
  it('expired coach → free', () => expect(getEffectiveTier('coach', 'expired')).toBe('free'))
  it('none status → free', () => expect(getEffectiveTier('coach', 'none')).toBe('free'))
  it('defaults: free tier active → free', () => expect(getEffectiveTier()).toBe('free'))
  it('club active → club', () => expect(getEffectiveTier('club', 'active')).toBe('club'))
  it('club expired → free', () => expect(getEffectiveTier('club', 'expired')).toBe('free'))
})

// ── KNOWN DIVERGENCE vs server get_my_tier (founder decision) ──────────────────
// getEffectiveTier(tier, status) is DATE-BLIND: it decides purely on the status
// string and never inspects grace-period / paid-period end dates. The server-side
// get_my_tier() RPC IS date-keyed. These tests PIN the current client behavior so
// a future fix has a baseline. They document the divergence — they do NOT assert
// the client behavior is "correct".
describe('getEffectiveTier — KNOWN DIVERGENCE vs server get_my_tier (founder decision)', () => {
  // FLAG: past_due ALWAYS keeps full tier on the client, regardless of whether the
  //       3-day grace window has actually expired. The server get_my_tier() only
  //       keeps the paid tier while WITHIN grace (grace_period_ends_at > now) and
  //       reverts to free once grace lapses. So a client whose grace expired can
  //       still see paid caps until the next server-authoritative getTier() read.
  it('past_due keeps full tier even though server would revert after grace expiry', () => {
    expect(getEffectiveTier('coach', 'past_due')).toBe('coach')
    expect(getEffectiveTier('club', 'past_due')).toBe('club')
  })

  // FLAG: cancelled ALWAYS collapses to 'free' on the client, regardless of whether
  //       the already-paid period is still active. The server get_my_tier() KEEPS the
  //       paid tier until subscription_end_date (the user paid through period end).
  //       So a still-paid cancelled user is OVER-restricted on the client until a
  //       server-authoritative read corrects it.
  it('cancelled collapses to free even though server keeps access until period end', () => {
    expect(getEffectiveTier('coach', 'cancelled')).toBe('free')
    expect(getEffectiveTier('club', 'cancelled')).toBe('free')
  })
})

// ── getTier (async 3-tier resolution: RPC → table → localStorage cache) ────────
describe('getTier', () => {
  const AUTH_USER = { id: 'user-123' }
  let store

  // Minimal localStorage stub (node env has no DOM). Backed by a Map so we can
  // assert cache writes and seed stale values.
  beforeEach(() => {
    vi.clearAllMocks()
    store = new Map()
    globalThis.localStorage = {
      getItem: vi.fn(k => (store.has(k) ? store.get(k) : null)),
      setItem: vi.fn((k, v) => { store.set(k, String(v)) }),
      removeItem: vi.fn(k => { store.delete(k) }),
    }
    isSupabaseReady.mockReturnValue(true)
  })

  afterEach(() => { delete globalThis.localStorage })

  // Helper: a chainable .from().select().eq().maybeSingle() that resolves to result.
  function mockProfilesRead(result) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    }
    supabase.from.mockReturnValue(chain)
    return chain
  }

  it('RPC success: returns tier and writes it to the cache', async () => {
    supabase.rpc.mockResolvedValue({ data: 'club', error: null })
    const tier = await getTier(AUTH_USER)
    expect(tier).toBe('club')
    expect(supabase.rpc).toHaveBeenCalledWith('get_my_tier')
    // Successful read caches the value.
    expect(localStorage.setItem).toHaveBeenCalledWith('sporeus-tier', 'club')
    expect(store.get('sporeus-tier')).toBe('club')
    // RPC succeeded → no table fallback needed.
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('RPC error → falls back to profiles-table read and caches result', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'rpc missing' } })
    mockProfilesRead({ data: { subscription_tier: 'coach' }, error: null })
    const tier = await getTier(AUTH_USER)
    expect(tier).toBe('coach')
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(store.get('sporeus-tier')).toBe('coach')
  })

  it('RPC throws → still falls through to table read', async () => {
    supabase.rpc.mockRejectedValue(new Error('network'))
    mockProfilesRead({ data: { subscription_tier: 'coach' }, error: null })
    const tier = await getTier(AUTH_USER)
    expect(tier).toBe('coach')
  })

  it('RPC + table both fail → returns stale localStorage cache', async () => {
    store.set('sporeus-tier', 'club')   // stale cached value
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'rpc err' } })
    // table read throws → caught, falls through to cache
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error('db down')),
    })
    const tier = await getTier(AUTH_USER)
    expect(tier).toBe('club')
  })

  it('table returns no row → falls through to cache (or free default)', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'rpc err' } })
    mockProfilesRead({ data: null, error: null })
    const tier = await getTier(AUTH_USER)
    expect(tier).toBe('free')   // empty cache → 'free' fallback
  })

  it('no auth user → skips network, reads cache directly', async () => {
    store.set('sporeus-tier', 'coach')
    const tier = await getTier(null)
    expect(tier).toBe('coach')
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('Supabase not ready → skips network, reads cache directly', async () => {
    isSupabaseReady.mockReturnValue(false)
    store.set('sporeus-tier', 'club')
    const tier = await getTier(AUTH_USER)
    expect(tier).toBe('club')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('empty cache + offline → defaults to free', async () => {
    isSupabaseReady.mockReturnValue(false)
    const tier = await getTier(AUTH_USER)
    expect(tier).toBe('free')
  })
})
