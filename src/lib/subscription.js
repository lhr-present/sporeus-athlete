// ─── subscription.js — Tier-based feature gates ───────────────────────────────
// Pure module (no DOM, no React). Reads from Supabase profiles or localStorage.

import { supabase, isSupabaseReady } from './supabase.js'
import { logger } from './logger.js'

// ── Tier definitions ──────────────────────────────────────────────────────────
export const TIERS = {
  free:  { athletes: 1,   aiCalls: 0,   teams: 0  },
  coach: { athletes: 15,  aiCalls: 50,  teams: 1  },
  club:  { athletes: 999, aiCalls: 500, teams: 10 },
}

// Features gated by tier
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

function tierRank(tier) { return TIER_RANK[tier] ?? 0 }

// ── getTier(authUser) ─────────────────────────────────────────────────────────
// Authoritative source: Supabase RPC get_my_tier() (server-side function).
// Falls back to profiles table read, then localStorage cache.
export async function getTier(authUser) {
  if (authUser && isSupabaseReady()) {
    // 1. Try server-side RPC (reads from DB with SECURITY DEFINER — not bypassable)
    try {
      const { data, error } = await supabase.rpc('get_my_tier')
      if (!error && data) {
        try { localStorage.setItem('sporeus-tier', data) } catch (e) { logger.warn('localStorage:', e.message) }
        return data
      }
    } catch (e) { logger.error('db:', e.message) }
    // 2. Fallback: direct table read
    try {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', authUser.id)
        .maybeSingle()
      if (data?.subscription_tier) {
        try { localStorage.setItem('sporeus-tier', data.subscription_tier) } catch (e) { logger.warn('localStorage:', e.message) }
        return data.subscription_tier
      }
    } catch (e) { logger.error('db:', e.message) }
  }
  // 3. Last resort: localStorage cache (stale, but better than nothing offline)
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

// ── canUploadFile(monthlyCount, tier) → boolean ──────────────────────────────
// Free tier: 5 uploads/month. Coach/Club: unlimited.
export const FREE_UPLOAD_LIMIT = 5

export function canUploadFile(monthlyCount, tier = 'free') {
  if (tier === 'coach' || tier === 'club') return true
  return (monthlyCount ?? 0) < FREE_UPLOAD_LIMIT
}

// ── getUpgradePrompt(feature) → string ───────────────────────────────────────
export function getUpgradePrompt(feature) {
  const msgs = {
    multi_team:         'Multi-team management requires a Coach plan. Upgrade at sporeus.com.',
    export_pdf:         'PDF season reports require a Coach plan. Upgrade at sporeus.com.',
    api_access:         'Public API access requires a Club plan. Upgrade at sporeus.com.',
    white_label:        'White-label branding requires a Club plan. Upgrade at sporeus.com.',
    realtime_dashboard: 'Real-time dashboard requires a Coach plan. Upgrade at sporeus.com.',
    upload_files:         'Free plan allows 5 file uploads/month. Upgrade to Coach for unlimited uploads.',
    semantic_search:      'Semantic session search requires a Coach or Club plan. Upgrade at sporeus.com.',
    squad_pattern_search: 'Squad pattern search requires a Coach or Club plan. Upgrade at sporeus.com.',
  }
  return msgs[feature] || 'This feature requires an upgraded plan. Visit sporeus.com to upgrade.'
}
