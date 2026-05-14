// ─── components/profile/MissionTwoTimeline.jsx ───────────────────────────────
//
// v9.113.0 (Prompt DDD) — Mission 2 consolidation chain timeline.
//
// Visualizes the 4 Mission 2 events derived by getMission2Status:
//   mission_1_complete → race_committed → first_month_completed → pr_logged
//
// Renders only when the athlete has entered Mission 2 (mission_1_complete
// fired). Hidden otherwise — Mission 2 shouldn't preempt Mission 1.

import { useEffect, useMemo, useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useData } from '../../contexts/DataContext.jsx'
import { S } from '../../styles.js'
import { logger } from '../../lib/logger.js'
import { emitEvent } from '../../lib/attribution.js'
import {
  getMission2Status,
  MISSION_2_EVENTS,
  MISSION_2_LABELS,
} from '../../lib/mission2/missionTwo.js'
import { getUserAttributionEvents } from '../../lib/db/attributionEvents.js'

const MONO = "'IBM Plex Mono', monospace"
const GREEN = '#5bc25b'
const BLUE = '#0064ff'

export default function MissionTwoTimeline({ authUser, log }) {
  const { lang } = useContext(LangCtx)
  const { profile } = useData()
  const [events, setEvents] = useState(null) // null = loading

  useEffect(() => {
    let cancelled = false
    if (!authUser?.id) { setEvents([]); return }
    getUserAttributionEvents(authUser.id)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          logger.warn('mission2 attribution fetch:', error.message)
          setEvents([])
          return
        }
        setEvents(data || [])
      })
      .catch(e => {
        if (cancelled) return
        logger.warn('mission2 attribution threw:', e?.message)
        setEvents([])
      })
    return () => { cancelled = true }
  }, [authUser?.id])

  // Derive status at the top so hook order stays stable across early
  // returns. Memoized on (events, profile, log) — the emission useEffect
  // below reads it without re-deriving.
  const status = useMemo(() => {
    if (!events) return null
    return getMission2Status({ attributionEvents: events, profile, log })
  }, [events, profile, log])

  // v9.116.0 (Prompt HHH) — Mission 2 milestone telemetry emissions.
  //
  // Pre-v9.116 the Mission 2 framework (v9.113 DDD) derived progress
  // from existing state but emitted zero events when a milestone was
  // crossed. The funnel was invisible server-side — coach dashboards
  // could not aggregate "12 athletes hit first_month_completed this
  // week." Mission 1 emits each milestone via emitEvent, so the
  // asymmetry was a real measurement gap, not a polish issue.
  //
  // One-shot emission per milestone per user, gated on a localStorage
  // key so reloads / re-renders don't re-fire. mission_1_complete is
  // already emitted by MissionTimeline (v9.103 CC) — skip here. A
  // synthetic mission_2_complete fires once when all four are done.
  useEffect(() => {
    if (!status || !authUser?.id) return
    for (const ev of status.events) {
      if (!ev.done || ev.key === 'mission_1_complete') continue
      const key = `sporeus-mission2-${authUser.id}-${ev.key}`
      try {
        if (localStorage.getItem(key)) continue
        emitEvent(ev.key, { reached_at: ev.at })
        localStorage.setItem(key, new Date().toISOString())
      } catch (e) {
        logger.warn(`${ev.key} emit:`, e?.message)
      }
    }
    if (status.complete) {
      const key = `sporeus-mission2-${authUser.id}-complete`
      try {
        if (!localStorage.getItem(key)) {
          emitEvent('mission_2_complete', {
            completed_events: status.completedCount,
          })
          localStorage.setItem(key, new Date().toISOString())
        }
      } catch (e) {
        logger.warn('mission_2_complete emit:', e?.message)
      }
    }
  }, [status, authUser?.id])

  if (!authUser?.id) return null
  if (events === null) {
    return (
      <div style={S.card} id="mission-two">
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'MISSION 2 ZAMAN ÇİZGİSİ' : 'MISSION 2 TIMELINE'}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '11px', color: '#666', marginTop: '8px' }}>
          {lang === 'tr' ? 'yükleniyor...' : 'loading...'}
        </div>
      </div>
    )
  }

  // Mission 2 doesn't render until the athlete has crossed Mission 1.
  // Showing it earlier would clutter Profile for athletes still in onboarding.
  if (!status?.entered) return null

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${status.complete ? GREEN : BLUE}` }} id="mission-two">
      {status.complete && (
        <div style={{
          marginBottom: '14px', padding: '12px 14px',
          background: `${GREEN}14`, border: `1px solid ${GREEN}66`,
          borderLeft: `4px solid ${GREEN}`, borderRadius: '4px',
        }}>
          <div style={{ fontFamily: MONO, fontSize: '11px', color: GREEN, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '4px' }}>
            {lang === 'tr' ? '✓ MISSION 2 TAMAMLANDI' : '✓ MISSION 2 COMPLETE'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: '11px', color: '#ccc', lineHeight: 1.55 }}>
            {lang === 'tr'
              ? 'Hedefe yöneldin, ilk ayını tamamladın, ilk PR\'ı geçtin. Artık bir antrenman disiplinin var.'
              : "You committed to a target, finished your first month, and beat a prior best. That's a training discipline."}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'MISSION 2 ZAMAN ÇİZGİSİ · KONSOLİDASYON' : 'MISSION 2 TIMELINE · CONSOLIDATION'}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: status.complete ? GREEN : '#888' }}>
          {status.completedCount}/{status.totalCount}
        </div>
      </div>
      <div style={{ position: 'relative', paddingLeft: '20px' }}>
        <div style={{ position: 'absolute', left: '7px', top: '4px', bottom: '4px', width: '1px', background: 'var(--border)' }}/>
        {MISSION_2_EVENTS.map(key => {
          const ev = status.events.find(e => e.key === key)
          const done = !!ev?.done
          const at = ev?.at
          const color = done ? GREEN : '#444'
          const lbl = MISSION_2_LABELS[key]?.[lang] || MISSION_2_LABELS[key]?.en
          return (
            <div key={key} style={{ position: 'relative', marginBottom: '14px' }}>
              <div style={{
                position: 'absolute', left: '-20px', top: '2px',
                width: '15px', height: '15px', borderRadius: '50%',
                background: 'var(--card)', border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }}/>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: '12px', color: done ? 'var(--text)' : '#666', fontWeight: done ? 600 : 400 }}>
                {lbl?.title || key}
              </div>
              <div style={{ fontFamily: MONO, fontSize: '10px', color: '#666', marginTop: '2px' }}>
                {at ? `${at} · ${lbl?.note || ''}` : (lang === 'tr' ? 'henüz değil' : 'not yet')}
              </div>
            </div>
          )
        })}
      </div>
      {!status.complete && !status.events.find(e => e.key === 'race_committed')?.done && (
        <div style={{
          marginTop: '8px', padding: '8px 12px',
          background: `${BLUE}10`, border: `1px solid ${BLUE}44`, borderRadius: '4px',
          fontFamily: MONO, fontSize: '10px', color: '#aabbff', lineHeight: 1.5,
        }}>
          {lang === 'tr'
            ? '◆ Bir sonraki adım: hedef yarış tarihi belirle (≥7 gün ileri).'
            : '◆ Next step: set a target race date (≥7 days out).'}
          <a
            href="#goal-editor"
            onClick={e => {
              e.preventDefault()
              const el = document.getElementById('goal-editor')
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            style={{ marginLeft: '6px', color: BLUE, textDecoration: 'underline' }}>
            → {lang === 'tr' ? 'HEDEF EDİTÖRÜ' : 'GOAL EDITOR'}
          </a>
        </div>
      )}
    </div>
  )
}
