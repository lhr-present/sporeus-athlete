// ─── useRealtimeSquadFeed.js — Live activity feed for coach squad ──────────────
// Subscribes to training_log + recovery INSERTs for a list of athlete IDs.
// Returns a capped, sorted event list (newest first, max MAX_FEED).
// Uses backoff on disconnect; falls back to polling if realtime stays down >30s.
// Respects isSupabaseReady() guard; reports status to realtimeStatus module.

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { computeBackoff } from '../lib/realtimeBackoff.js'
import { reportStatus, removeStatus } from '../lib/realtimeStatus.js'
import { trackEvent } from '../lib/telemetry.js'
import { logger } from '../lib/logger.js'

const MAX_FEED          = 50
const POLL_INTERVAL_MS  = 30000   // fallback polling interval when realtime is down
const POLL_TRIGGER_MS   = 30000   // start polling after being reconnecting for this long

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
  const channelRef    = useRef(null)
  const retryRef      = useRef(0)
  const timerRef      = useRef(null)
  const pollTimerRef  = useRef(null)
  const pollActiveRef = useRef(false)
  const channelName   = coachId ? `squad-feed-${coachId}` : null

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

    // Polling fallback: fetch recent rows from DB when realtime is unavailable
    async function pollFeed() {
      if (!active || !isSupabaseReady()) return
      const ids = athletes.map(a => a.athlete_id)
      if (!ids.length) return

      const since = new Date(Date.now() - POLL_INTERVAL_MS * 2).toISOString()
      const athleteMap = Object.fromEntries(athletes.map(a => [a.athlete_id, a.display_name]))

      try {
        const { data: sessions } = await supabase
          .from('training_log')
          .select('id, user_id, type, tss, created_at')
          .in('user_id', ids)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20)

        const { data: recoveries } = await supabase
          .from('recovery')
          .select('id, user_id, score, created_at')
          .in('user_id', ids)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(10)

        if (sessions?.length || recoveries?.length) {
          const events = [
            ...(sessions  || []).map(r => ({ kind: 'session',  row: r })),
            ...(recoveries|| []).map(r => ({ kind: 'recovery', row: r })),
          ].sort((a, b) => new Date(b.row.created_at) - new Date(a.row.created_at))

          setFeedEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id))
            const newEvs = events
              .filter(({ kind, row }) => !existingIds.has(`${kind}-${row.id}`))
              .map(({ kind, row }) => {
                const name  = athleteMap[row.user_id] || 'Athlete'
                const label = kind === 'session'
                  ? `${name} logged ${row.type || 'a session'}${row.tss ? ` · ${row.tss} TSS` : ''}`
                  : `${name} checked in · readiness ${row.score ?? '—'}/100`
                return { id: `${kind}-${row.id}`, athleteId: row.user_id, kind, label, timestamp: row.created_at }
              })
            return [...newEvs, ...prev].slice(0, MAX_FEED)
          })
        }
      } catch (e) {
        logger.warn('squad-feed poll:', e.message)
      }
    }

    function startPolling() {
      if (pollActiveRef.current) return
      pollActiveRef.current = true
      logger.warn('squad-feed: realtime down, switching to polling')
      pollFeed()  // immediate first poll
      pollTimerRef.current = setInterval(pollFeed, POLL_INTERVAL_MS)
    }

    function stopPolling() {
      pollActiveRef.current = false
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }

    function updateStatus(status) {
      setFeedStatus(status)
      reportStatus(channelName, status)
    }

    function connect() {
      if (!active) return
      updateStatus('connecting')

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const athleteMap = Object.fromEntries(athletes.map(a => [a.athlete_id, a.display_name]))
      const ids = athleteIdsKey || 'none'

      const ch = supabase.channel(channelName)
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
            updateStatus('live')
            retryRef.current = 0
            stopPolling()
            trackEvent('realtime', 'subscribe', 'squad-feed')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.warn('squad-feed:', status, err?.message)
            updateStatus('reconnecting')
            const delay = computeBackoff(retryRef.current++)
            timerRef.current = setTimeout(connect, delay)
            // Activate polling fallback if reconnecting for too long
            setTimeout(() => {
              if (active && feedStatus !== 'live') startPolling()
            }, POLL_TRIGGER_MS)
          } else if (status === 'CLOSED') {
            updateStatus('disconnected')
          }
        })

      channelRef.current = ch
    }

    connect()

    return () => {
      active = false
      clearTimeout(timerRef.current)
      stopPolling()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      removeStatus(channelName)
      trackEvent('realtime', 'unsubscribe', 'squad-feed')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- athleteIdsKey stable string from athletes
  }, [coachId, enabled, athleteIdsKey])

  return { feedEvents, feedStatus }
}
