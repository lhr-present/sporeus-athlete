import { describe, it, expect, vi } from 'vitest'
import { TIERS, canAddAthlete, canUseAI, getRemainingAICalls, isFeatureGated, getUpgradePrompt } from './subscription.js'

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
})
