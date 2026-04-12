// ─── ruleInsights.js — Rule-based coaching insights (zero API cost) ────────────
// Pure JS module. No external dependencies. All functions are deterministic.

const COLORS = {
  optimal:  '#5bc25b',
  moderate: '#ff6600',
  high:     '#e03030',
  low:      '#0064ff',
}

// ─── 1. getReadinessLabel ─────────────────────────────────────────────────────
// Returns readiness assessment from ACWR + wellness average.
// acwr: number|null, wellnessAvg: number (0–100)
export function getReadinessLabel(acwr, wellnessAvg) {
  const well = typeof wellnessAvg === 'number' ? wellnessAvg : 50
  const ratio = typeof acwr === 'number' ? acwr : 1.0

  if (ratio > 1.5 || well < 40) {
    return {
      level:   'high',
      color:   COLORS.high,
      message: ratio > 1.5
        ? `ACWR ${ratio.toFixed(2)} — acute load spike. Prioritise recovery today.`
        : `Wellness ${well}/100 — significantly below baseline. Rest recommended.`,
    }
  }
  if (ratio > 1.3 || well < 60) {
    return {
      level:   'moderate',
      color:   COLORS.moderate,
      message: ratio > 1.3
        ? `ACWR ${ratio.toFixed(2)} — approaching high-risk zone. Monitor fatigue.`
        : `Wellness ${well}/100 — below threshold. Reduce intensity if needed.`,
    }
  }
  if (ratio < 0.8 && well >= 70) {
    return {
      level:   'low',
      color:   COLORS.low,
      message: `ACWR ${ratio.toFixed(2)} — undertraining. Capacity to add load if feeling good.`,
    }
  }
  return {
    level:   'optimal',
    color:   COLORS.optimal,
    message: `ACWR ${ratio.toFixed(2)}, wellness ${well}/100 — green light for planned training.`,
  }
}

// ─── 2. getLoadTrendAlert ─────────────────────────────────────────────────────
// Detects >10% week-on-week load spike in a 7-value array (oldest→newest daily TSS).
// loads7days: number[] (length 7, indices 0–6 = Mon–Sun or rolling 7d)
export function getLoadTrendAlert(loads7days) {
  const arr = Array.isArray(loads7days) ? loads7days : []
  const week1 = arr.slice(0, 3).reduce((s, v) => s + (Number(v) || 0), 0)  // first half (3 days)
  const week2 = arr.slice(3).reduce((s, v) => s + (Number(v) || 0), 0)     // second half (4 days)

  if (week1 === 0) {
    return { flag: false, message: 'Insufficient prior load data to assess trend.', action: 'Log more sessions.' }
  }

  const changePct = ((week2 - week1) / week1) * 100

  if (changePct > 10) {
    return {
      flag:    true,
      message: `Load up ${Math.round(changePct)}% vs prior period — above 10% safe ramp rate.`,
      action:  'Cap next session TSS or insert a recovery day.',
    }
  }
  return {
    flag:    false,
    message: `Load change ${changePct >= 0 ? '+' : ''}${Math.round(changePct)}% — within safe range.`,
    action:  'Maintain current ramp rate.',
  }
}

// ─── 3. getMonotonyWarning ────────────────────────────────────────────────────
// Flags training monotony > 2.0 (Foster 2001). Monotony = mean / sd.
// loads7days: number[] (7 daily TSS values)
export function getMonotonyWarning(loads7days) {
  const arr = (Array.isArray(loads7days) ? loads7days : []).map(v => Number(v) || 0)
  if (arr.length < 2) {
    return { flag: false, message: 'Not enough data to calculate monotony.', action: 'Log at least 2 days.' }
  }

  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  if (mean === 0) {
    return { flag: false, message: 'No load recorded — monotony not applicable.', action: 'Log training sessions.' }
  }

  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  const sd = Math.sqrt(variance)

  if (sd === 0) {
    return {
      flag:    true,
      message: `Monotony ∞ — identical load every day signals extremely repetitive training.`,
      action:  'Vary session intensity: mix hard, moderate, and easy days.',
    }
  }

  const monotony = mean / sd

  if (monotony > 2.0) {
    return {
      flag:    true,
      message: `Monotony ${monotony.toFixed(2)} — above 2.0 threshold. Training is too uniform.`,
      action:  'Add variation: insert a rest day or alternate hard/easy sessions.',
    }
  }
  return {
    flag:    false,
    message: `Monotony ${monotony.toFixed(2)} — acceptable training variety.`,
    action:  'Continue mixing intensities.',
  }
}

// ─── 4. getFatigueAccumulation ────────────────────────────────────────────────
// Flags low perceived recovery (avg fatigueScore < 2.5 over last 3 days).
// fatigueScores3days: number[] (1–5 scale, 1=very fatigued, 5=fully recovered)
export function getFatigueAccumulation(fatigueScores3days) {
  const arr = (Array.isArray(fatigueScores3days) ? fatigueScores3days : [])
    .map(v => Number(v))
    .filter(v => !isNaN(v) && v >= 1 && v <= 5)

  if (arr.length === 0) {
    return { flag: false, message: 'No fatigue scores recorded.', action: 'Log daily wellness check-ins.' }
  }

  const avg = arr.reduce((s, v) => s + v, 0) / arr.length

  if (avg < 2.5) {
    return {
      flag:    true,
      message: `Average recovery score ${avg.toFixed(1)}/5 — accumulated fatigue detected.`,
      action:  'Schedule a rest or active recovery day. Avoid high-intensity sessions.',
    }
  }
  return {
    flag:    false,
    message: `Average recovery score ${avg.toFixed(1)}/5 — fatigue within acceptable range.`,
    action:  'Proceed with planned training.',
  }
}

// ─── 5. getMissedRestWarning ──────────────────────────────────────────────────
// Flags ≥6 consecutive training days without a rest day.
// consecutiveTrainingDays: number
export function getMissedRestWarning(consecutiveTrainingDays) {
  const days = typeof consecutiveTrainingDays === 'number' && !isNaN(consecutiveTrainingDays)
    ? Math.max(0, Math.floor(consecutiveTrainingDays))
    : 0

  if (days >= 6) {
    return {
      flag:    true,
      message: `${days} consecutive training days — a rest day is overdue.`,
      action:  'Insert a complete rest or active recovery day before the next session.',
    }
  }
  return {
    flag:    false,
    message: days === 0
      ? 'Rest day recorded — good recovery practice.'
      : `${days} consecutive training day${days === 1 ? '' : 's'} — still within safe range.`,
    action:  days >= 4 ? 'Plan a rest day within the next 2 days.' : 'Continue as planned.',
  }
}

// ─── 6. getAthleteInsights ────────────────────────────────────────────────────
// Runs all checks and returns sorted array of active alerts.
// athleteData: {
//   acwr, wellnessAvg, loads7days, fatigueScores3days, consecutiveTrainingDays
// }
export function getAthleteInsights(athleteData) {
  if (!athleteData || typeof athleteData !== 'object') return []

  const { acwr, wellnessAvg, loads7days, fatigueScores3days, consecutiveTrainingDays } = athleteData

  const checks = [
    { key: 'readiness', result: getReadinessLabel(acwr, wellnessAvg) },
    { key: 'loadTrend', result: getLoadTrendAlert(loads7days) },
    { key: 'monotony',  result: getMonotonyWarning(loads7days) },
    { key: 'fatigue',   result: getFatigueAccumulation(fatigueScores3days) },
    { key: 'rest',      result: getMissedRestWarning(consecutiveTrainingDays) },
  ]

  const SEVERITY = { high: 0, moderate: 1, low: 2, optimal: 3 }

  const alerts = checks
    .filter(c => c.result.flag === true || c.key === 'readiness')
    .map(c => ({
      key:      c.key,
      flag:     c.result.flag ?? (c.result.level !== 'optimal'),
      severity: c.result.level || (c.result.flag ? 'moderate' : 'optimal'),
      message:  c.result.message,
      action:   c.result.action,
      color:    c.result.color || (c.result.flag ? COLORS.moderate : COLORS.optimal),
    }))
    .sort((a, b) => (SEVERITY[a.severity] ?? 99) - (SEVERITY[b.severity] ?? 99))

  return alerts
}
