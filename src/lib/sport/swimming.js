// ─── src/lib/sport/swimming.js — Swimming sport-science engine ────────────────
// CSS (Critical Swim Speed), T-pace, zone system.

// ── Critical Swim Speed (CSS) ─────────────────────────────────────────────────
/**
 * @description Calculates Critical Swim Speed (CSS) in m/s from two all-out time trials.
 *   Standard protocol: 400 m + 200 m time trials (or 1500 m + 400 m).
 *   CSS (m/s) = (d2 − d1) / (t2 − t1)
 * @param {number} d1M - Shorter trial distance in metres
 * @param {number} t1Sec - Shorter trial time in seconds
 * @param {number} d2M - Longer trial distance in metres (must be > d1M)
 * @param {number} t2Sec - Longer trial time in seconds
 * @returns {number|null} CSS in m/s (4 decimal places), or null on invalid input
 * @source Wakayoshi et al. (1992) — Determination and validity of critical velocity as swimming fatigue threshold
 * @example
 * criticalSwimSpeed(200, 160, 400, 340) // => ~1.111 m/s
 */
export function criticalSwimSpeed(d1M, t1Sec, d2M, t2Sec) {
  if (!d1M || !t1Sec || !d2M || !t2Sec) return null
  if (d2M <= d1M) return null  // need d2 > d1 for standard formula
  const dDiff = d2M - d1M
  const tDiff = t2Sec - t1Sec
  if (tDiff <= 0) return null
  const cssMs = dDiff / tDiff  // m/s
  if (cssMs <= 0 || cssMs > 3) return null  // sanity: <3 m/s (world record ~2.2 m/s)
  return Math.round(cssMs * 10000) / 10000  // 4dp m/s
}

/**
 * @description Converts CSS from m/s to seconds per 100 m (T-pace display format).
 * @param {number} cssMs - CSS in metres per second
 * @returns {number|null} Pace in seconds per 100 m, or null on invalid input
 * @source Wakayoshi et al. (1992) — Determination and validity of critical velocity as swimming fatigue threshold
 * @example
 * cssToSecPer100m(1.5) // => 66.7 (sec/100m)
 */
export function cssToSecPer100m(cssMs) {
  if (!cssMs || cssMs <= 0) return null
  return Math.round((100 / cssMs) * 10) / 10
}

// ── T-pace ────────────────────────────────────────────────────────────────────
/**
 * @description Estimates T-pace (threshold pace, sec/100 m) from a single time trial.
 *   T-pace ≈ TT pace for distances of 1000–1500 m (near-threshold effort).
 * @param {number} distanceM - Time trial distance in metres
 * @param {number} timeSec - Time trial time in seconds
 * @returns {number|null} T-pace in seconds per 100 m, or null on invalid input
 * @source Wakayoshi et al. (1992) — Determination and validity of critical velocity as swimming fatigue threshold
 * @example
 * tPaceFromTT(1000, 900) // => 90 (sec/100m)
 */
export function tPaceFromTT(distanceM, timeSec) {
  if (!distanceM || !timeSec || timeSec <= 0 || distanceM <= 0) return null
  const paceSecPer100m = (timeSec / distanceM) * 100
  // T-pace ≈ TT pace for distances around 1000–1500m (near-threshold effort)
  return Math.round(paceSecPer100m * 10) / 10  // sec/100m
}

// ── Swimming zone system ──────────────────────────────────────────────────────
// Zones based on % of CSS (sec/100m pace — lower = faster)
// Zone 1: very easy (>120% CSS pace → slower)
// Zone 2: aerobic (110–120% CSS pace)
// Zone 3: threshold / CSS (100–110%)
// Zone 4: threshold-high / lactate (95–100%)
// Zone 5: VO2max (85–95%)
const SWIM_ZONE_DEFS = [
  { id: 1, name: 'Recovery',   pctMin: 1.20, pctMax: Infinity },
  { id: 2, name: 'Aerobic',    pctMin: 1.10, pctMax: 1.20 },
  { id: 3, name: 'CSS',        pctMin: 1.00, pctMax: 1.10 },
  { id: 4, name: 'Threshold',  pctMin: 0.95, pctMax: 1.00 },
  { id: 5, name: 'VO2max',     pctMin: 0.85, pctMax: 0.95 },
  { id: 6, name: 'Anaerobic',  pctMin: 0,    pctMax: 0.85 },
]

/**
 * @description Returns the swimming zone number (1–6) for a current pace relative to CSS pace.
 * @param {number} currentSecPer100m - Current pace in seconds per 100 m
 * @param {number} cssSecPer100m - CSS in seconds per 100 m
 * @returns {number|null} Zone 1 (Recovery) to 6 (Anaerobic), or null on invalid input
 * @source Wakayoshi et al. (1992) — Determination and validity of critical velocity as swimming fatigue threshold
 * @example
 * swimmingZone(100, 90) // => 2 (Aerobic, ratio ~1.11)
 */
export function swimmingZone(currentSecPer100m, cssSecPer100m) {
  if (!currentSecPer100m || !cssSecPer100m || cssSecPer100m <= 0) return null
  const ratio = currentSecPer100m / cssSecPer100m
  for (const z of SWIM_ZONE_DEFS) {
    if (ratio >= z.pctMin && ratio < z.pctMax) return z.id
  }
  return 1
}

/**
 * @description Returns all 6 swimming zones with absolute pace boundaries for a given CSS pace.
 * @param {number} cssSecPer100m - CSS in seconds per 100 m
 * @returns {Array<{id, name, pctMin, pctMax, paceMin, paceMax}>} Zone objects with computed pace ranges
 * @source Wakayoshi et al. (1992) — Determination and validity of critical velocity as swimming fatigue threshold
 * @example
 * swimmingZones(90) // => [{id:1, name:'Recovery', paceMin:null, paceMax:null}, ...]
 */
export function swimmingZones(cssSecPer100m) {
  if (!cssSecPer100m || cssSecPer100m <= 0) return []
  return SWIM_ZONE_DEFS.map(z => ({
    ...z,
    paceMin: z.pctMax === Infinity ? null : Math.round(cssSecPer100m * z.pctMin * 10) / 10,
    paceMax: z.pctMax === Infinity ? null : Math.round(cssSecPer100m * z.pctMax * 10) / 10,
  }))
}

// ── Estimated TSS for swimming ────────────────────────────────────────────────
/**
 * @description Estimates swim Training Stress Score (sTSS) using the CSS intensity analogy.
 *   sTSS = (durationMin / 60) × (CSS_pace / current_pace)² × 100
 *   A faster current pace relative to CSS yields a higher intensity factor and sTSS.
 * @param {number} durationMin - Session duration in minutes
 * @param {number} currentSecPer100m - Session average pace in seconds per 100 m
 * @param {number} cssSecPer100m - CSS in seconds per 100 m
 * @returns {number|null} sTSS (rounded integer), or null on invalid input
 * @source Wakayoshi et al. (1992) — Determination and validity of critical velocity as swimming fatigue threshold
 * @example
 * swimTSS(60, 95, 90) // => ~100 (approx; IF close to 0.95)
 */
export function swimTSS(durationMin, currentSecPer100m, cssSecPer100m) {
  if (!durationMin || !currentSecPer100m || !cssSecPer100m) return null
  if (cssSecPer100m <= 0 || currentSecPer100m <= 0) return null
  // Intensity factor = CSS_pace / current_pace (faster current pace → higher IF)
  const IF = cssSecPer100m / currentSecPer100m
  return Math.round((durationMin / 60) * IF * IF * 100)
}
