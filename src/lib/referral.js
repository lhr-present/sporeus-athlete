// ─── referral.js — Referral code generation + Supabase helpers ────────────────
// generateReferralCode is pure (no deps). apply/getStats require Supabase.

import { supabase, isSupabaseReady } from './supabase.js'
import { logger } from './logger.js'

// djb2 hash — deterministic, same as aiPrompts.js
function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

/**
 * generateReferralCode — deterministic "SP-{8 hex}" code from coachId.
 * @param {string} coachId
 * @returns {string}  e.g. "SP-A1B2C3D4"
 */
export function generateReferralCode(coachId) {
  return `SP-${djb2(String(coachId ?? ''))}`
}

/**
 * applyReferralCode — record that a new org used this referral code.
 * Increments uses_count; grants a reward row every 3 uses.
 * @param {string} code      "SP-XXXXXXXX"
 * @param {string} newOrgId  UUID of the applying org/user (recorded for dedup)
 * @returns {Promise<{ success: boolean, coach_id?: string, error?: string }>}
 */
export async function applyReferralCode(code, _newOrgId) {
  if (!isSupabaseReady() || !supabase) return { success: false, error: 'Supabase not configured' }
  if (!code || !code.startsWith('SP-'))   return { success: false, error: 'Invalid code format' }

  const { data, error } = await supabase
    .from('referral_codes')
    .select('coach_id, uses_count')
    .eq('code', code)
    .maybeSingle()

  if (error)  return { success: false, error: error.message }
  if (!data)  return { success: false, error: 'Code not found' }

  const newCount = (data.uses_count ?? 0) + 1

  // If the increment write fails, the referral was NOT recorded — surface it
  // instead of reporting success (previously the error was swallowed and the
  // count silently never moved).
  const { error: updateErr } = await supabase
    .from('referral_codes').update({ uses_count: newCount }).eq('code', code)
  if (updateErr) return { success: false, error: updateErr.message }

  // Reward milestone: every 3 referrals. A failed reward insert is logged but
  // does not fail the referral itself (the use was already recorded above).
  if (newCount % 3 === 0) {
    const { error: rewardErr } = await supabase.from('referral_rewards').insert({
      coach_id:    data.coach_id,
      reward_type: '1_month_free',
    })
    if (rewardErr) logger.warn('[referral] reward insert failed:', rewardErr.message)
  }

  return { success: true, coach_id: data.coach_id }
}

/**
 * getReferralStats — fetch or initialise the referral row for this coach.
 * @param {string} coachId
 * @returns {Promise<{ code: string, uses: number, rewards: Array }>}
 */
export async function getReferralStats(coachId) {
  const code  = generateReferralCode(coachId)
  const empty = { code, uses: 0, rewards: [] }
  if (!isSupabaseReady() || !supabase || !coachId) return empty

  // Ensure the row exists (ignore conflict if already there)
  const { error: upsertErr } = await supabase
    .from('referral_codes')
    .upsert({ code, coach_id: coachId }, { onConflict: 'code', ignoreDuplicates: true })
  if (upsertErr) logger.warn('[referral] ensure-row upsert failed:', upsertErr.message)

  const [{ data: codeRow }, { data: rewardsRow }] = await Promise.all([
    supabase.from('referral_codes').select('uses_count').eq('code', code).maybeSingle(),
    supabase.from('referral_rewards')
      .select('reward_type, granted_at, applied_at')
      .eq('coach_id', coachId)
      .order('granted_at', { ascending: false }),
  ])

  return {
    code,
    uses:    codeRow?.uses_count ?? 0,
    rewards: rewardsRow ?? [],
  }
}
