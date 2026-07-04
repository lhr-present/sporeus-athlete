// supabase/functions/_shared/streamScience.ts — pure 1-Hz stream science for
// the Strava streams-enrichment path (v9.466). Every function is a direct port
// of an existing, tested implementation — do NOT "improve" the math here
// without changing the source of truth too:
//   normalizedPower / computeTSS  → src/lib/formulas.js + parse-activity
//   decouplingPct                 → parse-activity (Friel method, 10% warmup)
//   hrZone / zonesFromHR          → parse-activity zone distribution
//   wPrimeExhausted               → src/lib/formulas.js computeWPrime (Skiba 2012)
// Compute-and-discard: only scalars are stored (matches parse-activity); raw
// series are never persisted.

// Coggan 2003: 30s rolling mean → 4th-power mean → 0.25 root.
export function normalizedPower(powers: number[]): number {
  if (!powers || powers.length < 30) return 0
  const W = 30
  const rolling: number[] = []
  let sum = 0
  for (let i = 0; i < powers.length; i++) {
    sum += powers[i]
    if (i >= W) sum -= powers[i - W]
    if (i >= W - 1) rolling.push(sum / W)
  }
  const mean4 = rolling.reduce((s, v) => s + Math.pow(v, 4), 0) / rolling.length
  return Math.round(Math.pow(mean4, 0.25))
}

// Friel aerobic decoupling: drop 10% warmup, split halves, compare effort:HR
// ratios. ≥120 usable samples required. Positive = HR drifted up for the same
// effort; negative (downward drift) is valid.
export function decouplingPct(hrSeries: number[], effortSeries: number[]): number | null {
  if (!hrSeries.length || !effortSeries.length) return null
  const warmup    = Math.floor(hrSeries.length * 0.1)
  const usableHR  = hrSeries.slice(warmup)
  const usableEff = effortSeries.slice(warmup)
  if (usableHR.length < 120) return null
  const mid = Math.floor(usableHR.length / 2)
  const ratio = (hr: number[], eff: number[]) => {
    const avgEff = eff.reduce((s, v) => s + v, 0) / eff.length || 0.001
    const avgHR  = hr.reduce((s, v) => s + v, 0)  / hr.length  || 0.001
    return avgEff / avgHR
  }
  const r1 = ratio(usableHR.slice(0, mid), usableEff.slice(0, mid))
  const r2 = ratio(usableHR.slice(mid), usableEff.slice(mid))
  if (!r1) return null
  return Math.round(((r1 - r2) / r1) * 1000) / 10
}

function hrZone(hr: number, maxHR: number): number {
  const pct = hr / maxHR
  if (pct < 0.60) return 0
  if (pct < 0.70) return 1
  if (pct < 0.80) return 2
  if (pct < 0.90) return 3
  return 4
}

// Real 5-zone percentage distribution from an HR stream (replaces the
// single-band estimateZones smear once streams are available).
export function zonesFromHR(hrSeries: number[], maxHR: number | null): number[] | null {
  const valid = hrSeries.filter((h) => h > 0)
  if (!valid.length || !maxHR || maxHR <= 0) return null
  const zoneCounts = [0, 0, 0, 0, 0]
  valid.forEach((hr) => zoneCounts[hrZone(hr, maxHR)]++)
  const total = valid.length
  return zoneCounts.map((c) => Math.round((c / total) * 100))
}

// Skiba 2012 differential W′-balance — exhaustion flag only (the badge is the
// consumer; the full series is never stored). Port of formulas.js computeWPrime.
export function wPrimeExhausted(powers: number[], cp: number, wPrimeMax: number): boolean {
  if (!powers || powers.length < 30 || !cp || !wPrimeMax) return false
  let w = wPrimeMax
  const below = powers.filter((p) => p < cp)
  const avgBelowCP = below.length ? below.reduce((s, v) => s + v, 0) / below.length : cp * 0.6
  const tau = 546 * Math.exp(-0.01 * (cp - avgBelowCP)) + 316
  for (const p of powers) {
    if (p >= cp) {
      w = Math.max(0, w - (p - cp))
      if (w <= 0) return true
    } else {
      w = wPrimeMax - (wPrimeMax - w) * Math.exp(-1 / tau)
    }
  }
  return false
}
