// src/lib/race/taperSimulator.js
// Project CTL/ATL/TSB curves through a taper period using the PMC EWMA model.
// Reuses calcLoad math from src/lib/formulas.js — does NOT reimplement.
// Source: Mujika I., Padilla S. (2003) Med Sci Sports Exerc 35:1182–1187

const CITATION = 'Mujika I., Padilla S. (2003) Med Sci Sports Exerc 35:1182–1187'

// EWMA constants matching calcLoad in formulas.js
const K_ATL = 2 / (7 + 1)
const K_CTL = 2 / (42 + 1)

function dateAddDays(isoDate, days) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000)
}

/**
 * Compute current CTL and ATL from a training log using EWMA.
 * @param {Array} log - [{date, tss}, ...]
 * @param {string} today - ISO date
 * @returns {{ ctl: number, atl: number }}
 */
function computeCurrentLoad(log, today) {
  if (!log || !log.length) return { ctl: 0, atl: 0 }
  const byDate = {}
  for (const e of log) byDate[e.date] = (byDate[e.date] || 0) + (e.tss || 0)

  const sorted = Object.keys(byDate).sort()
  const start  = sorted[0]
  let atl = 0, ctl = 0

  let d = start
  while (d <= today) {
    const tss = byDate[d] || 0
    atl = tss * K_ATL + atl * (1 - K_ATL)
    ctl = tss * K_CTL + ctl * (1 - K_CTL)
    if (d === today) break
    d = dateAddDays(d, 1)
  }
  return { ctl, atl }
}

/**
 * Estimate average weekly TSS from last 4 weeks of log.
 * @param {Array} log
 * @param {string} today
 * @returns {number}
 */
function avgWeeklyTSSFrom(log, today) {
  const cutoff = dateAddDays(today, -28)
  const recent = (log || []).filter(e => e.date > cutoff && e.date <= today)
  const total  = recent.reduce((s, e) => s + (e.tss || 0), 0)
  return total / 4
}

/**
 * Simulate CTL/ATL/TSB daily projection through a taper.
 * @param {Object} opts
 * @param {Array}   opts.currentLog       - [{date, tss}, ...]
 * @param {string}  opts.raceDate         - ISO date
 * @param {number}  opts.taperWeeks       - 1–4
 * @param {number}  opts.taperVolumePct   - fraction of pre-taper weekly volume, e.g. 0.6
 * @param {string}  [opts.today]          - ISO date (defaults to now, for testability)
 * @returns {Object|null}
 */
export function simulateTaper({ currentLog, raceDate, taperWeeks, taperVolumePct, today }) {
  today = today || new Date().toISOString().slice(0, 10)
  if (!raceDate || !taperWeeks || !taperVolumePct) return null

  const daysToRace = daysBetween(today, raceDate)
  if (daysToRace <= 0) return null

  const { ctl: startCTL, atl: startATL } = computeCurrentLoad(currentLog, today)
  const preTaperCTL  = startCTL

  const weeklyTSS    = avgWeeklyTSSFrom(currentLog, today)
  const taperDailyTSS = (weeklyTSS * taperVolumePct) / 7
  const normalDailyTSS = weeklyTSS / 7

  let ctl = startCTL, atl = startATL
  const taperStartDay = Math.max(0, daysToRace - taperWeeks * 7)
  const dailyProjection = []
  let actualPreTaperCTL = preTaperCTL  // will be updated when taper starts

  for (let i = 1; i <= daysToRace; i++) {
    const date = dateAddDays(today, i)
    const tss  = i > taperStartDay ? taperDailyTSS : normalDailyTSS
    atl = tss * K_ATL + atl * (1 - K_ATL)
    ctl = tss * K_CTL + ctl * (1 - K_CTL)
    if (i === taperStartDay) actualPreTaperCTL = ctl
    dailyProjection.push({
      date,
      projectedCTL: Math.round(ctl * 10) / 10,
      projectedATL: Math.round(atl * 10) / 10,
      projectedTSB: Math.round((ctl - atl) * 10) / 10,
    })
  }

  const last       = dailyProjection[dailyProjection.length - 1]
  const raceDayTSB = last.projectedTSB
  const raceDayCTL = last.projectedCTL
  const ctlDropPct = actualPreTaperCTL > 0
    ? Math.round(((actualPreTaperCTL - raceDayCTL) / actualPreTaperCTL) * 1000) / 10
    : 0

  let recommendation
  if (raceDayTSB >= 5 && raceDayTSB <= 20 && ctlDropPct >= 3 && ctlDropPct <= 20) {
    recommendation = 'optimal'
  } else if (raceDayTSB < 5 || ctlDropPct < 3) {
    recommendation = 'under_tapered'
  } else {
    recommendation = 'over_tapered'
  }

  return {
    dailyProjection,
    raceDayTSB,
    raceDayCTL,
    preTaperCTL: Math.round(actualPreTaperCTL * 10) / 10,
    ctlDropPct,
    recommendation,
    citation: CITATION,
  }
}

/**
 * Compare multiple taper options side by side.
 * @param {Object} opts
 * @param {Array}   opts.currentLog
 * @param {string}  opts.raceDate
 * @param {number[]} [opts.options]       - taper week lengths to compare, default [2,3,4]
 * @param {number}  [opts.volumePct]     - fraction, default 0.6
 * @param {string}  [opts.today]
 * @returns {Array} array of simulateTaper results (one per option)
 */
export function compareTapers({ currentLog, raceDate, options = [2, 3, 4], volumePct = 0.6, today }) {
  return options.map(weeks => ({
    taperWeeks: weeks,
    ...simulateTaper({ currentLog, raceDate, taperWeeks: weeks, taperVolumePct: volumePct, today }),
  }))
}
