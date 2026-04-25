// src/lib/athlete/prTimeline.js — E33: Personal Best Timeline
// Scans the full training log to build a chronological record of when PRs were set.
// Uses detectPRs() internally — no mocking needed in tests.
//
// Citation: Eston 2009 · personal record detection

import { detectPRs } from './detectPRs.js'

/**
 * Scan the full log to find all sessions where a PR was set.
 * Algorithm: for each session in chronological order, call detectPRs(session, allPriorSessions).
 * A "PR session" is one where detectPRs returns at least one item.
 *
 * @param {Array} log - training log entries (any order)
 * @returns {Array<{ date: string, type: string, prs: Array, sessionIndex: number }>}
 *   sorted newest→oldest (most recent PR first).
 *   Returns [] if log.length < 2.
 */
export function scanPRHistory(log = []) {
  if (!Array.isArray(log) || log.length < 2) return []

  // Sort chronologically (oldest first) for prior-sessions accumulation
  const sorted = [...log].sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1)

  const prSessions = []

  for (let i = 0; i < sorted.length; i++) {
    const session = sorted[i]
    const prior = sorted.slice(0, i)
    const prs = detectPRs(session, prior)
    if (prs.length > 0) {
      prSessions.push({
        date: session.date,
        type: session.type || '',
        prs,
        sessionIndex: i,
      })
    }
  }

  // Return newest→oldest
  return prSessions.reverse()
}

/**
 * Return the last `limit` PR events from scanPRHistory, newest first.
 *
 * @param {Array} log
 * @param {number} limit
 * @returns {Array}
 */
export function recentPRs(log = [], limit = 5) {
  return scanPRHistory(log).slice(0, limit)
}

/**
 * Count total PRs broken across all sessions.
 *
 * @param {Array} log
 * @returns {number}
 */
export function totalPRCount(log = []) {
  return scanPRHistory(log).reduce((sum, session) => sum + session.prs.length, 0)
}

/**
 * Compute the full PR timeline summary.
 *
 * @param {Array}  log   - training log
 * @param {number} limit - max recent PR events to include (default 5)
 * @param {string} today - ISO date string 'YYYY-MM-DD' for daysSinceLastPR calculation
 * @returns {{ recentPRs, totalPRCount, lastPRDate, daysSinceLastPR, citation } | null}
 *   Returns null if log.length < 2
 */
export function computePRTimeline(log = [], limit = 5, today = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(log) || log.length < 2) return null

  const all = scanPRHistory(log)
  const recent = all.slice(0, limit)
  const count = all.reduce((sum, s) => sum + s.prs.length, 0)

  const lastPRDate = all.length > 0 ? all[0].date : null

  let daysSinceLastPR = null
  if (lastPRDate) {
    const msPerDay = 86400000
    const todayMs = new Date(today).getTime()
    const lastMs  = new Date(lastPRDate).getTime()
    daysSinceLastPR = Math.max(0, Math.round((todayMs - lastMs) / msPerDay))
  }

  return {
    recentPRs: recent,
    totalPRCount: count,
    lastPRDate,
    daysSinceLastPR,
    citation: 'Eston 2009 · personal record detection',
  }
}
