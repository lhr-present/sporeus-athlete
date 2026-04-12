// ─── coach/NotePanel.jsx — Slide-in athlete notes panel ──────────────────────
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const RED    = '#e03030'
const GREEN  = '#5bc25b'
const BLUE   = '#0064ff'
const GREY   = '#555'

const NOTE_CATS  = ['general','injury','wellness','technique','motivation']
const CAT_COLORS = { injury: RED, wellness: GREEN, technique: BLUE, motivation: ORANGE, general: GREY }

export default function NotePanel({ athlete, coachId, onClose }) {
  const [notes,    setNotes]    = useState([])
  const [body,     setBody]     = useState('')
  const [category, setCategory] = useState('general')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!athlete?.athlete_id?.startsWith('demo-')) loadNotes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.athlete_id])

  async function loadNotes() {
    if (!supabase || !coachId) return
    const { data } = await supabase
      .from('coach_notes')
      .select('id, created_at, category, note')
      .eq('coach_id', coachId)
      .eq('athlete_id', athlete.athlete_id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setNotes(data)
  }

  async function saveNote() {
    if (!body.trim()) return
    setSaving(true)
    if (supabase && coachId && !athlete.athlete_id.startsWith('demo-')) {
      await supabase.from('coach_notes').insert({
        coach_id: coachId, athlete_id: athlete.athlete_id, category, note: body.trim(),
      })
      await loadNotes()
    } else {
      setNotes(prev => [{ id: Date.now(), created_at: new Date().toISOString(), category, note: body.trim() }, ...prev.slice(0, 4)])
    }
    setBody('')
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(320px, 100vw)',
      background: '#111', borderLeft: '1px solid #2a2a2a', zIndex: 300,
      display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.6)',
    }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ORANGE }}>
          NOTES — {athlete.display_name.toUpperCase()}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontFamily: MONO, fontSize: 16 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {notes.length === 0 && <div style={{ fontFamily: MONO, fontSize: 10, color: '#444' }}>No notes yet.</div>}
        {notes.map(n => (
          <div key={n.id} style={{ marginBottom: 10, borderLeft: `3px solid ${CAT_COLORS[n.category] || GREY}44`, paddingLeft: 8 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: CAT_COLORS[n.category] || GREY, textTransform: 'uppercase' }}>{n.category}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#444' }}>{n.created_at?.slice(0, 10)}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#ccc', lineHeight: 1.5 }}>{n.note}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 14px', borderTop: '1px solid #222' }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...S.input, marginBottom: 8, fontSize: 10, textTransform: 'uppercase' }}>
          {NOTE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Add note…" rows={3}
          style={{ ...S.input, width: '100%', resize: 'vertical', marginBottom: 8, fontFamily: MONO, fontSize: 11, lineHeight: 1.5 }} />
        <button onClick={saveNote} disabled={saving || !body.trim()}
          style={{ width: '100%', padding: '8px', background: ORANGE, border: 'none', borderRadius: '3px', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: (!body.trim() || saving) ? 0.5 : 1 }}>
          {saving ? '…' : 'SAVE NOTE'}
        </button>
      </div>
    </div>
  )
}
