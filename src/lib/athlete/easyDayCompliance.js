// ─── easyDayCompliance.js — E127: Easy-Day Compliance Detector (28d window) ─
// Detects RPE/zone drift on labeled-easy days. Athletes who go too hard on
// easy days violate Seiler's polarized 80/20 rule and lose adaptation.
// Cite: Seiler 2010 (polarized); Stöggl & Sperlich 2014 (intensity distribution)
// ─────────────────────────────────────────────────────────────────────────────

export const EASY_DAY_COMPLIANCE_CITATION = 'Seiler 2010; Stöggl & Sperlich 2014'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Easy-day classification ──────────────────────────────────────────────────
const EASY_TYPE_REGEX = /recovery|easy|endurance|z2/i
const EASY_INTENT_SET = new Set(['recovery', 'long', 'steady'])

function isLabeledEasy(entry) {
  if (!entry) return false
  if (typeof entry.type === 'string' && EASY_TYPE_REGEX.test(entry.type)) return true
  if (typeof entry.intent === 'string' && EASY_INTENT_SET.has(entry.intent.toLowerCase())) return true
  const r = Number(entry.rpe)
  if (Number.isFinite(r) && r > 0 && r <= 4) return true
  return false
}

// ─── Zone parsing (matches staleZones.js / sessionVariety.js) ────────────────
function entryHardZoneShare(entry) {
  const z = entry?.zones
  let total = 0, hard = 0
  if (Array.isArray(z) && z.some(v => Number(v) > 0)) {
    for (let i = 0; i < 5; i++) {
      const v = Number(z[i]) || 0
      total += v
      if (i >= 2) hard += v // Z3+Z4+Z5
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
  return 0 // no zone signal — caller must rely on RPE
}

function isDrift(entry) {
  // Drift = actual RPE > 5 OR Z3+Z4+Z5 share > 20%
  const r = Number(entry?.rpe)
  if (Number.isFinite(r) && r > 5) return true
  const hardShare = entryHardZoneShare(entry)
  if (hardShare > 0.20) return true
  return false
}

// ─── Band classification ─────────────────────────────────────────────────────
function bandFor(pct) {
  if (pct >= 80) return 'good'
  if (pct >= 60) return 'moderate'
  return 'poor'
}

function messageFor(band, pct) {
  const p = Math.round(pct)
  if (band === 'good') {
    return {
      message: {
        en: `Easy days are easy — ${p}% compliant.`,
        tr: `Kolay günler kolay — %${p} uyum.`,
      },
      recommendation: { en: '', tr: '' },
    }
  }
  if (band === 'moderate') {
    return {
      message: {
        en: `${p}% easy-day compliance — some drift.`,
        tr: `%${p} kolay-gün uyumu — bir miktar sapma.`,
      },
      recommendation: {
        en: 'Aim for HR-cap or RPE-cap on easy days.',
        tr: 'Kolay günlerde HR veya RPE üst-sınırı koy.',
      },
    }
  }
  return {
    message: {
      en: `${p}% easy-day compliance — too hard too often.`,
      tr: `%${p} kolay-gün uyumu — fazla sık çok zor.`,
    },
    recommendation: {
      en: 'Add discipline: HR ≤ aerobic threshold; cap RPE 4.',
      tr: 'Disiplin ekle: HR ≤ aerobik eşik; RPE üst-sınır 4.',
    },
  }
}

// ─── detectEasyDayCompliance ─────────────────────────────────────────────────
/**
 * Detect easy-day RPE/zone drift over the trailing 28 days (Seiler 80/20).
 *
 * Easy day = type matches /recovery|easy|endurance|z2/i, OR
 *            entry.intent in {recovery, long, steady}, OR
 *            entry.rpe in (0, 4]
 *
 * Drift = actual RPE > 5 OR Z3+Z4+Z5 zone share > 20%
 *
 * Bands: <60% poor, 60-79% moderate, ≥80% good (Seiler polarized template)
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   totalEasy: number,
 *   driftSessions: number,
 *   compliancePct: number,
 *   band: 'poor'|'moderate'|'good',
 *   driftDates: string[],
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectEasyDayCompliance(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    totalEasy: 0,
    driftSessions: 0,
    compliancePct: 0,
    band: 'poor',
    driftDates: [],
    message: { en: '', tr: '' },
    recommendation: { en: '', tr: '' },
    reliable: false,
    citation: EASY_DAY_COMPLIANCE_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  const start28 = addDaysStr(today, -27)
  const recent = log.filter(e => e?.date && e.date >= start28 && e.date <= today)
  if (recent.length === 0) return empty

  const easySessions = recent.filter(isLabeledEasy)
  const totalEasy = easySessions.length

  // Sort drift sessions by date descending (most recent first), cap at 5
  const driftEntries = easySessions
    .filter(isDrift)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const driftSessions = driftEntries.length
  const driftDates = driftEntries.slice(0, 5).map(e => e.date)

  const compliantEasy = totalEasy - driftSessions
  const compliancePct = totalEasy > 0
    ? Math.round((compliantEasy / totalEasy) * 100)
    : 0

  const band = totalEasy > 0 ? bandFor(compliancePct) : 'poor'
  const reliable = totalEasy >= 5
  const { message, recommendation } = messageFor(band, compliancePct)

  return {
    totalEasy,
    driftSessions,
    compliancePct,
    band,
    driftDates,
    message,
    recommendation,
    reliable,
    citation: EASY_DAY_COMPLIANCE_CITATION,
  }
}
