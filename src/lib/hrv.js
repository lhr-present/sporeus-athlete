// ─── hrv.js — HRV processing: RMSSD, lnRMSSD, DFA-α1, readiness ──────────
// Pure JS — no React, no DOM, no localStorage.
// DFA-α1: Gronwald et al. 2019 (Front. Physiol.) short-scale (n=4–16).

// ─── cleanRRIntervals ────────────────────────────────────────────────────────
// Removes physiologically impossible beats (< 300 ms or > 2000 ms), detects
// ectopic beats (|RR − local5beatMean| > 20 %), and linearly interpolates.
//
// @param {number[]} rrArray - raw RR intervals in ms
// @returns {{ cleaned: number[], ectopicCount: number, ectopicPct: number }}
export function cleanRRIntervals(rrArray) {
  if (!rrArray || rrArray.length === 0) {
    return { cleaned: [], ectopicCount: 0, ectopicPct: 0 }
  }

  // Step 1: Remove impossible values
  const possible = rrArray.filter(v => v >= 300 && v <= 2000)
  if (possible.length === 0) {
    return { cleaned: [], ectopicCount: rrArray.length, ectopicPct: 100 }
  }

  const N = possible.length

  // Step 2: Ectopic detection — 9-beat local mean (±4 neighbours, excluding self).
  // Wide window so a single spike does not contaminate neighbours' means.
  const ectopic = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    let sum = 0, count = 0
    for (let j = Math.max(0, i - 4); j <= Math.min(N - 1, i + 4); j++) {
      if (j !== i) { sum += possible[j]; count++ }
    }
    if (count === 0) continue
    const localMean = sum / count
    if (Math.abs(possible[i] - localMean) > 0.2 * localMean) ectopic[i] = 1
  }

  // Step 3: Linear interpolation over ectopic runs
  const cleaned = [...possible]
  for (let i = 0; i < N; i++) {
    if (!ectopic[i]) continue
    let prev = i - 1, next = i + 1
    while (prev >= 0 && ectopic[prev]) prev--
    while (next < N && ectopic[next])  next++
    if (prev >= 0 && next < N) {
      cleaned[i] = cleaned[prev] + (cleaned[next] - cleaned[prev]) * (i - prev) / (next - prev)
    } else if (prev >= 0) {
      cleaned[i] = cleaned[prev]
    } else if (next < N) {
      cleaned[i] = cleaned[next]
    }
  }

  const ectopicCount = ectopic.reduce((s, v) => s + v, 0)
  return {
    cleaned,
    ectopicCount,
    ectopicPct: Math.round(ectopicCount / N * 1000) / 10,
  }
}

// ─── calculateRMSSD ──────────────────────────────────────────────────────────
// Root Mean Square of Successive Differences.
// @param {number[]} nn - cleaned NN intervals in ms
// @returns {number} RMSSD in ms (0 if < 2 intervals)
export function calculateRMSSD(nn) {
  if (!nn || nn.length < 2) return 0
  let sumSq = 0
  for (let i = 1; i < nn.length; i++) {
    const d = nn[i] - nn[i - 1]
    sumSq += d * d
  }
  return Math.round(Math.sqrt(sumSq / (nn.length - 1)) * 10) / 10
}

// ─── calculateLnRMSSD ────────────────────────────────────────────────────────
// Natural log of RMSSD — more normally distributed for trend tracking.
// @param {number} rmssd - RMSSD in ms
// @returns {number} lnRMSSD (0 for invalid input)
export function calculateLnRMSSD(rmssd) {
  if (!rmssd || rmssd <= 0) return 0
  return Math.round(Math.log(rmssd) * 1000) / 1000
}

// ─── scoreReadiness ──────────────────────────────────────────────────────────
// Compare today's lnRMSSD to a rolling 7-day baseline.
// Zones: >102% = elevated (green), 97–102% = normal (yellow), <97% = low (red).
//
// @param {number} todayLnRMSSD
// @param {number} baseline7d - mean lnRMSSD of previous 7 days
// @returns {{ score:1-10, status, color, recommendation, pct }} | null
export function scoreReadiness(todayLnRMSSD, baseline7d) {
  if (!baseline7d || baseline7d <= 0 || !todayLnRMSSD) return null

  const pct = (todayLnRMSSD / baseline7d) * 100

  let score, status, color, recommendation
  if (pct > 102) {
    score          = Math.min(10, Math.round(8 + (pct - 102) / 2))
    status         = 'elevated'
    color          = '#5bc25b'
    recommendation = 'High intensity OK'
  } else if (pct >= 97) {
    score          = Math.round(5 + (pct - 97) / (102 - 97) * 3)
    status         = 'normal'
    color          = '#f5c542'
    recommendation = 'Normal training'
  } else {
    score          = Math.max(1, Math.round(5 * Math.max(0, pct - 85) / (97 - 85)))
    status         = 'suppressed'
    color          = '#e03030'
    recommendation = 'Easy day only'
  }

  return { score, status, color, recommendation, pct: Math.round(pct) }
}

// ─── calculateDFAAlpha1 ───────────────────────────────────────────────────────
// Detrended Fluctuation Analysis — short-scale α₁ (n = 4 to 16 beats).
// Gronwald et al. 2019, Front. Physiol.: DFA-α1 ≈ 0.75 at LT1.
//   α1 > 0.75 → below aerobic threshold (correlated HRV fluctuations)
//   α1 ≈ 0.75 → at LT1
//   α1 < 0.75 → above LT1, approaching LT2
//
// At rest (morning HRV), α1 > 1.0 is normal (high parasympathetic tone).
//
// Requires ≥ 300 clean NN intervals (≈ 5 min at 60 bpm).
// Returns null if insufficient data or degenerate signal.
//
// @param {number[]} nn - cleaned NN intervals in ms
// @returns {number|null} DFA-α1 (rounded to 3 decimal places)
export function calculateDFAAlpha1(nn) {
  const N = (nn || []).length
  if (N < 300) return null

  // ── 1. Integrate (profile) ──────────────────────────────────────────────
  // y[k] = Σ_{i=0}^{k} (nn[i] − mean_nn)
  const mean = nn.reduce((s, v) => s + v, 0) / N
  const y = new Float64Array(N)
  y[0] = nn[0] - mean
  for (let i = 1; i < N; i++) y[i] = y[i - 1] + (nn[i] - mean)

  // ── 2. F(n) for each scale n = 4..16 ───────────────────────────────────
  // For each box of length n, fit a linear trend via OLS, then compute
  // the RMS of residuals across all boxes: F(n) = √(mean squared residual)
  //
  // For x = 0..n−1:
  //   Σx  = n(n−1)/2
  //   Σx² = n(n−1)(2n−1)/6
  //   denom = n·Σx² − (Σx)² = n²(n²−1)/12  (constant per scale)
  const scales = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
  const logN = [], logF = []

  for (const n of scales) {
    const numBoxes = Math.floor(N / n)
    if (numBoxes === 0) continue

    const xSum   = n * (n - 1) / 2
    const denom  = n * n * (n * n - 1) / 12   // n²(n²−1)/12

    if (Math.abs(denom) < 1e-12) continue      // n=1 guard (never happens for n≥4)

    let sumSq = 0, count = 0
    for (let box = 0; box < numBoxes; box++) {
      const s = box * n
      let ySum = 0, xySum = 0
      for (let i = 0; i < n; i++) {
        ySum  += y[s + i]
        xySum += i * y[s + i]
      }
      const slope     = (n * xySum - xSum * ySum) / denom
      const intercept = (ySum - slope * xSum) / n
      for (let i = 0; i < n; i++) {
        const res = y[s + i] - (intercept + slope * i)
        sumSq += res * res
        count++
      }
    }

    const Fn = count > 0 ? Math.sqrt(sumSq / count) : 0
    if (Fn > 0) {
      logN.push(Math.log(n))
      logF.push(Math.log(Fn))
    }
  }

  // ── 3. Log-log OLS slope = α₁ ───────────────────────────────────────────
  const m = logN.length
  if (m < 3) return null

  const xm = logN.reduce((s, v) => s + v, 0) / m
  const ym = logF.reduce((s, v) => s + v, 0) / m
  let num = 0, den = 0
  for (let i = 0; i < m; i++) {
    num += (logN[i] - xm) * (logF[i] - ym)
    den += (logN[i] - xm) ** 2
  }

  if (den < 1e-12) return null
  return Math.round((num / den) * 1000) / 1000
}

// ─── computeHRVReadiness ──────────────────────────────────────────────────────
// Returns a readiness score and band from today's RMSSD vs 28-day baseline.
// score = 100 × (recentRMSSD / baselineRMSSD)
// band thresholds: > 110 → High, 90-110 → Normal, < 90 → Low
export function computeHRVReadiness(recentRMSSD, baselineRMSSD, baselineSD = 0) {
  if (recentRMSSD == null || baselineRMSSD == null || baselineRMSSD <= 0) return null
  const score = Math.round(recentRMSSD / baselineRMSSD * 100)
  let band, advice
  if (score > 110) {
    band   = 'High'
    advice = 'CNS well recovered — proceed with planned hard session.'
  } else if (score >= 90) {
    band   = 'Normal'
    advice = 'Readiness normal — proceed as planned.'
  } else {
    band   = 'Low'
    advice = 'HRV suppressed — consider replacing hard session with easy aerobic work.'
  }
  const sdBand = baselineSD > 0
    ? { lower: Math.round(baselineRMSSD - baselineSD), upper: Math.round(baselineRMSSD + baselineSD) }
    : null
  return { score, band, advice, sdBand }
}

// ─── getAerobicThresholdFromDFA ───────────────────────────────────────────────
// Gronwald 2020: DFA-α1 < 0.75 marks aerobic threshold crossing.
// Expects array of { hr: number, dfa1: number } in ascending HR order.
// Returns { threshold_hr, confidence: 'high'|'low' } or null.
export function getAerobicThresholdFromDFA(dfa1Series) {
  if (!Array.isArray(dfa1Series) || dfa1Series.length < 3) return null
  const valid = dfa1Series.filter(p => typeof p.hr === 'number' && typeof p.dfa1 === 'number')
  if (valid.length < 3) return null

  // Find first point where dfa1 drops below 0.75
  let crossingIdx = -1
  for (let i = 0; i < valid.length; i++) {
    if (valid[i].dfa1 < 0.75) { crossingIdx = i; break }
  }
  if (crossingIdx < 0) return null

  const threshold_hr = valid[crossingIdx].hr

  // Confidence: 'high' if the value just before crossing is > 0.80 (clean drop)
  // 'low' if it was already hovering near 0.75 (gradual transition)
  const prevDFA = crossingIdx > 0 ? valid[crossingIdx - 1].dfa1 : null
  const confidence = prevDFA !== null && prevDFA > 0.80 ? 'high' : 'low'

  return { threshold_hr, confidence }
}

// ─── parsePolarHRM ────────────────────────────────────────────────────────────
// Parse Polar .hrm text file and extract RR intervals (ms) from [HRData].
// Physiological range filter: 300–2000 ms distinguishes RR from HR bpm.
//
// @param {string} fileText - contents of .hrm file
// @returns {number[]} array of RR intervals in ms
export function parsePolarHRM(fileText) {
  if (!fileText) return []
  const lines = fileText.split(/\r?\n/)
  let inHRData = false
  const rrValues = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Section header detection
    if (trimmed.startsWith('[')) {
      inHRData = trimmed.toLowerCase() === '[hrdata]'
      continue
    }

    if (!inHRData) continue

    // Parse all whitespace/comma separated tokens on the line
    for (const tok of trimmed.split(/[\s\t,]+/)) {
      const n = parseFloat(tok)
      // RR intervals: 300–2000 ms. HR bpm: 30–220 (excluded by range).
      if (!isNaN(n) && n >= 300 && n <= 2000) rrValues.push(Math.round(n))
    }
  }

  return rrValues
}
