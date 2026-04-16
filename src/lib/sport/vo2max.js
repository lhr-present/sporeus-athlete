// ─── vo2max.js — VO2max estimation from training log entries ─────────────────
// Cooper (1968): 12-min run test
// Daniels/Gilbert (1979): VDOT velocity model for any run distance/time

// ─── estimateVO2maxFromRun ────────────────────────────────────────────────────
// Daniels velocity model for any run distance/time.
// @param {number} distanceMeters
// @param {number} durationSeconds
// @returns {number|null} VO2max in mL/kg/min, or null if invalid input
export function estimateVO2maxFromRun(distanceMeters, durationSeconds) {
  if (distanceMeters == null || durationSeconds == null) return null
  if (distanceMeters <= 0 || durationSeconds <= 0) return null

  const durationMin = durationSeconds / 60
  const velocity = distanceMeters / durationMin // m/min

  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity
  const fraction =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * durationMin) +
    0.2989558 * Math.exp(-0.1932605 * durationMin)

  return Math.round((vo2 / fraction) * 10) / 10
}

// ─── estimateVO2maxCooper ─────────────────────────────────────────────────────
// Cooper (1968) 12-min run test formula.
// @param {number} distanceMeters12min - distance covered in 12 minutes (m)
// @returns {number|null} VO2max in mL/kg/min, or null if invalid input
export function estimateVO2maxCooper(distanceMeters12min) {
  if (distanceMeters12min == null || distanceMeters12min <= 0) return null
  return Math.round((distanceMeters12min - 504.9) / 44.73 * 10) / 10
}

// ─── findBestVO2maxSession ────────────────────────────────────────────────────
// Scans log (last 90 days) for best qualifying run/row session and estimates VO2max.
// @param {Array} log - array of training log entries
// @param {Object} profile - athlete profile (unused, reserved for future use)
// @returns {{ vo2max, method, date, sessionType }|null}
export function findBestVO2maxSession(log, _profile) {
  if (!Array.isArray(log) || log.length === 0) return null

  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const qualifying = log.filter(e => {
    if (!e.date || e.date < cutoff) return false
    const type = (e.type || '').toLowerCase()
    if (!type.includes('run') && !type.includes('row')) return false
    if (!e.distance || e.distance <= 0) return false
    if (!e.duration || e.duration <= 0) return false
    return true
  })

  if (qualifying.length === 0) return null

  let best = null

  for (const e of qualifying) {
    let vo2max = null
    let method = null

    const isCooper = e.duration >= 680 && e.duration <= 760
    if (isCooper) {
      // Normalize distance to exactly 720 seconds
      const normalizedDistance = e.distance * (720 / e.duration)
      vo2max = estimateVO2maxCooper(normalizedDistance)
      method = 'cooper'
    } else {
      vo2max = estimateVO2maxFromRun(e.distance, e.duration)
      method = 'daniels'
    }

    if (vo2max == null || vo2max <= 20 || vo2max >= 90) continue

    if (best === null || vo2max > best.vo2max) {
      best = { vo2max, method, date: e.date, sessionType: e.type }
    }
  }

  return best
}
