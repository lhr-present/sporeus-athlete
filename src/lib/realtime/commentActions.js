// src/lib/realtime/commentActions.js
// E11 — Mutations for session_comments and session_views.
// All writes fall back to the offline write queue when Supabase is unavailable.
// No React dependency — pure async functions.

import { enqueueWrite } from '../offline/writeQueue.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_COMMENTS = 'session_comments'
const TABLE_VIEWS    = 'session_views'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a stable client-side UUID for a new comment's primary key.
 * The session_comments PK is `uuid DEFAULT gen_random_uuid()` — a DEFAULT only
 * applies when no value is supplied, so supplying our own UUID is accepted and
 * the row keeps a stable id across the offline → online boundary. This lets an
 * edit/delete made while still offline replay against a real id instead of a
 * client tempId that matches zero server rows (round-3 fix). Falls back to a
 * v4-shaped string when crypto.randomUUID is unavailable (older webviews/tests).
 */
export function newCommentId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

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
 * Enqueue an offline write without letting an IndexedDB failure escape.
 *
 * When IndexedDB is unavailable (Safari private mode, quota exhausted, blocked
 * upgrade) `enqueueWrite` rejects. If that rejection propagated out of the
 * mutation it would (a) leave the function returning a rejected promise the
 * callers don't await-catch, and (b) strand the optimistic row with the write
 * silently lost. Mirror enqueuePendingLog's swallow-and-report contract:
 * resolve `true` on success, `false` (plus the captured error) on failure so
 * the caller can roll back / surface an inline error instead of throwing.
 *
 * @returns {Promise<{ ok: boolean, error: Error|null }>}
 */
async function safeEnqueueWrite(op, table, payload) {
  try {
    await enqueueWrite(op, table, payload)
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
  }
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
 * @param {string} [id]          - client-supplied PK (UUID). Defaults to a fresh
 *   UUID so the row id is stable across the offline → online boundary; pass the
 *   optimistic row's id so edit/delete on an un-synced comment replays correctly.
 * @returns {Promise<{ data, error, queued }>}
 *   queued=true when the write was stored offline
 */
export async function postComment(supabase, sessionId, authorId, body, parentId = null, id = newCommentId()) {
  const trimmed = (body || '').trim()
  if (!trimmed || trimmed.length > 2000) {
    return { data: null, error: new Error('body must be 1–2000 characters'), queued: false }
  }

  const payload = {
    id,
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
      const { ok, error: enqErr } = await safeEnqueueWrite('insert', TABLE_COMMENTS, payload)
      // IDB unavailable (Safari private mode / quota): can't queue → report the
      // failure so the caller rolls back the optimistic row instead of stranding it.
      return ok ? { data: null, error: null, queued: true } : { data: null, error: enqErr, queued: false }
    }

    return { data, error, queued: false }
  } catch (err) {
    if (isOfflineError(err)) {
      const { ok, error: enqErr } = await safeEnqueueWrite('insert', TABLE_COMMENTS, payload)
      return ok ? { data: null, error: null, queued: true } : { data: null, error: enqErr, queued: false }
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
    return { data: null, error: new Error('body must be 1–2000 characters'), queued: false }
  }

  const patch = { id: commentId, body: trimmed, edited_at: new Date().toISOString() }
  try {
    const { data, error } = await supabase
      .from(TABLE_COMMENTS)
      .update({ body: patch.body, edited_at: patch.edited_at })
      .eq('id', commentId)
      .select()
      .single()

    if (error && isOfflineError(error)) {
      const { ok, error: enqErr } = await safeEnqueueWrite('update', TABLE_COMMENTS, patch)
      return ok ? { data: null, error: null, queued: true } : { data: null, error: enqErr, queued: false }
    }
    return { data, error, queued: false }
  } catch (err) {
    if (isOfflineError(err)) {
      const { ok, error: enqErr } = await safeEnqueueWrite('update', TABLE_COMMENTS, patch)
      return ok ? { data: null, error: null, queued: true } : { data: null, error: enqErr, queued: false }
    }
    return { data: null, error: err, queued: false }
  }
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
  // Soft-delete is an UPDATE, so it replays through the queue's 'update' op.
  const patch = { id: commentId, deleted_at: new Date().toISOString() }
  try {
    const { error } = await supabase
      .from(TABLE_COMMENTS)
      .update({ deleted_at: patch.deleted_at })
      .eq('id', commentId)

    if (error && isOfflineError(error)) {
      const { ok, error: enqErr } = await safeEnqueueWrite('update', TABLE_COMMENTS, patch)
      return ok ? { error: null, queued: true } : { error: enqErr, queued: false }
    }
    return { error, queued: false }
  } catch (err) {
    if (isOfflineError(err)) {
      const { ok, error: enqErr } = await safeEnqueueWrite('update', TABLE_COMMENTS, patch)
      return ok ? { error: null, queued: true } : { error: enqErr, queued: false }
    }
    return { error: err, queued: false }
  }
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
  } catch (err) {
    // View tracking is best-effort: swallow offline errors, but surface a
    // genuine (thrown) server error instead of masking it as success.
    return { error: isOfflineError(err) ? null : err }
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
