// ─── src/lib/sport/swimming.js — Swimming sport-science engine ────────────────
// CSS (Critical Swim Speed), T-pace, zone system.

// ── Critical Swim Speed (CSS) ─────────────────────────────────────────────────
// CSS (m/s) = (d2 − d1) / (t2 − t1)
// Standard protocol: 400m TT + 200m TT (or 1500m + 400m)
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

// CSS expressed as seconds per 100m (T-pace format)
export function cssToSecPer100m(cssMs) {
  if (!cssMs || cssMs <= 0) return null
  return Math.round((100 / cssMs) * 10) / 10
}

// ── T-pace ────────────────────────────────────────────────────────────────────
// T-pace = threshold pace ≈ CSS in most models.
// Can also be estimated from a single 1000m or 1500m TT.
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

// Returns zone number (1–6) for a given pace (sec/100m) vs CSS pace.
export function swimmingZone(currentSecPer100m, cssSecPer100m) {
  if (!currentSecPer100m || !cssSecPer100m || cssSecPer100m <= 0) return null
  const ratio = currentSecPer100m / cssSecPer100m
  for (const z of SWIM_ZONE_DEFS) {
    if (ratio >= z.pctMin && ratio < z.pctMax) return z.id
  }
  return 1
}

// Returns full zone table with pace boundaries
export function swimmingZones(cssSecPer100m) {
  if (!cssSecPer100m || cssSecPer100m <= 0) return []
  return SWIM_ZONE_DEFS.map(z => ({
    ...z,
    paceMin: z.pctMax === Infinity ? null : Math.round(cssSecPer100m * z.pctMin * 10) / 10,
    paceMax: z.pctMax === Infinity ? null : Math.round(cssSecPer100m * z.pctMax * 10) / 10,
  }))
}

// ── Estimated TSS for swimming ────────────────────────────────────────────────
// Swim-TSS via CSS analogy: sTSS = (duration_min / 60) × (pace / CSS_pace)^2 × 100
// Lower pace ratio = harder effort = higher sTSS
export function swimTSS(durationMin, currentSecPer100m, cssSecPer100m) {
  if (!durationMin || !currentSecPer100m || !cssSecPer100m) return null
  if (cssSecPer100m <= 0 || currentSecPer100m <= 0) return null
  // Intensity factor = CSS_pace / current_pace (faster current pace → higher IF)
  const IF = cssSecPer100m / currentSecPer100m
  return Math.round((durationMin / 60) * IF * IF * 100)
}
