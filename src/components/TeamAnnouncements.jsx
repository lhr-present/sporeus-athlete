// ─── TeamAnnouncements.jsx — Coach broadcasts + athlete read ─────────────────
// Coach view: compose (280-char limit) + post + delete list
// Athlete view: newest-first list with unread badge, dismiss on click
import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import {
  getAnnouncements, postAnnouncement, deleteAnnouncement,
  markLocalRead, markAllLocalRead, filterUnread,
} from '../lib/db/teamAnnouncements.js'

const MONO = "'IBM Plex Mono', monospace"

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Coach compose + list ───────────────────────────────────────────────────────
function CoachAnnouncementPanel({ coachId, lang }) {
  const { t } = useContext(LangCtx)
  const [items, setItems]   = useState([])
  const [draft, setDraft]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [toast, setToast]   = useState('')
  const [loading, setLoading] = useState(true)

  const MAX = 280

  useEffect(() => {
    let alive = true
    getAnnouncements(coachId).then(({ data }) => {
      if (alive) { setItems(data || []); setLoading(false) }
    })
    return () => { alive = false }
  }, [coachId])

  async function handlePost() {
    const msg = draft.trim()
    if (!msg || busy) return
    setBusy(true)
    const { data, error } = await postAnnouncement(coachId, msg)
    setBusy(false)
    if (error) { setToast(lang === 'tr' ? 'Hata: gönderilemedi' : 'Error: could not post'); setTimeout(() => setToast(''), 3000); return }
    setItems(prev => [data, ...prev])
    setDraft('')
    setToast(lang === 'tr' ? '✓ Yayınlandı' : '✓ Posted')
    setTimeout(() => setToast(''), 2500)
  }

  async function handleDelete(id) {
    await deleteAnnouncement(id)
    setItems(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div>
      {/* Compose */}
      <div style={{ marginBottom: '12px' }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value.slice(0, MAX))}
          placeholder={lang === 'tr' ? 'Takıma duyuru yaz… (maks. 280 karakter)' : 'Write an announcement to your squad… (max 280 chars)'}
          rows={3}
          style={{
            width: '100%', resize: 'vertical', fontFamily: MONO, fontSize: '11px',
            background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: '3px', padding: '8px', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: draft.length > 260 ? '#e03030' : '#555' }}>
            {draft.length}/{MAX}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {toast && <span style={{ fontFamily: MONO, fontSize: '10px', color: '#5bc25b' }}>{toast}</span>}
            <button
              onClick={handlePost}
              disabled={!draft.trim() || busy}
              style={{ ...S.btn, fontSize: '11px', padding: '5px 14px', opacity: (!draft.trim() || busy) ? 0.45 : 1 }}>
              {busy ? '…' : (lang === 'tr' ? 'Yayınla' : 'Post')}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555' }}>
          {lang === 'tr' ? 'Yükleniyor…' : 'Loading…'}
        </div>
      ) : items.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555' }}>
          {lang === 'tr' ? 'Henüz duyuru yok.' : 'No announcements yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(a => (
            <div key={a.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '3px', padding: '10px 12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text)', lineHeight: 1.5 }}>
                  {a.message}
                </div>
                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginTop: '4px' }}>
                  {timeAgo(a.created_at)}
                </div>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                title={lang === 'tr' ? 'Sil' : 'Delete'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '13px', padding: '0 2px', flexShrink: 0 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Athlete read view ──────────────────────────────────────────────────────────
function AthleteAnnouncementPanel({ coachId, lang }) {
  const [items, setItems]     = useState([])
  const [unread, setUnread]   = useState([])
  const [loading, setLoading] = useState(true)

  function refresh(data) {
    setItems(data)
    setUnread(filterUnread(data))
  }

  useEffect(() => {
    let alive = true
    getAnnouncements(coachId).then(({ data }) => {
      if (alive) { refresh(data || []); setLoading(false) }
    })
    return () => { alive = false }
  }, [coachId])

  function dismiss(id) {
    markLocalRead(id)
    setUnread(prev => prev.filter(a => a.id !== id))
  }

  function dismissAll() {
    markAllLocalRead(items.map(a => a.id))
    setUnread([])
  }

  if (loading) return (
    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555' }}>
      {lang === 'tr' ? 'Yükleniyor…' : 'Loading…'}
    </div>
  )
  if (items.length === 0) return (
    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555' }}>
      {lang === 'tr' ? 'Antrenörünüzden henüz duyuru yok.' : 'No announcements from your coach yet.'}
    </div>
  )

  return (
    <div>
      {unread.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: '#ff6600', fontWeight: 600 }}>
            {unread.length} {lang === 'tr' ? 'okunmamış' : 'unread'}
          </span>
          <button onClick={dismissAll} style={{ fontFamily: MONO, fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#555', textDecoration: 'underline' }}>
            {lang === 'tr' ? 'Tümünü oku' : 'Mark all read'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(a => {
          const isUnread = filterUnread([a]).length > 0
          return (
            <div key={a.id} style={{
              background: isUnread ? 'var(--surface)' : 'transparent',
              border: `1px solid ${isUnread ? '#ff6600' : 'var(--border)'}`,
              borderRadius: '3px', padding: '10px 12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px',
              transition: 'all 0.2s',
            }}>
              <div style={{ flex: 1 }}>
                {isUnread && (
                  <span style={{ fontFamily: MONO, fontSize: '8px', color: '#ff6600', fontWeight: 700, letterSpacing: '0.08em', marginRight: '6px' }}>
                    NEW
                  </span>
                )}
                <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text)', lineHeight: 1.5 }}>
                  {a.message}
                </span>
                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginTop: '4px' }}>
                  {timeAgo(a.created_at)}
                </div>
              </div>
              {isUnread && (
                <button
                  onClick={() => dismiss(a.id)}
                  title={lang === 'tr' ? 'Okundu işaretle' : 'Mark read'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6600', fontSize: '11px', padding: '0 2px', flexShrink: 0, fontFamily: MONO }}>
                  ✓
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main export — auto-selects coach or athlete view ──────────────────────────
/**
 * @param {{ coachId: string, isCoach: boolean }} props
 */
export default function TeamAnnouncements({ coachId, isCoach }) {
  const { lang } = useContext(LangCtx)
  const [open, setOpen] = useState(true)

  if (!coachId) return null

  return (
    <div style={{ ...S.card, animationDelay: '100ms' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: open ? '12px' : 0 }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ ...S.cardTitle }}>
          ◈ {lang === 'tr' ? 'TAKIMA DUYURULAR' : 'TEAM ANNOUNCEMENTS'}
        </div>
        <span style={{ fontFamily: MONO, fontSize: '12px', color: '#555' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        isCoach
          ? <CoachAnnouncementPanel coachId={coachId} lang={lang} />
          : <AthleteAnnouncementPanel coachId={coachId} lang={lang} />
      )}
    </div>
  )
}

// ── Exported unread count hook for TodayView badge ────────────────────────────
export function useAnnouncementUnreadCount(coachId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!coachId) return
    getAnnouncements(coachId).then(({ data }) => {
      setCount(data ? filterUnread(data).length : 0)
    })
  }, [coachId])
  return count
}
