// src/lib/athlete/deloadDetector.js — E78
// Detects when an athlete has been building load for 3+ consecutive weeks
// without a deload week and recommends one.
// Deload week: weekly TSS ≤ 60% of the preceding 3-week average.
//
// Reference: Bompa T. & Buzzichelli C. (2015). Periodization Training for Sports.
//   Human Kinetics. Block periodization: 3:1 loading-to-recovery ratio.
import { calculatePMC } from '../trainingLoad.js'

/**
 * @param {Object[]} log
 * @param {string}   today - 'YYYY-MM-DD'
 * @returns {{
 *   needsDeload: boolean,
 *   weeksBuilding: number,
 *   lastDeloadWeek: string|null,
 *   en: string,
 *   tr: string,
 * } | null}  null if insufficient data (< 3 weeks)
 */
export function detectDeloadNeed(log, today = new Date().toISOString().slice(0, 10)) {
  if (!log?.length) return null

  // Build weekly TSS map (Mon-anchored)
  const weekMap = {}
  for (const s of log) {
    if (!s.date) continue
    const d = new Date(s.date + 'T12:00:00Z')
    const dow = (d.getUTCDay() + 6) % 7
    const mon = new Date(d)
    mon.setUTCDate(d.getUTCDate() - dow)
    const key = mon.toISOString().slice(0, 10)
    weekMap[key] = (weekMap[key] || 0) + (s.tss || 0)
  }

  // Get current week's Monday
  const td = new Date(today + 'T12:00:00Z')
  const todayDow = (td.getUTCDay() + 6) % 7
  const thisMonday = new Date(td)
  thisMonday.setUTCDate(td.getUTCDate() - todayDow)
  const thisMondayStr = thisMonday.toISOString().slice(0, 10)

  // Collect last 8 completed weeks (exclude current partial week)
  const completedWeeks = Object.keys(weekMap)
    .filter(k => k < thisMondayStr)
    .sort()
    .slice(-8)

  if (completedWeeks.length < 3) return null

  const tssByWeek = completedWeeks.map(k => weekMap[k] || 0)

  // Find last deload week: TSS ≤ 60% of avg of surrounding weeks
  let lastDeloadWeek = null
  for (let i = tssByWeek.length - 1; i >= 0; i--) {
    const neighbors = tssByWeek.filter((_, j) => j !== i)
    const avgNeighbors = neighbors.reduce((s, v) => s + v, 0) / Math.max(neighbors.length, 1)
    if (tssByWeek[i] <= avgNeighbors * 0.6 && tssByWeek[i] > 0) {
      lastDeloadWeek = completedWeeks[i]
      break
    }
  }

  // Count consecutive building weeks (CTL rising, from most recent)
  const pmc = calculatePMC(log, 90, 0)
  const ctlAt = (weekStr) => {
    const sunStr = new Date(new Date(weekStr + 'T12:00:00Z').setUTCDate(new Date(weekStr + 'T12:00:00Z').getUTCDate() + 6))
      .toISOString().slice(0, 10)
    const pts = pmc.filter(p => p.date <= sunStr)
    return pts.length ? pts[pts.length - 1].ctl : 0
  }

  let weeksBuilding = 0
  for (let i = completedWeeks.length - 1; i >= 1; i--) {
    const ctlThisWeek = ctlAt(completedWeeks[i])
    const ctlPrevWeek = ctlAt(completedWeeks[i - 1])
    if (ctlThisWeek > ctlPrevWeek) weeksBuilding++
    else break
  }

  const weeksWithoutDeload = lastDeloadWeek
    ? Math.round((new Date(thisMondayStr) - new Date(lastDeloadWeek)) / (7 * 86400000))
    : completedWeeks.length

  const needsDeload = weeksBuilding >= 3 || weeksWithoutDeload >= 4

  if (!needsDeload) return { needsDeload: false, weeksBuilding, lastDeloadWeek, en: '', tr: '' }

  return {
    needsDeload: true,
    weeksBuilding,
    lastDeloadWeek,
    en: `Deload recommended — ${weeksBuilding} weeks of building load. Reduce TSS by 30–40% this week.`,
    tr: `Boşaltma haftası önerilir — ${weeksBuilding} haftalık artan yük. Bu hafta TSS'yi %30–40 azalt.`,
  }
}
