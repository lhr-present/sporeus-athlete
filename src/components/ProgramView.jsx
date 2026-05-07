import { lazy, Suspense, useContext } from 'react'
import { useData } from '../contexts/DataContext.jsx'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import ErrorBoundary from './ErrorBoundary.jsx'

const MissionHeadline   = lazy(() => import('./dashboard/MissionHeadline.jsx'))
const EliteProgramCard  = lazy(() => import('./dashboard/EliteProgramCard.jsx'))
const TodayProgrammedSessionCard = lazy(() => import('./dashboard/TodayProgrammedSessionCard.jsx'))

export default function ProgramView() {
  const { log, profile } = useData()
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

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

      <ErrorBoundary>
        <Suspense fallback={null}>
          <MissionHeadline />
        </Suspense>
      </ErrorBoundary>

      <div data-elite-program-card>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <EliteProgramCard log={log} profile={profile} />
          </Suspense>
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <Suspense fallback={null}>
          <TodayProgrammedSessionCard log={log} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
