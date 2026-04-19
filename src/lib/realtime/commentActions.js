// src/lib/realtime/commentActions.js
// E11 — Mutations for session_comments and session_views.
// All writes fall back to the offline write queue when Supabase is unavailable.
// No React dependency — pure async functions.

import { enqueueWrite } from '../offline/writeQueue.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_COMMENTS = 'session_comments'
const TABLE_VIEWS    = 'session_views'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOfflineError(error) {
  if (!error) return false
  const msg = error.message || ''
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  )
}

// ── Comment mutations ─────────────────────────────────────────────────────────

/**
 * Post a new comment on a session.
 *
 * @param {Object} supabase      - supabase-js client
 * @param {string} sessionId     - training_log.id
 * @param {string} authorId      - profiles.id of the poster
 * @param {string} body          - comment text (1–2000 chars)
 * @param {string|null} parentId - null for top-level; comment id for reply
 * @returns {Promise<{ data, error, queued }>}
 *   queued=true when the write was stored offline
 */
export async function postComment(supabase, sessionId, authorId, body, parentId = null) {
  const trimmed = (body || '').trim()
  if (!trimmed || trimmed.length > 2000) {
    return { data: null, error: new Error('body must be 1–2000 characters'), queued: false }
  }

  const payload = {
    session_id: sessionId,
    author_id:  authorId,
    body:       trimmed,
    ...(parentId ? { parent_id: parentId } : {}),
  }

  try {
    const { data, error } = await supabase
      .from(TABLE_COMMENTS)
      .insert(payload)
      .select()
      .single()

    if (error && isOfflineError(error)) {
      await enqueueWrite('insert', TABLE_COMMENTS, payload)
      return { data: null, error: null, queued: true }
    }

    return { data, error, queued: false }
  } catch (err) {
    if (isOfflineError(err)) {
      await enqueueWrite('insert', TABLE_COMMENTS, payload)
      return { data: null, error: null, queued: true }
    }
    return { data: null, error: err, queued: false }
  }
}

/**
 * Edit an existing comment (author only — enforced by RLS).
 * Sets edited_at to now().
 *
 * @param {Object} supabase
 * @param {string} commentId
 * @param {string} body
 * @returns {Promise<{ data, error }>}
 */
export async function editComment(supabase, commentId, body) {
  const trimmed = (body || '').trim()
  if (!trimmed || trimmed.length > 2000) {
    return { data: null, error: new Error('body must be 1–2000 characters') }
  }

  const { data, error } = await supabase
    .from(TABLE_COMMENTS)
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select()
    .single()

  return { data, error }
}

/**
 * Soft-delete a comment (sets deleted_at; body preserved in DB for audit).
 * RLS only allows the original author to do this.
 *
 * @param {Object} supabase
 * @param {string} commentId
 * @returns {Promise<{ error }>}
 */
export async function deleteComment(supabase, commentId) {
  const { error } = await supabase
    .from(TABLE_COMMENTS)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)

  return { error }
}

// ── Session view tracking ─────────────────────────────────────────────────────

/**
 * Record that a user viewed a session (upsert session_views).
 * Called when the session detail panel opens. No-op if offline.
 *
 * @param {Object} supabase
 * @param {string} sessionId
 * @param {string} userId
 * @returns {Promise<{ error }>}
 */
export async function recordSessionView(supabase, sessionId, userId) {
  if (!supabase || !sessionId || !userId) return { error: null }

  try {
    const { error } = await supabase
      .from(TABLE_VIEWS)
      .upsert(
        { user_id: userId, session_id: sessionId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,session_id' },
      )

    return { error }
  } catch {
    // Silently ignore network errors — view tracking is best-effort
    return { error: null }
  }
}

/**
 * Fetch the most recent session_views for a given session.
 * Returns an array of { user_id, viewed_at } sorted newest first.
 *
 * @param {Object} supabase
 * @param {string} sessionId
 * @returns {Promise<{ data: Array, error }>}
 */
export async function getSessionViews(supabase, sessionId) {
  const { data, error } = await supabase
    .from(TABLE_VIEWS)
    .select('user_id, viewed_at')
    .eq('session_id', sessionId)
    .order('viewed_at', { ascending: false })

  return { data: data || [], error }
}
