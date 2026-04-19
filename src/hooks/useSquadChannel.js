// src/hooks/useSquadChannel.js
// E11 — React hook wrapping squadChannel.js.
// Manages channel lifecycle: subscribe on mount, unsubscribe on unmount.
// Exposes channel status and presence state; accepts event callbacks.
//
// Usage:
//   const { status, presence, trackPresence } = useSquadChannel(coachId, {
//     onTrainingLog: payload => dispatch({ type: 'session', payload }),
//     onComment:     payload => dispatch({ type: 'comment', payload }),
//   })

import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { createSquadChannel } from '../lib/realtime/squadChannel.js'

/**
 * @param {string|null} coachId — auth.uid() of the coach; null = skip
 * @param {import('../lib/realtime/squadChannel.js').SquadCallbacks} callbacks
 * @returns {{ status: string, presence: object, trackPresence: Function }}
 */
export function useSquadChannel(coachId, callbacks = {}) {
  const [status,   setStatus]   = useState('disconnected')
  const [presence, setPresence] = useState({})
  const channelRef   = useRef(null)
  // Keep callbacks stable — don't re-subscribe when they change
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    if (!coachId || !isSupabaseReady()) return

    const ch = createSquadChannel(supabase, coachId, {
      onTrainingLog:  p => callbacksRef.current.onTrainingLog?.(p),
      onComment:      p => callbacksRef.current.onComment?.(p),
      onView:         p => callbacksRef.current.onView?.(p),
      onPresenceSync: state => {
        setPresence({ ...state })
        callbacksRef.current.onPresenceSync?.(state)
      },
      onStatusChange: s => setStatus(s),
    })

    channelRef.current = ch

    return () => {
      ch.unsubscribe()
      channelRef.current = null
    }
  }, [coachId]) // eslint-disable-line react-hooks/exhaustive-deps

  function trackPresence(userId, viewingSessionId = null) {
    channelRef.current?.trackPresence(userId, viewingSessionId)
  }

  return { status, presence, trackPresence }
}
