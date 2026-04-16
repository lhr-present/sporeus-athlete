import { useState } from 'react'
import { S } from '../../styles.js'
import { supabase } from '../../lib/supabase.js'

const FONT_MONO = { fontFamily: 'IBM Plex Mono, monospace' }
const _ORANGE = '#ff6600'
const MAX_LEN = 280

// ─── TeamAnnouncement ─────────────────────────────────────────────────────────
// Allows a coach to broadcast a short message to all athletes in their squad.
// Inserts a row into the team_announcements table (Supabase).
// Props: { coachId: string, athletes: array }
export default function TeamAnnouncement({ coachId, athletes }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  if (!coachId) return null

  const athleteCount = Array.isArray(athletes) ? athletes.length : 0

  async function handleSend() {
    const trimmed = message.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('team_announcements')
        .insert({
          coach_id:   coachId,
          message:    trimmed,
          created_at: new Date().toISOString(),
          read_by:    [],
        })

      if (insertError) throw insertError

      setSent(true)
      setMessage('')
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      setError(err?.message || 'Failed to send announcement.')
    } finally {
      setSending(false)
    }
  }

  const remaining = MAX_LEN - message.length
  const isOverLimit = remaining < 0
  const canSend = message.trim().length > 0 && !isOverLimit && !sending

  return (
    <div style={{ ...S.card }}>
      <div style={{ ...S.cardTitle, marginBottom: '10px' }}>TEAM ANNOUNCEMENT</div>

      <textarea
        style={{
          width: '100%',
          minHeight: '80px',
          resize: 'vertical',
          background: 'var(--input-bg)',
          border: `1px solid ${isOverLimit ? '#e03030' : 'var(--border)'}`,
          borderRadius: '4px',
          padding: '8px 10px',
          color: 'var(--text)',
          ...FONT_MONO,
          fontSize: '12px',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
        placeholder="Write a message to all your athletes…"
        value={message}
        maxLength={MAX_LEN + 20}  // slight buffer; real guard is canSend check
        onChange={e => setMessage(e.target.value)}
        disabled={sending}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <span style={{
          ...FONT_MONO,
          fontSize: '10px',
          color: isOverLimit ? '#e03030' : remaining < 40 ? '#f5c542' : 'var(--muted)',
        }}>
          {remaining} chars remaining
        </span>

        {sent ? (
          <span style={{ ...FONT_MONO, fontSize: '11px', color: '#5bc25b' }}>
            Sent to {athleteCount} athlete{athleteCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <button
            style={{
              ...S.btn,
              fontSize: '11px',
              padding: '6px 14px',
              opacity: canSend ? 1 : 0.45,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
            onClick={handleSend}
            disabled={!canSend}
          >
            {sending ? 'Sending…' : 'Send to all athletes'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ ...FONT_MONO, fontSize: '10px', color: '#e03030', marginTop: '6px' }}>
          {error}
        </div>
      )}
    </div>
  )
}
