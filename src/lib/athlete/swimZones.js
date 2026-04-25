// ─── src/lib/athlete/swimZones.js — CSS T-pace + Wakayoshi swim zones wrapper ──
import { tPaceFromTT, swimmingZones, swimTSS } from '../sport/swimming.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns pace in sec/100m for a single session, or null.
 * session.duration is in minutes, session.distanceM is in metres.
 * pace = (duration_min * 60) / (distanceM / 100)
 */
function sessionPaceSecPer100m(session) {
  const dist = session?.distanceM
  const dur  = session?.duration
  if (!dist || dist <= 0) return null
  if (!dur  || dur  <= 0) return null
  const pace = (dur * 60) / (dist / 100)
  // sanity: real swim pace must be between 40s/100m (~world record) and 300s/100m
  if (pace < 40 || pace > 300) return null
  return pace
}

/**
 * Returns true when a session is a swim session.
 */
function isSwimSession(session) {
  if (!session) return false
  if ((session.type || '').toLowerCase() === 'swim') return true
  if ((session.sport || '').toLowerCase().includes('swim')) return true
  return false
}

/**
 * Returns the best (fastest = lowest sec/100m) swim pace from log.
 * Returns {secPer100m, sessionDate, distanceM, durationMin} or null.
 */
export function bestSwimPace(log) {
  if (!Array.isArray(log) || log.length === 0) return null

  const swimSessions = log.filter(isSwimSession)
  if (swimSessions.length === 0) return null

  let best = null
  for (const session of swimSessions) {
    const pace = sessionPaceSecPer100m(session)
    if (pace === null) continue
    if (best === null || pace < best.secPer100m) {
      best = {
        secPer100m:  pace,
        sessionDate: session.date || null,
        distanceM:   session.distanceM,
        durationMin: session.duration,
      }
    }
  }
  return best
}

/**
 * Returns full swim zones result, or null if no valid swim data.
 * Returns {cssSecPer100m, tPace, zones, bestDate, sessionsScanned}.
 */
export function computeSwimZones(log) {
  if (!Array.isArray(log) || log.length === 0) return null

  const swimSessions = log.filter(isSwimSession)
  const sessionsScanned = swimSessions.length

  const bestPace = bestSwimPace(log)
  if (!bestPace) return null

  const cssSecPer100m = bestPace.secPer100m
  // tPaceFromTT confirms CSS from the same effort (best TT session)
  const tPace = tPaceFromTT(bestPace.distanceM, bestPace.durationMin * 60)
  const zones = swimmingZones(cssSecPer100m)

  return {
    cssSecPer100m,
    tPace,
    zones,
    bestDate: bestPace.sessionDate,
    sessionsScanned,
  }
}

/**
 * Formats seconds as mm:ss string.
 * e.g. 90 → "1:30", 65.5 → "1:05", 120 → "2:00"
 */
export function fmtPaceSecKm(sec) {
  const total = Math.round(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Returns sTSS for each swim session in the last 14 days.
 * Requires cssSecPer100m > 0 and sessions with duration + distanceM.
 * @param {Array}  log           - full training log
 * @param {number} cssSecPer100m - CSS pace in sec/100 m
 * @param {string} today         - ISO date string (YYYY-MM-DD), defaults to today
 * @returns {Array<{date:string, duration:number, sTSS:number, currentPace:number}>}
 */
export function recentSwimTSS(log, cssSecPer100m, today = new Date().toISOString().slice(0, 10)) {
  if (!cssSecPer100m || cssSecPer100m <= 0) return []
  if (!Array.isArray(log) || log.length === 0) return []
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - 14)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return log
    .filter(e => {
      const isSwim = /swim/i.test(e.type || '') || /swim/i.test(e.sport || '')
      return isSwim && e.date >= cutoffStr && e.duration > 0 && (e.distanceM || 0) > 0
    })
    .map(e => {
      const currentPace = (e.duration * 60) / (e.distanceM / 100)  // sec/100m
      if (currentPace < 40 || currentPace > 300) return null
      const sTSS = swimTSS(e.duration, currentPace, cssSecPer100m)
      return sTSS != null ? { date: e.date, duration: e.duration, sTSS, currentPace } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)  // last 5 sessions max
}
