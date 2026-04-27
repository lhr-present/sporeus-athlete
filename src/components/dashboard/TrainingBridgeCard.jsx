// src/components/dashboard/TrainingBridgeCard.jsx — E83
// Shows the active training week from the race goal plan:
// current phase, today's key session, and a 4-week lookahead.
// All session paces are from CURRENT VDOT (not goal paces — correct periodization).
import { useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import { buildTrainingPlan, getCurrentPlanWeek } from '../../lib/athlete/trainingBridge.js'
import { S } from '../../styles.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const DIM    = '#555'

const ZONE_COLORS = ['#333', GREEN, '#4a90d9', AMBER, ORANGE, RED]
const PHASE_COLORS = { Base: GREEN, Build: AMBER, Peak: ORANGE, Taper: RED, Deload: '#4a90d9' }

const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

export default function TrainingBridgeCard({ profile, log, isTR }) {
  const [saved] = useLocalStorage('sporeus-race-goal-v2', null)

  const { analysis, plan, currentWeekData } = useMemo(() => {
    if (!saved) return {}
    const cSec = parseMmSs(saved.currentTime)
    const gSec = parseMmSs(saved.goalTime)
    const a = analyzeRaceGoal(cSec, gSec, saved.distM || 10000, profile || {}, log || [])
    if (!a) return {}
    const planStart = saved.planStart || new Date().toISOString().slice(0, 10)
    const p = buildTrainingPlan(a, planStart)
    const today = new Date().toISOString().slice(0, 10)
    const cw = getCurrentPlanWeek(p, today)
    return { analysis: a, plan: p, currentWeekData: cw }
  }, [saved, profile, log])

  if (!analysis || !plan?.length || !currentWeekData) return null

  const { week, weekIdx } = currentWeekData
  const today = new Date().toISOString().slice(0, 10)
  const todayDow = new Date(today + 'T12:00:00Z').getUTCDay()
  const dowLabels = isTR ? DOW_TR : DOW_EN

  // Find today's session (Sun=0 → index 0)
  const todaySession = week.sessions[todayDow] || null

  // Next 4 weeks for lookahead (or remaining)
  const lookaheadWeeks = plan.slice(weekIdx, Math.min(weekIdx + 4, plan.length))
  const phaseColor = PHASE_COLORS[week.isDeload ? 'Deload' : week.phase] || DIM

  return (
    <div style={{ ...S.card, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'ANTRENMAN PLANI' : 'TRAINING PLAN'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', color: phaseColor, border: `1px solid ${phaseColor}44`, borderRadius: '2px', padding: '1px 5px', letterSpacing: '0.04em' }}>
            {isTR ? week.phaseTr : week.phase}{week.isDeload ? (isTR ? ' · Toparlanma' : ' · Deload') : ''}
          </span>
          <span style={{ fontSize: '8px', color: DIM }}>
            W{week.weekNum}/{plan.length}
          </span>
        </div>
      </div>

      {/* Week focus */}
      <div style={{ fontSize: '9px', color: '#444', marginBottom: '10px', lineHeight: 1.5, padding: '5px 7px', background: '#0a0a0a', borderRadius: '3px', borderLeft: `3px solid ${phaseColor}` }}>
        {isTR ? week.tr : week.en}
      </div>

      {/* Today's session highlight */}
      {todaySession && todaySession.type !== 'Rest' && todaySession.type !== 'Dinlenme' && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', background: '#0f0f0f', border: `1px solid ${ZONE_COLORS[todaySession.zone] || DIM}33`, borderRadius: '3px' }}>
          <div style={{ fontSize: '8px', color: DIM, letterSpacing: '0.08em', marginBottom: '3px' }}>
            {isTR ? 'BUGÜN' : 'TODAY'} — {dowLabels[todayDow]}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#ccc', marginBottom: '2px' }}>
            {isTR ? todaySession.tr : todaySession.type}
          </div>
          {todaySession.paceStr && (
            <div style={{ fontSize: '9px', color: ZONE_COLORS[todaySession.zone] || DIM }}>
              ⏱ {todaySession.paceStr}
            </div>
          )}
        </div>
      )}

      {/* Full week sessions */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.08em', marginBottom: '5px' }}>
          {isTR ? 'BU HAFTA' : 'THIS WEEK'} · {week.tss} TSS
        </div>
        {week.sessions.map((sess, i) => {
          const isToday = i === todayDow
          const isRest  = !sess.type || sess.type === 'Rest' || sess.type === 'Dinlenme' || sess.type === 'Rest / Cross-train'
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 5px', marginBottom: '1px',
              background: isToday ? '#1a1a1a' : 'transparent',
              borderRadius: '2px',
              borderLeft: isToday ? `2px solid ${ORANGE}` : '2px solid transparent',
            }}>
              <span style={{ fontSize: '8px', color: isToday ? ORANGE : '#333', minWidth: '28px' }}>
                {dowLabels[i]}
              </span>
              <span style={{ fontSize: '9px', color: isRest ? '#222' : (isToday ? '#aaa' : '#444'), flex: 1, marginLeft: '6px' }}>
                {isTR ? sess.tr : sess.type}
              </span>
              {sess.paceStr && (
                <span style={{ fontSize: '8px', color: ZONE_COLORS[sess.zone] || DIM }}>
                  {sess.paceStr}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 4-week lookahead */}
      {lookaheadWeeks.length > 1 && (
        <div>
          <div style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.08em', marginBottom: '5px' }}>
            {isTR ? 'SONRAKI 4 HAFTA' : 'NEXT 4 WEEKS'}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {lookaheadWeeks.map((w, i) => {
              const pc = PHASE_COLORS[w.isDeload ? 'Deload' : w.phase] || DIM
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 2px', background: '#0a0a0a', borderRadius: '2px', borderTop: `2px solid ${pc}${i === 0 ? 'ff' : '44'}` }}>
                  <div style={{ fontSize: '7px', color: i === 0 ? pc : '#2a2a2a' }}>W{w.weekNum}</div>
                  <div style={{ fontSize: '8px', color: i === 0 ? '#aaa' : '#333', lineHeight: 1.2 }}>
                    {isTR ? w.phaseTr.slice(0, 4) : w.phase.slice(0, 4)}
                    {w.isDeload ? '↓' : ''}
                  </div>
                  <div style={{ fontSize: '7px', color: '#2a2a2a' }}>{w.tss}T</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VDOT reference */}
      <div style={{ fontSize: '8px', color: '#222', marginTop: '8px' }}>
        {isTR ? `Tüm tempolar VDOT ${analysis.currentVdot} üzerinden (Daniels 2014)` : `All paces from VDOT ${analysis.currentVdot} (Daniels 2014)`}
      </div>
    </div>
  )
}
