// src/lib/athlete/overreachWatch.js
//
// Overreach Watch — Neuromuscular × Load cross-read. Surfaces a correlation
// the system computes in two places but never reads together:
//
//   1. Neuromuscular freshness (NMF) — accumulated Z4/Z5 load over the last
//      7 days vs the 28-day weekly baseline, classified fresh / normal /
//      accumulated / overreached.
//      Source: computeNMFatigue (src/lib/science/neuromuscularFreshness.js)
//
//   2. Acute:Chronic Workload Ratio (ACWR) — EWMA acute vs chronic TSS,
//      classified optimal / caution / danger / undertraining / insufficient.
//      Source: calculateACWR (src/lib/trainingLoad.js)
//
// Each signal alone is partial. ACWR is a total-load ratio that is blind to
// *what kind* of load drove it — a high-intensity week and a high-volume week
// can produce the same ratio. NMF is intensity-aware but ignores total volume.
// Read together they disambiguate:
//   - overreached NMF + danger ACWR  → real systemic overreach: rest
//   - fresh NMF + danger ACWR        → aerobic volume spike, legs fine:
//                                      cap volume, keep intensity
//   - accumulated NMF + optimal ACWR → intensity is the hidden cost the load
//                                      ratio misses: trim the hard work
//   - everything else                → holding / no clear cross-signal
//
// Pure function. No React, no I/O. Returns null when EITHER signal lacks
// enough data to classify (mirrors efDecouplingMismatch null-on-missing-data).

import { computeNMFatigue } from '../science/neuromuscularFreshness.js'
import { calculateACWR } from '../trainingLoad.js'

/**
 * @description Cross-read neuromuscular freshness and ACWR into a single
 *   action read. Returns null when either underlying signal is insufficient
 *   (ACWR status 'insufficient' = no chronic base, or a short/empty log that
 *   leaves NMF on its zero-baseline default).
 *
 * @param {Object[]} log       - training log entries
 * @param {string}   [today]   - reference date 'YYYY-MM-DD' for the NMF window.
 *                               (calculateACWR always uses the system date.)
 * @returns {{
 *   axis: string,
 *   headline: { en: string, tr: string },
 *   detail:   { en: string, tr: string },
 *   nmClass:   'fresh'|'normal'|'accumulated'|'overreached',
 *   acwrStatus:'optimal'|'caution'|'danger'|'undertraining',
 *   nmScore:   number,
 *   acwrRatio: number,
 * } | null}
 */
export function overreachWatch(log = [], today) {
  const safeLog = Array.isArray(log) ? log : []

  const nm = today
    ? computeNMFatigue(safeLog, today)
    : computeNMFatigue(safeLog)
  const acwr = calculateACWR(safeLog)

  // ACWR with no chronic base → insufficient, hide.
  if (!acwr || acwr.status === 'insufficient' || !Number.isFinite(acwr.ratio)) {
    return null
  }
  // NMF with no high-intensity baseline at all (28d weekly mean === 0) sits on
  // its score=80 / fatigueRatio=0 default — that is a "no signal" state, not a
  // real "fresh" read, so hide rather than show a half-formed cross-read.
  if (!nm || !nm.classification || nm.nmLoad28dWeeklyMean === 0) {
    return null
  }

  const nmClass = nm.classification
  const acwrStatus = acwr.status

  // Quadrant resolution. Priority order matters: the three named cross-reads
  // first, then the neutral fallback.
  let axis
  if (nmClass === 'overreached' && acwrStatus === 'danger') {
    axis = 'systemic_overreach'
  } else if (nmClass === 'fresh' && acwrStatus === 'danger') {
    axis = 'volume_spike'
  } else if (nmClass === 'accumulated' && acwrStatus === 'optimal') {
    axis = 'hidden_intensity_cost'
  } else {
    axis = 'holding'
  }

  const READS = {
    systemic_overreach: {
      headline: {
        en: 'Systemic overreach — both signals red, back off',
        tr: 'Sistemik aşırı yüklenme — iki sinyal de kırmızı, geri çekil',
      },
      detail: {
        en: 'Neuromuscular freshness is depleted AND the acute load spike is in the danger zone — this is true whole-body overreach, not just heavy legs. Take real rest now; an easy week here protects the next block.',
        tr: 'Nöromusküler tazelik tükenmiş VE akut yük sıçraması tehlike bölgesinde — bu sadece ağır bacaklar değil, gerçek tüm-vücut aşırı yüklenmesi. Şimdi gerçek bir dinlenme al; buradaki kolay bir hafta sonraki bloğu korur.',
      },
    },
    volume_spike: {
      headline: {
        en: 'Volume spike — load is high but the legs are fresh',
        tr: 'Hacim sıçraması — yük yüksek ama bacaklar taze',
      },
      detail: {
        en: 'Your acute load is in the danger zone, yet neuromuscular freshness is intact — the spike is aerobic volume, not high-intensity stress. Cap total volume for a few days to let the chronic base catch up, but you can keep the planned intensity work.',
        tr: 'Akut yükün tehlike bölgesinde ama nöromusküler tazeliğin korunmuş — sıçrama yüksek yoğunluk değil, aerobik hacimden kaynaklı. Kronik temelin yetişmesi için birkaç gün toplam hacmi sınırla; ama planlı yoğunluk çalışmalarını sürdürebilirsin.',
      },
    },
    hidden_intensity_cost: {
      headline: {
        en: 'Hidden intensity cost — load looks fine, the legs disagree',
        tr: 'Gizli yoğunluk maliyeti — yük iyi görünüyor, bacaklar katılmıyor',
      },
      detail: {
        en: 'Your acute:chronic ratio reads optimal, but neuromuscular fatigue has accumulated — the load ratio is blind to how hard the recent work was. Trim the high-intensity (Z4/Z5) sessions, not the total volume; the cost is in the intensity the ratio cannot see.',
        tr: 'Akut:kronik oranın optimal görünüyor ama nöromusküler yorgunluk birikmiş — yük oranı son çalışmaların ne kadar zor olduğunu göremez. Toplam hacmi değil, yüksek yoğunluk (Z4/Z5) seanslarını azalt; maliyet oranın göremediği yoğunlukta.',
      },
    },
    holding: {
      headline: {
        en: 'Holding — neuromuscular and load signals agree',
        tr: 'Dengede — nöromusküler ve yük sinyalleri uyumlu',
      },
      detail: {
        en: 'Neuromuscular freshness and acute load are not pulling against each other — no hidden overreach to flag. Stay the course and keep logging intensity so the cross-read stays meaningful.',
        tr: 'Nöromusküler tazelik ile akut yük birbirine ters çekmiyor — işaretlenecek gizli bir aşırı yüklenme yok. Programı sürdür ve yoğunluğu kaydetmeye devam et ki çapraz okuma anlamlı kalsın.',
      },
    },
  }

  const r = READS[axis]

  return {
    axis,
    headline: r.headline,
    detail: r.detail,
    nmClass,
    acwrStatus,
    nmScore: nm.score,
    acwrRatio: acwr.ratio,
  }
}

export default overreachWatch
