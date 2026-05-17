// src/lib/athlete/ctlTrajectory.js
//
// Pure-fn: project end-of-week CTL given today's CTL and the remaining
// planned sessions through Sunday. Banister 1975 / Coggan & Allen 2010
// exponentially-weighted training load with the conventional 42-day
// time constant.
//
// Forward update applied once per remaining day (today through Sunday,
// inclusive):
//     ctl_next = ctl_today + (tss_today - ctl_today) / k
//
// Inputs:
//   log       — training log array (passed to calcLoad to get currentCtl)
//   plan      — saved plan ({ weeks: [{ sessions: [...] }], generatedAt })
//   today     — ISO date string YYYY-MM-DD
//   k         — Banister time constant (days). Default 42.
//
// Returns: { currentCtl, projectedCtl, delta, direction, daysToSunday }
// or null when there is no usable signal (no log, ctl=0, or no plan).

import { calcLoad } from '../formulas.js'

export const CITATION = 'Banister 1975; Coggan & Allen 2010'

const STABLE_THRESHOLD = 0.5

// Mon=0…Sun=6 (matches getTodayPlannedSession's planDayIdx)
function mondayZeroDayIdx(isoDate) {
  // noon UTC avoids TZ shift on day boundary, same trick intelligence.js uses
  return (new Date(isoDate + 'T12:00:00Z').getDay() + 6) % 7
}

function isValidIso(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function plannedSessionFor(plan, todayIso, offsetDays) {
  if (!plan || !Array.isArray(plan.weeks) || !plan.generatedAt) return null
  const start = new Date(plan.generatedAt)
  const cur   = new Date(todayIso + 'T12:00:00Z')
  cur.setUTCDate(cur.getUTCDate() + offsetDays)
  const daysDiff = Math.floor((cur.getTime() - start.getTime()) / 86400000)
  if (daysDiff < 0) return null
  const weekIdx = Math.floor(daysDiff / 7)
  if (weekIdx >= plan.weeks.length) return null
  const week = plan.weeks[weekIdx]
  if (!week || !Array.isArray(week.sessions)) return null
  const dayIdx = (cur.getUTCDay() + 6) % 7
  return week.sessions[dayIdx] || null
}

export function projectCtlTrajectory({ log, plan, today, k = 42 } = {}) {
  if (!isValidIso(today)) return null
  if (!Array.isArray(log) || log.length === 0) return null
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return null
  if (!(k > 0)) return null

  const { ctl: currentCtlRaw } = calcLoad(log)
  const currentCtl = Number(currentCtlRaw) || 0
  if (currentCtl <= 0) return null

  const todayDayIdx = mondayZeroDayIdx(today)   // 0=Mon … 6=Sun
  const daysToSunday = 6 - todayDayIdx          // 0 when today is Sunday
  const remainingDays = daysToSunday + 1        // today is always counted

  let projected = currentCtl
  for (let i = 0; i < remainingDays; i++) {
    const session = plannedSessionFor(plan, today, i)
    const tss = session && typeof session.tss === 'number' && Number.isFinite(session.tss)
      ? Math.max(0, session.tss)
      : 0
    projected = projected + (tss - projected) / k
  }

  const delta = projected - currentCtl
  const direction = Math.abs(delta) <= STABLE_THRESHOLD
    ? 'stable'
    : (delta > 0 ? 'rising' : 'falling')

  return {
    currentCtl: Math.round(currentCtl * 10) / 10,
    projectedCtl: Math.round(projected * 10) / 10,
    delta: Math.round(delta * 10) / 10,
    direction,
    daysToSunday,
  }
}
