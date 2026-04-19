// ─── useSquadPresence.js — Supabase Realtime Presence for squad online status ──
// Coach subscribes to see which athletes are online.
// Athlete tracks own presence when app is open.
// Respects show_online_status=false athlete opt-out.
// Joins/leaves presence on window focus/blur for accurate online indicators.
//
// Usage (coach side):
//   const { presenceMap } = useSquadPresence({ coachId: authUser.id, role: 'coach' })
//   presenceMap['athlete-uuid'] → { online: true, last_seen: '...' }
//
// Usage (athlete side — call once in App.jsx or Profile):
//   useSquadPresence({ coachId: myCoachId, role: 'athlete', athleteId: authUser.id, showOnlineStatus: profile.show_online_status })

import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { reportStatus, removeStatus } from '../lib/realtimeStatus.js'
import { logger } from '../lib/logger.js'

/**
 * @param {object}  opts
 * @param {string}  opts.coachId          — coach user ID (channel key)
 * @param {'coach'|'athlete'} opts.role   — whether caller is coach or athlete
 * @param {string}  [opts.athleteId]      — required when role === 'athlete'
 * @param {boolean} [opts.showOnlineStatus=true] — athlete opt-out (false = do not track)
 * @returns {{ presenceMap: Object }}
 */
export function useSquadPresence({ coachId, role, athleteId, showOnlineStatus = true }) {
  const [presenceMap, setPresenceMap] = useState({})
  const channelRef  = useRef(null)
  const trackedRef  = useRef(false)
  const channelName = coachId ? `squad-presence-${coachId}` : null

  useEffect(() => {
    if (!coachId || !isSupabaseReady()) return
    if (role === 'athlete' && !athleteId) return

    const ch = supabase.channel(channelName, {
      config: { presence: { key: role === 'coach' ? '__coach__' : athleteId } },
    })

    // Coach: sync presence state → presenceMap
    if (role === 'coach') {
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState()
        const map = {}
        Object.entries(state).forEach(([key, presences]) => {
          if (key === '__coach__') return
          const p = presences[0]
          if (p) {
            map[key] = { online: true, last_seen: p.online_at || new Date().toISOString() }
          }
        })
        setPresenceMap(map)
      })

      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => {
          setPresenceMap(prev => {
            const next = { ...prev }
            // Try to look up by presence key (the athleteId)
            const key = p.user_id || Object.keys(next).find(k => prev[k])
            if (key && next[key]) {
              next[key] = { online: false, last_seen: new Date().toISOString() }
            }
            return next
          })
        })
      })
    }

    async function trackSelf() {
      // Athlete opt-out: respect show_online_status flag
      if (role === 'athlete' && !showOnlineStatus) return
      if (!trackedRef.current) return
      try {
        const payload = role === 'coach'
          ? { user_id: '__coach__', online_at: new Date().toISOString(), current_tab: true }
          : { user_id: athleteId,   online_at: new Date().toISOString(), current_tab: true }
        await ch.track(payload)
      } catch (e) {
        logger.warn('presence track:', e.message)
      }
    }

    async function untrackSelf() {
      try {
        await ch.untrack()
      } catch (e) {
        logger.warn('presence untrack:', e.message)
      }
    }

    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      trackedRef.current = true
      reportStatus(channelName, 'live')
      await trackSelf()
    })

    channelRef.current = ch

    // Window focus/blur: join/leave presence to keep indicator accurate
    function handleFocus() {
      trackedRef.current = true
      trackSelf()
    }
    function handleBlur() {
      trackedRef.current = false
      untrackSelf()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur',  handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur',  handleBlur)
      trackedRef.current = false
      removeStatus(channelName)
      supabase.removeChannel(ch)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId, role, athleteId, showOnlineStatus])

  return { presenceMap }
}
