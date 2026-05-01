// ─── src/lib/recovery/readinessScore.js — E17 Morning Readiness composite ────
// Pure function. No React, no localStorage, no side effects.
//
// Composite readiness score (0–100) for the Morning Check-In hub.
// Weighted blend of four physiological/subjective components:
//   • HRV       40 %  — rolling 28-day Z-score (Plews 2013)
//   • Sleep     25 %  — last sleep hours vs 28-day median (Lastella 2018)
//   • Soreness  20 %  — 1–10 inverse linear (Foster 1998 RPE/wellness model)
//   • Mood      15 %  — 1–5 linear (Foster 1998 wellness questionnaire)
//
// When data is missing the function REWEIGHTS the available components and
// downgrades `reliability` ('full' → 'partial' → 'low'). It NEVER fabricates
// values for missing inputs. If no data at all is present it returns null
// for `score` and reliability='low'.
//
// References:
//   Plews DJ et al. 2013, Int J Sports Physiol Perform — HRV rolling baseline
//   Lastella M et al. 2018, J Sports Sci — sleep duration vs perf in athletes
//   Foster C 1998, Med Sci Sports Exerc — session-RPE & subjective wellness
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = Object.freeze({
  hrv:      0.40,
  sleep:    0.25,
  soreness: 0.20,
  mood:     0.15,
})

const CITATION = 'Plews 2013 · Lastella 2018 · Foster 1998'

// ─── helpers ────────────────────────────────────────────────────────────────

/** Median of a numeric array. Empty → null. */
function median(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const sorted = arr.slice().sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2
}

/** Population SD of a numeric array. Empty/single-value → 0. */
function sd(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return 0
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

/** Clamp x into [lo, hi]. */
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

/** Coerce truthy positive numbers from { date, value } / { date, hrv } / { date, sleepHrs } */
function toSeries(history, valueKey) {
  if (!Array.isArray(history)) return []
  const out = []
  for (const e of history) {
    if (!e) continue
    const raw =
      valueKey && e[valueKey] != null ? e[valueKey] :
      e.value != null               ? e.value      :
      e.hrv != null                 ? e.hrv        :
      e.sleepHrs != null            ? e.sleepHrs   :
      null
    const v = typeof raw === 'number' ? raw : parseFloat(raw)
    if (!isNaN(v) && v > 0) out.push({ date: e.date || null, value: v })
  }
  return out.sort((a, b) =>
    a.date == null ? 1 : b.date == null ? -1 : a.date < b.date ? -1 : 1)
}

// ─── component scorers ──────────────────────────────────────────────────────

/**
 * HRV rolling Z-score component (0–100).
 * Last value compared to 28-day median ± SD baseline.
 *   z =  0 → 100   (right at baseline)
 *   z = -1 → 50    (one SD below)
 *   z = -2 →  0    (two SD below or worse → floored)
 *   z = +1 → 100   (above baseline still scores 100; we don't reward overshoot)
 *
 * Returns { score, z, n } or null if < 7 readings or no last value.
 */
export function scoreHRVComponent(hrvHistory) {
  const series = toSeries(hrvHistory, 'hrv')
  if (series.length < 7) return null

  const values = series.map(e => e.value)
  const baseline = median(values)
  const dev = sd(values)
  const last = values[values.length - 1]

  if (baseline == null || last == null) return null

  // If SD is 0 (constant series) we cannot compute Z; map last-vs-baseline.
  let z
  if (dev > 0) {
    z = (last - baseline) / dev
  } else {
    z = last >= baseline ? 0 : -2
  }

  // 0 score when z ≤ -2, 100 when z ≥ 0, linear between.
  let score
  if (z >= 0)       score = 100
  else if (z <= -2) score = 0
  else              score = (z + 2) * 50   // -2→0, -1→50, 0→100

  return {
    score: Math.round(score),
    z: Math.round(z * 100) / 100,
    n: values.length,
  }
}

/**
 * Sleep component (0–100).
 * Compares latest sleep hours to 28-day median.
 *   ≥ median       → 100
 *   median - 1 h   →  75
 *   median - 2 h   →  50
 *   median - 3 h   →  25
 *   median - 4 h+  →   0
 *
 * Returns { score, last, median, n } or null if no readings.
 */
export function scoreSleepComponent(sleepHistory) {
  const series = toSeries(sleepHistory, 'sleepHrs')
  if (series.length === 0) return null

  const values = series.map(e => e.value)
  const med = median(values)
  const last = values[values.length - 1]

  if (med == null || last == null) return null

  let score
  if (last >= med) score = 100
  else {
    const deficit = med - last        // hours short of median
    score = clamp(100 - deficit * 25, 0, 100)
  }

  return {
    score: Math.round(score),
    last: Math.round(last * 10) / 10,
    median: Math.round(med * 10) / 10,
    n: values.length,
  }
}

/**
 * Soreness component (0–100). 1–10 scale, 1 = no soreness.
 *   1 → 100, 10 → 0, linear.
 * Returns { score, raw } or null.
 */
export function scoreSorenessComponent(soreness) {
  const v = parseFloat(soreness)
  if (isNaN(v) || v < 1 || v > 10) return null
  const score = Math.round(((10 - v) / 9) * 100)
  return { score, raw: v }
}

/**
 * Mood component (0–100). 1–5 scale, 5 = great.
 *   1 → 0, 5 → 100, linear.
 * Returns { score, raw } or null.
 */
export function scoreMoodComponent(mood) {
  const v = parseFloat(mood)
  if (isNaN(v) || v < 1 || v > 5) return null
  const score = Math.round(((v - 1) / 4) * 100)
  return { score, raw: v }
}

// ─── driver explanations ────────────────────────────────────────────────────

function reasonFor(factor, delta, ctx = {}) {
  const sign = delta >= 0 ? '+' : ''
  switch (factor) {
    case 'hrv': {
      const z = ctx.z != null ? ctx.z.toFixed(2) : '?'
      return delta < 0
        ? {
            en: `HRV ${z} SD below 28-day baseline — autonomic recovery incomplete.`,
            tr: `HRV 28 günlük bazın ${z} SS altında — otonom toparlanma tamamlanmamış.`,
          }
        : {
            en: `HRV at or above 28-day baseline (z ${z}) — autonomic recovery solid.`,
            tr: `HRV 28 günlük bazın üstünde (z ${z}) — otonom toparlanma sağlam.`,
          }
    }
    case 'sleep': {
      const last = ctx.last != null ? ctx.last : '?'
      const med  = ctx.median != null ? ctx.median : '?'
      return delta < 0
        ? {
            en: `Slept ${last} h vs ${med} h median — sleep debt is dragging readiness.`,
            tr: `${last} saat uyudun, normal ${med} saat — uyku borcu hazır olma durumunu düşürüyor.`,
          }
        : {
            en: `Sleep ${last} h ≥ ${med} h median — well rested.`,
            tr: `Uyku ${last} saat ≥ ${med} saat ortanca — iyi dinlenmişsin.`,
          }
    }
    case 'soreness': {
      const raw = ctx.raw != null ? ctx.raw : '?'
      return delta < 0
        ? {
            en: `Soreness ${raw}/10 — muscular fatigue still present.`,
            tr: `Kas ağrısı ${raw}/10 — kas yorgunluğu hâlâ var.`,
          }
        : {
            en: `Soreness ${raw}/10 — muscles fresh.`,
            tr: `Kas ağrısı ${raw}/10 — kaslar dinç.`,
          }
    }
    case 'mood': {
      const raw = ctx.raw != null ? ctx.raw : '?'
      return delta < 0
        ? {
            en: `Mood ${raw}/5 — psychological readiness low.`,
            tr: `Mod ${raw}/5 — psikolojik hazır olma düşük.`,
          }
        : {
            en: `Mood ${raw}/5 — psychologically primed.`,
            tr: `Mod ${raw}/5 — psikolojik olarak hazırsın.`,
          }
    }
    default:
      return { en: `${factor} ${sign}${delta}`, tr: `${factor} ${sign}${delta}` }
  }
}

// ─── main entry point ───────────────────────────────────────────────────────

/**
 * Compute composite morning readiness score.
 *
 * @param {Object} input
 * @param {Array<{date:string, hrv:number}>}      input.hrvHistory   — last ~28d
 * @param {Array<{date:string, sleepHrs:number}>} input.sleepHistory — last ~28d
 * @param {number} [input.soreness]  1–10 (1 = none)
 * @param {number} [input.mood]      1–5  (5 = great)
 * @param {string} [input.asOf]      'YYYY-MM-DD' — reserved for future windowing
 *
 * @returns {{
 *   score: number|null,
 *   drivers: Array<{ factor:string, delta:number, reason:{en:string,tr:string} }>,
 *   components: { hrv:number|null, sleep:number|null, soreness:number|null, mood:number|null },
 *   reliability: 'full'|'partial'|'low',
 *   citation: string,
 * }}
 */
export function computeReadinessScore({
  hrvHistory   = [],
  sleepHistory = [],
  soreness     = null,
  mood         = null,
  asOf         = null,   // eslint-disable-line no-unused-vars
} = {}) {
  const hrv      = scoreHRVComponent(hrvHistory)
  const sleep    = scoreSleepComponent(sleepHistory)
  const sore     = scoreSorenessComponent(soreness)
  const moodComp = scoreMoodComponent(mood)

  const components = {
    hrv:      hrv      ? hrv.score      : null,
    sleep:    sleep    ? sleep.score    : null,
    soreness: sore     ? sore.score     : null,
    mood:     moodComp ? moodComp.score : null,
  }

  // Determine which components are present for reweighting
  const present = []
  if (hrv)      present.push({ key: 'hrv',      score: hrv.score,      ctx: { z: hrv.z } })
  if (sleep)    present.push({ key: 'sleep',    score: sleep.score,    ctx: { last: sleep.last, median: sleep.median } })
  if (sore)     present.push({ key: 'soreness', score: sore.score,     ctx: { raw: sore.raw } })
  if (moodComp) present.push({ key: 'mood',     score: moodComp.score, ctx: { raw: moodComp.raw } })

  // Reliability ladder
  //   3–4 components present, including HRV → 'full'
  //   2 components, OR HRV missing            → 'partial'
  //   0–1 component                           → 'low'
  let reliability
  if (present.length === 0) reliability = 'low'
  else if (present.length === 1) reliability = 'low'
  else if (present.length === 2) reliability = 'partial'
  else if (!hrv) reliability = 'partial'   // HRV missing degrades to partial
  else reliability = 'full'

  // Reweight: scale present component weights so they sum to 1
  let score = null
  if (present.length > 0) {
    const totalW = present.reduce((s, c) => s + WEIGHTS[c.key], 0)
    let weighted = 0
    for (const c of present) {
      weighted += c.score * (WEIGHTS[c.key] / totalW)
    }
    score = clamp(Math.round(weighted), 0, 100)
  }

  // Drivers: top 2 components by absolute deviation from 100 (i.e. biggest
  // pull-down or strongest contribution). Delta is signed: negative if the
  // component dragged the score down vs a perfect 100.
  const ranked = present
    .map(c => ({
      key:    c.key,
      ctx:    c.ctx,
      score:  c.score,
      delta:  c.score - 100,                // ≤ 0 unless future scoring rewards >100
      mag:    Math.abs(c.score - 100),
      weight: WEIGHTS[c.key],
    }))
    // Weight the magnitude so HRV losses outrank Mood losses of equal size
    .sort((a, b) => (b.mag * b.weight) - (a.mag * a.weight))

  const drivers = ranked.slice(0, 2).map(d => ({
    factor: d.key,
    delta:  d.delta,
    reason: reasonFor(d.key, d.delta, d.ctx),
  }))

  return {
    score,
    drivers,
    components,
    reliability,
    citation: CITATION,
  }
}

export const READINESS_WEIGHTS = WEIGHTS
export const READINESS_CITATION = CITATION
