// ─── dashboard/RaceCountdownBanner.jsx — race countdown + phase banner ──────
//
// v9.5.0. Mounted at the top of ProgramView (above NextTrainingCard) to
// anchor the athlete's temporal focus. Displays:
//   • Big number: days to race day
//   • Current week (W X / Y) + phase chip (colored)
//   • Next milestone with date and label
//
// All bilingual via LangCtx. Reads from props (program + programStart) so
// the parent can pass either persisted plan or live result.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import {
  buildPlanMilestones,
  getNextMilestone,
  daysUntil,
} from '../../lib/athlete/planMilestones.js'

const PHASE_COLOR = {
  Base:  '#0064ff',
  Build: '#00aa66',
  Peak:  '#ff6600',
  Taper: '#9966cc',
  Race:  '#dc3545',
}

function todayISO() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export default function RaceCountdownBanner({ program, programStart }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const todayIso = todayISO()

  const computed = useMemo(() => {
    if (!program || !programStart) return null
    const startDt = parseISO(programStart)
    const todayDt = parseISO(todayIso)
    if (!startDt || !todayDt) return null

    const milestones = buildPlanMilestones(program, programStart)
    const raceISO = program?.feasibility?.effectiveRaceDate
      || program?.input?.raceDate
      || null

    const dToRace = raceISO ? daysUntil(raceISO, todayIso) : null

    // Compute current week + total weeks
    const offsetDays = Math.round((todayDt.getTime() - startDt.getTime()) / 86400000)
    const totalWeeks = (program.phases || []).reduce((a, p) => a + (p.weeks?.length || 0), 0)
    const currentWeek = offsetDays < 0
      ? 0
      : Math.min(totalWeeks, Math.floor(offsetDays / 7) + 1)

    // Current phase
    let currentPhase = null
    if (currentWeek > 0) {
      for (const p of program.phases || []) {
        if (Array.isArray(p.weeks) && p.weeks.includes(currentWeek)) {
          currentPhase = p.phase
          break
        }
      }
    }

    const nextMilestone = getNextMilestone(milestones, todayIso)
    const dToMilestone = nextMilestone ? daysUntil(nextMilestone.dateISO, todayIso) : null

    return {
      raceISO,
      dToRace,
      currentWeek,
      totalWeeks,
      currentPhase,
      nextMilestone,
      dToMilestone,
    }
  }, [program, programStart, todayIso])

  if (!computed) return null
  const { dToRace, currentWeek, totalWeeks, currentPhase, nextMilestone, dToMilestone, raceISO } = computed

  if (!raceISO) return null

  const phaseColor = PHASE_COLOR[currentPhase] || '#666'
  const isPostRace = dToRace != null && dToRace < 0
  const isToday = dToRace === 0

  return (
    <div data-race-countdown
      style={{
        marginBottom: 14,
        padding: '12px 14px',
        borderRadius: 4,
        background: isPostRace
          ? 'linear-gradient(90deg, #44444433, transparent)'
          : isToday
            ? 'linear-gradient(90deg, #dc354533, transparent)'
            : `linear-gradient(90deg, ${phaseColor}33, transparent)`,
        border: `1px solid ${isPostRace ? '#444' : isToday ? '#dc3545' : phaseColor}`,
        borderLeft: `4px solid ${isPostRace ? '#444' : isToday ? '#dc3545' : phaseColor}`,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        {/* Days-to-race big number */}
        <div style={{ minWidth: 90 }}>
          <div style={{ ...S.mono, fontSize: 30, fontWeight: 700, lineHeight: 1, color: isToday ? '#dc3545' : phaseColor }}>
            {isPostRace ? `+${Math.abs(dToRace)}` : isToday ? '0' : dToRace}
          </div>
          <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em', marginTop: 2 }}>
            {isPostRace
              ? (isTR ? `GÜN GEÇTİ` : `DAYS PAST`)
              : isToday
                ? (isTR ? 'YARIŞ GÜNÜ' : 'RACE DAY')
                : (isTR ? 'GÜN · YARIŞ' : 'DAYS · RACE')}
          </div>
        </div>

        {/* Current week + phase */}
        <div style={{ flex: '1 1 auto', minWidth: 140 }}>
          {currentWeek > 0 && totalWeeks > 0 ? (
            <div style={{ ...S.mono, fontSize: 12, fontWeight: 700 }}>
              {isTR ? `Hafta ${currentWeek} / ${totalWeeks}` : `Week ${currentWeek} of ${totalWeeks}`}
            </div>
          ) : null}
          {currentPhase ? (
            <span style={{
              display: 'inline-block',
              ...S.mono,
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              background: phaseColor,
              color: '#fff',
              borderRadius: 3,
              letterSpacing: '0.06em',
              marginTop: 4,
            }}>
              {(currentPhase || '').toUpperCase()} {isTR ? 'FAZI' : 'PHASE'}
            </span>
          ) : (
            <div style={{ ...S.mono, fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
              {isPostRace
                ? (isTR ? 'Plan tamamlandı' : 'Plan complete')
                : (isTR ? 'Plan henüz başlamadı' : 'Plan not started yet')}
            </div>
          )}
        </div>

        {/* Next milestone */}
        {nextMilestone ? (
          <div style={{ ...S.mono, fontSize: 11, textAlign: 'right', flex: '1 1 auto', minWidth: 180 }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 2 }}>
              {isTR ? 'BİR SONRAKİ KİLOMETRE TAŞI' : 'NEXT MILESTONE'}
            </div>
            <div style={{ fontWeight: 600 }}>
              {isTR ? nextMilestone.label.tr : nextMilestone.label.en}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {nextMilestone.dateISO}
              {dToMilestone != null && dToMilestone >= 0
                ? ` · ${dToMilestone === 0 ? (isTR ? 'bugün' : 'today') : (isTR ? `${dToMilestone} gün` : `${dToMilestone}d`)}`
                : ''}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
