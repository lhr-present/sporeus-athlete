// src/lib/athlete/efDecouplingMismatch.js
//
// EF × Decoupling mismatch — cross-reads two mature, independently-shipped
// aerobic trend signals that the system has never correlated:
//
//   1. Aerobic Efficiency Factor (EF) trend — Coggan 2003 NP/HR or pace/HR,
//      classified over weekly medians (improving / stable / declining).
//      Source: computeAerobicEfficiencyTrend (src/lib/science/aerobicEfficiency.js)
//
//   2. Aerobic decoupling (Pw:Hr drift) trend — Friel method, averaged across
//      recent aerobic-effort (RPE ≤ 6) sessions (good / mild / significant).
//      Source: analyzeDecouplingTrend (src/lib/athlete/decouplingTrend.js)
//
// Each signal alone is ambiguous. EF rising while decoupling also rises is a
// classic "engine improving but you're drifting / under-fueling on long
// efforts" pattern — the athlete adds output but can't hold it relative to HR.
// EF rising with controlled drift is genuine base consolidation. EF flat with
// rising drift means the base is stalling and intensity should back off. This
// module collapses the two into a single 4-quadrant action read.
//
// Pure function. No React, no I/O.

import { computeAerobicEfficiencyTrend } from '../science/aerobicEfficiency.js'
import { analyzeDecouplingTrend } from './decouplingTrend.js'

/**
 * @description Normalize the EF classification into a binary axis.
 *   'improving' → improving; 'stable' | 'declining' → flat/declining.
 * @param {string} classification
 * @returns {'improving'|'flat'}
 */
function efAxis(classification) {
  return classification === 'improving' ? 'improving' : 'flat'
}

/**
 * @description Normalize the decoupling flag into a binary axis.
 *   'mild' | 'significant' → rising drift; 'good' → flat/controlled drift.
 *   The decoupling analyzer returns flag === 'good' with summary === null when
 *   drift is healthy, so 'good' is the "flat/controlled" arm.
 * @param {string} flag
 * @returns {'rising'|'flat'}
 */
function decoupleAxis(flag) {
  return flag === 'mild' || flag === 'significant' ? 'rising' : 'flat'
}

/**
 * @description Cross-read the EF trend and decoupling trend into a single
 *   4-quadrant interpretation. Returns null when EITHER underlying signal
 *   lacks enough data to classify — so the card can hide rather than show a
 *   half-formed cross-read.
 *
 * Either pass pre-computed trend results via `opts`, or pass a `log` (+ optional
 * `today`) and this function will call both libs itself.
 *
 * @param {Object[]} log     - training log (used when trend results not supplied)
 * @param {Object}   [opts]
 * @param {string}   [opts.today]        - 'YYYY-MM-DD'
 * @param {Object}   [opts.efTrend]      - result of computeAerobicEfficiencyTrend
 * @param {Object}   [opts.decoupleTrend]- result of analyzeDecouplingTrend
 * @returns {{
 *   quadrant: 'improving_rising' | 'improving_flat' | 'flat_rising' | 'flat_flat',
 *   headline: { en: string, tr: string },
 *   detail:   { en: string, tr: string },
 *   efClass:  'improving' | 'stable' | 'declining',
 *   decoupleFlag: 'good' | 'mild' | 'significant',
 *   avgDecouplePct: number,
 *   weeklyGain: number,
 * } | null}
 */
export function efDecouplingMismatch(log = [], opts = {}) {
  const { today, efTrend: efIn, decoupleTrend: dcIn } = opts || {}

  const efTrend = efIn !== undefined
    ? efIn
    : computeAerobicEfficiencyTrend(Array.isArray(log) ? log : [], 8, today || undefined)

  const decoupleTrend = dcIn !== undefined
    ? dcIn
    : analyzeDecouplingTrend(Array.isArray(log) ? log : [], today)

  // EF trend lacks data → null. Decoupling lacks data → flag is null.
  if (!efTrend || !efTrend.classification) return null
  if (!decoupleTrend || !decoupleTrend.flag || !Number.isFinite(decoupleTrend.avgPct)) {
    return null
  }

  const ef = efAxis(efTrend.classification)
  const dc = decoupleAxis(decoupleTrend.flag)
  const quadrant = `${ef}_${dc}` // improving_rising | improving_flat | flat_rising | flat_flat

  const QUADRANTS = {
    improving_rising: {
      headline: {
        en: 'Engine improving — but drifting on long efforts',
        tr: 'Motor gelişiyor — ama uzun çabalarda kayma var',
      },
      detail: {
        en: 'Your aerobic efficiency is climbing, yet Pw:Hr drift is rising — a sign you are drifting or under-fuelling on longer efforts. Hold steady-state Z2 and lock in fuelling before the next intensity block.',
        tr: 'Aerobik verimliliğin yükseliyor ama Pw:Hr kayması artıyor — uzun çabalarda kaydığının ya da yetersiz beslendiğinin işareti. Bir sonraki yoğunluk bloğundan önce sabit-hızlı Z2 koru ve beslenmeyi oturt.',
      },
    },
    improving_flat: {
      headline: {
        en: 'Base consolidating — efficiency up, drift controlled',
        tr: 'Temel oturuyor — verimlilik artıyor, kayma kontrol altında',
      },
      detail: {
        en: 'Aerobic efficiency is improving while cardiac drift stays controlled — the base is genuinely consolidating. Keep the current ratio of easy volume to intensity.',
        tr: 'Aerobik verimlilik artarken kardiyak kayma kontrol altında kalıyor — temel gerçekten oturuyor. Mevcut kolay hacim / yoğunluk dengesini koru.',
      },
    },
    flat_rising: {
      headline: {
        en: 'Efficiency stalled, drift worsening — back off intensity',
        tr: 'Verimlilik durdu, kayma kötüleşiyor — yoğunluğu azalt',
      },
      detail: {
        en: 'Efficiency has stalled and Pw:Hr drift is worsening together — the aerobic base cannot sustain the current demand. Back off intensity and rebuild steady-state aerobic volume.',
        tr: 'Verimlilik durdu ve Pw:Hr kayması birlikte kötüleşiyor — aerobik temel mevcut talebi taşıyamıyor. Yoğunluğu azalt ve sabit-hızlı aerobik hacmi yeniden inşa et.',
      },
    },
    flat_flat: {
      headline: {
        en: 'Holding steady — no clear aerobic trend',
        tr: 'Sabit gidiyor — net bir aerobik eğilim yok',
      },
      detail: {
        en: 'Efficiency and cardiac drift are both holding steady — no clear aerobic trend either way. Stay the course and keep logging; a signal will emerge as volume accumulates.',
        tr: 'Verimlilik ve kardiyak kayma sabit gidiyor — her iki yönde de net bir aerobik eğilim yok. Programı sürdür ve kayıt tutmaya devam et; hacim biriktikçe bir sinyal belirecek.',
      },
    },
  }

  const q = QUADRANTS[quadrant]

  return {
    quadrant,
    headline: q.headline,
    detail: q.detail,
    efClass: efTrend.classification,
    decoupleFlag: decoupleTrend.flag,
    avgDecouplePct: decoupleTrend.avgPct,
    weeklyGain: efTrend.weeklyGain,
  }
}

export default efDecouplingMismatch
