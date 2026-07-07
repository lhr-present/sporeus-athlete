import { lazy, Suspense, useContext } from 'react'
import { useData } from '../contexts/DataContext.jsx'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import ErrorBoundary from './ErrorBoundary.jsx'

const MissionHeadline   = lazy(() => import('./dashboard/MissionHeadline.jsx'))
const EliteProgramCard  = lazy(() => import('./dashboard/EliteProgramCard.jsx'))
const TodayProgrammedSessionCard = lazy(() => import('./dashboard/TodayProgrammedSessionCard.jsx'))
import { useMemo } from 'react'
import { buildEliteProgram } from '../lib/athlete/eliteProgram.js'
const NextTrainingCard  = lazy(() => import('./dashboard/NextTrainingCard.jsx'))
const ProgramCalendar   = lazy(() => import('./dashboard/ProgramCalendar.jsx'))
const RaceCountdownBanner = lazy(() => import('./dashboard/RaceCountdownBanner.jsx'))

export default function ProgramView() {
  const { log, profile, setLog } = useData()
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const [persistedProgram] = useLocalStorage('sporeus-eliteProgram', null)
  const [programStart] = useLocalStorage('sporeus-eliteProgramStart', null)
  const [yearlyPlan] = useLocalStorage('sporeus-yearly-plan', null)
  // v9.490 (program-dataflow HIGH F7): sporeus-eliteProgram stores {input, form}
  // — NOT a built program — but this view passed the raw blob straight into
  // NextTrainingCard/ProgramCalendar/RaceCountdownBanner. Result: "no quality
  // session in the next 14 days" forever, the calendar limping on the yearly-
  // plan fallback, and buildPlanMilestones=[] leaving the FieldTestModal
  // adaptation channel unreachable. Build from input (same pattern + live
  // cycle-field re-injection as EliteProgramCard's evaluation); legacy stores
  // holding a built program pass through unchanged.
  const builtProgram = useMemo(() => {
    if (!persistedProgram) return null
    if (!persistedProgram.input) return persistedProgram  // legacy built shape
    try {
      const cycleLive = {}
      if (profile?.gender)          cycleLive.gender = profile.gender
      if (profile?.lastPeriodStart) cycleLive.lastPeriodStart = profile.lastPeriodStart
      if (profile?.cycleLength)     cycleLive.cycleLength = profile.cycleLength
      const r = buildEliteProgram({
        ...persistedProgram.input,
        profile: { ...(persistedProgram.input.profile || {}), ...cycleLive },
      })
      if (!r || r._rejected || !r.feasibility) return null
      return r
    } catch { return null }
  }, [persistedProgram, profile])
  const hasPlan = !!builtProgram && !!programStart

  return (
    <div className="sp-fade" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ ...S.mono, fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
        {isTR ? 'MİSYON #1 · YILLIK PROGRAM ÜRETİCİ' : 'MISSION #1 · YEARLY PROGRAM BUILDER'}
      </div>
      <div style={{ ...S.mono, fontSize: 18, fontWeight: 700, marginBottom: 14, lineHeight: 1.3 }}>
        {isTR
          ? 'Hedeften plana — bilim temelli yıllık antrenman programı.'
          : 'From target to plan — a science-based yearly training program.'}
      </div>

      {/* Race countdown banner (only when plan exists with a race date) */}
      {hasPlan ? (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <RaceCountdownBanner
              program={builtProgram}
              programStart={programStart}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {/* Hero: NEXT TRAINING (or empty-state CTA when no plan) */}
      {hasPlan ? (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <NextTrainingCard
              defaultProgram={builtProgram}
              defaultProgramStart={programStart}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <MissionHeadline />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Calendar: full N-week grid, only when plan exists */}
      {hasPlan ? (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ProgramCalendar
              program={builtProgram}
              programStart={programStart}
              yearlyPlan={yearlyPlan}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {/* The form + result block (broader content, lifecycle, adherence,
          coach-edits banner, etc.) — same component, now follows the
          calendar so an athlete focused on day-to-day doesn't have to
          scroll past the form. */}
      <div data-elite-program-card>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <EliteProgramCard log={log} profile={profile} setLog={setLog} />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Today-anchored card retained for session-status + autopsy flow */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <TodayProgrammedSessionCard log={log} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
