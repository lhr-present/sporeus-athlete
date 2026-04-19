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
    multi_team:           'Managing multiple teams requires a Coach plan. Start your free 14-day trial.',
    export_pdf:           'PDF season reports require a Coach plan. Try Coach free for 14 days.',
    api_access:           'API access is a Club feature. Upgrade to Club for full integration capabilities.',
    white_label:          'White-label branding is a Club feature. Remove the Sporeus branding for your athletes.',
    realtime_dashboard:   'Live squad dashboard requires a Coach plan. See every athlete in real time.',
    upload_files:         'Free plan: 5 uploads/month. Upgrade to Coach for unlimited FIT/GPX uploads.',
    semantic_search:      'Semantic AI search requires a Coach plan. Find any session by meaning, not just date.',
    squad_pattern_search: 'Squad pattern analysis requires a Coach plan. Detect overtraining across your whole squad.',
    debug_realtime_stats: 'Real-time diagnostics require a Coach plan.',
  }
  return msgs[feature] || 'This feature requires an upgraded plan. Start a free 14-day Coach trial.'
}

// ── getCheckoutUrl(tier, lang) → string | null ────────────────────────────────
// Returns the checkout URL for the given tier + locale.
// Dodo for TR (TRY pricing), Stripe for international (EUR/USD).
export function getCheckoutUrl(tier = 'coach', lang = 'tr') {
  const isDodo = lang === 'tr'
  if (tier === 'coach') {
    return isDodo
      ? (import.meta.env?.VITE_DODO_CHECKOUT_COACH   || null)
      : (import.meta.env?.VITE_STRIPE_CHECKOUT_COACH || null)
  }
  if (tier === 'club') {
    return isDodo
      ? (import.meta.env?.VITE_DODO_CHECKOUT_CLUB    || null)
      : (import.meta.env?.VITE_STRIPE_CHECKOUT_CLUB  || null)
  }
  return null
}

// ── Status predicates — read from profile object ──────────────────────────────

// isOnTrial: user is in the 14-day free trial period
export function isOnTrial(profile) {
  if (!profile) return false
  return (
    profile.subscription_status === 'trialing' &&
    profile.trial_ends_at != null &&
    new Date(profile.trial_ends_at) > new Date()
  )
}

// isPastDue: payment failed, 3-day grace period active
export function isPastDue(profile) {
  if (!profile) return false
  return profile.subscription_status === 'past_due'
}

// isCancelled: cancelled but still within paid period
export function isCancelled(profile) {
  if (!profile) return false
  return (
    profile.subscription_status === 'cancelled' &&
    profile.subscription_end_date != null &&
    new Date(profile.subscription_end_date) > new Date()
  )
}

// isExpired: subscription has lapsed — on free or status=expired
export function isExpired(profile) {
  if (!profile) return true
  return (
    profile.subscription_status === 'expired' ||
    profile.subscription_tier   === 'free'
  )
}

// daysUntilExpiry: days remaining in trial / paid period / grace period
export function daysUntilExpiry(profile) {
  if (!profile) return 0
  const cutoff =
    profile.subscription_status === 'trialing'  ? profile.trial_ends_at        :
    profile.subscription_status === 'past_due'  ? profile.grace_period_ends_at :
    profile.subscription_status === 'cancelled' ? profile.subscription_end_date :
    profile.subscription_expires_at
  if (!cutoff) return 0
  const ms = new Date(cutoff).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}
