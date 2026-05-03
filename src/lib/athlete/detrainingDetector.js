// ─── detrainingDetector.js — E130: Detraining Detector ──────────────────────
// Scans the training log for extended gaps (≥7 consecutive days with no logged
// sessions) and outputs a structured return-to-training recommendation. Useful
// for athletes returning from illness, travel, or injury.
//
// Severity bands (gap duration):
//   minor    7-13 days   → 1-3 days easy ramp, then resume
//   moderate 14-21 days  → 7 days base rebuild before quality work
//   major    22-42 days  → 2-week base block + reduced peak target
//   severe   >42 days    → restart at 50% prior CTL, 4-week ramp
//
// Per Mujika & Padilla 2000 (detraining): VO2max declines 4-14% in 4 weeks;
// mitochondrial enzymes drop ~25% in 4 weeks; capillary density loss minimal
// up to 3 weeks. Aerobic capacity loss accelerates after week 3.
// ─────────────────────────────────────────────────────────────────────────────

export const DETRAINING_CITATION = 'Mujika & Padilla 2000'

const RELIABLE_MIN_ENTRIES = 14
const GAP_MIN_DAYS = 7

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

/**
 * Difference in whole days between two 'YYYY-MM-DD' strings (later - earlier).
 */
function daysBetween(earlier, later) {
  const a = new Date(earlier + 'T00:00:00Z').getTime()
  const b = new Date(later + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * Add `days` to a 'YYYY-MM-DD' string and return new 'YYYY-MM-DD' (UTC).
 */
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Severity classification ─────────────────────────────────────────────────
/**
 * Map a gap duration in days to a severity band.
 * Bands: <7 null; 7-13 minor; 14-21 moderate; 22-42 major; >=43 severe.
 */
function severityFor(durationDays) {
  if (durationDays < 7) return null
  if (durationDays <= 13) return 'minor'
  if (durationDays <= 21) return 'moderate'
  if (durationDays <= 42) return 'major'
  return 'severe'
}

// ─── Bilingual descriptions and recommendations ──────────────────────────────
const SEVERITY_DESCRIPTION = {
  minor: {
    en: 'Minor gap (7-13 days) — short layoff, fitness largely retained.',
    tr: 'Hafif ara (7-13 gün) — kısa duraklama, form büyük ölçüde korunmuş.',
  },
  moderate: {
    en: 'Moderate gap (14-21 days) — early aerobic decline likely.',
    tr: 'Orta ara (14-21 gün) — erken aerobik düşüş muhtemel.',
  },
  major: {
    en: 'Major gap (22-42 days) — significant detraining of aerobic systems.',
    tr: 'Büyük ara (22-42 gün) — aerobik sistemlerde belirgin form kaybı.',
  },
  severe: {
    en: 'Severe gap (>42 days) — substantial loss; treat as a restart.',
    tr: 'Şiddetli ara (>42 gün) — önemli form kaybı; yeniden başlangıç gibi ele al.',
  },
}

const SEVERITY_RECOMMENDATION = {
  minor: {
    en: 'Ramp 1-3 days easy (RPE 3-4), then resume planned training.',
    tr: '1-3 gün kolay rampa (RPE 3-4), sonra planlanan antrenmana devam.',
  },
  moderate: {
    en: 'Rebuild base for 7 days (Z1-Z2 only) before any quality work.',
    tr: '7 gün temel yeniden kur (sadece Z1-Z2), sonra kalite çalışması.',
  },
  major: {
    en: '2-week aerobic base block; reduce peak fitness target by 10-15%.',
    tr: '2 hafta aerobik temel bloku; pik form hedefini %10-15 azalt.',
  },
  severe: {
    en: 'Restart at 50% prior CTL with a 4-week progressive ramp.',
    tr: 'Önceki CTL\'nin %50\'sinde başla; 4 hafta artan rampa.',
  },
}

const EMPTY_RECOMMENDATION = { en: '', tr: '' }

// ─── detectDetraining ────────────────────────────────────────────────────────
/**
 * Detect extended training gaps (≥7 days no sessions) and output return-to-
 * training guidance. Useful for athletes returning from illness/travel/injury.
 *
 * Severity bands (gap duration):
 *   minor    7-13 days   → 1-3 days easy ramp, then resume
 *   moderate 14-21 days  → 7 days base rebuild before quality work
 *   major    22-42 days  → 2-week base block + reduced peak target
 *   severe   >42 days    → restart at 50% prior CTL, 4-week ramp
 *
 * Per Mujika & Padilla 2000 (detraining): VO2max declines 4-14% in 4 weeks;
 * mitochondrial enzymes drop ~25% in 4 weeks; capillary density loss
 * minimal up to 3 weeks. Aerobic capacity loss accelerates after week 3.
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   gaps: Array<{
 *     startDate: string, endDate: string, durationDays: number,
 *     severity: 'minor'|'moderate'|'major'|'severe',
 *     description: { en: string, tr: string },
 *   }>,
 *   currentGap: number,
 *   inActiveGap: boolean,
 *   activeSeverity: 'minor'|'moderate'|'major'|'severe' | null,
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: 'Mujika & Padilla 2000',
 * }}
 */
export function detectDetraining(log, today = todayStr()) {
  const empty = {
    gaps: [],
    currentGap: 0,
    inActiveGap: false,
    activeSeverity: null,
    recommendation: { ...EMPTY_RECOMMENDATION },
    reliable: false,
    citation: DETRAINING_CITATION,
  }

  if (!Array.isArray(log) || log.length === 0) return empty

  // Collect distinct, valid session dates (≤ today). Same-day duplicates do
  // not create false gaps because we dedupe via Set.
  const distinctDates = new Set()
  for (const e of log) {
    const d = e?.date
    if (typeof d === 'string' && d.length >= 10) {
      const ds = d.slice(0, 10)
      if (ds <= today) distinctDates.add(ds)
    }
  }

  const reliable = log.length >= RELIABLE_MIN_ENTRIES

  if (distinctDates.size === 0) {
    return { ...empty, reliable }
  }

  const sortedDates = [...distinctDates].sort()

  // Detect interior gaps between consecutive sessions: a gap of N "no session"
  // days exists between session A and session B if daysBetween(A,B) = N+1.
  // Per spec: "≥ 7 consecutive days with no entry between two sessions".
  const gaps = []
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = sortedDates[i - 1]
    const next = sortedDates[i]
    const noSessionDays = daysBetween(prev, next) - 1
    if (noSessionDays >= GAP_MIN_DAYS) {
      const sev = severityFor(noSessionDays)
      gaps.push({
        startDate: addDaysStr(prev, 1),
        endDate: addDaysStr(next, -1),
        durationDays: noSessionDays,
        severity: sev,
        description: SEVERITY_DESCRIPTION[sev],
      })
    }
  }

  // Trailing edge: days since most recent session up to today.
  const lastSession = sortedDates[sortedDates.length - 1]
  const currentGap = Math.max(0, daysBetween(lastSession, today))
  const inActiveGap = currentGap >= GAP_MIN_DAYS

  if (inActiveGap) {
    const sev = severityFor(currentGap)
    gaps.push({
      startDate: addDaysStr(lastSession, 1),
      endDate: today,
      durationDays: currentGap,
      severity: sev,
      description: SEVERITY_DESCRIPTION[sev],
    })
  }

  const activeSeverity = inActiveGap ? severityFor(currentGap) : null
  const recommendation = inActiveGap
    ? { ...SEVERITY_RECOMMENDATION[activeSeverity] }
    : { ...EMPTY_RECOMMENDATION }

  return {
    gaps,
    currentGap,
    inActiveGap,
    activeSeverity,
    recommendation,
    reliable,
    citation: DETRAINING_CITATION,
  }
}
