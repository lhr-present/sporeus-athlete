// ─── recoveryAdherence.js — Recovery-Day Adherence Detector (28d window) ────
// Detects whether labeled rest/recovery days were actually rested. Common
// failure mode: "rest day" creeps into a 30-min easy ride, then 60-min Z2,
// then a tempo session. Distinct from easyDayCompliance (RPE drift on easy
// days) and detrainingDetector (total inactivity gaps).
// Cite: Halson 2014 recovery; Foster 2001 monotony
// ─────────────────────────────────────────────────────────────────────────────

export const RECOVERY_ADHERENCE_CITATION = 'Halson 2014 recovery; Foster 2001 monotony'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const REST_TYPE_REGEX = /recovery|rest|off/i
const REST_INTENT_SET = new Set(['recovery', 'rest', 'off'])

function isLabeledRest(entry) {
  if (!entry) return false
  if (typeof entry.intent === 'string' && REST_INTENT_SET.has(entry.intent.toLowerCase())) return true
  if (typeof entry.type === 'string' && REST_TYPE_REGEX.test(entry.type)) return true
  return false
}

function classifyDay(totalTSS, meanRpe) {
  const rpeOk = meanRpe == null || meanRpe <= 4
  const rpeMild = meanRpe != null && meanRpe >= 5 && meanRpe <= 6
  const rpeSevere = meanRpe != null && meanRpe > 6

  if (totalTSS > 60 || rpeSevere) return 'severe'
  if (totalTSS > 30 || rpeMild) return 'mild'
  if (totalTSS <= 30 && rpeOk) return 'adherent'
  return 'mild'
}

function bandFor(pct, totalRestDaysPlanned) {
  if (totalRestDaysPlanned === 0) return 'good'
  if (pct >= 80) return 'good'
  if (pct >= 50) return 'moderate'
  return 'poor'
}

function messageFor(band, pct, totalRestDaysPlanned) {
  const p = Math.round(pct)
  if (band === 'good' && totalRestDaysPlanned === 0) {
    return {
      message: {
        en: 'No rest days planned — schedule weekly recovery',
        tr: 'Planlı dinlenme günü yok — haftalık toparlanma planla',
      },
      recommendation: {
        en: 'Add 1 full rest day per week',
        tr: 'Haftaya 1 tam dinlenme günü ekle',
      },
    }
  }
  if (band === 'good') {
    return {
      message: {
        en: `Rest days held — ${p}% adherence`,
        tr: `Dinlenme günleri korundu — %${p} uyum`,
      },
      recommendation: { en: '', tr: '' },
    }
  }
  if (band === 'moderate') {
    return {
      message: {
        en: `${p}% rest-day adherence — discipline slipping`,
        tr: `%${p} dinlenme günü uyumu — disiplin zayıflıyor`,
      },
      recommendation: {
        en: "Cap rest-day RPE at 4 and TSS at 30",
        tr: "Dinlenme günü RPE'yi 4, TSS'i 30 ile sınırla",
      },
    }
  }
  return {
    message: {
      en: `${p}% adherence — rest days are training stealth`,
      tr: `%${p} uyum — dinlenme günleri gizli antrenman`,
    },
    recommendation: {
      en: 'Schedule mandatory zero-TSS days; sleep + walk only',
      tr: 'Zorunlu sıfır-TSS günleri planla; sadece uyku + yürüyüş',
    },
  }
}

/**
 * Detect rest-day adherence over the trailing 28 days.
 *
 * Rest day = entry.intent in {recovery, rest, off} OR
 *            entry.type matches /recovery|rest|off/i
 *
 * Per labeled rest day (sum across multiple entries on same date):
 *   adherent   : totalTSS ≤ 30 AND meanRpe ≤ 4
 *   mild_drift : 30 < totalTSS ≤ 60 OR (totalTSS ≤ 30 AND meanRpe in 5..6)
 *   severe_drift: totalTSS > 60 OR meanRpe > 6
 *
 * Bands: ≥80% good, 50–79% moderate, <50% poor; 0 planned rest days = good (vacuous)
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   totalRestDaysPlanned: number,
 *   adherentDays: number,
 *   mildDriftDays: number,
 *   severeDriftDays: number,
 *   adherencePct: number,
 *   driftDates: string[],
 *   band: 'good'|'moderate'|'poor',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectRecoveryAdherence(log, today = new Date().toISOString().slice(0, 10)) {
  const noPlanned = (() => {
    const { message, recommendation } = messageFor('good', 0, 0)
    return {
      totalRestDaysPlanned: 0,
      adherentDays: 0,
      mildDriftDays: 0,
      severeDriftDays: 0,
      adherencePct: 0,
      driftDates: [],
      band: 'good',
      message,
      recommendation,
      reliable: false,
      citation: RECOVERY_ADHERENCE_CITATION,
    }
  })()

  if (!Array.isArray(log) || log.length === 0) return noPlanned

  const start28 = addDaysStr(today, -27)
  const recent = log.filter(e => e?.date && e.date >= start28 && e.date <= today)
  if (recent.length === 0) return noPlanned

  const restEntries = recent.filter(isLabeledRest)
  if (restEntries.length === 0) return noPlanned

  const byDate = new Map()
  for (const e of restEntries) {
    const arr = byDate.get(e.date) || []
    arr.push(e)
    byDate.set(e.date, arr)
  }

  let adherentDays = 0
  let mildDriftDays = 0
  let severeDriftDays = 0
  const driftEntries = []

  for (const [date, entries] of byDate.entries()) {
    let totalTSS = 0
    let rpeSum = 0
    let rpeCount = 0
    for (const e of entries) {
      const tss = Number(e?.tss)
      if (Number.isFinite(tss) && tss > 0) totalTSS += tss
      const r = Number(e?.rpe)
      if (Number.isFinite(r) && r > 0) {
        rpeSum += r
        rpeCount += 1
      }
    }
    const meanRpe = rpeCount > 0 ? rpeSum / rpeCount : null
    const cls = classifyDay(totalTSS, meanRpe)
    if (cls === 'adherent') adherentDays += 1
    else if (cls === 'mild') {
      mildDriftDays += 1
      driftEntries.push(date)
    } else {
      severeDriftDays += 1
      driftEntries.push(date)
    }
  }

  const totalRestDaysPlanned = byDate.size
  const adherencePct = totalRestDaysPlanned > 0
    ? Math.round((adherentDays / totalRestDaysPlanned) * 100)
    : 0

  const driftDates = driftEntries
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5)

  const band = bandFor(adherencePct, totalRestDaysPlanned)
  const reliable = totalRestDaysPlanned >= 3
  const { message, recommendation } = messageFor(band, adherencePct, totalRestDaysPlanned)

  return {
    totalRestDaysPlanned,
    adherentDays,
    mildDriftDays,
    severeDriftDays,
    adherencePct,
    driftDates,
    band,
    message,
    recommendation,
    reliable,
    citation: RECOVERY_ADHERENCE_CITATION,
  }
}
