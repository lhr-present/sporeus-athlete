// src/hooks/useSessionComments.js
// E11 — Per-session comment thread hook with optimistic updates.
//
// Manages:
//   • Initial fetch of existing comments
//   • Realtime subscription for INSERT/UPDATE (session_comments)
//   • Optimistic insert (tempId) — reconciled on Realtime echo or error
//   • Soft-delete: deleted rows show as [deleted] placeholder
//   • Presence: who else has this session open
//   • session_views upsert on mount (drives CoachPresenceBadge)

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { computeBackoff }       from '../lib/realtimeBackoff.js'
import { reportStatus, removeStatus } from '../lib/realtimeStatus.js'
import {
  postComment   as dbPostComment,
  editComment   as dbEditComment,
  deleteComment as dbDeleteComment,
  recordSessionView,
} from '../lib/realtime/commentActions.js'

const MAX_RETRY = 6

/**
 * @param {string|null} sessionId    — training_log.id; null = skip
 * @param {string|null} currentUserId — auth.uid()
 * @returns {{
 *   comments:    Array,
 *   status:      string,
 *   typingUsers: string[],
 *   postComment:   (body: string, parentId?: string) => Promise<{queued: boolean}>,
 *   editComment:   (commentId: string, body: string) => Promise<void>,
 *   deleteComment: (commentId: string) => Promise<void>,
 * }}
 */
export function useSessionComments(sessionId, currentUserId) {
  const [comments,    setComments]    = useState([])
  const [status,      setStatus]      = useState('disconnected')
  const [typingUsers, setTypingUsers] = useState([])

  const channelRef  = useRef(null)
  const retryRef    = useRef(0)
  const timerRef    = useRef(null)
  const statusKey   = sessionId ? `session-comments-${sessionId}` : null

  // ── Apply a realtime payload to local comments state ─────────────────────────

  const applyPayload = useCallback(({ eventType, new: next, old }) => {
    if (eventType === 'INSERT') {
      setComments(prev => {
        // Reconcile optimistic row by tempId stored in body (not ideal) or just append
        const exists = prev.some(c => c.id === next.id)
        if (exists) return prev
        // Remove matching optimistic row (same session_id + author_id + body)
        const withoutOptimistic = prev.filter(c =>
          !(c._optimistic && c.session_id === next.session_id &&
            c.author_id === next.author_id && c.body === next.body)
        )
        return [...withoutOptimistic, next].sort(byCreatedAt)
      })
    } else if (eventType === 'UPDATE') {
      setComments(prev => prev.map(c => c.id === next.id ? { ...c, ...next } : c))
    } else if (eventType === 'DELETE') {
      // soft-delete: UPDATE sets deleted_at — hard DELETE shouldn't happen via RLS
      setComments(prev => prev.filter(c => c.id !== old.id))
    }
  }, [])

  // ── Initial fetch ─────────────────────────────────────────────────────────────

  async function fetchComments() {
    if (!sessionId || !isSupabaseReady()) return
    const { data } = await supabase
      .from('session_comments')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  // ── Realtime subscription ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || !isSupabaseReady()) return

    fetchComments()
    recordSessionView(supabase, sessionId, currentUserId)

    let active = true
    retryRef.current = 0

    function subscribe() {
      if (!active) return

      reportStatus(statusKey, 'connecting')
      setStatus('connecting')

      const ch = supabase.channel(`session:${sessionId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'session_comments',
            filter: `session_id=eq.${sessionId}` },
          payload => { if (active) applyPayload(payload) },
        )
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (!active || !payload?.userId) return
          const uid = payload.userId
          setTypingUsers(prev => {
            if (payload.isTyping) return prev.includes(uid) ? prev : [...prev, uid]
            return prev.filter(id => id !== uid)
          })
        })
        .subscribe(s => {
          if (!active) return
          if (s === 'SUBSCRIBED') {
            retryRef.current = 0
            reportStatus(statusKey, 'live')
            setStatus('live')
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
            reportStatus(statusKey, 'reconnecting')
            setStatus('reconnecting')
            if (retryRef.current < MAX_RETRY) {
              const delay = computeBackoff(retryRef.current++)
              timerRef.current = setTimeout(() => {
                if (!active) return
                try { supabase.removeChannel(ch) } catch { /* ignore */ }
                channelRef.current = null
                subscribe()
              }, delay)
            } else {
              reportStatus(statusKey, 'disconnected')
              setStatus('disconnected')
            }
          } else if (s === 'CLOSED') {
            if (active) {
              reportStatus(statusKey, 'disconnected')
              setStatus('disconnected')
            }
          }
        })

      channelRef.current = ch
    }

    subscribe()

    return () => {
      active = false
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current) } catch { /* ignore */ }
        channelRef.current = null
      }
      if (statusKey) removeStatus(statusKey)
    }
  }, [sessionId, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations with optimistic updates ────────────────────────────────────────

  const postComment = useCallback(async (body, parentId = null) => {
    if (!sessionId || !currentUserId) return { queued: false }

    const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic = {
      id:         tempId,
      session_id: sessionId,
      author_id:  currentUserId,
      parent_id:  parentId,
      body,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }

    setComments(prev => [...prev, optimistic].sort(byCreatedAt))

    const { data, error, queued } = await dbPostComment(supabase, sessionId, currentUserId, body, parentId)

    if (error) {
      // Roll back optimistic row
      setComments(prev => prev.filter(c => c.id !== tempId))
    } else if (data && !queued) {
      // Replace optimistic with confirmed row
      setComments(prev =>
        prev.map(c => c.id === tempId ? data : c).sort(byCreatedAt)
      )
    }
    // queued=true: leave optimistic row; it'll be reconciled when Realtime echoes the insert

    return { queued }
  }, [sessionId, currentUserId])

  const editComment = useCallback(async (commentId, body) => {
    const { error } = await dbEditComment(supabase, commentId, body)
    if (!error) {
      setComments(prev =>
        prev.map(c => c.id === commentId
          ? { ...c, body, edited_at: new Date().toISOString() }
          : c
        )
      )
    }
  }, [])

  const deleteComment = useCallback(async (commentId) => {
    const { error } = await dbDeleteComment(supabase, commentId)
    if (!error) {
      setComments(prev =>
        prev.map(c => c.id === commentId
          ? { ...c, deleted_at: new Date().toISOString() }
          : c
        )
      )
    }
  }, [])

  return { comments, status, typingUsers, postComment, editComment, deleteComment }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function byCreatedAt(a, b) {
  return new Date(a.created_at) - new Date(b.created_at)
}
