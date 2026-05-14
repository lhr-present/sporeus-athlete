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
//
// v9.124.0 — Now also owns the mission_1_complete synthetic emission,
// hoisted out of MissionTimeline for the same reason: pre-v9.124 the
// Mission 1 completion event only fired when the athlete opened Profile,
// so the v9.103.0 (Prompt CC) celebration telemetry was Profile-biased
// in the same way Mission 2 was before v9.118. The hook now handles
// both missions' synthetic-completion events at the same auth boundary.

import { useEffect, useMemo, useState } from 'react'
import { logger } from '../lib/logger.js'
import { emitEvent } from '../lib/attribution.js'
import { getUserAttributionEvents, MISSION_1_EVENTS } from '../lib/db/attributionEvents.js'
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

  // v9.124.0 — Mission 1 synthetic completion emission. Fires when all
  // 4 atomic Mission 1 events are present and `mission_1_complete`
  // hasn't been emitted yet for this user. days_to_complete is the gap
  // between the earliest atomic event (signup_completed) and the
  // latest. localStorage key matches the one MissionTimeline used
  // (sporeus-mission-1-celebrated-{uid}) so athletes upgrading from
  // v9.103 don't re-fire the event.
  useEffect(() => {
    if (!events || !userId) return
    const bySlot = {}
    for (const e of events) {
      if (!e?.event_name) continue
      if (!bySlot[e.event_name]) bySlot[e.event_name] = e
    }
    // Already emitted? Skip the work entirely.
    if (bySlot.mission_1_complete) return
    // All atomic Mission 1 events present?
    const completedAll = MISSION_1_EVENTS.every(k => bySlot[k])
    if (!completedAll) return
    // Compute days_to_complete from earliest to latest atomic event.
    const timestamps = MISSION_1_EVENTS
      .map(k => bySlot[k]?.created_at)
      .filter(Boolean)
      .sort()
    const signup = bySlot.signup_completed?.created_at
    let daysToComplete = null
    if (signup && timestamps.length > 0) {
      const last = timestamps[timestamps.length - 1]
      const ms = new Date(last) - new Date(signup)
      daysToComplete = Math.max(1, Math.round(ms / 86400000))
    }
    const key = `sporeus-mission-1-celebrated-${userId}`
    try {
      if (localStorage.getItem(key)) return
      emitEvent('mission_1_complete', { days_to_complete: daysToComplete })
      localStorage.setItem(key, new Date().toISOString())
    } catch (e) {
      logger.warn('mission_1_complete emit:', e?.message)
    }
  }, [events, userId])
}
