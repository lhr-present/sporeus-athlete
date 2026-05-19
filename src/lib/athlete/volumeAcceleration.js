// src/lib/athlete/volumeAcceleration.js
//
// Pure-fn: detect the SECOND DERIVATIVE of weekly TSS — the
// acceleration of training-load change. Different from existing
// ctlRampRate / weeklyVolumeRamp (first derivative). Acceleration
// tells you whether the ramp itself is speeding up (compounding
// risk) or smoothing out (deload-like / approaching peak).
//
// Scientific grounding:
//   - Vetter 2019  — "Resilience training" framework: ramp-rate
//     monitoring as a leading-edge stress indicator.
//   - Bourdon 2017 — Monitoring athlete training loads, consensus
//     statement (IOC): rate-of-change of load is the key risk
//     dimension, not absolute volume.
//   - Cross 2017  — supporting evidence on compounding-load risk.
//
// Pipeline:
//   1. Sum daily TSS into ISO weeks (Mon-Sun) for the last 8 weeks
//      ending in the week containing `today`. `weeks` is built
//      chronologically (oldest → newest), each entry { weekStart, tss }.
//   2. weekDeltas[i] = weeks[i].tss - weeks[i-1].tss   (i = 1..7 → 7)
//   3. accelerations[i] = weekDeltas[i+1] - weekDeltas[i] (i = 0..5 → 6)
//   4. currentAcceleration = mean(accelerations[3..5])  // recent 3
//      priorAcceleration   = mean(accelerations[0..2])  // older 3
//   5. Classify band on currentAcceleration:
//        COMPOUNDING_RAMP   currentAcceleration ≥ +30
//        STEADY             |currentAcceleration| < 30
//        DECELERATING       currentAcceleration ≤ -30
//
// Return null when fewer than 7 of 8 weekly buckets have non-zero
// TSS — a continuous series is required.
//
// Inputs:
//   log         — training log array of { date: 'YYYY-MM-DD', tss: number }
//   today       — ISO date string YYYY-MM-DD anchoring the trailing window
//   windowWeeks — number of completed weeks to build (default 8)

export const VOLUME_ACCELERATION_CITATION = 'Vetter 2019; Bourdon 2017'

const BAND_THRESHOLD = 30 // TSS²/wk

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ISO week starts on Monday. Given an ISO date string return the
// Monday of that week (Mon-Sun) as an ISO date string.
function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0=Sun ... 6=Sat
  // Convert so Monday=0, Sunday=6
  const offset = (dow + 6) % 7
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

function classifyBand(currentAcceleration) {
  if (!Number.isFinite(currentAcceleration)) return null
  if (currentAcceleration >= BAND_THRESHOLD) return 'COMPOUNDING_RAMP'
  if (currentAcceleration <= -BAND_THRESHOLD) return 'DECELERATING'
  return 'STEADY'
}

// Build daily TSS map keyed by ISO date.
function buildTssMap(log) {
  const map = {}
  for (const e of log) {
    if (!e || !e.date) continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    const tss = Number(e.tss) || 0
    map[key] = (map[key] || 0) + tss
  }
  return map
}

// Sum TSS for a Mon-Sun week starting at `mondayIso` (inclusive,
// 7 days).
function sumWeek(tssMap, mondayIso) {
  let sum = 0
  const start = new Date(mondayIso + 'T00:00:00Z')
  for (let i = 0; i < 7; i++) {
    const iso = start.toISOString().slice(0, 10)
    sum += tssMap[iso] || 0
    start.setUTCDate(start.getUTCDate() + 1)
  }
  return sum
}

/**
 * @param {{log: Array<{date:string, tss:number}>, today: string, windowWeeks?: number}} args
 * @returns {{
 *   band: 'COMPOUNDING_RAMP' | 'STEADY' | 'DECELERATING',
 *   currentAcceleration: number,
 *   priorAcceleration: number,
 *   weeks: Array<{weekStart:string, tss:number}>,
 *   weekDeltas: number[],
 *   accelerations: number[],
 *   citation: string,
 * } | null}
 */
export function analyzeVolumeAcceleration({ log, today, windowWeeks = 8 } = {}) {
  if (!isValidIso(today)) return null
  if (!Array.isArray(log) || log.length === 0) return null
  const w = Math.floor(Number(windowWeeks))
  if (!Number.isFinite(w) || w < 4) return null

  const tssMap = buildTssMap(log)

  // Build weekly buckets oldest → newest. The newest bucket is the ISO
  // week containing `today` (Mon-Sun); go back `w-1` weeks from there.
  const newestMonday = mondayOf(today)
  const weeks = []
  for (let i = w - 1; i >= 0; i--) {
    const monIso = isoMinusDays(newestMonday, i * 7)
    const tss = sumWeek(tssMap, monIso)
    weeks.push({ weekStart: monIso, tss: Math.round(tss * 10) / 10 })
  }

  // Require at least (w - 1) of w weeks have non-zero TSS — continuous series.
  const nonZero = weeks.filter(wk => wk.tss > 0).length
  if (nonZero < w - 1) return null

  // weekDeltas: length w - 1 (= 7 for windowWeeks=8)
  const weekDeltas = []
  for (let i = 1; i < weeks.length; i++) {
    weekDeltas.push(weeks[i].tss - weeks[i - 1].tss)
  }

  // accelerations: length w - 2 (= 6 for windowWeeks=8)
  const accelerations = []
  for (let i = 0; i < weekDeltas.length - 1; i++) {
    accelerations.push(weekDeltas[i + 1] - weekDeltas[i])
  }

  if (accelerations.length < 6) return null

  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
  const len = accelerations.length
  const recent = accelerations.slice(len - 3, len) // last 3
  const older  = accelerations.slice(0, 3)         // first 3

  const currentAcceleration = mean(recent)
  const priorAcceleration   = mean(older)

  const band = classifyBand(currentAcceleration)
  if (!band) return null

  const round1 = v => Math.round(v * 10) / 10
  return {
    band,
    currentAcceleration: round1(currentAcceleration),
    priorAcceleration:   round1(priorAcceleration),
    weeks,
    weekDeltas:    weekDeltas.map(round1),
    accelerations: accelerations.map(round1),
    citation:      VOLUME_ACCELERATION_CITATION,
  }
}
