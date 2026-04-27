// src/lib/athlete/vdotTracker.js — E85
// Auto-detect current VDOT from log entries that have running distance data.
// Eliminates the need for athletes to manually enter "current 50:00 for 10K".
// The system self-calibrates from every run logged with distance.
//
// Reference: Daniels J. & Gilbert J. (1979). Oxygen Power.
import { vdotFromRace } from '../sport/running.js'

const RUNNING_RE = /run|koşu|race|yarış|jog|track|tempo|interval|repeat|sprint|marathon|half|hm|5k|10k|easy|long|aerob/i
const CYCLE_RE   = /bike|cycl|ride|bik|bisiklet/i
const SWIM_RE    = /swim|yüz/i

function getDistanceM(entry) {
  if (entry.distanceM   > 0) return entry.distanceM
  if (entry.distanceKm  > 0) return entry.distanceKm * 1000
  if (entry.distance    > 0) return entry.distance * 1000
  return null
}

function isRunEntry(entry) {
  const t = (entry.type || '').toLowerCase()
  if (CYCLE_RE.test(t) || SWIM_RE.test(t)) return false
  if (RUNNING_RE.test(t)) return true
  // fallback: accept if distance present and effort is real (RPE > 3 excludes walks)
  return (entry.rpe || 0) > 3
}

/**
 * Scan the training log for running entries with distance and estimate VDOT from each.
 * Returns the best recent estimate plus a trend array for charting.
 *
 * @param {Array}  log       Training log entries
 * @param {number} daysBack  Window for "recent best" (default 90)
 * @param {string} today     'YYYY-MM-DD'
 * @returns {{vdot, date, distanceKm, confidence, method, trend, candidateCount} | null}
 */
export function detectVdotFromLog(
  log,
  daysBack = 90,
  today    = new Date().toISOString().slice(0, 10)
) {
  if (!log?.length) return null

  const cutoff = new Date(today + 'T12:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() - daysBack)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const candidates = []

  for (const e of log) {
    if (!e.date || !e.duration) continue
    if ((e.rpe ?? 0) <= 3) continue     // exclude walks and warmups
    if (!isRunEntry(e)) continue

    const distM = getDistanceM(e)
    if (!distM || distM < 800) continue  // need at least 800m to estimate

    const durSec = e.durationSec ?? e.duration * 60
    if (durSec < 120) continue           // exclude sprints < 2 min (VDOT model unreliable)

    const v = vdotFromRace(distM, durSec)
    if (!v || v < 20 || v > 90) continue // sanity bounds

    const isRace = /race|yarış|competition|resmi/i.test(e.type || '')
    candidates.push({
      date:       e.date,
      vdot:       Math.round(v * 10) / 10,
      distanceKm: Math.round(distM / 100) / 10,
      durationMin: Math.round(e.duration),
      isRace,
      isRecent:   e.date >= cutoffStr,
      rpe:        e.rpe,
    })
  }

  if (!candidates.length) return null

  // Best recent: highest VDOT within the recent window (best effort, not average)
  const recent = candidates.filter(c => c.isRecent)
  const pool   = recent.length ? recent : candidates
  const best   = pool.sort((a, b) => b.vdot - a.vdot)[0]

  // Trend: last 12 detected, chronological order (for chart)
  const trend = [...candidates]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12)
    .map(c => ({ date: c.date, vdot: c.vdot, isRace: c.isRace, distanceKm: c.distanceKm }))

  const confidence = best.isRace         ? 'high'
                   : best.distanceKm >= 5 ? 'medium'
                   :                        'low'

  return {
    vdot:           best.vdot,
    date:           best.date,
    distanceKm:     best.distanceKm,
    durationMin:    best.durationMin,
    method:         'log-detected',
    confidence,
    trend,
    candidateCount: candidates.length,
  }
}
