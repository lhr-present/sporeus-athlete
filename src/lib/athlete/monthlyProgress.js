// src/lib/athlete/monthlyProgress.js — E72: Monthly progress summary
// Shown on the 1st–7th of each month. Compares previous month stats.
// Returns null if: not in 1st-7th window, previous month has < 4 sessions.
import { calculatePMC } from '../trainingLoad.js'

const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

/**
 * @param {Object[]} log
 * @param {Object}   _profile  - reserved for future use
 * @param {string}   today     - 'YYYY-MM-DD' (default real today)
 * @returns {Object|null}
 */
export function computeMonthlyProgress(log, _profile, today = new Date().toISOString().slice(0, 10)) {
  if (!log?.length) return null

  const d = new Date(today + 'T12:00:00Z')
  const dom = d.getUTCDate()
  if (dom > 7) return null   // only show first week of month

  const year  = d.getUTCFullYear()
  const month = d.getUTCMonth()  // 0-based

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear  = month === 0 ? year - 1 : year

  const prevStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`
  const thisStart = `${year}-${String(month + 1).padStart(2, '0')}-01`

  const prevSessions = log.filter(e => e.date >= prevStart && e.date < thisStart)
  if (prevSessions.length < 4) return null

  const sessions = prevSessions.length
  const totalTSS  = Math.round(prevSessions.reduce((s, e) => s + (e.tss || 0), 0))

  const withRpe = prevSessions.filter(e => (e.rpe || 0) > 0)
  const avgRPE  = withRpe.length
    ? Math.round(withRpe.reduce((s, e) => s + e.rpe, 0) / withRpe.length * 10) / 10
    : null

  // CTL at start and end of previous month via PMC
  const pmc = calculatePMC(log, 400)  // large window so both dates are covered
  const ctlAtDate = (dateStr) => {
    const match = pmc.find(p => p.date === dateStr)
    if (match) return match.ctl
    // fallback: find closest prior point
    const prior = pmc.filter(p => p.date <= dateStr)
    return prior.length ? prior[prior.length - 1].ctl : 0
  }

  // Last day of prev month = day before thisStart
  const prevEndDate = new Date(thisStart + 'T12:00:00Z')
  prevEndDate.setUTCDate(prevEndDate.getUTCDate() - 1)
  const prevEndStr = prevEndDate.toISOString().slice(0, 10)

  const ctlStart = Math.round(ctlAtDate(prevStart))
  const ctlEnd   = Math.round(ctlAtDate(prevEndStr))
  const ctlDelta = ctlEnd - ctlStart

  // Best week in previous month (Mon–Sun windows)
  const weekMap = {}
  for (const s of prevSessions) {
    if (!s.date) continue
    const sd  = new Date(s.date + 'T12:00:00Z')
    const dow = (sd.getUTCDay() + 6) % 7  // Mon=0
    const mon = new Date(sd)
    mon.setUTCDate(sd.getUTCDate() - dow)
    const key = mon.toISOString().slice(0, 10)
    weekMap[key] = (weekMap[key] || 0) + (s.tss || 0)
  }

  let bestWeek = null
  let bestWeekTss = 0
  for (const [weekMon, wTss] of Object.entries(weekMap)) {
    if (wTss > bestWeekTss) {
      bestWeekTss = wTss
      const monD = new Date(weekMon + 'T12:00:00Z')
      const sunD = new Date(monD)
      sunD.setUTCDate(monD.getUTCDate() + 6)
      const fmtShort = dt => `${MONTH_EN[dt.getUTCMonth()].slice(0, 3)} ${dt.getUTCDate()}`
      bestWeek = { label: `${fmtShort(monD)}–${fmtShort(sunD)}`, tss: Math.round(wTss) }
    }
  }

  // Next-month TSS target: maintain current pace ±5%
  const weeksInPrevMonth = Object.keys(weekMap).length || 1
  const avgWeeklyTss = Math.round(totalTSS / weeksInPrevMonth)
  const targetNextMonth = {
    tssLow:    Math.round(avgWeeklyTss * 0.95),
    tssHigh:   Math.round(avgWeeklyTss * 1.05),
    targetCTL: ctlEnd + 5,
  }

  return {
    monthLabel: {
      en: `${MONTH_EN[prevMonth]} ${prevYear}`,
      tr: `${MONTH_TR[prevMonth]} ${prevYear}`,
    },
    sessions,
    totalTSS,
    avgRPE,
    ctlDelta,
    ctlStart,
    ctlEnd,
    bestWeek,
    targetNextMonth,
  }
}
