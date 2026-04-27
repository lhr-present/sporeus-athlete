// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  estimate1RM,
  loadFromPercent1RM,
  rirToPercent1RM,
  weeklyHardSets,
  volumeLandmarks,
  volumeStatus,
  suggestNextLoad,
  suggestTemplate,
  advanceRotation,
  daysSinceLastSession,
  plateCalculator,
  weeklyMuscleFrequency,
  computeSessionPRs,
} from '../../athlete/strengthTraining.js'

// ── estimate1RM ───────────────────────────────────────────────────────────────
describe('estimate1RM', () => {
  it('returns null for zero weight', () => {
    expect(estimate1RM(0, 5)).toBeNull()
  })
  it('returns null for negative weight', () => {
    expect(estimate1RM(-10, 5)).toBeNull()
  })
  it('returns null for zero reps', () => {
    expect(estimate1RM(100, 0)).toBeNull()
  })
  it('returns null for reps > 30', () => {
    expect(estimate1RM(60, 35)).toBeNull()
  })
  it('returns weight for 1 rep (all formulas = weight)', () => {
    const r = estimate1RM(100, 1)
    expect(r.epley).toBe(100)
    expect(r.brzycki).toBe(100)
    expect(r.lombardi).toBe(100)
    expect(r.median).toBe(100)
  })
  it('Epley: 80kg × 5 reps ≈ 93.3', () => {
    const r = estimate1RM(80, 5)
    expect(r.epley).toBeCloseTo(93.3, 0)
  })
  it('Brzycki: 80kg × 5 reps ≈ 90 (36/(37−reps) formula)', () => {
    const r = estimate1RM(80, 5)
    expect(r.brzycki).toBeCloseTo(90, 0)
  })
  it('Lombardi: 80kg × 5 reps — reasonable range (85–95)', () => {
    const r = estimate1RM(80, 5)
    expect(r.lombardi).toBeGreaterThan(85)
    expect(r.lombardi).toBeLessThan(100)
  })
  it('median is middle value of the three', () => {
    const r = estimate1RM(80, 5)
    const sorted = [r.epley, r.brzycki, r.lombardi].sort((a, b) => a - b)
    expect(r.median).toBe(sorted[1])
  })
  it('100kg × 10 reps Epley ≈ 133.3', () => {
    const r = estimate1RM(100, 10)
    expect(r.epley).toBeCloseTo(133.3, 0)
  })
  it('100kg × 10 reps Brzycki ≈ 133.3', () => {
    const r = estimate1RM(100, 10)
    expect(r.brzycki).toBeCloseTo(133.3, 0)
  })
  it('60kg × 3 reps Epley ≈ 66', () => {
    const r = estimate1RM(60, 3)
    expect(r.epley).toBeCloseTo(66, 0)
  })
  it('all values are positive numbers', () => {
    const r = estimate1RM(50, 8)
    expect(r.epley).toBeGreaterThan(0)
    expect(r.brzycki).toBeGreaterThan(0)
    expect(r.lombardi).toBeGreaterThan(0)
    expect(r.median).toBeGreaterThan(0)
  })
  it('handles bodyweight-style: 0 load returns null', () => {
    expect(estimate1RM(0, 8)).toBeNull()
  })
})

// ── loadFromPercent1RM ────────────────────────────────────────────────────────
describe('loadFromPercent1RM', () => {
  it('100kg @ 75% = 75kg (exact 2.5 boundary)', () => {
    expect(loadFromPercent1RM(100, 0.75)).toBe(75)
  })
  it('100kg @ 80% = 80kg', () => {
    expect(loadFromPercent1RM(100, 0.80)).toBe(80)
  })
  it('rounds to nearest 2.5', () => {
    // 100 × 0.73 = 73 → rounds to 72.5
    expect(loadFromPercent1RM(100, 0.73)).toBe(72.5)
  })
  it('returns null for 0 1RM', () => {
    expect(loadFromPercent1RM(0, 0.75)).toBeNull()
  })
  it('returns null for percent > 1', () => {
    expect(loadFromPercent1RM(100, 1.1)).toBeNull()
  })
  it('returns null for negative percent', () => {
    expect(loadFromPercent1RM(100, -0.5)).toBeNull()
  })
  it('200kg @ 90% = 180', () => {
    expect(loadFromPercent1RM(200, 0.9)).toBe(180)
  })
  it('120kg @ 65% rounds to 77.5', () => {
    // 120 × 0.65 = 78 → nearest 2.5 = 77.5
    expect(loadFromPercent1RM(120, 0.65)).toBe(77.5)
  })
})

// ── rirToPercent1RM ───────────────────────────────────────────────────────────
describe('rirToPercent1RM', () => {
  it('5 reps RIR=0 ≈ 0.867', () => {
    expect(rirToPercent1RM(5, 0)).toBeCloseTo(0.867, 2)
  })
  it('1 rep RIR=0 = 1.00 (true max)', () => {
    expect(rirToPercent1RM(1, 0)).toBe(1.00)
  })
  it('returns null for negative reps', () => {
    expect(rirToPercent1RM(-1, 0)).toBeNull()
  })
  it('returns null for RIR > 5', () => {
    expect(rirToPercent1RM(5, 6)).toBeNull()
  })
  it('returns null for null reps', () => {
    expect(rirToPercent1RM(null, 0)).toBeNull()
  })
  it('higher RIR → lower %1RM for same reps', () => {
    const a = rirToPercent1RM(5, 0)
    const b = rirToPercent1RM(5, 3)
    expect(a).toBeGreaterThan(b)
  })
  it('more reps → lower %1RM for same RIR', () => {
    const a = rirToPercent1RM(3, 2)
    const b = rirToPercent1RM(10, 2)
    expect(a).toBeGreaterThan(b)
  })
  it('10 reps RIR=2 ≈ 0.711', () => {
    expect(rirToPercent1RM(10, 2)).toBeCloseTo(0.711, 2)
  })
})

// ── weeklyHardSets ────────────────────────────────────────────────────────────
describe('weeklyHardSets', () => {
  it('counts only RIR ≤ 3 AND reps ≥ 5', () => {
    const sets = [
      { muscle: 'chest', rir: 2, reps: 8 },
      { muscle: 'chest', rir: 4, reps: 8 }, // not hard (RIR > 3)
      { muscle: 'chest', rir: 1, reps: 4 }, // not hard (reps < 5)
      { muscle: 'chest', rir: 0, reps: 5 },
    ]
    expect(weeklyHardSets(sets)).toBe(2)
  })
  it('returns 0 for empty array', () => {
    expect(weeklyHardSets([])).toBe(0)
  })
  it('returns 0 for null input', () => {
    expect(weeklyHardSets(null)).toBe(0)
  })
  it('counts all qualifying sets', () => {
    const sets = Array(10).fill({ muscle: 'back', rir: 2, reps: 8 })
    expect(weeklyHardSets(sets)).toBe(10)
  })
  it('RIR=3 reps=5 is hard', () => {
    expect(weeklyHardSets([{ muscle: 'quads', rir: 3, reps: 5 }])).toBe(1)
  })
  it('RIR=4 reps=8 is not hard', () => {
    expect(weeklyHardSets([{ muscle: 'chest', rir: 4, reps: 8 }])).toBe(0)
  })
  it('handles undefined entries gracefully', () => {
    expect(weeklyHardSets([null, undefined, { rir: 1, reps: 8 }])).toBe(1)
  })
})

// ── volumeLandmarks ───────────────────────────────────────────────────────────
describe('volumeLandmarks', () => {
  it('chest has mev=8 mav=14 mrv=22', () => {
    expect(volumeLandmarks('chest')).toEqual({ mev: 8, mav: 14, mrv: 22 })
  })
  it('biceps has mev=6 mav=12 mrv=20', () => {
    expect(volumeLandmarks('biceps')).toEqual({ mev: 6, mav: 12, mrv: 20 })
  })
  it('calves has mrv=18', () => {
    expect(volumeLandmarks('calves').mrv).toBe(18)
  })
  it('core has mev=6', () => {
    expect(volumeLandmarks('core').mev).toBe(6)
  })
  it('returns null for unknown muscle', () => {
    expect(volumeLandmarks('forearms')).toBeNull()
  })
  it('all standard muscles exist', () => {
    const muscles = ['chest','back','quads','hamstrings','delts','glutes','biceps','triceps','calves','core']
    for (const m of muscles) {
      expect(volumeLandmarks(m)).not.toBeNull()
    }
  })
  it('mev < mav < mrv for all muscles', () => {
    const muscles = ['chest','back','biceps','calves']
    for (const m of muscles) {
      const lm = volumeLandmarks(m)
      expect(lm.mev).toBeLessThan(lm.mav)
      expect(lm.mav).toBeLessThan(lm.mrv)
    }
  })
})

// ── volumeStatus ──────────────────────────────────────────────────────────────
describe('volumeStatus', () => {
  it('under mev → under', () => {
    expect(volumeStatus(5, 'chest')).toBe('under')
  })
  it('at mev → optimal', () => {
    expect(volumeStatus(8, 'chest')).toBe('optimal')
  })
  it('between mev and mrv → optimal', () => {
    expect(volumeStatus(14, 'chest')).toBe('optimal')
  })
  it('at mrv → optimal', () => {
    expect(volumeStatus(22, 'chest')).toBe('optimal')
  })
  it('over mrv → over', () => {
    expect(volumeStatus(25, 'chest')).toBe('over')
  })
  it('returns null for unknown muscle', () => {
    expect(volumeStatus(10, 'unknown')).toBeNull()
  })
  it('returns null for negative sets', () => {
    expect(volumeStatus(-1, 'back')).toBeNull()
  })
  it('biceps under at 5 sets', () => {
    expect(volumeStatus(5, 'biceps')).toBe('under')
  })
  it('biceps over at 21 sets', () => {
    expect(volumeStatus(21, 'biceps')).toBe('over')
  })
})

// ── suggestNextLoad ───────────────────────────────────────────────────────────
describe('suggestNextLoad', () => {
  const ex = { reps_low: 8, reps_high: 12 }
  const bwEx = { reps_low: 8, reps_high: 12, is_bodyweight: true }

  it('returns no_history for empty history', () => {
    expect(suggestNextLoad([], ex).reason).toBe('no_history')
  })
  it('returns no_history for null history', () => {
    expect(suggestNextLoad(null, ex).reason).toBe('no_history')
  })

  it('add_weight when last 2 sessions both hit top range with RIR ≥ 1', () => {
    const history = [
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
    ]
    const r = suggestNextLoad(history, ex)
    expect(r.reason).toBe('add_weight')
    expect(r.load_kg).toBe(82.5)
  })

  it('hold when last set missed bottom of range', () => {
    const history = [
      { reps: 7, load_kg: 80, rir: 2, is_warmup: false },
    ]
    expect(suggestNextLoad(history, ex).reason).toBe('hold')
    expect(suggestNextLoad(history, ex).load_kg).toBe(80)
  })

  it('hold when RIR = 0 (failure)', () => {
    const history = [
      { reps: 10, load_kg: 80, rir: 0, is_warmup: false },
    ]
    expect(suggestNextLoad(history, ex).reason).toBe('hold')
  })

  it('deload after 3 stalls', () => {
    const history = [
      { reps: 7, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 7, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 7, load_kg: 80, rir: 2, is_warmup: false },
    ]
    const r = suggestNextLoad(history, ex)
    expect(r.reason).toBe('deload')
    expect(r.load_kg).toBe(65) // 80 × 0.8 = 64 → rounds to 65 (nearest 2.5)
  })

  it('bodyweight: add_reps (not weight) when progressing', () => {
    const history = [
      { reps: 12, load_kg: 0, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 0, rir: 2, is_warmup: false },
    ]
    const r = suggestNextLoad(history, bwEx)
    expect(r.reason).toBe('add_reps')
    expect(r.load_kg).toBeNull()
  })

  it('skips warmup sets', () => {
    const history = [
      { reps: 5, load_kg: 60, rir: 5, is_warmup: true },  // warmup — skip
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
    ]
    const r = suggestNextLoad(history, ex)
    expect(r.reason).toBe('add_weight')
  })

  it('single session hitting top → add_weight (only need 1 data point)', () => {
    const history = [
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
    ]
    expect(suggestNextLoad(history, ex).reason).toBe('add_weight')
  })

  it('increment is 1.25 for loads under 60kg', () => {
    const history = [
      { reps: 12, load_kg: 40, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 40, rir: 2, is_warmup: false },
    ]
    const r = suggestNextLoad(history, ex)
    expect(r.load_kg).toBe(41.25)
  })

  it('increment is 2.5 for loads ≥ 60kg', () => {
    const history = [
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
    ]
    expect(suggestNextLoad(history, ex).load_kg).toBe(82.5)
  })

  // Gap-aware resume protocol
  it('gap = 0 → normal overload logic unchanged', () => {
    const history = [
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
    ]
    expect(suggestNextLoad(history, ex, 0).reason).toBe('add_weight')
  })
  it('gap = 5 → normal overload (< 14 days)', () => {
    const history = [
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
    ]
    expect(suggestNextLoad(history, ex, 5).reason).toBe('add_weight')
  })
  it('gap = 20 → caps at last load (no overload, 14–30 day window)', () => {
    const history = [
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
      { reps: 12, load_kg: 80, rir: 2, is_warmup: false },
    ]
    const r = suggestNextLoad(history, ex, 20)
    expect(r.reason).toBe('hold')
    expect(r.load_kg).toBe(80)
  })
  it('gap = 60 → 90% of last load, expanded rep range', () => {
    const history = [{ reps: 12, load_kg: 80, rir: 2, is_warmup: false }]
    const r = suggestNextLoad(history, ex, 60)
    expect(r.reason).toBe('gap_return')
    expect(r.load_kg).toBe(72.5) // 80 × 0.9 = 72 → nearest 2.5
    expect(r.reps_high).toBe(14) // 12 + 2
  })
  it('gap = 120 → 80% of last load, +3 reps, reorientation flag', () => {
    const history = [{ reps: 12, load_kg: 100, rir: 2, is_warmup: false }]
    const r = suggestNextLoad(history, ex, 120)
    expect(r.reason).toBe('gap_return')
    expect(r.load_kg).toBe(80) // 100 × 0.8 = 80
    expect(r.reps_high).toBe(15) // 12 + 3
    expect(r.reorientation).toBe(true)
  })
  it('gap = 91 → reorientation', () => {
    const history = [{ reps: 10, load_kg: 60, rir: 2, is_warmup: false }]
    expect(suggestNextLoad(history, ex, 91).reorientation).toBe(true)
  })
  it('gap = 30 → exactly on boundary: gap_return', () => {
    const history = [{ reps: 10, load_kg: 80, rir: 2, is_warmup: false }]
    const r = suggestNextLoad(history, ex, 31)
    expect(r.reason).toBe('gap_return')
  })
  it('bodyweight exercise ignores gap load adjustment', () => {
    const bwEx = { reps_low: 8, reps_high: 12, is_bodyweight: true }
    const history = [{ reps: 12, load_kg: 0, rir: 2, is_warmup: false }]
    // gap shouldn't trigger load reduction on BW
    const r = suggestNextLoad(history, bwEx, 120)
    expect(r.load_kg).toBeNull()
  })
})

// ── suggestTemplate ───────────────────────────────────────────────────────────
describe('suggestTemplate', () => {
  it('bw equipment → bw_starter_3day regardless of goal', () => {
    expect(suggestTemplate({ goal: 'muscle', days: 3, equipment: 'bw', experience: 'beginner' })).toBe('bw_starter_3day')
  })
  it('home + 3 days → home_db_3day', () => {
    expect(suggestTemplate({ goal: 'general', days: 3, equipment: 'home' })).toBe('home_db_3day')
  })
  it('home + 4 days → home_db_4day', () => {
    expect(suggestTemplate({ goal: 'general', days: 4, equipment: 'home' })).toBe('home_db_4day')
  })
  it('recomp → recomp_4day', () => {
    expect(suggestTemplate({ goal: 'recomp', days: 4, equipment: 'gym' })).toBe('recomp_4day')
  })
  it('muscle + 6 days → ppl_6day_intermediate', () => {
    expect(suggestTemplate({ goal: 'muscle', days: 6, equipment: 'gym' })).toBe('ppl_6day_intermediate')
  })
  it('muscle + 3 days + gym → ppl_3day_beginner', () => {
    expect(suggestTemplate({ goal: 'muscle', days: 3, equipment: 'gym' })).toBe('ppl_3day_beginner')
  })
  it('muscle + 4 days + intermediate → ul_4day_intermediate', () => {
    expect(suggestTemplate({ goal: 'muscle', days: 4, equipment: 'gym', experience: 'intermediate' })).toBe('ul_4day_intermediate')
  })
  it('muscle + 4 days + beginner → ul_4day_beginner', () => {
    expect(suggestTemplate({ goal: 'muscle', days: 4, equipment: 'gym', experience: 'beginner' })).toBe('ul_4day_beginner')
  })
  it('general + 3 days + gym → fb_3day_beginner', () => {
    expect(suggestTemplate({ goal: 'general', days: 3, equipment: 'gym' })).toBe('fb_3day_beginner')
  })
  it('strength + 3 days → fb_3day_beginner', () => {
    expect(suggestTemplate({ goal: 'strength', days: 3, equipment: 'gym' })).toBe('fb_3day_beginner')
  })
  it('no args → fallback to ul_4day_beginner', () => {
    expect(suggestTemplate({})).toBe('ul_4day_beginner')
  })
  it('undefined args → fallback', () => {
    expect(suggestTemplate()).toBe('ul_4day_beginner')
  })
})

// ── advanceRotation ───────────────────────────────────────────────────────────
describe('advanceRotation', () => {
  it('0 → 1 on a 3-day program', () => {
    const r = advanceRotation({ next_day_index: 0, sessions_completed: 0, template_days_count: 3 })
    expect(r.next_day_index).toBe(1)
    expect(r.sessions_completed).toBe(1)
  })
  it('1 → 2 on a 3-day program', () => {
    const r = advanceRotation({ next_day_index: 1, sessions_completed: 5, template_days_count: 3 })
    expect(r.next_day_index).toBe(2)
    expect(r.sessions_completed).toBe(6)
  })
  it('2 → 0 on a 3-day program (wraps)', () => {
    const r = advanceRotation({ next_day_index: 2, sessions_completed: 2, template_days_count: 3 })
    expect(r.next_day_index).toBe(0)
  })
  it('5 → 0 on a 6-day program (wraps)', () => {
    const r = advanceRotation({ next_day_index: 5, sessions_completed: 11, template_days_count: 6 })
    expect(r.next_day_index).toBe(0)
  })
  it('increments sessions_completed regardless of wrap', () => {
    const r = advanceRotation({ next_day_index: 3, sessions_completed: 99, template_days_count: 4 })
    expect(r.sessions_completed).toBe(100)
  })
  it('handles null template_days_count gracefully', () => {
    const r = advanceRotation({ next_day_index: 1, sessions_completed: 2, template_days_count: null })
    expect(r.next_day_index).toBe(0)
    expect(r.sessions_completed).toBe(3)
  })
  it('handles undefined program gracefully', () => {
    const r = advanceRotation(undefined)
    expect(r.sessions_completed).toBe(1)
  })
  it('1-day program pointer always stays at 0', () => {
    const r = advanceRotation({ next_day_index: 0, sessions_completed: 10, template_days_count: 1 })
    expect(r.next_day_index).toBe(0)
  })
})

// ── daysSinceLastSession ──────────────────────────────────────────────────────
describe('daysSinceLastSession', () => {
  it('returns null when lastSessionDate is null', () => {
    expect(daysSinceLastSession(null)).toBeNull()
  })
  it('returns null when lastSessionDate is undefined', () => {
    expect(daysSinceLastSession(undefined)).toBeNull()
  })
  it('returns 0 when last session was today', () => {
    const today = new Date('2026-04-27')
    expect(daysSinceLastSession('2026-04-27', today)).toBe(0)
  })
  it('returns 4 when last session was 4 days ago', () => {
    const today = new Date('2026-04-27')
    expect(daysSinceLastSession('2026-04-23', today)).toBe(4)
  })
  it('returns 30 when last session was 30 days ago', () => {
    const today = new Date('2026-04-27')
    expect(daysSinceLastSession('2026-03-28', today)).toBe(30)
  })
  it('returns 90 for a 90-day gap', () => {
    const today = new Date('2026-04-27')
    expect(daysSinceLastSession('2026-01-27', today)).toBe(90)
  })
  it('is non-negative (no future last sessions in prod)', () => {
    const today = new Date('2026-04-27')
    const result = daysSinceLastSession('2026-04-20', today)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

// ── plateCalculator ───────────────────────────────────────────────────────────
describe('plateCalculator', () => {
  it('returns null for null input', () => {
    expect(plateCalculator(null)).toBeNull()
  })
  it('returns null for 0 kg', () => {
    expect(plateCalculator(0)).toBeNull()
  })
  it('returns barOnly for load equal to bar weight', () => {
    expect(plateCalculator(20)).toEqual({ barOnly: true, perSide: 0, plates: [] })
  })
  it('returns barOnly for load less than bar weight', () => {
    expect(plateCalculator(10)).toEqual({ barOnly: true, perSide: 0, plates: [] })
  })
  it('60 kg = 20 kg bar + 20 per side', () => {
    const r = plateCalculator(60)
    expect(r.barOnly).toBe(false)
    expect(r.perSide).toBe(20)
    expect(r.plates).toEqual([{ kg: 20, count: 1 }])
  })
  it('100 kg = 20 kg bar + 40 per side (20+20)', () => {
    const r = plateCalculator(100)
    expect(r.perSide).toBe(40)
    expect(r.plates).toEqual([{ kg: 20, count: 2 }])
  })
  it('80 kg = 20+10 per side', () => {
    const r = plateCalculator(80)
    expect(r.perSide).toBe(30)
    expect(r.plates).toEqual([{ kg: 20, count: 1 }, { kg: 10, count: 1 }])
  })
  it('uses custom bar weight', () => {
    const r = plateCalculator(50, 15)
    expect(r.perSide).toBe(17.5)
  })
  it('handles 2.5 kg remainder', () => {
    const r = plateCalculator(65)
    expect(r.perSide).toBe(22.5)
    const total = r.plates.reduce((s, p) => s + p.kg * p.count, 0)
    expect(total).toBeCloseTo(22.5, 1)
  })
})

// ── weeklyMuscleFrequency ─────────────────────────────────────────────────────
describe('weeklyMuscleFrequency', () => {
  const exDefs = [
    { id: 'squat',  primary_muscle: 'quads' },
    { id: 'bench',  primary_muscle: 'chest' },
    { id: 'row',    primary_muscle: 'back'  },
    { id: 'press',  primary_muscle: 'delts' },
  ]

  it('returns empty object with no sessions', () => {
    expect(weeklyMuscleFrequency([], exDefs, '2026-04-21')).toEqual({})
  })
  it('counts one session correctly', () => {
    const sessions = [{ session_date: '2026-04-21', exercises: [{ exercise_id: 'squat' }, { exercise_id: 'bench' }] }]
    const r = weeklyMuscleFrequency(sessions, exDefs, '2026-04-21')
    expect(r.quads).toBe(1)
    expect(r.chest).toBe(1)
    expect(r.back).toBeUndefined()
  })
  it('counts multiple sessions per muscle', () => {
    const sessions = [
      { session_date: '2026-04-21', exercises: [{ exercise_id: 'bench' }] },
      { session_date: '2026-04-23', exercises: [{ exercise_id: 'bench' }] },
    ]
    const r = weeklyMuscleFrequency(sessions, exDefs, '2026-04-21')
    expect(r.chest).toBe(2)
  })
  it('excludes sessions before week start', () => {
    const sessions = [
      { session_date: '2026-04-20', exercises: [{ exercise_id: 'squat' }] },
      { session_date: '2026-04-21', exercises: [{ exercise_id: 'bench' }] },
    ]
    const r = weeklyMuscleFrequency(sessions, exDefs, '2026-04-21')
    expect(r.quads).toBeUndefined()
    expect(r.chest).toBe(1)
  })
  it('counts each muscle once per session even with multiple exercises', () => {
    const sessions = [{ session_date: '2026-04-21', exercises: [{ exercise_id: 'squat' }, { exercise_id: 'squat' }] }]
    const r = weeklyMuscleFrequency(sessions, exDefs, '2026-04-21')
    expect(r.quads).toBe(1)
  })
  it('handles missing exercise_id gracefully', () => {
    const sessions = [{ session_date: '2026-04-21', exercises: [{ exercise_id: 'unknown_ex' }] }]
    expect(() => weeklyMuscleFrequency(sessions, exDefs, '2026-04-21')).not.toThrow()
  })
})

// ── computeSessionPRs ─────────────────────────────────────────────────────────
describe('computeSessionPRs', () => {
  const defs = [
    { id: 'squat', name_en: 'Barbell Back Squat', name_tr: 'Barbell Arka Squat' },
    { id: 'bench', name_en: 'Barbell Bench Press', name_tr: 'Barbell Bench Press' },
  ]

  const makeSession = (exId, sets) => ({
    exercises: [{ exercise_id: exId, sets }]
  })
  const makeSet = (load_kg, reps, is_warmup = false) => ({ load_kg, reps, is_warmup })

  it('returns empty array when no sessions', () => {
    expect(computeSessionPRs(null, [], defs)).toEqual([])
  })
  it('returns empty array when exercises have no loaded sets', () => {
    const sess = makeSession('squat', [makeSet(0, 8)])
    expect(computeSessionPRs(sess, [], defs)).toEqual([])
  })
  it('detects first-ever PR (no prior history)', () => {
    const sess = makeSession('squat', [makeSet(80, 5)])
    const prs = computeSessionPRs(sess, [], defs)
    expect(prs).toHaveLength(1)
    expect(prs[0].exercise_id).toBe('squat')
    expect(prs[0].new1RM).toBeGreaterThan(80)
    expect(prs[0].prev1RM).toBeNull()
  })
  it('detects improved PR over prior session', () => {
    const prev = makeSession('squat', [makeSet(80, 5)])
    const curr = makeSession('squat', [makeSet(82.5, 5)])
    const prs = computeSessionPRs(curr, [prev], defs)
    expect(prs).toHaveLength(1)
    expect(prs[0].new1RM).toBeGreaterThan(prs[0].prev1RM)
  })
  it('does not flag when load is same', () => {
    const prev = makeSession('squat', [makeSet(80, 5)])
    const curr = makeSession('squat', [makeSet(80, 5)])
    expect(computeSessionPRs(curr, [prev], defs)).toHaveLength(0)
  })
  it('does not flag when load decreased', () => {
    const prev = makeSession('squat', [makeSet(80, 5)])
    const curr = makeSession('squat', [makeSet(70, 5)])
    expect(computeSessionPRs(curr, [prev], defs)).toHaveLength(0)
  })
  it('ignores warmup sets', () => {
    const curr = makeSession('squat', [makeSet(100, 5, true)])
    expect(computeSessionPRs(curr, [], defs)).toHaveLength(0)
  })
  it('picks best set from session, not first', () => {
    const curr = makeSession('squat', [makeSet(60, 5), makeSet(80, 5), makeSet(70, 5)])
    const prs = computeSessionPRs(curr, [], defs)
    expect(prs[0].new1RM).toBeGreaterThan(estimate1RM(60, 5).median)
  })
  it('handles multiple exercises simultaneously', () => {
    const curr = { exercises: [
      { exercise_id: 'squat', sets: [makeSet(80, 5)] },
      { exercise_id: 'bench', sets: [makeSet(60, 8)] },
    ]}
    const prs = computeSessionPRs(curr, [], defs)
    expect(prs).toHaveLength(2)
  })
  it('uses exercise def name fields', () => {
    const curr = makeSession('squat', [makeSet(80, 5)])
    const prs = computeSessionPRs(curr, [], defs)
    expect(prs[0].name_en).toBe('Barbell Back Squat')
    expect(prs[0].name_tr).toBe('Barbell Arka Squat')
  })
})
