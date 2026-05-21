// ─── veryEasyShare.js — RPE-based Very-Easy Training Share (MAF / aerobic base)
//
// Maffetone (2010) MAF aerobic-base framework + Seiler (2010) polarized model.
// Both argue that the central driver of aerobic adaptation (mitochondrial
// density, fat-oxidation capacity, capillarisation) is time spent at TRULY
// easy intensities — Maffetone's "MAF zone" feels nearly effortless
// ("you can barely tell you're exercising"). Many amateur athletes self-
// report "easy" sessions that are actually mid-Z2 with measurable lactate
// accumulation. This module tracks the share of training MINUTES at
// subjectively very-easy effort (RPE ≤ 3 on the 1-10 Borg CR10 scale)
// across the last `windowDays` (default 30).
//
// DIFFERENT lens from existing cards:
//   - WeeklyEnduranceTimeCard       — absolute Z1+Z2 minutes/week (zone-based)
//   - TimeInZoneCard                — zone share snapshot
//   - PolarizationComplianceCard    — Seiler 80/20 model compliance
//
// This card uses RPE only (no zone field needed) and a stricter "very easy"
// gate (RPE ≤ 3, not RPE ≤ 4 which the WeeklyEnduranceTimeCard uses as a
// fallback). It also tracks DATA HYGIENE: sessions logged with duration but
// no/invalid RPE are surfaced as `unratedSessionCount`.
//
// Bands (when sufficient rated data exists):
//   INSUFFICIENT_BASE   — veryEasyShare < 0.30   (too much non-easy work)
//   BUILDING_BASE       — 0.30 ≤ share < 0.55
//   STRONG_BASE         — 0.55 ≤ share ≤ 0.80
//   EXCESSIVE_EASY      — share > 0.80           (likely under-training)
//   INSUFFICIENT_DATA   — totalRatedMin < 60
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Maffetone P. (2010). The Big Book of Endurance Training and Racing.
//   Seiler S. (2010). What is best practice for training intensity and
//     duration distribution in endurance athletes? IJSPP.
// ─────────────────────────────────────────────────────────────────────────────

export const VERY_EASY_SHARE_CITATION = 'Maffetone 2010; Seiler 2010'

const DEFAULT_WINDOW_DAYS = 30
const DEFAULT_VERY_EASY_RPE_MAX = 3
const MIN_RATED_MIN = 60

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────

function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) return key
  }
  return null
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function entryDurationMin(entry) {
  const raw = entry?.durationMin ?? entry?.duration_min
  const d = Number(raw)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function round4(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10000) / 10000
}

function classifyBand(share) {
  if (share < 0.30) return 'INSUFFICIENT_BASE'
  if (share < 0.55) return 'BUILDING_BASE'
  if (share <= 0.80) return 'STRONG_BASE'
  return 'EXCESSIVE_EASY'
}

function emptyInsufficient() {
  return {
    band: 'INSUFFICIENT_DATA',
    veryEasyMin: 0,
    totalRatedMin: 0,
    veryEasyShare: 0,
    ratedSessionCount: 0,
    unratedSessionCount: 0,
    citation: VERY_EASY_SHARE_CITATION,
  }
}

/**
 * Analyze the share of training minutes spent at very-easy RPE (≤ veryEasyRpeMax)
 * across the last `windowDays` days ending in `today`.
 *
 * @param {object}      args
 * @param {Array}       args.log                       - training_log entries
 *                                                       (need `date` ISO, plus
 *                                                       `durationMin`/`duration_min`
 *                                                       and `rpe`)
 * @param {string|Date} args.today                     - reference date
 * @param {number}      [args.windowDays=30]
 * @param {number}      [args.veryEasyRpeMax=3]
 *
 * @returns {{
 *   band: 'INSUFFICIENT_BASE'|'BUILDING_BASE'|'STRONG_BASE'|'EXCESSIVE_EASY'|'INSUFFICIENT_DATA',
 *   veryEasyMin: number,
 *   totalRatedMin: number,
 *   veryEasyShare: number,
 *   ratedSessionCount: number,
 *   unratedSessionCount: number,
 *   citation: string,
 * } | null}
 *
 * Returns null only when `today` cannot be resolved.
 */
export function analyzeVeryEasyShare({
  log,
  today,
  windowDays = DEFAULT_WINDOW_DAYS,
  veryEasyRpeMax = DEFAULT_VERY_EASY_RPE_MAX,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  if (!Array.isArray(log)) return emptyInsufficient()

  const safeWindow = Math.floor(Number(windowDays))
  if (!Number.isFinite(safeWindow) || safeWindow < 1) {
    return emptyInsufficient()
  }

  const safeRpeMax = Number(veryEasyRpeMax)
  if (!Number.isFinite(safeRpeMax)) return emptyInsufficient()

  const startIso = isoMinusDays(todayIso, safeWindow - 1)

  let veryEasyMin = 0
  let totalRatedMin = 0
  let ratedSessionCount = 0
  let unratedSessionCount = 0

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    if (key < startIso) continue
    if (key > todayIso) continue

    const dur = entryDurationMin(e)
    if (dur <= 0) continue

    const rpeRaw = e.rpe
    const rpe = Number(rpeRaw)
    const validRpe =
      Number.isFinite(rpe) && rpe >= 1 && rpe <= 10

    if (!validRpe) {
      unratedSessionCount += 1
      continue
    }

    totalRatedMin += dur
    ratedSessionCount += 1
    if (rpe <= safeRpeMax) {
      veryEasyMin += dur
    }
  }

  if (totalRatedMin < MIN_RATED_MIN) {
    return {
      band: 'INSUFFICIENT_DATA',
      veryEasyMin: 0,
      totalRatedMin: 0,
      veryEasyShare: 0,
      ratedSessionCount: 0,
      unratedSessionCount,
      citation: VERY_EASY_SHARE_CITATION,
    }
  }

  const veryEasyShare = round4(veryEasyMin / Math.max(totalRatedMin, 1))
  const band = classifyBand(veryEasyShare)

  return {
    band,
    veryEasyMin,
    totalRatedMin,
    veryEasyShare,
    ratedSessionCount,
    unratedSessionCount,
    citation: VERY_EASY_SHARE_CITATION,
  }
}
