// src/lib/athlete/intensityBalance.js — E76
// Computes easy vs hard intensity distribution from the last N weeks.
// Uses RPE: easy = RPE 1–5 (Z1/Z2), hard = RPE 6–10 (Z3+).
// Seiler (2010) polarized target: ~80% easy / 20% hard by DURATION.
//
// Reference: Seiler S. (2010). What is best practice for training intensity
//   and duration distribution in endurance athletes? Int J Sports Physiol Perf 5:276-291.

/**
 * @param {Object[]} log
 * @param {number}   nWeeks  - look-back window (default 4)
 * @param {string}   today   - 'YYYY-MM-DD'
 * @returns {{
 *   easyMin: number, hardMin: number,
 *   easyPct: number, hardPct: number,
 *   status: 'polarized'|'balanced'|'too-hard'|'insufficient',
 *   sessions: number,
 *   en: string, tr: string,
 * } | null}  null if fewer than 4 sessions in window
 */
export function computeIntensityBalance(log, nWeeks = 4, today = new Date().toISOString().slice(0, 10)) {
  if (!log?.length) return null

  const cutoff = new Date(today + 'T12:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() - nWeeks * 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recent = log.filter(e => e.date && e.date >= cutoffStr && e.date <= today && (e.duration || 0) > 0)
  if (recent.length < 4) return { easyMin: 0, hardMin: 0, easyPct: 0, hardPct: 0, status: 'insufficient', sessions: recent.length, en: 'Need 4+ sessions for balance analysis.', tr: '4+ seans gerekiyor.' }

  let easyMin = 0, hardMin = 0
  for (const s of recent) {
    const dur = s.duration || 0
    const rpe = s.rpe || 5
    if (rpe <= 5) easyMin += dur
    else           hardMin += dur
  }

  const totalMin = easyMin + hardMin || 1
  const easyPct  = Math.round(easyMin / totalMin * 100)
  const hardPct  = 100 - easyPct

  // Seiler polarized: ≥75% easy = polarized; 60–74% = balanced; <60% = too-hard
  const status = easyPct >= 75 ? 'polarized' : easyPct >= 60 ? 'balanced' : 'too-hard'

  const statusStr = {
    polarized:    { en: `Polarized ✓ (${easyPct}% easy / ${hardPct}% hard)`, tr: `Polarize ✓ (%${easyPct} kolay / %${hardPct} zor)` },
    balanced:     { en: `Balanced (${easyPct}% easy / ${hardPct}% hard — aim ≥75% easy)`, tr: `Dengeli (%${easyPct} kolay — hedef ≥%75 kolay)` },
    'too-hard':   { en: `Too intense (${easyPct}% easy / ${hardPct}% hard — reduce hard sessions)`, tr: `Çok yoğun (%${easyPct} kolay — zor seansları azalt)` },
    insufficient: { en: 'Need more sessions.', tr: 'Daha fazla seans gerekiyor.' },
  }

  return {
    easyMin: Math.round(easyMin), hardMin: Math.round(hardMin),
    easyPct, hardPct,
    status, sessions: recent.length,
    en: statusStr[status].en,
    tr: statusStr[status].tr,
  }
}
