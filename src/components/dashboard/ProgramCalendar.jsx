// ─── dashboard/ProgramCalendar.jsx — full N-week training calendar ──────────
//
// v9.4.0. Shows the entire program as a vertical week grid: one row per
// week, 7 day cells per row, each cell color-coded by phase + session
// intensity. Click a cell to expand its detail. "Today" is highlighted
// with a ring. Past weeks are dimmed.
//
// Data source priority:
//   1. yearlyPlan.weeks (already built by APPLY TO CALENDAR — has full
//      sessionsBlueprint)
//   2. eliteProgramToYearlyWeeks(program, programStart) — synthesized
//      on the fly from the orchestrator output

import { lazy, Suspense, useContext, useMemo, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { eliteProgramToYearlyWeeks } from '../../lib/athlete/eliteProgramToYearly.js'
import { buildCalendarProgress } from '../../lib/athlete/calendarProgress.js'
import { buildPlanMilestones } from '../../lib/athlete/planMilestones.js'
import { buildLogEntryFromSession } from '../../lib/athlete/quickLogFromSession.js'

// v9.177.0 — Field-test modal triggered by 📊 milestone marker
const FieldTestModal = lazy(() => import('../FieldTestModal.jsx'))

const PHASE_COLOR = {
  Base:  '#0064ff',
  Build: '#00aa66',
  Peak:  '#ff6600',
  Taper: '#9966cc',
  Race:  '#dc3545',
}

// Session-intent color tokens — same set as BroaderPlanSections so the
// calendar and the workout-detail card stay visually aligned.
function intentColor(intent) {
  if (!intent || typeof intent !== 'string') return '#666'
  const i = intent.toLowerCase()
  if (/race/i.test(intent)) return '#dc3545'
  if (/vo2|interval|i-pace|@i/i.test(intent)) return '#dc3545'
  if (/threshold|cruise|sweet[- ]spot|@t-pace|css/i.test(intent)) return '#ff6600'
  if (/tempo|m-pace/i.test(intent)) return '#0064ff'
  if (/long/i.test(intent)) return '#0a8a8a'
  if (/strides?|@r/i.test(intent)) return '#9966cc'
  if (/strength|gym|squat|deadlift/i.test(intent)) return '#7d4a00'
  if (/easy|recovery|z1|z2/i.test(i)) return '#00aa66'
  if (/rest|off|dinlenme/i.test(intent)) return '#444'
  return '#666'
}

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function bil(field, isTR) {
  if (!field) return ''
  if (typeof field === 'string') return field
  return isTR ? (field.tr || field.en || '') : (field.en || '')
}

function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function todayUTC() {
  const t = new Date()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}

function ymd(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000)
}

function shortDate(d, isTR) {
  const months = isTR
    ? ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

/**
 * Render the full program as a calendar.
 * @param {object} props
 * @param {object} [props.program]      Orchestrator output (buildEliteProgram result)
 * @param {string} [props.programStart] YYYY-MM-DD
 * @param {object} [props.yearlyPlan]   { weeks: [...] } — preferred data source
 * @param {boolean} [props.collapseDefault]
 */
export default function ProgramCalendar({ program, programStart, yearlyPlan, collapseDefault = false }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const { log, setLog } = useData()
  const [expandedKey, setExpandedKey] = useState(null)
  const [allOpen, setAllOpen] = useState(!collapseDefault)
  const [logToast, setLogToast] = useState(null)
  const [fieldTestOpen, setFieldTestOpen] = useState(false)

  const weeks = useMemo(() => {
    if (yearlyPlan && Array.isArray(yearlyPlan.weeks) && yearlyPlan.weeks.length > 0) {
      return yearlyPlan.weeks
    }
    if (!program || !programStart) return []
    const built = eliteProgramToYearlyWeeks(program, programStart)
    return built?.weeks || []
  }, [program, programStart, yearlyPlan])

  const progress = useMemo(() =>
    buildCalendarProgress(weeks, log, { sport: program?.sport }),
    [weeks, log, program?.sport])

  const milestonesByDate = useMemo(() => {
    const m = buildPlanMilestones(program, programStart)
    const out = {}
    for (const ms of m) out[ms.dateISO] = ms
    return out
  }, [program, programStart])

  const today = todayUTC()

  function handleQuickLog(session, dateISO) {
    const entry = buildLogEntryFromSession(session, dateISO, program?.sport, null)
    if (!entry) return
    const safeLog = Array.isArray(log) ? log : []
    // De-dupe — if athlete already logged this date+type, skip.
    if (safeLog.some(e => e?.date === dateISO && e?.type === entry.type && e?.source === 'sporeus-plan')) {
      setLogToast({ kind: 'duplicate', dateISO })
      setTimeout(() => setLogToast(null), 2500)
      return
    }
    setLog([entry, ...safeLog])
    setLogToast({ kind: 'success', dateISO, type: entry.type })
    setTimeout(() => setLogToast(null), 2500)
  }

  if (weeks.length === 0) {
    return (
      <div data-program-calendar="empty"
        style={{ ...S.mono, fontSize: 11, color: 'var(--muted)', padding: 12, border: '1px dashed var(--border)', borderRadius: 4, marginBottom: 12 }}>
        {isTR
          ? 'Plan oluşturulduktan sonra takvim burada görünecek.'
          : 'Calendar will appear here once you generate a plan.'}
      </div>
    )
  }

  return (
    <div data-program-calendar="loaded"
      style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        ...S.mono,
        fontSize: 10,
        color: 'var(--muted)',
        letterSpacing: '0.08em',
        padding: '8px 12px',
        background: 'var(--surface, rgba(255,255,255,0.02))',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>
          {isTR ? `📅 PROGRAM TAKVİMİ · ${weeks.length} HAFTA` : `📅 PROGRAM CALENDAR · ${weeks.length} WEEKS`}
        </span>
        <button type="button"
          onClick={() => setAllOpen(o => !o)}
          style={{ ...S.mono, fontSize: 9, padding: '2px 8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', borderRadius: 3 }}>
          {allOpen ? (isTR ? 'GİZLE' : 'COLLAPSE') : (isTR ? 'GÖSTER' : 'EXPAND')}
        </button>
      </div>

      {allOpen ? (
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>
          {weeks.map(w => {
            const weekStart = parseISO(w.weekStart)
            if (!weekStart) return null
            const weekEnd = addDays(weekStart, 6)
            const isPast = today.getTime() > weekEnd.getTime()
            const containsToday = today.getTime() >= weekStart.getTime() && today.getTime() <= weekEnd.getTime()
            const phaseColor = PHASE_COLOR[w.phase] || '#666'
            const sessions = Array.isArray(w.sessionsBlueprint) ? w.sessionsBlueprint : []

            return (
              <div key={w.weekStart} data-week={w.weekNum}
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: containsToday ? 'rgba(255,102,0,0.05)' : isPast ? 'rgba(0,0,0,0.04)' : 'transparent',
                  opacity: isPast ? 0.6 : 1,
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  flexWrap: 'wrap',
                  ...S.mono,
                  fontSize: 10,
                }}>
                  <span style={{
                    background: phaseColor,
                    color: '#fff',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 3,
                    letterSpacing: '0.06em',
                  }}>
                    {w.phase?.toUpperCase()}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>
                    {isTR ? `H${w.weekNum}` : `W${w.weekNum}`} · {shortDate(weekStart, isTR)} – {shortDate(weekEnd, isTR)}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--muted)' }}>
                    {w.targetTSS} TSS · {w.plannedHours} h
                  </span>
                  {(() => {
                    const wp = progress.byWeek[w.weekStart]
                    if (!wp || isPast === false && !containsToday) return null
                    if (wp.plannedTSS === 0) return null
                    const pct = wp.adherencePct
                    const adColor = pct >= 90 ? '#28a745' : pct >= 70 ? '#ffc107' : '#dc3545'
                    return (
                      <span title={isTR
                        ? `${wp.actualTSS}/${wp.plannedTSS} TSS · ${wp.daysLogged}/${wp.daysPlanned} gün`
                        : `${wp.actualTSS}/${wp.plannedTSS} TSS · ${wp.daysLogged}/${wp.daysPlanned} days`}
                        style={{ background: adColor, color: '#fff', fontWeight: 700, padding: '1px 5px', borderRadius: 2, fontSize: 9, letterSpacing: '0.06em' }}>
                        {pct}%
                      </span>
                    )
                  })()}
                  {w.isDeload ? (
                    <span style={{ background: '#ffc107', color: '#000', fontWeight: 700, padding: '1px 5px', borderRadius: 2, fontSize: 9 }}>
                      {isTR ? 'DELOAD' : 'DELOAD'}
                    </span>
                  ) : null}
                  {containsToday ? (
                    <span style={{ background: '#ff6600', color: '#fff', fontWeight: 700, padding: '1px 5px', borderRadius: 2, fontSize: 9, letterSpacing: '0.06em' }}>
                      {isTR ? 'BU HAFTA' : 'THIS WEEK'}
                    </span>
                  ) : null}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: '0 8px 8px' }}>
                  {DAY_KEYS.map((dk, dayIdx) => {
                    const dayDate = addDays(weekStart, dayIdx)
                    const isToday = ymd(dayDate) === ymd(today)
                    const session = sessions.find(s => s?.day === dk) || null
                    const intent = session?.intent ? bil(session.intent, isTR) : ''
                    const color = intent ? intentColor(intent) : 'var(--border)'
                    const cellKey = `${w.weekStart}::${dk}`
                    const isExpanded = expandedKey === cellKey

                    const dISO = ymd(dayDate)
                    const dp = progress.byDay[dISO]
                    const isLogged = dp?.logged === true
                    const milestone = milestonesByDate[dISO]
                    return (
                      <button
                        key={dk}
                        type="button"
                        onClick={() => setExpandedKey(isExpanded ? null : cellKey)}
                        aria-expanded={isExpanded}
                        aria-label={isTR ? `${dk}, ${intent || 'dinlenme'}` : `${dk}, ${intent || 'rest'}`}
                        style={{
                          ...S.mono,
                          padding: '6px 4px',
                          borderRadius: 3,
                          background: intent
                            ? `linear-gradient(180deg, ${color}40, ${color}15)`
                            : 'rgba(0,0,0,0.05)',
                          border: isToday ? '2px solid #ff6600' : `1px solid ${isLogged ? '#28a745' : (intent ? color : 'var(--border)')}`,
                          color: 'var(--text)',
                          cursor: session ? 'pointer' : 'default',
                          textAlign: 'left',
                          fontSize: 10,
                          minHeight: 50,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 2,
                          position: 'relative',
                        }}>
                        {isLogged ? (
                          <span aria-label={isTR ? 'Tamamlandı' : 'Logged'}
                            style={{ position: 'absolute', top: 2, right: 4, color: '#28a745', fontWeight: 700, fontSize: 11 }}>
                            ✓
                          </span>
                        ) : null}
                        {milestone ? (
                          milestone.type === 'field-test' ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFieldTestOpen(true) }}
                              aria-label={isTR ? `${milestone.label.tr} — kaydet` : `${milestone.label.en} — record`}
                              title={isTR ? `${milestone.label.tr} — kaydetmek için tıkla` : `${milestone.label.en} — click to record`}
                              style={{ position: 'absolute', top: 2, left: 2, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                              📊
                            </button>
                          ) : (
                            <span aria-label={isTR ? milestone.label.tr : milestone.label.en}
                              title={isTR ? milestone.label.tr : milestone.label.en}
                              style={{ position: 'absolute', top: 2, left: 2, fontSize: 11 }}>
                              {milestone.type === 'race-day' ? '🏁'
                                : milestone.type === 'taper-start' ? '🛬'
                                : milestone.type === 'race-pace-primer' ? '⚡'
                                : '📊'}
                            </span>
                          )
                        ) : null}
                        <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.05em', marginLeft: milestone ? 14 : 0 }}>
                          {isTR ? dk.toUpperCase() : dk.toUpperCase()} · {dayDate.getUTCDate()}
                        </span>
                        <span style={{ fontWeight: 600, lineHeight: 1.2 }}>
                          {intent || (isTR ? '—' : '—')}
                        </span>
                        {session?.durationMin ? (
                          <span style={{ fontSize: 8, color: 'var(--muted)' }}>
                            {session.durationMin} {isTR ? 'dk' : 'min'}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                {expandedKey && expandedKey.startsWith(`${w.weekStart}::`) ? (() => {
                  const dk = expandedKey.split('::')[1]
                  const session = sessions.find(s => s?.day === dk) || null
                  if (!session) return null
                  const intent = bil(session.intent, isTR)
                  const color = intent ? intentColor(intent) : '#666'
                  const dayIdx = DAY_KEYS.indexOf(dk)
                  const dISO = dayIdx >= 0 ? ymd(addDays(weekStart, dayIdx)) : null
                  const dp = dISO ? progress.byDay[dISO] : null
                  const isLogged = dp?.logged === true
                  const milestone = dISO ? milestonesByDate[dISO] : null
                  return (
                    <div style={{
                      ...S.mono,
                      fontSize: 11,
                      lineHeight: 1.55,
                      padding: '10px 14px',
                      borderTop: `2px solid ${color}`,
                      background: 'var(--surface, rgba(255,255,255,0.02))',
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: 2, marginRight: 6 }} />
                        {dk} {dISO ? `· ${dISO}` : ''} · {intent}
                      </div>
                      {milestone ? (
                        <div style={{ marginTop: 4, marginBottom: 6, padding: '4px 8px', background: 'rgba(220,53,69,0.10)', borderLeft: '3px solid #dc3545', fontWeight: 600 }}>
                          🏁 {isTR ? milestone.label.tr : milestone.label.en}
                        </div>
                      ) : null}
                      {session.durationMin ? (
                        <div><strong>{isTR ? 'SÜRE' : 'DURATION'}</strong> · {session.durationMin} {isTR ? 'dk' : 'min'}</div>
                      ) : null}
                      {session.paceTarget ? (
                        <div><strong>{isTR ? 'TEMPO HEDEFİ' : 'PACE TARGET'}</strong> · {session.paceTarget}</div>
                      ) : null}
                      {session.zones ? (
                        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>
                          {Object.entries(session.zones).filter(([, v]) => v > 0).map(([z, v]) => (
                            <span key={z} style={{ marginRight: 8 }}>
                              <strong>{z}</strong> {v} {isTR ? 'dk' : 'min'}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {session.notes ? (
                        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>
                          {bil(session.notes, isTR)}
                        </div>
                      ) : null}
                      {dp ? (
                        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
                          {isLogged
                            ? (isTR ? `✓ Loglandı: ${dp.actualTSS} TSS · ${dp.actualDuration} dk` : `✓ Logged: ${dp.actualTSS} TSS · ${dp.actualDuration} min`)
                            : (isTR ? 'Henüz loglanmadı' : 'Not yet logged')}
                        </div>
                      ) : null}
                      {session.durationMin > 0 && dISO && !isLogged ? (
                        <div style={{ marginTop: 8 }}>
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); handleQuickLog(session, dISO) }}
                            data-quick-log-btn
                            aria-label={isTR ? 'Bu seansı loga kaydet' : 'Mark this session done'}
                            style={{
                              ...S.mono,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '5px 12px',
                              background: '#28a745',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              letterSpacing: '0.06em',
                            }}>
                            ✓ {isTR ? 'BUNU YAPTIM' : 'DID THIS'}
                          </button>
                          {logToast && logToast.dateISO === dISO ? (
                            <span role="status" style={{ marginLeft: 10, fontSize: 10, color: logToast.kind === 'success' ? '#28a745' : '#ffc107' }}>
                              {logToast.kind === 'success'
                                ? (isTR ? '✓ Loga eklendi' : '✓ Added to log')
                                : (isTR ? 'Zaten loglanmış' : 'Already logged')}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })() : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {fieldTestOpen && (
        <Suspense fallback={null}>
          <FieldTestModal
            program={program}
            profile={null}
            lang={lang}
            onClose={() => setFieldTestOpen(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

// ── helpers exported for tests ──────────────────────────────────────────────
export const _internal = { intentColor, parseISO, daysBetween, ymd }
