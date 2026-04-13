// ─── db/athletes.js — Data access layer for athlete/squad queries ─────────────
// Includes direct table queries and the squad-sync edge function.

import { supabase, isSupabaseReady } from '../supabase.js'

const ready = () => isSupabaseReady() && !!supabase

const NOT_CONFIGURED = { data: null, error: new Error('Supabase not configured') }

/**
 * Fetch squad data via the squad-sync edge function.
 * Authenticates with the current session token automatically.
 */
export async function fetchSquad() {
  if (!ready()) return NOT_CONFIGURED
  const { data: sessionData } = await supabase.auth.getSession()
  return supabase.functions.invoke('squad-sync', {
    headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
  })
}

/** Fetch a single athlete profile by user id */
export async function getAthleteProfile(userId) {
  if (!ready()) return NOT_CONFIGURED
  return supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
}

/** Upsert coach→athlete relationship in coach_athletes */
export async function upsertCoachAthlete(coachId, athleteId, extra = {}) {
  if (!ready()) return NOT_CONFIGURED
  return supabase.from('coach_athletes').upsert({ coach_id: coachId, athlete_id: athleteId, ...extra })
}
