// ─── src/lib/recovery/sessionRecommendation.js — E17 session recommender ────
// Pure function. Maps the morning readiness composite score to one of four
// session-intent buckets, with a bilingual rationale and a science citation.
//
// Threshold bands (Plews 2013 readiness gating, Foster 1998 wellness):
//   score < 40        → 'recovery'  — active recovery / mobility only
//   40 ≤ score < 60   → 'easy'      — Z2 aerobic, no quality
//   60 ≤ score < 80   → 'planned'   — execute the planned session
//   score ≥ 80        → 'push'      — green light for one quality session
//
// The function NEVER tells the athlete to push when readiness is borderline.
// If `readinessScore` is null/undefined (insufficient data) we degrade to
// 'easy' with a transparent reason.
//
// References:
//   Plews DJ et al. 2013, IJSPP — HRV-guided training adjustments
//   Foster C 1998, MSSE        — session-RPE & wellness modulation of load
// ─────────────────────────────────────────────────────────────────────────────

const CITATION = 'Plews 2013 · Foster 1998'

const REASONS = Object.freeze({
  recovery: {
    en: 'Readiness very low — body is signalling stress. Active recovery only (mobility, walk, easy spin ≤30 min).',
    tr: 'Hazır olma çok düşük — vücut stres sinyali veriyor. Sadece aktif toparlanma (mobilite, yürüyüş, ≤30 dk hafif çevirme).',
  },
  easy: {
    en: 'Readiness moderate — keep it aerobic. Replace planned intensity with Zone 2 only.',
    tr: 'Hazır olma orta — aerobik tut. Planlanan yoğunluğu sadece Zon 2 ile değiştir.',
  },
  planned: {
    en: 'Readiness solid — execute the planned session as scheduled.',
    tr: 'Hazır olma sağlam — planlanan seansı programdaki gibi yap.',
  },
  push: {
    en: 'Readiness elevated — green light for one quality session today (intervals, threshold, or VO2max).',
    tr: 'Hazır olma yüksek — bugün bir kaliteli seans için yeşil ışık (interval, eşik veya VO2maks).',
  },
  unknown: {
    en: 'Readiness data insufficient — defaulting to an easy aerobic session for safety.',
    tr: 'Hazır olma verisi yetersiz — güvenlik için kolay aerobik seansa düşürüldü.',
  },
})

/**
 * Map a planned session (any free-form `kind` string) plus a readiness score
 * to a recommended session intent.
 *
 * @param {number|null|undefined} readinessScore  0–100 composite readiness
 * @param {{ kind?: string }|null}  [plannedSession]  optional planned session
 * @returns {{
 *   recommended: 'recovery'|'easy'|'planned'|'push',
 *   reason: { en: string, tr: string },
 *   citation: string,
 *   score: number|null,
 *   plannedKind: string|null,
 * }}
 */
export function recommendSession(readinessScore, plannedSession = null) {
  const plannedKind = plannedSession && typeof plannedSession.kind === 'string'
    ? plannedSession.kind
    : null

  // Insufficient data → conservative default
  if (readinessScore == null || isNaN(readinessScore)) {
    return {
      recommended: 'easy',
      reason: REASONS.unknown,
      citation: CITATION,
      score: null,
      plannedKind,
    }
  }

  const s = Math.max(0, Math.min(100, readinessScore))

  let recommended
  if (s < 40)        recommended = 'recovery'
  else if (s < 60)   recommended = 'easy'
  else if (s < 80)   recommended = 'planned'
  else               recommended = 'push'

  // Special case: if the planned session was already a recovery day and the
  // athlete has high readiness, we still recommend 'planned' (don't override
  // a deliberately-planned recovery day with quality work).
  if (recommended === 'push' && plannedKind && /recovery|rest|off/i.test(plannedKind)) {
    return {
      recommended: 'planned',
      reason: {
        en: 'Readiness high but planned day is recovery — respect the plan.',
        tr: 'Hazır olma yüksek ama planlanan gün toparlanma — plana sadık kal.',
      },
      citation: CITATION,
      score: s,
      plannedKind,
    }
  }

  return {
    recommended,
    reason: REASONS[recommended],
    citation: CITATION,
    score: s,
    plannedKind,
  }
}

export const SESSION_REASONS = REASONS
export const SESSION_CITATION = CITATION
