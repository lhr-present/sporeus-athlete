// src/lib/profileDerivedMetrics.js
// Universal profile → derived metrics engine.
// Input: profile object + optional log entries + optional testResults.
// Output: all derived zones, paces, and benchmarks in one call.
// Pure function — safe to call in useMemo with no side effects.

import { getCyclingZones, wattsPerKg } from './sport/cycling.js'
import { vdotFromRace } from './sport/running.js'
import { getTrainingPaces, estimateVDOT } from './vdot.js'
import { estimateVO2maxFromRun } from './sport/vo2max.js'

// ── HR zone constants ─────────────────────────────────────────────────────────
const HR_ZONE_DEFS = [
  { n: 1, name: 'Recovery',   lo: 50, hi: 60 },
  { n: 2, name: 'Aerobic',    lo: 60, hi: 70 },
  { n: 3, name: 'Tempo',      lo: 70, hi: 80 },
  { n: 4, name: 'Threshold',  lo: 80, hi: 90 },
  { n: 5, name: 'VO₂max',     lo: 90, hi: 100 },
]

// RPE 1-10 → zone index 0-4 (array index into .zones)
const RPE_TO_ZONE_IDX = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]

// ── Field → feature unlocks map ───────────────────────────────────────────────
const FIELD_UNLOCKS = {
  ftp:       ['cycling power zones', 'W/kg', 'interval targets'],
  vo2max:    ['running paces', 'VDOT', 'race predictions'],
  maxhr:     ['HR zones', 'LTHR', 'polarization analysis', 'subthreshold time'],
  weight:    ['W/kg', 'body composition', 'fuel estimates'],
  age:       ['VO2max norms', 'age-predicted maxHR'],
  gender:    ['body composition', 'VO2max norms (gender-specific)'],
  threshold: ['threshold pace zones', 'auto-VDOT'],
  raceDate:  ['race countdown', 'taper advice', 'race readiness score'],
  goal:      ['AI coaching context', 'training recommendations'],
}
const ALL_COMPLETENESS_FIELDS = Object.keys(FIELD_UNLOCKS)

// ── Helpers ───────────────────────────────────────────────────────────────────

function secToMMSS(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return null
  const m = Math.floor(secPerKm / 60)
  const s = String(Math.round(secPerKm % 60)).padStart(2, '0')
  return `${m}:${s}`
}

function buildHRZones(maxHR) {
  return HR_ZONE_DEFS.map(z => ({
    n:   z.n,
    name: z.name,
    pct: `${z.lo}–${z.hi}%`,
    min: Math.round(maxHR * z.lo / 100),
    max: Math.round(maxHR * z.hi / 100),
  }))
}

// Parse "MM:SS" threshold pace string → vdot via vdotFromRace proxy.
// Threshold pace ≈ 60-min race pace in Daniels.  We use 12 km as the
// race distance proxy (threshold sustainable ~50–60 min in well-trained).
function thresholdPaceToVdot(thresholdStr) {
  if (!thresholdStr || typeof thresholdStr !== 'string') return null
  const parts = thresholdStr.trim().split(':')
  if (parts.length !== 2) return null
  const secPerKm = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  if (!secPerKm || secPerKm <= 0) return null
  const durationSec = secPerKm * 12   // 12 km × pace = total time
  return vdotFromRace ? vdotFromRace(12000, durationSec) : null
}

// Scan last 90 days of log for the best run/race VDOT estimate.
function autoVdotFromLog(log) {
  if (!Array.isArray(log) || log.length === 0) return null

  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  let best = null

  for (const e of log) {
    if (!e.date || e.date < cutoff) continue

    const type = (e.type || '').toLowerCase()
    if (!type.includes('run') && !type.includes('race')) continue

    // Resolve distance in metres — support distanceM, distance (m), distanceKm
    let distM = null
    if (e.distanceM && e.distanceM > 0)       distM = e.distanceM
    else if (e.distance && e.distance > 1000)  distM = e.distance
    else if (e.distanceKm && e.distanceKm > 1) distM = e.distanceKm * 1000

    if (!distM || distM <= 1000) continue

    const durSec = e.duration || e.durationSec
    if (!durSec || durSec <= 300) continue   // < 5 min → skip

    const v = estimateVO2maxFromRun(distM, durSec)
    if (v == null || v <= 20 || v >= 90) continue

    if (best === null || v > best.vdot) {
      // Try to build a readable method label (e.g. "best 10k")
      const km = Math.round(distM / 100) / 10
      best = { vdot: Math.round(v * 10) / 10, method: `best ${km}k`, fromDate: e.date }
    }
  }

  return best
}

// Build the completeness section.
function buildCompleteness(profile) {
  const filled   = []
  const missing  = []
  const unlocks  = {}

  for (const field of ALL_COMPLETENESS_FIELDS) {
    const val = profile?.[field]
    const present = val !== null && val !== undefined && val !== '' &&
                    !(typeof val === 'number' && isNaN(val))
    if (present) {
      filled.push(field)
    } else {
      missing.push(field)
      unlocks[field] = FIELD_UNLOCKS[field]
    }
  }

  const score = Math.round((filled.length / ALL_COMPLETENESS_FIELDS.length) * 100)
  return { score, filled, missing, unlocks }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Derives all metrics from a profile + optional log and test results.
 *
 * @param {object}  profile     - Athlete profile fields
 * @param {Array}   log         - Training log entries (default [])
 * @param {Array}   testResults - Test results array (reserved, default [])
 * @returns {{power, running, hr, autoVdot, completeness}}
 */
export function deriveAllMetrics(profile, log = [], _testResults = []) {
  // ── Power section ───────────────────────────────────────────────────────────
  let power = null
  const ftpRaw = parseFloat(profile?.ftp)
  if (ftpRaw > 0) {
    const ftp    = ftpRaw
    const weightRaw = parseFloat(profile?.weight)
    const wPkg   = weightRaw > 0 ? wattsPerKg(ftp, weightRaw) : null

    const rawZones = getCyclingZones(ftp)
    // Normalise zone shape to match spec: { n, name, min, max, pctRange }
    const PCT_LABELS = ['<55%', '56–75%', '76–90%', '91–105%', '106–120%', '121–150%', '>150%']
    const zones = rawZones.map((z, i) => ({
      n:        z.id,
      name:     z.name,
      min:      z.minWatts,
      max:      z.maxWatts,
      pctRange: PCT_LABELS[i] ?? '',
    }))

    power = { ftp, wPerKg: wPkg, zones, lthrEstimate: null }
  }

  // ── MaxHR + LTHR (needed for both power.lthrEstimate and hr section) ────────
  const maxHRProfile = parseFloat(profile?.maxhr)
  const ageVal       = parseFloat(profile?.age)
  const maxHR = maxHRProfile > 0
    ? maxHRProfile
    : (ageVal > 0 ? Math.round(208 - 0.7 * ageVal) : null)
  const maxHRSource = maxHRProfile > 0 ? 'profile' : (ageVal > 0 ? 'age-predicted' : null)
  const lthr = maxHR ? Math.round(maxHR * 0.87) : null

  // Attach LTHR estimate to power section if available
  if (power && lthr) power.lthrEstimate = lthr

  // ── HR section ──────────────────────────────────────────────────────────────
  let hr = null
  if (maxHR) {
    hr = {
      maxHR,
      maxHRSource,
      lthr,
      zones: buildHRZones(maxHR),
      rpeToZoneIdx: RPE_TO_ZONE_IDX,
    }
  }

  // ── Auto-VDOT from log ──────────────────────────────────────────────────────
  const autoVdot = autoVdotFromLog(log)

  // ── Running section ─────────────────────────────────────────────────────────
  let running = null

  // Priority: profile.vo2max → profile.threshold → auto-log estimate
  const vo2maxRaw   = parseFloat(profile?.vo2max)
  const thresholdStr = profile?.threshold

  let vdot  = null
  let source = null

  if (vo2maxRaw > 0) {
    // Direct VO2max → treat as VDOT (they are equivalent in the Daniels model)
    vdot   = vo2maxRaw
    source = 'profile'
  } else if (thresholdStr && thresholdStr.trim() !== '') {
    const derived = thresholdPaceToVdot(thresholdStr)
    if (derived && derived > 0) {
      vdot   = derived
      source = 'threshold'
    }
  } else if (autoVdot) {
    vdot   = autoVdot.vdot
    source = 'auto-log'
  }

  if (vdot && vdot > 0) {
    const pacesRaw = getTrainingPaces(vdot)
    let paces = null
    if (pacesRaw) {
      paces = {
        easy:      secToMMSS(pacesRaw.easy),
        marathon:  secToMMSS(pacesRaw.marathon),
        threshold: secToMMSS(pacesRaw.threshold),
        interval:  secToMMSS(pacesRaw.interval),
        rep:       secToMMSS(pacesRaw.rep),
      }
    }
    running = { vdot: Math.round(vdot * 10) / 10, source, paces }
  }

  // ── Completeness ────────────────────────────────────────────────────────────
  const completeness = buildCompleteness(profile)

  return { power, running, hr, autoVdot, completeness }
}

// Named re-exports for convenience (allow callers to use individual helpers)
export { buildHRZones, thresholdPaceToVdot, autoVdotFromLog, buildCompleteness }
