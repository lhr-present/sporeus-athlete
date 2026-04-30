// src/lib/__tests__/sport/normativeTables.test.js — E94
import { describe, it, expect } from 'vitest'
import {
  FTP_NORMS,
  VO2MAX_NORMS,
  CTL_NORMS,
  ROW_2000M_NORMS,
  RUNNING_VDOT_NORMS,
  getFTPNorm,
  getVO2maxNorm,
  getCTLNorm,
} from '../../sport/normativeTables.js'

// ─── 1. Constant table shapes ────────────────────────────────────────────────
describe('FTP_NORMS constant', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(FTP_NORMS)).toBe(true)
    expect(FTP_NORMS.length).toBeGreaterThan(0)
  })

  it('each row has sport, gender, category, p25, p50, p75', () => {
    for (const row of FTP_NORMS) {
      expect(row).toHaveProperty('sport')
      expect(row).toHaveProperty('gender')
      expect(row).toHaveProperty('category')
      expect(typeof row.p25).toBe('number')
      expect(typeof row.p50).toBe('number')
      expect(typeof row.p75).toBe('number')
    }
  })

  it('contains exactly 6 categories for cycling male', () => {
    const rows = FTP_NORMS.filter(r => r.sport === 'cycling' && r.gender === 'male')
    expect(rows).toHaveLength(6)
  })

  it('p25 < p50 < p75 for all rows (monotonic)', () => {
    for (const row of FTP_NORMS) {
      expect(row.p25).toBeLessThan(row.p50)
      expect(row.p50).toBeLessThan(row.p75)
    }
  })

  it('cycling male Elite p50 is 5.6', () => {
    const row = FTP_NORMS.find(r => r.sport === 'cycling' && r.gender === 'male' && r.category === 'Elite')
    expect(row).toBeDefined()
    expect(row.p50).toBe(5.6)
  })

  it('triathlon female Recreational p50 is 1.9', () => {
    const row = FTP_NORMS.find(r => r.sport === 'triathlon' && r.gender === 'female' && r.category === 'Recreational')
    expect(row).toBeDefined()
    expect(row.p50).toBe(1.9)
  })
})

describe('VO2MAX_NORMS constant', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(VO2MAX_NORMS)).toBe(true)
    expect(VO2MAX_NORMS.length).toBeGreaterThan(0)
  })

  it('each row has sport, gender, ageGroup, poor, fair, good, excellent, superior', () => {
    for (const row of VO2MAX_NORMS) {
      expect(row).toHaveProperty('sport')
      expect(row).toHaveProperty('gender')
      expect(row).toHaveProperty('ageGroup')
      expect(typeof row.poor).toBe('number')
      expect(typeof row.fair).toBe('number')
      expect(typeof row.good).toBe('number')
      expect(typeof row.excellent).toBe('number')
      expect(typeof row.superior).toBe('number')
    }
  })

  it('poor < fair < good < excellent < superior for all rows', () => {
    for (const row of VO2MAX_NORMS) {
      expect(row.poor).toBeLessThan(row.fair)
      expect(row.fair).toBeLessThan(row.good)
      expect(row.good).toBeLessThan(row.excellent)
      expect(row.excellent).toBeLessThan(row.superior)
    }
  })

  it('running male 18-29 has correct thresholds', () => {
    const row = VO2MAX_NORMS.find(r => r.sport === 'running' && r.gender === 'male' && r.ageGroup === '18-29')
    expect(row).toBeDefined()
    expect(row.poor).toBe(38)
    expect(row.fair).toBe(43)
    expect(row.good).toBe(48)
    expect(row.excellent).toBe(53)
    expect(row.superior).toBe(60)
  })

  it('rowing female 40-49 has correct thresholds', () => {
    const row = VO2MAX_NORMS.find(r => r.sport === 'rowing' && r.gender === 'female' && r.ageGroup === '40-49')
    expect(row).toBeDefined()
    expect(row.poor).toBe(24)
    expect(row.excellent).toBe(41)
    expect(row.superior).toBe(47)
  })
})

describe('CTL_NORMS constant', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(CTL_NORMS)).toBe(true)
    expect(CTL_NORMS.length).toBeGreaterThan(0)
  })

  it('each row has sport, level, typical_ctl_range, peak_ctl_range', () => {
    for (const row of CTL_NORMS) {
      expect(row).toHaveProperty('sport')
      expect(row).toHaveProperty('level')
      expect(Array.isArray(row.typical_ctl_range)).toBe(true)
      expect(row.typical_ctl_range).toHaveLength(2)
      expect(Array.isArray(row.peak_ctl_range)).toBe(true)
      expect(row.peak_ctl_range).toHaveLength(2)
    }
  })

  it('typical_ctl_range[0] < typical_ctl_range[1] for all rows', () => {
    for (const row of CTL_NORMS) {
      expect(row.typical_ctl_range[0]).toBeLessThan(row.typical_ctl_range[1])
    }
  })

  it('cycling elite typical range is [100, 140]', () => {
    const row = CTL_NORMS.find(r => r.sport === 'cycling' && r.level === 'elite')
    expect(row).toBeDefined()
    expect(row.typical_ctl_range).toEqual([100, 140])
    expect(row.peak_ctl_range).toEqual([130, 160])
  })
})

describe('ROW_2000M_NORMS constant', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ROW_2000M_NORMS)).toBe(true)
    expect(ROW_2000M_NORMS.length).toBeGreaterThan(0)
  })

  it('each row has ageGroup, weightCategory, gender, and times object', () => {
    for (const row of ROW_2000M_NORMS) {
      expect(row).toHaveProperty('ageGroup')
      expect(row).toHaveProperty('weightCategory')
      expect(row).toHaveProperty('gender')
      expect(row).toHaveProperty('times')
      expect(row.times).toHaveProperty('elite')
      expect(row.times).toHaveProperty('national')
      expect(row.times).toHaveProperty('club')
      expect(row.times).toHaveProperty('recreational')
    }
  })

  it('heavyweight male 18-29 elite is 5:40', () => {
    const row = ROW_2000M_NORMS.find(
      r => r.ageGroup === '18-29' && r.weightCategory === 'heavyweight' && r.gender === 'male'
    )
    expect(row).toBeDefined()
    expect(row.times.elite).toBe('5:40')
    expect(row.times.recreational).toBe('7:15')
  })

  it('lightweight female 60+ club is 9:30', () => {
    const row = ROW_2000M_NORMS.find(
      r => r.ageGroup === '60+' && r.weightCategory === 'lightweight' && r.gender === 'female'
    )
    expect(row).toBeDefined()
    expect(row.times.club).toBe('9:30')
  })
})

describe('RUNNING_VDOT_NORMS constant', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(RUNNING_VDOT_NORMS)).toBe(true)
    expect(RUNNING_VDOT_NORMS.length).toBeGreaterThan(0)
  })

  it('each row has ageGroup, gender, and vdot with p25/p50/p75/p90', () => {
    for (const row of RUNNING_VDOT_NORMS) {
      expect(row).toHaveProperty('ageGroup')
      expect(row).toHaveProperty('gender')
      expect(row).toHaveProperty('vdot')
      expect(typeof row.vdot.p25).toBe('number')
      expect(typeof row.vdot.p50).toBe('number')
      expect(typeof row.vdot.p75).toBe('number')
      expect(typeof row.vdot.p90).toBe('number')
    }
  })

  it('male 18-29 vdot percentiles are monotonic and correct', () => {
    const row = RUNNING_VDOT_NORMS.find(r => r.ageGroup === '18-29' && r.gender === 'male')
    expect(row).toBeDefined()
    expect(row.vdot.p25).toBe(39)
    expect(row.vdot.p50).toBe(47)
    expect(row.vdot.p75).toBe(56)
    expect(row.vdot.p90).toBe(65)
    expect(row.vdot.p25).toBeLessThan(row.vdot.p50)
    expect(row.vdot.p50).toBeLessThan(row.vdot.p75)
    expect(row.vdot.p75).toBeLessThan(row.vdot.p90)
  })

  it('female 60+ vdot p50 is 27', () => {
    const row = RUNNING_VDOT_NORMS.find(r => r.ageGroup === '60+' && r.gender === 'female')
    expect(row).toBeDefined()
    expect(row.vdot.p50).toBe(27)
  })
})

// ─── 2. getFTPNorm ───────────────────────────────────────────────────────────
describe('getFTPNorm', () => {
  it('returns {percentile:0, category:"Unknown"} for null ftpPerKg', () => {
    const result = getFTPNorm('cycling', 'male', null)
    expect(result).toEqual({ percentile: 0, category: 'Unknown' })
  })

  it('returns {percentile:0, category:"Unknown"} for undefined ftpPerKg', () => {
    const result = getFTPNorm('cycling', 'male', undefined)
    expect(result).toEqual({ percentile: 0, category: 'Unknown' })
  })

  it('returns {percentile:0, category:"Unknown"} for unknown sport', () => {
    const result = getFTPNorm('wrestling', 'male', 3.0)
    expect(result).toEqual({ percentile: 0, category: 'Unknown' })
  })

  it('returns {percentile:0, category:"Unknown"} for unknown gender', () => {
    const result = getFTPNorm('cycling', 'other', 3.0)
    expect(result).toEqual({ percentile: 0, category: 'Unknown' })
  })

  it('returns object with percentile (number) and category (string)', () => {
    const result = getFTPNorm('cycling', 'male', 3.2)
    expect(typeof result.percentile).toBe('number')
    expect(typeof result.category).toBe('string')
  })

  it('percentile is between 0 and 100', () => {
    const tests = [0.5, 1.5, 2.6, 4.0, 5.6, 7.0]
    for (const val of tests) {
      const { percentile } = getFTPNorm('cycling', 'male', val)
      expect(percentile).toBeGreaterThanOrEqual(0)
      expect(percentile).toBeLessThanOrEqual(100)
    }
  })

  // Known anchor: cycling male p50 for Trained is 3.2 → should be ~42nd percentile
  it('cycling male 3.2 W/kg returns category Trained and percentile ~42', () => {
    const result = getFTPNorm('cycling', 'male', 3.2)
    expect(result.category).toBe('Trained')
    expect(result.percentile).toBeCloseTo(42, 0)
  })

  // Well below first p50 anchor (1.9) — clamped low
  it('cycling male 0.5 W/kg returns very low percentile (<= 8)', () => {
    const result = getFTPNorm('cycling', 'male', 0.5)
    expect(result.percentile).toBeLessThanOrEqual(8)
    expect(result.category).toBe('Untrained')
  })

  // At exact Untrained p50 anchor (1.9) → percentile = CATEGORY_PCT_ANCHORS[0] = 8
  it('cycling male at Untrained p50 (1.9) returns percentile 8', () => {
    const result = getFTPNorm('cycling', 'male', 1.9)
    expect(result.percentile).toBe(8)
  })

  // At exact Elite p50 anchor (5.6) → percentile = 92
  it('cycling male at Elite p50 (5.6) returns percentile 92', () => {
    const result = getFTPNorm('cycling', 'male', 5.6)
    expect(result.percentile).toBe(92)
    expect(result.category).toBe('Elite')
  })

  // Well above Elite p50 — clamped at 100
  it('cycling male 9.0 W/kg percentile capped at 100', () => {
    const { percentile } = getFTPNorm('cycling', 'male', 9.0)
    expect(percentile).toBe(100)
  })

  // Female path
  it('cycling female 2.7 W/kg returns category Trained', () => {
    const result = getFTPNorm('cycling', 'female', 2.7)
    expect(result.category).toBe('Trained')
  })

  // Triathlon sport path
  it('triathlon male 3.0 W/kg returns category Trained', () => {
    const result = getFTPNorm('triathlon', 'male', 3.0)
    expect(result.category).toBe('Trained')
    expect(result.percentile).toBeGreaterThan(0)
  })

  // Higher value → higher percentile monotonicity
  it('higher W/kg produces equal or higher percentile', () => {
    const low = getFTPNorm('cycling', 'male', 2.0)
    const high = getFTPNorm('cycling', 'male', 4.5)
    expect(high.percentile).toBeGreaterThan(low.percentile)
  })

  // Category threshold: cycling male p25 of Recreational is 2.0 → should assign Recreational
  it('cycling male at Recreational p25 threshold (2.0) assigns Recreational category', () => {
    const result = getFTPNorm('cycling', 'male', 2.0)
    expect(result.category).toBe('Recreational')
  })

  // Below Recreational p25 (1.99) → should fall back to Untrained
  it('cycling male just below Recreational threshold (1.99) assigns Untrained', () => {
    const result = getFTPNorm('cycling', 'male', 1.99)
    expect(result.category).toBe('Untrained')
  })
})

// ─── 3. getVO2maxNorm ────────────────────────────────────────────────────────
describe('getVO2maxNorm', () => {
  it('returns {percentile:0, category:"Unknown"} for null vo2max', () => {
    const result = getVO2maxNorm('running', 25, 'male', null)
    expect(result).toEqual({ percentile: 0, category: 'Unknown' })
  })

  it('returns {percentile:0, category:"Unknown"} for undefined vo2max', () => {
    const result = getVO2maxNorm('running', 25, 'male', undefined)
    expect(result).toEqual({ percentile: 0, category: 'Unknown' })
  })

  it('returns {percentile:0, category:"Unknown"} for unknown sport', () => {
    const result = getVO2maxNorm('hockey', 25, 'male', 50)
    expect(result).toEqual({ percentile: 0, category: 'Unknown' })
  })

  it('returns object with percentile (number) and category (string)', () => {
    const result = getVO2maxNorm('running', 30, 'male', 45)
    expect(typeof result.percentile).toBe('number')
    expect(typeof result.category).toBe('string')
  })

  it('percentile is between 0 and 100', () => {
    const vals = [10, 38, 43, 48, 53, 60, 80]
    for (const vo2max of vals) {
      const { percentile } = getVO2maxNorm('running', 25, 'male', vo2max)
      expect(percentile).toBeGreaterThanOrEqual(0)
      expect(percentile).toBeLessThanOrEqual(100)
    }
  })

  // Age group routing — age < 30 → '18-29'
  it('age 25 routes to 18-29 age group', () => {
    const r25 = getVO2maxNorm('running', 25, 'male', 45)
    const r28 = getVO2maxNorm('running', 28, 'male', 45)
    expect(r25.percentile).toBe(r28.percentile)
    expect(r25.category).toBe(r28.category)
  })

  // Age boundary: age 29 still '18-29', age 30 → '30-39'
  it('age 29 and 30 fall into different age groups', () => {
    const r29 = getVO2maxNorm('running', 29, 'male', 45)
    const r30 = getVO2maxNorm('running', 30, 'male', 45)
    // 30-39 norms are lower, so same VO2max scores higher percentile in 30-39
    expect(r30.percentile).toBeGreaterThanOrEqual(r29.percentile)
  })

  // Age 60 → '60+'
  it('age 60 routes to 60+ age group', () => {
    const r60 = getVO2maxNorm('running', 60, 'male', 34)
    expect(r60.category).toBeDefined()
    expect(r60.percentile).toBeGreaterThan(0)
  })

  // Known bands — running male 18-29: poor=38, fair=43, good=48, excellent=53, superior=60
  it('running male 18-29 at poor threshold (38) returns Poor', () => {
    const result = getVO2maxNorm('running', 25, 'male', 38)
    expect(result.category).toBe('Poor')
  })

  it('running male 18-29 at fair threshold (43) returns Fair', () => {
    const result = getVO2maxNorm('running', 25, 'male', 43)
    expect(result.category).toBe('Fair')
  })

  it('running male 18-29 at good threshold (48) returns Good', () => {
    const result = getVO2maxNorm('running', 25, 'male', 48)
    expect(result.category).toBe('Good')
  })

  it('running male 18-29 at excellent threshold (53) returns Excellent', () => {
    const result = getVO2maxNorm('running', 25, 'male', 53)
    expect(result.category).toBe('Excellent')
  })

  it('running male 18-29 at superior threshold (60) returns Superior', () => {
    const result = getVO2maxNorm('running', 25, 'male', 60)
    expect(result.category).toBe('Superior')
  })

  // Above superior — still Superior, percentile > 90
  it('running male 18-29 above superior (70) returns Superior with percentile > 90', () => {
    const result = getVO2maxNorm('running', 25, 'male', 70)
    expect(result.category).toBe('Superior')
    expect(result.percentile).toBeGreaterThan(90)
    expect(result.percentile).toBeLessThanOrEqual(100)
  })

  // Very low VO2max → Poor, low percentile
  it('running male 18-29 very low VO2max (20) returns Poor with low percentile', () => {
    const result = getVO2maxNorm('running', 25, 'male', 20)
    expect(result.category).toBe('Poor')
    expect(result.percentile).toBeLessThan(10)
  })

  // Female path — running female 30-39
  it('running female 35 at good threshold (39) returns Good', () => {
    const result = getVO2maxNorm('running', 35, 'female', 39)
    expect(result.category).toBe('Good')
  })

  // Cycling sport
  it('cycling male 45 VO2max 46 returns Excellent', () => {
    const result = getVO2maxNorm('cycling', 45, 'male', 46)
    expect(result.category).toBe('Excellent')
  })

  // Higher VO2max → higher percentile monotonicity
  it('higher VO2max produces higher percentile', () => {
    const low = getVO2maxNorm('running', 25, 'male', 35)
    const high = getVO2maxNorm('running', 25, 'male', 55)
    expect(high.percentile).toBeGreaterThan(low.percentile)
  })

  // Swimming sport
  it('swimming female 25 at good threshold (36) returns Good', () => {
    const result = getVO2maxNorm('swimming', 25, 'female', 36)
    expect(result.category).toBe('Good')
  })

  // Rowing sport
  it('rowing male 55 at fair threshold (33) returns Fair', () => {
    const result = getVO2maxNorm('rowing', 55, 'male', 33)
    expect(result.category).toBe('Fair')
  })
})

// ─── 4. getCTLNorm ───────────────────────────────────────────────────────────
describe('getCTLNorm', () => {
  it('returns Unknown shape for null currentCTL', () => {
    const result = getCTLNorm('cycling', 'amateur', null)
    expect(result).toEqual({ status: 'Unknown', typical: [0, 0], peak: [0, 0], percentileOfTypical: 0 })
  })

  it('returns Unknown shape for undefined currentCTL', () => {
    const result = getCTLNorm('cycling', 'amateur', undefined)
    expect(result).toEqual({ status: 'Unknown', typical: [0, 0], peak: [0, 0], percentileOfTypical: 0 })
  })

  it('returns Unknown shape for unknown sport', () => {
    const result = getCTLNorm('baseball', 'amateur', 60)
    expect(result).toEqual({ status: 'Unknown', typical: [0, 0], peak: [0, 0], percentileOfTypical: 0 })
  })

  it('returns Unknown shape for unknown level', () => {
    const result = getCTLNorm('cycling', 'professional', 60)
    expect(result).toEqual({ status: 'Unknown', typical: [0, 0], peak: [0, 0], percentileOfTypical: 0 })
  })

  it('returns object with status, typical, peak, percentileOfTypical', () => {
    const result = getCTLNorm('cycling', 'amateur', 65)
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('typical')
    expect(result).toHaveProperty('peak')
    expect(result).toHaveProperty('percentileOfTypical')
  })

  it('typical and peak are 2-element arrays of numbers', () => {
    const result = getCTLNorm('cycling', 'amateur', 65)
    expect(Array.isArray(result.typical)).toBe(true)
    expect(result.typical).toHaveLength(2)
    expect(Array.isArray(result.peak)).toBe(true)
    expect(result.peak).toHaveLength(2)
  })

  it('percentileOfTypical is a number between 0 and 100', () => {
    const values = [10, 50, 65, 80, 100, 130]
    for (const ctl of values) {
      const { percentileOfTypical } = getCTLNorm('cycling', 'amateur', ctl)
      expect(percentileOfTypical).toBeGreaterThanOrEqual(0)
      expect(percentileOfTypical).toBeLessThanOrEqual(100)
    }
  })

  // Cycling amateur: typical=[50,80], peak=[75,100]
  it('cycling amateur CTL=65 returns Typical status', () => {
    const result = getCTLNorm('cycling', 'amateur', 65)
    expect(result.status).toBe('Typical')
    expect(result.typical).toEqual([50, 80])
    expect(result.peak).toEqual([75, 100])
  })

  it('cycling amateur CTL=50 (at lower typical bound) returns Typical', () => {
    const result = getCTLNorm('cycling', 'amateur', 50)
    expect(result.status).toBe('Typical')
    expect(result.percentileOfTypical).toBe(0)
  })

  it('cycling amateur CTL=80 (at upper typical bound) returns Typical with percentileOfTypical=100', () => {
    const result = getCTLNorm('cycling', 'amateur', 80)
    expect(result.status).toBe('Typical')
    expect(result.percentileOfTypical).toBe(100)
  })

  // Above typical but within peak → High
  it('cycling amateur CTL=90 (above typical, within peak) returns High', () => {
    const result = getCTLNorm('cycling', 'amateur', 90)
    expect(result.status).toBe('High')
  })

  // Above peak → Very High
  it('cycling amateur CTL=110 (above peak) returns Very High', () => {
    const result = getCTLNorm('cycling', 'amateur', 110)
    expect(result.status).toBe('Very High')
  })

  // Below lower bound but above 50% → Building
  // cycling amateur tLo=50, 50% of tLo = 25; CTL=35 → Building
  it('cycling amateur CTL=35 (between 25 and 50) returns Building', () => {
    const result = getCTLNorm('cycling', 'amateur', 35)
    expect(result.status).toBe('Building')
  })

  // Below 50% of lower bound → Very Low
  // cycling amateur tLo=50, 50% = 25; CTL=20 → Very Low
  it('cycling amateur CTL=20 (below 50% of tLo) returns Very Low', () => {
    const result = getCTLNorm('cycling', 'amateur', 20)
    expect(result.status).toBe('Very Low')
  })

  // CTL=0 → Very Low
  it('CTL=0 returns Very Low', () => {
    const result = getCTLNorm('cycling', 'recreational', 0)
    expect(result.status).toBe('Very Low')
  })

  // Running sport path
  it('running recreational typical range is [20, 40]', () => {
    const result = getCTLNorm('running', 'recreational', 30)
    expect(result.typical).toEqual([20, 40])
    expect(result.status).toBe('Typical')
  })

  // Triathlon amateur
  it('triathlon amateur CTL=100 (above typical [55,90]) returns High', () => {
    const result = getCTLNorm('triathlon', 'amateur', 100)
    expect(result.status).toBe('High')
  })

  // Swimming elite
  it('swimming elite CTL=90 (typical=[70,110]) returns Typical', () => {
    const result = getCTLNorm('swimming', 'elite', 90)
    expect(result.status).toBe('Typical')
  })

  // percentileOfTypical at midpoint
  it('cycling amateur CTL=65 gives percentileOfTypical=50', () => {
    const result = getCTLNorm('cycling', 'amateur', 65)
    expect(result.percentileOfTypical).toBe(50)
  })

  // percentileOfTypical clamped at 0 below lower bound
  it('percentileOfTypical is 0 when CTL is below typical lower bound', () => {
    const result = getCTLNorm('cycling', 'amateur', 30)
    expect(result.percentileOfTypical).toBe(0)
  })
})
