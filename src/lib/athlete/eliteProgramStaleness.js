// ─── eliteProgramStaleness.js — Plan freshness detection ────────────────────
//
// v9.32.0 — Detects when the athlete's saved Mission #1 plan has drifted from
// the current profile. After 4-8 weeks of training, an athlete's VDOT / FTP /
// CSS often improves enough that the prescribed paces become 5-15 sec/km too
// slow — but the saved plan keeps prescribing them. Without a staleness check,
// the user trains at the wrong intensity for weeks before noticing.
//
// Drift thresholds:
//   • VDOT: ±3 points → meaningful pace shift (Daniels 2014 — 1 VDOT ≈
//     2-3 sec/km on T-pace)
//   • FTP:  ±15 W → ~5% on a 300 W athlete (Coggan re-test threshold)
//   • CSS:  ±3 sec/100m → meaningful pace shift (Wakayoshi 1992)
//   • 2k row: ±10 sec → calibration window (Concept2 standard)
//
// Severity:
//   • 'major'  — drift exceeds threshold AND would change at least one
//                training-zone pace by >5%. Strong prompt to regenerate.
//   • 'minor'  — drift exceeds threshold but pace change <5%. Soft hint.
//   • null     — no meaningful drift. No banner shown.
//
// Pure function, no React. Tested in eliteProgramStaleness.test.js.

/**
 * @typedef {{ vdot?: number, ftp?: number, cssSec?: number, split2kSec?: number }} ProfileLike
 * @typedef {{ vdot?: number, ftp?: number, css?: number, split2kSec?: number }} CurrentLevelLike
 * @typedef {{
 *   severity: 'major' | 'minor',
 *   drifted: Array<{ metric: 'vdot' | 'ftp' | 'css' | 'split2k', planValue: number, currentValue: number, deltaPct: number }>
 *   message: { en: string, tr: string }
 * } | null} StalenessReport
 */

const VDOT_DRIFT_THRESHOLD       = 3      // points
const FTP_DRIFT_THRESHOLD_W      = 15     // watts
const CSS_DRIFT_THRESHOLD_SEC    = 3      // sec/100m
const ROW2K_DRIFT_THRESHOLD_SEC  = 10     // sec
const MAJOR_PCT_THRESHOLD        = 0.05   // 5% pace change → major

/**
 * Compute drift between the plan's snapshotted `currentLevel` and the
 * athlete's CURRENT profile. Returns null when no meaningful drift, or a
 * report describing what changed.
 * @public
 * @param {{ currentLevel: CurrentLevelLike, sport: string } | null} plan
 * @param {ProfileLike | null} profile
 * @returns {StalenessReport}
 */
export function computePlanStaleness(plan, profile) {
  if (!plan || !plan.currentLevel || !profile) return null
  const drifted = []
  const cl = plan.currentLevel

  // VDOT (run / triathlon)
  if (typeof cl.vdot === 'number' && typeof profile.vdot === 'number' && profile.vdot > 0) {
    const delta = profile.vdot - cl.vdot
    if (Math.abs(delta) >= VDOT_DRIFT_THRESHOLD) {
      drifted.push({
        metric: 'vdot',
        planValue: cl.vdot,
        currentValue: profile.vdot,
        deltaPct: delta / cl.vdot,
      })
    }
  }

  // FTP (bike / triathlon)
  if (typeof cl.ftp === 'number' && typeof profile.ftp === 'number' && profile.ftp > 0) {
    const delta = profile.ftp - cl.ftp
    if (Math.abs(delta) >= FTP_DRIFT_THRESHOLD_W) {
      drifted.push({
        metric: 'ftp',
        planValue: cl.ftp,
        currentValue: profile.ftp,
        deltaPct: delta / cl.ftp,
      })
    }
  }

  // CSS (swim / triathlon) — note: lower is faster
  if (typeof cl.css === 'number' && typeof profile.cssSec === 'number' && profile.cssSec > 0) {
    const delta = profile.cssSec - cl.css
    if (Math.abs(delta) >= CSS_DRIFT_THRESHOLD_SEC) {
      drifted.push({
        metric: 'css',
        planValue: cl.css,
        currentValue: profile.cssSec,
        deltaPct: delta / cl.css,
      })
    }
  }

  // 2k row split — note: lower is faster
  if (typeof cl.split2kSec === 'number' && typeof profile.split2kSec === 'number' && profile.split2kSec > 0) {
    const delta = profile.split2kSec - cl.split2kSec
    if (Math.abs(delta) >= ROW2K_DRIFT_THRESHOLD_SEC) {
      drifted.push({
        metric: 'split2k',
        planValue: cl.split2kSec,
        currentValue: profile.split2kSec,
        deltaPct: delta / cl.split2kSec,
      })
    }
  }

  if (drifted.length === 0) return null

  // Severity by maximum |deltaPct| across drifted metrics
  const maxPct = drifted.reduce((m, d) => Math.max(m, Math.abs(d.deltaPct)), 0)
  const severity = maxPct >= MAJOR_PCT_THRESHOLD ? 'major' : 'minor'

  // Build a human message naming the drifted metrics. Distinguishes
  // "improved" (faster — typical case) from "regressed" (slower — illness,
  // overreach, detraining).
  const direction = driftDirection(drifted)
  const message = buildMessage(drifted, severity, direction)

  return { severity, drifted, message }
}

// "improved" if every drifted metric moved in the faster direction;
// "regressed" if every drifted metric moved slower; else "mixed".
function driftDirection(drifted) {
  let improved = 0, regressed = 0
  for (const d of drifted) {
    // VDOT/FTP: higher = faster. CSS/split2k: lower = faster.
    const fasterDelta = (d.metric === 'vdot' || d.metric === 'ftp')
      ? (d.currentValue - d.planValue)
      : (d.planValue - d.currentValue)
    if (fasterDelta > 0) improved++
    else regressed++
  }
  if (improved > 0 && regressed === 0) return 'improved'
  if (regressed > 0 && improved === 0) return 'regressed'
  return 'mixed'
}

function buildMessage(drifted, severity, direction) {
  const metrics = drifted.map(d => d.metric.toUpperCase()).join(', ')
  const verbEn = direction === 'improved' ? 'improved' : direction === 'regressed' ? 'dropped' : 'shifted'
  const verbTr = direction === 'improved' ? 'gelişti' : direction === 'regressed' ? 'düştü' : 'değişti'
  const adviceEn = severity === 'major'
    ? 'Prescribed paces are now meaningfully off. Regenerate the plan to recalibrate.'
    : 'Prescribed paces may be slightly off. Consider regenerating after your next test.'
  const adviceTr = severity === 'major'
    ? 'Önerilen tempolar belirgin şekilde sapmış. Yeniden kalibre etmek için planı tekrar oluştur.'
    : 'Önerilen tempolar hafifçe sapmış olabilir. Bir sonraki testin sonrasında yeniden oluşturmayı düşün.'
  return {
    en: `Your ${metrics} ${verbEn} since this plan was generated. ${adviceEn}`,
    tr: `Plan oluşturulduğundan beri ${metrics} ${verbTr}. ${adviceTr}`,
  }
}

export const STALENESS_CITATION = 'Daniels 2014 (VDOT pace mapping); Coggan & Allen 2010 (FTP re-test threshold); Wakayoshi 1992 (CSS); Concept2 calibration standards.'
