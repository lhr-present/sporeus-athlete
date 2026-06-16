// ─── useRealtimeSquad.js — Supabase Realtime subscription with backoff ─────────
// Returns { rtStatus, lastUpdated, rtToast } and patches athlete state live.
// Extracted from CoachSquadView.jsx (was 75 inline lines).

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { isFeatureGated } from '../lib/subscription.js'
import { computeBackoff } from '../lib/realtimeBackoff.js'

const MAX_RETRY = 8

/**
 * @param {object}   options
 * @param {object}   options.authUser  — Supabase auth user object
 * @param {boolean}  options.isDemo    — skip subscription in demo mode
 * @param {array}    options.athletes  — current athlete list (for filter)
 * @param {function} options.onUpdate  — callback(athleteId, newSessionDate) for optimistic updates
 * @returns {{ rtStatus, lastUpdated, rtToast }}
 */
export function useRealtimeSquad({ authUser, isDemo, athletes, onUpdate }) {
  const [rtStatus,     setRtStatus]     = useState('disconnected')
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [rtToast,      setRtToast]      = useState('')
  const channelRef = useRef(null)
  const retryRef   = useRef(0)
  const timerRef   = useRef(null)
  const toastTimerRef = useRef(null)

  // Stable, membership-sensitive key (sorted so order doesn't matter). Keying
  // the effect on this instead of `athletes.length` catches a same-length
  // roster SWAP (B out, C in) — otherwise the channel stays filtered on the
  // old ids and the coach misses C's live check-ins while still listening for B.
  const athleteIdsKey = useMemo(
    () => athletes.map(a => a.athlete_id).sort().join(','),
    [athletes]
  )

  useEffect(() => {
    const tier   = (() => { try { return localStorage.getItem('sporeus-tier') || 'free' } catch { return 'free' } })()
    const rtOk   = !isFeatureGated('realtime_dashboard', tier)
    const isCoach = !!authUser?.id

    if (!isCoach || !rtOk || isDemo || !isSupabaseReady()) return

    let active = true

    function connect() {
      if (!active) return
      setRtStatus('reconnecting')

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const athleteIds = athletes.map(a => a.athlete_id).join(',') || 'none'

      const ch = supabase.channel(`rt-squad-${authUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'recovery',
          filter: `user_id=in.(${athleteIds})`,
        }, (payload) => {
          const row = payload.new
          onUpdate?.(row.user_id, row.date, row)
          const ath = athletes.find(a => a.athlete_id === row.user_id)
          const name = ath?.display_name || 'Athlete'
          const toast = `${name} just checked in — Fatigue ${row.soreness ?? '—'}/5`
          setRtToast(toast)
          clearTimeout(toastTimerRef.current)
          toastTimerRef.current = setTimeout(() => { if (active) setRtToast('') }, 6000)
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40)
          setLastUpdated(new Date().toLocaleTimeString())
        })
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'training_log',
          filter: `user_id=in.(${athleteIds})`,
        }, () => {
          setLastUpdated(new Date().toLocaleTimeString())
        })
        .subscribe((status) => {
          if (!active) return
          if (status === 'SUBSCRIBED') {
            setRtStatus('live')
            retryRef.current = 0
            setLastUpdated(new Date().toLocaleTimeString())
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (retryRef.current < MAX_RETRY) {
              setRtStatus('reconnecting')
              const delay = computeBackoff(retryRef.current)
              retryRef.current++
              clearTimeout(timerRef.current)
              timerRef.current = setTimeout(() => { if (active) connect() }, delay)
            } else {
              // Retry budget exhausted — release the channel so the coach's
              // Realtime slot isn't held by an endlessly-cycling subscription.
              if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
              }
              setRtStatus('disconnected')
            }
          } else if (status === 'CLOSED') {
            // Clean close (e.g. our own removeChannel) — don't auto-reconnect.
            setRtStatus('disconnected')
          }
        })

      channelRef.current = ch
    }

    connect()

    return () => {
      active = false
      clearTimeout(timerRef.current)
      clearTimeout(toastTimerRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setRtStatus('disconnected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- athletes/onUpdate read via closure; re-subscribe is driven by athleteIdsKey (membership), not array identity
  }, [authUser?.id, isDemo, athleteIdsKey])

  return { rtStatus, lastUpdated, rtToast }
}
