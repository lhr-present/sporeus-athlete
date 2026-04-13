// ─── db/messages.js — Data access layer for the messages table ────────────────
// All message-domain Supabase queries live here.
// Components import from here — never from lib/supabase.js directly.

import { supabase, isSupabaseReady } from '../supabase.js'

const ready = () => isSupabaseReady() && !!supabase

const NOT_CONFIGURED = { data: null, error: new Error('Supabase not configured') }

/** Deterministic Realtime channel name for a coach↔athlete pair */
export const buildChannelId = (coachId, athleteId) => `msg-${coachId}-${athleteId}`

/** Load message history for a coach↔athlete thread (100 most recent, oldest first) */
export async function getMessages(coachId, athleteId) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('messages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .order('sent_at', { ascending: true })
    .limit(100)
}

/** Mark a single message as read by its id */
export async function markReadById(msgId) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', msgId)
}

/** Mark multiple messages as read by ids array */
export async function markReadMany(ids) {
  if (!ready() || !ids.length) return { data: null, error: null }
  return supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
}

/** Insert a new message (coach → athlete) */
export async function insertMessage({ coachId, athleteId, encryptedBody }) {
  if (!ready()) return NOT_CONFIGURED
  return supabase.from('messages').insert({
    coach_id:    coachId,
    athlete_id:  athleteId,
    sender_role: 'coach',
    body:        encryptedBody,
  })
}

/**
 * Subscribe to new messages for a coach↔athlete pair.
 * Returns the Supabase Realtime channel (call .unsubscribe() on cleanup).
 * @param {string}   coachId
 * @param {string}   athleteId
 * @param {Function} onInsert — called with the raw Postgres payload
 */
export function subscribeToMessages(coachId, athleteId, onInsert) {
  if (!ready()) return null
  return supabase
    .channel(buildChannelId(coachId, athleteId))
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'messages',
      filter: `coach_id=eq.${coachId}`,
    }, onInsert)
    .subscribe()
}
