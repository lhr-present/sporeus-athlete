// src/lib/athlete/morningGlance.js
// v9.145.0 — Compact one-line summary of today's planned session.
// Used by the above-fold morning glance block in TodayView.jsx.
//
// Format: "{type} · {duration}{min|dk} · {zone or RPE} · {pace or HR target}"
// Conditionally omits any segment whose source field is absent.
// Returns null when no plannedSession exists — caller renders a
// "no plan" fallback in that case.

function dominantZone(zonesObj) {
  if (!zonesObj || typeof zonesObj !== 'object') return null
  const entries = Object.entries(zonesObj).filter(([, v]) => Number(v) > 0)
  if (entries.length === 0) return null
  entries.sort((a, b) => Number(b[1]) - Number(a[1]))
  return entries[0][0]  // e.g., 'Z2'
}

/**
 * @param {object} args
 * @param {object|null} args.plannedSession  shape from getTodayPlannedSession
 * @param {'en'|'tr'} [args.lang='en']
 * @returns {string|null} the formatted glance line, or null if no session
 */
export function buildGlanceLine({ plannedSession, lang = 'en' } = {}) {
  if (!plannedSession || !plannedSession.type) return null

  const parts = [plannedSession.type]

  const dur = Number(plannedSession.duration)
  if (Number.isFinite(dur) && dur > 0) {
    parts.push(`${dur}${lang === 'tr' ? 'dk' : 'min'}`)
  }

  const zone = dominantZone(plannedSession.zones)
  if (zone) {
    parts.push(zone)
  } else if (Number(plannedSession.rpe) > 0) {
    parts.push(`RPE ${plannedSession.rpe}`)
  }

  if (plannedSession.paceTarget) {
    parts.push(plannedSession.paceTarget)
  } else if (plannedSession.hrTarget) {
    // hrTarget may already be a range like "150-165" — append unit only
    parts.push(`${plannedSession.hrTarget} ${lang === 'tr' ? 'bpm' : 'bpm'}`)
  }

  return parts.join(' · ')
}
