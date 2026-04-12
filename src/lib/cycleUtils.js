// src/lib/cycleUtils.js — Menstrual cycle phase utilities (pure functions)

export const PHASES = ['menstruation', 'follicular', 'ovulation', 'luteal']

/**
 * Day number within the current cycle (1 = first day of period).
 * Returns null if lastPeriodStart is in the future.
 */
export function cycleDay(lastPeriodStart, cycleLength = 28, today = new Date().toISOString().slice(0, 10)) {
  const totalDays = Math.floor((new Date(today) - new Date(lastPeriodStart)) / 86400000)
  if (totalDays < 0) return null
  return (totalDays % cycleLength) + 1
}

/**
 * Current cycle phase name from last period start date.
 * Ovulation window centred on cycleLength/2 (± 1 day).
 * Returns null if lastPeriodStart is in the future.
 */
export function currentCyclePhase(lastPeriodStart, cycleLength = 28, today = new Date().toISOString().slice(0, 10)) {
  const day = cycleDay(lastPeriodStart, cycleLength, today)
  if (day === null) return null
  const ovDay = Math.round(cycleLength / 2)
  if (day <= 5)             return 'menstruation'
  if (day < ovDay)          return 'follicular'
  if (day <= ovDay + 1)     return 'ovulation'
  return 'luteal'
}

/**
 * Days until the next start of a given phase.
 * Returns null for unknown phase or future lastPeriodStart.
 */
export function daysUntilPhase(lastPeriodStart, cycleLength = 28, targetPhase, today = new Date().toISOString().slice(0, 10)) {
  const day = cycleDay(lastPeriodStart, cycleLength, today)
  if (day === null) return null
  const ovDay = Math.round(cycleLength / 2)
  const starts = { menstruation: 1, follicular: 6, ovulation: ovDay, luteal: ovDay + 2 }
  const target = starts[targetPhase]
  if (!target) return null
  let diff = target - day
  if (diff <= 0) diff += cycleLength
  return diff
}

/** Training implication label for each phase (bilingual). */
export const PHASE_INFO = {
  menstruation: {
    en: { label: 'Menstruation', tip: 'Lower intensity may feel better. Iron awareness.' },
    tr: { label: 'Adet', tip: 'Düşük yoğunluk daha konforlu olabilir.' },
    color: '#e03030',
  },
  follicular: {
    en: { label: 'Follicular', tip: 'Rising estrogen — good for strength & high intensity.' },
    tr: { label: 'Foliküler', tip: 'Östrojen yükseliyor — kuvvet ve yüksek yoğunluk için iyi.' },
    color: '#0064ff',
  },
  ovulation: {
    en: { label: 'Ovulation', tip: 'Peak performance window — estrogen & testosterone peak.' },
    tr: { label: 'Ovülasyon', tip: 'En iyi performans penceresi.' },
    color: '#5bc25b',
  },
  luteal: {
    en: { label: 'Luteal', tip: 'Progesterone rises — higher perceived effort, monitor fatigue.' },
    tr: { label: 'Luteal', tip: 'Progesteron yükseliyor — yorgunluğu izle.' },
    color: '#ff6600',
  },
}
