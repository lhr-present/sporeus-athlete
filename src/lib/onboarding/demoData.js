// src/lib/onboarding/demoData.js — E9: Demo session data generator
// Returns 30 days of seeded training sessions for demo mode.
// All sessions are marked is_demo=true so they can be bulk-deleted.
// Designed to populate a realistic PMC chart showing CTL/ATL/TSB progression.

const DEMO_SPORT_PLANS = {
  Running: [
    // Week 1: easy base
    { dow: 1, type: 'Running', duration: 45, rpe: 5, tss: 55, notes: 'Easy Z2 run' },
    { dow: 3, type: 'Running', duration: 60, rpe: 6, tss: 72, notes: 'Moderate aerobic run' },
    { dow: 5, type: 'Running', duration: 75, rpe: 5, tss: 80, notes: 'Long Z2 run' },
    { dow: 6, type: 'Strength', duration: 30, rpe: 5, tss: 28, notes: 'Strength & mobility' },
    // Week 2: build
    { dow: 8,  type: 'Running', duration: 50, rpe: 6, tss: 65, notes: 'Tempo intervals' },
    { dow: 10, type: 'Running', duration: 45, rpe: 5, tss: 55, notes: 'Easy recovery run' },
    { dow: 12, type: 'Running', duration: 90, rpe: 6, tss: 100, notes: 'Long run' },
    { dow: 13, type: 'Running', duration: 30, rpe: 3, tss: 25, notes: 'Active recovery' },
    // Week 3: peak
    { dow: 15, type: 'Running', duration: 55, rpe: 7, tss: 85, notes: 'Threshold repeats' },
    { dow: 17, type: 'Running', duration: 60, rpe: 5, tss: 68, notes: 'Easy Z2' },
    { dow: 19, type: 'Running', duration: 100, rpe: 6, tss: 120, notes: 'Long run + progression' },
    { dow: 20, type: 'Strength', duration: 30, rpe: 5, tss: 28, notes: 'Strength' },
    // Week 4: recovery
    { dow: 22, type: 'Running', duration: 40, rpe: 4, tss: 42, notes: 'Easy recovery' },
    { dow: 24, type: 'Running', duration: 50, rpe: 5, tss: 55, notes: 'Easy aerobic' },
    { dow: 26, type: 'Running', duration: 60, rpe: 5, tss: 65, notes: 'Z2 run' },
    { dow: 27, type: 'Running', duration: 25, rpe: 3, tss: 20, notes: 'Short recovery run' },
  ],
  Cycling: [
    { dow: 1,  type: 'Cycling', duration: 60, rpe: 5, tss: 70, notes: 'Z2 endurance ride' },
    { dow: 3,  type: 'Cycling', duration: 75, rpe: 6, tss: 90, notes: 'Sweet spot intervals' },
    { dow: 5,  type: 'Cycling', duration: 90, rpe: 5, tss: 95, notes: 'Long endurance ride' },
    { dow: 6,  type: 'Strength', duration: 30, rpe: 4, tss: 25, notes: 'Core & strength' },
    { dow: 8,  type: 'Cycling', duration: 60, rpe: 7, tss: 100, notes: 'Threshold + VO2 work' },
    { dow: 10, type: 'Cycling', duration: 45, rpe: 4, tss: 45, notes: 'Recovery spin' },
    { dow: 12, type: 'Cycling', duration: 120, rpe: 5, tss: 130, notes: 'Long Z2 ride' },
    { dow: 13, type: 'Cycling', duration: 40, rpe: 3, tss: 30, notes: 'Active recovery spin' },
    { dow: 15, type: 'Cycling', duration: 70, rpe: 7, tss: 110, notes: 'Race simulation efforts' },
    { dow: 17, type: 'Cycling', duration: 60, rpe: 5, tss: 68, notes: 'Z2 aerobic' },
    { dow: 19, type: 'Cycling', duration: 150, rpe: 5, tss: 165, notes: 'Gran fondo prep long ride' },
    { dow: 20, type: 'Strength', duration: 30, rpe: 4, tss: 25, notes: 'Strength' },
    { dow: 22, type: 'Cycling', duration: 50, rpe: 4, tss: 48, notes: 'Easy recovery' },
    { dow: 24, type: 'Cycling', duration: 60, rpe: 5, tss: 65, notes: 'Aerobic base' },
    { dow: 26, type: 'Cycling', duration: 90, rpe: 5, tss: 95, notes: 'Endurance ride' },
    { dow: 27, type: 'Cycling', duration: 30, rpe: 3, tss: 22, notes: 'Easy spin' },
  ],
  Triathlon: [
    { dow: 1,  type: 'Running', duration: 45, rpe: 5, tss: 55, notes: 'Easy run Z2' },
    { dow: 2,  type: 'Swimming', duration: 40, rpe: 6, tss: 48, notes: 'Aerobic swim' },
    { dow: 3,  type: 'Cycling', duration: 75, rpe: 5, tss: 80, notes: 'Z2 bike' },
    { dow: 5,  type: 'Running', duration: 60, rpe: 6, tss: 72, notes: 'Threshold run' },
    { dow: 6,  type: 'Swimming', duration: 50, rpe: 5, tss: 55, notes: 'Technique swim' },
    { dow: 8,  type: 'Cycling', duration: 90, rpe: 5, tss: 95, notes: 'Long endurance' },
    { dow: 9,  type: 'Running', duration: 30, rpe: 4, tss: 32, notes: 'Brick run' },
    { dow: 10, type: 'Swimming', duration: 45, rpe: 6, tss: 52, notes: 'Speed swim' },
    { dow: 12, type: 'Cycling', duration: 120, rpe: 5, tss: 128, notes: 'Long ride' },
    { dow: 13, type: 'Running', duration: 50, rpe: 5, tss: 58, notes: 'Long run' },
    { dow: 15, type: 'Cycling', duration: 60, rpe: 7, tss: 92, notes: 'Bike intervals' },
    { dow: 16, type: 'Swimming', duration: 55, rpe: 6, tss: 62, notes: 'Endurance swim' },
    { dow: 17, type: 'Running', duration: 35, rpe: 4, tss: 38, notes: 'Recovery run' },
    { dow: 19, type: 'Cycling', duration: 90, rpe: 6, tss: 108, notes: 'Build ride' },
    { dow: 20, type: 'Running', duration: 60, rpe: 5, tss: 68, notes: 'Long Z2 run' },
    { dow: 22, type: 'Swimming', duration: 40, rpe: 5, tss: 45, notes: 'Easy swim' },
    { dow: 23, type: 'Cycling', duration: 50, rpe: 4, tss: 48, notes: 'Recovery ride' },
    { dow: 24, type: 'Running', duration: 45, rpe: 5, tss: 52, notes: 'Easy run' },
    { dow: 26, type: 'Cycling', duration: 75, rpe: 5, tss: 82, notes: 'Aerobic bike' },
    { dow: 27, type: 'Running', duration: 30, rpe: 3, tss: 25, notes: 'Short easy run' },
  ],
}

// Default plan for unrecognized sports
const DEFAULT_PLAN = DEMO_SPORT_PLANS.Running

/**
 * Generate 30 days of realistic demo training sessions.
 * All sessions are marked is_demo=true for easy bulk deletion.
 *
 * @param {string} baseDate  - 'YYYY-MM-DD' — the first day of the 30-day window
 * @param {string} sport     - 'Running' | 'Cycling' | 'Triathlon'
 * @returns {Array<{ date, type, duration, rpe, tss, notes, is_demo }>}
 */
export function generateDemoSessions(baseDate, sport = 'Running') {
  const plan = DEMO_SPORT_PLANS[sport] || DEFAULT_PLAN
  const base = new Date(baseDate)

  return plan.map(template => {
    const d = new Date(base)
    d.setDate(base.getDate() + template.dow - 1)
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return {
      date:     `${y}-${m}-${dd}`,
      type:     template.type,
      duration: template.duration,
      rpe:      template.rpe,
      tss:      template.tss,
      notes:    `[DEMO] ${template.notes}`,
      is_demo:  true,
    }
  }).filter(s => {
    // Only include sessions within the 30-day window
    return s.date >= baseDate && s.date <= offsetDate(baseDate, 29)
  })
}

/**
 * Compute a date string N days from a base date.
 * @param {string} baseDate  'YYYY-MM-DD'
 * @param {number} offset    days to add
 * @returns {string}
 */
export function offsetDate(baseDate, offset) {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + offset)
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Get the set of supported demo sports.
 * @returns {string[]}
 */
export function getDemoSports() {
  return Object.keys(DEMO_SPORT_PLANS)
}
