// ─── src/lib/athlete/restingHrFitnessTrend.js ──────────────────────────────
//
// Long-term aerobic-fitness marker derived from resting HR (RHR).
//
// Falling RHR over time is a canonical aerobic-fitness signal: as the
// stroke volume rises and parasympathetic tone increases with training,
// the heart needs fewer beats per minute at rest to maintain cardiac
// output. This module compares the athlete's most recent `windowDays`
// average RHR against their lifetime baseline (mean across all valid
// log entries) and classifies the delta into three fitness bands:
//
//   IMPROVING : recent ≤ lifetime − 2 bpm     (aerobic adaptation working)
//   STABLE    : |recent − lifetime| < 2 bpm   (fitness consistent w/ baseline)
//   RISING    : recent ≥ lifetime + 2 bpm     (fatigue / illness / detraining)
//
// Distinct from `restingHrDrift.js` which is an ACUTE-overreaching detector
// (rolling 14d vs last 3d, >5% drift, >=3 consecutive days). This module
// is a LONG-TERM fitness-marker view.
//
// References:
//   - Buchheit M. (2014) Monitoring training status with HR-derived measures.
//   - Plews D.J. et al. (2014) Heart rate variability in elite triathletes.
//   - Karvonen M.J. et al. (1957) The effects of training on heart rate.
//
// Pure module — no React, no I/O, fully deterministic.

export const RHR_FITNESS_TREND_CITATION = 'Buchheit 2014; Plews 2014'

// ── helpers ──────────────────────────────────────────────────────────────────

function pickRHR(entry) {
  if (!entry) return null
  const raw = entry.restingHR
  if (raw === undefined || raw === null || raw === '') return null
  const v = Number(raw)
  if (!Number.isFinite(v)) return null
  if (v <= 0) return null
  return v
}

function parseISODate(s) {
  if (!s || typeof s !== 'string') return null
  const [y, m, day] = s.split('-').map(n => parseInt(n, 10))
  if (!y || !m || !day) return null
  return new Date(Date.UTC(y, m - 1, day))
}

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function mean(arr) {
  if (!arr.length) return null
  return arr.reduce((acc, v) => acc + v, 0) / arr.length
}

// ── core ─────────────────────────────────────────────────────────────────────
//
// analyzeRestingHrFitnessTrend({ recovery, today, windowDays })
//
//   recovery   : array of { date: 'YYYY-MM-DD', restingHR, ... }
//   today      : 'YYYY-MM-DD' anchor (defaults to current UTC date)
//   windowDays : recent window length in days (default 90)
//
// Returns:
//   {
//     band                 : 'IMPROVING' | 'STABLE' | 'RISING',
//     lifetimeAvgRHR       : number (bpm, 1-dp),
//     recentAvgRHR         : number (bpm, 1-dp),
//     delta                : number (bpm, 1-dp, signed; recent − lifetime),
//     recentSampleCount    : number,
//     lifetimeSampleCount  : number,
//     citation             : string,
//   }
//   OR null when fewer than 10 valid lifetime entries OR fewer than 5 in the
//   recent window.
//
export function analyzeRestingHrFitnessTrend({
  recovery,
  today,
  windowDays = 90,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  // Filter valid entries: restingHR defined and > 0.
  const cleaned = recovery
    .map(e => ({ date: e?.date, rhr: pickRHR(e) }))
    .filter(e => typeof e.date === 'string' && e.rhr !== null)

  if (cleaned.length < 10) return null

  // Anchor today
  const anchor = today
    ? parseISODate(today)
    : parseISODate(toISODate(new Date()))
  if (!anchor) return null
  const anchorISO = toISODate(anchor)

  // Only consider entries on or before the anchor.
  const upToAnchor = cleaned.filter(e => e.date <= anchorISO)
  if (upToAnchor.length < 10) return null

  // Recent window: entries within `windowDays` before today (inclusive).
  const windowStart = new Date(anchor.getTime())
  windowStart.setUTCDate(windowStart.getUTCDate() - (windowDays - 1))
  const windowStartISO = toISODate(windowStart)

  const recentEntries = upToAnchor.filter(
    e => e.date >= windowStartISO && e.date <= anchorISO
  )
  if (recentEntries.length < 5) return null

  const lifetimeAvgRHR = mean(upToAnchor.map(e => e.rhr))
  const recentAvgRHR   = mean(recentEntries.map(e => e.rhr))
  const delta          = recentAvgRHR - lifetimeAvgRHR

  let band
  if (delta <= -2) band = 'IMPROVING'
  else if (delta >= 2) band = 'RISING'
  else band = 'STABLE'

  return {
    band,
    lifetimeAvgRHR: Math.round(lifetimeAvgRHR * 10) / 10,
    recentAvgRHR:   Math.round(recentAvgRHR   * 10) / 10,
    delta:          Math.round(delta          * 10) / 10,
    recentSampleCount:   recentEntries.length,
    lifetimeSampleCount: upToAnchor.length,
    citation: RHR_FITNESS_TREND_CITATION,
  }
}
