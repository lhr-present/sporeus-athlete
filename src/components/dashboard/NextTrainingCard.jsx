// ─── dashboard/NextTrainingCard.jsx — hero "next training" tile ─────────────
//
// v9.4.0. Mounted at the top of ProgramView (and reusable inside TodayView)
// so the athlete always sees what's next at a glance: today's session if
// active, otherwise the next non-rest day in the next 14d window.
//
// Color-coded by phase + intensity. Shows duration, pace target, phase
// chip, countdown ("today" / "tomorrow" / "in 3 days"). When the next
// training is today, shows the full session detail; otherwise compact.

import { memo, useContext, useMemo, useState  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { useData } from '../../contexts/DataContext.jsx'
import {
  getTodayProgrammedSession,
  getNextProgrammedSession,
} from '../../lib/athlete/todayProgrammedSession.js'
import { buildLogEntryFromSession } from '../../lib/athlete/quickLogFromSession.js'

const PHASE_COLOR = {
  Base:  '#0064ff',
  Build: '#00aa66',
  Peak:  '#ff6600',
  Taper: '#9966cc',
}

function intensityChip(text) {
  if (!text || typeof text !== 'string') return null
  if (/race/i.test(text)) return { label: 'RACE', bg: '#dc3545' }
  if (/VO2|@I-pace|I-pace|interval|95-100% HRmax/i.test(text)) return { label: 'VO2', bg: '#dc3545' }
  if (/Threshold|@T-pace|cruise|sweet[- ]spot|CSS/i.test(text)) return { label: 'THR', bg: '#ff6600' }
  if (/Tempo|M-pace/i.test(text)) return { label: 'TMP', bg: '#0064ff' }
  if (/Long\b/i.test(text)) return { label: 'LONG', bg: '#0a8a8a' }
  if (/Easy|recovery|Z1|Z2/i.test(text)) return { label: 'EASY', bg: '#00aa66' }
  if (/Strides?|@R/i.test(text)) return { label: 'R', bg: '#9966cc' }
  if (/Strength/i.test(text)) return { label: 'STR', bg: '#7d4a00' }
  return null
}

function bil(field, isTR) {
  if (!field) return ''
  if (typeof field === 'string') return field
  return isTR ? (field.tr || field.en || '') : (field.en || '')
}

function relativeDay(daysAhead, isTR) {
  if (daysAhead === 0) return isTR ? 'BUGÜN' : 'TODAY'
  if (daysAhead === 1) return isTR ? 'YARIN' : 'TOMORROW'
  return isTR ? `${daysAhead} GÜN SONRA` : `IN ${daysAhead} DAYS`
}

function NextTrainingCard({ defaultProgram, defaultProgramStart }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const { log, setLog, profile: _profile } = useData()
  const [persisted] = useLocalStorage('sporeus-eliteProgram', null)
  const [storedStart] = useLocalStorage('sporeus-eliteProgramStart', null)
  const [logState, setLogState] = useState(null)

  const program = defaultProgram || persisted
  const programStart = defaultProgramStart || storedStart

  const session = useMemo(() => {
    if (!program || !programStart) return null
    // Today first; if today is a rest day, fall through to next.
    const t = getTodayProgrammedSession(program, undefined, programStart)
    if (t && t.reliable && !t.isRest && t.durationMin > 0) {
      return { ...t, daysAhead: 0 }
    }
    return getNextProgrammedSession(program, undefined, programStart)
  }, [program, programStart])

  if (!program || !programStart) {
    return (
      <div data-next-training="empty"
        style={{
          ...S.mono,
          fontSize: 11,
          padding: '14px',
          marginBottom: 14,
          border: '1px dashed var(--border)',
          borderRadius: 4,
          color: 'var(--muted)',
          textAlign: 'center',
        }}>
        {isTR
          ? 'Bir sonraki antrenman burada görünecek — önce planı oluştur.'
          : 'Your next training will appear here — generate a plan first.'}
      </div>
    )
  }

  if (!session) {
    return (
      <div data-next-training="none"
        style={{
          ...S.mono,
          fontSize: 11,
          padding: '14px',
          marginBottom: 14,
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--muted)',
        }}>
        {isTR
          ? 'Önümüzdeki 14 günde planlanan kalite seansı yok (dinlenme/kolay haftası).'
          : 'No quality session scheduled in the next 14 days (rest/easy week).'}
      </div>
    )
  }

  const phaseColor = PHASE_COLOR[session.phase] || '#666'
  const intent = bil(session.intent, isTR)
  const chip = intensityChip(intent)
  const phaseLabel = session.phase || ''

  return (
    <div data-next-training="loaded"
      style={{
        marginBottom: 14,
        border: `2px solid ${phaseColor}`,
        borderLeft: `6px solid ${phaseColor}`,
        borderRadius: 4,
        background: `linear-gradient(135deg, ${phaseColor}18 0%, transparent 50%)`,
        overflow: 'hidden',
      }}>
      <div style={{
        ...S.mono,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: phaseColor,
        color: '#fff',
        fontSize: 10,
        letterSpacing: '0.08em',
        fontWeight: 700,
      }}>
        <span>⚡ {isTR ? 'BİR SONRAKİ ANTRENMAN' : 'NEXT TRAINING'}</span>
        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 3 }}>
          {relativeDay(session.daysAhead || 0, isTR)}
        </span>
      </div>

      <div style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {chip ? (
            <span style={{
              background: chip.bg, color: '#fff',
              padding: '3px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              borderRadius: 3,
            }}>{chip.label}</span>
          ) : null}
          <span style={{
            background: phaseColor, color: '#fff',
            padding: '3px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            borderRadius: 3,
          }}>{phaseLabel.toUpperCase()}</span>
          <span style={{ ...S.mono, fontSize: 9, color: 'var(--muted)' }}>
            {isTR ? `H${session.weekIndex}/${session.weekTotal}` : `WK ${session.weekIndex}/${session.weekTotal}`}
          </span>
        </div>

        <div style={{ ...S.mono, fontSize: 18, fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
          {intent}
        </div>

        <div style={{ ...S.mono, fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>
          <strong style={{ color: phaseColor }}>{isTR ? 'SÜRE' : 'DURATION'}</strong> · {session.durationMin} {isTR ? 'dk' : 'min'}
          {session.paceTarget ? (
            <>
              <span aria-hidden="true" style={{ margin: '0 8px', color: 'var(--muted)' }}>·</span>
              <strong style={{ color: phaseColor }}>{isTR ? 'TEMPO' : 'PACE'}</strong> · {session.paceTarget}
            </>
          ) : null}
        </div>

        {session.zones && Object.values(session.zones).some(v => v > 0) ? (
          <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            {Object.entries(session.zones).filter(([, v]) => v > 0).map(([z, v], i, arr) => (
              <span key={z}>
                <strong>{z}</strong> {v} {isTR ? 'dk' : 'min'}{i < arr.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ ...S.mono, fontSize: 11, color: 'var(--text)', marginTop: 8, lineHeight: 1.5 }}>
          {bil(session.recommendation, isTR)}
        </div>

        {session.dateISO && session.daysAhead > 0 ? (
          <div style={{ ...S.mono, fontSize: 9, color: 'var(--muted)', marginTop: 6 }}>
            📅 {session.dateISO}
          </div>
        ) : null}

        {/* Quick-log button only when the next training is TODAY */}
        {session.daysAhead === 0 ? (() => {
          const dateISO = session.dateISO
            || (() => {
              const d = new Date()
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
            })()
          const safeLog = Array.isArray(log) ? log : []
          const alreadyLogged = safeLog.some(e => e?.date === dateISO && e?.source === 'sporeus-plan')
          if (alreadyLogged) {
            return (
              <div style={{ ...S.mono, fontSize: 11, color: '#28a745', marginTop: 10, fontWeight: 700 }}>
                ✓ {isTR ? 'BU SEANS BUGÜN İÇİN LOGLANDI' : 'LOGGED FOR TODAY'}
              </div>
            )
          }
          return (
            <div style={{ marginTop: 10 }}>
              <button type="button"
                onClick={() => {
                  const entry = buildLogEntryFromSession(session, dateISO, program.sport, _profile)
                  if (!entry) return
                  setLog([entry, ...safeLog])
                  setLogState({ kind: 'success' })
                  setTimeout(() => setLogState(null), 2500)
                }}
                data-quick-log-btn
                aria-label={isTR ? 'Bu seansı loga kaydet' : 'Mark this session done'}
                style={{
                  ...S.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '8px 16px',
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>
                ✓ {isTR ? 'BUNU YAPTIM' : 'DID THIS'}
              </button>
              {logState?.kind === 'success' ? (
                <span role="status" style={{ marginLeft: 10, fontSize: 10, color: '#28a745' }}>
                  ✓ {isTR ? 'Loga eklendi' : 'Added to log'}
                </span>
              ) : null}
            </div>
          )
        })() : null}
      </div>
    </div>
  )
}

export default memo(NextTrainingCard)
