// ─── hrvAutonomicBalance.js — autonomic-balance stratification (pure fn) ─────
// Classifies recent HRV trend into a parasympathetic/balanced/sympathetic
// recovery state. Distinct from hrvSummary.js (descriptive baseline + dot
// chart) and hrvAlertSummary.js (≥2σ suppressed alert). This module answers:
// "Is the athlete autonomically recovered, balanced, or strained today?"
//
// Method (Plews & Buchheit 2017; Stanley 2013; Buchheit 2014):
//   ln-transform RMSSD (more normally distributed; Plews 2013) →
//   7-day rolling mean → compare to 28-day baseline (mean + SD + CV).
//
//   PARASYMPATHETIC_RECOVERED : 7d mean ≥ baseline + 0.5·SD  AND  CV ≤ 8%
//   BALANCED                  : within ±0.5·SD of baseline    (default)
//   SYMPATHETIC_STRAINED      : 7d mean ≤ baseline − 0.5·SD   OR   CV > 12%
//
// Sample-adequacy gate: forces BALANCED + sampleAdequate=false when
// 7d window has < 4 entries OR 28d window has < 14 entries — under-powered
// windows are noisy enough that any directional call would be guesswork.
// ─────────────────────────────────────────────────────────────────────────────

export const AUTONOMIC_BALANCE_CITATION = 'Plews & Buchheit 2017; Stanley 2013; Buchheit 2014'

const MIN_7D     = 4
const MIN_28D    = 14
const CV_LOW     = 8     // ≤8% → tight cluster, recovered side eligible
const CV_HIGH    = 12    // >12% → strained regardless of mean
const SD_MULT    = 0.5   // ±0.5·SD band around baseline = BALANCED

// ─── Internal: ln-RMSSD extraction ───────────────────────────────────────────
// Accept entries with any of { rmssd, lnRmssd, hrv }. The app-native
// `recovery` table stores `hrv` as raw RMSSD (ms) per MorningCheckIn.jsx;
// `rmssd` mirrors that; `lnRmssd` is the pre-computed natural log.
// Returns array of { date, ln } sorted ascending, with future dates filtered.
function extractLnEntries(entries, todayISO) {
  if (!Array.isArray(entries)) return []

  const out = []
  for (const e of entries) {
    if (!e || typeof e.date !== 'string') continue
    if (todayISO && e.date > todayISO) continue   // filter future dates

    let ln = null
    if (typeof e.lnRmssd === 'number' && e.lnRmssd > 0) {
      ln = e.lnRmssd
    } else if (typeof e.rmssd === 'number' && e.rmssd > 0) {
      ln = Math.log(e.rmssd)
    } else if (typeof e.hrv === 'number' && e.hrv > 0) {
      // Heuristic: lnRMSSD values typically sit in [2.5, 5.5];
      // raw RMSSD in [10, 200]. >10 → treat as raw RMSSD (ms).
      ln = e.hrv > 10 ? Math.log(e.hrv) : e.hrv
    }
    if (ln === null || !Number.isFinite(ln)) continue
    out.push({ date: e.date, ln })
  }

  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
}

function todayISOString(today) {
  if (today instanceof Date) return today.toISOString().slice(0, 10)
  if (typeof today === 'string' && today.length >= 10) return today.slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

function isoDaysAgo(todayISO, days) {
  const ms = new Date(todayISO + 'T00:00:00Z').getTime() - days * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

function mean(arr) {
  if (arr.length === 0) return 0
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

function stddev(arr, m) {
  if (arr.length === 0) return 0
  let s = 0
  for (const v of arr) s += (v - m) ** 2
  return Math.sqrt(s / arr.length)
}

/**
 * Stratify the athlete's recent HRV trend into an autonomic-balance state.
 *
 * @param {Array<{date:string, rmssd?:number, lnRmssd?:number, hrv?:number}>} hrvEntries
 * @param {Date|string} [today] — anchor date (defaults to "now")
 * @returns {{
 *   state: 'PARASYMPATHETIC_RECOVERED' | 'BALANCED' | 'SYMPATHETIC_STRAINED' | 'INSUFFICIENT',
 *   mean7d: number,
 *   baseline28d: number,
 *   sd: number,
 *   cv: number,
 *   sampleSize: { d7: number, d28: number },
 *   sampleAdequate: boolean,
 *   citation: string,
 * } | null}
 */
export function stratifyAutonomicBalance(hrvEntries, today) {
  if (!Array.isArray(hrvEntries) || hrvEntries.length === 0) return null

  const todayISO = todayISOString(today)
  const ln = extractLnEntries(hrvEntries, todayISO)
  if (ln.length === 0) return null

  const cutoff7  = isoDaysAgo(todayISO, 7)
  const cutoff28 = isoDaysAgo(todayISO, 28)

  const lnVals7  = ln.filter(e => e.date >  cutoff7  && e.date <= todayISO).map(e => e.ln)
  const lnVals28 = ln.filter(e => e.date >  cutoff28 && e.date <= todayISO).map(e => e.ln)

  const d7  = lnVals7.length
  const d28 = lnVals28.length

  const mean7d      = Math.round(mean(lnVals7) * 1000) / 1000
  const baseline28d = Math.round(mean(lnVals28) * 1000) / 1000
  const sd          = Math.round(stddev(lnVals28, baseline28d) * 1000) / 1000
  const cv          = baseline28d > 0
    ? Math.round((sd / baseline28d) * 10000) / 100   // percent, 2 dp
    : 0

  const sampleAdequate = d7 >= MIN_7D && d28 >= MIN_28D

  // Under-powered window → don't try to classify direction
  if (!sampleAdequate) {
    return {
      state: 'BALANCED',
      mean7d, baseline28d, sd, cv,
      sampleSize: { d7, d28 },
      sampleAdequate: false,
      citation: AUTONOMIC_BALANCE_CITATION,
    }
  }

  // CV blowout — autonomic system unstable regardless of mean direction
  if (cv > CV_HIGH) {
    return {
      state: 'SYMPATHETIC_STRAINED',
      mean7d, baseline28d, sd, cv,
      sampleSize: { d7, d28 },
      sampleAdequate: true,
      citation: AUTONOMIC_BALANCE_CITATION,
    }
  }

  const hi = baseline28d + SD_MULT * sd
  const lo = baseline28d - SD_MULT * sd

  let state
  if (mean7d >= hi && cv <= CV_LOW) {
    state = 'PARASYMPATHETIC_RECOVERED'
  } else if (mean7d <= lo) {
    state = 'SYMPATHETIC_STRAINED'
  } else {
    state = 'BALANCED'
  }

  return {
    state,
    mean7d, baseline28d, sd, cv,
    sampleSize: { d7, d28 },
    sampleAdequate: true,
    citation: AUTONOMIC_BALANCE_CITATION,
  }
}
