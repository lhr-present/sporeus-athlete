// src/components/dashboard/TrainingBridgeCard.jsx — E88
// Tappable week grid: each session expands to show full multi-modal paces (pace+HR+RPE+feel).
// Plan-vs-log TSS compliance strip. TSB-adaptive "Tired?" downgrade suggestion.
// Uses paceZoneTranslator (E86) so athletes see HOW hard, not just how fast.
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import { buildTrainingPlan, getCurrentPlanWeek } from '../../lib/athlete/trainingBridge.js'
import { translateAllZones } from '../../lib/athlete/paceZoneTranslator.js'
import { predictFitness } from '../../lib/intelligence.js'
import { S } from '../../styles.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const BLUE   = '#4a90d9'
const DIM    = '#444'
const DIMMER = '#2a2a2a'

const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

const PHASE_COLORS = { Base: GREEN, Build: AMBER, Peak: ORANGE, Taper: RED, Deload: BLUE }

function sessionZoneKey(sessionType) {
  const t = (sessionType || '').toLowerCase()
  if (/interval|tekrar/i.test(t)) return 'I'
  if (/rep|sprint|hız/i.test(t)) return 'R'
  if (/threshold|tempo|eşik/i.test(t)) return 'T'
  if (/marathon|maraton/i.test(t)) return 'M'
  return 'E'
}

function weekTSSLogged(log, weekStart, weekEnd) {
  return log
    .filter(e => e.date >= weekStart && e.date <= weekEnd && (e.tss || 0) > 0)
    .reduce((s, e) => s + (e.tss || 0), 0)
}

function SessionDetail({ session, zoneInfo, isTR, onClose }) {
  if (!session || !zoneInfo) return null
  return (
    <div style={{ marginTop: '6px', padding: '8px 10px', background: '#0a0a0a', borderRadius: '3px', border: `1px solid ${zoneInfo.color}22` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#aaa' }}>
          {isTR ? (session.tr || session.type) : session.type}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: '10px' }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Row label={isTR ? 'Tempo' : 'Pace'} value={`${zoneInfo.pace}/km`} color={zoneInfo.color} />
        <Row label={isTR ? 'Kalp atışı' : 'Heart rate'} value={zoneInfo.hrRange.str} />
        <Row label="RPE" value={`${zoneInfo.rpeRange} / 10`} />
      </div>
      <div style={{ fontSize: '8px', color: '#555', marginTop: '5px', lineHeight: 1.5, fontStyle: 'italic' }}>
        "{isTR ? zoneInfo.feelTR : zoneInfo.feelEN}"
      </div>
      <div style={{ fontSize: '8px', color: DIMMER, marginTop: '4px', lineHeight: 1.5, padding: '4px 6px', background: '#111', borderRadius: '2px' }}>
        {isTR ? zoneInfo.formatTR : zoneInfo.formatEN}
      </div>
      <div style={{ fontSize: '8px', color: '#333', marginTop: '4px' }}>
        {isTR ? zoneInfo.purposeTR : zoneInfo.purposeEN}
      </div>
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
      <span style={{ color: DIMMER }}>{label}</span>
      <span style={{ color: color || '#777' }}>{value}</span>
    </div>
  )
}

export default function TrainingBridgeCard({ profile, log = [], isTR }) {
  const [saved] = useLocalStorage('sporeus-race-goal-v2', null)
  const [expandedDay, setExpandedDay] = useState(null)  // DOW index of expanded session

  const today    = new Date().toISOString().slice(0, 10)
  const todayDow = new Date(today + 'T12:00:00Z').getUTCDay()

  const maxHR = useMemo(() => {
    if (profile?.maxhr > 0) return profile.maxhr
    if (profile?.age > 0) return Math.round(208 - 0.7 * profile.age)
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

  const zones = useMemo(() => {
    if (!analysis?.currentVdot) return null
    return translateAllZones(analysis.currentVdot, maxHR)
  }, [analysis, maxHR])

  const fitness = useMemo(() => predictFitness(log), [log])
  const tsb     = fitness?.tsb ?? 0

  if (!analysis || !plan?.length || !currentWeekData) return null

  const { week, weekIdx } = currentWeekData
  const dowLabels  = isTR ? DOW_TR : DOW_EN
  const phaseColor = PHASE_COLORS[week.isDeload ? 'Deload' : week.phase] || DIM

  const loggedTSS  = weekTSSLogged(log, week.startDate, week.endDate)
  const tssRatio   = week.tss > 0 ? Math.min(1, loggedTSS / week.tss) : 0

  const lookaheadWeeks = plan.slice(weekIdx, Math.min(weekIdx + 4, plan.length))

  // TSB-based downgrade suggestion
  const showTiredSuggestion = tsb < -20

  function toggleDay(i) {
    const sess = week.sessions[i]
    const isRest = !sess?.type || /rest|dinlenme/i.test(sess.type)
    if (isRest) return
    setExpandedDay(prev => prev === i ? null : i)
  }

  return (
    <div style={{ ...S.card, fontFamily: MONO }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'ANTRENMAN PLANI' : 'TRAINING PLAN'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', color: phaseColor, border: `1px solid ${phaseColor}44`, borderRadius: '2px', padding: '1px 5px' }}>
            {isTR ? week.phaseTr : week.phase}{week.isDeload ? ' ↓' : ''}
          </span>
          <span style={{ fontSize: '8px', color: DIMMER }}>W{week.weekNum}/{plan.length}</span>
        </div>
      </div>

      {/* Week focus */}
      <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px', lineHeight: 1.5, padding: '5px 7px', background: '#0a0a0a', borderRadius: '3px', borderLeft: `3px solid ${phaseColor}` }}>
        {isTR ? week.tr : week.en}
      </div>

      {/* TSB warning */}
      {showTiredSuggestion && (
        <div style={{ fontSize: '8px', color: AMBER, marginBottom: '8px', padding: '4px 7px', background: '#1a1000', borderRadius: '3px', borderLeft: `2px solid ${AMBER}` }}>
          △ TSB {tsb} — {isTR ? 'Yorgunluk yüksek. Kolay oturumlara geç veya rest al.' : 'High fatigue. Consider dropping to Easy sessions or rest.'}
        </div>
      )}

      {/* Tappable week sessions */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '8px', color: DIMMER, letterSpacing: '0.08em', marginBottom: '5px' }}>
          {isTR ? 'BU HAFTA' : 'THIS WEEK'}
          <span style={{ color: '#333', marginLeft: '6px' }}>{isTR ? '(bas → detay)' : '(tap → details)'}</span>
        </div>
        {week.sessions.map((sess, i) => {
          const isToday   = i === todayDow
          const isRest    = !sess?.type || /rest|dinlenme/i.test(sess.type)
          const isExpanded = expandedDay === i
          const zKey      = sessionZoneKey(sess?.type)
          const zInfo     = zones?.[zKey]
          const zColor    = isRest ? DIMMER : (zInfo?.color || DIM)

          return (
            <div key={i}>
              <div
                onClick={() => toggleDay(i)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 6px', marginBottom: '1px',
                  background: isToday ? '#1a1a1a' : 'transparent',
                  borderRadius: '2px',
                  borderLeft: isToday ? `2px solid ${ORANGE}` : `2px solid transparent`,
                  cursor: isRest ? 'default' : 'pointer',
                }}>
                <span style={{ fontSize: '8px', color: isToday ? ORANGE : '#333', minWidth: '28px' }}>
                  {dowLabels[i]}
                </span>
                <span style={{ fontSize: '9px', color: isRest ? '#222' : (isToday ? '#aaa' : '#444'), flex: 1, marginLeft: '6px' }}>
                  {isTR ? (sess?.tr || sess?.type) : sess?.type}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {!isRest && zInfo && (
                    <span style={{ fontSize: '8px', color: zColor }}>{zInfo.pace}</span>
                  )}
                  {!isRest && (
                    <span style={{ fontSize: '7px', color: '#333' }}>{isExpanded ? '▲' : '▼'}</span>
                  )}
                </div>
              </div>

              {isExpanded && zInfo && (
                <SessionDetail
                  session={sess}
                  zoneInfo={zInfo}
                  isTR={isTR}
                  onClose={() => setExpandedDay(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* TSS compliance strip */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: DIMMER, marginBottom: '3px' }}>
          <span>{isTR ? 'TSS UYUMU' : 'TSS COMPLIANCE'}</span>
          <span style={{ color: tssRatio >= 1 ? GREEN : '#555' }}>
            {loggedTSS} / {week.tss} {tssRatio >= 1 && '✓'}
          </span>
        </div>
        <div style={{ height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            width: `${Math.round(tssRatio * 100)}%`,
            background: tssRatio >= 1 ? GREEN : tssRatio >= 0.6 ? ORANGE : BLUE,
          }} />
        </div>
      </div>

      {/* 4-week lookahead */}
      {lookaheadWeeks.length > 1 && (
        <div>
          <div style={{ fontSize: '8px', color: DIMMER, letterSpacing: '0.08em', marginBottom: '5px' }}>
            {isTR ? 'SONRAKI 4 HAFTA' : 'NEXT 4 WEEKS'}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {lookaheadWeeks.map((w, i) => {
              const pc = PHASE_COLORS[w.isDeload ? 'Deload' : w.phase] || DIM
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 2px', background: '#0a0a0a', borderRadius: '2px', borderTop: `2px solid ${pc}${i === 0 ? 'ff' : '44'}` }}>
                  <div style={{ fontSize: '7px', color: i === 0 ? pc : DIMMER }}>W{w.weekNum}</div>
                  <div style={{ fontSize: '8px', color: i === 0 ? '#aaa' : '#333' }}>
                    {isTR ? w.phaseTr?.slice(0, 4) : w.phase?.slice(0, 4)}{w.isDeload ? '↓' : ''}
                  </div>
                  <div style={{ fontSize: '7px', color: DIMMER }}>{w.tss}T</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VDOT footer */}
      <div style={{ fontSize: '8px', color: '#222', marginTop: '8px' }}>
        {isTR
          ? `Tüm temolar VDOT ${analysis.currentVdot} bazlı (Daniels 2014)`
          : `All paces from VDOT ${analysis.currentVdot} (Daniels 2014)`}
      </div>
    </div>
  )
}
