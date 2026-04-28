// src/components/dashboard/RaceGoalDashCard.jsx — E87
// Compact daily training card: auto-detected VDOT status, today's TSB-adapted session
// with full multi-modal output (pace + HR range + RPE + feel), weekly TSS compliance bar.
// Connects vdotTracker (E85) + paceZoneTranslator (E86) + training plan (E82).
import { useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { detectVdotFromLog } from '../../lib/athlete/vdotTracker.js'
import { translateAllZones } from '../../lib/athlete/paceZoneTranslator.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import { buildTrainingPlan, getCurrentPlanWeek } from '../../lib/athlete/trainingBridge.js'
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

const CONF_COLOR = { high: GREEN, medium: AMBER, low: RED }

// Detect dominant zone from session type string
function sessionZoneKey(sessionType) {
  const t = (sessionType || '').toLowerCase()
  if (/interval|interval|tekrar/i.test(t)) return 'I'
  if (/rep|sprint|hız/i.test(t)) return 'R'
  if (/threshold|tempo|eşik/i.test(t)) return 'T'
  if (/marathon|maraton/i.test(t)) return 'M'
  return 'E'
}

// TSB fatigue label
function tsbStatus(tsb) {
  if (tsb > 10)   return { label: 'Fresh',    labelTR: 'Dinç',      color: GREEN }
  if (tsb > -5)   return { label: 'Normal',   labelTR: 'Normal',    color: BLUE  }
  if (tsb > -20)  return { label: 'Tired',    labelTR: 'Yorgun',    color: AMBER }
  return               { label: 'Very Tired', labelTR: 'Çok Yorgun', color: RED  }
}

// Decide whether to downgrade today's session based on TSB
function adaptSession(session, tsb) {
  if (!session || tsb >= -5) return { session, downgraded: false }
  if (tsb < -20) return {
    session: { ...session, type: 'Easy Run (TSB adapted)', tr: 'Kolay Koşu (TSB uyarlaması)', zone: 1, paceStr: null },
    downgraded: true,
  }
  // Moderate fatigue — keep session but flag it
  return { session, downgraded: false, warn: true }
}

// Sum TSS for today's week from log
function weekTSSLogged(log, weekStart, weekEnd) {
  return log
    .filter(e => e.date >= weekStart && e.date <= weekEnd && e.tss > 0)
    .reduce((s, e) => s + (e.tss || 0), 0)
}

export default function RaceGoalDashCard({ log = [], profile = {}, isTR }) {
  const [saved] = useLocalStorage('sporeus-race-goal-v2', null)
  const today   = new Date().toISOString().slice(0, 10)
  const todayDow = new Date(today + 'T12:00:00Z').getUTCDay()

  const detected = useMemo(() => detectVdotFromLog(log, 90, today), [log, today])

  const maxHR = useMemo(() => {
    if (profile?.maxhr > 0) return profile.maxhr
    if (profile?.age > 0) return Math.round(208 - 0.7 * profile.age)
    return null
  }, [profile])

  const zones = useMemo(() => {
    const vdot = detected?.vdot
    if (!vdot) return null
    return translateAllZones(vdot, maxHR)
  }, [detected, maxHR])

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

  const fitness = useMemo(() => predictFitness(log || []), [log])
  const tsb     = fitness?.tsb ?? 0

  const tsbInfo = tsbStatus(tsb)

  const todaySession   = currentWeekData?.week?.sessions?.[todayDow] || null
  const { session: adaptedSession, downgraded, warn } = adaptSession(todaySession, tsb)

  const sessionZone     = adaptedSession ? sessionZoneKey(adaptedSession.type) : 'E'
  const zoneInfo        = zones?.[sessionZone]

  const loggedTSS       = useMemo(() => {
    if (!currentWeekData?.week) return 0
    return weekTSSLogged(log, currentWeekData.week.startDate, currentWeekData.week.endDate)
  }, [log, currentWeekData])
  const plannedTSS      = currentWeekData?.week?.tss || 0
  const tssProgress     = plannedTSS > 0 ? Math.min(1, loggedTSS / plannedTSS) : 0

  // Don't render if no goal is set and no VDOT detected
  if (!saved && !detected) return null

  return (
    <div style={{ ...S.card, fontFamily: MONO }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'YARIŞA HAZIRLIK' : 'RACE READINESS'}
        </div>
        {analysis && (
          <div style={{ fontSize: '8px', color: ORANGE, letterSpacing: '0.04em' }}>
            {analysis.goalTimeStr} · {analysis.distanceLabel}
          </div>
        )}
      </div>

      {/* ── Auto-VDOT Status Bar ── */}
      {detected && (
        <div style={{ marginBottom: '10px', padding: '6px 8px', background: '#0a0a0a', borderRadius: '3px', borderLeft: `3px solid ${CONF_COLOR[detected.confidence]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '9px', color: DIMMER, letterSpacing: '0.06em' }}>
                {isTR ? 'TESPİT EDİLEN VDOT' : 'AUTO-DETECTED VDOT'}
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: CONF_COLOR[detected.confidence], marginLeft: '8px' }}>
                {detected.vdot}
              </span>
              <span style={{ fontSize: '8px', color: DIM, marginLeft: '4px' }}>
                ({detected.distanceKm}km · {detected.date})
              </span>
            </div>
            <span style={{ fontSize: '7px', color: CONF_COLOR[detected.confidence], border: `1px solid ${CONF_COLOR[detected.confidence]}44`, borderRadius: '2px', padding: '1px 4px', letterSpacing: '0.05em' }}>
              {detected.confidence.toUpperCase()}
            </span>
          </div>
          {detected.confidence === 'low' && (
            <div style={{ fontSize: '8px', color: AMBER, marginTop: '3px' }}>
              △ {isTR ? 'Kısa koşudan tahmin — doğruluğu sınırlı.' : 'Short run estimate — accuracy limited.'}
            </div>
          )}
        </div>
      )}

      {/* ── TSB Freshness ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '9px', color: DIMMER }}>
          TSB {tsb >= 0 ? '+' : ''}{tsb}
        </span>
        <span style={{ fontSize: '8px', color: tsbInfo.color, border: `1px solid ${tsbInfo.color}33`, borderRadius: '2px', padding: '1px 5px' }}>
          {isTR ? tsbInfo.labelTR : tsbInfo.label}
        </span>
      </div>

      {/* ── Today's Session ── */}
      {adaptedSession && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', background: '#0f0f0f', border: `1px solid ${zoneInfo?.color || DIM}33`, borderRadius: '3px' }}>
          <div style={{ fontSize: '8px', color: DIMMER, letterSpacing: '0.08em', marginBottom: '4px' }}>
            {isTR ? 'BUGÜNKÜ ANTRENMAN' : "TODAY'S SESSION"}
            {downgraded && <span style={{ color: AMBER, marginLeft: '6px' }}>↓ TSB {isTR ? 'uyarlaması' : 'adapted'}</span>}
            {warn && !downgraded && <span style={{ color: AMBER, marginLeft: '6px' }}>△ {isTR ? 'yorgunluk var' : 'fatigue noted'}</span>}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#bbb', marginBottom: '6px' }}>
            {isTR ? (adaptedSession.tr || adaptedSession.type) : adaptedSession.type}
          </div>

          {zoneInfo && !downgraded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {/* Pace */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ color: DIMMER }}>{isTR ? 'Tempo' : 'Pace'}</span>
                <span style={{ color: zoneInfo.color, fontWeight: 700 }}>{zoneInfo.pace}/km</span>
              </div>
              {/* HR Range */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ color: DIMMER }}>{isTR ? 'Kalp atışı' : 'Heart rate'}</span>
                <span style={{ color: '#888' }}>{zoneInfo.hrRange.str}</span>
              </div>
              {/* RPE */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ color: DIMMER }}>RPE</span>
                <span style={{ color: '#888' }}>{zoneInfo.rpeRange} / 10</span>
              </div>
              {/* Feel */}
              <div style={{ fontSize: '8px', color: '#555', marginTop: '3px', lineHeight: 1.4, fontStyle: 'italic' }}>
                "{isTR ? zoneInfo.feelTR : zoneInfo.feelEN}"
              </div>
              {/* Format */}
              <div style={{ fontSize: '8px', color: DIMMER, marginTop: '3px', lineHeight: 1.4, padding: '4px 6px', background: '#0a0a0a', borderRadius: '2px' }}>
                {isTR ? zoneInfo.formatTR : zoneInfo.formatEN}
              </div>
            </div>
          )}

          {downgraded && (
            <div style={{ fontSize: '8px', color: AMBER, lineHeight: 1.5 }}>
              {isTR
                ? 'TSB çok düşük. Bugün kolay koş, iyileş. Yarın tekrar değerlendir.'
                : 'TSB too low. Run easy today, recover. Reassess tomorrow.'}
            </div>
          )}

          {/* ── Full prescription (structure text) ── */}
          {!downgraded && adaptedSession?.run?.structure && (
            <div style={{ fontSize: '8px', color: '#555', marginTop: '6px', lineHeight: 1.5, padding: '5px 7px', background: '#0a0a0a', borderRadius: '2px', borderLeft: '2px solid #222' }}>
              {isTR ? adaptedSession.run.structureTr : adaptedSession.run.structure}
            </div>
          )}

          {/* ── Drills strip ── */}
          {!downgraded && adaptedSession?.drills && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '7px', color: DIM, letterSpacing: '0.08em', marginBottom: '3px' }}>
                ◈ {isTR ? 'HAREKETLİLİK / ALIŞTIIRMALAR' : 'DRILLS'} — {adaptedSession.drills.durationMin}min
              </div>
              <div style={{ fontSize: '8px', color: '#555', lineHeight: 1.5 }}>
                {adaptedSession.drills.exercises.map(e => isTR ? e.tr : e.name).join(' · ')}
              </div>
            </div>
          )}

          {/* ── Strength strip ── */}
          {!downgraded && adaptedSession?.strength && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '7px', color: DIM, letterSpacing: '0.08em', marginBottom: '3px' }}>
                ◈ {isTR ? 'KUVVETLENDİRME' : 'STRENGTH'} — {adaptedSession.strength.durationMin}min
              </div>
              <div style={{ fontSize: '8px', color: '#555', lineHeight: 1.5 }}>
                {adaptedSession.strength.exercises.map(e =>
                  `${isTR ? e.tr : e.name} ${e.sets}×${e.reps}`
                ).join(' · ')}
              </div>
            </div>
          )}

          {/* ── Preventive strip ── */}
          {!downgraded && adaptedSession?.preventive && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '7px', color: DIM, letterSpacing: '0.08em', marginBottom: '3px' }}>
                ◈ {isTR ? 'KORUYucu ÇALIŞMALAR' : 'PREVENTIVE'} — {adaptedSession.preventive.durationMin}min
              </div>
              <div style={{ fontSize: '8px', color: '#555', lineHeight: 1.5 }}>
                {adaptedSession.preventive.exercises.map(e => isTR ? e.tr : e.name).join(' · ')}
              </div>
            </div>
          )}

          {/* ── Total time ── */}
          {!downgraded && adaptedSession?.totalDurationMin > 0 && (
            <div style={{ fontSize: '8px', color: '#333', marginTop: '7px', textAlign: 'right' }}>
              {isTR ? 'TOPLAM' : 'TOTAL'} ~{adaptedSession.totalDurationMin}min
            </div>
          )}
        </div>
      )}

      {/* ── Weekly TSS Compliance ── */}
      {plannedTSS > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: DIMMER, marginBottom: '3px' }}>
            <span>{isTR ? 'HAFTALIK TSS' : 'WEEKLY TSS'}</span>
            <span style={{ color: tssProgress >= 1 ? GREEN : '#666' }}>
              {loggedTSS} / {plannedTSS}
              {tssProgress >= 1 && ' ✓'}
            </span>
          </div>
          <div style={{ height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${Math.round(tssProgress * 100)}%`,
              background: tssProgress >= 1 ? GREEN : tssProgress >= 0.6 ? ORANGE : BLUE,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* ── Plan info when no goal set ── */}
      {!saved && detected && (
        <div style={{ fontSize: '8px', color: DIMMER, marginTop: '6px', lineHeight: 1.5 }}>
          {isTR
            ? 'Hedef yarış belirlemek için Yarış Hedefi kartını kullan.'
            : 'Set a race goal in the Race Goal Analyzer to get your training plan.'}
        </div>
      )}

      {/* ── Phase + week tag when plan active ── */}
      {currentWeekData?.week && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#333', marginTop: '6px' }}>
          <span>{currentWeekData.week.isDeload ? '↓ Deload' : currentWeekData.week.phase}</span>
          <span>W{currentWeekData.week.weekNum}/{plan?.length}</span>
        </div>
      )}
    </div>
  )
}
