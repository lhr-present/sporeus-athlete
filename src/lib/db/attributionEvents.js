// ─── db/attributionEvents.js — Read user's own Mission-1 funnel events ───────
//
// v9.99.0 (Prompt J) — surfaces the chronological sequence of attribution
// events that emitEvent() (lib/attribution.js) writes to the
// `attribution_events` table for the signed-in user.
//
// RLS on the table scopes reads to `auth.uid() = user_id` (see migration
// 20260430_attribution.sql:42), so this fetch is safe to call as the
// authenticated user — no service_role needed.
//
// Only events that flowed through emitEvent() with a user_id will appear
// here. Anonymous landing events have user_id=null and are filtered out
// by RLS.

import { supabase, isSupabaseReady } from '../supabase.js'

const ready = () => isSupabaseReady() && !!supabase

const NOT_CONFIGURED = { data: null, error: new Error('Supabase not configured') }

// The Mission-1 milestone events we surface in the timeline. Other
// attribution events (utm_landing, generic page views, etc.) are filtered
// out client-side so the timeline stays focused on chain progression.
export const MISSION_1_EVENTS = [
  'signup_completed',
  'first_session_logged',
  'first_week_completed',
  'starter_plan_seeded',
]

/**
 * @description Fetch the user's own attribution events ordered oldest→newest.
 *   Returns rows from the `attribution_events` table. RLS guarantees
 *   only the caller's own rows are returned.
 *
 * @param {string} userId - the auth.uid() of the caller
 * @param {number} [limit=200] - max events to return (most users will have <20)
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getUserAttributionEvents(userId, limit = 200) {
  if (!ready()) return NOT_CONFIGURED
  if (!userId) return { data: null, error: new Error('userId required') }
  return supabase
    .from('attribution_events')
    .select('id, event_name, props, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)
}

/**
 * @description Filter raw attribution events down to the Mission-1 timeline
 *   we want to surface to the athlete. Pure function — no I/O.
 *
 * @param {Array} events - rows from getUserAttributionEvents
 * @returns {Array} subset matching MISSION_1_EVENTS, oldest→newest
 */
export function filterMissionTimelineEvents(events) {
  if (!Array.isArray(events)) return []
  return events.filter(e => MISSION_1_EVENTS.includes(e.event_name))
}
