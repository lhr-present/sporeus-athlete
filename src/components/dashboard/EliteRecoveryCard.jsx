// ─── EliteRecoveryCard.jsx — Standalone surface for eliteProgramRecovery ────
//
// Surfaces `buildRecoveryProgram` (Halson 2019 sleep, Kellmann 2018 recovery
// science, Plews & Buchheit 2017 HRV, Walker 2017 sleep architecture,
// Huberman 2022 NSDR) directly from the athlete profile.
//
// EliteProgramCard already consumes this lib indirectly as one slab inside a
// 2000-line race-plan output. This card pulls the structured recovery program
// to the surface so an athlete can see — at a glance —
//   • sleep target (hours/night) per phase
//   • deload-week cadence per phase
//   • top 2-3 modality recommendations per phase
//
// Pure presentation; the pure-fn does all the science.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  buildRecoveryProgram,
  RECOVERY_CITATION,
} from '../../lib/athlete/eliteProgramRecovery.js'

const MONO = "'IBM Plex Mono', monospace"
const ALL_PHASES = [
  { phase: 'Base' },
  { phase: 'Build' },
  { phase: 'Peak' },
  { phase: 'Taper' },
]
const PHASE_LABEL_TR = {
  Base:  'TEMEL',
  Build: 'YAPILANMA',
  Peak:  'TEPE',
  Taper: 'DİNÇLENME',
}
const PHASE_COLOR = {
  Base:  '#666666',
  Build: '#0064ff',
  Peak:  '#ff6600',
  Taper: '#f5c542',
}

/**
 * Heuristic cohort selector from profile (no log inspection — keeps the
 * card fast and avoids re-deriving currentLevel from scratch).
 * <5 weekly hours → beginner; 5-10 → intermediate; >10 → elite.
 */
function cohortFromProfile(profile) {
  const hrs = Number(profile?.weeklyHours)
  if (!Number.isFinite(hrs) || hrs <= 0) return 'intermediate'
  if (hrs < 5) return 'beginner'
  if (hrs > 10) return 'elite'
  return 'intermediate'
}

function weeklyTSSFromProfile(profile) {
  const goal = Number(profile?.weeklyTssGoal)
  if (Number.isFinite(goal) && goal > 0) return [goal]
  return []
}

function EliteRecoveryCard({ profile = {}, log = [] }) {
  // log is accepted for API parity with other dashboard cards; not used here
  void log
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const sport = profile?.primarySport || profile?.sport || null

  const program = useMemo(() => {
    if (!sport) return null
    const cohort = cohortFromProfile(profile)
    const weeklyTSS = weeklyTSSFromProfile(profile)
    const rp = buildRecoveryProgram({
      phases: ALL_PHASES,
      weeklyTSS,
      cohort,
    })
    if (!rp || Object.keys(rp).length === 0) return null
    return rp
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, profile?.weeklyHours, profile?.weeklyTssGoal])

  // Gate: render NOTHING when the required profile input is missing.
  if (!sport || !program) return null

  const title = isTR ? 'ELİT TOPARLANMA PROGRAMI' : 'ELITE RECOVERY PROGRAM'
  const ariaLabel = isTR
    ? 'Elit toparlanma programı — uyku, deload ve modalite önerileri'
    : 'Elite recovery program — sleep, deload, and modality recommendations'
  const sleepHeader = isTR ? 'UYKU' : 'SLEEP'
  const deloadHeader = isTR ? 'DELOAD' : 'DELOAD'
  const modalitiesHeader = isTR ? 'TOP MODALİTELER' : 'TOP MODALITIES'
  const sleepUnit = isTR ? 'sa/gece' : 'h/night'
  const deloadEvery = (n) => (
    n > 0
      ? (isTR ? `her ${n} haftada` : `every ${n} weeks`)
      : (isTR ? 'taper haftası' : 'race week is deload')
  )

  const phaseOrder = ['Base', 'Build', 'Peak', 'Taper']
  const phasesToRender = phaseOrder.filter(p => program[p])

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-elite-recovery-card
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
          {title}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {phasesToRender.map(phaseName => {
          const p = program[phaseName]
          const [lo, hi] = p.sleepHoursTarget
          const sleepStr = lo === hi ? `${lo}` : `${lo}–${hi}`
          const top = (p.modalities || []).slice(0, 3)
          const color = PHASE_COLOR[phaseName]
          const label = isTR ? PHASE_LABEL_TR[phaseName] : phaseName.toUpperCase()
          return (
            <div
              key={phaseName}
              data-phase={phaseName}
              style={{
                border: `1px solid ${color}55`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 4,
                padding: '10px 12px',
                background: `${color}0a`,
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: 700, color,
                letterSpacing: '0.06em', marginBottom: 6,
              }}>
                {label}
              </div>

              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 16,
                fontSize: 10, color: 'var(--text)', marginBottom: 6,
              }}>
                <div data-sleep-target>
                  <span style={{ color: 'var(--muted)' }}>{sleepHeader}: </span>
                  <span style={{ fontWeight: 700 }}>{sleepStr} {sleepUnit}</span>
                </div>
                <div data-deload>
                  <span style={{ color: 'var(--muted)' }}>{deloadHeader}: </span>
                  <span style={{ fontWeight: 700 }}>{deloadEvery(p.deloadEvery)}</span>
                </div>
              </div>

              {top.length > 0 ? (
                <div>
                  <div style={{
                    fontSize: 9, color: 'var(--muted)',
                    letterSpacing: '0.05em', marginBottom: 4,
                  }}>
                    {modalitiesHeader}
                  </div>
                  <ul style={{
                    margin: 0, paddingLeft: 16,
                    fontSize: 10, lineHeight: 1.55, color: 'var(--text)',
                  }}>
                    {top.map((m, i) => (
                      <li key={i} data-modality>
                        {isTR ? (m.tr || m.en) : (m.en || m.tr)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div
        data-recovery-citation
        style={{
          marginTop: 12,
          fontSize: 9,
          color: '#555',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}
      >
        {RECOVERY_CITATION}
      </div>
    </div>
  )
}

export default memo(EliteRecoveryCard)
