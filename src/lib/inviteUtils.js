// ─── inviteUtils.js — Coach-athlete invite link helpers ───────────────────────
// Pure JS, no external deps, SSR-safe (window checks throughout).
// Schema: coach_invites.code (not token), used_by uuid (single-use)

/**
 * Generate a 16-character lowercase hex string for use as an invite code.
 * Uses crypto.getRandomValues — no external deps.
 */
export function generateInviteToken() {
  const buf = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    // Fallback for environments without crypto (test mocking)
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build a shareable invite URL with ?invite=CODE param.
 * SSR-safe: returns empty string if window is unavailable.
 */
export function buildInviteUrl(code) {
  if (typeof window === 'undefined') return ''
  const base = window.location.origin + window.location.pathname
  return `${base}?invite=${encodeURIComponent(code)}`
}

/**
 * Parse the ?invite= param from the current URL.
 * Returns the code string if present and non-empty, else null.
 * SSR-safe.
 */
export function parseInviteParam() {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('invite')
    return code && code.trim() ? code.trim() : null
  } catch {
    return null
  }
}

/**
 * Create a new invite in Supabase.
 * Generates a code client-side, inserts into coach_invites.
 * Returns { code, inviteUrl } on success, { error } on failure.
 */
export async function createInvite(supabaseClient, coachId) {
  try {
    const code = generateInviteToken()
    const { error } = await supabaseClient
      .from('coach_invites')
      .insert({ coach_id: coachId, code })
    if (error) return { error: error.message }
    return { code, inviteUrl: buildInviteUrl(code) }
  } catch (e) {
    return { error: e?.message || 'Unknown error' }
  }
}

/**
 * Redeem an invite code on behalf of an athlete.
 * Validates: code exists, not expired, not already used.
 * On success: upserts coach_athletes row, marks invite used_by.
 * Returns { success: true, coachId, coachName } or { success: false, error }.
 * Never throws.
 */
export async function redeemInvite(supabaseClient, code, athleteId) {
  try {
    // Look up invite
    const { data: invite, error: fetchErr } = await supabaseClient
      .from('coach_invites')
      .select('id, coach_id, expires_at, used_by, code')
      .eq('code', code)
      .single()
    if (fetchErr || !invite) return { success: false, error: 'Invalid invite code' }
    if (invite.used_by)                               return { success: false, error: 'Invite already used' }
    if (new Date(invite.expires_at) < new Date())     return { success: false, error: 'Invite expired' }

    // Fetch coach name
    const { data: coachProfile } = await supabaseClient
      .from('profiles')
      .select('display_name')
      .eq('id', invite.coach_id)
      .single()
    const coachName = coachProfile?.display_name || 'Coach'

    // Link athlete to coach
    const { error: linkErr } = await supabaseClient
      .from('coach_athletes')
      .upsert({ coach_id: invite.coach_id, athlete_id: athleteId, status: 'active' },
               { onConflict: 'coach_id,athlete_id' })
    if (linkErr) return { success: false, error: linkErr.message }

    // Mark invite as used
    await supabaseClient
      .from('coach_invites')
      .update({ used_by: athleteId })
      .eq('code', code)

    return { success: true, coachId: invite.coach_id, coachName }
  } catch (e) {
    return { success: false, error: e?.message || 'Unknown error' }
  }
}

/**
 * Get the coach linked to an athlete (active status only).
 * Returns coachId string or null.
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
 * Returns array of athlete_id strings (empty array if none).
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
