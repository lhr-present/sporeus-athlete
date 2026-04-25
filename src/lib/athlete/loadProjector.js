// ─── loadProjector.js — 4-Week CTL/TSB forward projection ────────────────────
// EWMA PMC projection seeded from calcLoad(log).
// Reference: Banister 1991 · Coggan PMC
// K_CTL = 1 - exp(-1/42), K_ATL = 1 - exp(-1/7)

import { calcLoad } from '../formulas.js'

const K_CTL = 1 - Math.exp(-1 / 42)
const K_ATL = 1 - Math.exp(-1 / 7)

// ─── avgDailyTSS ──────────────────────────────────────────────────────────────
/**
 * Compute the athlete's average daily TSS over the last 28 days.
 * @param {Array}  log   - training log entries [{ date, tss }]
 * @param {string} today - 'YYYY-MM-DD' (defaults to current date)
 * @returns {number} average daily TSS (0 if no sessions in window)
 */
export function avgDailyTSS(log = [], today = new Date().toISOString().slice(0, 10)) {
  const todayDate = new Date(today + 'T00:00:00Z')
  const cutoff = new Date(todayDate)
  cutoff.setUTCDate(cutoff.getUTCDate() - 28)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recent = log.filter(e => e.date >= cutoffStr && e.date <= today)
  if (recent.length === 0) return 0

  const totalTSS = recent.reduce((s, e) => s + (e.tss || 0), 0)
  return totalTSS / 28  // divide by 28 days (not just session count)
}

// ─── projectLoad ──────────────────────────────────────────────────────────────
/**
 * Project CTL/ATL/TSB for the next `days` days assuming constant daily TSS.
 * @param {Array}  log        - training log entries
 * @param {number} dailyTSS   - constant daily TSS assumption
 * @param {number} days       - number of days to project (default 28)
 * @param {string} today      - 'YYYY-MM-DD' (defaults to current date)
 * @returns {Array<{date, ctl, atl, tsb}>} length === days, sorted by date
 */
export function projectLoad(log = [], dailyTSS, days = 28, today = new Date().toISOString().slice(0, 10)) {
  const seed = calcLoad(log)
  let ctl = seed.ctl
  let atl = seed.atl

  const result = []
  const todayDate = new Date(today + 'T00:00:00Z')

  for (let i = 1; i <= days; i++) {
    const d = new Date(todayDate)
    d.setUTCDate(d.getUTCDate() + i)
    const ds = d.toISOString().slice(0, 10)

    ctl = ctl * (1 - K_CTL) + dailyTSS * K_CTL
    atl = atl * (1 - K_ATL) + dailyTSS * K_ATL
    const tsb = ctl - atl

    result.push({
      date: ds,
      ctl:  Math.round(ctl * 10) / 10,
      atl:  Math.round(atl * 10) / 10,
      tsb:  Math.round(tsb * 10) / 10,
    })
  }

  return result
}

// ─── computeLoadProjection ────────────────────────────────────────────────────
/**
 * Project at two load levels: current avg and current avg * 1.1 (+10%).
 * @param {Array}  log   - training log entries
 * @param {number} days  - projection horizon in days (default 28)
 * @param {string} today - 'YYYY-MM-DD' (defaults to current date)
 * @returns {{ currentLoad, baseline, elevated, currentCTL, currentTSB,
 *             peakTSBDate, citation } | null}
 * Returns null if log.length < 7.
 */
export function computeLoadProjection(log = [], days = 28, today = new Date().toISOString().slice(0, 10)) {
  if (log.length < 7) return null

  const currentLoad = avgDailyTSS(log, today)
  const { ctl: currentCTL, tsb: currentTSB } = calcLoad(log)

  const baseline = projectLoad(log, currentLoad, days, today)
  const elevated = projectLoad(log, currentLoad * 1.1, days, today)

  // Find date when TSB peaks in baseline projection
  let peakTSBDate = baseline[0]?.date ?? null
  let peakTSB = baseline[0]?.tsb ?? -Infinity
  for (const pt of baseline) {
    if (pt.tsb > peakTSB) {
      peakTSB = pt.tsb
      peakTSBDate = pt.date
    }
  }

  return {
    currentLoad,
    baseline,
    elevated,
    currentCTL,
    currentTSB,
    peakTSBDate,
    citation: 'Banister 1991 · Coggan PMC',
  }
}
