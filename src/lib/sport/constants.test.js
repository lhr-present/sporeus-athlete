import { describe, it, expect } from 'vitest'
import { BANISTER, ACWR, ROWING, DANIELS, LACTATE } from './constants.js'

describe('BANISTER constants', () => {
  it('K_CTL matches exponential formula', () => {
    expect(BANISTER.K_CTL).toBeCloseTo(1 - Math.exp(-1 / 42), 10)
  })
  it('K_ATL matches exponential formula', () => {
    expect(BANISTER.K_ATL).toBeCloseTo(1 - Math.exp(-1 / 7), 10)
  })
  it('constants are frozen', () => {
    expect(() => { BANISTER.TAU_CTL = 99 }).toThrow()
  })
})

describe('ACWR constants', () => {
  it('optimal range is 0.8–1.3', () => {
    expect(ACWR.OPTIMAL_MIN).toBe(0.8)
    expect(ACWR.OPTIMAL_MAX).toBe(1.3)
    expect(ACWR.CAUTION_MAX).toBe(1.5)
  })
})

describe('ROWING constants', () => {
  it('Pauls Law exponent is 1.07', () => {
    expect(ROWING.PAULS_LAW_EXPONENT).toBe(1.07)
  })
})

describe('DANIELS constants', () => {
  it('VO2 intercept and coefficients match Daniels & Gilbert 1979', () => {
    expect(DANIELS.VO2_INTERCEPT).toBe(-4.60)
    expect(DANIELS.VO2_V_COEF).toBe(0.182258)
    expect(DANIELS.VO2_V2_COEF).toBe(0.000104)
  })
  it('pctVO2max exponential coefficients are correct', () => {
    expect(DANIELS.PCT_VO2MAX_D).toBe(0.8)
    expect(DANIELS.PCT_VO2MAX_E).toBe(0.1894393)
    expect(DANIELS.PCT_VO2MAX_F).toBe(-0.012778)
    expect(DANIELS.PCT_VO2MAX_G).toBe(0.2989558)
    expect(DANIELS.PCT_VO2MAX_H).toBe(-0.1932605)
  })
  it('constants are frozen', () => {
    expect(() => { DANIELS.VO2_INTERCEPT = 0 }).toThrow()
  })
})

describe('LACTATE constants', () => {
  it('fixed threshold values match literature defaults', () => {
    expect(LACTATE.LT1_FIXED_MMOL).toBe(2.0)
    expect(LACTATE.LT2_FIXED_MMOL).toBe(4.0)
    expect(LACTATE.DMAX_FIT_DEGREE).toBe(3)
  })
  it('constants are frozen', () => {
    expect(() => { LACTATE.LT2_FIXED_MMOL = 99 }).toThrow()
  })
})
