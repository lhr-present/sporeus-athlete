// ─── trainingPolarization.js — Training Polarization Pattern Classifier ──────
// Classifies the athlete's intensity distribution over a rolling N-day window
// into one of four named patterns from sport science: pyramidal, polarized,
// threshold, mixed. Distinct from trainingDistribution (which only scores
// polarized fit) — this surface explicitly labels the *template shape* and
// reports the Esteve-Lanao polarization index.
//
// Pattern definitions:
//   pyramidal    Z1 ≥ Z2 ≥ Z3 ≥ Z4 ≥ Z5  (volume tapers smoothly)
//   polarized    Z1+Z2 ≥ 75% AND Z4+Z5 ≥ 10% AND Z3 < 10%
//   threshold    Z3 > 25%  (no-man's-land — high stress, low specificity)
//   mixed        none of the above
//
// Classification priority: threshold → polarized → pyramidal → mixed.
// ─────────────────────────────────────────────────────────────────────────────

export const TRAINING_POLARIZATION_CITATION =
  'Esteve-Lanao 2007 polarization index; Seiler 2010; Stöggl & Sperlich 2014'

const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Zone parsing (replicated to keep this lib self-contained) ───────────────
function entryZoneMinutes(entry) {
  const out = [0, 0, 0, 0, 0]
  const z = entry?.zones
  if (Array.isArray(z) && z.some(v => Number(v) > 0)) {
    for (let i = 0; i < 5; i++) out[i] = Number(z[i]) || 0
    return out
  }
  if (z && typeof z === 'object') {
    let any = false
    for (let i = 0; i < 5; i++) {
      const key1 = `Z${i + 1}`
      const key2 = `z${i + 1}`
      const v = Number(z[key1] ?? z[key2] ?? 0)
      out[i] = v || 0
      if (v > 0) any = true
    }
    if (any) return out
  }
  const dur = Number(entry?.duration) || 0
  if (dur > 0) {
    const r = Number(entry?.rpe) || 5
    const zi = r <= 3 ? 0 : r <= 5 ? 1 : r <= 7 ? 2 : r === 8 ? 3 : 4
    out[zi] = dur
  }
  return out
}

// ─── Bilingual messages ──────────────────────────────────────────────────────
const MESSAGES = {
  pyramidal: {
    en: 'Pyramidal pattern — broad aerobic base',
    tr: 'Piramit deseni — geniş aerobik temel',
  },
  polarized: {
    en: 'Polarized pattern (80/20)',
    tr: 'Polarize desen (80/20)',
  },
  threshold: {
    en: 'Threshold-dominant — review Z3 load',
    tr: 'Eşik-baskın — Z3 yükünü gözden geçir',
  },
  mixed: {
    en: 'Mixed pattern — no clear template',
    tr: 'Karışık desen — net şablon yok',
  },
}

const RECS = {
  pyramidal: {
    en: 'Healthy base; add weekly Z4/Z5 dose',
    tr: 'Sağlıklı temel; haftalık Z4/Z5 dozu ekle',
  },
  polarized: { en: '', tr: '' },
  threshold: {
    en: "Reduce Z3, increase Z1/Z2 OR Z4/Z5 — avoid no-man's-land",
    tr: "Z3'ü azalt, Z1/Z2 veya Z4/Z5'i artır — orta-bölgeden çık",
  },
  mixed: {
    en: 'Pick a template (pyramidal or polarized) and trend toward it',
    tr: 'Bir şablon seç (piramit veya polarize) ve ona doğru git',
  },
}

// ─── classifyPattern ─────────────────────────────────────────────────────────
function classifyPattern(shares) {
  const { Z1, Z2, Z3, Z4, Z5 } = shares
  if (Z3 > 25) return 'threshold'
  if (Z1 + Z2 >= 75 && Z4 + Z5 >= 10 && Z3 < 10) return 'polarized'
  const monotonic =
    Z1 >= Z2 && Z2 >= Z3 && Z3 >= Z4 && Z4 >= Z5 && Z1 > 0 && Z5 > 0
  if (monotonic) return 'pyramidal'
  return 'mixed'
}

// ─── detectTrainingPolarization ──────────────────────────────────────────────
/**
 * Classify trailing N-day intensity distribution into a named pattern and
 * compute the Esteve-Lanao polarization index.
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @param {number} [windowDays=28] - lookback window (default 28d)
 * @returns {{
 *   pattern: 'pyramidal'|'polarized'|'threshold'|'mixed',
 *   shares: {Z1:number, Z2:number, Z3:number, Z4:number, Z5:number},
 *   totalMinutes: number,
 *   polarizationIndex: number|null,
 *   windowDays: number,
 *   message: {en:string, tr:string},
 *   recommendation: {en:string, tr:string},
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectTrainingPolarization(
  log,
  today = new Date().toISOString().slice(0, 10),
  windowDays = 28,
) {
  const win =
    Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 28

  const zeroShares = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }
  const empty = {
    pattern: 'mixed',
    shares: { ...zeroShares },
    totalMinutes: 0,
    polarizationIndex: null,
    windowDays: win,
    message: { ...MESSAGES.mixed },
    recommendation: { ...RECS.mixed },
    reliable: false,
    citation: TRAINING_POLARIZATION_CITATION,
  }

  if (!Array.isArray(log) || log.length === 0) return empty

  const startStr = addDaysStr(today, -(win - 1))
  const recent = log.filter(e => e?.date && e.date >= startStr && e.date <= today)
  if (recent.length === 0) return empty

  const totals = [0, 0, 0, 0, 0]
  const distinctDays = new Set()
  for (const entry of recent) {
    const m = entryZoneMinutes(entry)
    let entryHasMinutes = false
    for (let i = 0; i < 5; i++) {
      totals[i] += m[i]
      if (m[i] > 0) entryHasMinutes = true
    }
    if (entryHasMinutes) distinctDays.add(entry.date)
  }
  const totalMinutes = totals.reduce((s, v) => s + v, 0)

  const sharesArr = totals.map(v =>
    totalMinutes > 0 ? Math.round((v / totalMinutes) * 1000) / 10 : 0,
  )
  const shares = ZONE_KEYS.reduce((acc, key, i) => {
    acc[key] = sharesArr[i]
    return acc
  }, {})

  const pattern = totalMinutes > 0 ? classifyPattern(shares) : 'mixed'

  const lowSum = shares.Z1 + shares.Z2
  const hiSum = shares.Z4 + shares.Z5
  const polarizationIndex =
    hiSum > 0 && lowSum > 0
      ? Math.round(Math.log10(lowSum / hiSum) * 10) / 10
      : null

  const reliable = totalMinutes >= 200 && distinctDays.size >= 7

  return {
    pattern,
    shares,
    totalMinutes: Math.round(totalMinutes),
    polarizationIndex,
    windowDays: win,
    message: { ...MESSAGES[pattern] },
    recommendation: { ...RECS[pattern] },
    reliable,
    citation: TRAINING_POLARIZATION_CITATION,
  }
}
