// src/lib/athlete/insightFeed.js — E25: Top-level insight feed helpers
// Wraps generateInsightCards() with CTL delta + monotony history computation.

import { generateInsightCards } from './insightCards.js'
import { calcLoad } from '../formulas.js'
import { computeMonotony } from '../trainingLoad.js'

/**
 * Compute CTL 4 weeks ago and CTL now.
 * Uses calcLoad() (EMA-based, returns { ctl, atl, tsb, daily }).
 *
 * @param {Array}  log   - training_log entries [{ date, tss, ... }]
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {{ ctlNow: number, ctl4wAgo: number }}
 */
export function computeCTLDelta(log = [], today = new Date().toISOString().slice(0, 10)) {
  if (!log.length) return { ctlNow: 0, ctl4wAgo: 0 }

  // CTL now — full log
  const { ctl: ctlNow } = calcLoad(log)

  // CTL 4 weeks ago — slice log to entries strictly before (today - 28 days)
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - 28)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const logBefore28 = log.filter(e => e.date < cutoffStr)
  const ctl4wAgo = logBefore28.length ? calcLoad(logBefore28).ctl : 0

  return { ctlNow, ctl4wAgo }
}

/**
 * Build 8-week monotony history (oldest → newest).
 * Uses computeMonotony(log, sundayOfWeek) for each of the last 8 Sundays.
 * Returns number[] of length 8; null values replaced with 0.
 *
 * @param {Array}  log   - training_log entries
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {number[]}
 */
export function buildMonotonyHistory(log = [], today = new Date().toISOString().slice(0, 10)) {
  // Find the most recent Sunday on or before today
  const ref = new Date(today)
  ref.setHours(0, 0, 0, 0)
  // day 0 = Sunday, so offset = ref.getDay()
  const dayOfWeek = ref.getDay() // 0=Sun, 1=Mon, ...
  // move back to the previous Sunday (or stay if already Sunday)
  const mostRecentSunday = new Date(ref)
  mostRecentSunday.setDate(ref.getDate() - dayOfWeek)

  const history = []
  for (let i = 7; i >= 0; i--) {
    const sunday = new Date(mostRecentSunday)
    sunday.setDate(mostRecentSunday.getDate() - i * 7)
    const result = computeMonotony(log, sunday)
    history.push(result.monotony !== null ? result.monotony : 0)
  }
  return history
}

/**
 * Generate insight cards for the current state.
 * Returns same array as generateInsightCards() but never throws.
 * Returns [] if log.length < 5.
 *
 * @param {Array}  log   - training_log entries
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {Array<{ type: string, en: string, tr: string }>}
 */
export function getInsightFeed(log = [], today = new Date().toISOString().slice(0, 10)) {
  try {
    if (log.length < 5) return []

    const { ctlNow, ctl4wAgo } = computeCTLDelta(log, today)
    const monotonyHistory = buildMonotonyHistory(log, today)

    return generateInsightCards({
      log,
      asOf: today,
      ctlNow,
      ctl4wAgo,
      monotonyHistory,
    })
  } catch {
    return []
  }
}
