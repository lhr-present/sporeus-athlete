// ─── trainingMonotonyStrain.js — Foster Monotony & Strain Detector (7d) ─────
// Computes Foster's training monotony (mean/stdev of daily TSS) and strain
// (week-total × monotony) over a trailing 7-day window. Classic overtraining-
// risk signal that complements ACWR — uniform high loads with little day-to-
// day variation predict overuse injury and illness.
// Cite: Foster 2001 (monotony/strain method)
// ─────────────────────────────────────────────────────────────────────────────

export const MONOTONY_STRAIN_CITATION = 'Foster 2001 monotony/strain'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Band classification (Foster 2001 thresholds) ───────────────────────────
function bandFor(monotony, strain) {
  if (monotony >= 2.0) return 'high'
  if (strain > 6000) return 'high'
  if (monotony >= 1.5) return 'moderate'
  return 'low'
}

const MESSAGES = {
  low: {
    en: 'Healthy training variability',
    tr: 'Sağlıklı antrenman çeşitliliği',
  },
  moderate: {
    en: 'Monotony rising — vary intensity',
    tr: 'Monotonluk yükseliyor — yoğunluğu çeşitlendir',
  },
  high: {
    en: 'Overtraining risk — add a recovery day',
    tr: 'Aşırı antrenman riski — bir toparlanma günü ekle',
  },
}

const RECOMMENDATIONS = {
  low: { en: '', tr: '' },
  moderate: {
    en: 'Insert one easy or off day this week to break the pattern',
    tr: 'Bu hafta bir kolay veya tam dinlenme günü ekleyerek monotonluğu kır',
  },
  high: {
    en: 'Schedule a full recovery day within 48h',
    tr: '48 saat içinde tam bir toparlanma günü planla',
  },
}

// ─── detectMonotonyStrain ────────────────────────────────────────────────────
/**
 * Detect Foster monotony and strain over the trailing 7 days.
 *
 * monotony = mean(daily_TSS) / stdev(daily_TSS)  (sample stdev, n-1)
 * strain   = sum(daily_TSS) × monotony
 *
 * Daily TSS = sum of all entries on that date. Days within the 7-day window
 * with no logged training count as 0 TSS (rest is part of the variability
 * signal in Foster's method).
 *
 * Bands:
 *   low      monotony < 1.5
 *   moderate 1.5 ≤ monotony < 2.0
 *   high     monotony ≥ 2.0  (also high if strain > 6000)
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   monotony: number,
 *   strain: number,
 *   weekTotalTSS: number,
 *   daysWithLoad: number,
 *   band: 'low'|'moderate'|'high',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectMonotonyStrain(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    monotony: 0,
    strain: 0,
    weekTotalTSS: 0,
    daysWithLoad: 0,
    band: 'low',
    message: { ...MESSAGES.low },
    recommendation: { ...RECOMMENDATIONS.low },
    reliable: false,
    citation: MONOTONY_STRAIN_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  const start7 = addDaysStr(today, -6)

  // Build the 7-day window of dates: today-6 .. today
  const dates = []
  for (let i = 6; i >= 0; i--) dates.push(addDaysStr(today, -i))

  // Aggregate daily TSS within window. Same-day entries sum.
  const dailyTSS = new Map()
  for (const d of dates) dailyTSS.set(d, 0)

  const distinctLoggedDays = new Set()
  for (const e of log) {
    const d = e?.date
    if (typeof d !== 'string' || d.length < 10) continue
    const ds = d.slice(0, 10)
    if (ds < start7 || ds > today) continue
    const tss = Number(e?.tss) || 0
    dailyTSS.set(ds, (dailyTSS.get(ds) || 0) + tss)
    distinctLoggedDays.add(ds)
  }

  const tssValues = dates.map(d => dailyTSS.get(d) || 0)
  const n = tssValues.length // always 7
  const sum = tssValues.reduce((s, v) => s + v, 0)
  const mean = sum / n

  let monotony = 0
  if (n >= 2) {
    let sqSum = 0
    for (const v of tssValues) {
      const diff = v - mean
      sqSum += diff * diff
    }
    // Foster (2001) monotony uses the population stdev (/n), matching the
    // app's canonical computeMonotony in src/lib/trainingLoad.js.
    const variance = sqSum / n
    const stdev = Math.sqrt(variance)
    if (stdev > 0) monotony = mean / stdev
  }

  const strain = sum * monotony
  const daysWithLoad = tssValues.filter(v => v > 0).length
  const band = bandFor(monotony, strain)
  const reliable = distinctLoggedDays.size >= 5

  return {
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(strain),
    weekTotalTSS: Math.round(sum),
    daysWithLoad,
    band,
    message: { ...MESSAGES[band] },
    recommendation: { ...RECOMMENDATIONS[band] },
    reliable,
    citation: MONOTONY_STRAIN_CITATION,
  }
}
