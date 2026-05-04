// ─── vo2GapDetector.js — VO2/Z5 Stimulus Gap Detector (28d) ──────────────────
// Flags when an athlete has gone too long without Z5 (VO2max) work, or when
// monthly Z5 share is below the polarized-training threshold. Stöggl & Sperlich
// 2014 show that ≥5% of weekly volume in Z5 is necessary to drive VO2max gains;
// Seiler 2010 confirms ~5–10% high-intensity in polarized models. Even a single
// Z5 stimulus per 7–10 days protects the high end of the aerobic envelope.
//
// This complements staleZones (which compares zone shares) and detrainingDetector
// (which flags total inactivity gaps) by zooming in on Z5 recency + dose.
// Cite: Stöggl & Sperlich 2014; Seiler 2010
// ─────────────────────────────────────────────────────────────────────────────

export const VO2_GAP_CITATION = 'Stöggl & Sperlich 2014; Seiler 2010'

// ─── Thresholds (days since last Z5; 28d share %) ────────────────────────────
// Bands ordered by severity. Band escalates if EITHER recency or share is bad.
const RECENCY_OK = 10        // ≤10 days since last Z5 → fresh
const RECENCY_WARNING = 14   // 11–14 → warning
const RECENCY_CRITICAL = 21  // 15–21 → critical; ≥22 → severe
const SHARE_TARGET = 5       // ≥5% of 28d load → on target
const SHARE_LOW = 2          // <2% → critically low

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDays(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00Z')
  const b = new Date(bStr + 'T00:00:00Z')
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

// ─── Zone parsing (mirrors staleZones.entryZoneContributions) ────────────────
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
      const v = Number(z[`Z${i + 1}`] ?? z[`z${i + 1}`] ?? 0)
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

// ─── Band classification ─────────────────────────────────────────────────────
/**
 * Compute band from days-since-Z5 and 28d Z5 share. Severity escalates if
 * EITHER signal is bad — recency catches "haven't done VO2 in 3 weeks" and
 * share catches "always tiny intervals, never enough".
 *
 * Returned bands:
 *   ok        : recency ≤ 10d AND share ≥ 5%
 *   warning   : recency ≤ 14d AND share ≥ 2%, but not ok
 *   critical  : recency ≤ 21d OR share ≥ 2%, but not warning/ok
 *   severe    : recency > 21d OR share < 2% with non-zero overall load
 *   never     : no Z5 minute ever observed in window AND there IS load (worst)
 */
function bandFor(daysSinceZ5, share28d, hasAnyLoad) {
  if (!hasAnyLoad) return 'ok' // no training at all → nothing to flag here
  if (daysSinceZ5 == null) return 'never'
  if (daysSinceZ5 > RECENCY_CRITICAL) return 'severe'
  if (share28d < SHARE_LOW) return 'severe'
  if (daysSinceZ5 > RECENCY_WARNING) return 'critical'
  if (daysSinceZ5 > RECENCY_OK) return 'warning'
  if (share28d < SHARE_TARGET) return 'warning'
  return 'ok'
}

const MESSAGES = {
  ok: {
    en: 'VO2max stimulus on target',
    tr: 'VO2max uyaranı hedefte',
  },
  warning: {
    en: 'VO2max work tapering — schedule a Z5 session',
    tr: 'VO2max çalışması azalıyor — bir Z5 antrenmanı planla',
  },
  critical: {
    en: 'Significant VO2max gap — Z5 work overdue',
    tr: 'Belirgin VO2max boşluğu — Z5 çalışması gecikti',
  },
  severe: {
    en: 'Prolonged VO2max gap — top-end fitness fading',
    tr: 'Uzun süreli VO2max boşluğu — üst seviye fitness düşüyor',
  },
  never: {
    en: 'No VO2max work logged in 28 days',
    tr: 'Son 28 günde VO2max çalışması kaydedilmemiş',
  },
}

const RECOMMENDATIONS = {
  ok: { en: '', tr: '' },
  warning: {
    en: 'Add 1 short VO2 session this week (e.g., 5×3 min @ Z5, 3 min recovery)',
    tr: 'Bu hafta 1 kısa VO2 antrenmanı ekle (örn. 5×3 dk Z5, 3 dk toparlanma)',
  },
  critical: {
    en: 'Schedule a VO2max workout in next 3 days; keep volume modest if fatigued',
    tr: 'Önümüzdeki 3 gün içinde VO2max antrenmanı planla; yorgunsan hacmi düşük tut',
  },
  severe: {
    en: 'Reintroduce Z5 carefully: start with 3–4×2 min, full recoveries; build back over 2 weeks',
    tr: 'Z5\'i dikkatli yeniden başlat: 3–4×2 dk, tam toparlanma; 2 haftada kademeli artır',
  },
  never: {
    en: 'Begin with a low-dose VO2 primer (4×2 min Z5, full recovery) before adding intensity',
    tr: 'Düşük dozlu VO2 ile başla (4×2 dk Z5, tam toparlanma); ardından yoğunluğu artır',
  },
}

// ─── detectVO2Gap ────────────────────────────────────────────────────────────
/**
 * Detect VO2max / Z5 stimulus gap over a trailing 28-day window.
 *
 * Inputs:
 *   - log: training_log entries. Z5 contribution per entry is read via
 *     entryZoneContributions (same convention as staleZones).
 *   - today: 'YYYY-MM-DD' reference; deterministic override for tests.
 *
 * Outputs:
 *   - daysSinceZ5: integer days since most recent entry with Z5 > 0
 *     (within the 28-day window). null if none in window.
 *   - z5Sessions: count of sessions in window with any Z5 contribution.
 *   - z5Total: sum of Z5 contributions in window (TSS or minutes — depends
 *     on the unit the caller stored in entry.zones).
 *   - share28d: Z5 % of total 28d zone load (0 if no load).
 *   - lastZ5Date: 'YYYY-MM-DD' of most recent Z5 session in window (or null).
 *   - band: 'ok' | 'warning' | 'critical' | 'severe' | 'never'
 *   - reliable: true when ≥14 distinct logged days are present in window
 *
 * @param {Array} log
 * @param {string} [today]
 * @returns {{
 *   daysSinceZ5: number|null,
 *   z5Sessions: number,
 *   z5Total: number,
 *   share28d: number,
 *   lastZ5Date: string|null,
 *   band: 'ok'|'warning'|'critical'|'severe'|'never',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectVO2Gap(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    daysSinceZ5: null,
    z5Sessions: 0,
    z5Total: 0,
    share28d: 0,
    lastZ5Date: null,
    band: 'ok',
    message: { ...MESSAGES.ok },
    recommendation: { ...RECOMMENDATIONS.ok },
    reliable: false,
    citation: VO2_GAP_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  const start28 = addDaysStr(today, -27)

  // Tally totals per zone, count Z5 sessions, track most recent Z5 date.
  let z5Sessions = 0
  let z5Total = 0
  let lastZ5Date = null
  let total28 = 0
  const distinctDays = new Set()

  for (const entry of log) {
    const d = entry?.date
    if (typeof d !== 'string' || d.length < 10) continue
    const ds = d.slice(0, 10)
    if (ds < start28 || ds > today) continue
    distinctDays.add(ds)

    const contribs = entryZoneContributions(entry)
    const z5 = contribs[4] || 0
    for (let i = 0; i < 5; i++) total28 += contribs[i]

    if (z5 > 0) {
      z5Sessions++
      z5Total += z5
      if (lastZ5Date == null || ds > lastZ5Date) lastZ5Date = ds
    }
  }

  const daysSinceZ5 = lastZ5Date ? diffDays(today, lastZ5Date) : null
  const share28d = total28 > 0 ? (z5Total / total28) * 100 : 0
  const hasAnyLoad = total28 > 0
  const band = bandFor(daysSinceZ5, share28d, hasAnyLoad)
  const reliable = distinctDays.size >= 14

  return {
    daysSinceZ5,
    z5Sessions,
    z5Total: Math.round(z5Total * 10) / 10,
    share28d: Math.round(share28d * 10) / 10,
    lastZ5Date,
    band,
    message: { ...MESSAGES[band] },
    recommendation: { ...RECOMMENDATIONS[band] },
    reliable,
    citation: VO2_GAP_CITATION,
  }
}
