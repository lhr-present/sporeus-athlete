// src/lib/coach/squadSummary.js
//
// v9.130.0 — Aggregated squad summary for the coach dashboard.
//
// CoachSquadView already shows per-athlete attention signals
// (squadView.js — v9.105 Prompt HH). Coaches managing 10+ athletes
// could still spend the first 5 minutes of their day scanning the
// table to count urgent/attention/ok. This module rolls up the same
// signals into a single summary object the coach can read at a
// glance: how many athletes need action, what the top reasons are,
// and how this week's squad-wide activity looks.
//
// Pure function. Takes the array of squad-overview rows the coach
// dashboard already fetches; no additional network calls.

import { getAthleteAttentionSignal } from '../squadView.js'

/**
 * @description Roll up squad-wide attention signals + activity stats.
 *
 *   counts: how many athletes at each attention level
 *   topReasons: ordered list of which urgent/attention reasons fire
 *     most often, descending count
 *   activity: squad-wide stats — number who've logged in last 7 days,
 *     number with zero sessions this week, avg adherence
 *
 * @param {Array}  athletes - rows from get_squad_overview
 * @param {string} [today]  - 'YYYY-MM-DD'; defaults to today UTC
 * @returns {{
 *   total: number,
 *   counts: { urgent: number, attention: number, ok: number },
 *   topReasons: Array<{ key: string, count: number, label: { en, tr } }>,
 *   activity: { activeLast7d: number, zeroSessionsThisWeek: number,
 *               avgAdherencePct: number | null },
 * }}
 */
export function summarizeSquad(athletes, today) {
  const list = Array.isArray(athletes) ? athletes : []
  const total = list.length
  const counts = { urgent: 0, attention: 0, ok: 0 }
  const reasonCounts = new Map()
  const reasonLabels = new Map()

  let activeLast7d = 0
  let zeroThisWeek = 0
  const adherenceValues = []

  const refMs = today
    ? new Date(today + 'T12:00:00Z').getTime()
    : Date.now()

  for (const ath of list) {
    const signal = getAthleteAttentionSignal(ath, today)
    counts[signal.level] = (counts[signal.level] || 0) + 1
    for (const r of signal.reasons) {
      reasonCounts.set(r.key, (reasonCounts.get(r.key) || 0) + 1)
      if (!reasonLabels.has(r.key)) reasonLabels.set(r.key, r.label)
    }

    // Activity
    if (ath?.last_session_date) {
      const lastMs = new Date(ath.last_session_date).getTime()
      if (!Number.isNaN(lastMs)) {
        const days = Math.floor((refMs - lastMs) / 86400000)
        if (days < 7) activeLast7d += 1
      }
    }
    const wkSess = Number(ath?.this_week_sessions ?? ath?.weekSessions)
    if (Number.isFinite(wkSess) && wkSess === 0) zeroThisWeek += 1
    else if (!Number.isFinite(wkSess) && ath?.last_session_date) {
      // Fallback: if no this_week field but last session > 7d ago, count as zero this week.
      const lastMs = new Date(ath.last_session_date).getTime()
      if (!Number.isNaN(lastMs)) {
        const days = Math.floor((refMs - lastMs) / 86400000)
        if (days >= 7) zeroThisWeek += 1
      }
    }
    // Explicit null/undefined check first — Number(null) coerces to 0
    // and would silently pollute the average.
    const rawAdh = ath?.adherence_pct
    if (rawAdh != null) {
      const adh = Number(rawAdh)
      if (Number.isFinite(adh)) adherenceValues.push(adh)
    }
  }

  const topReasons = [...reasonCounts.entries()]
    .map(([key, count]) => ({ key, count, label: reasonLabels.get(key) }))
    .sort((a, b) => b.count - a.count)

  const avgAdherencePct = adherenceValues.length > 0
    ? Math.round(adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length)
    : null

  return {
    total,
    counts,
    topReasons,
    activity: {
      activeLast7d,
      zeroSessionsThisWeek: zeroThisWeek,
      avgAdherencePct,
    },
  }
}
