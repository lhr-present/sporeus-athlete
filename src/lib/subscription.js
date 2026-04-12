// ─── subscription.js — Tier-based feature gates ───────────────────────────────
// Pure module (no DOM, no React). Reads from Supabase profiles or localStorage.

import { supabase, isSupabaseReady } from './supabase.js'

// ── Tier definitions ──────────────────────────────────────────────────────────
export const TIERS = {
  free:  { athletes: 1,   aiCalls: 0,   teams: 0  },
  coach: { athletes: 15,  aiCalls: 50,  teams: 1  },
  club:  { athletes: 999, aiCalls: 500, teams: 10 },
}

// Features gated by tier
const FEATURE_TIERS = {
  multi_team:         'coach',
  export_pdf:         'coach',
  api_access:         'club',
  white_label:        'club',
  realtime_dashboard: 'coach',
}

const TIER_RANK = { free: 0, coach: 1, club: 2 }

function tierRank(tier) { return TIER_RANK[tier] ?? 0 }

// ── getTier(authUser) ─────────────────────────────────────────────────────────
// Reads from profiles.subscription_tier → localStorage fallback → 'free'
export async function getTier(authUser) {
  if (authUser && isSupabaseReady()) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', authUser.id)
        .maybeSingle()
      if (data?.subscription_tier) {
        try { localStorage.setItem('sporeus-tier', data.subscription_tier) } catch {}
        return data.subscription_tier
      }
    } catch {}
  }
  try { return localStorage.getItem('sporeus-tier') || 'free' } catch { return 'free' }
}

// ── getTierSync — reads localStorage only (for synchronous gate checks) ────────
export function getTierSync() {
  try { return localStorage.getItem('sporeus-tier') || 'free' } catch { return 'free' }
}

// ── canAddAthlete(currentCount, tier) → boolean ───────────────────────────────
export function canAddAthlete(currentCount, tier = 'free') {
  const limit = TIERS[tier]?.athletes ?? 1
  return currentCount < limit
}

// ── canUseAI(dailyCallCount, tier) → boolean ──────────────────────────────────
export function canUseAI(dailyCallCount, tier = 'free') {
  const limit = TIERS[tier]?.aiCalls ?? 0
  return limit > 0 && dailyCallCount < limit
}

// ── getRemainingAICalls(used, tier) → number ──────────────────────────────────
export function getRemainingAICalls(used, tier = 'free') {
  const limit = TIERS[tier]?.aiCalls ?? 0
  return Math.max(0, limit - used)
}

// ── isFeatureGated(feature, tier) → boolean (true = gated/blocked) ────────────
export function isFeatureGated(feature, tier = 'free') {
  const required = FEATURE_TIERS[feature]
  if (!required) return false   // unknown feature = open
  return tierRank(tier) < tierRank(required)
}

// ── getUpgradePrompt(feature) → string ───────────────────────────────────────
export function getUpgradePrompt(feature) {
  const msgs = {
    multi_team:         'Multi-team management requires a Coach plan. Upgrade at sporeus.com.',
    export_pdf:         'PDF season reports require a Coach plan. Upgrade at sporeus.com.',
    api_access:         'Public API access requires a Club plan. Upgrade at sporeus.com.',
    white_label:        'White-label branding requires a Club plan. Upgrade at sporeus.com.',
    realtime_dashboard: 'Real-time dashboard requires a Coach plan. Upgrade at sporeus.com.',
  }
  return msgs[feature] || 'This feature requires an upgraded plan. Visit sporeus.com to upgrade.'
}
