// ─── db/sessions.js — Data access layer for the training_log table ────────────
// All training-session-domain Supabase queries live here.

import { supabase, isSupabaseReady } from '../supabase.js'

const ready = () => isSupabaseReady() && !!supabase

const NOT_CONFIGURED = { data: null, error: new Error('Supabase not configured') }

/** Fetch training sessions for one athlete, most recent first */
export async function getTrainingSessions(userId, days = 365) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('training_log')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(days)
}

/** Fetch training sessions for multiple athletes since a given date */
export async function getSessionsForAthletes(userIds, sinceDate) {
  if (!ready() || !userIds.length) return { data: null, error: null }
  return supabase
    .from('training_log')
    .select('*')
    .in('user_id', userIds)
    .gte('date', sinceDate)
}

/** Upsert a single session (conflict on user_id, date, source) */
export async function upsertSession(session) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('training_log')
    .upsert(session, { onConflict: 'user_id,date,source' })
}
