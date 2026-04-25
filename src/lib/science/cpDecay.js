// Critical Power decay/growth tracking over time.
// Sources:
//   Poole D.C. et al. (2016) Critical power: An important fatigue threshold in exercise physiology.
//     Med Sci Sports Exerc 48(11):2320–2334.
//   Vanhatalo A., Jones A.M., Burnley M. (2011) Application of critical power in sport.
//     Int J Sports Physiol Perform 6(1):128–136.

const CITATION = 'Poole D.C. et al. (2016) Med Sci Sports Exerc 48(11):2320-2334; Vanhatalo et al. (2011) IJSPP 6(1):128-136'

export function extractCPHistory(testResults = []) {
  return testResults
    .filter(entry => {
      const type = (entry.type || '').toLowerCase()
      const isCP = type === 'cp_test' || type === 'cp' || type === 'critical_power'
      const cpVal = entry.cp > 0 || entry.value > 0
      return isCP && cpVal
    })
    .map(entry => ({
      date:   entry.date,
      cp:     entry.cp > 0 ? entry.cp : entry.value,
      wPrime: entry.wPrime ?? entry.w_prime ?? null,
    }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
}

// OLS slope using the standard Σxy / Σx² centred method (same pattern as vdotTrend.js)
function _olsSlope(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-12) return 0
  return (n * sumXY - sumX * sumY) / denom
}

export function computeCPDecayIndex(testResults = [], windowWeeks = 12) {
  const history = extractCPHistory(testResults)

  if (history.length < 2) {
    return {
      history,
      slope_w_per_week:   null,
      cpCurrent:          history.length === 1 ? history[0].cp : null,
      cpPeak12w:          null,
      decayPct:           null,
      classification:     'insufficient_data',
      wPrimeStatus:       null,
      recommendation:     {
        en: 'Log at least 2 CP tests to track critical power trend.',
        tr: 'KP trendini takip etmek için en az 2 KP testi kaydedin.',
      },
      citation: CITATION,
    }
  }

  // OLS for CP slope (days since first entry → W/day, then ×7 → W/week)
  const t0 = new Date(history[0].date).getTime()
  const xs  = history.map(h => (new Date(h.date).getTime() - t0) / 86400000)
  const ys  = history.map(h => h.cp)
  const slopePerDay  = _olsSlope(xs, ys)
  const slope_w_per_week = slopePerDay !== null ? slopePerDay * 7 : null

  // Current CP = most recent entry
  const cpCurrent = history[history.length - 1].cp

  // 12-week window peak
  const windowMs  = windowWeeks * 7 * 86400000
  const cutoff    = new Date(history[history.length - 1].date).getTime() - windowMs
  const windowEntries = history.filter(h => new Date(h.date).getTime() >= cutoff)
  const cpPeak12w = windowEntries.length >= 1
    ? Math.max(...windowEntries.map(h => h.cp))
    : cpCurrent
  const decayPct = windowEntries.length >= 2
    ? (cpPeak12w - cpCurrent) / cpPeak12w * 100
    : 0

  // Classification
  let classification
  if (slope_w_per_week > 0.5) {
    classification = 'building'
  } else if (slope_w_per_week < -0.5 && decayPct > 5) {
    classification = 'detraining'
  } else {
    classification = 'maintaining'
  }

  // W' status — OLS on entries that have wPrime
  const wpEntries = history.filter(h => h.wPrime != null && h.wPrime > 0)
  let wPrimeStatus = null
  if (wpEntries.length >= 2) {
    const wpT0 = new Date(wpEntries[0].date).getTime()
    const wpXs = wpEntries.map(h => (new Date(h.date).getTime() - wpT0) / 86400000)
    const wpYs = wpEntries.map(h => h.wPrime)
    const wpSlope = _olsSlope(wpXs, wpYs) // J/day
    const wpSlopePerWeek = wpSlope * 7
    if (wpSlopePerWeek > 100) {
      wPrimeStatus = 'expanding'
    } else if (wpSlopePerWeek < -100) {
      wPrimeStatus = 'contracting'
    } else {
      wPrimeStatus = 'stable'
    }
  }

  // Recommendation
  const recMap = {
    building: {
      en: 'CP is growing — sustained high-intensity work is paying off.',
      tr: 'KP artıyor — yüksek yoğunluklu antrenman meyvesini veriyor.',
    },
    maintaining: {
      en: 'CP stable — consider a focused CP-development block.',
      tr: 'KP stabil — odaklı bir KP geliştirme bloğu düşünün.',
    },
    detraining: {
      en: `CP has dropped ${decayPct.toFixed(1)}% from 12-week peak — schedule a CP test and review load.`,
      tr: `KP, 12 haftalık zirvenin ${decayPct.toFixed(1)}% altında — KP testi planlayın.`,
    },
  }
  const recommendation = recMap[classification]

  return {
    history,
    slope_w_per_week,
    cpCurrent,
    cpPeak12w,
    decayPct,
    classification,
    wPrimeStatus,
    recommendation,
    citation: CITATION,
  }
}

export function cpTrendSparkline(history = [], weeks = 12) {
  if (!history.length) return []
  const cutoffMs = weeks * 7 * 86400000
  const latestMs = new Date(history[history.length - 1].date).getTime()
  const cutoff   = latestMs - cutoffMs
  const filtered = history.filter(h => new Date(h.date).getTime() >= cutoff)
  return filtered.length ? filtered : [...history]
}
