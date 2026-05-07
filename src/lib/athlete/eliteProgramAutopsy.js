// ─── src/lib/athlete/eliteProgramAutopsy.js — Race-result autopsy ────────────
// Mission #1 "season companion" loop: after the race, compare the actual
// performance from the athlete's log to the Elite Program's predicted target,
// then suggest the next-cycle PR target so the athlete has a clear next step.
//
// Pure function, no React, no I/O. Bilingual EN+TR output.
//
// References:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Galloway J. (2002). Galloway's Book on Running, 2nd ed. — progression rates
//   Coggan A. & Allen H. (2010). Training and Racing with a Power Meter, 2nd ed.
//   Wakayoshi K. et al. (1992). Determination of critical velocity in swimming.
// ────────────────────────────────────────────────────────────────────────────

import { vdotFromRace, trainingPaces } from '../sport/running.js'
import { tPaceFromTT, cssToSecPer100m, swimmingZones } from '../sport/swimming.js'
import { getCyclingZones } from '../sport/cycling.js'

export const AUTOPSY_CITATION =
  'Daniels 2014 VDOT; Galloway 2002 progression rates; Coggan 2010; Wakayoshi 1992'

const DAY_MS = 86400000
const RACE_DATE_TOLERANCE_DAYS = 7
const DISTANCE_TOLERANCE_PCT = 0.10

// ── Date helpers ─────────────────────────────────────────────────────────────
function parseUTC(iso) {
  if (!iso || typeof iso !== 'string') return null
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function todayUTCISO() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// ── Sport regex (mirrors Dashboard.jsx gating) ───────────────────────────────
function sportMatches(targetSport, entry) {
  if (!entry) return false
  const type = (entry.type || '').toLowerCase()
  const sport = (entry.sport || '').toLowerCase()
  const both = `${type} ${sport}`
  if (targetSport === 'run') {
    return /run|jog/i.test(both)
  }
  if (targetSport === 'bike') {
    return /bike|cycl|ride/i.test(both)
  }
  if (targetSport === 'swim') {
    return /swim/i.test(both)
  }
  if (targetSport === 'triathlon') {
    // Triathlon: tolerate any of the three legs as a race-day result
    return /run|jog|bike|cycl|ride|swim/i.test(both)
  }
  return false
}

// ── Extract usable numbers from a log entry ──────────────────────────────────
function entryDistanceM(entry) {
  if (!entry) return 0
  if (typeof entry.distanceM === 'number' && entry.distanceM > 0) return entry.distanceM
  if (typeof entry.distance === 'number' && entry.distance > 0) {
    // distance field is conventionally in km in the log
    return entry.distance * 1000
  }
  return 0
}

function entryTimeSec(entry) {
  if (!entry) return 0
  if (typeof entry.timeSec === 'number' && entry.timeSec > 0) return entry.timeSec
  if (typeof entry.durationSec === 'number' && entry.durationSec > 0) return entry.durationSec
  // duration is conventionally in minutes
  if (typeof entry.duration === 'number' && entry.duration > 0) return entry.duration * 60
  return 0
}

// ── Pick the matching race-result log entry, if any ──────────────────────────
function pickRaceResult(log, sport, raceDt, targetDistM) {
  if (!Array.isArray(log) || log.length === 0) return null
  if (!raceDt) return null
  const distLo = targetDistM * (1 - DISTANCE_TOLERANCE_PCT)
  const distHi = targetDistM * (1 + DISTANCE_TOLERANCE_PCT)
  const candidates = []
  for (const e of log) {
    if (!e || !e.date) continue
    if (!sportMatches(sport, e)) continue
    const dt = parseUTC(e.date)
    if (!dt) continue
    const dayDiff = Math.abs(Math.round((dt.getTime() - raceDt.getTime()) / DAY_MS))
    if (dayDiff > RACE_DATE_TOLERANCE_DAYS) continue
    const distM = entryDistanceM(e)
    if (distM <= 0) continue
    if (distM < distLo || distM > distHi) continue
    const timeSec = entryTimeSec(e)
    if (timeSec <= 0) continue
    candidates.push({ entry: e, dayDiff, distM, timeSec, dt })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.dayDiff - b.dayDiff)
  const c = candidates[0]
  return {
    date: c.entry.date,
    distanceM: Math.round(c.distM),
    timeSec: Math.round(c.timeSec),
  }
}

// ── Compute level for sport from race result ─────────────────────────────────
function computeActualLevel(sport, distanceM, timeSec) {
  if (sport === 'run' || sport === 'triathlon') {
    const vdot = vdotFromRace(distanceM, timeSec)
    if (!vdot) return null
    return {
      vdot: Math.round(vdot * 10) / 10,
      ftp: null,
      css: null,
      paces: trainingPaces(vdot),
    }
  }
  if (sport === 'bike') {
    // Reverse heuristic from eliteProgram.js: ftp ≈ 250 * (km/h) / 35
    const speedKmh = (distanceM / 1000) / (timeSec / 3600)
    const ftp = Math.round(250 * speedKmh / 35)
    if (!ftp || ftp <= 0) return null
    return {
      vdot: null,
      ftp,
      css: null,
      paces: getCyclingZones(ftp),
    }
  }
  if (sport === 'swim') {
    const tPace = tPaceFromTT(distanceM, timeSec)
    if (!tPace) return null
    const cssMs = 100 / tPace
    return {
      vdot: null,
      ftp: null,
      css: cssToSecPer100m(cssMs),
      paces: swimmingZones(tPace),
    }
  }
  return null
}

// ── Verdict bucketing ────────────────────────────────────────────────────────
function classifyVerdict(pctOfTarget) {
  if (pctOfTarget < 1.0) return 'beat-target'
  if (pctOfTarget < 1.02) return 'on-target'
  if (pctOfTarget < 1.07) return 'shortfall'
  return 'major-shortfall'
}

// ── Bilingual messages per verdict ───────────────────────────────────────────
const VERDICT_MSG = {
  'beat-target': {
    en: 'You beat your target — congrats',
    tr: 'Hedefini geçtin — tebrikler',
  },
  'on-target': {
    en: 'You hit your target — execution was on-plan',
    tr: 'Hedefini tutturdun — uygulama plana uygundu',
  },
  shortfall: {
    en: 'You came up short of your target',
    tr: 'Hedefinin biraz altında kaldın',
  },
  'major-shortfall': {
    en: 'Your race fell well short of your target',
    tr: 'Yarışın hedefin oldukça altında kaldı',
  },
}

const VERDICT_RECO = {
  'beat-target': {
    en: 'Capitalize on form — push the next cycle 2% faster than the result you just ran',
    tr: 'Formunu değerlendir — bir sonraki döngüde sonucundan %2 daha hızlısını hedefle',
  },
  'on-target': {
    en: 'Build on a successful block — set the next target 2% faster than today\'s race',
    tr: 'Başarılı bloğun üzerine ekle — bir sonraki hedefi yarıştan %2 daha hızlı koy',
  },
  shortfall: {
    en: 'Keep the same target and run a longer block — execution gap is closeable',
    tr: 'Aynı hedefi koru ve daha uzun bir blok uygula — açık kapatılabilir',
  },
  'major-shortfall': {
    en: 'Reset target near current ability and rebuild aerobic base before pushing intensity',
    tr: 'Hedefi mevcut yeteneğe çek ve yoğunluğu artırmadan önce aerobik temeli yeniden kur',
  },
}

// ── Suggest next-cycle PR ────────────────────────────────────────────────────
function nextCyclePR(verdict, distanceM, actualTimeSec, targetTimeSec) {
  // Returns { distanceM, timeSec } — same distance, smarter time goal
  if (verdict === 'beat-target') {
    return { distanceM, timeSec: Math.round(actualTimeSec * 0.98) }
  }
  if (verdict === 'on-target') {
    return { distanceM, timeSec: Math.round(targetTimeSec * 0.98) }
  }
  if (verdict === 'shortfall') {
    // Hold the same target — recommend a longer block
    return { distanceM, timeSec: targetTimeSec }
  }
  // major-shortfall: reset to actual + 1% (slightly more achievable than what was just run)
  return { distanceM, timeSec: Math.round(actualTimeSec * 1.01) }
}

// ── Public entry point ──────────────────────────────────────────────────────
/**
 * Detect the actual race result from the athlete's log and compare to the
 * Elite Program's predicted target. Suggest the next-cycle PR.
 *
 * @param {Object} program - the saved EliteProgram return value (must have
 *   input.targetPR, input.currentPR, input.sport, input.raceDate)
 * @param {Array} log - training log entries
 * @param {string} [today] - YYYY-MM-DD reference (UTC); defaults to current
 * @returns {Object|null} AutopsyResult or null when not yet past race date OR
 *   no matching log entry within tolerance window.
 */
export function buildEliteProgramAutopsy(program, log, today = todayUTCISO()) {
  if (!program || typeof program !== 'object') return null
  const input = program.input
  if (!input || typeof input !== 'object') return null
  const { sport, currentPR, targetPR, raceDate } = input
  if (!sport || !raceDate) return null
  if (!targetPR || typeof targetPR.timeSec !== 'number' || targetPR.timeSec <= 0) return null
  const targetDistM = targetPR.distanceM
  if (!targetDistM || targetDistM <= 0) return null

  const todayDt = parseUTC(today)
  const raceDt = parseUTC(raceDate)
  if (!todayDt || !raceDt) return null
  const daysAfterRace = Math.floor((todayDt.getTime() - raceDt.getTime()) / DAY_MS)
  if (daysAfterRace < 0) return null

  const found = pickRaceResult(log, sport, raceDt, targetDistM)
  if (!found) return null

  const actualLevel = computeActualLevel(sport, found.distanceM, found.timeSec)
  if (!actualLevel) return null

  // Build target/current levels (mirror eliteProgram.js logic, lightweight)
  let targetLevel = null
  let currentLevel = null
  if (sport === 'run' || sport === 'triathlon') {
    const tDist = targetPR.distanceM || found.distanceM
    const tVdot = vdotFromRace(tDist, targetPR.timeSec)
    targetLevel = tVdot
      ? { vdot: Math.round(tVdot * 10) / 10, ftp: null, css: null, paces: trainingPaces(tVdot) }
      : null
    if (currentPR && typeof currentPR.timeSec === 'number') {
      const cDist = currentPR.distanceM || tDist
      const cVdot = vdotFromRace(cDist, currentPR.timeSec)
      currentLevel = cVdot
        ? { vdot: Math.round(cVdot * 10) / 10, ftp: null, css: null, paces: trainingPaces(cVdot) }
        : null
    }
  } else if (sport === 'bike') {
    const tSpeed = (targetPR.distanceM / 1000) / (targetPR.timeSec / 3600)
    const tFtp = Math.round(250 * tSpeed / 35)
    targetLevel = tFtp > 0 ? { vdot: null, ftp: tFtp, css: null, paces: getCyclingZones(tFtp) } : null
    if (currentPR && typeof currentPR.timeSec === 'number' && currentPR.distanceM > 0) {
      const cSpeed = (currentPR.distanceM / 1000) / (currentPR.timeSec / 3600)
      const cFtp = Math.round(250 * cSpeed / 35)
      currentLevel = cFtp > 0 ? { vdot: null, ftp: cFtp, css: null, paces: getCyclingZones(cFtp) } : null
    }
  } else if (sport === 'swim') {
    const tPace = tPaceFromTT(targetPR.distanceM, targetPR.timeSec)
    if (tPace) {
      const tMs = 100 / tPace
      targetLevel = { vdot: null, ftp: null, css: cssToSecPer100m(tMs), paces: swimmingZones(tPace) }
    }
    if (currentPR && typeof currentPR.timeSec === 'number' && currentPR.distanceM > 0) {
      const cPace = tPaceFromTT(currentPR.distanceM, currentPR.timeSec)
      if (cPace) {
        const cMs = 100 / cPace
        currentLevel = { vdot: null, ftp: null, css: cssToSecPer100m(cMs), paces: swimmingZones(cPace) }
      }
    }
  }

  // Compare actual vs target time
  const pctOfTarget = found.timeSec / targetPR.timeSec
  const verdict = classifyVerdict(pctOfTarget)
  const absSec = Math.round(found.timeSec - targetPR.timeSec)
  const pctImprovement = ((currentPR && typeof currentPR.timeSec === 'number' && currentPR.timeSec > 0)
    ? ((currentPR.timeSec - found.timeSec) / currentPR.timeSec) * 100
    : 0)

  const next = nextCyclePR(verdict, targetDistM, found.timeSec, targetPR.timeSec)

  return {
    foundRace: found,
    actualLevel,
    targetLevel,
    currentLevel,
    pctOfTarget: Math.round(pctOfTarget * 1000) / 1000,
    delta: {
      absSec,
      pctImprovement: Math.round(pctImprovement * 10) / 10,
    },
    verdict,
    nextCyclePR: next,
    message: VERDICT_MSG[verdict],
    recommendation: VERDICT_RECO[verdict],
    citation: AUTOPSY_CITATION,
  }
}
