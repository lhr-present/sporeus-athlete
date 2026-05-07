// ─── deloadCadence.js — 3:1 Build/Deload Cadence Detector (12w window) ──────
// Classic block periodization prescribes 3 weeks of progressive load + 1
// recovery week. Skipping deloads accumulates fatigue; deloading too often
// prevents CTL gain. This pattern detector walks 12 trailing weeks of TSS
// and audits whether the 3:1 cadence has been respected.
//
// Distinct from recoveryDebt (right-now TSB integral), detrainingDetector
// (illness/travel gaps), supercompensationWindow (peak readiness window),
// and trainingPhase (base/build/peak classifier).
//
// Cite: Bompa & Haff 2009 periodization; Issurin 2010 block periodization
// ─────────────────────────────────────────────────────────────────────────────

export const DELOAD_CADENCE_CITATION =
  'Bompa & Haff 2009 periodization; Issurin 2010 block periodization'

const WEEKS_TARGET = 12
const DELOAD_RATIO = 0.65
const MIN_WEEKS_RELIABLE = 8
const MIN_MEAN_TSS_RELIABLE = 50

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const MESSAGES = {
  'on-schedule': {
    en: '3:1 cadence on track — last deload {n}w ago',
    tr: '3:1 ritmi yolunda — son deload {n}h önce',
  },
  overdue: {
    en: '{n}w since last deload — schedule one this week',
    tr: 'Son deloaddan {n}h geçti — bu hafta planla',
  },
  'too-frequent': {
    en: 'Deloading too often — protect 3-week build blocks',
    tr: 'Çok sık deload — 3-haftalık yapım bloğunu koru',
  },
  'no-pattern': {
    en: 'No deload pattern detected',
    tr: 'Deload ritmi tespit edilmedi',
  },
}

const RECOMMENDATIONS = {
  'on-schedule': { en: '', tr: '' },
  overdue: {
    en: "Cut next week's volume by 40-50%; intensity unchanged",
    tr: 'Önümüzdeki hafta hacmi %40-50 azalt; yoğunluk aynı',
  },
  'too-frequent': {
    en: 'Skip the next planned deload; build for 3 weeks',
    tr: 'Sıradaki deloadu atla; 3 hafta yap',
  },
  'no-pattern': {
    en: 'Plan a 3-week build + 1-week deload cycle',
    tr: '3-hafta yapım + 1-hafta deload döngüsü planla',
  },
}

function fillMessage(tpl, n) {
  return tpl.replace('{n}', String(n))
}

function bandFor(actualDeloads, deloadRatio, weeksSinceLastDeload) {
  if (actualDeloads === 0) return 'no-pattern'
  if (weeksSinceLastDeload != null && weeksSinceLastDeload > 4) return 'overdue'
  if (deloadRatio > 1.5) return 'too-frequent'
  if (deloadRatio >= 0.75 && weeksSinceLastDeload != null && weeksSinceLastDeload <= 4) {
    return 'on-schedule'
  }
  return 'no-pattern'
}

// ─── detectDeloadCadence ─────────────────────────────────────────────────────
/**
 * Audit 3:1 build/deload cadence over the trailing 12 weeks.
 *
 * Aggregates same-day TSS, splits the trailing 12-week window into 7-day
 * buckets ending on the most recent Sunday at/before `today`. A bucket is
 * "deload" when its weekly TSS ≤ mean × 0.65. Partial weeks at the start of
 * a short log are dropped (require all 7 days inside the log span).
 *
 * @param {Array} log - training_log entries with { date, tss }
 * @param {string} [today] - YYYY-MM-DD reference; deterministic override
 * @returns {{
 *   weeksAnalyzed: number,
 *   meanWeekTSS: number,
 *   actualDeloads: number,
 *   expectedDeloads: number,
 *   deloadRatio: number,
 *   weeksSinceLastDeload: number|null,
 *   deloadWeekTSSValues: number[],
 *   band: 'on-schedule'|'overdue'|'too-frequent'|'no-pattern',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectDeloadCadence(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    weeksAnalyzed: 0,
    meanWeekTSS: 0,
    actualDeloads: 0,
    expectedDeloads: 0,
    deloadRatio: 0,
    weeksSinceLastDeload: null,
    deloadWeekTSSValues: [],
    band: 'no-pattern',
    message: { ...MESSAGES['no-pattern'] },
    recommendation: { ...RECOMMENDATIONS['no-pattern'] },
    reliable: false,
    citation: DELOAD_CADENCE_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  const dailyTSS = new Map()
  let minDate = null
  let maxDate = null
  for (const e of log) {
    const d = e?.date
    if (typeof d !== 'string' || d.length < 10) continue
    const ds = d.slice(0, 10)
    if (ds > today) continue
    const tss = Number(e?.tss)
    const t = Number.isFinite(tss) ? tss : 0
    dailyTSS.set(ds, (dailyTSS.get(ds) || 0) + t)
    if (minDate == null || ds < minDate) minDate = ds
    if (maxDate == null || ds > maxDate) maxDate = ds
  }

  if (minDate == null) return empty

  const todayDow = new Date(today + 'T00:00:00Z').getUTCDay()
  const lastSunday = todayDow === 0 ? today : addDaysStr(today, -todayDow)

  // Walk back WEEKS_TARGET weeks, week 0 = most recent week ending lastSunday
  const weekTSSValues = []
  for (let w = 0; w < WEEKS_TARGET; w++) {
    const weekEnd = addDaysStr(lastSunday, -7 * w)
    const weekStart = addDaysStr(weekEnd, -6)
    if (weekStart < minDate) break
    if (weekEnd > today) continue
    let sum = 0
    for (let d = 0; d < 7; d++) {
      const ds = addDaysStr(weekStart, d)
      sum += dailyTSS.get(ds) || 0
    }
    weekTSSValues.push(sum)
  }

  const weeksAnalyzed = weekTSSValues.length

  if (weeksAnalyzed === 0) return empty

  const meanWeekTSS = weekTSSValues.reduce((a, b) => a + b, 0) / weeksAnalyzed
  const threshold = meanWeekTSS * DELOAD_RATIO

  const deloadIndices = []
  for (let i = 0; i < weekTSSValues.length; i++) {
    if (weekTSSValues[i] <= threshold && meanWeekTSS > 0) deloadIndices.push(i)
  }

  const actualDeloads = deloadIndices.length
  const expectedDeloads = Math.floor(weeksAnalyzed / 4)
  const deloadRatio = expectedDeloads > 0 ? actualDeloads / expectedDeloads : 0

  const weeksSinceLastDeload = deloadIndices.length > 0 ? deloadIndices[0] : null

  const deloadWeekTSSValues = deloadIndices
    .slice(0, 5)
    .map((i) => Math.round(weekTSSValues[i] * 10) / 10)

  const band = bandFor(actualDeloads, deloadRatio, weeksSinceLastDeload)

  const reliable =
    weeksAnalyzed >= MIN_WEEKS_RELIABLE && meanWeekTSS > MIN_MEAN_TSS_RELIABLE

  const nForMsg = weeksSinceLastDeload == null ? 0 : weeksSinceLastDeload
  const msgTpl = MESSAGES[band]
  const message =
    band === 'no-pattern' || band === 'too-frequent'
      ? { ...msgTpl }
      : { en: fillMessage(msgTpl.en, nForMsg), tr: fillMessage(msgTpl.tr, nForMsg) }

  return {
    weeksAnalyzed,
    meanWeekTSS: Math.round(meanWeekTSS * 10) / 10,
    actualDeloads,
    expectedDeloads,
    deloadRatio: Math.round(deloadRatio * 100) / 100,
    weeksSinceLastDeload,
    deloadWeekTSSValues,
    band,
    message,
    recommendation: { ...RECOMMENDATIONS[band] },
    reliable,
    citation: DELOAD_CADENCE_CITATION,
  }
}
