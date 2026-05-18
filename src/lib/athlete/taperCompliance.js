// ─── src/lib/athlete/taperCompliance.js — Taper Compliance Detector ─────────
// Surfaces whether the LOG actually shows the taper happening, in contrast to
// TaperAdvisorCard / taperAdvisor.js which surface what the PLAN prescribes.
//
// References: Mujika 2010 (optimal taper 8–14 days, 40–60% volume cut,
//             intensity maintained); Bosquet 2007 meta-analysis (volume
//             reduction is the primary lever — athletes often fail by
//             cutting intensity instead of volume).
//
// Compliance window:
//   - 7–14 days from race → expected volume cut = 30% off baseline
//     (baseline = average weekly volume of weeks N-3 to N-4)
//   - 1–7  days from race → expected volume cut = 50%
//   - Outside that window → null (no taper expected yet, or race is past).
//
// Compliance bands (vs expected):
//   - within ±15%  → ON_TARGET
//   - actual < expected − 15% → UNDERCUT (not tapering enough)
//   - actual > expected + 15% → OVERCUT  (too aggressive — detraining risk)

export const TAPER_COMPLIANCE_CITATION = 'Mujika 2010; Bosquet 2007'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const COMPLIANCE_TOLERANCE_PCT = 15

/**
 * Days between two YYYY-MM-DD strings (target − base). Negative when target
 * is in the past. Returns null on malformed input.
 * @param {string} target
 * @param {string} base
 * @returns {number|null}
 */
function daysBetween(target, base) {
  if (!target || !base) return null
  const t = new Date(target + 'T00:00:00Z')
  const b = new Date(base   + 'T00:00:00Z')
  if (isNaN(t.getTime()) || isNaN(b.getTime())) return null
  return Math.round((t - b) / MS_PER_DAY)
}

/**
 * Sum volume (duration in minutes) for log entries whose date is within
 * [start, end) days from `today`. Both bounds are days-back-from-today
 * counts (e.g. start=14, end=7 → entries dated 14..8 days ago inclusive).
 *
 * @param {Array} log
 * @param {string} today — YYYY-MM-DD
 * @param {number} startDaysAgo — inclusive, larger number = further back
 * @param {number} endDaysAgo — exclusive, smaller number = closer to today
 * @returns {number} minutes summed (0 when no matching entries)
 */
function sumVolumeWindow(log, today, startDaysAgo, endDaysAgo) {
  if (!Array.isArray(log) || log.length === 0) return 0
  let total = 0
  for (const e of log) {
    if (!e || !e.date) continue
    const ago = daysBetween(today, e.date)
    if (ago === null) continue
    if (ago < endDaysAgo) continue
    if (ago >= startDaysAgo) continue
    const dur = parseFloat(e.duration)
    if (!isFinite(dur) || dur <= 0) continue
    total += dur
  }
  return total
}

/**
 * Detect whether the actual log volume pattern matches the expected taper
 * for the days-to-race window.
 *
 * @param {object} params
 * @param {Array}  params.log     — log entries [{ date, duration, ... }]
 * @param {object} params.profile — must carry raceDate (or nextRaceDate)
 * @param {string} [params.today] — ISO override for tests
 * @returns {null | {
 *   daysToRace: number,
 *   expectedVolumeCutPct: number,
 *   actualVolumeCutPct: number,
 *   compliance: 'ON_TARGET'|'UNDERCUT'|'OVERCUT',
 *   citation: string,
 * }}
 */
export function detectTaperCompliance({ log, profile, today } = {}) {
  const baseDate = today || new Date().toISOString().slice(0, 10)
  const raceDate = profile?.raceDate || profile?.nextRaceDate || null
  if (!raceDate) return null

  const daysToRace = daysBetween(raceDate, baseDate)
  if (daysToRace === null) return null
  if (daysToRace < 0)  return null    // race already passed
  if (daysToRace > 14) return null    // taper window not open yet

  // Expected cut by proximity bucket.
  let expectedVolumeCutPct
  if (daysToRace >= 7) {
    expectedVolumeCutPct = 30
  } else {
    expectedVolumeCutPct = 50
  }

  // Baseline = mean weekly volume across weeks N-3 and N-4 (i.e. days
  // 14..28 prior to today). Two weeks averaged smooths single-session
  // noise without reaching back into a different training phase.
  const baselineTwoWeekTotal = sumVolumeWindow(log, baseDate, 28, 14)
  const baselineWeeklyVol = baselineTwoWeekTotal / 2

  // Bail when baseline is zero — actualCut% is undefined and a "100%
  // cut from nothing" reading would be misleading. The card is a
  // warning surface; suppress when there's no signal to compare.
  if (!(baselineWeeklyVol > 0)) return null

  // This week = last 7 days (days 7..0 ago).
  const thisWeekVol = sumVolumeWindow(log, baseDate, 7, 0)
  const actualVolumeCutPct = ((baselineWeeklyVol - thisWeekVol) / baselineWeeklyVol) * 100

  const delta = actualVolumeCutPct - expectedVolumeCutPct
  let compliance
  if (delta < -COMPLIANCE_TOLERANCE_PCT)      compliance = 'UNDERCUT'
  else if (delta >  COMPLIANCE_TOLERANCE_PCT) compliance = 'OVERCUT'
  else                                         compliance = 'ON_TARGET'

  return {
    daysToRace,
    expectedVolumeCutPct,
    actualVolumeCutPct: Math.round(actualVolumeCutPct * 10) / 10,
    compliance,
    citation: TAPER_COMPLIANCE_CITATION,
  }
}
