import { useMemo, useState, useContext } from 'react'
import { S } from '../../styles.js'
import { getGoalProgress, getGoalStatus, calcWeeklyRate } from '../../lib/sport/goalTracker.js'
import { projectCTLAtRace, assessRaceReadiness, avgWeeklyTSSFromLog } from '../../lib/sport/raceGoalProjection.js'
import { calcLoad } from '../../lib/formulas.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

const STATUS_COLOR = { on_track: '#5bc25b', behind: '#f5c542', impossible: '#e03030' }
const STATUS_DOT   = { on_track: '●', behind: '●', impossible: '●' }

const RACE_STATUS_COLOR = {
  on_track:        '#5bc25b',
  at_risk:         '#f5c542',
  needs_attention: '#e03030',
}

export default function GoalTrackerCard({ log, profile: _profile, dl }) {
  const { t } = useContext(LangCtx)

  const goals = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('sporeus-goals') || '[]')
    } catch {
      return []
    }
  }, [])

  const goalData = useMemo(() => {
    if (!goals.length || !log.length) return []

    const now = Date.now()
    const cutoff = new Date(now - 12 * 7 * 86400000).toISOString().slice(0, 10)

    return goals.map(goal => {
      // Filter last 12 weeks of log
      const recent = log.filter(e => e.date >= cutoff)

      // Build dataPoints per type
      let dataPoints = []
      let currentValue = goal.current ?? 0

      if (goal.type === 'ftp') {
        dataPoints = recent
          .filter(e => e.ftp != null && e.ftp > 0)
          .map(e => ({ date: e.date, value: e.ftp }))
        if (dataPoints.length) currentValue = dataPoints[dataPoints.length - 1].value

      } else if (goal.type === 'vo2max') {
        dataPoints = recent
          .filter(e => e.vo2max != null && e.vo2max > 0)
          .map(e => ({ date: e.date, value: e.vo2max }))
        if (dataPoints.length) currentValue = dataPoints[dataPoints.length - 1].value

      } else if (goal.type === 'distance') {
        // Group by ISO week, sum distances
        const byWeek = {}
        recent.forEach(e => {
          if (!e.distance || e.distance <= 0) return
          const d = new Date(e.date)
          const dow = d.getDay() || 7
          const mon = new Date(d); mon.setDate(d.getDate() - dow + 1)
          const wk = mon.toISOString().slice(0, 10)
          byWeek[wk] = (byWeek[wk] || 0) + e.distance
        })
        dataPoints = Object.entries(byWeek)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }))
        currentValue = dataPoints.length ? dataPoints[dataPoints.length - 1].value : 0

      } else if (goal.type === 'time') {
        // Weekly total duration
        const byWeek = {}
        recent.forEach(e => {
          if (!e.duration || e.duration <= 0) return
          const d = new Date(e.date)
          const dow = d.getDay() || 7
          const mon = new Date(d); mon.setDate(d.getDate() - dow + 1)
          const wk = mon.toISOString().slice(0, 10)
          byWeek[wk] = (byWeek[wk] || 0) + e.duration
        })
        dataPoints = Object.entries(byWeek)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }))
        currentValue = dataPoints.length ? dataPoints[dataPoints.length - 1].value : 0

      } else {
        // Fallback: use tss as proxy
        dataPoints = recent
          .filter(e => e.tss != null && e.tss > 0)
          .map(e => ({ date: e.date, value: e.tss }))
        if (dataPoints.length) currentValue = dataPoints[dataPoints.length - 1].value
      }

      const weeklyRate = calcWeeklyRate(dataPoints)
      const progress   = getGoalProgress(goal, currentValue)
      const statusObj  = getGoalStatus(goal, currentValue, weeklyRate)

      return { goal, currentValue, weeklyRate, progress, statusObj }
    })
  }, [goals, log])

  // ── Race Goal state ──────────────────────────────────────────────────────────
  const [raceGoalOpen, setRaceGoalOpen] = useLocalStorage('sporeus-race-goal-open', true)
  const [raceGoal, setRaceGoal] = useLocalStorage('sporeus-race-goal', { raceDate: '', targetCTL: '' })
  const [formDate, setFormDate] = useState(raceGoal.raceDate || '')
  const [formCTL, setFormCTL]   = useState(raceGoal.targetCTL || '')

  const raceProjection = useMemo(() => {
    if (!raceGoal.raceDate || !raceGoal.targetCTL) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const race  = new Date(raceGoal.raceDate); race.setHours(0, 0, 0, 0)
    const daysUntilRace = Math.round((race - today) / 86400000)
    if (daysUntilRace < 0) return null
    const { ctl: currentCTL } = calcLoad(log)
    const avgTSS = avgWeeklyTSSFromLog(log, 4)
    const projected = projectCTLAtRace(currentCTL, avgTSS, daysUntilRace)
    const readiness = assessRaceReadiness(projected, Number(raceGoal.targetCTL))
    return { projected, readiness, currentCTL, daysUntilRace }
  }, [raceGoal, log])

  function handleRaceGoalSave() {
    setRaceGoal({ raceDate: formDate, targetCTL: formCTL })
  }

  const statusLabel = {
    on_track:        t('raceGoalOnTrack'),
    at_risk:         t('raceGoalAtRisk'),
    needs_attention: t('raceGoalNeedsAttention'),
  }

  if (!goals.length) {
    return (
      <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
        <div style={S.cardTitle}>GOAL TRACKER</div>
        <div style={{ ...S.mono, fontSize: '12px', color: '#888', textAlign: 'center', padding: '16px 0' }}>
          Set goals in Profile → Goals
        </div>
        <RaceGoalSection
          raceGoalOpen={raceGoalOpen} setRaceGoalOpen={setRaceGoalOpen}
          formDate={formDate} setFormDate={setFormDate}
          formCTL={formCTL} setFormCTL={setFormCTL}
          handleRaceGoalSave={handleRaceGoalSave}
          raceProjection={raceProjection}
          raceGoal={raceGoal}
          statusLabel={statusLabel}
          t={t}
        />
      </div>
    )
  }

  if (!dl.goaltracker) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      <div style={S.cardTitle}>GOAL TRACKER</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {goalData.map(({ goal, currentValue, progress, statusObj }, i) => {
          const pct   = Math.max(0, Math.min(100, progress.pct))
          const color = STATUS_COLOR[statusObj.status] || '#888'
          const label = goal.label || goal.type?.toUpperCase() || 'GOAL'

          return (
            <div key={i}>
              {/* Row: label + status dot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                  {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color, fontSize: '9px' }}>{STATUS_DOT[statusObj.status]}</span>
                  <span style={{ ...S.mono, fontSize: '10px', color }}>{statusObj.status.replace('_', ' ').toUpperCase()}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ ...S.mono, fontSize: '10px', color: '#888' }}>
                  {currentValue} / {goal.target} · {pct}%
                </span>
                <span style={{ ...S.mono, fontSize: '10px', color: '#888' }}>
                  {progress.daysLeft > 0 ? `${progress.daysLeft}d left` : 'Overdue'}
                </span>
              </div>

              {/* Status message */}
              <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginTop: '2px' }}>
                {statusObj.message}
              </div>
            </div>
          )
        })}
      </div>

      {/* Race Goal section */}
      <RaceGoalSection
        raceGoalOpen={raceGoalOpen} setRaceGoalOpen={setRaceGoalOpen}
        formDate={formDate} setFormDate={setFormDate}
        formCTL={formCTL} setFormCTL={setFormCTL}
        handleRaceGoalSave={handleRaceGoalSave}
        raceProjection={raceProjection}
        raceGoal={raceGoal}
        statusLabel={statusLabel}
        t={t}
      />
    </div>
  )
}

// ── Race Goal sub-component ────────────────────────────────────────────────────
function RaceGoalSection({
  raceGoalOpen, setRaceGoalOpen,
  formDate, setFormDate,
  formCTL, setFormCTL,
  handleRaceGoalSave,
  raceProjection,
  raceGoal,
  statusLabel,
  t,
}) {
  const hasGoal = raceGoal.raceDate && raceGoal.targetCTL

  return (
    <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setRaceGoalOpen(o => !o)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, marginBottom: raceGoalOpen ? '12px' : 0,
        }}
      >
        <span style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.05em' }}>
          {t('raceGoal').toUpperCase()}
        </span>
        <span style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)' }}>
          {raceGoalOpen ? '▲' : '▼'}
        </span>
      </button>

      {raceGoalOpen && (
        <div>
          {/* Form fields */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginBottom: '3px', letterSpacing: '0.05em' }}>
                {t('raceGoalDate').toUpperCase()}
              </div>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{
                  ...S.mono, fontSize: '11px',
                  background: 'var(--input-bg, var(--card-bg))',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: '3px', padding: '4px 6px',
                  width: '100%', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginBottom: '3px', letterSpacing: '0.05em' }}>
                {t('raceGoalTargetCTL').toUpperCase()}
              </div>
              <input
                type="number"
                value={formCTL}
                onChange={e => setFormCTL(e.target.value)}
                placeholder="e.g. 80"
                min="0"
                style={{
                  ...S.mono, fontSize: '11px',
                  background: 'var(--input-bg, var(--card-bg))',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: '3px', padding: '4px 6px',
                  width: '100%', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleRaceGoalSave}
                style={{
                  ...S.mono, fontSize: '10px',
                  background: '#ff6600', color: '#fff',
                  border: 'none', borderRadius: '3px',
                  padding: '5px 10px', cursor: 'pointer',
                  fontWeight: 600, letterSpacing: '0.05em',
                }}
              >
                {t('raceGoalSave').toUpperCase()}
              </button>
            </div>
          </div>

          {/* Projection display */}
          {!hasGoal ? (
            <div style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
              {t('raceGoalEmpty')}
            </div>
          ) : raceProjection === null ? (
            <div style={{ ...S.mono, fontSize: '11px', color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
              {t('raceGoalEmpty')}
            </div>
          ) : (
            <div>
              {/* Projected CTL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>
                  {t('raceGoalProjected')}
                </span>
                <span style={{ ...S.mono, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                  {raceProjection.projected}
                </span>
              </div>

              {/* Progress bar */}
              {(() => {
                const { status, pct } = raceProjection.readiness
                const color = RACE_STATUS_COLOR[status] || '#888'
                const barPct = Math.max(0, Math.min(100, pct))
                return (
                  <div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                      <div style={{
                        width: `${barPct}%`, height: '100%',
                        background: color, borderRadius: '3px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>

                    {/* Status row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{
                        ...S.mono, fontSize: '10px', fontWeight: 600,
                        color, letterSpacing: '0.05em',
                      }}>
                        ● {statusLabel[status] || status}
                      </span>
                      <span style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>
                        {barPct}% · {raceProjection.daysUntilRace} {t('raceGoalDaysLeft')}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Citation */}
              <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', marginTop: '8px', textAlign: 'right' }}>
                Banister et al. (1975)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
