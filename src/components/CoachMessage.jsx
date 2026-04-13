// ─── CoachMessage.jsx — Coach ↔ athlete message thread ────────────────────────
// Opened from CoachSquadView per-athlete "✉" button.
// Uses Supabase Realtime for live delivery + read receipt marking.

import { useState, useEffect, useRef, useCallback } from 'react'
import { encryptMessage, decryptMessage } from '../lib/crypto.js'
import { getMessages, markReadById, markReadMany, insertMessage, subscribeToMessages } from '../lib/db/messages.js'
export { buildChannelId } from '../lib/db/messages.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const GREY   = '#555'

// ── Pure helpers (exported for unit tests) ────────────────────────────────────
// buildChannelId is re-exported from lib/db/messages.js above

/** HH:MM from ISO timestamp */
export function formatMsgTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d)) return ''
  return d.toTimeString().slice(0, 5)
}

/**
 * Count messages the viewer hasn't read yet.
 * viewerRole = 'coach' → messages sent by athlete without read_at
 * viewerRole = 'athlete' → messages sent by coach without read_at
 */
export function hasUnread(msgs, viewerRole) {
  if (!Array.isArray(msgs)) return 0
  const otherRole = viewerRole === 'coach' ? 'athlete' : 'coach'
  return msgs.filter(m => m.sender_role === otherRole && !m.read_at).length
}

/** True if senderRole is a valid participant */
export function canSendMessage(senderRole) {
  return senderRole === 'coach' || senderRole === 'athlete'
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * CoachMessage
 * Props:
 *   athlete  — { athlete_id, display_name }
 *   coachId  — auth user id (coach)
 *   onClose  — close handler
 */
export default function CoachMessage({ athlete, coachId, onClose }) {
  const [msgs,    setMsgs]    = useState([])
  const [input,   setInput]   = useState('')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState(null)
  const channelRef = useRef(null)
  const threadRef  = useRef(null)

  const athleteId = athlete?.athlete_id

  // ── Load history ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!coachId || !athleteId) return
    getMessages(coachId, athleteId).then(async ({ data, error: e }) => {
      if (!e && data) {
        const decrypted = await Promise.all(
          data.map(async m => ({ ...m, body: await decryptMessage(m.body, coachId) || m.body }))
        )
        setMsgs(decrypted)
        markRead(decrypted)
      }
    })
  }, [coachId, athleteId])

  // ── Realtime subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!coachId || !athleteId) return

    const ch = subscribeToMessages(coachId, athleteId, async payload => {
      const rawRow = payload.new
      if (rawRow.athlete_id !== athleteId) return
      const row = { ...rawRow, body: await decryptMessage(rawRow.body, coachId) || rawRow.body }
      setMsgs(prev => {
        if (prev.some(m => m.id === row.id)) return prev
        return [...prev, row]
      })
      if (row.sender_role === 'athlete') {
        markReadById(row.id).then(() => {})
      }
    })

    channelRef.current = ch
    return () => { ch?.unsubscribe() }
  }, [coachId, athleteId])

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [msgs])

  // ── Mark coach's incoming messages as read ────────────────────────────────────
  function markRead(allMsgs) {
    const unreadIds = allMsgs
      .filter(m => m.sender_role === 'athlete' && !m.read_at)
      .map(m => m.id)
    if (!unreadIds.length) return
    markReadMany(unreadIds).then(() => {
      setMsgs(prev => prev.map(m =>
        unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m
      ))
    })
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const body = input.trim()
    if (!body || sending || !coachId || !athleteId) return
    setSending(true)
    setError(null)
    const encryptedBody = await encryptMessage(body, coachId)
    const { error: e } = await insertMessage({ coachId, athleteId, encryptedBody })
    if (e) {
      setError(e.message)
    } else {
      setInput('')
    }
    setSending(false)
  }, [input, sending, coachId, athleteId])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!athlete) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 399 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 0, right: 0,
        width: Math.min(420, window.innerWidth),
        height: Math.min(520, window.innerHeight * 0.8),
        background: '#0d0d0d',
        border: '1px solid #2a2a2a',
        borderTopLeftRadius: 6,
        display: 'flex', flexDirection: 'column',
        zIndex: 400,
        fontFamily: MONO,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #1e1e1e',
          background: '#111',
        }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>
              ✉ MESSAGE
            </span>
            <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>
              {athlete.display_name}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: GREY, cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>

        {/* Thread */}
        <div ref={threadRef} style={{
          flex: 1, overflowY: 'auto', padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {msgs.length === 0 && (
            <div style={{ fontSize: 10, color: '#333', textAlign: 'center', marginTop: 24 }}>
              No messages yet. Send one to start the thread.
            </div>
          )}
          {msgs.map(m => {
            const isCoach = m.sender_role === 'coach'
            return (
              <div key={m.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isCoach ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '7px 11px',
                  borderRadius: isCoach ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  background: isCoach ? ORANGE : '#1e1e1e',
                  color: isCoach ? '#fff' : '#ccc',
                  fontSize: 11,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {m.body}
                </div>
                <div style={{ fontSize: 8, color: '#444', marginTop: 2, display: 'flex', gap: 6 }}>
                  <span>{formatMsgTime(m.sent_at)}</span>
                  {isCoach && (
                    <span style={{ color: m.read_at ? BLUE : '#333' }}>
                      {m.read_at ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 9, color: '#e03030', padding: '4px 14px' }}>
            {error}
          </div>
        )}

        {/* Input */}
        <div style={{
          display: 'flex', gap: 8, padding: '10px 14px',
          borderTop: '1px solid #1e1e1e',
          background: '#111',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message… (Enter to send)"
            rows={1}
            style={{
              flex: 1, resize: 'none', fontFamily: MONO, fontSize: 11,
              background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4,
              color: '#ddd', padding: '7px 10px', outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              padding: '0 14px', borderRadius: 4, cursor: 'pointer',
              background: input.trim() ? ORANGE : '#1a1a1a',
              color: input.trim() ? '#fff' : '#333',
              border: `1px solid ${input.trim() ? ORANGE : '#2a2a2a'}`,
              transition: 'background 0.15s',
            }}
          >
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </>
  )
}
