// ─── src/lib/athlete/athleteStatusSummary.js — E49 athlete self-view digest ──
// Adapts coachDigest.js functions (ctlTrend, acwrStatusLabel, trendLabel,
// generateAthleteDigestLine) for the athlete's own dashboard self-view.
// Reference: Banister & Calvert (1980), Mujika (2000)

import { calcLoad } from '../formulas.js'
import { calculateACWR } from '../trainingLoad.js'
import { ctlTrend, acwrStatusLabel, trendLabel, generateAthleteDigestLine } from '../coachDigest.js'

// ── TSB → training phase classifier ──────────────────────────────────────────
function classifyTrainingStatus(tsb) {
  if (tsb > 10)  return 'Recovering'
  if (tsb >= -10) return 'Maintaining'
  if (tsb >= -25) return 'Building'
  if (tsb < -25)  return 'Peaking'
  return 'Maintaining'
}

// ── buildSelfAthleteShape ─────────────────────────────────────────────────────
/**
 * Construct a coachDigest-compatible athlete object from the user's own data.
 * @param {object[]} log      - training log entries
 * @param {object[]} recovery - recovery entries (optional)
 * @param {object}   profile  - athlete profile (optional)
 * @returns {object} athlete shape compatible with coachDigest functions
 */
export function buildSelfAthleteShape(log, recovery, profile) {
  const { ctl, tsb } = calcLoad(log)
  const acwr = calculateACWR(log)

  const lastHRV = (() => {
    const withHRV = (recovery || []).filter(e => parseFloat(e.hrv) > 0)
    return withHRV.length ? parseFloat(withHRV[withHRV.length - 1].hrv) : null
  })()

  return {
    display_name:    profile?.name || 'Athlete',
    today_ctl:       ctl,
    today_tsb:       tsb,
    last_hrv_score:  lastHRV,
    adherence_pct:   50,
    acwr_ratio:      acwr.ratio,
    acwr_status:     acwr.status,
    training_status: classifyTrainingStatus(tsb),
    _log:            log,
  }
}

// ── computeAthleteStatus ──────────────────────────────────────────────────────
/**
 * Compute the full status summary for display in AthleteStatusSummaryCard.
 * Returns null when there is insufficient data (fewer than 5 log entries).
 * @param {object[]} log      - training log entries
 * @param {object[]} recovery - recovery entries (optional)
 * @param {object}   profile  - athlete profile (optional)
 * @returns {object|null}
 */
export function computeAthleteStatus(log, recovery, profile) {
  if (!log || log.length < 5) return null

  const ath = buildSelfAthleteShape(log, recovery, profile)

  return {
    ctl:            ath.today_ctl,
    tsb:            ath.today_tsb,
    ctlTrendStr:    ctlTrend(ath),
    acwrLabel:      acwrStatusLabel(ath.acwr_status),
    acwrRatio:      ath.acwr_ratio,
    overallTrend:   trendLabel(ath.training_status),
    trainingStatus: ath.training_status,
    digestLine:     generateAthleteDigestLine(ath),
    dataPoints:     log.length,
  }
}
