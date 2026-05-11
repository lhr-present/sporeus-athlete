// ─── hardDaySpacing.js — Hard-Day Spacing Compliance (28d window) ────────────
// Detects violations of the hard-easy alternation principle: a hard session
// followed by another hard session within 48h denies aerobic recovery and
// predicts overreaching. This is the canonical microcycle rule across endurance
// science (Lambert 1997 post-exercise immune dip; Foster 1998 monotony+strain;
// Seiler 2010 polarized cadence — recovery between high-intensity bouts).
//
// Complements:
//   easyDayCompliance.js (RPE drift on labeled-easy days),
//   sessionVariety.js    (mix of session intents),
//   workoutDensity.js    (consecutive-flagged weeks),
//   patterns.js          (retrospective post-injury triggers).
//
// Where existing libs flag "≥3 consecutive hard days" or post-injury patterns,
// this one tracks *every* hard→hard transition (gap < 48h) prospectively over
// the trailing 28 days and surfaces a compliance percentage + recent violation
// dates the athlete can audit.
//
// Citations:
//   Lambert E.V. et al. (1997). Open Window of Susceptibility to Infection
//     during Recovery from Exercise. Exerc Immunol Rev 3:13-25.
//   Foster C. (1998). Monitoring training in athletes with reference to
//     overtraining syndrome. Med Sci Sports Exerc 30(7):1164-1168.
//   Seiler S. (2010). What is best practice for training intensity
//     distribution in endurance athletes? Int J Sports Physiol Perform 5(3).
// ─────────────────────────────────────────────────────────────────────────────

export const HARD_DAY_SPACING_CITATION = 'Lambert 1997; Foster 1998; Seiler 2010'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dayDiff(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00Z').getTime()
  const b = new Date(bISO + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

// ─── Hard-session classification ─────────────────────────────────────────────
// A session counts as HARD when ANY of:
//   - RPE >= 7
//   - type matches /tempo|interval|threshold|vo2|race|sweet.?spot|hard/i
//   - intent in {tempo, intervals, race}
//   - zones recorded AND Z3+Z4+Z5 share > 50%
const HARD_TYPE_REGEX = /tempo|interval|threshold|vo2|race|sweet.?spot|hard/i
const HARD_INTENT_SET = new Set(['tempo', 'intervals', 'race'])

function entryHardZoneShare(entry) {
  const z = entry?.zones
  let total = 0, hard = 0
  if (Array.isArray(z) && z.some(v => Number(v) > 0)) {
    for (let i = 0; i < 5; i++) {
      const v = Number(z[i]) || 0
      total += v
      if (i >= 2) hard += v
    }
    return total > 0 ? hard / total : 0
  }
  if (z && typeof z === 'object') {
    let any = false
    for (let i = 0; i < 5; i++) {
      const v = Number(z[`Z${i + 1}`] ?? z[`z${i + 1}`] ?? 0)
      total += v
      if (i >= 2) hard += v
      if (v > 0) any = true
    }
    if (any && total > 0) return hard / total
  }
  return 0
}

function isHardSession(entry) {
  if (!entry) return false
  const r = Number(entry.rpe)
  if (Number.isFinite(r) && r >= 7) return true
  if (typeof entry.type === 'string' && HARD_TYPE_REGEX.test(entry.type)) return true
  if (typeof entry.intent === 'string' && HARD_INTENT_SET.has(entry.intent.toLowerCase())) return true
  if (entryHardZoneShare(entry) > 0.50) return true
  return false
}

// ─── Band classification ─────────────────────────────────────────────────────
function bandFor(pct) {
  if (pct >= 80) return 'good'
  if (pct >= 60) return 'moderate'
  return 'poor'
}

function messageFor(band, pct, violations) {
  const p = Math.round(pct)
  if (band === 'good') {
    return {
      message: {
        en: `Hard-day spacing solid — ${p}% of hard sessions get 48h recovery.`,
        tr: `Sert gün aralığı sağlam — sert seansların %${p}'i 48s toparlanma alıyor.`,
      },
      recommendation: { en: '', tr: '' },
    }
  }
  if (band === 'moderate') {
    return {
      message: {
        en: `${p}% hard-day spacing — ${violations} back-to-back hard session${violations === 1 ? '' : 's'}.`,
        tr: `%${p} sert-gün aralığı — ${violations} ardışık sert seans.`,
      },
      recommendation: {
        en: 'Insert ≥1 easy or rest day between threshold/VO2/intervals.',
        tr: 'Eşik/VO2/interval arasına en az 1 kolay veya dinlenme günü ekle.',
      },
    }
  }
  return {
    message: {
      en: `${p}% hard-day spacing — ${violations} back-to-back hard pairs. Overreaching risk.`,
      tr: `%${p} sert-gün aralığı — ${violations} ardışık sert çift. Aşırı yüklenme riski.`,
    },
    recommendation: {
      en: 'Restructure week: no two hard days in a row. 48h aerobic recovery between quality.',
      tr: 'Haftayı yeniden yapılandır: iki sert gün üst üste olmasın. Kalite arası 48s aerobik toparlanma.',
    },
  }
}

// ─── detectHardDaySpacing ────────────────────────────────────────────────────
/**
 * Detect hard-day spacing compliance over the trailing 28 days.
 *
 * Hard session = RPE >= 7, OR type matches tempo/interval/threshold/vo2/race
 * /sweet.?spot/hard, OR intent in {tempo, intervals, race}, OR Z3+Z4+Z5 zone
 * share > 50%.
 *
 * Violation = a hard session followed by another hard session within 1 day
 * (consecutive calendar days). Each ordered pair counts once.
 *
 * Bands: <60% poor, 60-79% moderate, >=80% good.
 *
 * Reliable when totalHard >= 4 in the window.
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   totalHard: number,
 *   violations: number,
 *   compliancePct: number,
 *   band: 'poor'|'moderate'|'good',
 *   violationDates: string[],
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectHardDaySpacing(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    totalHard: 0,
    violations: 0,
    compliancePct: 0,
    band: 'poor',
    violationDates: [],
    message: { en: '', tr: '' },
    recommendation: { en: '', tr: '' },
    reliable: false,
    citation: HARD_DAY_SPACING_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  const start28 = addDaysStr(today, -27)
  const recent = log.filter(e => e?.date && e.date >= start28 && e.date <= today)
  if (recent.length === 0) return empty

  // Bucket hard sessions by date — multiple sessions same day count as one
  // hard day for spacing purposes (a double-day still resolves to a single
  // calendar marker; the spacing violation is the next-day repeat).
  const hardDays = new Set()
  for (const e of recent) {
    if (isHardSession(e)) hardDays.add(e.date)
  }
  const hardDates = Array.from(hardDays).sort()
  const totalHard = hardDates.length

  if (totalHard === 0) {
    return {
      ...empty,
      compliancePct: 100,
      band: 'good',
      message: {
        en: 'No hard sessions in last 28 days.',
        tr: 'Son 28 günde sert seans yok.',
      },
    }
  }

  // Walk consecutive pairs of hard dates; pair is a violation when gap <= 1 day.
  let violations = 0
  const violationDates = []
  for (let i = 1; i < hardDates.length; i++) {
    if (dayDiff(hardDates[i - 1], hardDates[i]) <= 1) {
      violations++
      // Surface the second (later) date of the pair as the violation marker.
      violationDates.push(hardDates[i])
    }
  }

  // Compliance = (hard sessions that did NOT immediately follow another) / total.
  // Equivalently: 1 - violations / totalHard. Clamped to [0, 100].
  const rawPct = totalHard > 0
    ? Math.round(((totalHard - violations) / totalHard) * 100)
    : 0
  const compliancePct = Math.max(0, Math.min(100, rawPct))

  const reliable = totalHard >= 4
  const band = bandFor(compliancePct)
  const recentViolations = violationDates.slice(-5)
  const { message, recommendation } = messageFor(band, compliancePct, violations)

  return {
    totalHard,
    violations,
    compliancePct,
    band,
    violationDates: recentViolations,
    message,
    recommendation,
    reliable,
    citation: HARD_DAY_SPACING_CITATION,
  }
}
