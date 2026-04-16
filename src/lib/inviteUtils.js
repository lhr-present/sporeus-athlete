// ─── inviteUtils.js — Coach-athlete invite link helpers ───────────────────────
// Pure JS, no external deps, SSR-safe.
// Code format: SP-XXXXXXXX (8 chars from unambiguous alphabet, no 0/O/1/I)

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 32 chars, no 0/O/1/I

/**
 * Generate a branded SP-XXXXXXXX invite code.
 * Uses crypto.getRandomValues — no external deps.
 */
export function generateInviteCode() {
  const buf = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256)
  }
  const chars = Array.from(buf).map(b => ALPHABET[b % ALPHABET.length]).join('')
  return `SP-${chars}`
}

/** @deprecated Use generateInviteCode() — kept for backwards compat */
export const generateInviteToken = generateInviteCode

/**
 * Build a shareable invite URL: https://app.sporeus.com/?invite=SP-XXXXXXXX
 */
export function buildInviteUrl(code) {
  if (typeof window === 'undefined') return ''
  const base = window.location.origin + window.location.pathname
  return `${base}?invite=${encodeURIComponent(code)}`
}

/**
 * Parse the ?invite= param from the current URL. Returns code or null.
 */
export function parseInviteParam() {
  if (typeof window === 'undefined') return null
  try {
    const code = new URLSearchParams(window.location.search).get('invite')
    return code?.trim() || null
  } catch {
    return null
  }
}

/**
 * Create a new invite in Supabase.
 * @param {object} supabaseClient
 * @param {string} coachId
 * @param {{ label?: string, maxUses?: number, expiresAt?: string }} [opts]
 * @returns {{ code, inviteUrl } | { error }}
 */
export async function createInvite(supabaseClient, coachId, opts = {}) {
  try {
    const code = generateInviteCode()
    const row = {
      coach_id:  coachId,
      code,
      label:     opts.label    || null,
      max_uses:  opts.maxUses  || null,
      expires_at: opts.expiresAt || null,
    }
    const { error } = await supabaseClient.from('coach_invites').insert(row)
    if (error) return { error: error.message }
    return { code, inviteUrl: buildInviteUrl(code) }
  } catch (e) {
    return { error: e?.message || 'Unknown error' }
  }
}

/**
 * List all non-revoked invites for a coach.
 * @returns {Array} rows sorted newest-first
 */
export async function listInvites(supabaseClient, coachId) {
  try {
    const { data, error } = await supabaseClient
      .from('coach_invites')
      .select('*')
      .eq('coach_id', coachId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

/**
 * Revoke an invite (sets revoked_at = now()).
 * @returns {{ success: boolean, error?: string }}
 */
export async function revokeInvite(supabaseClient, inviteId) {
  try {
    const { error } = await supabaseClient
      .from('coach_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e?.message || 'Unknown error' }
  }
}

/**
 * Redeem an invite code via the edge function.
 * The edge function derives athlete_id from the JWT — no athlete_id param needed.
 * @returns {{ success, coach_id, coach_name, coach_email } | { success: false, error, code }}
 */
export async function redeemInvite(supabaseClient, code) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session?.access_token) return { success: false, error: 'Not authenticated', code: 'UNAUTHENTICATED' }

    const supabaseUrl = supabaseClient.supabaseUrl
    const res = await fetch(`${supabaseUrl}/functions/v1/redeem-invite`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey':        supabaseClient.supabaseKey,
      },
      body: JSON.stringify({ code }),
    })
    const json = await res.json()
    if (!res.ok) return { success: false, error: json.error, code: json.code }
    return { success: true, ...json }
  } catch (e) {
    return { success: false, error: e?.message || 'Unknown error', code: 'NETWORK_ERROR' }
  }
}

/**
 * Get the coach linked to an athlete (active status only).
 * @returns {string|null} coachId
 */
export async function getMyCoach(supabaseClient, athleteId) {
  try {
    const { data } = await supabaseClient
      .from('coach_athletes')
      .select('coach_id')
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .single()
    return data?.coach_id || null
  } catch {
    return null
  }
}

/**
 * Get all active athlete IDs for a coach.
 * @returns {string[]}
 */
export async function getMyAthletes(supabaseClient, coachId) {
  try {
    const { data } = await supabaseClient
      .from('coach_athletes')
      .select('athlete_id')
      .eq('coach_id', coachId)
      .eq('status', 'active')
    return (data || []).map(r => r.athlete_id)
  } catch {
    return []
  }
}
