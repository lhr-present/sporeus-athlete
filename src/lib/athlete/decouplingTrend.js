// src/lib/athlete/decouplingTrend.js
//
// v9.123.0 — Aerobic decoupling trend analyzer.
//
// `lib/decoupling.js` already computes the Friel-method Pw:Hr (or
// pace:HR) decoupling percentage at FIT import time and stores it on
// the log entry as `decouplingPct`. The number sits there per-session
// but the system never surfaces a multi-session view — so an athlete
// who's running 8% decoupling on every aerobic ride has no idea it
// signals an aerobic base deficit, just that yesterday's individual
// session "felt fine."
//
// This module looks across the last 14 days of aerobic sessions
// (rpe <= 6, the standard Z1–Z2 threshold), averages decouplingPct,
// and flags the trend as good / mild / significant. The UI uses it
// to surface a single alert with the Friel citation and an action
// hint, silent when the trend is healthy or sample size is too small
// to be meaningful (<2 sessions).
//
// Why aerobic-only: decoupling on hard threshold/VO2 sessions is
// expected and not diagnostic. The Friel test is specifically for
// steady-state aerobic work — that's where >5% drift indicates the
// aerobic engine can't sustain the demand.
//
// Pure function. No I/O.

const MS_PER_DAY = 86400000

/**
 * @description Default thresholds. Mirrors `decoupling.js`
 *   DECOUPLING_THRESHOLDS but expressed as trend tiers for the
 *   averaged value.
 */
export const DECOUPLING_TREND_THRESHOLDS = Object.freeze({
  coupled:     5,   // avg < 5% → good aerobic base
  mild:        10,  // 5–10% → mild aerobic insufficiency
  // anything >10% → significant
})

/**
 * @description Aerobic-effort gate. We use RPE because every entry
 *   has it, while zone tagging is inconsistent across import sources.
 *   RPE 6 is the upper bound of "conversational pace" (Borg CR10).
 */
const AEROBIC_RPE_CAP = 6

/**
 * @description Minimum samples required to call a trend. Below this
 *   we suppress the alert — one bad session isn't a base deficit.
 */
const MIN_SAMPLES = 2

const WINDOW_DAYS = 14

function dayMs(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/**
 * @description Classify an averaged decoupling percentage.
 */
export function classifyDecouplingTrend(avgPct) {
  if (!Number.isFinite(avgPct)) return null
  if (avgPct < DECOUPLING_TREND_THRESHOLDS.coupled) return 'good'
  if (avgPct < DECOUPLING_TREND_THRESHOLDS.mild)    return 'mild'
  return 'significant'
}

/**
 * @description Analyze recent aerobic-session decoupling.
 *
 * @param {Array}  log    - training log
 * @param {string} [today] - 'YYYY-MM-DD'; defaults to today UTC
 * @returns {{
 *   flag:       'good' | 'mild' | 'significant' | null,
 *   avgPct:     number | null,
 *   sampleCount: number,
 *   samples:    Array<{ date: string, decouplingPct: number, rpe: number }>,
 *   summary:    { en: string, tr: string } | null,
 * }}
 */
export function analyzeDecouplingTrend(log, today) {
  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(tToday)
  if (todayMs == null) {
    return { flag: null, avgPct: null, sampleCount: 0, samples: [], summary: null }
  }
  const cutoffMs = todayMs - WINDOW_DAYS * MS_PER_DAY

  const samples = []
  for (const e of (Array.isArray(log) ? log : [])) {
    const dMs = dayMs(e?.date)
    if (dMs == null || dMs < cutoffMs || dMs > todayMs) continue
    const dc = Number(e?.decouplingPct)
    if (!Number.isFinite(dc)) continue
    const rpe = Number(e?.rpe)
    if (!Number.isFinite(rpe) || rpe > AEROBIC_RPE_CAP) continue
    samples.push({ date: String(e.date).slice(0, 10), decouplingPct: dc, rpe })
  }

  if (samples.length < MIN_SAMPLES) {
    return { flag: null, avgPct: null, sampleCount: samples.length, samples, summary: null }
  }

  const avgPct = samples.reduce((a, s) => a + s.decouplingPct, 0) / samples.length
  const flag = classifyDecouplingTrend(avgPct)

  const pct = avgPct.toFixed(1)
  const summary = flag === 'good'
    ? null  // never surface a 'good' alert — silence is the absence of a problem
    : flag === 'mild'
    ? {
        en: `Avg ${pct}% Pw:Hr drift across ${samples.length} aerobic sessions — mild aerobic insufficiency. Hold easy paces and lengthen Z2 work for 2–3 weeks.`,
        tr: `Son ${samples.length} aerobik seansta ortalama %${pct} Pw:Hr kayması — hafif aerobik yetersizlik. Kolay tempoları koru, 2–3 hafta Z2 hacmini artır.`,
      }
    : {
        en: `Avg ${pct}% Pw:Hr drift across ${samples.length} aerobic sessions — significant decoupling. Aerobic base needs deliberate rebuilding before adding intensity.`,
        tr: `Son ${samples.length} aerobik seansta ortalama %${pct} Pw:Hr kayması — belirgin desenkronizasyon. Yoğunluk eklemeden önce aerobik temel tekrar inşa edilmeli.`,
      }

  return { flag, avgPct, sampleCount: samples.length, samples, summary }
}
