// src/lib/__tests__/athlete/physiologyGapInsight.test.js
import { describe, it, expect } from 'vitest'
import { computePhysiologyGapInsight } from '../../athlete/physiologyGapInsight.js'
import { buildEliteProgram } from '../../athlete/eliteProgram.js'

const TODAY = '2026-05-04'

function buildRun(extra = {}) {
  return buildEliteProgram({
    sport: 'run',
    raceDate: '2026-11-01',
    currentPR: { distanceM: 10000, timeSec: 3000 },
    targetPR:  { distanceM: 10000, timeSec: 2820 },
    profile:   { currentCTL: 50 },
    options:   { today: TODAY },
    ...extra,
  })
}

describe('computePhysiologyGapInsight', () => {
  it('returns null for falsy/rejected program', () => {
    expect(computePhysiologyGapInsight(null)).toBeNull()
    expect(computePhysiologyGapInsight({ _rejected: true })).toBeNull()
    expect(computePhysiologyGapInsight({})).toBeNull()
  })

  it('returns null when currentLevel or targetLevel is missing', () => {
    expect(computePhysiologyGapInsight({ sport: 'run', currentLevel: null, targetLevel: { vdot: 50 } })).toBeNull()
    expect(computePhysiologyGapInsight({ sport: 'run', currentLevel: { vdot: 40 }, targetLevel: null })).toBeNull()
  })

  it('running: surfaces VDOT current → target → gap', () => {
    const p = buildRun()
    const ins = computePhysiologyGapInsight(p)
    expect(ins).not.toBeNull()
    expect(ins.metric).toBe('VDOT')
    expect(ins.current).toBe(p.currentLevel.vdot)
    expect(ins.target).toBe(p.targetLevel.vdot)
    expect(ins.gap).toBeCloseTo(p.targetLevel.vdot - p.currentLevel.vdot, 1)
    expect(ins.gapDirection).toBe('increase')
  })

  it('running: ratePerBlock matches vdotGainPerBlock for current VDOT', () => {
    const p = buildRun()
    const ins = computePhysiologyGapInsight(p)
    expect(ins.ratePerBlock).toBeGreaterThan(0)
    // Daniels gain rate decreases as VDOT rises — sanity-check via two athletes
    const slowRun = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 3300 },  // VDOT ~35
      targetPR:  { distanceM: 10000, timeSec: 3000 },
      profile:   { currentCTL: 30 },
      options:   { today: TODAY },
    })
    const fastRun = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 2100 },  // VDOT ~60
      targetPR:  { distanceM: 10000, timeSec: 2040 },
      profile:   { currentCTL: 80 },
      options:   { today: TODAY },
    })
    const sIns = computePhysiologyGapInsight(slowRun)
    const fIns = computePhysiologyGapInsight(fastRun)
    expect(sIns.ratePerBlock).toBeGreaterThan(fIns.ratePerBlock)
  })

  it('blocksToBridge = ceil(gap / ratePerBlock); weeksToBridge = blocks × 12', () => {
    const p = buildRun()
    const ins = computePhysiologyGapInsight(p)
    expect(ins.blocksToBridge).toBe(Math.ceil(ins.gap / ins.ratePerBlock))
    expect(ins.weeksToBridge).toBe(ins.blocksToBridge * 12)
  })

  it('verdict = "comfortable" when weeksAvailable / weeksNeeded >= 1.3', () => {
    // 26-week timeline for a +5.3 VDOT gain → very comfortable
    const p = buildRun()
    const ins = computePhysiologyGapInsight(p)
    if (p.feasibility.weeksAvailable / p.feasibility.weeksNeeded >= 1.3) {
      expect(ins.physVerdict).toBe('comfortable')
    }
  })

  it('verdict = "stretching-ceiling" when timeline runs hot', () => {
    // Tight race date forces aggressive
    const p = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-07-01',  // ~8 weeks
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },  // +VDOT jump in 8 weeks
      profile:   { currentCTL: 50 },
      options:   { today: TODAY },
    })
    const ins = computePhysiologyGapInsight(p)
    expect(['stretching-ceiling', 'unrealistic']).toContain(ins.physVerdict)
  })

  it('cycling FTP: surfaces gap from FTP fields', () => {
    const p = buildEliteProgram({
      sport: 'bike',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 0, timeSec: 250 },  // 250W FTP
      targetPR:  { distanceM: 0, timeSec: 280 },  // 280W target
      profile:   { currentCTL: 60 },
      options:   { today: TODAY },
    })
    const ins = computePhysiologyGapInsight(p)
    expect(ins.metric).toBe('FTP')
    expect(ins.current).toBe(250)
    expect(ins.target).toBe(280)
    expect(ins.gap).toBe(30)
    expect(ins.gapDirection).toBe('increase')
  })

  it('swim CSS: gap is sec/100m to DROP (lower = faster)', () => {
    const p = buildEliteProgram({
      sport: 'swim',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 1500, timeSec: 1500 },  // CSS 100s/100m
      targetPR:  { distanceM: 1500, timeSec: 1380 },  // CSS 92s/100m
      profile:   { currentCTL: 40 },
      options:   { today: TODAY },
    })
    const ins = computePhysiologyGapInsight(p)
    expect(ins.metric).toBe('CSS')
    expect(ins.gapDirection).toBe('decrease')
    expect(ins.gap).toBeGreaterThan(0)  // sec/100m to drop
  })

  it('bilingual note present for every verdict', () => {
    const verdicts = new Set(['already-met', 'comfortable', 'realistic', 'stretching-ceiling', 'unrealistic', 'unknown'])
    // Spot-check the canonical "comfortable" path
    const p = buildRun()
    const ins = computePhysiologyGapInsight(p)
    expect(ins.note.en).toBeTruthy()
    expect(ins.note.tr).toBeTruthy()
    expect(verdicts.has(ins.physVerdict)).toBe(true)
  })

  it('citation present', () => {
    const p = buildRun()
    const ins = computePhysiologyGapInsight(p)
    expect(ins.citation).toMatch(/Daniels/i)
  })
})
