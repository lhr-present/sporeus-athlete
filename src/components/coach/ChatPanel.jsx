// ─── coach/ChatPanel.jsx — AI coach chatbot panel ────────────────────────────
// Extracted from CoachSquadView.jsx. API calls go through ai-proxy edge function
// (key never in browser). Converted from streaming to one-shot response.

import { useState, useRef } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const MAX_MSGS = 10

/**
 * ChatPanel — squad AI chatbot.
 * Props: squad (array of athlete objects), isDemo (boolean)
 */
export default function ChatPanel({ squad, isDemo: _isDemo }) {
  const [open,   setOpen]   = useState(false)
  const [msgs,   setMsgs]   = useState([])
  const [input,  setInput]  = useState('')
  const [busy,   setBusy]   = useState(false)
  const threadRef = useRef(null)

  const scrollDown = () => setTimeout(() => {
    threadRef.current?.scrollTo({ top: 9999, behavior: 'smooth' })
  }, 30)

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setMsgs(prev => [...prev.slice(-(MAX_MSGS - 1)), { role: 'user', text: q }])
    setBusy(true)
    scrollDown()

    // Seed empty AI bubble
    setMsgs(prev => [...prev, { role: 'ai', text: '' }])

    try {
      if (!isSupabaseReady()) throw new Error('Not connected — sign in to use AI chat')

      const system = 'You are an expert endurance coach assistant. Answer questions about the squad data provided. Be concise and practical. Under 150 words unless more detail is clearly needed.'
      const user_msg = `Squad (${squad.length} athletes):\n${squad.map(a =>
        `${a.display_name}: CTL=${a.today_ctl}, TSB=${a.today_tsb}, ACWR=${a.acwr_ratio ?? '—'}, Well=${a.adherence_pct}%`
      ).join('\n')}\n\nQuestion: ${q}`

      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { model_alias: 'haiku', system, user_msg, max_tokens: 512 },
      })

      if (error) throw new Error(error.message || 'AI proxy error')
      if (data?.error) throw new Error(data.error)

      const reply = data?.content || '(no response)'
      setMsgs(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === 'ai') copy[copy.length - 1] = { role: 'ai', text: reply }
        return copy
      })
    } catch (e) {
      setMsgs(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === 'ai') copy[copy.length - 1] = { role: 'ai', text: `⚠ ${e.message}`, error: true }
        return copy
      })
    }

    setBusy(false)
    scrollDown()
  }

  if (!open) {
    return (
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button
          onClick={() => setOpen(true)}
          style={S.smBtn}
        >
          ◈ ASK AI
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14, border: `1px solid ${ORANGE}44`, borderRadius: 4, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0d0d0d', borderBottom: '1px solid #1e1e1e' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>◈ AI COACH</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {msgs.length > 0 && (
            <button onClick={() => setMsgs([])} style={S.ghostBtn}>CLEAR</button>
          )}
          <button onClick={() => setOpen(false)} style={{ ...S.ghostBtn, fontSize: 10 }}>▼</button>
        </div>
      </div>

      {/* Thread */}
      <div ref={threadRef} style={{ maxHeight: 280, overflowY: 'auto', padding: '10px 12px', background: '#070707', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.length === 0 && (
          <div style={{ ...S.dimText, fontSize: 10, textAlign: 'center', marginTop: 20 }}>
            Ask about your squad — readiness, load, who to push, who to rest.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              fontFamily: MONO, fontSize: 11, lineHeight: 1.7, padding: '6px 10px', borderRadius: 4, maxWidth: '85%',
              background:  m.role === 'user' ? ORANGE : '#1a1a1a',
              color:       m.error ? '#e03030' : m.role === 'user' ? '#fff' : '#d0d0d0',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.text || (busy && i === msgs.length - 1 ? '●●●' : '')}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about your squad..."
          disabled={busy}
          style={{ flex: 1, fontFamily: MONO, fontSize: 11, background: 'transparent', border: 'none', outline: 'none', padding: '10px 12px', color: '#e0e0e0' }}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '8px 16px', background: busy ? '#222' : ORANGE, border: 'none', color: busy ? '#555' : '#fff', cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          {busy ? '…' : '↵'}
        </button>
      </div>
    </div>
  )
}
