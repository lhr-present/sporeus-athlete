// ─── supercompensationWindow.js — Peak Readiness Window Detector ────────────
// Inverse of recoveryDebt: rather than warning of accumulated TSB deficit,
// surfaces the peak-readiness window after a deload — when CTL holds while
// ATL drops, TSB rises sharply, and the athlete is unusually adapted-and-
// fresh. Walks the full available log to seed Banister EWMA, then samples
// the trailing 21 days to detect the deload signature and quantify how
// many days remain in the supercompensation window.
// Cite: Foster 1996 supercompensation; Costill 1991; Mujika 2010 freshness
// ─────────────────────────────────────────────────────────────────────────────

export const SUPERCOMP_WINDOW_CITATION =
  'Foster 1996 supercompensation; Costill 1991; Mujika 2010 freshness'

// ─── Banister EWMA constants ────────────────────────────────────────────────
const K_CTL = 1 - Math.exp(-1 / 42)
const K_ATL = 1 - Math.exp(-1 / 7)

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
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

// ─── Band classification ────────────────────────────────────────────────────
function bandFor(currentTSB, ctlToday, tsbRise7d) {
  if (currentTSB > 15 && ctlToday > 0) return 'peak'
  if (currentTSB > 5 && tsbRise7d >= 15) return 'opportunity'
  if (currentTSB > 0) return 'available'
  // 'building' requires a meaningful rise — slow CTL drift under sustained
  // load can produce a tiny upward tick that doesn't represent a real
  // recovery rebound, so floor the rise threshold at +10.
  if (currentTSB <= 0 && tsbRise7d >= 10) return 'building'
  return 'closed'
}

const MESSAGES = {
  peak: {
    en: 'Peak readiness — {n} days left in window',
    tr: 'Zirve hazırlık — penceren {n} gün',
  },
  opportunity: {
    en: 'Opportunity window opening',
    tr: 'Fırsat penceresi açılıyor',
  },
  available: {
    en: 'Modest freshness window',
    tr: 'Hafif tazelik penceresi',
  },
  closed: {
    en: 'No supercompensation window',
    tr: 'Süperkompansasyon penceresi yok',
  },
  building: {
    en: 'Window approaching',
    tr: 'Pencere yaklaşıyor',
  },
}

const RECOMMENDATIONS = {
  peak: {
    en: 'Schedule key session, race, or fitness test in next {n} days',
    tr: 'Önümüzdeki {n} gün içinde kilit seans, yarış veya fitness testi planla',
  },
  opportunity: {
    en: 'Hold off hard work 2-3 days; window deepens',
    tr: '2-3 gün ağır iş yapma; pencere derinleşir',
  },
  available: {
    en: 'Light tempo or threshold OK; not a peak window',
    tr: 'Hafif tempo veya eşik uygun; tam zirve değil',
  },
  closed: {
    en: 'Fatigue elevated — see RecoveryDebt detector',
    tr: 'Yorgunluk yüksek — RecoveryDebt göstergesine bak',
  },
  building: {
    en: 'Continue current recovery; window in 3-7 days',
    tr: 'Toparlanmaya devam et; pencere 3-7 gün içinde',
  },
}

function fillN(tpl, n) {
  return tpl.replace(/\{n\}/g, String(n))
}

// ─── detectSupercompensation ────────────────────────────────────────────────
/**
 * Detect the peak-readiness window after a deload or recovery block.
 *
 * Walks the full log to seed Banister EWMA (CTL τ=42d, ATL τ=7d), samples the
 * trailing 21 days, and characterizes the current freshness state. The peak
 * window opens when CTL holds steady while ATL drops, producing a sharp TSB
 * rise — typically 5–10 days after a recovery block.
 *
 * @param {Array} log - training_log entries with { date, tss }
 * @param {string} [today] - YYYY-MM-DD reference; deterministic override
 * @returns {{
 *   currentTSB: number,
 *   ctlToday: number,
 *   atlToday: number,
 *   tsbRise7d: number,
 *   daysSinceLastDeload: number|null,
 *   peakDaysRemaining: number,
 *   band: 'peak'|'opportunity'|'available'|'closed'|'building',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectSupercompensation(
  log,
  today = new Date().toISOString().slice(0, 10),
) {
  const empty = {
    currentTSB: 0,
    ctlToday: 0,
    atlToday: 0,
    tsbRise7d: 0,
    daysSinceLastDeload: null,
    peakDaysRemaining: 0,
    band: 'closed',
    message: { ...MESSAGES.closed },
    recommendation: { ...RECOMMENDATIONS.closed },
    reliable: false,
    citation: SUPERCOMP_WINDOW_CITATION,
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

  const analysisStart = addDaysStr(today, -20)
  const walkStart = minDate < analysisStart ? minDate : analysisStart
  const totalDays = diffDays(today, walkStart) + 1

  let ctl = 0
  let atl = 0
  const series = []
  for (let i = 0; i < totalDays; i++) {
    const ds = addDaysStr(walkStart, i)
    const tss = dailyTSS.get(ds) || 0
    ctl = ctl + K_CTL * (tss - ctl)
    atl = atl + K_ATL * (tss - atl)
    if (ds >= analysisStart) {
      series.push({ date: ds, tss, ctl, atl, tsb: ctl - atl })
    }
  }

  if (series.length === 0) return empty
  const last = series[series.length - 1]
  const currentTSB = last.tsb
  const ctlToday = last.ctl
  const atlToday = last.atl

  const idx7 = series.length - 1 - 7
  const tsb7 = idx7 >= 0 ? series[idx7].tsb : series[0].tsb
  const tsbRise7d = currentTSB - tsb7

  const span = maxDate && minDate ? diffDays(maxDate, minDate) + 1 : 0
  const reliable = span >= 28

  // ── Deload detection: walk back through last 28 days for the most recent
  // day where the trailing 7-day TSS is < 70% of the prior 4-week avg (28d).
  // Build daily TSS over a 63-day warm-up so even a deload 28 days ago
  // has 35 days of prior context to compare against.
  const deloadScanStart = addDaysStr(today, -62)
  const dayDailyTSS = []
  for (let i = 0; i <= diffDays(today, deloadScanStart); i++) {
    const ds = addDaysStr(deloadScanStart, i)
    dayDailyTSS.push({ date: ds, tss: dailyTSS.get(ds) || 0 })
  }
  // Index of "today - 27" within dayDailyTSS — earliest day we still call
  // the deload "recent". Below that we won't accept a deload signal.
  const deloadMinIdx = Math.max(7 + 28, dayDailyTSS.length - 28)
  let deloadEndDate = null
  for (let i = dayDailyTSS.length - 1; i >= deloadMinIdx; i--) {
    let week = 0
    for (let j = i - 6; j <= i; j++) week += dayDailyTSS[j].tss
    let prior4w = 0
    for (let j = i - 6 - 28; j < i - 6; j++) prior4w += dayDailyTSS[j].tss
    const prior4wAvgWeek = prior4w / 4
    if (prior4wAvgWeek > 0 && week < 0.7 * prior4wAvgWeek) {
      deloadEndDate = dayDailyTSS[i].date
      break
    }
  }

  let daysSinceLastDeload = null
  if (deloadEndDate) {
    daysSinceLastDeload = diffDays(today, deloadEndDate)
  } else {
    // Fallback: max-TSB day in trailing 14 days as proxy for deload-end
    let bestIdx = -1
    let bestTSB = -Infinity
    const tail14Start = Math.max(0, series.length - 14)
    for (let i = tail14Start; i < series.length; i++) {
      if (series[i].tsb > bestTSB) {
        bestTSB = series[i].tsb
        bestIdx = i
      }
    }
    if (bestIdx >= 0 && bestTSB > 0) {
      daysSinceLastDeload = diffDays(today, series[bestIdx].date)
    }
  }

  // peakDaysRemaining: rough heuristic
  const since = daysSinceLastDeload == null ? 0 : daysSinceLastDeload
  let peakDaysRemaining = 5 - Math.max(0, since - 3)
  if (peakDaysRemaining < 0) peakDaysRemaining = 0
  if (peakDaysRemaining > 7) peakDaysRemaining = 7

  const roundedTSB = Math.round(currentTSB * 10) / 10
  const roundedCTL = Math.round(ctlToday * 10) / 10
  const roundedATL = Math.round(atlToday * 10) / 10
  const roundedRise = Math.round(tsbRise7d * 10) / 10

  const band = bandFor(roundedTSB, roundedCTL, roundedRise)

  let message
  let recommendation
  if (band === 'peak') {
    message = {
      en: fillN(MESSAGES.peak.en, peakDaysRemaining),
      tr: fillN(MESSAGES.peak.tr, peakDaysRemaining),
    }
    recommendation = {
      en: fillN(RECOMMENDATIONS.peak.en, peakDaysRemaining),
      tr: fillN(RECOMMENDATIONS.peak.tr, peakDaysRemaining),
    }
  } else {
    message = { ...MESSAGES[band] }
    recommendation = { ...RECOMMENDATIONS[band] }
  }

  return {
    currentTSB: roundedTSB,
    ctlToday: roundedCTL,
    atlToday: roundedATL,
    tsbRise7d: roundedRise,
    daysSinceLastDeload,
    peakDaysRemaining,
    band,
    message,
    recommendation,
    reliable,
    citation: SUPERCOMP_WINDOW_CITATION,
  }
}
