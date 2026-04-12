// ─── WeekBuilder.jsx — 7-day drag-and-drop micro-cycle planner ───────────────
// Full-screen overlay. HTML5 drag API only — no external DnD packages.
import { useState, useCallback } from 'react'

const MONO = "'IBM Plex Mono', monospace"

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const SESSION_TEMPLATES = [
  { id: 'long-run',       label: 'Long Run',         type: 'run',  duration: 90,  tss: 90,  zone: 'Z2' },
  { id: 'threshold-run',  label: 'Threshold Run',     type: 'run',  duration: 50,  tss: 70,  zone: 'Z4' },
  { id: 'easy-run',       label: 'Easy Run',          type: 'run',  duration: 45,  tss: 35,  zone: 'Z1' },
  { id: 'vo2max',         label: 'VO₂max Intervals',  type: 'run',  duration: 40,  tss: 65,  zone: 'Z5' },
  { id: 'long-ride',      label: 'Long Ride',         type: 'bike', duration: 120, tss: 100, zone: 'Z2' },
  { id: 'tempo-ride',     label: 'Tempo Ride',        type: 'bike', duration: 60,  tss: 75,  zone: 'Z3' },
  { id: 'recovery-ride',  label: 'Recovery Ride',     type: 'bike', duration: 45,  tss: 30,  zone: 'Z1' },
  { id: 'swim',           label: 'Swim',              type: 'swim', duration: 45,  tss: 40,  zone: 'Z2' },
  { id: 'strength',       label: 'Strength',          type: 'str',  duration: 50,  tss: 35,  zone: 'Z3' },
  { id: 'rest',           label: 'Rest Day',          type: 'rest', duration: 0,   tss: 0,   zone: '—'  },
]

const TYPE_ICONS  = { run: '🏃', bike: '🚴', swim: '🏊', str: '💪', rest: '😴' }
const ZONE_COLORS = { Z1:'#5bc25b', Z2:'#4a9eff', Z3:'#ff6600', Z4:'#e0a030', Z5:'#e03030', '—':'#555' }

function SessionCard({ session, draggable, onDragStart, onRemove, compact }) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      style={{
        background:   '#0d0d0d',
        border:       '1px solid #2a2a2a',
        borderLeft:   `3px solid ${ZONE_COLORS[session.zone] || '#555'}`,
        borderRadius: 4,
        padding:      compact ? '5px 8px' : '8px 10px',
        cursor:       draggable ? 'grab' : 'default',
        marginBottom: compact ? 3 : 6,
        userSelect:   'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: compact ? 10 : 13 }}>
          {TYPE_ICONS[session.type] || '●'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: compact ? 9 : 10, fontWeight: 700, color: '#ccc' }}>
            {session.label}
          </div>
          {!compact && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: '#555', marginTop: 2 }}>
              {session.duration > 0 ? `${session.duration}min · ${session.tss} TSS` : 'Rest'}
              {' · '}
              <span style={{ color: ZONE_COLORS[session.zone] || '#555' }}>{session.zone}</span>
            </div>
          )}
          {compact && session.duration > 0 && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: '#555' }}>
              {session.duration}min · {session.tss}TSS
            </div>
          )}
        </div>
        {onRemove && (
          <button onClick={onRemove} style={{
            fontFamily: MONO, fontSize: 11, background: 'transparent',
            border: 'none', color: '#444', cursor: 'pointer', lineHeight: 1, flexShrink: 0,
          }}>✕</button>
        )}
      </div>
    </div>
  )
}

export default function WeekBuilder({ week, onClose }) {
  // days[i] = array of session objects for that day (Mon=0 … Sun=6)
  const [days, setDays] = useState(() => {
    try {
      const stored = localStorage.getItem(`sporeus-week-${week.weekStart}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length === 7) return parsed
      }
    } catch {}
    return Array.from({ length: 7 }, () => [])
  })

  const [dragOverDay,  setDragOverDay]  = useState(null)
  const [saved,        setSaved]        = useState(false)

  const totalTSS    = days.flat().reduce((s, s2) => s + (s2.tss || 0), 0)
  const totalSess   = days.flat().length
  const totalHours  = (days.flat().reduce((s, s2) => s + (s2.duration || 0), 0) / 60).toFixed(1)
  const overTarget  = week.targetTSS > 0 && totalTSS > week.targetTSS * 1.2

  // ── Drag from library ────────────────────────────────────────────────────────
  const handleLibraryDragStart = useCallback((e, template) => {
    e.dataTransfer.setData('session', JSON.stringify({ ...template, _id: Date.now() }))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  // ── Drag existing session between days ───────────────────────────────────────
  const handleSessionDragStart = useCallback((e, dayIdx, sessionIdx) => {
    const session = days[dayIdx][sessionIdx]
    e.dataTransfer.setData('session', JSON.stringify({
      ...session,
      _fromDay: dayIdx,
      _fromIdx: sessionIdx,
    }))
    e.dataTransfer.effectAllowed = 'move'
  }, [days])

  // ── Drop onto a day cell ─────────────────────────────────────────────────────
  const handleDrop = useCallback((e, targetDay) => {
    e.preventDefault()
    setDragOverDay(null)
    try {
      const raw     = e.dataTransfer.getData('session')
      if (!raw) return
      const session = JSON.parse(raw)
      const { _fromDay, _fromIdx, _id, ...clean } = session

      setDays(prev => {
        const next = prev.map(d => [...d])
        // Remove from source day if dragging between days
        if (typeof _fromDay === 'number' && _fromDay !== targetDay) {
          next[_fromDay].splice(_fromIdx, 1)
        }
        // Don't duplicate if dropped on same day
        if (typeof _fromDay === 'number' && _fromDay === targetDay) return prev
        next[targetDay].push({ ...clean, _id: Date.now() + Math.random() })
        return next
      })
      setSaved(false)
    } catch {}
  }, [])

  const handleDragOver = useCallback((e, dayIdx) => {
    e.preventDefault()
    setDragOverDay(dayIdx)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverDay(null)
  }, [])

  const removeSession = useCallback((dayIdx, sessIdx) => {
    setDays(prev => {
      const next = prev.map(d => [...d])
      next[dayIdx].splice(sessIdx, 1)
      return next
    })
    setSaved(false)
  }, [])

  const handleSave = () => {
    try {
      localStorage.setItem(`sporeus-week-${week.weekStart}`, JSON.stringify(days))
      setSaved(true)
    } catch {}
  }

  return (
    <div style={{
      position:   'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.96)',
      display:    'flex', flexDirection: 'column',
      fontFamily: MONO,
    }}>
      {/* Header */}
      <div style={{
        display:        'flex', alignItems: 'center', justifyContent: 'space-between',
        padding:        '12px 20px',
        borderBottom:   '1px solid #1a1a1a',
        background:     '#0a0a0a',
        flexShrink:     0,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ff6600', letterSpacing: '0.08em' }}>
            WEEK BUILDER
          </div>
          <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>
            WEEK {week.weekNum} — {week.phase.toUpperCase()} — {week.weekStart} · Target: {week.targetTSS} TSS
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            padding: '7px 16px', background: saved ? '#2d6a2d' : '#0064ff',
            border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer',
          }}>
            {saved ? '✓ SAVED' : '↓ SAVE WEEK'}
          </button>
          <button onClick={onClose} style={{
            fontFamily: MONO, fontSize: 10, padding: '7px 12px',
            background: 'transparent', border: '1px solid #333',
            color: '#888', borderRadius: 4, cursor: 'pointer',
          }}>CLOSE</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* ── Left sidebar: session library ── */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: '1px solid #1a1a1a',
          padding: '12px 10px',
          overflowY: 'auto',
          background: '#080808',
        }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 10 }}>
            SESSION LIBRARY
          </div>
          <div style={{ fontSize: 8, color: '#333', marginBottom: 8 }}>
            Drag sessions onto the days →
          </div>
          {SESSION_TEMPLATES.map(t => (
            <div
              key={t.id}
              draggable
              onDragStart={e => handleLibraryDragStart(e, t)}
            >
              <SessionCard session={t} draggable={false} />
            </div>
          ))}
        </div>

        {/* ── 7-day grid ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Day headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
            {DAYS.map((day, i) => (
              <div key={day} style={{
                flex: 1, padding: '8px 6px',
                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                color: (i === 5 || i === 6) ? '#0064ff' : '#666',
                letterSpacing: '0.08em', textAlign: 'center',
                borderRight: i < 6 ? '1px solid #111' : 'none',
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {DAYS.map((day, dayIdx) => (
              <div
                key={day}
                onDrop={e => handleDrop(e, dayIdx)}
                onDragOver={e => handleDragOver(e, dayIdx)}
                onDragLeave={handleDragLeave}
                style={{
                  flex: 1,
                  padding:        '6px',
                  overflowY:      'auto',
                  background:     dragOverDay === dayIdx ? 'rgba(0,100,255,0.06)' : 'transparent',
                  border:         dragOverDay === dayIdx ? '1px dashed #0064ff88' : '1px solid transparent',
                  borderRight:    dayIdx < 6 ? '1px solid #111' : 'none',
                  transition:     'background 0.1s',
                  minHeight:      80,
                  boxSizing:      'border-box',
                }}
              >
                {/* Day's sessions */}
                {days[dayIdx].map((sess, si) => (
                  <div
                    key={si}
                    draggable
                    onDragStart={e => handleSessionDragStart(e, dayIdx, si)}
                  >
                    <SessionCard
                      session={sess}
                      draggable={false}
                      compact
                      onRemove={() => removeSession(dayIdx, si)}
                    />
                  </div>
                ))}

                {/* Drop hint */}
                {days[dayIdx].length === 0 && dragOverDay !== dayIdx && (
                  <div style={{
                    height: 40, border: '1px dashed #1a1a1a', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO, fontSize: 8, color: '#2a2a2a',
                  }}>
                    drop here
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Bottom summary bar ── */}
          <div style={{
            borderTop:  '1px solid #1a1a1a',
            padding:    '8px 12px',
            background: '#080808',
            display:    'flex',
            alignItems: 'center',
            gap:        24,
            flexShrink: 0,
            flexWrap:   'wrap',
          }}>
            <div style={{ fontSize: 10, color: overTarget ? '#e03030' : '#888' }}>
              <span style={{ color: overTarget ? '#e03030' : '#ff6600', fontWeight: 700, fontSize: 13 }}>
                {totalTSS}
              </span>
              <span style={{ color: '#444' }}> / {week.targetTSS} TSS target</span>
            </div>
            <div style={{ fontSize: 10, color: '#666' }}>
              <span style={{ fontWeight: 700 }}>{totalSess}</span> sessions
            </div>
            <div style={{ fontSize: 10, color: '#666' }}>
              <span style={{ fontWeight: 700 }}>{totalHours}h</span> planned
            </div>
            {overTarget && (
              <div style={{ fontSize: 10, color: '#e03030' }}>
                ⚠ Over target by {totalTSS - week.targetTSS} TSS
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
