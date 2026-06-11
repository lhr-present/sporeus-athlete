// ─── CoachMessage.jsx — Coach ↔ athlete message thread ────────────────────────
// Opened from CoachSquadView per-athlete "✉" button.
// Uses Supabase Realtime for live delivery + read receipt marking.

import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { encryptMessage, decryptMessage } from '../lib/crypto.js'
import { getMessages, markReadById, markReadMany, insertMessage, subscribeToMessages } from '../lib/db/messages.js'
export { buildChannelId } from '../lib/db/messages.js'
import { logAction } from '../lib/db/auditLog.js'
import { useMessageChannel } from '../hooks/useMessageChannel.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { logger } from '../lib/logger.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const _GREEN  = '#5bc25b'
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

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * CoachMessage
 * Props:
 *   athlete  — { athlete_id, display_name }
 *   coachId  — auth user id (coach)
 *   onClose  — close handler
 */
export default function CoachMessage({ athlete, coachId, onClose }) {
  const { lang, t } = useContext(LangCtx) || { lang: 'en', t: k => k }
  const [msgs,          setMsgs]          = useState([])
  const [input,         setInput]         = useState('')
  const [sending,       setSending]       = useState(false)
  const [error,         setError]         = useState(null)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const channelRef = useRef(null)
  const threadRef  = useRef(null)
  const panelRef   = useRef(null)
  // v9.367.0 — focus-trap the message panel + Esc-to-close (was keyboard-
  // inaccessible: no trap, no Escape, mouse-only backdrop).
  useFocusTrap(panelRef, { onEscape: onClose })

  // v9.369.0 — lift the bottom-anchored panel above the mobile keyboard. The
  // panel is position:fixed bottom:0, so the on-screen keyboard covered the
  // compose input. Track the keyboard inset via visualViewport and offset
  // `bottom` by it (no-op on desktop / browsers without visualViewport).
  const [kbInset, setKbInset] = useState(0)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const onResize = () => setKbInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [])

  const athleteId = athlete?.athlete_id

  // ── Broadcast channel: typing indicators + read receipts ─────────────────────
  const { sendTypingStart, sendTypingStop, sendRead } = useMessageChannel({
    coachId,
    athleteId: athleteId || '',
    userId: coachId,
    onTyping: setPartnerTyping,
    onRead: () => {
      // Partner read our messages — mark coach messages as visually read
      setMsgs(prev => prev.map(m =>
        m.sender_role === 'coach' && !m.read_at
          ? { ...m, read_at: new Date().toISOString() }
          : m
      ))
    },
  })

  // ── Load history ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!coachId || !athleteId) return
    // v9.362.0 — guard setState-after-unmount (decryptMessage is slow PBKDF2/AES;
    // a coach clicking through athletes unmounts mid-decrypt) + catch the
    // fetch/decrypt rejection so it isn't unhandled on a flaky network.
    let alive = true
    getMessages(coachId, athleteId).then(async ({ data, error: e }) => {
      if (!e && data) {
        const decrypted = await Promise.all(
          data.map(async m => ({ ...m, body: await decryptMessage(m.body, coachId) || m.body }))
        )
        if (!alive) return
        setMsgs(decrypted)
        markRead(decrypted)
        sendRead()  // broadcast + persist that coach has read the thread
        logAction('read', 'messages', athleteId, ['body'])
      }
    }).catch(err => logger.warn('[CoachMessage] history load:', err?.message))
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    sendTypingStop()
    const encryptedBody = await encryptMessage(body, coachId)
    const { error: e } = await insertMessage({ coachId, athleteId, encryptedBody })
    if (e) {
      setError(e.message)
    } else {
      setInput('')
    }
    setSending(false)
  }, [input, sending, coachId, athleteId, sendTypingStop])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value)
    sendTypingStart()
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
      <div ref={panelRef} role="dialog" aria-modal="true"
        aria-label={`${lang === 'tr' ? 'Mesajlar' : 'Messages'} — ${athlete.display_name || ''}`}
        style={{
        position: 'fixed', bottom: kbInset, right: 0,
        width: Math.min(420, window.innerWidth),
        height: Math.min(520, window.innerHeight * 0.8),
        maxHeight: `calc(100vh - ${kbInset + 8}px)`,  // fit above the keyboard
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
            aria-label={lang === 'tr' ? 'Mesajı kapat' : 'Close message'}
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

          {/* Typing indicator */}
          {partnerTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              <div style={{ padding: '5px 10px', background: '#1e1e1e', borderRadius: '10px 10px 10px 2px' }}>
                <span style={{ fontSize: 9, color: '#888', fontStyle: 'italic' }}>
                  {athlete.display_name} is typing
                  <span style={{ display: 'inline-block', animation: 'sporeus-pulse 1s ease-in-out infinite' }}>…</span>
                </span>
              </div>
            </div>
          )}
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
            onChange={handleInputChange}
            onKeyDown={handleKey}
            onBlur={sendTypingStop}
            placeholder={t('msgPlaceholder')}
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
            aria-label={t('sendMessage')}
            aria-busy={sending}
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
