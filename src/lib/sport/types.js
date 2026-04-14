// src/lib/sport/types.js
// Domain type definitions for sport science modules.
// These are JSDoc @typedef comments — no runtime code.

/**
 * @typedef {Object} TrainingEntry
 * @property {string} date - ISO date YYYY-MM-DD
 * @property {number} tss - Training Stress Score (0–400)
 * @property {string} [type] - Session type ('Run'|'Ride'|'Swim'|'Row'|'Training')
 * @property {number} [rpe] - Rate of Perceived Exertion (1–10)
 * @property {number} [durationMin] - Session duration in minutes
 * @property {number} [hrAvg] - Average heart rate (bpm)
 * @property {number} [powerAvg] - Average power (watts)
 */

/**
 * @typedef {Object} BanisterState
 * @property {number} CTL - Chronic Training Load (fitness, 0–200)
 * @property {number} ATL - Acute Training Load (fatigue, 0–300)
 * @property {number} TSB - Training Stress Balance (CTL − ATL)
 */

/**
 * @typedef {Object} ACWRResult
 * @property {number|null} ratio - Acute:Chronic Workload Ratio
 * @property {string} band - 'optimal'|'caution'|'danger'|'insufficient'
 * @property {number} acute - 7-day EWMA load
 * @property {number} chronic - 42-day EWMA load
 */

/**
 * @typedef {Object} LactateTestPoint
 * @property {number} load - Power in watts or pace in sec/km
 * @property {number} lactate - Blood lactate in mmol/L
 */

/**
 * @typedef {Object} TrainingPaces
 * @property {number} E - Easy pace (sec/km)
 * @property {number} M - Marathon pace (sec/km)
 * @property {number} T - Threshold pace (sec/km)
 * @property {number} I - Interval pace (sec/km)
 * @property {number} R - Repetition pace (sec/km)
 * @property {number} vdot - VDOT value used to derive paces
 */

/**
 * @typedef {Object} CriticalPowerResult
 * @property {number} CP - Critical Power in watts
 * @property {number} Wprime - W' (anaerobic work capacity) in joules
 * @property {number} r2 - Coefficient of determination (0–1)
 */

/**
 * @typedef {Object} GoalProgress
 * @property {number} pct - Progress percentage (0–100)
 * @property {number|null} daysLeft - Days until target date, or null
 * @property {string} status - 'on_track'|'ahead'|'behind'|'complete'
 */

/**
 * @typedef {Object} SimulationPlan
 * @property {number[]} weeklyTSS - Array of TSS values per week
 * @property {number} score - Plan quality score (0–100)
 * @property {number} peakCTL - Projected peak CTL
 */
