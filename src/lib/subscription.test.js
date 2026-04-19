import { describe, it, expect, vi } from 'vitest'
import {
  TIERS, canAddAthlete, canUseAI, getRemainingAICalls,
  isFeatureGated, getUpgradePrompt, canUploadFile, FREE_UPLOAD_LIMIT,
  isOnTrial, isPastDue, isCancelled, isExpired, daysUntilExpiry,
} from './subscription.js'

vi.mock('./supabase.js', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() })) },
  isSupabaseReady: vi.fn(() => false),
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
  it('unknown feature is open', () => expect(isFeatureGated('nonexistent', 'free')).toBe(false))
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
