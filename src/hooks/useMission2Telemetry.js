// src/hooks/useMission2Telemetry.js
//
// v9.118.0 (Prompt JJJ) — Mission 2 milestone telemetry hoisted to App level.
//
// Pre-v9.118 the Mission 2 emission useEffect lived inside MissionTwoTimeline,
// which only renders on the Profile tab. Athletes who hit a Mission 2
// milestone but never visited Profile silently undercount in the funnel —
// emissions were gated on a Profile visit, not on the milestone itself.
//
// This hook runs at AppInner level so it fires for every authenticated
// athlete on every session, regardless of which tab they spend time in.
// Idempotency is preserved via the same localStorage gate the component
// version used: each event emits exactly once per user per session-cluster.
//
// MissionTwoTimeline keeps its own derive for rendering, but the emission
// side-effect has moved here.

import { useEffect, useMemo, useState } from 'react'
import { logger } from '../lib/logger.js'
import { emitEvent } from '../lib/attribution.js'
import { getUserAttributionEvents } from '../lib/db/attributionEvents.js'
import { getMission2Status } from '../lib/mission2/missionTwo.js'

/**
 * @description Fetch attribution events once and emit any newly-completed
 *   Mission 2 milestones. No-op for guests / unauthenticated users.
 *
 * @param {Object|null} authUser   - auth row; only `.id` is read
 * @param {Object|null} profile    - athlete profile (read for raceDate)
 * @param {Array}       log        - training log (read for month + PR detection)
 */
export function useMission2Telemetry(authUser, profile, log) {
  const userId = authUser?.id || null
  const [events, setEvents] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!userId) { setEvents(null); return }
    getUserAttributionEvents(userId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          logger.warn('mission2 telemetry fetch:', error.message)
          setEvents([])
          return
        }
        setEvents(data || [])
      })
      .catch(e => {
        if (cancelled) return
        logger.warn('mission2 telemetry threw:', e?.message)
        setEvents([])
      })
    return () => { cancelled = true }
  }, [userId])

  const status = useMemo(() => {
    if (!events) return null
    return getMission2Status({ attributionEvents: events, profile, log })
  }, [events, profile, log])

  useEffect(() => {
    if (!status || !userId) return
    for (const ev of status.events) {
      if (!ev.done || ev.key === 'mission_1_complete') continue
      const key = `sporeus-mission2-${userId}-${ev.key}`
      try {
        if (localStorage.getItem(key)) continue
        emitEvent(ev.key, { reached_at: ev.at })
        localStorage.setItem(key, new Date().toISOString())
      } catch (e) {
        logger.warn(`${ev.key} emit:`, e?.message)
      }
    }
    if (status.complete) {
      const key = `sporeus-mission2-${userId}-complete`
      try {
        if (!localStorage.getItem(key)) {
          emitEvent('mission_2_complete', { completed_events: status.completedCount })
          localStorage.setItem(key, new Date().toISOString())
        }
      } catch (e) {
        logger.warn('mission_2_complete emit:', e?.message)
      }
    }
  }, [status, userId])
}
