// src/lib/athlete/physiologyGapInsight.js
//
// v9.165.0 (EP-6) — Physiology-specific gap insight for an elite program.
//
// `buildEliteProgram` already computes current → target physiology
// (VDOT for run/tri, FTP for bike, CSS for swim, split2kSec for rowing)
// and a time-based feasibility band (weeksAvailable vs weeksNeeded).
// EliteProgramCard renders the current/target row but doesn't surface
// the DELTA, the gain RATE that drove `weeksNeeded`, or a
// physiology-translated verdict.
//
// This helper extracts those values into a small structured object the
// UI can render inline. Pure function, no side effects.

import {
  vdotGainPerBlock,
  ftpGainPerBlock,
  cssGainPerBlock,
  rowingGainPerBlock,
} from './eliteProgram.js'

/**
 * @typedef {'already-met'|'comfortable'|'realistic'|'stretching-ceiling'|'unrealistic'|'unknown'} PhysVerdict
 */

/**
 * Translate the time-based feasibility band into physiology terms.
 * Uses (weeksAvailable / weeksNeeded) ratio so the verdict reflects
 * "do we have enough time for this physiology shift" rather than
 * just "is the timeline aggressive".
 */
function physVerdictFor(gap, weeksAvailable, weeksNeeded) {
  if (gap == null || gap <= 0) return 'already-met'
  if (!Number.isFinite(weeksAvailable) || !Number.isFinite(weeksNeeded) || weeksNeeded <= 0) {
    return 'unknown'
  }
  const ratio = weeksAvailable / weeksNeeded
  if (ratio >= 1.3) return 'comfortable'
  if (ratio >= 1.0) return 'realistic'
  if (ratio >= 0.7) return 'stretching-ceiling'
  return 'unrealistic'
}

const VERDICT_NOTES = {
  'already-met': {
    en: 'Goal physiology already met — consider a stretch target.',
    tr: 'Hedef fizyoloji şimdiden karşılandı — daha iddialı bir hedef düşün.',
  },
  comfortable: {
    en: 'Timeline gives plenty of room for the gain rate at this fitness level.',
    tr: 'Zaman çizelgesi, bu kondisyon seviyesinde kazanım oranı için bolca alan tanıyor.',
  },
  realistic: {
    en: 'Timeline matches the typical gain rate for this fitness level.',
    tr: 'Zaman çizelgesi, bu kondisyon seviyesinde tipik kazanım oranı ile örtüşüyor.',
  },
  'stretching-ceiling': {
    en: 'Timeline is aggressive — gain rate at this fitness level usually wants more weeks.',
    tr: 'Zaman çizelgesi iddialı — bu kondisyon seviyesinde kazanım oranı genellikle daha fazla hafta ister.',
  },
  unrealistic: {
    en: 'Physiology gain rate at this fitness level is unlikely to close the gap in the available time.',
    tr: 'Bu kondisyon seviyesinde fizyolojik kazanım oranı, mevcut sürede boşluğu kapatamaz.',
  },
  unknown: {
    en: 'Insufficient inputs to translate timeline into physiology verdict.',
    tr: 'Zaman çizelgesini fizyoloji yorumuna çevirmek için yeterli girdi yok.',
  },
}

const CITATION = 'Daniels 2014; Coggan 2010 (FTP); Wakayoshi 1992 (CSS); Issurin 2010'

/**
 * @param {object|null} program - buildEliteProgram output
 * @returns {{
 *   metric: 'VDOT'|'FTP'|'CSS'|'Split2K',
 *   sport: string,
 *   current: number,
 *   target: number,
 *   gap: number,
 *   gapDirection: 'increase'|'decrease',
 *   ratePerBlock: number,
 *   blocksToBridge: number|null,
 *   weeksToBridge: number|null,
 *   weeksAvailable: number|null,
 *   weeksNeeded: number|null,
 *   physVerdict: PhysVerdict,
 *   note: { en: string, tr: string },
 *   citation: string,
 * } | null}
 */
export function computePhysiologyGapInsight(program) {
  if (!program || program._rejected) return null
  const { sport, currentLevel, targetLevel, feasibility } = program
  if (!currentLevel || !targetLevel) return null

  const weeksAvailable = feasibility?.weeksAvailable ?? null
  const weeksNeeded    = feasibility?.weeksNeeded    ?? null

  let metric, current, target, gap, gapDirection, ratePerBlock
  if (sport === 'run' || sport === 'triathlon') {
    current = Number(currentLevel.vdot)
    target  = Number(targetLevel.vdot)
    if (!Number.isFinite(current) || !Number.isFinite(target)) return null
    metric       = 'VDOT'
    gap          = Math.round((target - current) * 10) / 10
    gapDirection = 'increase'
    ratePerBlock = vdotGainPerBlock(current)
  } else if (sport === 'bike') {
    current = Number(currentLevel.ftp)
    target  = Number(targetLevel.ftp)
    if (!Number.isFinite(current) || !Number.isFinite(target) || current <= 0) return null
    metric       = 'FTP'
    gap          = target - current
    gapDirection = 'increase'
    ratePerBlock = ftpGainPerBlock(current)
  } else if (sport === 'swim') {
    current = Number(currentLevel.css)
    target  = Number(targetLevel.css)
    if (!Number.isFinite(current) || !Number.isFinite(target) || current <= 0) return null
    metric       = 'CSS'
    gap          = Math.round((current - target) * 10) / 10  // sec/100m to drop
    gapDirection = 'decrease'
    ratePerBlock = cssGainPerBlock(current)
  } else if (sport === 'rowing') {
    // Elite program rowing stores split500 (sec/500m at 2k pace) in
    // currentLevel.split500Sec — not split2kSec. Both are sometimes
    // referenced; prefer split500Sec, fall back to split2kSec.
    current = Number(currentLevel.split500Sec ?? currentLevel.split2kSec)
    target  = Number(targetLevel.split500Sec  ?? targetLevel.split2kSec)
    if (!Number.isFinite(current) || !Number.isFinite(target) || current <= 0) return null
    metric       = 'Split2K'
    gap          = Math.round((current - target) * 10) / 10
    gapDirection = 'decrease'
    ratePerBlock = rowingGainPerBlock(current * 4)  // rowingGainPerBlock takes 2k total time
  } else {
    return null
  }

  const blocksToBridge = Number.isFinite(ratePerBlock) && ratePerBlock > 0 && gap > 0
    ? Math.ceil(gap / ratePerBlock)
    : null
  const weeksToBridge = blocksToBridge != null ? blocksToBridge * 12 : null

  const physVerdict = physVerdictFor(gap, weeksAvailable, weeksNeeded)

  return {
    metric,
    sport,
    current: Math.round(current * 10) / 10,
    target:  Math.round(target  * 10) / 10,
    gap:     Math.round(gap     * 10) / 10,
    gapDirection,
    ratePerBlock: Math.round(ratePerBlock * 100) / 100,
    blocksToBridge,
    weeksToBridge,
    weeksAvailable,
    weeksNeeded,
    physVerdict,
    note: VERDICT_NOTES[physVerdict],
    citation: CITATION,
  }
}
