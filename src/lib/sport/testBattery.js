// ─── testBattery.js — Field test battery definitions and metric derivation ────

// ─── TEST_BATTERY ─────────────────────────────────────────────────────────────
// Array of 7 standardised field tests used in the Sporeus Athlete Console.
export const TEST_BATTERY = [
  {
    id: 'standing_broad_jump',
    name: 'Standing Broad Jump',
    sport: 'general',
    duration_min: 5,
    equipment: ['measuring tape', 'flat surface'],
    measures: ['distance_cm'],
    instructions: [
      'Stand behind the start line with feet shoulder-width apart.',
      'Swing arms and bend knees, then jump forward as far as possible.',
      'Land on both feet. Measure from start line to heel of closest foot.',
      'Best of 3 attempts.',
    ],
    rest_after_min: 3,
  },
  {
    id: 'step_test_3min',
    name: '3-Minute Step Test',
    sport: 'general',
    duration_min: 5,
    equipment: ['30cm step or box', 'metronome', 'heart rate monitor'],
    measures: ['recovery_hr_bpm'],
    instructions: [
      'Step up and down on a 30 cm bench at 96 bpm (24 cycles/min) for 3 minutes.',
      'Immediately sit down after the test.',
      'Count heart rate for 1 full minute — this is your recovery HR.',
    ],
    rest_after_min: 5,
  },
  {
    id: 'erg_2km',
    name: '2 km Rowing Ergometer',
    sport: 'rowing',
    duration_min: 10,
    equipment: ['rowing ergometer'],
    measures: ['time_seconds'],
    instructions: [
      'Warm up 5 minutes at easy pace.',
      'Row 2000 m at maximum sustainable effort.',
      'Record total time in seconds.',
    ],
    rest_after_min: 10,
  },
  {
    id: 'sprint_20m',
    name: '20-Metre Sprint',
    sport: 'general',
    duration_min: 5,
    equipment: ['timing gates or stopwatch', 'flat track'],
    measures: ['time_seconds'],
    instructions: [
      'Mark a 20 m course on a flat, non-slip surface.',
      'Start from a standing position behind the start line.',
      'Sprint at maximum effort. Record best of 3 attempts with 3 min rest between each.',
    ],
    rest_after_min: 5,
  },
  {
    id: 'squat_1rm',
    name: 'Back Squat 1RM',
    sport: 'strength',
    duration_min: 20,
    equipment: ['barbell', 'squat rack', 'weight plates', 'spotter'],
    measures: ['load_kg'],
    instructions: [
      'Warm up with 50% estimated 1RM x 10, then 70% x 5, 85% x 2.',
      'Attempt a maximal load with full depth (hip crease below knee).',
      'Rest 3–5 min between heavy attempts.',
      'Record the heaviest successful single rep.',
    ],
    rest_after_min: 15,
  },
  {
    id: 'yoyo_ir1',
    name: 'Yo-Yo Intermittent Recovery Test Level 1',
    sport: 'team_sports',
    duration_min: 15,
    equipment: ['cones', 'audio track (beep test)'],
    measures: ['total_distance_m', 'level_reached'],
    instructions: [
      'Set up two cones 20 m apart plus a 5 m recovery zone.',
      'Perform 20 m shuttle runs at increasing pace dictated by audio signals.',
      'After each 20 m + 20 m bout, walk/jog 10 m recovery in 10 s.',
      'Stop when you fail to reach the cone twice. Record total distance covered.',
    ],
    rest_after_min: 10,
  },
  {
    id: 'cooper_12min',
    name: 'Cooper 12-Minute Run',
    sport: 'running',
    duration_min: 14,
    equipment: ['400m track or GPS watch'],
    measures: ['distance_m'],
    instructions: [
      'Warm up 5 minutes with easy jogging.',
      'Run as far as possible in exactly 12 minutes on a flat course.',
      'Record total distance in metres.',
    ],
    rest_after_min: 10,
  },
]

/**
 * @description Converts a raw field test measurement into a meaningful derived metric
 *   (e.g. VO2max from Cooper distance, power from 2 km erg time, speed from sprint time).
 * @param {string} testId - One of the TEST_BATTERY ids (e.g. 'cooper_12min', 'erg_2km')
 * @param {number} rawValue - Primary measured value (unit depends on test)
 * @param {{weight_kg?:number, height_cm?:number}} [profile] - Athlete profile for weight-relative metrics
 * @returns {{metric:string, value:number|string, unit:string}}
 * @source Daniels & Gilbert (1979) — Oxygen power (VO2max formulas for field tests)
 * @example
 * deriveMetrics('cooper_12min', 3000) // => {metric:'vo2max', value:55.8, unit:'mL/kg/min'}
 */
export function deriveMetrics(testId, rawValue, profile) {
  switch (testId) {
    case 'cooper_12min': {
      // Cooper (1968): VO2max (mL/kg/min) = 22.351 × distKm − 11.288
      const distKm = rawValue / 1000
      const vo2max = Math.round((22.351 * distKm - 11.288) * 10) / 10
      return { metric: 'vo2max', value: vo2max, unit: 'mL/kg/min' }
    }

    case 'step_test_3min': {
      // Kasch & Boyer: VO2max = 111.33 − 0.42 × recovery_HR
      const vo2max = Math.round((111.33 - 0.42 * rawValue) * 10) / 10
      return { metric: 'vo2max', value: vo2max, unit: 'mL/kg/min' }
    }

    case 'erg_2km': {
      // Simplified watts from 500 m split (seconds):
      //   split_500 = rawValue / 4
      //   watts = (2.42 * 500 / split_500)^3
      const split500 = rawValue / 4
      const watts = Math.round(Math.pow((2.42 * 500) / split500, 3) * 10) / 10
      return { metric: 'power', value: watts, unit: 'W' }
    }

    case 'sprint_20m': {
      // Speed = distance / time
      const speed = Math.round((20 / rawValue) * 100) / 100
      return { metric: 'speed', value: speed, unit: 'm/s' }
    }

    case 'squat_1rm': {
      // Strength ratio relative to body weight
      const bw = (profile && profile.weight_kg != null) ? profile.weight_kg : 70
      const ratio = Math.round((rawValue / bw) * 100) / 100
      return { metric: 'strength_ratio', value: ratio, unit: 'x BW' }
    }

    default:
      return { metric: testId, value: rawValue, unit: '' }
  }
}

/**
 * @description Looks up and returns the test battery plan stored for a specific date.
 * @param {Array} storedBatteries - Items from localStorage key 'sporeus-test-battery'
 * @param {string} date - ISO date string e.g. '2026-04-15'
 * @returns {object|null} The matching battery object, or null if not found
 * @example
 * getBatteryForDate([{date:'2026-04-15', results:{cooper_12min:2800}}], '2026-04-15')
 * // => {date:'2026-04-15', results:{...}}
 */
export function getBatteryForDate(storedBatteries, date) {
  if (!Array.isArray(storedBatteries) || !date) return null
  const found = storedBatteries.find(b => b && b.date === date)
  return found ?? null
}

/**
 * @description Compares two test battery result snapshots and returns per-test percentage change.
 * @param {{date:string, results:{[testId:string]:number}}} resultsA - Baseline snapshot
 * @param {{date:string, results:{[testId:string]:number}}} resultsB - Follow-up snapshot
 * @returns {Array<{testId:string, before:number, after:number, delta_pct:number}>}
 *   Array of changes for all test IDs present in either snapshot
 * @example
 * compareBatteryResults({date:'2026-01-01',results:{cooper_12min:2800}}, {date:'2026-04-01',results:{cooper_12min:3000}})
 * // => [{testId:'cooper_12min', before:2800, after:3000, delta_pct:7.1}]
 */
export function compareBatteryResults(resultsA, resultsB) {
  if (!resultsA || !resultsB) return []
  const beforeMap = resultsA.results ?? {}
  const afterMap  = resultsB.results ?? {}

  // Union of all test ids present in either snapshot
  const allIds = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])

  return Array.from(allIds).map(testId => {
    const before = beforeMap[testId] ?? 0
    const after  = afterMap[testId]  ?? 0

    let delta_pct
    if (before === 0) {
      delta_pct = Infinity
    } else {
      delta_pct = Math.round(((after - before) / before) * 1000) / 10
    }

    return { testId, before, after, delta_pct }
  })
}
