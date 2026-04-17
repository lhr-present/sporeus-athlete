// ─── useSessionAttendance.js — Live RSVP subscription for a coach session ──────
// Subscribes to session_attendance INSERT/UPDATE for a given session_id.
// Returns aggregated attendance counts that update in real-time.
// popAnim briefly true on each update — wire to a CSS scale pulse.

import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { getSessionAttendance, aggregateAttendance } from '../lib/db/coachSessions.js'
import { computeBackoff } from '../lib/realtimeBackoff.js'
import { logger } from '../lib/logger.js'

const POP_DURATION_MS = 600  // how long popAnim stays true

/**
 * @param {object}  opts
 * @param {string}  opts.sessionId — coach_sessions.id to watch
 * @param {boolean} [opts.enabled=true] — set false when session is collapsed
 * @returns {{
 *   attendance: { confirmed: number, declined: number, pending: number, total: number } | null,
 *   popAnim: boolean,
 * }}
 */
export function useSessionAttendance({ sessionId, enabled = true }) {
  const [attendance, setAttendance] = useState(null)
  const [popAnim,    setPopAnim]    = useState(false)
  const channelRef = useRef(null)
  const retryRef   = useRef(0)
  const timerRef   = useRef(null)
  const popTimerRef = useRef(null)

  function triggerPop() {
    setPopAnim(true)
    clearTimeout(popTimerRef.current)
    popTimerRef.current = setTimeout(() => setPopAnim(false), POP_DURATION_MS)
  }

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseReady()) return

    let active = true

    // ── Initial fetch ─────────────────────────────────────────────────────────
    getSessionAttendance(sessionId).then(({ data, error }) => {
      if (!active) return
      if (!error && data) setAttendance(aggregateAttendance(data))
    })

    // ── Realtime subscription ─────────────────────────────────────────────────
    function connect() {
      if (!active) return

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const ch = supabase
        .channel(`session-attendance-${sessionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'session_attendance',
          filter: `session_id=eq.${sessionId}`,
        }, async () => {
          if (!active) return
          // Re-fetch full aggregation on any change
          const { data, error } = await getSessionAttendance(sessionId)
          if (!active) return
          if (!error && data) {
            setAttendance(aggregateAttendance(data))
            triggerPop()
          }
        })
        .subscribe((status, err) => {
          if (!active) return
          if (status === 'SUBSCRIBED') {
            retryRef.current = 0
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.warn('session-attendance:', status, err?.message)
            const delay = computeBackoff(retryRef.current++)
            timerRef.current = setTimeout(connect, delay)
          }
        })

      channelRef.current = ch
    }

    connect()

    return () => {
      active = false
      clearTimeout(timerRef.current)
      clearTimeout(popTimerRef.current)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [sessionId, enabled])

  return { attendance, popAnim }
}
