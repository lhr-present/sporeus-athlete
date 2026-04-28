// src/lib/generalFitnessSync.js — Supabase sync for general-fitness track
// Called only when user is authenticated. All functions are no-op when not authed.
import { supabase, isSupabaseReady } from './supabase.js'

/**
 * Push current program state to profiles.general_program so the coach can see it.
 * When sessionSummary is provided (after a session save), also sets last_workout_done_at.
 * Silent on error — localStorage is authoritative; Supabase is the share layer.
 *
 * @param {string|null} userId
 * @param {object} program
 * @param {string|null} templateName
 * @param {{ last_session_label?: string, last_session_exercise_count?: number, last_session_duration_minutes?: number|null }|null} sessionSummary
 */
export async function syncGeneralProgram(userId, program, templateName, sessionSummary = null) {
  if (!userId || !program || !isSupabaseReady() || !navigator.onLine) return
  const update = {
    general_program: {
      template_id:                    program.templateId,
      template_name:                  templateName ?? null,
      next_day_index:                 program.next_day_index        ?? 0,
      sessions_completed:             program.sessions_completed    ?? 0,
      reference_date:                 program.reference_date        ?? null,
      last_session_date:              program.last_session_date     ?? null,
      last_session_label:             sessionSummary?.last_session_label             ?? null,
      last_session_exercise_count:    sessionSummary?.last_session_exercise_count    ?? null,
      last_session_duration_minutes:  sessionSummary?.last_session_duration_minutes  ?? null,
    }
  }
  if (sessionSummary) {
    update.last_workout_done_at = new Date().toISOString()
  }
  const { error } = await supabase.from('profiles').update(update).eq('id', userId)
  if (error) console.warn('syncGeneralProgram failed:', error.message)
}

// ── Coach queries ─────────────────────────────────────────────────────────────

async function fetchLinkedAthletes(coachId) {
  const { data: links } = await supabase
    .from('coach_athletes')
    .select('athlete_id, coach_verified_at, coach_verified_note')
    .eq('coach_id', coachId)
    .eq('status', 'active')
  return links ?? []
}

function makeVerifiedMap(links) {
  return Object.fromEntries(
    links.map(r => [r.athlete_id, {
      coach_verified_at:   r.coach_verified_at   ?? null,
      coach_verified_note: r.coach_verified_note ?? '',
    }])
  )
}

/**
 * Fetch all general-fitness members (user_mode='general') linked to this coach.
 * Returns profile rows merged with per-link coach_verified_at.
 */
export async function getGeneralMembers(coachId) {
  if (!coachId || !isSupabaseReady()) return []

  const links = await fetchLinkedAthletes(coachId)
  const ids   = links.map(r => r.athlete_id)
  if (!ids.length) return []

  const verifiedMap = makeVerifiedMap(links)

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, user_mode, general_program, general_program_confirmed_at, last_workout_done_at')
    .in('id', ids)
    .eq('user_mode', 'general')

  return (data ?? []).map(p => ({ ...p, ...(verifiedMap[p.id] ?? {}) }))
}

/**
 * Fetch all endurance/sport athletes (user_mode != 'general' OR null) linked to this coach.
 * Returns profile rows merged with per-link coach_verified_at.
 */
export async function getEnduranceMembers(coachId) {
  if (!coachId || !isSupabaseReady()) return []

  const links = await fetchLinkedAthletes(coachId)
  const ids   = links.map(r => r.athlete_id)
  if (!ids.length) return []

  const verifiedMap = makeVerifiedMap(links)

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, user_mode, last_workout_done_at')
    .in('id', ids)
    .or('user_mode.neq.general,user_mode.is.null')

  return (data ?? []).map(p => ({ ...p, ...(verifiedMap[p.id] ?? {}) }))
}

// ── Coach confirm / verify ────────────────────────────────────────────────────

/**
 * Coach confirms a GF member's program (one-time plan approval).
 * Calls SECURITY DEFINER RPC `coach_confirm_general_program`.
 */
export async function confirmGeneralProgram(athleteId) {
  if (!athleteId || !isSupabaseReady()) return { error: 'not_ready' }
  const { error } = await supabase.rpc('coach_confirm_general_program', { p_athlete_id: athleteId })
  return { error }
}

/**
 * Coach marks that they've reviewed an athlete's recent sessions.
 * Works for both GF and endurance athletes.
 * Calls SECURITY DEFINER RPC `coach_verify_athlete`.
 */
export async function verifyAthlete(athleteId, note = '') {
  if (!athleteId || !isSupabaseReady()) return { error: 'not_ready' }
  const { error } = await supabase.rpc('coach_verify_athlete', { p_athlete_id: athleteId, p_note: note })
  return { error }
}
