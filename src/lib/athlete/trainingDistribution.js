// ─── trainingDistribution.js — E128: Training Distribution (season window) ──
// Aggregates training over a configurable lookback window (default 84d ≈ 3
// months) into Z1..Z5 zone shares, intent shares (recovery / long / steady /
// tempo / intervals), weekly averages and a polarized-model match indicator.
//
// Complements the 28d window detectors (staleZones, sessionVariety) by giving
// a season-level view of where the athlete's training volume actually goes.
//
// Based on Seiler 2010 (polarized template) + Stöggl & Sperlich 2014
// (controlled comparison of training distributions).
// ─────────────────────────────────────────────────────────────────────────────

export const TRAINING_DISTRIBUTION_CITATION = 'Seiler 2010; Stöggl & Sperlich 2014'

const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
/**
 * Add `days` to a 'YYYY-MM-DD' string and return new 'YYYY-MM-DD' (UTC).
 */
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Compute ISO week key 'YYYY-Www' (Mon–Sun) for a 'YYYY-MM-DD' string in UTC.
 */
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dayNum = d.getUTCDay() || 7 // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// ─── Zone parsing (mirrors staleZones.js entryZoneContributions) ─────────────
/**
 * Extract per-zone contribution (TSS or minutes — caller-defined unit) from a
 * single log entry. Mirrors the pattern used by staleZones.js.
 *
 * Supports two shapes:
 *   1. entry.zones is an array of 5 numbers [Z1,Z2,Z3,Z4,Z5]
 *   2. entry.zones is an object {Z1..Z5} (or lowercase {z1..z5})
 *
 * Falls back to RPE-bucketed duration when no zones are present.
 *
 * @returns {[number, number, number, number, number]}
 */
function entryZoneContributions(entry) {
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
  // Fallback: RPE-bucketed duration
  const dur = Number(entry?.duration) || 0
  if (dur > 0) {
    const r = Number(entry?.rpe) || 5
    const zi = r <= 3 ? 0 : r <= 5 ? 1 : r <= 7 ? 2 : r === 8 ? 3 : 4
    out[zi] = dur
  }
  return out
}

// ─── Intent shares helper (mirrors sessionVariety.js) ────────────────────────
/**
 * Per-zone shares as fractions summing to 1 when there is data, else zeros.
 */
function entryZoneShares(entry) {
  const c = entryZoneContributions(entry)
  const total = c[0] + c[1] + c[2] + c[3] + c[4]
  if (total <= 0) return { shares: [0, 0, 0, 0, 0], hasZones: false }
  return {
    shares: [c[0] / total, c[1] / total, c[2] / total, c[3] / total, c[4] / total],
    hasZones: true,
  }
}

// ─── Session intent classifier (mirrors sessionVariety.js) ───────────────────
/**
 * Classify a single session into one of 5 intents. Returns null if no rule
 * matches (e.g. NaN RPE, non-endurance session, missing duration).
 *
 * Order matters: recovery → long → intervals → tempo → steady.
 */
function classifyIntent(entry) {
  const rpeRaw = Number(entry?.rpe)
  const dur = Number(entry?.duration)
  if (!Number.isFinite(rpeRaw) || !Number.isFinite(dur) || dur <= 0) return null
  const rpe = rpeRaw

  const { shares, hasZones } = entryZoneShares(entry)
  const [, z2Share, z3Share, z4Share, z5Share] = shares
  const hiShare = z4Share + z5Share
  const tempoPlus = z3Share + z4Share + z5Share

  // 1. recovery
  if (rpe <= 3 && dur <= 60) return 'recovery'
  // 2. long
  if (dur >= 90 && rpe <= 5) return 'long'
  // 3. intervals
  if (rpe >= 7 && dur < 60 && hasZones && hiShare > 0.30) return 'intervals'
  // 4. tempo
  if (rpe >= 6 && rpe <= 7 && dur >= 30 && dur <= 75) {
    if (!hasZones || tempoPlus > z2Share) return 'tempo'
  }
  // 5. steady
  if (rpe >= 4 && rpe <= 5 && dur >= 30 && dur <= 90) {
    if (!hasZones || z2Share >= z3Share + z4Share + z5Share) return 'steady'
  }
  return null
}

// ─── Polarized match notes (Seiler 2010 80/20) ───────────────────────────────
const NOTES = {
  good: {
    en: 'Training distribution matches polarized 80/20 model.',
    tr: 'Antrenman dağılımı polarize 80/20 modeline uygun.',
  },
  moderate: {
    en: 'Distribution is reasonable but could shift toward 80/20.',
    tr: "Dağılım kabul edilebilir; 80/20'ye doğru kaydırılabilir.",
  },
  poor: {
    en: 'Distribution drifts from 80/20 — too much threshold or too little Z5.',
    tr: "Dağılım 80/20'den sapıyor — fazla eşik çalışması veya yetersiz Z5.",
  },
}

// ─── detectTrainingDistribution ──────────────────────────────────────────────
/**
 * Aggregate training over a configurable window into zone + intent
 * distribution and a polarized-model match indicator.
 *
 * @param {Array} log - training_log entries
 * @param {number} [windowDays=84] - lookback window (default 84d ~ 3 months / quarter)
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   zones: { Z1: number, Z2: number, Z3: number, Z4: number, Z5: number },
 *   intents: { recovery: number, long: number, steady: number, tempo: number, intervals: number },
 *   weeklyAvg: { tss: number, durationMin: number, sessions: number },
 *   polarizedMatch: 'good' | 'moderate' | 'poor',
 *   polarizedNote: { en: string, tr: string },
 *   totalSessions: number,
 *   weeksObserved: number,
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectTrainingDistribution(
  log,
  windowDays = 84,
  today = new Date().toISOString().slice(0, 10),
) {
  const safeDefaults = {
    zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },
    intents: { recovery: 0, long: 0, steady: 0, tempo: 0, intervals: 0 },
    weeklyAvg: { tss: 0, durationMin: 0, sessions: 0 },
    polarizedMatch: 'poor',
    polarizedNote: NOTES.poor,
    totalSessions: 0,
    weeksObserved: 0,
    reliable: false,
    citation: TRAINING_DISTRIBUTION_CITATION,
  }

  if (!Array.isArray(log) || log.length === 0) return safeDefaults

  const win = Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 84
  const startStr = addDaysStr(today, -(win - 1))

  const recent = log.filter(e => e?.date && e.date >= startStr && e.date <= today)
  if (recent.length === 0) return safeDefaults

  // ── Per-zone aggregates ────────────────────────────────────────────────────
  const zoneTotals = [0, 0, 0, 0, 0]
  for (const entry of recent) {
    const c = entryZoneContributions(entry)
    for (let i = 0; i < 5; i++) zoneTotals[i] += c[i]
  }
  const zoneSum = zoneTotals.reduce((s, v) => s + v, 0)
  const zonePct = ZONE_KEYS.reduce((acc, key, i) => {
    acc[key] = zoneSum > 0 ? Math.round((zoneTotals[i] / zoneSum) * 100) : 0
    return acc
  }, {})

  // ── Per-intent aggregates ──────────────────────────────────────────────────
  const intentCounts = { recovery: 0, long: 0, steady: 0, tempo: 0, intervals: 0 }
  for (const entry of recent) {
    const intent = classifyIntent(entry)
    if (intent) intentCounts[intent]++
  }
  const totalSessions = recent.length
  const intentPct = Object.keys(intentCounts).reduce((acc, k) => {
    acc[k] = totalSessions > 0
      ? Math.round((intentCounts[k] / totalSessions) * 100)
      : 0
    return acc
  }, {})

  // ── Weekly averages ────────────────────────────────────────────────────────
  const weeksSet = new Set()
  let totalTss = 0
  let totalDuration = 0
  for (const entry of recent) {
    weeksSet.add(isoWeekKey(entry.date))
    totalTss += Number(entry?.tss) || 0
    totalDuration += Number(entry?.duration) || 0
  }
  const weeksObserved = weeksSet.size
  const denom = weeksObserved > 0 ? weeksObserved : 1
  const weeklyAvg = {
    tss: Math.round(totalTss / denom),
    durationMin: Math.round(totalDuration / denom),
    sessions: Math.round(totalSessions / denom),
  }

  // ── Polarized model match (strict bands per Seiler 2010 80/20) ─────────────
  const z2 = zonePct.Z2
  const z3 = zonePct.Z3
  const z5 = zonePct.Z5
  let polarizedMatch
  if (zoneSum <= 0) {
    polarizedMatch = 'poor'
  } else if (z2 >= 70 && z5 >= 5 && z5 <= 15 && z3 <= 10) {
    polarizedMatch = 'good'
  } else if (z2 >= 60 && z5 >= 5 && z3 <= 20) {
    polarizedMatch = 'moderate'
  } else {
    polarizedMatch = 'poor'
  }

  return {
    zones: zonePct,
    intents: intentPct,
    weeklyAvg,
    polarizedMatch,
    polarizedNote: NOTES[polarizedMatch],
    totalSessions,
    weeksObserved,
    reliable: weeksObserved >= 4,
    citation: TRAINING_DISTRIBUTION_CITATION,
  }
}
