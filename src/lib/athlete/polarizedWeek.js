// src/lib/athlete/polarizedWeek.js
//
// v9.125.0 — TodayView-shaped wrapper around weeklyPolarizationScore.
//
// `lib/science/polarizationCompliance.js` (v8 era) already computes
// the Seiler 80/20 split for any week and classifies the result as
// polarized / pyramidal / threshold / unstructured. There's a
// Dashboard card (PolarizationComplianceCard) that surfaces an 8-week
// trend, but the daily view never sees it.
//
// This wrapper takes today's date, resolves the current week's Monday,
// runs the existing scorer, and returns a small UI-shaped object that
// includes:
//   - `flag`: 'polarized' (silent) | 'drift-threshold' | 'drift-unstructured'
//             | 'drift-pyramidal' | null (insufficient data)
//   - `interpretation`: bilingual one-sentence read on the model
//
// The flag drives a TodayView chip that's silent when the week is
// already polarized — silence is the absence of a problem. A week
// drifting into Z3-heavy ("no-man's-land" per Seiler 2010) gets an
// amber surface.
//
// Pure function — delegates math to polarizationCompliance.js.

import { weekStart, weeklyPolarizationScore } from '../science/polarizationCompliance.js'

/**
 * @description Resolve current week's score + render-friendly flag.
 *   Returns null when sample is too small or no log data.
 */
export function analyzePolarizedWeek(log, today) {
  const tToday = today || new Date().toISOString().slice(0, 10)
  const monday = weekStart(tToday)
  const score = weeklyPolarizationScore(log, monday)
  if (!score || score.model === 'insufficient_data') return null

  // Map model → flag + interpretation
  let flag = null
  let interpretation = null
  switch (score.model) {
    case 'polarized':
      flag = 'polarized'  // silent
      break
    case 'threshold':
      flag = 'drift-threshold'
      interpretation = {
        en: `${score.thresholdPct}% of work is threshold-zone — Seiler's "no-man's-land." Shift volume to easy (Z1–Z2) work; reserve hard sessions for quality intervals.`,
        tr: `Çalışmanın %${score.thresholdPct}'i eşik bölgesinde — Seiler'in "ölü bölgesi." Hacmi kolay (Z1–Z2) çalışmaya kaydır; sert seansları kaliteli aralıklara sakla.`,
      }
      break
    case 'pyramidal':
      flag = 'drift-pyramidal'
      interpretation = {
        en: `Pyramidal model: ${score.easyPct}% easy / ${score.thresholdPct}% threshold / ${score.hardPct}% hard. Valid for some sport contexts (e.g. crit racing) but not optimal for steady-state endurance.`,
        tr: `Piramidal model: %${score.easyPct} kolay / %${score.thresholdPct} eşik / %${score.hardPct} sert. Bazı spor bağlamları için geçerli; süreğen dayanıklılık için optimum değil.`,
      }
      break
    case 'unstructured':
    default:
      flag = 'drift-unstructured'
      interpretation = {
        en: `Distribution lacks clear structure: ${score.easyPct}% easy / ${score.thresholdPct}% threshold / ${score.hardPct}% hard. Anchor the week around an 80/20 polarized split.`,
        tr: `Dağılımda net yapı yok: %${score.easyPct} kolay / %${score.thresholdPct} eşik / %${score.hardPct} sert. Haftayı 80/20 polarize ayrımına oturt.`,
      }
      break
  }

  return {
    flag,
    weekStart: monday,
    easyPct:      score.easyPct,
    thresholdPct: score.thresholdPct,
    hardPct:      score.hardPct,
    totalMin:     score.totalMin,
    model:        score.model,
    complianceScore: score.complianceScore,
    interpretation,
    citation:     'Seiler 2010 (polarized training)',
  }
}
