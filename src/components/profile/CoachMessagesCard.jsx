import { useState, useEffect } from 'react'
import { S } from '../../styles.js'
import { logger } from '../../lib/logger.js'

const COACH_MSG_KEY = 'sporeus-coach-messages'
function readCoachMsgs()   { try { return JSON.parse(localStorage.getItem(COACH_MSG_KEY)) || [] } catch { return [] } }
function saveCoachMsgs(a)  { try { localStorage.setItem(COACH_MSG_KEY, JSON.stringify(a)) } catch (e) { logger.warn('localStorage:', e.message) } }

export default function CoachMessagesCard() {
  const [messages, setMessages] = useState(() => readCoachMsgs())
  const [reply,    setReply]    = useState('')

  // Mark coach messages as read on mount
  useEffect(() => {
    const updated = messages.map(m => m.from === 'coach' ? { ...m, read: true } : m)
    if (updated.some((m, i) => m.read !== messages[i].read)) {
      setMessages(updated); saveCoachMsgs(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- init: read coach messages from localStorage once on mount
  }, [])

  const sendReply = () => {
    const text = reply.trim()
    if (!text) return
    const msg = { id: Date.now() + Math.random().toString(36).slice(2, 5), from: 'athlete', text, ts: new Date().toISOString(), read: true }
    const updated = [...messages, msg]
    setMessages(updated); saveCoachMsgs(updated); setReply('')
  }

  if (!messages.length) return null

  return (
    <div style={{ ...S.card, marginBottom:'16px' }}>
      <div style={{ ...S.label, color:'#0064ff', marginBottom:'10px' }}>✉ COACH MESSAGES</div>
      <div style={{ maxHeight:'250px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px', marginBottom:'10px' }}>
        {messages.map(m => (
          <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: m.from === 'coach' ? 'flex-start' : 'flex-end' }}>
            <div style={{ maxWidth:'85%', padding:'7px 11px', borderRadius:'8px', background: m.from === 'coach' ? '#ff660015' : '#0064ff15', border:`1px solid ${m.from === 'coach' ? '#ff660033' : '#0064ff33'}` }}>
              <div style={{ ...S.mono, fontSize:'9px', color: m.from === 'coach' ? '#ff9944' : '#6699ff', letterSpacing:'0.06em', marginBottom:'3px' }}>
                {m.from === 'coach' ? 'COACH' : 'YOU'} · {new Date(m.ts).toLocaleDateString()}
              </div>
              <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.6, wordBreak:'break-word' }}>{m.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:'8px' }}>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
          placeholder="Reply to coach… (Enter to send)"
          rows={2}
          style={{ ...S.input, flex:1, fontSize:'11px', padding:'7px 9px', resize:'none', lineHeight:1.5 }}
        />
        <button
          onClick={sendReply}
          disabled={!reply.trim()}
          style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'6px 14px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'4px', cursor:'pointer', opacity: reply.trim() ? 1 : 0.4, alignSelf:'flex-end' }}>
          SEND
        </button>
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#555', marginTop:'6px' }}>
        Replies are saved locally and included in your data export.
      </div>
    </div>
  )
}

export function countUnreadCoachMessages() {
  try { return (JSON.parse(localStorage.getItem(COACH_MSG_KEY)) || []).filter(m => m.from === 'coach' && !m.read).length } catch (e) { logger.warn('localStorage:', e.message); return 0 }
}
