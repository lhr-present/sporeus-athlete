// ─── components/profile/MissionTimeline.jsx ──────────────────────────────────
//
// v9.99.0 (Prompt J) — Personal Mission-1 funnel timeline.
//
// Reads the user's own attribution_events (RLS-scoped) and renders a
// chronological vertical timeline of their Mission-1 progression:
// signup → first session → first week → starter-plan seeded.
//
// Each event is a row with a date and a bilingual label. Events the user
// hasn't hit yet are rendered as "pending" placeholders so the timeline
// shows the full path, not just what's done.

import { useEffect, useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { logger } from '../../lib/logger.js'
import {
  getUserAttributionEvents,
  filterMissionTimelineEvents,
  MISSION_1_EVENTS,
} from '../../lib/db/attributionEvents.js'

// Bilingual labels for the Mission-1 milestone events. Order matters —
// drives the rendered timeline sequence regardless of fetch order.
const EVENT_LABELS = {
  signup_completed: {
    en: { title: 'Signed up',           note: 'Account created' },
    tr: { title: 'Kaydoldun',           note: 'Hesap oluşturuldu' },
  },
  starter_plan_seeded: {
    en: { title: 'Starter plan seeded', note: 'Mission 1 chain activated' },
    tr: { title: 'Başlangıç planı',     note: 'Mission 1 zinciri aktif' },
  },
  first_session_logged: {
    en: { title: 'First session logged',note: 'Execution loop engaged' },
    tr: { title: 'İlk antrenman',       note: 'Uygulama döngüsü başladı' },
  },
  first_week_completed: {
    en: { title: 'First week complete', note: 'Adaptation engine reads compliance' },
    tr: { title: 'İlk hafta tamam',     note: 'Adaptasyon uyumu okur' },
  },
}

const MONO = "'IBM Plex Mono', monospace"
const GREEN = '#5bc25b'

export default function MissionTimeline({ authUser }) {
  const { lang } = useContext(LangCtx)
  const [events, setEvents] = useState(null)  // null = loading, [] = empty
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!authUser?.id) {
      setEvents([])
      return
    }
    getUserAttributionEvents(authUser.id)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          logger.warn('attribution fetch failed:', err.message)
          setError(err.message)
          setEvents([])
          return
        }
        setEvents(filterMissionTimelineEvents(data || []))
      })
      .catch(e => {
        if (cancelled) return
        logger.warn('attribution fetch threw:', e?.message)
        setError(String(e?.message || e))
        setEvents([])
      })
    return () => { cancelled = true }
  }, [authUser?.id])

  // Map each Mission-1 event slot to its captured row (or undefined if pending)
  // Computed unconditionally to keep hook ordering stable across renders;
  // safe when `events` is null (gives all-pending state, no celebration emit).
  const eventBySlot = {}
  for (const e of (events || [])) {
    // Keep the earliest occurrence for each event_name (Mission-1 milestones
    // should only fire once but defend against duplicates)
    if (!eventBySlot[e.event_name]) eventBySlot[e.event_name] = e
  }
  const completedCount = MISSION_1_EVENTS.filter(k => eventBySlot[k]).length
  const totalCount = MISSION_1_EVENTS.length
  const allComplete = completedCount === totalCount && totalCount > 0

  // v9.103.0 (Prompt CC) — Mission 1 completion duration + one-shot celebration
  // emit. Days from signup to last completed milestone. Once the celebration
  // event has been emitted (gated on localStorage key per uid), don't refire
  // even across reloads. The card itself still renders — it's the telemetry
  // that's idempotent.
  let daysToComplete = null
  if (allComplete) {
    const signup = eventBySlot.signup_completed?.created_at
    const finalMilestone = MISSION_1_EVENTS
      .map(k => eventBySlot[k]?.created_at)
      .filter(Boolean)
      .sort()
      .pop()
    if (signup && finalMilestone) {
      const ms = new Date(finalMilestone) - new Date(signup)
      daysToComplete = Math.max(1, Math.round(ms / 86400000))
    }
  }
  // v9.124.0: mission_1_complete emission moved to useMission2Telemetry
  // (mounted in AppInner) so it fires at App level regardless of
  // Profile-tab visits. Same localStorage gate key for backward
  // compatibility with athletes who already celebrated under v9.103.0.

  // Don't render the card for guest users or when Supabase isn't configured
  if (!authUser?.id) return null

  // Loading state
  if (events === null) {
    return (
      <div style={S.card}>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'MISSION 1 ZAMAN ÇİZGİSİ' : 'MISSION 1 TIMELINE'}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '11px', color: '#666', marginTop: '8px' }}>
          {lang === 'tr' ? 'yükleniyor...' : 'loading...'}
        </div>
      </div>
    )
  }

  return (
    <div style={S.card}>
      {/* v9.103.0 (Prompt CC) — Completion celebration header. Renders only
          when all 4 milestones are present. Provides the punctuated end-of-
          mission moment that drives Mission 2 engagement. */}
      {allComplete && (
        <div style={{
          marginBottom: '14px', padding: '12px 14px',
          background: `${GREEN}14`, border: `1px solid ${GREEN}66`,
          borderLeft: `4px solid ${GREEN}`, borderRadius: '4px',
        }}>
          <div style={{
            fontFamily: MONO, fontSize: '11px', color: GREEN,
            fontWeight: 700, letterSpacing: '0.1em', marginBottom: '4px',
          }}>
            {lang === 'tr' ? '✓ MISSION 1 TAMAMLANDI' : '✓ MISSION 1 COMPLETE'}
            {daysToComplete != null && (
              <span style={{ color: '#888', fontWeight: 400, marginLeft: '8px' }}>
                · {daysToComplete} {lang === 'tr' ? 'gün' : 'days'}
              </span>
            )}
          </div>
          <div style={{ fontFamily: MONO, fontSize: '11px', color: '#ccc', lineHeight: 1.55 }}>
            {lang === 'tr'
              ? 'Adaptasyon motoru artık planını gerçek antrenmana göre düzenliyor. Sırada: Mission 2 hedefini belirle.'
              : 'The adaptation engine is now tuning your plan against real execution. Next: set a Mission 2 goal.'}
          </div>
          {/* v9.113.0 (Prompt DDD) — Deep-link now points to the Mission 2
              consolidation timeline (rendered below this one in Profile),
              which surfaces the 4-step chain instead of stranding the
              athlete in the goal editor. */}
          <a
            href="#mission-two"
            onClick={e => {
              e.preventDefault()
              const el = document.getElementById('mission-two')
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            style={{
              display: 'inline-block', marginTop: '8px',
              fontFamily: MONO, fontSize: '10px', color: GREEN,
              textDecoration: 'underline', letterSpacing: '0.06em',
            }}>
            → {lang === 'tr' ? 'MISSION 2\'YE BAŞLA' : 'BEGIN MISSION 2'}
          </a>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'MISSION 1 ZAMAN ÇİZGİSİ' : 'MISSION 1 TIMELINE'}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: completedCount === totalCount ? GREEN : '#888' }}>
          {completedCount}/{totalCount}
        </div>
      </div>
      <div style={{ position: 'relative', paddingLeft: '20px' }}>
        {/* vertical guide line */}
        <div style={{
          position: 'absolute', left: '7px', top: '4px', bottom: '4px',
          width: '1px', background: 'var(--border)',
        }}/>
        {MISSION_1_EVENTS.map((evName) => {
          const evt = eventBySlot[evName]
          const lbl = EVENT_LABELS[evName]?.[lang] || EVENT_LABELS[evName]?.en
          const done = !!evt
          const color = done ? GREEN : '#444'
          const date = evt?.created_at ? evt.created_at.slice(0, 10) : null
          return (
            <div key={evName} style={{ position: 'relative', marginBottom: '14px' }}>
              <div style={{
                position: 'absolute', left: '-20px', top: '2px',
                width: '15px', height: '15px', borderRadius: '50%',
                background: 'var(--card)', border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }}/>}
              </div>
              <div style={{
                fontFamily: MONO, fontSize: '12px',
                color: done ? 'var(--text)' : '#666',
                fontWeight: done ? 600 : 400,
              }}>
                {lbl?.title || evName}
              </div>
              <div style={{ fontFamily: MONO, fontSize: '10px', color: '#666', marginTop: '2px' }}>
                {date
                  ? `${date} · ${lbl?.note || ''}`
                  : (lang === 'tr' ? 'henüz değil' : 'not yet')}
              </div>
            </div>
          )
        })}
      </div>
      {error && (
        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#888', marginTop: '8px', fontStyle: 'italic' }}>
          {lang === 'tr' ? 'olaylar yüklenemedi' : 'events unavailable'}
        </div>
      )}
    </div>
  )
}
