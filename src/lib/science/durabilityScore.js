// src/lib/science/durabilityScore.js
// E12 — Durability: ability to sustain high-end power deep into long efforts.
//
// Durability compares the athlete's best 5-minute power in the LAST HOUR of a
// long session (≥90 min) against a rested-state baseline 5-minute MMP (maximal
// mean power). A high durability score means fatigue-induced power degradation
// is small — a key predictor of endurance event performance.
//
// durability% = (lastHour5minPeak / baseline5minMMP) × 100
//
// Thresholds (Maunder et al. 2021):
//   ≥ 95%    — high          (elite endurance athletes)
//   90–95%   — moderate      (trained athletes)
//   85–90%   — low           (moderate impairment)
//   < 85%    — very_low      (significant fatigue-related decline)
//
// Valid only for sessions ≥ 90 minutes with a 1-Hz power stream.
//
// References:
//   Maunder E. et al. (2021). Relevance of training volume, intensity distribution
//     and durability to middle- and long-distance triathlon. Sports Med 51:1523–1550.
//   Rønnestad B.R. & Vikmoen O. (2019). Physiological determinants of performance
//     in cycling. Sports Med.

// ── Citation ──────────────────────────────────────────────────────────────────

export const DURABILITY_CITATION =
  'Maunder E. et al. (2021) Sports Med 51:1523–1550; Rønnestad & Vikmoen (2019) Sports Med.'

// v9.480 — scalar path: sessions synced from Strava (or FIT cross-device)
// carry a compact powerPeaks vector instead of a raw stream. lh300 IS the
// durability numerator (best 5-min in the final hour), so the score computes
// from two scalars. NOTE: entry.powerStream was a field NOTHING produced —
// this card was dead for all real data until the peaks path existed.
/**
 * @param {Object} session - { powerPeaks: { lh300 }, durationSec?|duration? (min) }
 * @param {number} baselineMMP5min
 * @returns same shape as computeDurability, or null
 */
export function computeDurabilityFromPeaks(session, baselineMMP5min) {
  if (!session || !baselineMMP5min || baselineMMP5min <= 0) return null
  const lh300 = Number(session.powerPeaks?.lh300)
  if (!Number.isFinite(lh300) || lh300 <= 0) return null
  const durationSec = Number(session.durationSec) > 0
    ? Number(session.durationSec)
    : (Number(session.duration) || 0) * 60
  if (durationSec < MIN_DURATION_SEC) return null

  const durabilityPct = Math.round((lh300 / baselineMMP5min) * 100 * 10) / 10
  const tier =
    durabilityPct >= DURABILITY_THRESHOLDS.high     ? 'high' :
    durabilityPct >= DURABILITY_THRESHOLDS.moderate ? 'moderate' :
    durabilityPct >= DURABILITY_THRESHOLDS.low      ? 'low' :
                                                      'very_low'
  return {
    durabilityPct,
    lastHour5minPeak: lh300,
    baselineMMP5min,
    tier,
    durationSec,
    citation: DURABILITY_CITATION,
  }
}

// ── Thresholds ────────────────────────────────────────────────────────────────

export const DURABILITY_THRESHOLDS = Object.freeze({
  high:     95,   // ≥ 95%
  moderate: 90,   // 90–95%
  low:      85,   // 85–90%
  // < 85% = 'very_low'
})

// ── Minimum valid session duration ───────────────────────────────────────────
const MIN_DURATION_SEC = 90 * 60   // 90 minutes
const WINDOW_SEC       = 60 * 60   // analyse last 60 minutes
const PEAK_WINDOW_SEC  = 5  * 60   // 5-minute peak window

// ── Internal: rolling mean over window ────────────────────────────────────────
function _rollingMean(arr, windowSize) {
  let best = 0
  for (let i = 0; i <= arr.length - windowSize; i++) {
    let sum = 0
    for (let j = i; j < i + windowSize; j++) sum += arr[j]
    const mean = sum / windowSize
    if (mean > best) best = mean
  }
  return best
}

// ── computeDurability ─────────────────────────────────────────────────────────

/**
 * Compute durability score for a single long session.
 *
 * @param {Object} session
 * @param {number[]} session.powerStream  - 1-Hz power data (watts). Required.
 * @param {number}   [session.durationSec] - Total duration (s). Defaults to powerStream.length.
 * @param {number}   baselineMMP5min       - Athlete's rested-state best 5-min power (W).
 *
 * @returns {{
 *   durabilityPct: number,
 *   lastHour5minPeak: number,
 *   baselineMMP5min: number,
 *   tier: 'high'|'moderate'|'low'|'very_low',
 *   durationSec: number,
 *   citation: string,
 * } | null}  null when preconditions are not met
 */
export function computeDurability(session, baselineMMP5min) {
  if (!session) return null
  if (!baselineMMP5min || baselineMMP5min <= 0) return null

  const { powerStream } = session
  if (!Array.isArray(powerStream) || powerStream.length === 0) return null

  const durationSec = session.durationSec ?? powerStream.length

  // Must be ≥ 90 min
  if (durationSec < MIN_DURATION_SEC) return null

  // The analysis window: last 60 minutes of the effort
  const windowStart = Math.max(0, powerStream.length - WINDOW_SEC)
  const lastHourSlice = powerStream.slice(windowStart)

  // Need at least a full 5-min window in the last hour
  if (lastHourSlice.length < PEAK_WINDOW_SEC) return null

  // Best 5-min rolling mean in the last-hour slice
  const lastHour5minPeak = _rollingMean(lastHourSlice, PEAK_WINDOW_SEC)

  const durabilityPct = Math.round((lastHour5minPeak / baselineMMP5min) * 100 * 10) / 10

  const tier =
    durabilityPct >= DURABILITY_THRESHOLDS.high     ? 'high' :
    durabilityPct >= DURABILITY_THRESHOLDS.moderate ? 'moderate' :
    durabilityPct >= DURABILITY_THRESHOLDS.low      ? 'low' :
                                                      'very_low'

  return {
    durabilityPct,
    lastHour5minPeak: Math.round(lastHour5minPeak * 10) / 10,
    baselineMMP5min,
    tier,
    durationSec,
    citation: DURABILITY_CITATION,
  }
}

// ── classifyDurability ─────────────────────────────────────────────────────────

/**
 * Classify a durability percentage into a tier string.
 *
 * @param {number} pct
 * @returns {'high'|'moderate'|'low'|'very_low'}
 */
export function classifyDurability(pct) {
  if (pct >= DURABILITY_THRESHOLDS.high)     return 'high'
  if (pct >= DURABILITY_THRESHOLDS.moderate) return 'moderate'
  if (pct >= DURABILITY_THRESHOLDS.low)      return 'low'
  return 'very_low'
}

// ── interpretDurability ─────────────────────────────────────────────────────────

/**
 * Derive a trend direction from a list of computed durability results
 * (oldest → newest, as the card builds them). Compares the latest score to the
 * mean of the earlier scores so a single late session doesn't read as a trend.
 *
 * @param {Array<{durabilityPct:number}>} scores
 * @returns {'rising'|'falling'|'flat'}
 */
function _trendOf(scores) {
  if (!Array.isArray(scores) || scores.length < 2) return 'flat'
  const pcts = scores.map(s => s && s.durabilityPct).filter(p => Number.isFinite(p))
  if (pcts.length < 2) return 'flat'
  const latest = pcts[pcts.length - 1]
  const priors = pcts.slice(0, -1)
  const priorMean = priors.reduce((a, b) => a + b, 0) / priors.length
  const delta = latest - priorMean
  if (delta >= 1.5) return 'rising'
  if (delta <= -1.5) return 'falling'
  return 'flat'
}

/**
 * "So what" interpretation for a durability tier + trend. Turns the bare
 * percentage/tier into a one-line action read, the way ACWRCard renders an
 * interpretation rather than just the ratio.
 *
 * @param {'high'|'moderate'|'low'|'very_low'} tier
 * @param {Array<{durabilityPct:number}>} [scores]  - oldest→newest, for trend
 * @returns {{ en: string, tr: string, trend: 'rising'|'falling'|'flat' }}
 */
export function interpretDurability(tier, scores = []) {
  const trend = _trendOf(scores)

  // Trend-specific reads take priority where they meaningfully change the
  // advice; otherwise fall back to the tier's neutral read.
  const TIER = {
    high: {
      rising: {
        en: 'Fatigue resistance is improving — your long-effort fueling is working. Hold the current approach.',
        tr: 'Yorgunluk direncin gelişiyor — uzun çaba beslenmen işe yarıyor. Mevcut yaklaşımı koru.',
      },
      falling: {
        en: 'Durability is elite but slipping lately — keep an eye on fueling and sleep before the next long block.',
        tr: 'Dayanıklılık elit ama son dönemde geriliyor — sonraki uzun bloktan önce beslenme ve uykuyu gözden geçir.',
      },
      flat: {
        en: 'Elite fatigue resistance — you hold high-end power deep into long efforts. Maintain volume and fueling.',
        tr: 'Elit yorgunluk direnci — uzun çabaların derininde yüksek gücü koruyorsun. Hacmi ve beslenmeyi sürdür.',
      },
    },
    moderate: {
      rising: {
        en: 'Durability is trending up — the long Z2 work is paying off. Keep building volume steadily.',
        tr: 'Dayanıklılık yükselişte — uzun Z2 çalışması karşılığını veriyor. Hacmi istikrarlı artırmaya devam et.',
      },
      falling: {
        en: 'Durability is slipping — guard your long-ride fueling and add easy aerobic volume before it drops further.',
        tr: 'Dayanıklılık geriliyor — uzun antrenman beslenmeni koru ve daha fazla düşmeden kolay aerobik hacim ekle.',
      },
      flat: {
        en: 'Solid durability — you fade only a little late in long efforts. More long Z2 volume will push it toward elite.',
        tr: 'Sağlam dayanıklılık — uzun çabalarda sona doğru çok az soluyorsun. Daha fazla uzun Z2 hacmi seni elite taşır.',
      },
    },
    low: {
      rising: {
        en: 'Durability is improving off a low base — stay with the long aerobic work and dial in mid-effort fueling.',
        tr: 'Dayanıklılık düşük bir temelden gelişiyor — uzun aerobik çalışmayı sürdür ve çaba-ortası beslenmeyi ayarla.',
      },
      falling: {
        en: 'You are fading in the last hour and it is getting worse — prioritise long Z2 volume and test mid-effort fueling now.',
        tr: 'Son saatte soluyorsun ve durum kötüleşiyor — uzun Z2 hacmine öncelik ver ve çaba-ortası beslenmeyi şimdi test et.',
      },
      flat: {
        en: 'Power drops noticeably late in long efforts — add long Z2 volume and rehearse race-day fueling on long rides.',
        tr: 'Uzun çabalarda güç sona doğru belirgin düşüyor — uzun Z2 hacmi ekle ve uzun antrenmanlarda yarış-günü beslenmesini prova et.',
      },
    },
    very_low: {
      rising: {
        en: 'Durability is very low but recovering — keep stacking long easy volume and consistent mid-ride fueling.',
        tr: 'Dayanıklılık çok düşük ama toparlıyor — uzun kolay hacim ve düzenli antrenman-içi beslenmeyi üst üste koymaya devam et.',
      },
      falling: {
        en: 'Fading hard in the last hour and trending down — add long Z2 volume and test mid-ride fueling; this is the biggest limiter.',
        tr: 'Son saatte ciddi soluyorsun ve trend aşağı — uzun Z2 hacmi ekle ve antrenman-içi beslenmeyi test et; en büyük sınırlayıcı bu.',
      },
      flat: {
        en: 'Significant late-effort power loss — your ceiling is fine but you cannot hold it. Build long Z2 volume and fix fueling.',
        tr: 'Belirgin geç-çaba güç kaybı — tavanın iyi ama koruyamıyorsun. Uzun Z2 hacmi inşa et ve beslenmeyi düzelt.',
      },
    },
  }

  const tierReads = TIER[tier] || TIER.very_low
  const read = tierReads[trend] || tierReads.flat
  return { en: read.en, tr: read.tr, trend }
}
