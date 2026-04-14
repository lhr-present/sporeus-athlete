// ─── coach/SessionManager.jsx — Coach session scheduling + RSVP overview ──────
import { useState, useCallback } from 'react'
import { S } from '../../styles.js'
import { createSession, getUpcomingSessions, getSessionAttendance, aggregateAttendance } from '../../lib/db/coachSessions.js'
import { useAsync } from '../../hooks/useAsync.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const YELLOW = '#f5c542'
const RED    = '#e03030'
const GREY   = '#555'

function attendanceColor(status) {
  return status === 'confirmed' ? GREEN : status === 'declined' ? RED : GREY
}

/**
 * SessionManager — coach-side panel for scheduling sessions and viewing RSVP counts.
 * @param {object} props
 * @param {string} props.coachId — Supabase user id of the coach
 * @param {string} [props.lang='en']
 */
export default function SessionManager({ coachId, lang = 'en' }) {
  const [creating,    setCreating]    = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [expanded,    setExpanded]    = useState(null)   // sessionId with detail open
  const [attendance,  setAttendance]  = useState({})     // { [sessionId]: { confirmed, declined, pending, total } }
  const [form, setForm] = useState({ title: '', session_date: '', session_time: '', notes: '' })
  const [err, setErr]   = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const fetchSessions = useCallback(async (signal) => {
    const { data } = await getUpcomingSessions(coachId, 21)
    return data || []
  }, [coachId])

  const { data: sessions = [], loading, execute: loadSessions } = useAsync(
    fetchSessions,
    [coachId],
    { immediate: !!coachId }
  )

  const loadAttendance = async (sessionId) => {
    if (attendance[sessionId]) return  // already loaded
    const { data } = await getSessionAttendance(sessionId)
    if (data) {
      setAttendance(prev => ({ ...prev, [sessionId]: aggregateAttendance(data) }))
    }
  }

  const handleExpand = async (sessionId) => {
    const next = expanded === sessionId ? null : sessionId
    setExpanded(next)
    if (next) await loadAttendance(next)
  }

  const handleCreate = async () => {
    setErr('')
    if (!form.title.trim()) { setErr('Title is required'); return }
    if (!form.session_date) { setErr('Date is required'); return }
    if (form.session_date < today) { setErr('Date must be today or future'); return }
    setCreating(true)
    const { error } = await createSession(coachId, form)
    setCreating(false)
    if (error) { setErr(error.message || 'Failed to create session'); return }
    setForm({ title: '', session_date: '', session_time: '', notes: '' })
    setShowForm(false)
    await loadSessions()
  }

  const fmtDate = (d) => {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  const isTR = lang === 'tr'

  return (
    <div style={{ fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: '#666', letterSpacing: '0.12em' }}>
          {isTR ? 'OTURUM PLANLAYICI' : 'SESSION PLANNER'}
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setErr('') }}
          style={{ ...S.smBtn, fontSize: '10px' }}
        >
          {showForm ? '▲' : '+ ' + (isTR ? 'OTURUM EKLE' : 'NEW SESSION')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: `1px solid ${ORANGE}44`, borderRadius: '4px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', color: ORANGE, letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 700 }}>
            {isTR ? 'YENİ OTURUM' : 'NEW SESSION'}
          </div>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={isTR ? 'Başlık (örn. Tempo Koşusu)' : 'Title (e.g. Tempo Run)'}
            style={{ ...S.input, width: '100%', marginBottom: '8px', fontSize: '11px' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="date"
              value={form.session_date}
              min={today}
              onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
              style={{ ...S.input, flex: 1, fontSize: '11px' }}
            />
            <input
              type="time"
              value={form.session_time}
              onChange={e => setForm(f => ({ ...f, session_time: e.target.value }))}
              style={{ ...S.input, flex: 1, fontSize: '11px' }}
            />
          </div>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={isTR ? 'Notlar (opsiyonel)' : 'Notes (optional)'}
            rows={2}
            style={{ ...S.input, width: '100%', resize: 'vertical', marginBottom: '8px', fontSize: '11px', fontFamily: MONO }}
          />
          {err && <div style={{ fontSize: '10px', color: RED, marginBottom: '6px' }}>⚠ {err}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{ flex: 1, padding: '8px', background: creating ? '#333' : ORANGE, border: 'none', borderRadius: '3px', fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: creating ? GREY : '#fff', cursor: creating ? 'not-allowed' : 'pointer' }}
            >
              {creating ? '…' : (isTR ? 'OLUŞTUR' : 'CREATE')}
            </button>
            <button onClick={() => { setShowForm(false); setErr('') }} style={{ ...S.btnSec, fontSize: '11px', padding: '8px 14px' }}>
              {isTR ? 'İPTAL' : 'CANCEL'}
            </button>
          </div>
        </div>
      )}

      {/* Session list */}
      {loading && (
        <div style={{ fontSize: '10px', color: GREY }}>
          {isTR ? 'Yükleniyor…' : 'Loading…'}
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{ fontSize: '10px', color: '#444', padding: '12px 0' }}>
          {isTR ? 'Yaklaşan oturum yok. Bir tane oluştur.' : 'No upcoming sessions. Create one above.'}
        </div>
      )}

      {sessions.map(s => {
        const att = attendance[s.id]
        const isOpen = expanded === s.id
        return (
          <div key={s.id} style={{ border: '1px solid #2a2a2a', borderRadius: '4px', marginBottom: '8px', overflow: 'hidden' }}>
            {/* Row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleExpand(s.id)}
              onKeyDown={e => e.key === 'Enter' && handleExpand(s.id)}
              style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 12px', cursor: 'pointer', background: isOpen ? 'var(--surface)' : 'transparent' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 600 }}>{s.title}</div>
                <div style={{ fontSize: '9px', color: GREY, marginTop: '2px' }}>
                  {fmtDate(s.session_date)}{s.session_time ? ' · ' + s.session_time : ''}
                </div>
              </div>
              {att && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '9px', color: GREEN }}>{att.confirmed}✓</span>
                  <span style={{ fontSize: '9px', color: RED }}>{att.declined}✗</span>
                  <span style={{ fontSize: '9px', color: GREY }}>{att.pending}?</span>
                </div>
              )}
              <span style={{ fontSize: '10px', color: '#444' }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Detail (RSVP counts) */}
            {isOpen && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid #1e1e1e', background: '#0a0a0a' }}>
                {att ? (
                  <>
                    <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>
                      {isTR ? 'KATILIM DURUMU' : 'ATTENDANCE'}
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {(['confirmed', 'declined', 'pending']).map(st => (
                        <div key={st} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: attendanceColor(st) }}>
                            {att[st]}
                          </div>
                          <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {isTR
                              ? st === 'confirmed' ? 'Katılıyor' : st === 'declined' ? 'Katılmıyor' : 'Bekliyor'
                              : st}
                          </div>
                        </div>
                      ))}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#888' }}>{att.total}</div>
                        <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {isTR ? 'Toplam' : 'Total'}
                        </div>
                      </div>
                    </div>
                    {s.notes && (
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '10px', lineHeight: 1.5 }}>
                        {s.notes}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '10px', color: GREY }}>{isTR ? 'Yükleniyor…' : 'Loading…'}</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
