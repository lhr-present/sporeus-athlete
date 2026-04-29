// src/components/dashboard/TrainingBridgeCard.jsx — E88 v2
// Week grid with full multi-modal day expansion: run prescription (WU/MAIN/CD) +
// drills, strength, and preventive exercise tables. All paces from sessionLibrary VDOT.
// todayDow fixed: (getUTCDay()+6)%7 for Mon-first indexing.
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import { buildTrainingPlan, getCurrentPlanWeek } from '../../lib/athlete/trainingBridge.js'
import { predictFitness } from '../../lib/intelligence.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const BLUE   = '#0064ff'
const DIM    = '#444'
const DIMMER = '#2a2a2a'

const ZONE_COLOR    = { 1: '#555555', 2: '#0064ff', 3: '#5bc25b', 4: '#f5c542', 5: '#ff6600' }
const ZONE_LABEL    = { 1: 'Z1·REC', 2: 'Z2·EASY', 3: 'Z3·MAR', 4: 'Z4·TEMPO', 5: 'Z5·VO2' }
const ZONE_LABEL_TR = { 1: 'Z1·TOP', 2: 'Z2·KOL', 3: 'Z3·MAR', 4: 'Z4·EŞİK', 5: 'Z5·VO2' }

const DRILLS_COLOR = '#4a90d9'
const STR_COLOR    = '#c87137'
const PREV_COLOR   = '#5bc25b'

const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const PHASE_COLORS = { Base: GREEN, Build: AMBER, Peak: ORANGE, Taper: RED, Deload: BLUE }

function zoneColor(z) { return ZONE_COLOR[z] ?? '#555' }

function weekTSSLogged(log, weekStart, weekEnd) {
  return log
    .filter(e => e.date >= weekStart && e.date <= weekEnd && (e.tss || 0) > 0)
    .reduce((s, e) => s + (e.tss || 0), 0)
}

// Handles EN (WU … MAIN … CD) and TR (Isınma … ANA: … Soğuma) structure formats.
function parseStructure(text) {
  if (!text) return null
  const wu   = text.match(/^(?:WU|[Iı]sınma)\s+(.+?)(?=\.\s*(?:MAIN|ANA)[:\s]|$)/i)?.[1]?.replace(/\.$/, '').trim()
  const main = text.match(/(?:MAIN|ANA)[:\s]+(.+?)(?=\.\s*(?:CD|[Ss]oğuma)\s|$)/i)?.[1]?.replace(/\.$/, '').trim()
  const cd   = text.match(/\.\s*(?:CD|[Ss]oğuma)\s+(.+?)(?=\.\s*(?:Feel|Science|PURPOSE|RPE|Note|Last|Key|Stimulus|AMAÇ|Bilim|His|Yapısız)|$)/i)?.[1]?.replace(/\.$/, '').trim()
  if (!wu && !main && !cd) return null
  return [
    wu   && { label: 'WU',   text: wu },
    main && { label: 'MAIN', text: main },
    cd   && { label: 'CD',   text: cd },
  ].filter(Boolean)
}

function Divider() {
  return <div style={{ height: 1, background: '#111', margin: '6px 0' }} />
}

function DayDetail({ sess, isTR, onClose }) {
  if (!sess) return null
  const run = sess.run
  const str = sess.strength
  const drl = sess.drills
  const prv = sess.preventive
  const runZone = run?.zone ?? 2
  const rc = zoneColor(runZone)
  const structure   = run ? (isTR ? run.structureTr : run.structure) : null
  const parsedSteps = parseStructure(structure)

  return (
    <div style={{ margin: '2px 0 6px', padding: '10px', background: '#060606', borderRadius: 3, border: '1px solid #111' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 10 }}>✕</button>
      </div>

      {run && (
        <div style={{ borderLeft: `2px solid ${rc}`, paddingLeft: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#aaa' }}>
              {isTR ? (run.tr || run.type) : run.type}
            </span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 7, color: rc, border: `1px solid ${rc}33`, borderRadius: 2, padding: '1px 4px' }}>
                {(isTR ? ZONE_LABEL_TR : ZONE_LABEL)[runZone] ?? `Z${runZone}`}
              </span>
              {run.tss > 0 && <span style={{ fontSize: 7, color: '#333' }}>TSS~{run.tss}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 6, padding: '4px 8px', background: '#0a0a0a', borderRadius: 2 }}>
            {run.paceStr && (
              <div>
                <div style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>{isTR ? 'TEMPO' : 'PACE'}</div>
                <div style={{ fontSize: 10, color: rc, fontWeight: 700 }}>{run.paceStr}</div>
              </div>
            )}
            {run.hrLow > 0 && run.hrHigh > 0 && (
              <div>
                <div style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>{isTR ? 'NABIZ' : 'HR'}</div>
                <div style={{ fontSize: 9, color: '#777' }}>{run.hrLow}–{run.hrHigh} bpm</div>
              </div>
            )}
            {run.rpeLow > 0 && run.rpeHigh > 0 && (
              <div>
                <div style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>RPE</div>
                <div style={{ fontSize: 9, color: '#777' }}>{run.rpeLow}–{run.rpeHigh}/10</div>
              </div>
            )}
            {run.durationMin > 0 && (
              <div style={{ marginLeft: 'auto' }}>
                <div style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>{isTR ? 'SÜRE' : 'DUR'}</div>
                <div style={{ fontSize: 9, color: '#555' }}>{run.durationMin}min</div>
              </div>
            )}
          </div>
          {parsedSteps ? (
            <div style={{ background: '#050505', borderRadius: 2, overflow: 'hidden' }}>
              {parsedSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 8px', borderBottom: i < parsedSteps.length - 1 ? '1px solid #0d0d0d' : 'none' }}>
                  <span style={{ fontSize: 7, color: '#444', minWidth: 28, paddingTop: 1, fontWeight: 700 }}>{step.label}</span>
                  <span style={{ fontSize: 7, color: '#666', lineHeight: 1.5, flex: 1 }}>{step.text}</span>
                </div>
              ))}
            </div>
          ) : structure ? (
            <div style={{ fontSize: 7, color: '#555', lineHeight: 1.5, padding: '4px 0' }}>{structure}</div>
          ) : null}
        </div>
      )}

      {drl && (
        <>
          {run && <Divider />}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 7, color: '#444', letterSpacing: '0.1em' }}>
                ▸ {isTR ? 'FORM HAREKETLERİ' : 'DRILLS'}
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                <span style={{ fontSize: 7, color: DRILLS_COLOR, border: `1px solid ${DRILLS_COLOR}33`, borderRadius: 2, padding: '1px 4px' }}>
                  {drl.level.toUpperCase()}
                </span>
                <span style={{ fontSize: 7, color: '#333' }}>{drl.durationMin}min</span>
              </div>
            </div>
            {drl.exercises.map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: i < drl.exercises.length - 1 ? '1px solid #0d0d0d' : 'none' }}>
                <span style={{ fontSize: 7, color: '#666' }}>{isTR ? ex.tr : ex.name}</span>
                {(ex.distance || ex.reps) && (
                  <span style={{ fontSize: 7, color: DRILLS_COLOR, fontWeight: 700 }}>{ex.distance || ex.reps}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {str && (
        <>
          {(run || drl) && <Divider />}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 7, color: '#444', letterSpacing: '0.1em' }}>
                ▸ {isTR ? 'KUVVETLENDİRME' : 'STRENGTH'}
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                <span style={{ fontSize: 7, color: STR_COLOR, border: `1px solid ${STR_COLOR}33`, borderRadius: 2, padding: '1px 4px' }}>
                  {str.category.toUpperCase()}
                </span>
                <span style={{ fontSize: 7, color: '#333' }}>{str.durationMin}min</span>
              </div>
            </div>
            {str.exercises.map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < str.exercises.length - 1 ? '1px solid #0d0d0d' : 'none' }}>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <div style={{ fontSize: 7, color: '#777' }}>{isTR ? ex.tr : ex.name}</div>
                  {ex.notes && (
                    <div style={{ fontSize: 6, color: '#2a2a2a', marginTop: 1 }}>
                      {isTR ? ex.notesTr : ex.notes}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 8, color: STR_COLOR, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {prv && (
        <>
          {(run || drl || str) && <Divider />}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 7, color: '#444', letterSpacing: '0.1em' }}>
                ▸ {isTR ? 'KORUYUCU ÇALIŞMALAR' : 'PREVENTIVE'}
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                <span style={{ fontSize: 7, color: PREV_COLOR, border: `1px solid ${PREV_COLOR}33`, borderRadius: 2, padding: '1px 4px' }}>
                  {(isTR ? prv.tr : prv.name).split('—')[0].trim().toUpperCase()}
                </span>
                <span style={{ fontSize: 7, color: '#333' }}>{prv.durationMin}min</span>
              </div>
            </div>
            {prv.exercises.map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < prv.exercises.length - 1 ? '1px solid #0d0d0d' : 'none' }}>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <div style={{ fontSize: 7, color: '#777' }}>{isTR ? ex.tr : ex.name}</div>
                  {ex.notes && (
                    <div style={{ fontSize: 6, color: '#2a2a2a', marginTop: 1 }}>
                      {isTR ? ex.notesTr : ex.notes}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 8, color: PREV_COLOR, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!run && !str && !drl && !prv && (
        <div style={{ fontSize: 8, color: '#222' }}>{isTR ? '— Dinlenme' : '— Rest'}</div>
      )}
    </div>
  )
}

export default function TrainingBridgeCard({ profile, log = [], isTR }) {
  const [saved] = useLocalStorage('sporeus-race-goal-v2', null)
  const [expandedDay, setExpandedDay] = useState(null)

  const today    = new Date().toISOString().slice(0, 10)
  // Mon-first: Mon=0 … Sun=6  (getUTCDay: Sun=0, Mon=1 … Sat=6)
  const todayDow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7

  const maxHR = useMemo(() => {
    if (profile?.maxhr > 0) return parseInt(profile.maxhr)
    if (profile?.age > 0) return Math.round(208 - 0.7 * parseFloat(profile.age))
    return null
  }, [profile])

  const { analysis, plan, currentWeekData } = useMemo(() => {
    if (!saved) return {}
    const cSec = parseMmSs(saved.currentTime)
    const gSec = parseMmSs(saved.goalTime)
    const a = analyzeRaceGoal(cSec, gSec, saved.distM || 10000, profile || {}, log)
    if (!a) return {}
    const planStart = saved.planStart || today
    const p = buildTrainingPlan(a, planStart)
    const cw = getCurrentPlanWeek(p, today)
    return { analysis: a, plan: p, currentWeekData: cw }
  }, [saved, profile, log, today])

  const fitness    = useMemo(() => predictFitness(log), [log])
  const tsb        = fitness?.tsb ?? 0

  if (!analysis || !plan?.length || !currentWeekData) return null

  const { week, weekIdx } = currentWeekData
  const dowLabels  = isTR ? DOW_TR : DOW_EN
  const phaseColor = PHASE_COLORS[week.isDeload ? 'Deload' : week.phase] || DIM

  const loggedTSS  = weekTSSLogged(log, week.startDate, week.endDate)
  const tssRatio   = week.tss > 0 ? Math.min(1, loggedTSS / week.tss) : 0
  const lookahead  = plan.slice(weekIdx, Math.min(weekIdx + 4, plan.length))

  function toggleDay(i) {
    const sess = week.sessions[i]
    const isEmpty = !sess?.run && !sess?.strength && !sess?.drills && !sess?.preventive
    if (isEmpty) return
    setExpandedDay(prev => prev === i ? null : i)
  }

  return (
    <div style={{ ...S.card, fontFamily: MONO }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: DIM, letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'ANTRENMAN PLANI' : 'TRAINING PLAN'}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 8, color: phaseColor,
            border: `1px solid ${phaseColor}44`, borderRadius: 2, padding: '1px 5px',
          }}>
            {isTR ? week.phaseTr : week.phase}{week.isDeload ? ' ↓' : ''}
          </span>
          <span style={{ fontSize: 8, color: DIMMER }}>W{week.weekNum}/{plan.length}</span>
        </div>
      </div>

      {/* Week focus */}
      <div style={{
        fontSize: 9, color: '#444', marginBottom: 10, lineHeight: 1.5,
        padding: '5px 7px', background: '#0a0a0a', borderRadius: 3,
        borderLeft: `3px solid ${phaseColor}`,
      }}>
        {isTR ? week.tr : week.en}
      </div>

      {/* TSB warning */}
      {tsb < -20 && (
        <div style={{
          fontSize: 8, color: AMBER, marginBottom: 8, padding: '4px 7px',
          background: '#1a1000', borderRadius: 3, borderLeft: `2px solid ${AMBER}`,
        }}>
          △ TSB {tsb} — {isTR ? 'Yorgunluk yüksek. Kolay oturumlara geç.' : 'High fatigue. Drop to Easy sessions today.'}
        </div>
      )}

      {/* Session rows */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, color: DIMMER, letterSpacing: '0.08em', marginBottom: 5 }}>
          {isTR ? 'BU HAFTA · bas → detay' : 'THIS WEEK · tap → details'}
        </div>
        {week.sessions.map((sess, i) => {
          const isToday    = i === todayDow
          const run        = sess?.run
          const str        = sess?.strength
          const drl        = sess?.drills
          const prv        = sess?.preventive
          const isRest     = !run && !str && !drl && !prv
          const isExpanded = expandedDay === i
          const runZone    = run?.zone ?? (sess?.zone ?? 1)
          const rc         = isRest ? '#1a1a1a' : zoneColor(runZone)
          const label      = run?.type || sess?.type || (isTR ? 'Dinlenme' : 'Rest')
          const labelTR    = run?.tr  || sess?.tr   || 'Dinlenme'
          const dur        = sess?.totalDurationMin

          return (
            <div key={i}>
              <div
                onClick={() => toggleDay(i)}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '5px 6px', marginBottom: 1,
                  background: isToday ? '#1a1a1a' : 'transparent',
                  borderRadius: 2,
                  borderLeft: isToday ? `2px solid ${ORANGE}` : '2px solid transparent',
                  cursor: isRest ? 'default' : 'pointer',
                }}>

                <span style={{ fontSize: 8, color: isToday ? ORANGE : '#333', minWidth: 28, flexShrink: 0 }}>
                  {dowLabels[i]}
                </span>

                <span style={{
                  fontSize: 8, flex: 1, marginLeft: 6, marginRight: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: isRest ? '#1e1e1e' : (isToday ? '#999' : '#555'),
                }}>
                  {isTR ? labelTR : label}
                </span>

                {/* Modality indicator dots */}
                <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginRight: 6, flexShrink: 0 }}>
                  {run && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: rc, display: 'inline-block' }} />
                  )}
                  {str && (
                    <span style={{ width: 5, height: 5, borderRadius: 1, background: STR_COLOR, display: 'inline-block' }} />
                  )}
                  {drl && (
                    <span style={{ width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: `5px solid ${DRILLS_COLOR}`, display: 'inline-block' }} />
                  )}
                  {prv && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', border: `1px solid ${PREV_COLOR}`, display: 'inline-block' }} />
                  )}
                </div>

                {dur > 0 && (
                  <span style={{ fontSize: 7, color: '#2a2a2a', minWidth: 28, textAlign: 'right', flexShrink: 0 }}>
                    {dur}m
                  </span>
                )}
                {!isRest && (
                  <span style={{ fontSize: 7, color: '#222', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                )}
              </div>

              {isExpanded && (
                <DayDetail sess={sess} isTR={isTR} onClose={() => setExpandedDay(null)} />
              )}
            </div>
          )
        })}
      </div>

      {/* TSS compliance bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: DIMMER, marginBottom: 3 }}>
          <span>{isTR ? 'TSS UYUMU' : 'TSS COMPLIANCE'}</span>
          <span style={{ color: tssRatio >= 1 ? GREEN : '#555' }}>
            {loggedTSS} / {week.tss}{tssRatio >= 1 ? ' ✓' : ''}
          </span>
        </div>
        <div style={{ height: 3, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.round(tssRatio * 100)}%`,
            background: tssRatio >= 1 ? GREEN : tssRatio >= 0.6 ? ORANGE : BLUE,
          }} />
        </div>
      </div>

      {/* 4-week lookahead */}
      {lookahead.length > 1 && (
        <div>
          <div style={{ fontSize: 8, color: DIMMER, letterSpacing: '0.08em', marginBottom: 5 }}>
            {isTR ? 'SONRAKI 4 HAFTA' : 'NEXT 4 WEEKS'}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {lookahead.map((w, i) => {
              const pc = PHASE_COLORS[w.isDeload ? 'Deload' : w.phase] || DIM
              return (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', padding: '4px 2px',
                  background: '#0a0a0a', borderRadius: 2,
                  borderTop: `2px solid ${pc}${i === 0 ? 'ff' : '44'}`,
                }}>
                  <div style={{ fontSize: 7, color: i === 0 ? pc : DIMMER }}>W{w.weekNum}</div>
                  <div style={{ fontSize: 8, color: i === 0 ? '#aaa' : '#333' }}>
                    {isTR ? w.phaseTr?.slice(0, 4) : w.phase?.slice(0, 4)}{w.isDeload ? '↓' : ''}
                  </div>
                  <div style={{ fontSize: 7, color: DIMMER }}>{w.tss}T</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 7, color: '#222', marginTop: 8 }}>
        {isTR
          ? `Tüm temolar VDOT ${analysis.currentVdot} bazlı (Daniels 2014)`
          : `All paces from VDOT ${analysis.currentVdot} (Daniels 2014)`}
      </div>

    </div>
  )
}
