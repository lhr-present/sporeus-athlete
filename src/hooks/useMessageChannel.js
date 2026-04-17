// ─── useMessageChannel.js — Broadcast channel for typing indicators + read receipts
// Wraps a Supabase broadcast channel for a coach↔athlete thread.
// Events: typing_start, typing_stop, read
// Also persists last_read_at to the message_reads table for offline recovery.
//
// Usage (in CoachMessage.jsx):
//   const { sendTypingStart, sendTypingStop, sendRead } =
//     useMessageChannel({ coachId, athleteId, userId: coachId, onTyping, onRead })

import { useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { buildChannelId } from '../lib/db/messages.js'
import { logger } from '../lib/logger.js'

const TYPING_EXPIRE_MS   = 3000  // auto-clear partner typing indicator after 3s
const TYPING_THROTTLE_MS = 2000  // send typing_start at most once per 2s

/**
 * @param {object}    opts
 * @param {string}    opts.coachId     — coach user ID
 * @param {string}    opts.athleteId   — athlete user ID
 * @param {string}    opts.userId      — current user's ID (coach or athlete side)
 * @param {Function}  [opts.onTyping]  — called with boolean: partner started/stopped typing
 * @param {Function}  [opts.onRead]    — called when partner emits a 'read' event
 * @returns {{ sendTypingStart: Function, sendTypingStop: Function, sendRead: Function }}
 */
export function useMessageChannel({ coachId, athleteId, userId, onTyping, onRead }) {
  const chRef           = useRef(null)
  const onTypingRef     = useRef(onTyping)
  const onReadRef       = useRef(onRead)
  const typingTimerRef  = useRef(null)
  const lastTypingRef   = useRef(0)

  // Keep callback refs fresh without re-subscribing
  useEffect(() => { onTypingRef.current = onTyping },  [onTyping])
  useEffect(() => { onReadRef.current   = onRead   },  [onRead])

  useEffect(() => {
    if (!coachId || !athleteId || !userId || !isSupabaseReady()) return

    const channelName = `thread:${buildChannelId(coachId, athleteId)}`
    const ch = supabase.channel(channelName)

    ch.on('broadcast', { event: 'typing_start' }, ({ payload }) => {
      if (payload?.user_id === userId) return  // ignore own events
      clearTimeout(typingTimerRef.current)
      onTypingRef.current?.(true)
      typingTimerRef.current = setTimeout(() => onTypingRef.current?.(false), TYPING_EXPIRE_MS)
    })

    ch.on('broadcast', { event: 'typing_stop' }, ({ payload }) => {
      if (payload?.user_id === userId) return
      clearTimeout(typingTimerRef.current)
      onTypingRef.current?.(false)
    })

    ch.on('broadcast', { event: 'read' }, ({ payload }) => {
      if (payload?.user_id === userId) return
      onReadRef.current?.()
    })

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('message-channel subscribed:', channelName)
      }
    })

    chRef.current = ch

    return () => {
      clearTimeout(typingTimerRef.current)
      if (chRef.current) {
        supabase.removeChannel(chRef.current)
        chRef.current = null
      }
    }
  }, [coachId, athleteId, userId])

  // ── Outbound actions ─────────────────────────────────────────────────────────

  const sendTypingStart = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingRef.current < TYPING_THROTTLE_MS) return
    lastTypingRef.current = now
    chRef.current?.send({
      type: 'broadcast', event: 'typing_start',
      payload: { user_id: userId },
    }).catch(e => logger.warn('typing_start broadcast:', e.message))
  }, [userId])

  const sendTypingStop = useCallback(() => {
    lastTypingRef.current = 0  // reset throttle so next keystroke fires immediately
    chRef.current?.send({
      type: 'broadcast', event: 'typing_stop',
      payload: { user_id: userId },
    }).catch(e => logger.warn('typing_stop broadcast:', e.message))
  }, [userId])

  const sendRead = useCallback(async () => {
    const now = new Date().toISOString()
    chRef.current?.send({
      type: 'broadcast', event: 'read',
      payload: { user_id: userId, last_read_at: now },
    }).catch(e => logger.warn('read broadcast:', e.message))

    // Persist to DB for offline recovery
    if (isSupabaseReady() && coachId && athleteId) {
      const threadId = buildChannelId(coachId, athleteId)
      supabase.from('message_reads').upsert(
        { thread_id: threadId, user_id: userId, last_read_at: now },
        { onConflict: 'thread_id,user_id' }
      ).then(({ error }) => {
        if (error) logger.warn('message_reads upsert:', error.message)
      })
    }
  }, [userId, coachId, athleteId])

  return { sendTypingStart, sendTypingStop, sendRead }
}
