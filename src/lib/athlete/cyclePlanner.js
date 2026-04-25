// ─── cyclePlanner.js — Cycle-aware training guide (E31) ──────────────────────
import { currentCyclePhase, daysUntilPhase, cycleDay, PHASE_INFO, PHASES } from '../cycleUtils.js'

/**
 * Compute a full cycle plan for a female athlete.
 * Returns null if gender !== 'female' or lastPeriodStart is falsy.
 *
 * Returns {
 *   phase, dayInCycle, daysInCurrentPhase, daysUntilNext,
 *   nextPhase, phaseInfo, cycleLength, allPhases
 * }
 */
export function computeCyclePlan(profile = {}, today = new Date().toISOString().slice(0, 10)) {
  if ((profile.gender || '').toLowerCase() !== 'female') return null
  if (!profile.lastPeriodStart) return null

  const len    = Number(profile.cycleLength) || 28
  const lps    = profile.lastPeriodStart

  const phase = currentCyclePhase(lps, len, today)
  if (phase === null) return null

  const dayInCycle = cycleDay(lps, len, today)

  // Phase start days (mirrors daysUntilPhase logic)
  const ovDay = Math.round(len / 2)
  const starts = { menstruation: 1, follicular: 6, ovulation: ovDay, luteal: ovDay + 2 }

  const phaseStart = starts[phase]
  // daysInCurrentPhase: how many days since this phase started (0-based within phase)
  let daysInCurrentPhase = dayInCycle - phaseStart
  if (daysInCurrentPhase < 0) daysInCurrentPhase += len

  // nextPhase
  const phaseIdx = PHASES.indexOf(phase)
  const nextPhase = PHASES[(phaseIdx + 1) % 4]

  // daysUntilNext: days until next phase starts
  const daysUntilNext = daysUntilPhase(lps, len, nextPhase, today)

  // allPhases: daysUntil for each of the 4 phases
  const allPhases = PHASES.map(p => ({
    phase: p,
    daysUntil: daysUntilPhase(lps, len, p, today),
    color: PHASE_INFO[p].color,
  }))

  return {
    phase,
    dayInCycle,
    daysInCurrentPhase,
    daysUntilNext,
    nextPhase,
    phaseInfo: PHASE_INFO[phase],
    cycleLength: len,
    allPhases,
  }
}

/**
 * Training intensity recommendation per phase (science-backed).
 * Returns { intensity: 'high'|'moderate'|'low', tip_en: string, tip_tr: string }
 */
export function phaseTrainingRec(phase) {
  const recs = {
    menstruation: {
      intensity: 'low',
      tip_en: 'Easy efforts. Iron and hydration focus.',
      tip_tr: 'Kolay tempo. Demir ve hidrasyon önceliği.',
    },
    follicular: {
      intensity: 'high',
      tip_en: 'Rising estrogen — ideal for strength & intervals.',
      tip_tr: 'Östrojen artışı — kuvvet ve interval için ideal.',
    },
    ovulation: {
      intensity: 'high',
      tip_en: 'Peak window — race or max effort sessions.',
      tip_tr: 'Tepe penceresi — yarış veya maksimum çaba.',
    },
    luteal: {
      intensity: 'moderate',
      tip_en: 'Higher perceived effort — monitor fatigue closely.',
      tip_tr: 'Algılanan çaba artışı — yorgunluğu yakından izle.',
    },
  }
  return recs[phase] ?? null
}
