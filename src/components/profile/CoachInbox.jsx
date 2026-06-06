// src/components/profile/CoachInbox.jsx — athlete-facing READ-ONLY coach inbox.
//
// Replaces the removed localStorage-only CoachMessagesCard (v9.380). Reads coach→
// athlete messages from the DB `messages` table (the path the coach UI writes to),
// decrypts them, marks them read, and subscribes for live arrivals. Read-only:
// athlete→coach replies are intentionally not supported (removed v9.380).
//
// Reuses the existing, tested infra: db/messages.js + crypto.js + inviteUtils.getMyCoach.
import { useState, useEffect, useContext, useRef } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { logger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js'
import { getMessages, markReadMany, markReadById, subscribeToMessages } from '../../lib/db/messages.js'
import { decryptMessage } from '../../lib/crypto.js'
import { getMyCoach } from '../../lib/inviteUtils.js'

function fmtTs(iso, lang) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  try {
    return d.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US',
      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return d.toISOString().slice(0, 16).replace('T', ' ') }
}

export default function CoachInbox() {
  const { t, lang } = useContext(LangCtx)
  const [coachId, setCoachId]   = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    let channel = null

    async function load() {
      if (!supabase) { setLoading(false); return }
      try {
        const athleteId = (await supabase.auth.getUser())?.data?.user?.id
        if (!athleteId) { if (aliveRef.current) setLoading(false); return }

        const cId = await getMyCoach(supabase, athleteId)
        if (!cId) { if (aliveRef.current) setLoading(false); return }
        if (!aliveRef.current) return
        setCoachId(cId)

        const { data, error } = await getMessages(cId, athleteId)
        if (error || !Array.isArray(data)) { if (aliveRef.current) setLoading(false); return }

        // Decrypt with the coach_id-derived key (same key the coach UI uses).
        const decrypted = await Promise.all(data.map(async m => ({
          ...m,
          text: await decryptMessage(m.body, cId).catch(() => null),
        })))
        if (!aliveRef.current) return
        setMessages(decrypted)
        setLoading(false)

        // Mark unread coach-sent messages read (athlete UPDATE RLS allows this).
        const unread = decrypted.filter(m => m.sender_role === 'coach' && !m.read_at).map(m => m.id)
        if (unread.length) markReadMany(unread).catch(e => logger.warn('[CoachInbox] markRead:', e?.message))

        // Live: append new coach messages as they arrive.
        channel = subscribeToMessages(cId, athleteId, async (payload) => {
          const row = payload?.new
          if (!row || row.sender_role !== 'coach') return
          const text = await decryptMessage(row.body, cId).catch(() => null)
          if (!aliveRef.current) return
          setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, { ...row, text }])
          markReadById(row.id).catch(() => { /* best-effort */ })
        })
      } catch (err) {
        logger.warn('[CoachInbox] load failed:', err?.message || err)
        if (aliveRef.current) setLoading(false)
      }
    }

    load()
    return () => {
      aliveRef.current = false
      if (channel) { try { channel.unsubscribe() } catch { /* noop */ } }
    }
  }, [])

  // Render nothing for athletes with no coach / no messages (no empty-card clutter).
  if (loading || !coachId || messages.length === 0) return null

  return (
    <div className="sp-card" style={{ ...S.card }}>
      <div style={S.cardTitle}>{t('coachInboxTitle')}</div>
      <div role="log" aria-label={t('coachInboxTitle')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(m => (
          <div key={m.id} style={{
            borderLeft: '3px solid #0064ff', padding: '6px 10px',
            background: 'var(--surface)', borderRadius: 4,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m.text ?? t('coachInboxUndecryptable')}
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{fmtTs(m.sent_at, lang)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 8 }}>{t('coachInboxReadOnly')}</div>
    </div>
  )
}
