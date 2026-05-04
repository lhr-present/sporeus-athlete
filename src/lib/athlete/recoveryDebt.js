// ─── recoveryDebt.js — Cumulative TSB-Deficit Tracker (28d window) ──────────
// Sustained negative TSB across weeks accumulates "recovery debt" — a
// freshness-deficit signal distinct from variance-based monotony, total
// inactivity gaps (detrainingDetector), or fitness-slope (fitnessGainRate).
// Walks the full available log to seed the Banister EWMA, then samples the
// trailing 28 days to integrate the negative-TSB area under the curve.
// Cite: Banister 1991; Coggan PMC; Halson 2014 overreaching
// ─────────────────────────────────────────────────────────────────────────────

export const RECOVERY_DEBT_CITATION = 'Banister 1991; Coggan PMC; Halson 2014 overreaching'

// ─── Banister EWMA constants ────────────────────────────────────────────────
const K_CTL = 1 - Math.exp(-1 / 42)
const K_ATL = 1 - Math.exp(-1 / 7)

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDays(laterStr, earlierStr) {
  const a = new Date(laterStr + 'T00:00:00Z').getTime()
  const b = new Date(earlierStr + 'T00:00:00Z').getTime()
  return Math.round((a - b) / 86400000)
}

// ─── Band classification ─────────────────────────────────────────────────────
function bandFor(currentTSB, cumulativeDeficit, maxConsecutiveNegativeDays) {
  if (cumulativeDeficit >= 400 || maxConsecutiveNegativeDays >= 14) return 'overreached'
  if (currentTSB <= -25 || cumulativeDeficit >= 250) return 'fatigued'
  if (currentTSB > -25 && currentTSB < -10 && cumulativeDeficit < 250) return 'building'
  if (currentTSB > 0 && cumulativeDeficit < 50) return 'fresh'
  if (currentTSB >= -10 && cumulativeDeficit < 150) return 'maintaining'
  return 'maintaining'
}

const MESSAGES = {
  fresh: {
    en: 'Fresh — full adaptation window',
    tr: 'Taze — tam adaptasyon penceresi',
  },
  maintaining: {
    en: 'Balanced load — TSB stable',
    tr: 'Dengeli yük — TSB istikrarlı',
  },
  building: {
    en: 'Building fatigue — productive',
    tr: 'Yorgunluk birikimi — verimli',
  },
  fatigued: {
    en: 'Fatigued — manage recovery',
    tr: 'Yorgun — toparlanmayı yönet',
  },
  overreached: {
    en: 'Recovery debt high — taper or rest',
    tr: 'Toparlanma borcu yüksek — taper veya dinlen',
  },
}

const RECOMMENDATIONS = {
  fresh: { en: '', tr: '' },
  maintaining: { en: '', tr: '' },
  building: {
    en: 'Plan a recovery week within 14 days',
    tr: '14 gün içinde bir toparlanma haftası planla',
  },
  fatigued: {
    en: 'Insert 2-3 easy days; protect sleep',
    tr: '2-3 kolay gün ekle; uykuyu koru',
  },
  overreached: {
    en: 'Take 3-5 day recovery block immediately',
    tr: 'Hemen 3-5 günlük toparlanma bloğu al',
  },
}

// ─── detectRecoveryDebt ──────────────────────────────────────────────────────
/**
 * Detect cumulative TSB-deficit over the trailing 28 days.
 *
 * Walks every day from the earliest log date (or today-27, whichever is
 * earlier) to today, summing same-day TSS, then advances the Banister EWMA:
 *   CTL_t = CTL_{t-1} + K_CTL × (TSS_t − CTL_{t-1})
 *   ATL_t = ATL_{t-1} + K_ATL × (TSS_t − ATL_{t-1})
 *   TSB_t = CTL_t − ATL_t
 *
 * Pre-window entries seed the EWMA so CTL is warmed up before debt accounting.
 *
 * @param {Array} log - training_log entries with { date, tss }
 * @param {string} [today] - YYYY-MM-DD reference; deterministic override
 * @returns {{
 *   currentTSB: number,
 *   ctlToday: number,
 *   atlToday: number,
 *   cumulativeDeficit: number,
 *   debtDays: number,
 *   maxConsecutiveNegativeDays: number,
 *   band: 'fresh'|'maintaining'|'building'|'fatigued'|'overreached',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectRecoveryDebt(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    currentTSB: 0,
    ctlToday: 0,
    atlToday: 0,
    cumulativeDeficit: 0,
    debtDays: 0,
    maxConsecutiveNegativeDays: 0,
    band: 'fresh',
    message: { ...MESSAGES.fresh },
    recommendation: { ...RECOMMENDATIONS.fresh },
    reliable: false,
    citation: RECOVERY_DEBT_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  // Aggregate same-day TSS, drop invalid dates
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

  const windowStart = addDaysStr(today, -27)
  const walkStart = minDate < windowStart ? minDate : windowStart
  const totalDays = diffDays(today, walkStart) + 1

  let ctl = 0
  let atl = 0
  // Sample the trailing 28 days only
  const tsbWindow = []
  for (let i = 0; i < totalDays; i++) {
    const ds = addDaysStr(walkStart, i)
    const tss = dailyTSS.get(ds) || 0
    ctl = ctl + K_CTL * (tss - ctl)
    atl = atl + K_ATL * (tss - atl)
    if (ds >= windowStart) tsbWindow.push(ctl - atl)
  }

  const currentTSB = tsbWindow.length > 0 ? tsbWindow[tsbWindow.length - 1] : (ctl - atl)

  let debtDays = 0
  let cumulativeDeficit = 0
  let maxConsecutiveNegativeDays = 0
  let runLen = 0
  for (const tsb of tsbWindow) {
    if (tsb < 0) cumulativeDeficit += -tsb
    if (tsb < -10) {
      debtDays++
      runLen++
      if (runLen > maxConsecutiveNegativeDays) maxConsecutiveNegativeDays = runLen
    } else {
      runLen = 0
    }
  }

  const span = maxDate && minDate ? diffDays(maxDate, minDate) + 1 : 0
  const reliable = span >= 28

  const roundedTSB = Math.round(currentTSB * 10) / 10
  const roundedCTL = Math.round(ctl * 10) / 10
  const roundedATL = Math.round(atl * 10) / 10
  const roundedDeficit = Math.round(cumulativeDeficit)

  const band = bandFor(roundedTSB, roundedDeficit, maxConsecutiveNegativeDays)

  return {
    currentTSB: roundedTSB,
    ctlToday: roundedCTL,
    atlToday: roundedATL,
    cumulativeDeficit: roundedDeficit,
    debtDays,
    maxConsecutiveNegativeDays,
    band,
    message: { ...MESSAGES[band] },
    recommendation: { ...RECOMMENDATIONS[band] },
    reliable,
    citation: RECOVERY_DEBT_CITATION,
  }
}
