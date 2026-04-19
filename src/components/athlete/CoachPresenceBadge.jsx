// src/components/athlete/CoachPresenceBadge.jsx
// E11 — Badge showing when a coach last viewed this session.
// Used in athlete's session detail panel.
//
// Behaviour:
//   • Polls session_views once on mount (coachId + sessionId)
//   • Subscribes to realtime updates via postgres_changes on session_views
//   • Uses formatViewedAt + presenceBucket from presenceFormat.js
//   • Bilingual EN/TR from LangCtx
//
// Props:
//   sessionId — training_log.id
//   coachId   — profiles.id of the athlete's linked coach (null = hide)
//   coachName — display name for the coach
//   lang      — 'en' | 'tr' (from LangCtx)

import { useState, useEffect, useRef, useContext } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { LangCtx }        from '../../contexts/LangCtx.jsx'
import { FONT, COLOR, RADIUS } from '../../styles/tokens.js'
import { formatViewedAt, presenceBucket } from '../../lib/realtime/presenceFormat.js'

const BUCKET_COLOR = {
  now:    COLOR.green,
  recent: COLOR.orange,
  today:  COLOR.amber,
  older:  COLOR.dim,
  never:  COLOR.dark4,
}

export default function CoachPresenceBadge({ sessionId, coachId, coachName = 'Coach' }) {
  const { t, lang } = useContext(LangCtx)
  const [viewedAt,   setViewedAt]   = useState(null)
  const [tickLabel,  setTickLabel]  = useState('')
  const channelRef = useRef(null)
  const tickRef    = useRef(null)

  // ── Fetch coach's last view ───────────────────────────────────────────────────

  async function fetchView() {
    if (!sessionId || !coachId || !isSupabaseReady()) return
    const { data } = await supabase
      .from('session_views')
      .select('viewed_at')
      .eq('session_id', sessionId)
      .eq('user_id', coachId)
      .maybeSingle()
    if (data?.viewed_at) setViewedAt(data.viewed_at)
  }

  // ── Realtime subscription ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || !coachId) return

    fetchView()

    if (!isSupabaseReady()) return

    const ch = supabase.channel(`coach-presence:${sessionId}:${coachId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', schema: 'public', table: 'session_views',
          filter: `session_id=eq.${sessionId}`,
        },
        ({ new: row }) => {
          if (row.user_id === coachId) setViewedAt(row.viewed_at)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT', schema: 'public', table: 'session_views',
          filter: `session_id=eq.${sessionId}`,
        },
        ({ new: row }) => {
          if (row.user_id === coachId) setViewedAt(row.viewed_at)
        },
      )
      .subscribe()

    channelRef.current = ch

    return () => {
      try { supabase.removeChannel(ch) } catch { /* ignore */ }
      channelRef.current = null
    }
  }, [sessionId, coachId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick label every 30s ─────────────────────────────────────────────────────

  useEffect(() => {
    function update() {
      setTickLabel(viewedAt ? formatViewedAt(viewedAt, lang) : '')
    }
    update()
    tickRef.current = setInterval(update, 30_000)
    return () => clearInterval(tickRef.current)
  }, [viewedAt, lang])

  // ── Nothing to show ───────────────────────────────────────────────────────────

  if (!coachId) return null

  const bucket = presenceBucket(viewedAt)
  const color  = BUCKET_COLOR[bucket] ?? COLOR.dim
  const label  = viewedAt ? tickLabel : t('coachPresenceNever')

  return (
    <div
      title={`${t('coachPresenceLabel')}: ${coachName}`}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        '5px',
        fontFamily: FONT.mono,
        fontSize:   FONT.size.xs,
        color,
        padding:    '2px 7px',
        border:     `1px solid ${color}44`,
        borderRadius: RADIUS.md,
        cursor:     'default',
        userSelect: 'none',
      }}
    >
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: color, flexShrink: 0,
        // Pulse animation when coach is viewing right now
        animation: bucket === 'now' ? 'pulse 1.6s ease-out infinite' : 'none',
      }} />
      <span style={{ letterSpacing: '0.07em' }}>
        {t('coachPresenceLabel')}: {label}
      </span>
    </div>
  )
}
