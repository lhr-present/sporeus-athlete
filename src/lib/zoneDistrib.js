// src/lib/zoneDistrib.js — Zone distribution analysis (pure functions)
// RPE as proxy for training zone when HR/power zones not available.
// Reference: Seiler & Kjerland (2006), Scand J Med Sci Sports 16:49–56

/**
 * Map RPE (Borg 1–10) to training zone 1–5.
 * RPE 1–3 → Z1 (recovery) · 4–5 → Z2 (aerobic) · 6–7 → Z3 (tempo)
 * RPE 8 → Z4 (VO₂max) · 9–10 → Z5 (anaerobic)
 * Returns null if rpe is missing or zero.
 */
export function rpeToZone(rpe) {
  const r = Math.round(rpe)
  if (!r) return null
  if (r <= 3) return 1
  if (r <= 5) return 2
  if (r <= 7) return 3
  if (r === 8) return 4
  return 5
}

/**
 * Duration-weighted zone distribution from RPE-proxied sessions.
 * @param {Array} sessions - log entries with { rpe, duration }
 * @returns {{ 1, 2, 3, 4, 5 }|null} - integer percentages summing to ~100, or null if no data
 */
export function zoneDistribution(sessions) {
  const totals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let totalDuration = 0
  for (const s of (sessions || [])) {
    const zone = rpeToZone(s.rpe)
    if (!zone) continue
    const dur = s.duration || 0
    totals[zone] += dur
    totalDuration += dur
  }
  if (totalDuration === 0) return null
  const pct = {}
  for (let z = 1; z <= 5; z++) {
    pct[z] = Math.round(totals[z] / totalDuration * 100)
  }
  return pct
}

/**
 * Identify the training distribution model from zone percentages.
 * - 'polarized'  — Z1+Z2 ≥ 70% AND Z4+Z5 ≥ 15% (Seiler 80/20 concept)
 * - 'pyramidal'  — Z1+Z2 ≥ 60%, Z3 ≥ 20%, Z4+Z5 < 20%
 * - 'threshold'  — Z3 ≥ 30% (classic threshold / tempo approach)
 * - 'recovery'   — Z1+Z2 ≥ 85% (very low total load)
 * - 'mixed'      — none of the above
 */
export function trainingModel(pct) {
  if (!pct) return 'unknown'
  const easy     = (pct[1] || 0) + (pct[2] || 0)
  const moderate = pct[3] || 0
  const hard     = (pct[4] || 0) + (pct[5] || 0)
  if (easy >= 70 && hard >= 15)                         return 'polarized'
  if (easy >= 60 && moderate >= 20 && hard < 20)        return 'pyramidal'
  if (moderate >= 30)                                    return 'threshold'
  if (easy >= 85)                                        return 'recovery'
  return 'mixed'
}

/** Human-readable label + colour for each model. */
export const MODEL_META = {
  polarized:  { color: '#5bc25b', en: 'POLARIZED',  tr: 'POLARİZE',  tip: 'Optimal for endurance (Seiler). Keep Z3 < 10%.' },
  pyramidal:  { color: '#0064ff', en: 'PYRAMIDAL',  tr: 'PİRAMİT',   tip: 'Good base — healthy volume pyramid.' },
  threshold:  { color: '#f5c542', en: 'THRESHOLD-HEAVY', tr: 'TEMPO AĞIRLIKLI', tip: 'High Z3 — replace some tempo with easy or hard efforts.' },
  recovery:   { color: '#888',    en: 'RECOVERY',   tr: 'TOPARLANMA', tip: 'Very low intensity — ready to add volume.' },
  mixed:      { color: '#888',    en: 'MIXED',       tr: 'KARMA',     tip: 'No clear distribution pattern yet.' },
  unknown:    { color: '#555',    en: 'NO DATA',    tr: 'VERİ YOK',  tip: 'Log sessions with RPE to see zone distribution.' },
}
