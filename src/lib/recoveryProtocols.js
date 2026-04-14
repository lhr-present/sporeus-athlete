// ─── recoveryProtocols.js — Evidence-based recovery protocol library ───────────

export const RECOVERY_PROTOCOLS = [
  {
    id: 'nutrition_window',
    name: 'Post-Exercise Nutrition Window',
    duration: '30–60 min',
    evidence_level: 'strong',
    when_to_use: 'Within 2 hours of a hard session (TSS > 80)',
    steps: [
      'Consume 20–40 g high-quality protein within 30 min of finishing',
      'Pair with 1–1.2 g/kg carbohydrate to replenish glycogen',
      'Add 500–750 mL fluid with electrolytes per hour of exercise',
      'Include antioxidant-rich foods (berries, leafy greens) if inflammation is high',
    ],
    source: 'Ivy & Portman (2004); Thomas et al. (2016)',
  },
  {
    id: 'cold_water_immersion',
    name: 'Cold Water Immersion (CWI)',
    duration: '10–15 min',
    evidence_level: 'strong',
    when_to_use: 'After high-intensity or high-volume sessions; avoid before strength training',
    steps: [
      'Fill tub or container with water at 10–15 °C',
      'Immerse legs (or full body) up to the waist',
      'Stay for 10–15 minutes; exit if shivering intensifies',
      'Dry and warm up gradually — avoid sudden re-warming',
    ],
    source: 'Bleakley et al. (2012); Leeder et al. (2012)',
  },
  {
    id: 'contrast_bathing',
    name: 'Contrast Water Therapy',
    duration: '20–30 min',
    evidence_level: 'moderate',
    when_to_use: 'Low wellness score; soreness without acute injury',
    steps: [
      'Alternate 1 min cold (10–15 °C) and 3 min hot (38–40 °C)',
      'Repeat 3–4 cycles; always end on cold',
      'Focus on the legs and affected muscle groups',
      'Rehydrate with 300–500 mL fluid afterward',
    ],
    source: 'Bieuzen et al. (2013); Versey et al. (2013)',
  },
  {
    id: 'active_recovery',
    name: 'Active Recovery Ride/Run',
    duration: '20–40 min',
    evidence_level: 'strong',
    when_to_use: 'Next-day recovery after hard efforts; keeps aerobic base while aiding clearance',
    steps: [
      'Keep intensity in Zone 1 (< 60 % HRmax)',
      'Target 20–40 min total; stop if HR drifts above Zone 2',
      'Prefer cycling or water running to reduce impact',
      'Follow with light stretching of major muscle groups',
    ],
    source: 'Menzies et al. (2010); Cochrane (2004)',
  },
  {
    id: 'compression',
    name: 'Compression Garments',
    duration: '12–24 h',
    evidence_level: 'moderate',
    when_to_use: 'After long endurance events or travel; DOMS management',
    steps: [
      'Don compression socks or tights within 30 min post-exercise',
      'Use graduated compression (15–30 mmHg) for legs',
      'Wear overnight or for 12–24 h post-exercise',
      'Ensure fit is snug but not restricting blood flow',
    ],
    source: 'Hill et al. (2014); Marqués-Jiménez et al. (2016)',
  },
  {
    id: 'sleep_hygiene',
    name: 'Sleep Quality Protocol',
    duration: '7–9 h',
    evidence_level: 'strong',
    when_to_use: 'Every night; especially critical after hard training blocks',
    steps: [
      'Set a consistent sleep and wake time — aim for 7–9 h',
      'Keep bedroom cool (16–19 °C) and dark',
      'Avoid screens and bright light 60 min before bed',
      'No caffeine after 14:00; avoid large meals within 2 h of sleep',
      'Consider a light carbohydrate snack (casein + carb) if training hard',
    ],
    source: 'Fullagar et al. (2015); Watson (2017)',
  },
  {
    id: 'foam_rolling',
    name: 'Foam Rolling (SMR)',
    duration: '10–20 min',
    evidence_level: 'moderate',
    when_to_use: 'Pre-workout mobility or post-workout soreness reduction',
    steps: [
      'Roll slowly (2–3 sec per pass) over major muscle groups',
      'Pause 20–30 sec on tender spots; avoid rolling directly on joints',
      'Focus on quads, hamstrings, calves, IT band, and thoracic spine',
      'Follow with dynamic or static stretching for best results',
    ],
    source: 'Cheatham et al. (2015); Schroeder & Best (2015)',
  },
  {
    id: 'breathing_478',
    name: '4-7-8 Breathing (Parasympathetic Reset)',
    duration: '5–10 min',
    evidence_level: 'limited',
    when_to_use: 'Pre-sleep stress reduction; post-competition anxiety; HRV optimization',
    steps: [
      'Sit or lie comfortably; exhale fully through the mouth',
      'Inhale quietly through the nose for 4 counts',
      'Hold breath for 7 counts',
      'Exhale completely through the mouth for 8 counts',
      'Repeat 4 cycles; do not exceed 4 cycles on first practice',
    ],
    source: 'Weil (2015); Zaccaro et al. (2018)',
  },
]

/**
 * @description Recommends 2–3 evidence-based recovery protocols based on wellness score,
 *   session intensity (TSS), and time elapsed since the last training session.
 *   Rules: recent hard session → nutrition window first; low wellness → CWI/contrast;
 *   late evening → sleep hygiene; default → active recovery + foam rolling.
 * @param {number|null} wellnessScore - Subjective wellness score on a 1–5 scale
 * @param {number|null} sessionTSS - Training Stress Score of the most recent session
 * @param {number|null} hoursSinceSession - Hours elapsed since the last session ended
 * @returns {object[]} Array of 2–3 protocol objects from RECOVERY_PROTOCOLS (no duplicates)
 * @source Leeder et al. (2012) — Cold water immersion and recovery from strenuous exercise;
 *   Bleakley et al. (2012) — Cold water immersion; Fullagar et al. (2015) — Sleep and athlete recovery
 * @example
 * getRecommendedProtocols(2, 120, 0.5)
 * // => [RECOVERY_PROTOCOLS.nutrition_window, RECOVERY_PROTOCOLS.cold_water_immersion, ...]
 */
export function getRecommendedProtocols(wellnessScore, sessionTSS, hoursSinceSession) {
  // Null/undefined guard — return nutrition_window (index 0) + active_recovery (index 3)
  if (wellnessScore == null || sessionTSS == null || hoursSinceSession == null) {
    return [RECOVERY_PROTOCOLS[0], RECOVERY_PROTOCOLS[3]]
  }

  const byId = Object.fromEntries(RECOVERY_PROTOCOLS.map(p => [p.id, p]))
  const selected = []
  const added = new Set()

  const add = id => {
    if (!added.has(id)) {
      selected.push(byId[id])
      added.add(id)
    }
  }

  // Rule 1: recent hard session → nutrition window first
  if (hoursSinceSession < 2 && sessionTSS > 80) {
    add('nutrition_window')
  }

  // Rule 2: low wellness + enough time has passed → CWI or contrast
  if (wellnessScore < 3 && hoursSinceSession > 1) {
    add('cold_water_immersion')
    if (selected.length < 3) add('contrast_bathing')
  }

  // Rule 3: many hours since session → sleep or foam rolling
  if (hoursSinceSession > 8 && selected.length < 3) {
    const hour = new Date().getHours()
    if (hour > 20) {
      add('sleep_hygiene')
    } else {
      add('foam_rolling')
    }
  }

  // Always include active_recovery as last option if fewer than 3 returned
  if (selected.length < 3) {
    add('active_recovery')
  }

  // Guarantee minimum of 2 — fall back to foam_rolling as a safe second option
  if (selected.length < 2) {
    add('foam_rolling')
  }

  return selected.slice(0, 3)
}
