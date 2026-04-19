// src/lib/realtime/squadChannel.js
// E11 — Squad channel manager for coach real-time feed.
//
// Creates ONE Supabase Realtime channel per coach session that subscribes to:
//   1. postgres_changes on training_log (new sessions for all athletes)
//   2. postgres_changes on session_comments (new/edited/deleted comments)
//   3. postgres_changes on session_views (presence awareness)
//   4. presence — who is actively viewing the squad dashboard
//
// RLS filters events to only rows the coach is permitted to see.
// Uses computeBackoff for reconnect delays; reports to realtimeStatus registry.
// Channel is idempotent — calling createSquadChannel with the same coachId
// while one is already active is safe (caller must call unsubscribe first).

import { computeBackoff }       from '../realtimeBackoff.js'
import { reportStatus, removeStatus } from '../realtimeStatus.js'

const MAX_RETRY = 8

/**
 * @typedef {Object} SquadCallbacks
 * @property {(payload: object) => void} [onTrainingLog]  - training_log change
 * @property {(payload: object) => void} [onComment]      - session_comments change
 * @property {(payload: object) => void} [onView]         - session_views change
 * @property {(state: object) => void}   [onPresenceSync] - presence state update
 * @property {(status: string) => void}  [onStatusChange] - 'connecting'|'live'|'reconnecting'|'disconnected'
 */

/**
 * Create and subscribe to the squad Realtime channel.
 *
 * @param {Object}         supabase  - supabase-js client
 * @param {string}         coachId   - auth.uid() of the coach
 * @param {SquadCallbacks} callbacks
 * @returns {{ unsubscribe: () => void }}
 */
export function createSquadChannel(supabase, coachId, callbacks = {}) {
  const channelName  = `squad:${coachId}`
  const statusKey    = `squad-${coachId}`
  let   retryCount   = 0
  let   retryTimer   = null
  let   channel      = null
  let   destroyed    = false

  const { onTrainingLog, onComment, onView, onPresenceSync, onStatusChange } = callbacks

  function setStatus(s) {
    reportStatus(statusKey, s)
    onStatusChange?.(s)
  }

  function cleanup() {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    if (channel) {
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
      channel = null
    }
    removeStatus(statusKey)
  }

  function subscribe() {
    if (destroyed) return

    setStatus('connecting')

    channel = supabase.channel(channelName)

    // ── postgres_changes subscriptions ────────────────────────────────────────
    channel
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'training_log' },
        payload => { if (!destroyed) onTrainingLog?.(payload) },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_comments' },
        payload => { if (!destroyed) onComment?.(payload) },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_views' },
        payload => { if (!destroyed) onView?.(payload) },
      )

    // ── presence ──────────────────────────────────────────────────────────────
    channel
      .on('presence', { event: 'sync' }, () => {
        if (!destroyed) onPresenceSync?.(channel.presenceState())
      })

    // ── subscribe + reconnect ─────────────────────────────────────────────────
    channel.subscribe(status => {
      if (destroyed) return

      if (status === 'SUBSCRIBED') {
        retryCount = 0
        setStatus('live')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setStatus('reconnecting')
        if (retryCount < MAX_RETRY) {
          const delay = computeBackoff(retryCount++)
          retryTimer = setTimeout(() => {
            if (destroyed) return
            try { supabase.removeChannel(channel) } catch { /* ignore */ }
            channel = null
            subscribe()
          }, delay)
        } else {
          setStatus('disconnected')
        }
      } else if (status === 'CLOSED') {
        if (!destroyed) setStatus('disconnected')
      }
    })
  }

  /**
   * Track coach presence on the squad dashboard.
   * Call whenever the coach navigates to or away from a session.
   *
   * @param {string} userId
   * @param {string|null} viewingSessionId
   */
  function trackPresence(userId, viewingSessionId = null) {
    if (!channel || destroyed) return
    channel.track({ userId, role: 'coach', viewingSessionId, ts: Date.now() })
      .catch(() => { /* ignore — best-effort */ })
  }

  subscribe()

  return {
    trackPresence,
    unsubscribe() {
      destroyed = true
      cleanup()
    },
  }
}
