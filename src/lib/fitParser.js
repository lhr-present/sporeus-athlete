// ─── fitParser.js — Pure math helpers for FIT/GPX metric computation ──────────
// Thin wrappers around formulas.js and decoupling.js with a stable public API
// for unit testing. No React, no DOM, no Supabase.
//
// Used by: UploadActivity.jsx (client-side preview), fitParser.test.js (tests)
// Server-side parsing: supabase/functions/parse-activity/index.ts (Deno)

import { normalizedPower, computePowerTSS } from './formulas.js'
import { computeDecoupling } from './decoupling.js'

export { normalizedPower, computePowerTSS }

/**
 * Derive NP, Intensity Factor, and TSS from a 1-Hz power stream.
 * @param {number[]} powerSeries — 1-Hz power readings in watts
 * @param {number}   ftp         — Functional Threshold Power in watts
 * @param {number}   durationSec — total effort duration in seconds
 * @returns {{ np: number, intensityFactor: number, tss: number }}
 */
export function powerMetrics(powerSeries, ftp, durationSec) {
  if (!powerSeries?.length || !ftp || !durationSec) {
    return { np: 0, intensityFactor: 0, tss: 0 }
  }
  const np             = normalizedPower(powerSeries)
  const intensityFactor = np && ftp ? Math.round((np / ftp) * 100) / 100 : 0
  const tss            = computePowerTSS(np, durationSec, ftp) ?? 0
  return { np, intensityFactor, tss }
}

/**
 * Compute HR zone distribution (Z1–Z5) from a 1-Hz HR stream.
 * @param {number[]} hrSeries — heart rate samples in bpm
 * @param {number}   maxHR    — athlete's maximum heart rate
 * @returns {number[]} — 5-element array, each value is % time in that zone (0–100)
 */
export function hrZoneDistribution(hrSeries, maxHR) {
  if (!hrSeries?.length || !maxHR) return [0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0]
  for (const hr of hrSeries) {
    if (!hr) continue
    const pct  = hr / maxHR
    const zone = pct < 0.60 ? 0 : pct < 0.70 ? 1 : pct < 0.80 ? 2 : pct < 0.90 ? 3 : 4
    counts[zone]++
  }
  const total = counts.reduce((s, v) => s + v, 0) || 1
  return counts.map(c => Math.round((c / total) * 100))
}

/**
 * Compute aerobic decoupling % from HR and effort (power or speed) streams.
 * Returns null when the effort is too short (<120 samples after warmup strip).
 * @param {number[]} hrSeries     — 1-Hz heart rate (bpm)
 * @param {object}   opts
 * @param {number[]} [opts.powerSeries]  — 1-Hz power (watts); takes precedence over speed
 * @param {number[]} [opts.speedSeries]  — 1-Hz speed (m/s)
 * @param {number}   [opts.minDurationSec=1800] — minimum valid duration (seconds)
 * @returns {number|null} decoupling percentage, or null if effort is too short/invalid
 */
export function decouplingPct(hrSeries, opts = {}) {
  const { powerSeries, speedSeries, minDurationSec = 1800 } = opts
  try {
    const result = computeDecoupling({
      hr:      hrSeries,
      power:   powerSeries,
      speed:   speedSeries,
      options: { minDurationSec },
    })
    return result?.decouplingPct ?? null
  } catch {
    return null
  }
}
