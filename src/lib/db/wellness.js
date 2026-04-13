// ─── db/wellness.js — Data access layer for the recovery (wellness) table ─────
// All wellness/recovery-domain Supabase queries live here.

import { supabase, isSupabaseReady } from '../supabase.js'

const ready = () => isSupabaseReady() && !!supabase

const NOT_CONFIGURED = { data: null, error: new Error('Supabase not configured') }

/** Fetch wellness logs for one athlete, most recent first */
export async function getWellnessLogs(userId, days = 90) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('recovery')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(days)
}

/** Fetch wellness logs for multiple athletes since a given date */
export async function getWellnessLogsForAthletes(userIds, sinceDate) {
  if (!ready() || !userIds.length) return { data: null, error: null }
  return supabase
    .from('recovery')
    .select('*')
    .in('user_id', userIds)
    .gte('date', sinceDate)
}

/** Upsert a single wellness entry (conflict on user_id, date) */
export async function upsertWellnessEntry(entry) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('recovery')
    .upsert(entry, { onConflict: 'user_id,date' })
}
