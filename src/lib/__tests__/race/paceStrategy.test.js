import { describe, it, expect } from 'vitest'
import { computePaceStrategy, gradeAdjustment } from '../../race/paceStrategy.js'

// ── gradeAdjustment unit tests ─────────────────────────────────────────────────

describe('gradeAdjustment', () => {
  it('flat grade → 0 adjustment', () => expect(gradeAdjustment(0)).toBe(0))
  it('3% uphill → +22.5 s/km', () => expect(gradeAdjustment(3)).toBeCloseTo(22.5, 1))
  it('2% downhill → −10 s/km', () => expect(gradeAdjustment(-2)).toBeCloseTo(-10, 1))
  it('5% downhill capped at -2%: same as -2%', () => {
    expect(gradeAdjustment(-5)).toBeCloseTo(gradeAdjustment(-2), 1)
  })
})

// ── computePaceStrategy integration tests ─────────────────────────────────────

describe('computePaceStrategy', () => {
  it('VDOT 50 marathon: total time in realistic range [2:30–4:30]', () => {
    const r = computePaceStrategy({ vdot: 50, raceDistance_m: 42195 })
    expect(r).not.toBeNull()
    const lastSplit = r.splits[r.splits.length - 1]
    expect(lastSplit.cumulative_s).toBeGreaterThan(9000)   // > 2:30
    expect(lastSplit.cumulative_s).toBeLessThan(16200)     // < 4:30
  })

  it('VDOT 60 10k: total time in realistic range [30–45 min]', () => {
    const r = computePaceStrategy({ vdot: 60, raceDistance_m: 10000 })
    expect(r).not.toBeNull()
    const lastSplit = r.splits[r.splits.length - 1]
    expect(lastSplit.cumulative_s).toBeGreaterThan(1800)
    expect(lastSplit.cumulative_s).toBeLessThan(2700)
  })

  it('VDOT 40 half-marathon: total time in realistic range [1:30–2:30]', () => {
    const r = computePaceStrategy({ vdot: 40, raceDistance_m: 21097 })
    expect(r).not.toBeNull()
    const lastSplit = r.splits[r.splits.length - 1]
    expect(lastSplit.cumulative_s).toBeGreaterThan(5400)
    expect(lastSplit.cumulative_s).toBeLessThan(9000)
  })

  it('flat course: grade_adjusted == target for every split', () => {
    const r = computePaceStrategy({ vdot: 50, raceDistance_m: 10000 })
    for (const s of r.splits) {
      expect(s.grade_adjusted_s_per_km).toBe(s.target_s_per_km)
    }
  })

  it('uphill 3% grade adds ~22s/km (within 10% tolerance)', () => {
    const flat = computePaceStrategy({ vdot: 50, raceDistance_m: 10000 })
    const hilly = computePaceStrategy({
      vdot: 50,
      raceDistance_m: 10000,
      courseProfile: [{ distance_m: 10000, gradient_pct: 3 }],
    })
    const diff = hilly.splits[0].grade_adjusted_s_per_km - flat.splits[0].grade_adjusted_s_per_km
    expect(diff).toBeCloseTo(22.5, -1)  // within ~10%
  })

  it('downhill 2% grade subtracts ~10s/km', () => {
    const flat = computePaceStrategy({ vdot: 50, raceDistance_m: 10000 })
    const down = computePaceStrategy({
      vdot: 50,
      raceDistance_m: 10000,
      courseProfile: [{ distance_m: 10000, gradient_pct: -2 }],
    })
    const diff = flat.splits[0].grade_adjusted_s_per_km - down.splits[0].grade_adjusted_s_per_km
    expect(diff).toBeCloseTo(10, -1)
  })

  it('downhill 5% no additional speedup beyond -2%', () => {
    const down2 = computePaceStrategy({
      vdot: 50, raceDistance_m: 10000,
      courseProfile: [{ distance_m: 10000, gradient_pct: -2 }],
    })
    const down5 = computePaceStrategy({
      vdot: 50, raceDistance_m: 10000,
      courseProfile: [{ distance_m: 10000, gradient_pct: -5 }],
    })
    expect(down5.splits[0].grade_adjusted_s_per_km).toBe(down2.splits[0].grade_adjusted_s_per_km)
  })

  it('cumulative times monotonically increase', () => {
    const r = computePaceStrategy({ vdot: 50, raceDistance_m: 42195 })
    for (let i = 1; i < r.splits.length; i++) {
      expect(r.splits[i].cumulative_s).toBeGreaterThan(r.splits[i - 1].cumulative_s)
    }
  })

  it('marathon produces 43 splits (42.195 km → ceil = 43)', () => {
    const r = computePaceStrategy({ vdot: 50, raceDistance_m: 42195 })
    expect(r.splits).toHaveLength(43)
  })

  it('10k produces 10 splits', () => {
    const r = computePaceStrategy({ vdot: 50, raceDistance_m: 10000 })
    expect(r.splits).toHaveLength(10)
  })

  it('target_time basis overrides VDOT when both provided', () => {
    const target = 3600  // 1 hour for 10k
    const r = computePaceStrategy({ vdot: 60, raceDistance_m: 10000, targetTime_s: target })
    expect(r.basis).toBe('target_time')
    expect(r.avgPace_s_per_km).toBe(360)  // 3600/10
  })

  it('missing VDOT AND targetTime → null', () => {
    const r = computePaceStrategy({ raceDistance_m: 10000 })
    expect(r).toBeNull()
  })

  it('citation present', () => {
    const r = computePaceStrategy({ vdot: 50, raceDistance_m: 10000 })
    expect(r.citation).toContain('Daniels')
  })
})
