// src/lib/generalFitnessSync.js — Supabase sync for general-fitness track
// Called only when user is authenticated. All functions are no-op when not authed.
import { supabase, isSupabaseReady } from './supabase.js'

/**
 * Push current program state to profiles.general_program so the coach can see it.
 * Silent on error — localStorage is authoritative; Supabase is the share layer.
 */
export async function syncGeneralProgram(userId, program, templateName) {
  if (!userId || !program || !isSupabaseReady()) return
  await supabase.from('profiles').update({
    general_program: {
      template_id:        program.templateId,
      template_name:      templateName ?? null,
      next_day_index:     program.next_day_index   ?? 0,
      sessions_completed: program.sessions_completed ?? 0,
      reference_date:     program.reference_date    ?? null,
      last_session_date:  program.last_session_date ?? null,
    }
  }).eq('id', userId)
}

/**
 * Fetch all general-fitness members linked to this coach.
 * Returns array of profile rows (id, display_name, general_program, confirmed_at/by).
 */
export async function getGeneralMembers(coachId) {
  if (!coachId || !isSupabaseReady()) return []

  const { data: links } = await supabase
    .from('coach_athletes')
    .select('athlete_id')
    .eq('coach_id', coachId)
    .eq('status', 'active')

  const ids = (links ?? []).map(r => r.athlete_id)
  if (!ids.length) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, user_mode, general_program, general_program_confirmed_at, general_program_confirmed_by')
    .in('id', ids)
    .eq('user_mode', 'general')

  return data ?? []
}

/**
 * Coach confirms a member's general-fitness program.
 * Calls the SECURITY DEFINER RPC which validates the coach-athlete link.
 */
export async function confirmGeneralProgram(athleteId) {
  if (!athleteId || !isSupabaseReady()) return { error: 'not_ready' }
  const { error } = await supabase.rpc('coach_confirm_general_program', { p_athlete_id: athleteId })
  return { error }
}
