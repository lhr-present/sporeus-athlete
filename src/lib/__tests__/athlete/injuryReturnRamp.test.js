// src/lib/__tests__/athlete/injuryReturnRamp.test.js
import { describe, it, expect } from 'vitest'
import { buildReturnToSportRamp, INJURY_RAMP_CITATION } from '../../athlete/injuryReturnRamp.js'

describe('buildReturnToSportRamp — input validation', () => {
  it('returns null for null/non-object', () => {
    expect(buildReturnToSportRamp(null)).toBeNull()
    expect(buildReturnToSportRamp(undefined)).toBeNull()
    expect(buildReturnToSportRamp(42)).toBeNull()
  })

  it('rejects missing sport', () => {
    const r = buildReturnToSportRamp({ injuryType: 'overuse', daysOff: 14, preInjuryCTL: 50 })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('missing-sport')
  })

  it('rejects invalid injury type', () => {
    const r = buildReturnToSportRamp({ sport: 'run', injuryType: 'banana', daysOff: 14, preInjuryCTL: 50 })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('invalid-injury-type')
  })

  it('rejects invalid body region', () => {
    const r = buildReturnToSportRamp({ sport: 'run', injuryType: 'impact', bodyRegion: 'finger', daysOff: 14, preInjuryCTL: 50 })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('invalid-body-region')
  })

  it('rejects non-finite daysOff', () => {
    const r = buildReturnToSportRamp({ sport: 'run', injuryType: 'overuse', daysOff: -3, preInjuryCTL: 50 })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('invalid-days-off')
  })

  it('rejects non-positive CTL', () => {
    const r = buildReturnToSportRamp({ sport: 'run', injuryType: 'overuse', daysOff: 14, preInjuryCTL: 0 })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('invalid-pre-injury-ctl')
  })
})

describe('buildReturnToSportRamp — base 5-week ramp (14-30 days off, non-impact)', () => {
  it('soft-tissue / 21 days / CTL 50 → 5-week ramp', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'soft-tissue', daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.totalRampWeeks).toBe(5)
    expect(r.weeks).toHaveLength(5)
    expect(r.weeks[0].volumePct).toBe(30)
    expect(r.weeks[4].volumePct).toBe(100)
    expect(r.weeks[0].weeklyTSS).toBe(Math.round(50 * 7 * 0.30))
    expect(r.weeks[4].weeklyTSS).toBe(Math.round(50 * 7 * 1.00))
  })

  it('volume percentages are monotonically non-decreasing', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'soft-tissue', daysOff: 21, preInjuryCTL: 50,
    })
    for (let i = 1; i < r.weeks.length; i++) {
      expect(r.weeks[i].volumePct).toBeGreaterThanOrEqual(r.weeks[i - 1].volumePct)
    }
  })

  it('week-1 ACWR target = 1.0; week-3+ relaxes', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'soft-tissue', daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.weeks[0].acwrTarget).toBe(1.0)
    expect(r.weeks[1].acwrTarget).toBe(1.0)
    expect(r.weeks[2].acwrTarget).toBeGreaterThan(1.0)
  })

  it('quality sessions allowed only week 3+', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'soft-tissue', daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.weeks[0].maxQualitySessions).toBe(0)
    expect(r.weeks[1].maxQualitySessions).toBe(0)
    expect(r.weeks[2].maxQualitySessions).toBe(1)
    expect(r.weeks[4].maxQualitySessions).toBeGreaterThanOrEqual(2)
  })
})

describe('buildReturnToSportRamp — compressed 3-week ramp (<14 days)', () => {
  it('illness / 7 days → 3-week ramp starting at 50%', () => {
    const r = buildReturnToSportRamp({
      sport: 'bike', injuryType: 'illness', daysOff: 7, preInjuryCTL: 60,
    })
    expect(r.totalRampWeeks).toBe(3)
    expect(r.weeks[0].volumePct).toBe(50)
    expect(r.weeks[2].volumePct).toBe(100)
  })
})

describe('buildReturnToSportRamp — stretched 6-week ramp (>30 days)', () => {
  it('overuse / 45 days → 6-week ramp starting at 25%', () => {
    const r = buildReturnToSportRamp({
      sport: 'swim', injuryType: 'overuse', daysOff: 45, preInjuryCTL: 40,
    })
    expect(r.totalRampWeeks).toBe(6)
    expect(r.weeks[0].volumePct).toBe(25)
    expect(r.weeks[5].volumePct).toBe(100)
  })

  it('weeks 1-2 hold zero quality on the stretched ramp', () => {
    const r = buildReturnToSportRamp({
      sport: 'swim', injuryType: 'overuse', daysOff: 45, preInjuryCTL: 40,
    })
    expect(r.weeks[0].maxQualitySessions).toBe(0)
    expect(r.weeks[1].maxQualitySessions).toBe(0)
    expect(r.weeks[2].maxQualitySessions).toBe(0)
  })
})

describe('buildReturnToSportRamp — impact-injury preamble', () => {
  it('impact + lower-leg prepends 2-week non-impact preamble', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'impact', bodyRegion: 'lower-leg',
      daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.totalRampWeeks).toBe(7) // 2 preamble + 5 base
    expect(r.weeks[0].phase).toBe('preamble')
    expect(r.weeks[1].phase).toBe('preamble')
    expect(r.weeks[2].phase).toBe('ramp')
    expect(r.weeks[0].crossTrainingOnly).toBe(true)
    expect(r.weeks[1].crossTrainingOnly).toBe(true)
    expect(r.weeks[2].crossTrainingOnly).toBe(false)
  })

  it('impact + knee → 7 weeks', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'impact', bodyRegion: 'knee',
      daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.totalRampWeeks).toBe(7)
  })

  it('impact + upper-body (NOT load-bearing) → no preamble (5-week ramp)', () => {
    const r = buildReturnToSportRamp({
      sport: 'swim', injuryType: 'impact', bodyRegion: 'upper-body',
      daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.totalRampWeeks).toBe(5)
    expect(r.weeks[0].phase).toBe('ramp')
  })

  it('impact + lower-leg + >30 days → 2 preamble + 6 ramp = 8 weeks', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'impact', bodyRegion: 'lower-leg',
      daysOff: 60, preInjuryCTL: 55,
    })
    expect(r.totalRampWeeks).toBe(8)
  })
})

describe('buildReturnToSportRamp — bilingual notes + criteria', () => {
  it('every week has EN+TR note', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'impact', bodyRegion: 'lower-leg',
      daysOff: 21, preInjuryCTL: 50,
    })
    for (const w of r.weeks) {
      expect(w.note.en).toBeTruthy()
      expect(w.note.tr).toBeTruthy()
    }
  })

  it('returns 5 return-to-sport criteria with EN+TR', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'overuse', daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.criteria).toHaveLength(5)
    for (const c of r.criteria) {
      expect(c.en).toBeTruthy()
      expect(c.tr).toBeTruthy()
    }
  })

  it('returns 4 red flags', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'overuse', daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.redFlags.length).toBeGreaterThanOrEqual(4)
  })

  it('citation matches the protocol authorities', () => {
    expect(INJURY_RAMP_CITATION).toMatch(/Soligard/)
    expect(INJURY_RAMP_CITATION).toMatch(/Gabbett/)
    expect(INJURY_RAMP_CITATION).toMatch(/Mujika/)
    expect(INJURY_RAMP_CITATION).toMatch(/Ardern/)
  })
})

describe('buildReturnToSportRamp — TSS scales with pre-injury CTL', () => {
  it('higher CTL yields higher weekly TSS targets', () => {
    const low  = buildReturnToSportRamp({ sport: 'run', injuryType: 'overuse', daysOff: 21, preInjuryCTL: 30 })
    const high = buildReturnToSportRamp({ sport: 'run', injuryType: 'overuse', daysOff: 21, preInjuryCTL: 80 })
    for (let i = 0; i < low.weeks.length; i++) {
      expect(high.weeks[i].weeklyTSS).toBeGreaterThan(low.weeks[i].weeklyTSS)
    }
  })

  it('week-5 TSS = preInjuryCTL × 7 (100%)', () => {
    const r = buildReturnToSportRamp({
      sport: 'run', injuryType: 'overuse', daysOff: 21, preInjuryCTL: 50,
    })
    expect(r.weeks[4].weeklyTSS).toBe(350)
  })
})
