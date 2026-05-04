// ─── sessionRPEDrift.js — Session RPE-vs-Plan Drift Detector (28d) ──────────
// Compares planned intensity (intent or session.type's expected RPE band)
// against actual RPE for every typed session. Distinct from easyDayCompliance,
// which only watches labeled-easy days; this detector looks at ALL session
// types and flags systematic over-execution (long runs done too hard, tempo
// drifting toward threshold, etc).
// Cite: Foster 2001 session RPE; Seiler 2010 polarized
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_RPE_DRIFT_CITATION =
  'Foster 2001 session RPE; Seiler 2010 polarized'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Intent / type → planned RPE max ─────────────────────────────────────────
const INTENT_PLAN = {
  recovery: { collapsed: 'easy', max: 4 },
  easy: { collapsed: 'easy', max: 4 },
  long: { collapsed: 'long', max: 5 },
  endurance: { collapsed: 'long', max: 5 },
  steady: { collapsed: 'steady', max: 7 },
  tempo: { collapsed: 'steady', max: 7 },
  threshold: { collapsed: 'threshold', max: 8 },
  sweetspot: { collapsed: 'threshold', max: 8 },
  'sweet spot': { collapsed: 'threshold', max: 8 },
  intervals: { collapsed: 'intervals', max: 10 },
  vo2: { collapsed: 'intervals', max: 10 },
  'race-pace': { collapsed: 'intervals', max: 10 },
}

function planFromString(s) {
  if (typeof s !== 'string' || !s) return null
  const v = s.toLowerCase().trim()
  if (INTENT_PLAN[v]) return INTENT_PLAN[v]
  if (/recovery|easy/.test(v)) return { collapsed: 'easy', max: 4 }
  if (/long|endurance/.test(v)) return { collapsed: 'long', max: 5 }
  if (/tempo|steady/.test(v)) return { collapsed: 'steady', max: 7 }
  if (/threshold|sweet ?spot/.test(v)) return { collapsed: 'threshold', max: 8 }
  if (/interval|vo2|race/.test(v)) return { collapsed: 'intervals', max: 10 }
  return null
}

function planForEntry(entry) {
  if (!entry) return null
  const fromIntent = planFromString(entry.intent)
  if (fromIntent) return fromIntent
  return planFromString(entry.type)
}

// ─── Band classification ─────────────────────────────────────────────────────
function bandFor(driftPct) {
  if (driftPct >= 40) return 'high'
  if (driftPct >= 20) return 'moderate'
  return 'good'
}

const COLLAPSED_KEYS = ['easy', 'long', 'steady', 'threshold', 'intervals']

function emptyByType() {
  const out = {}
  for (const k of COLLAPSED_KEYS) out[k] = { drift: 0, total: 0 }
  return out
}

// ─── Bilingual message templates ─────────────────────────────────────────────
function buildMessage(band, driftPct, worstType) {
  const p = Math.round(driftPct)
  let en = ''
  let tr = ''
  if (band === 'good') {
    en = 'Sessions executed close to plan'
    tr = 'Seanslar plana yakın yürütüldü'
  } else if (band === 'moderate') {
    en = `${p}% of sessions drift above plan`
    tr = `Seansların %${p}'i planın üstüne sapıyor`
  } else {
    en = `${p}% drift — execution discipline issue`
    tr = `%${p} sapma — uygulama disiplini sorunu`
  }
  if (band !== 'good' && worstType) {
    en += `; worst on ${worstType} sessions`
    tr += `; en kötü ${worstType} seansları`
  }
  return { en, tr }
}

function buildRecommendation(band) {
  if (band === 'good') return { en: '', tr: '' }
  if (band === 'moderate') {
    return {
      en: 'Use HR or pace caps to enforce intent',
      tr: 'Niyeti zorlamak için HR veya tempo üst-sınırı kullan',
    }
  }
  return {
    en: 'Coach review or structured plan recommended',
    tr: 'Antrenör incelemesi veya yapılandırılmış plan önerilir',
  }
}

// ─── detectSessionRPEDrift ───────────────────────────────────────────────────
/**
 * Detect drift between planned intensity and actual session RPE over the
 * trailing 28 days.
 *
 * Plan map (intent first, then type, regex-fallback):
 *   recovery|easy            max RPE 4
 *   long|endurance           max RPE 5
 *   steady|tempo             max RPE 7
 *   threshold|sweetspot      max RPE 8
 *   intervals|vo2|race-pace  max RPE 10 (no cap — cannot drift above 10)
 *
 * Drift severity (delta = rpe − plannedMax):
 *   mild     delta = 1
 *   moderate delta = 2
 *   severe   delta ≥ 3
 *
 * Bands by drift %:
 *   good      < 20%
 *   moderate  20–39%
 *   high      ≥ 40%
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   totalSessions: number,
 *   driftSessions: number,
 *   driftPct: number,
 *   bySeverity: { mild: number, moderate: number, severe: number },
 *   byType: { easy:{drift,total}, long:{...}, steady:{...}, threshold:{...}, intervals:{...} },
 *   band: 'good'|'moderate'|'high',
 *   worstType: string|null,
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectSessionRPEDrift(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    totalSessions: 0,
    driftSessions: 0,
    driftPct: 0,
    bySeverity: { mild: 0, moderate: 0, severe: 0 },
    byType: emptyByType(),
    band: 'good',
    worstType: null,
    message: buildMessage('good', 0, null),
    recommendation: buildRecommendation('good'),
    reliable: false,
    citation: SESSION_RPE_DRIFT_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  const start28 = addDaysStr(today, -27)

  const bySeverity = { mild: 0, moderate: 0, severe: 0 }
  const byType = emptyByType()
  let totalSessions = 0
  let driftSessions = 0

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const ds = e.date.slice(0, 10)
    if (ds < start28 || ds > today) continue

    const plan = planForEntry(e)
    if (!plan) continue

    const r = Number(e.rpe)
    if (!Number.isFinite(r) || r <= 0) continue

    totalSessions++
    byType[plan.collapsed].total++

    const delta = r - plan.max
    if (delta > 0) {
      driftSessions++
      byType[plan.collapsed].drift++
      if (delta === 1) bySeverity.mild++
      else if (delta === 2) bySeverity.moderate++
      else bySeverity.severe++
    }
  }

  const driftPct = totalSessions > 0
    ? Math.round((driftSessions / totalSessions) * 100)
    : 0
  const band = bandFor(driftPct)

  let worstType = null
  let worstPct = -1
  for (const k of COLLAPSED_KEYS) {
    const { drift, total } = byType[k]
    if (total < 3) continue
    const pct = (drift / total) * 100
    if (pct > worstPct) {
      worstPct = pct
      worstType = k
    }
  }

  const message = buildMessage(band, driftPct, worstType)
  const recommendation = buildRecommendation(band)
  const reliable = totalSessions >= 8

  return {
    totalSessions,
    driftSessions,
    driftPct,
    bySeverity,
    byType,
    band,
    worstType,
    message,
    recommendation,
    reliable,
    citation: SESSION_RPE_DRIFT_CITATION,
  }
}
