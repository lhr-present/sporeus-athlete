// ─── useSquadPresence.js — Supabase Realtime Presence for squad online status ──
// Coach subscribes to see which athletes are online.
// Athlete tracks own presence when app is open.
//
// Usage (coach side):
//   const { presenceMap } = useSquadPresence({ coachId: authUser.id, role: 'coach' })
//   presenceMap['athlete-uuid'] → { online: true, last_seen: '...' }
//
// Usage (athlete side — call once in App.jsx or Profile):
//   useSquadPresence({ coachId: myCoachId, role: 'athlete', athleteId: authUser.id })

import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'

/**
 * @param {object}  opts
 * @param {string}  opts.coachId   — coach user ID (channel key)
 * @param {'coach'|'athlete'} opts.role — whether caller is coach or athlete
 * @param {string}  [opts.athleteId] — required when role === 'athlete'
 * @returns {{ presenceMap: Object }}
 */
export function useSquadPresence({ coachId, role, athleteId }) {
  const [presenceMap, setPresenceMap] = useState({})
  const channelRef = useRef(null)

  useEffect(() => {
    if (!coachId || !isSupabaseReady()) return
    if (role === 'athlete' && !athleteId) return

    const channelName = `squad-presence-${coachId}`

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
          if (p.presence_ref) {
            setPresenceMap(prev => {
              const next = { ...prev }
              // Mark offline but keep last_seen
              if (next[p.user_id]) next[p.user_id] = { online: false, last_seen: new Date().toISOString() }
              return next
            })
          }
        })
      })
    }

    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      try {
        // Both roles track themselves
        const payload = role === 'coach'
          ? { user_id: '__coach__', online_at: new Date().toISOString() }
          : { user_id: athleteId,   online_at: new Date().toISOString() }
        await ch.track(payload)
      } catch (e) {
        logger.warn('presence track:', e.message)
      }
    })

    channelRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [coachId, role, athleteId])

  return { presenceMap }
}
