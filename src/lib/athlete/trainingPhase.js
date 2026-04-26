// src/lib/athlete/trainingPhase.js — E75
// Classifies the current training block phase from CTL trend + race proximity.
// Phases: base → build → peak → taper → recovery
// All dates noon-UTC to avoid TZ shifts.
import { calculatePMC } from '../trainingLoad.js'

/**
 * @param {Object[]} log
 * @param {Object}   profile  - may have raceDate / nextRaceDate
 * @param {string}   today    - 'YYYY-MM-DD'
 * @returns {{
 *   phase: 'base'|'build'|'peak'|'taper'|'recovery',
 *   en: string,
 *   tr: string,
 *   daysToRace: number|null,
 *   ctlTrend: number,   // CTL change per week over last 3 weeks
 * }}
 */
export function classifyTrainingPhase(log, profile, today = new Date().toISOString().slice(0, 10)) {
  const raceDate = profile?.raceDate || profile?.nextRaceDate || null
  const daysToRace = raceDate
    ? Math.round((new Date(raceDate + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 86400000)
    : null

  // CTL values at today, 7d ago, 21d ago via PMC
  const pmc = calculatePMC(log || [], 90, 0)
  const ctlAt = (daysAgo) => {
    const target = new Date(today + 'T12:00:00Z')
    target.setUTCDate(target.getUTCDate() - daysAgo)
    const ds = target.toISOString().slice(0, 10)
    const pt = pmc.find(p => p.date === ds)
    if (pt) return pt.ctl
    const prior = pmc.filter(p => p.date <= ds)
    return prior.length ? prior[prior.length - 1].ctl : 0
  }

  const ctlNow = ctlAt(0)
  const ctl7   = ctlAt(7)
  const ctl21  = ctlAt(21)
  // Trend = CTL change per week over 3-week window
  const ctlTrend = (ctlNow - ctl21) / 3

  let phase

  if (ctlNow < 10 || (log?.length ?? 0) < 4) {
    phase = 'recovery'
  } else if (daysToRace != null && daysToRace >= 0 && daysToRace <= 14) {
    phase = 'taper'
  } else if (daysToRace != null && daysToRace > 14 && daysToRace <= 28) {
    phase = 'peak'
  } else if (ctlTrend >= 1.5 && ctlNow >= 20) {
    phase = 'build'
  } else if (ctlTrend < -2 && ctlNow < ctl7) {
    phase = 'recovery'
  } else {
    phase = 'base'
  }

  const LABELS = {
    base:     { en: 'BASE',     tr: 'TABAN'     },
    build:    { en: 'BUILD',    tr: 'GELİŞİM'   },
    peak:     { en: 'PEAK',     tr: 'ZİRVE'     },
    taper:    { en: 'TAPER',    tr: 'AZALTMA'   },
    recovery: { en: 'RECOVERY', tr: 'TOPARLANMA' },
  }

  return { phase, en: LABELS[phase].en, tr: LABELS[phase].tr, daysToRace, ctlTrend: Math.round(ctlTrend * 10) / 10 }
}
