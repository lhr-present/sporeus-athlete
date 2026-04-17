// ─── useRealtimeSquadFeed.js — Live activity feed for coach squad ──────────────
// Subscribes to training_log + recovery INSERTs for a list of athlete IDs.
// Returns a capped, sorted event list (newest first, max MAX_FEED).
// Uses backoff on disconnect; respects isSupabaseReady() guard.

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { computeBackoff } from '../lib/realtimeBackoff.js'
import { logger } from '../lib/logger.js'

const MAX_FEED = 20

/**
 * @param {object} opts
 * @param {string}   opts.coachId   — channel disambiguator
 * @param {Array<{athlete_id: string, display_name: string}>} opts.athletes
 * @param {boolean}  opts.enabled   — set false to skip (demo mode, no auth)
 * @returns {{ feedEvents: Array, feedStatus: string }}
 */
export function useRealtimeSquadFeed({ coachId, athletes = [], enabled = true }) {
  const [feedEvents, setFeedEvents] = useState([])
  const [feedStatus, setFeedStatus] = useState('disconnected')
  const channelRef = useRef(null)
  const retryRef   = useRef(0)
  const timerRef   = useRef(null)

  // Stable string key for athlete list — avoids inline expression in dep array
  const athleteIdsKey = useMemo(
    () => athletes.map(a => a.athlete_id).join(','),
    [athletes]
  )

  useEffect(() => {
    if (!enabled || !coachId || !isSupabaseReady() || !athletes.length) return

    let active = true

    function appendEvent(kind, row, athleteMap) {
      const name  = athleteMap[row.user_id] || 'Athlete'
      const label = kind === 'session'
        ? `${name} logged ${row.type || 'a session'}${row.tss ? ` · ${row.tss} TSS` : ''}`
        : `${name} checked in · readiness ${row.score ?? '—'}/100`
      const ev = {
        id:        `${kind}-${row.id}`,
        athleteId: row.user_id,
        kind,
        label,
        timestamp: row.created_at || new Date().toISOString(),
      }
      setFeedEvents(prev => [ev, ...prev].slice(0, MAX_FEED))
    }

    function connect() {
      if (!active) return
      setFeedStatus('connecting')

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const athleteMap = Object.fromEntries(athletes.map(a => [a.athlete_id, a.display_name]))
      const ids = athleteIdsKey || 'none'

      const ch = supabase.channel(`squad-feed-${coachId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'training_log',
          filter: `user_id=in.(${ids})`,
        }, ({ new: row }) => appendEvent('session', row, athleteMap))
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'recovery',
          filter: `user_id=in.(${ids})`,
        }, ({ new: row }) => appendEvent('recovery', row, athleteMap))
        .subscribe((status, err) => {
          if (!active) return
          if (status === 'SUBSCRIBED') {
            setFeedStatus('live')
            retryRef.current = 0
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.warn('squad-feed:', status, err?.message)
            setFeedStatus('reconnecting')
            const delay = computeBackoff(retryRef.current++)
            timerRef.current = setTimeout(connect, delay)
          } else if (status === 'CLOSED') {
            setFeedStatus('disconnected')
          }
        })

      channelRef.current = ch
    }

    connect()

    return () => {
      active = false
      clearTimeout(timerRef.current)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- athleteIdsKey is a stable string derived from athletes
  }, [coachId, enabled, athleteIdsKey])

  return { feedEvents, feedStatus }
}
