// src/lib/coach/realtimeMessages.js
// v9.133 — DB-backed coach<->athlete messaging.
// Replaces the v6-era file-based JSON export/import flow (see CLAUDE.md
// "Known Limitations"). Pure async functions — supabase passed as a
// parameter so the module stays trivially testable.
//
// All RLS checks live in 20260480_coach_messages.sql: the SELECT/INSERT
// policies require auth.uid() to match the sender side AND the
// (coach_id, athlete_id) pair to exist in coach_athletes. UPDATE is
// restricted to the recipient marking messages read.

import { enqueueWrite } from '../offline/writeQueue.js'

const TABLE = 'coach_messages'
const MAX_BODY = 4000
const DEFAULT_LIMIT = 100

function isOfflineError(error) {
  if (!error) return false
  const msg = error.message || ''
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  )
}

/**
 * Fetch the thread between a coach and an athlete in chronological order
 * (oldest first — UI scrolls bottom-anchored, so chronological reads
 * cleaner than reverse + reverse-in-render).
 *
 * @param {Object} supabase
 * @param {string} coachId
 * @param {string} athleteId
 * @param {number} limit  - cap most-recent N messages (default 100)
 * @returns {Promise<{ data: Array, error }>}
 */
export async function fetchMessages(supabase, coachId, athleteId, limit = DEFAULT_LIMIT) {
  if (!supabase || !coachId || !athleteId) {
    return { data: [], error: new Error('supabase, coachId, athleteId required') }
  }

  // Pull DESC + slice, then re-sort ASC for render. The thread index is
  // (coach_id, athlete_id, created_at DESC) — DESC + LIMIT is the fast
  // path; ASC would force a sort over the whole partition.
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, coach_id, athlete_id, sender, body, created_at, read_at')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error }

  const rows = (data || []).slice().reverse()
  return { data: rows, error: null }
}

/**
 * Send a message. Sender must be 'coach' or 'athlete' and match the
 * authenticated user's role in the (coach_id, athlete_id) pair — RLS
 * enforces this; we validate locally for fast-fail UX.
 *
 * @param {Object} supabase
 * @param {string} coachId
 * @param {string} athleteId
 * @param {'coach'|'athlete'} sender
 * @param {string} body
 * @returns {Promise<{ data, error, queued }>}
 */
export async function sendMessage(supabase, coachId, athleteId, sender, body) {
  if (!supabase || !coachId || !athleteId) {
    return { data: null, error: new Error('supabase, coachId, athleteId required'), queued: false }
  }
  if (sender !== 'coach' && sender !== 'athlete') {
    return { data: null, error: new Error('sender must be "coach" or "athlete"'), queued: false }
  }

  const trimmed = (body || '').trim()
  if (!trimmed || trimmed.length > MAX_BODY) {
    return { data: null, error: new Error(`body must be 1–${MAX_BODY} characters`), queued: false }
  }

  const payload = {
    coach_id:   coachId,
    athlete_id: athleteId,
    sender,
    body: trimmed,
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single()

    if (error && isOfflineError(error)) {
      await enqueueWrite('insert', TABLE, payload)
      return { data: null, error: null, queued: true }
    }

    return { data, error, queued: false }
  } catch (err) {
    if (isOfflineError(err)) {
      await enqueueWrite('insert', TABLE, payload)
      return { data: null, error: null, queued: true }
    }
    return { data: null, error: err, queued: false }
  }
}

/**
 * Mark a batch of messages as read. RLS restricts this to the recipient
 * (coach can only mark athlete-sent messages; athlete can only mark
 * coach-sent ones). Best-effort: callers shouldn't block UI on this.
 *
 * @param {Object} supabase
 * @param {string[]} ids
 * @returns {Promise<{ count: number, error }>}
 */
export async function markReadByIds(supabase, ids) {
  if (!supabase || !Array.isArray(ids) || ids.length === 0) {
    return { count: 0, error: null }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null)
    .select('id')

  if (error) return { count: 0, error }
  return { count: (data || []).length, error: null }
}

/**
 * Count unread messages addressed to the given side of the thread.
 * Used by inbox badges. `viewerSide` is the side calling (coach or
 * athlete); the other side's messages are the unread ones to count.
 *
 * @param {Object} supabase
 * @param {string} coachId
 * @param {string} athleteId
 * @param {'coach'|'athlete'} viewerSide
 * @returns {Promise<{ count: number, error }>}
 */
export async function countUnread(supabase, coachId, athleteId, viewerSide) {
  if (!supabase || !coachId || !athleteId) {
    return { count: 0, error: new Error('supabase, coachId, athleteId required') }
  }
  if (viewerSide !== 'coach' && viewerSide !== 'athlete') {
    return { count: 0, error: new Error('viewerSide must be "coach" or "athlete"') }
  }

  const otherSide = viewerSide === 'coach' ? 'athlete' : 'coach'

  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .eq('sender', otherSide)
    .is('read_at', null)

  if (error) return { count: 0, error }
  return { count: count || 0, error: null }
}

export const __MAX_BODY = MAX_BODY
