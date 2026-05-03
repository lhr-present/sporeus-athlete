// ─── coachingSummaryScore.js — E129: Coaching Summary Score (composite) ─────
// Synthesizes the 5 coaching-insight detectors (workoutDensity, sessionVariety,
// staleZones, fitnessGainRate, easyDayCompliance) into a single 0-100 health
// score with a band classification (excellent / good / needs_work / poor).
// Provides the glanceable summary above the 5-card coaching cluster.
//
// Each detector contributes a sub-score in [0, 100]; the composite is the
// arithmetic mean of the sub-scores from detectors that returned reliable=true.
// When fewer than 3 detectors are reliable, the composite is flagged
// reliable=false (the score is still computed, but should be treated as
// indicative rather than definitive).
//
// Citations aggregate the underlying detectors:
//   Seiler 2010; Foster 2001; Gabbett 2016; Banister 1991; Stöggl & Sperlich 2014
// ─────────────────────────────────────────────────────────────────────────────

import { detectWorkoutDensity } from './workoutDensity.js'
import { detectSessionVariety } from './sessionVariety.js'
import { detectStaleZones } from './staleZones.js'
import { detectFitnessGainRate } from './fitnessGainRate.js'
import { detectEasyDayCompliance } from './easyDayCompliance.js'

export const COACHING_SUMMARY_CITATION =
  'Seiler 2010; Foster 2001; Gabbett 2016; Banister 1991; Stöggl & Sperlich 2014'

// ─── Per-detector scoring ────────────────────────────────────────────────────
/**
 * Workout density: 100 if low risk, 60 if moderate, 0 if high.
 */
function scoreWorkoutDensity(d) {
  if (!d) return null
  if (d.risk === 'low') return 100
  if (d.risk === 'moderate') return 60
  if (d.risk === 'high') return 0
  return null
}

/**
 * Session variety: 100 if good, 60 if moderate, 0 if low.
 */
function scoreSessionVariety(d) {
  if (!d) return null
  if (d.variety === 'good') return 100
  if (d.variety === 'moderate') return 60
  if (d.variety === 'low') return 0
  return null
}

/**
 * Stale zones: 100 - 20*stale - 10*dropped, clamped at 0.
 */
function scoreStaleZones(d) {
  if (!d || !d.summary) return null
  const stale = Number(d.summary.stale) || 0
  const dropped = Number(d.summary.dropped) || 0
  const raw = 100 - 20 * stale - 10 * dropped
  return Math.max(0, raw)
}

/**
 * Fitness gain rate: 100 if building, 80 if maintaining, 50 if spiking,
 * 30 if detraining.
 */
function scoreFitnessGainRate(d) {
  if (!d) return null
  if (d.band === 'building') return 100
  if (d.band === 'maintaining') return 80
  if (d.band === 'spiking') return 50
  if (d.band === 'detraining') return 30
  return null
}

/**
 * Easy-day compliance: 100 if good, 60 if moderate, 0 if poor.
 */
function scoreEasyDayCompliance(d) {
  if (!d) return null
  if (d.band === 'good') return 100
  if (d.band === 'moderate') return 60
  if (d.band === 'poor') return 0
  return null
}

// ─── Band classification ─────────────────────────────────────────────────────
function classifyBand(score) {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'needs_work'
  return 'poor'
}

// ─── Bilingual messages ──────────────────────────────────────────────────────
function buildMessage(band, score) {
  switch (band) {
    case 'excellent':
      return {
        en: `Excellent training health (score ${score}).`,
        tr: `Antrenman sağlığı mükemmel (skor ${score}).`,
      }
    case 'good':
      return {
        en: `Good training health (score ${score}).`,
        tr: `Antrenman sağlığı iyi (skor ${score}).`,
      }
    case 'needs_work':
      return {
        en: `Training health needs work (score ${score}).`,
        tr: `Antrenman sağlığı geliştirilmeli (skor ${score}).`,
      }
    case 'poor':
    default:
      return {
        en: `Training health is poor (score ${score}) — review the dashboard.`,
        tr: `Antrenman sağlığı zayıf (skor ${score}) — paneli incele.`,
      }
  }
}

// ─── computeCoachingSummaryScore ─────────────────────────────────────────────
/**
 * Compute a single 0-100 coaching health score by combining 5 detectors.
 *
 * Detectors run (each contributes a sub-score 0-100, weighted equally):
 *   - workoutDensity     -- 100 if low, 60 if moderate, 0 if high
 *   - sessionVariety     -- 100 if good, 60 if moderate, 0 if low
 *   - staleZones         -- 100 - 20*staleCount - 10*droppedCount (clamp 0)
 *   - fitnessGainRate    -- 100 if building, 80 if maintaining, 50 if spiking, 30 if detraining
 *   - easyDayCompliance  -- 100 if good, 60 if moderate, 0 if poor
 *
 * Composite = average of (component scores from reliable detectors).
 * Detectors with reliable=false are excluded from the average.
 *
 * Bands:
 *   excellent  >=80
 *   good       60-79
 *   needs_work 40-59
 *   poor       <40
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   score: number,
 *   band: 'excellent'|'good'|'needs_work'|'poor',
 *   components: {
 *     workoutDensity: number|null,
 *     sessionVariety: number|null,
 *     staleZones: number|null,
 *     fitnessGainRate: number|null,
 *     easyDayCompliance: number|null,
 *   },
 *   weakest: { name: string, score: number } | null,
 *   reliable: boolean,
 *   detectorsCounted: number,
 *   message: { en: string, tr: string },
 *   citation: string,
 * }}
 */
export function computeCoachingSummaryScore(
  log,
  today = new Date().toISOString().slice(0, 10),
) {
  // Empty / null log → fast-path: score 0, all components null, poor.
  if (!Array.isArray(log) || log.length === 0) {
    return {
      score: 0,
      band: 'poor',
      components: {
        workoutDensity: null,
        sessionVariety: null,
        staleZones: null,
        fitnessGainRate: null,
        easyDayCompliance: null,
      },
      weakest: null,
      reliable: false,
      detectorsCounted: 0,
      message: buildMessage('poor', 0),
      citation: COACHING_SUMMARY_CITATION,
    }
  }

  // Run all five detectors.
  const wd = detectWorkoutDensity(log, today)
  const sv = detectSessionVariety(log, today)
  const sz = detectStaleZones(log, today)
  const fgr = detectFitnessGainRate(log, today)
  const edc = detectEasyDayCompliance(log, today)

  // Compute each sub-score (always; null only when detector itself missing).
  const subscores = {
    workoutDensity: scoreWorkoutDensity(wd),
    sessionVariety: scoreSessionVariety(sv),
    staleZones: scoreStaleZones(sz),
    fitnessGainRate: scoreFitnessGainRate(fgr),
    easyDayCompliance: scoreEasyDayCompliance(edc),
  }

  // Mark unreliable detectors' components as null (excluded from the average
  // but still null in the public shape so consumers know which are missing).
  const reliability = {
    workoutDensity: !!wd?.reliable,
    sessionVariety: !!sv?.reliable,
    staleZones: !!sz?.reliable,
    fitnessGainRate: !!fgr?.reliable,
    easyDayCompliance: !!edc?.reliable,
  }

  const components = {
    workoutDensity: reliability.workoutDensity ? subscores.workoutDensity : null,
    sessionVariety: reliability.sessionVariety ? subscores.sessionVariety : null,
    staleZones: reliability.staleZones ? subscores.staleZones : null,
    fitnessGainRate: reliability.fitnessGainRate ? subscores.fitnessGainRate : null,
    easyDayCompliance: reliability.easyDayCompliance ? subscores.easyDayCompliance : null,
  }

  // Average the reliable, non-null subscores.
  const reliableEntries = Object.entries(components).filter(
    ([, v]) => v !== null && Number.isFinite(v),
  )
  const detectorsCounted = reliableEntries.length

  let score = 0
  if (detectorsCounted > 0) {
    const sum = reliableEntries.reduce((s, [, v]) => s + v, 0)
    score = Math.round(sum / detectorsCounted)
  }

  // Composite is "reliable" only when ≥ 3 detectors are.
  const reliable = detectorsCounted >= 3

  // Weakest = lowest-scoring reliable component (null when none reliable).
  let weakest = null
  if (detectorsCounted > 0) {
    let minName = null
    let minScore = Infinity
    for (const [name, v] of reliableEntries) {
      if (v < minScore) {
        minScore = v
        minName = name
      }
    }
    weakest = { name: minName, score: minScore }
  }

  const band = classifyBand(score)
  const message = buildMessage(band, score)

  return {
    score,
    band,
    components,
    weakest,
    reliable,
    detectorsCounted,
    message,
    citation: COACHING_SUMMARY_CITATION,
  }
}
