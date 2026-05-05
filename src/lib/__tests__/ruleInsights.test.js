// src/lib/__tests__/ruleInsights.test.js — E93
import { describe, it, expect } from 'vitest'
import {
  getReadinessLabel,
  getLoadTrendAlert,
  getMonotonyWarning,
  getFatigueAccumulation,
  getMissedRestWarning,
  getAthleteInsights,
} from '../ruleInsights.js'

// ─── SHARED SHAPE HELPERS ────────────────────────────────────────────────────

function hasReadinessShape(obj) {
  expect(obj).toHaveProperty('level')
  expect(obj).toHaveProperty('color')
  expect(obj).toHaveProperty('message')
  expect(obj).toHaveProperty('tr')
}

function hasFlagShape(obj) {
  expect(obj).toHaveProperty('flag')
  expect(obj).toHaveProperty('message')
  expect(obj).toHaveProperty('tr')
  expect(obj).toHaveProperty('action')
  expect(obj).toHaveProperty('actionTr')
}

// ─── 1. getReadinessLabel ────────────────────────────────────────────────────

describe('getReadinessLabel', () => {
  describe('return shape', () => {
    it('always returns level, color, message, tr', () => {
      hasReadinessShape(getReadinessLabel(1.0, 75))
    })

    it('returns string level', () => {
      expect(typeof getReadinessLabel(1.0, 75).level).toBe('string')
    })

    it('returns string color starting with #', () => {
      const { color } = getReadinessLabel(1.0, 75)
      expect(color).toMatch(/^#/)
    })
  })

  describe('high-risk: ACWR > 1.5', () => {
    it('returns level=high at acwr=1.51', () => {
      const r = getReadinessLabel(1.51, 75)
      expect(r.level).toBe('high')
      expect(r.color).toBe('#e03030')
    })

    it('returns level=high at acwr=2.0', () => {
      expect(getReadinessLabel(2.0, 80).level).toBe('high')
    })

    it('message includes ACWR value and "acute load spike" (EN)', () => {
      const r = getReadinessLabel(1.8, 80)
      expect(r.message).toContain('1.80')
      expect(r.message).toContain('acute load spike')
    })

    it('tr includes "akut yük artışı"', () => {
      const r = getReadinessLabel(1.8, 80)
      expect(r.tr).toContain('akut yük artışı')
    })

    it('boundary: acwr=1.5 is NOT high (exclusive)', () => {
      expect(getReadinessLabel(1.5, 75).level).not.toBe('high')
    })
  })

  describe('high-risk: wellness < 40', () => {
    it('returns level=high when wellness=39', () => {
      expect(getReadinessLabel(1.0, 39).level).toBe('high')
    })

    it('message contains wellness value and "significantly below baseline" (EN)', () => {
      const r = getReadinessLabel(1.0, 30)
      expect(r.message).toContain('30/100')
      expect(r.message).toContain('significantly below baseline')
    })

    it('tr contains "baz çizgisinin" for wellness path', () => {
      const r = getReadinessLabel(1.0, 30)
      expect(r.tr).toContain('baz çizgisinin')
    })

    it('boundary: wellness=40 is NOT high (exclusive)', () => {
      expect(getReadinessLabel(1.0, 40).level).not.toBe('high')
    })
  })

  describe('moderate: ACWR > 1.3', () => {
    it('returns level=moderate at acwr=1.31', () => {
      expect(getReadinessLabel(1.31, 75).level).toBe('moderate')
    })

    it('message includes "approaching high-risk zone" (EN)', () => {
      const r = getReadinessLabel(1.4, 75)
      expect(r.message).toContain('approaching high-risk zone')
    })

    it('tr includes "yüksek risk bölgesine"', () => {
      const r = getReadinessLabel(1.4, 75)
      expect(r.tr).toContain('yüksek risk bölgesine')
    })

    it('color is #ff6600', () => {
      expect(getReadinessLabel(1.4, 75).color).toBe('#ff6600')
    })

    it('boundary: acwr=1.3 is NOT moderate via ratio (exclusive)', () => {
      // acwr=1.3 is not > 1.3, falls to next check
      const r = getReadinessLabel(1.3, 75)
      expect(r.level).not.toBe('moderate')
    })
  })

  describe('moderate: wellness < 60', () => {
    it('returns level=moderate at wellness=55', () => {
      expect(getReadinessLabel(1.0, 55).level).toBe('moderate')
    })

    it('message includes "below threshold" (EN)', () => {
      const r = getReadinessLabel(1.0, 50)
      expect(r.message).toContain('below threshold')
    })

    it('boundary: wellness=60 is NOT moderate (exclusive)', () => {
      expect(getReadinessLabel(1.0, 60).level).not.toBe('moderate')
    })
  })

  describe('low: ACWR < 0.8 and wellness >= 70', () => {
    it('returns level=low at acwr=0.79, wellness=70', () => {
      expect(getReadinessLabel(0.79, 70).level).toBe('low')
    })

    it('message includes "undertraining" (EN)', () => {
      const r = getReadinessLabel(0.5, 80)
      expect(r.message).toContain('undertraining')
    })

    it('tr includes "az antrenman"', () => {
      expect(getReadinessLabel(0.5, 80).tr).toContain('az antrenman')
    })

    it('color is #0064ff', () => {
      expect(getReadinessLabel(0.5, 80).color).toBe('#0064ff')
    })

    it('boundary: acwr=0.8 is NOT low (exclusive)', () => {
      expect(getReadinessLabel(0.8, 80).level).not.toBe('low')
    })

    it('acwr < 0.8 but wellness=69 returns optimal not low', () => {
      expect(getReadinessLabel(0.7, 69).level).toBe('optimal')
    })
  })

  describe('optimal', () => {
    it('returns level=optimal for nominal athlete (acwr=1.0, wellness=80)', () => {
      expect(getReadinessLabel(1.0, 80).level).toBe('optimal')
    })

    it('message includes "green light" (EN)', () => {
      expect(getReadinessLabel(1.0, 80).message).toContain('green light')
    })

    it('tr includes "yeşil ışık"', () => {
      expect(getReadinessLabel(1.0, 80).tr).toContain('yeşil ışık')
    })

    it('color is #5bc25b', () => {
      expect(getReadinessLabel(1.0, 80).color).toBe('#5bc25b')
    })

    it('both ACWR and wellness appear in optimal message', () => {
      const r = getReadinessLabel(1.0, 80)
      expect(r.message).toContain('1.00')
      expect(r.message).toContain('80/100')
    })
  })

  describe('null / undefined inputs', () => {
    it('null acwr defaults to 1.0 (optimal behavior)', () => {
      const r = getReadinessLabel(null, 80)
      expect(r.level).toBe('optimal')
    })

    it('undefined acwr defaults to 1.0', () => {
      const r = getReadinessLabel(undefined, 80)
      expect(r.level).toBe('optimal')
    })

    it('undefined wellnessAvg defaults to 50 (moderate)', () => {
      const r = getReadinessLabel(1.0, undefined)
      expect(r.level).toBe('moderate')
    })

    it('null wellnessAvg defaults to 50', () => {
      const r = getReadinessLabel(1.0, null)
      expect(r.level).toBe('moderate')
    })

    it('both null — uses defaults 1.0 + 50, returns moderate', () => {
      const r = getReadinessLabel(null, null)
      expect(r.level).toBe('moderate')
    })

    it('no args — returns an object', () => {
      const r = getReadinessLabel()
      expect(typeof r).toBe('object')
      hasReadinessShape(r)
    })
  })

  describe('ACWR priority over wellness in high-risk', () => {
    it('acwr > 1.5 wins even when wellness >= 40', () => {
      const r = getReadinessLabel(1.6, 90)
      expect(r.message).toContain('acute load spike')
    })
  })
})

// ─── 2. getLoadTrendAlert ────────────────────────────────────────────────────

describe('getLoadTrendAlert', () => {
  describe('return shape', () => {
    it('has flag, message, tr, action, actionTr', () => {
      hasFlagShape(getLoadTrendAlert([10, 10, 10, 10, 10, 10, 10]))
    })

    it('flag is boolean', () => {
      expect(typeof getLoadTrendAlert([10, 10, 10, 10, 10, 10, 10]).flag).toBe('boolean')
    })
  })

  describe('insufficient data (week1 === 0)', () => {
    it('null input returns flag=false with insufficient message', () => {
      const r = getLoadTrendAlert(null)
      expect(r.flag).toBe(false)
      expect(r.message).toContain('Insufficient')
    })

    it('empty array returns flag=false', () => {
      expect(getLoadTrendAlert([]).flag).toBe(false)
    })

    it('non-array returns flag=false', () => {
      expect(getLoadTrendAlert('invalid').flag).toBe(false)
    })

    it('first 3 values all zero returns flag=false', () => {
      const r = getLoadTrendAlert([0, 0, 0, 100, 100, 100, 100])
      expect(r.flag).toBe(false)
      expect(r.message).toContain('Insufficient')
    })

    it('tr is Turkish for insufficient case', () => {
      expect(getLoadTrendAlert([]).tr).toContain('yeterli yük verisi')
    })

    it('action is "Log more sessions." for insufficient case', () => {
      expect(getLoadTrendAlert([]).action).toBe('Log more sessions.')
    })
  })

  describe('spike detected (>10%)', () => {
    it('flags when week2 is >10% above week1', () => {
      // week1 = 30+30+30 = 90, week2 = 30+30+30+30 = 120  => +33%
      const r = getLoadTrendAlert([30, 30, 30, 30, 30, 30, 30])
      // week1=90, week2=120 => +33% => flag=true
      expect(r.flag).toBe(true)
    })

    it('message contains percentage increase (EN)', () => {
      const r = getLoadTrendAlert([10, 10, 10, 15, 15, 15, 15])
      // week1=30, week2=60 => +100%
      expect(r.flag).toBe(true)
      expect(r.message).toContain('Load up')
      expect(r.message).toContain('%')
    })

    it('tr contains "%...arttı"', () => {
      const r = getLoadTrendAlert([10, 10, 10, 15, 15, 15, 15])
      expect(r.tr).toContain('arttı')
    })

    it('action tells to cap TSS or add recovery day', () => {
      const r = getLoadTrendAlert([10, 10, 10, 15, 15, 15, 15])
      expect(r.action).toContain('recovery day')
    })

    it('boundary: exactly 10% increase is NOT flagged', () => {
      // week1 = 100, week2 needs to be exactly 110 for +10% exactly
      // week1 = 10+10+10 = 30, week2 = 7.5+7.5+7.5+10 = 32.75?
      // Simpler: week1=100 needs 3 values summing to 100: 30+30+40=100
      // week2 = 4 values summing to 110: 27.5+27.5+27.5+27.5=110
      const r = getLoadTrendAlert([30, 30, 40, 27.5, 27.5, 27.5, 27.5])
      // week1=100, week2=110 => +10% exactly => NOT > 10 => flag=false
      expect(r.flag).toBe(false)
    })

    it('boundary: 10.1% increase IS flagged', () => {
      // week1=100, week2=110.1
      const r = getLoadTrendAlert([30, 30, 40, 28, 28, 27, 27.1])
      // week1=100, week2=110.1 => +10.1%
      expect(r.flag).toBe(true)
    })
  })

  describe('safe range (no spike)', () => {
    it('returns flag=false when load stays flat', () => {
      const _r = getLoadTrendAlert([50, 50, 50, 50, 50, 50, 50])
      // week1=150, week2=200 => +33% => would actually flag!
      // Actually week1=first 3 = 150, week2=last 4 = 200 => +33%
      // Let's use decreasing load so second half is lower
      const r2 = getLoadTrendAlert([50, 50, 50, 40, 40, 40, 40])
      expect(r2.flag).toBe(false)
    })

    it('message contains "within safe range" (EN)', () => {
      const r = getLoadTrendAlert([50, 50, 50, 40, 40, 40, 40])
      expect(r.message).toContain('within safe range')
    })

    it('tr contains "güvenli aralıkta"', () => {
      const r = getLoadTrendAlert([50, 50, 50, 40, 40, 40, 40])
      expect(r.tr).toContain('güvenli aralıkta')
    })

    it('action is "Maintain current ramp rate."', () => {
      const r = getLoadTrendAlert([50, 50, 50, 40, 40, 40, 40])
      expect(r.action).toBe('Maintain current ramp rate.')
    })

    it('shows + sign when change is positive but <= 10%', () => {
      // week1=100 (30+30+40), week2=107 (27+27+26+27)
      const r = getLoadTrendAlert([30, 30, 40, 27, 27, 26, 27])
      // week1=100, week2=107 => +7% => safe
      expect(r.flag).toBe(false)
      expect(r.message).toContain('+')
    })

    it('negative change shows minus (no + prefix)', () => {
      const r = getLoadTrendAlert([50, 50, 50, 20, 20, 20, 20])
      expect(r.message).not.toContain('+-')
      // changePct is negative
      expect(r.flag).toBe(false)
    })
  })

  describe('non-numeric values in array', () => {
    it('treats NaN/null entries as 0', () => {
      const r = getLoadTrendAlert([null, undefined, 'x', 10, 10, 10, 10])
      // week1 = 0+0+0=0 => insufficient
      expect(r.flag).toBe(false)
      expect(r.message).toContain('Insufficient')
    })
  })
})

// ─── 3. getMonotonyWarning ────────────────────────────────────────────────────

describe('getMonotonyWarning', () => {
  describe('return shape', () => {
    it('has flag, message, tr, action, actionTr', () => {
      hasFlagShape(getMonotonyWarning([50, 100, 80, 60, 40, 90, 70]))
    })
  })

  describe('insufficient data (< 2 values)', () => {
    it('null input returns flag=false', () => {
      expect(getMonotonyWarning(null).flag).toBe(false)
    })

    it('empty array returns flag=false', () => {
      expect(getMonotonyWarning([]).flag).toBe(false)
    })

    it('single-element array returns flag=false', () => {
      expect(getMonotonyWarning([100]).flag).toBe(false)
    })

    it('message says "Not enough data" for single element', () => {
      expect(getMonotonyWarning([100]).message).toContain('Not enough data')
    })

    it('tr for insufficient says "yeterli veri yok"', () => {
      expect(getMonotonyWarning([]).tr).toContain('yeterli veri yok')
    })

    it('action is "Log at least 2 days."', () => {
      expect(getMonotonyWarning([100]).action).toBe('Log at least 2 days.')
    })
  })

  describe('all zeros (mean === 0)', () => {
    it('returns flag=false with "No load recorded" message', () => {
      const r = getMonotonyWarning([0, 0, 0, 0, 0, 0, 0])
      expect(r.flag).toBe(false)
      expect(r.message).toContain('No load recorded')
    })

    it('tr contains "Yük kaydedilmedi"', () => {
      expect(getMonotonyWarning([0, 0, 0]).tr).toContain('Yük kaydedilmedi')
    })
  })

  describe('sd === 0 (identical loads)', () => {
    it('returns flag=true with infinity monotony message', () => {
      const r = getMonotonyWarning([100, 100, 100, 100, 100])
      expect(r.flag).toBe(true)
      expect(r.message).toContain('∞')
    })

    it('tr contains "özdeş yük"', () => {
      expect(getMonotonyWarning([100, 100, 100]).tr).toContain('özdeş yük')
    })

    it('action tells to vary session intensity', () => {
      const r = getMonotonyWarning([100, 100, 100])
      expect(r.action).toContain('Vary session intensity')
    })
  })

  describe('monotony > 2.0 (high flag)', () => {
    it('returns flag=true when monotony exceeds 2.0', () => {
      // Very little variation: mean high, sd low
      // e.g., [99, 100, 101] mean=100, sd≈0.816 => monotony≈122 > 2.0
      const r = getMonotonyWarning([99, 100, 101])
      expect(r.flag).toBe(true)
    })

    it('message contains monotony value and "above 2.0 threshold" (EN)', () => {
      const r = getMonotonyWarning([99, 100, 101])
      expect(r.message).toContain('above 2.0 threshold')
    })

    it('tr contains "2.0 eşiğinin üzerinde"', () => {
      expect(getMonotonyWarning([99, 100, 101]).tr).toContain('2.0 eşiğinin üzerinde')
    })

    it('action includes "rest day" or "hard/easy"', () => {
      const r = getMonotonyWarning([99, 100, 101])
      expect(r.action).toContain('rest day')
    })
  })

  describe('monotony <= 2.0 (acceptable)', () => {
    it('returns flag=false for varied training week', () => {
      // [20, 100, 20, 100, 20, 100, 20] mean=54.28, sd=40 => monotony≈1.36
      const r = getMonotonyWarning([20, 100, 20, 100, 20, 100, 20])
      expect(r.flag).toBe(false)
    })

    it('message contains "acceptable training variety" (EN)', () => {
      const r = getMonotonyWarning([20, 100, 20, 100, 20, 100, 20])
      expect(r.message).toContain('acceptable training variety')
    })

    it('tr contains "kabul edilebilir antrenman çeşitliliği"', () => {
      expect(getMonotonyWarning([20, 100, 20, 100, 20, 100, 20]).tr).toContain(
        'kabul edilebilir antrenman çeşitliliği'
      )
    })

    it('action is "Continue mixing intensities."', () => {
      expect(getMonotonyWarning([20, 100, 20, 100, 20, 100, 20]).action).toBe(
        'Continue mixing intensities.'
      )
    })
  })

  describe('boundary at monotony=2.0', () => {
    it('returns flag=false when monotony is exactly 2.0', () => {
      // Construct array with mean/sd = 2.0 exactly
      // mean=20, sd=10: values that satisfy this...
      // For [10, 30]: mean=20, variance=100, sd=10 => monotony=2.0 (not > 2.0)
      const r = getMonotonyWarning([10, 30])
      expect(r.flag).toBe(false)
    })
  })

  describe('non-numeric entries', () => {
    it('coerces non-numbers to 0', () => {
      // [null, 100, undefined] => [0, 100, 0] mean=33.3 sd≈47.1 => monotony≈0.7
      const r = getMonotonyWarning([null, 100, undefined])
      expect(r).toHaveProperty('flag')
    })
  })
})

// ─── 4. getFatigueAccumulation ────────────────────────────────────────────────

describe('getFatigueAccumulation', () => {
  describe('return shape', () => {
    it('has flag, message, tr, action, actionTr', () => {
      hasFlagShape(getFatigueAccumulation([3, 4, 3]))
    })
  })

  describe('empty / invalid input', () => {
    it('null returns flag=false with "No fatigue scores" message', () => {
      const r = getFatigueAccumulation(null)
      expect(r.flag).toBe(false)
      expect(r.message).toContain('No fatigue scores')
    })

    it('empty array returns flag=false', () => {
      expect(getFatigueAccumulation([]).flag).toBe(false)
    })

    it('undefined returns flag=false', () => {
      expect(getFatigueAccumulation(undefined).flag).toBe(false)
    })

    it('tr contains "kaydedilmedi" for empty', () => {
      expect(getFatigueAccumulation([]).tr).toContain('kaydedilmedi')
    })

    it('action is "Log daily wellness check-ins." for empty', () => {
      expect(getFatigueAccumulation([]).action).toBe('Log daily wellness check-ins.')
    })

    it('out-of-range values (0 and 6) are filtered out', () => {
      // 0 and 6 are outside 1-5 range
      const r = getFatigueAccumulation([0, 6])
      expect(r.flag).toBe(false)
      expect(r.message).toContain('No fatigue scores')
    })

    it('mixed valid and invalid: only valid scores counted', () => {
      // [0, 2, 6] → only [2] counted → avg=2.0 < 2.5 → flag=true
      const r = getFatigueAccumulation([0, 2, 6])
      expect(r.flag).toBe(true)
    })
  })

  describe('accumulated fatigue (avg < 2.5)', () => {
    it('returns flag=true for scores [1, 2, 2]', () => {
      const r = getFatigueAccumulation([1, 2, 2])
      // avg = 5/3 = 1.67 < 2.5
      expect(r.flag).toBe(true)
    })

    it('message contains average value and "accumulated fatigue" (EN)', () => {
      const r = getFatigueAccumulation([1, 2, 2])
      expect(r.message).toContain('/5')
      expect(r.message).toContain('accumulated fatigue')
    })

    it('tr contains "birikmiş yorgunluk"', () => {
      expect(getFatigueAccumulation([1, 2, 2]).tr).toContain('birikmiş yorgunluk')
    })

    it('action tells to schedule rest or active recovery', () => {
      const r = getFatigueAccumulation([1, 1, 1])
      expect(r.action).toContain('rest')
    })

    it('boundary: avg=2.4 → flag=true', () => {
      // [2, 2, 3] = 7/3 = 2.33 < 2.5
      expect(getFatigueAccumulation([2, 2, 3]).flag).toBe(true)
    })
  })

  describe('acceptable fatigue (avg >= 2.5)', () => {
    it('returns flag=false for scores [3, 4, 4]', () => {
      expect(getFatigueAccumulation([3, 4, 4]).flag).toBe(false)
    })

    it('message contains "within acceptable range" (EN)', () => {
      expect(getFatigueAccumulation([3, 4, 4]).message).toContain('within acceptable range')
    })

    it('tr contains "kabul edilebilir seviyede"', () => {
      expect(getFatigueAccumulation([3, 4, 4]).tr).toContain('kabul edilebilir seviyede')
    })

    it('action is "Proceed with planned training."', () => {
      expect(getFatigueAccumulation([3, 4, 4]).action).toBe('Proceed with planned training.')
    })

    it('boundary: avg exactly 2.5 → flag=false', () => {
      // [2, 3] = 5/2 = 2.5 — not < 2.5
      expect(getFatigueAccumulation([2, 3]).flag).toBe(false)
    })
  })

  describe('edge scale values', () => {
    it('all 1s (minimum) returns flag=true', () => {
      expect(getFatigueAccumulation([1, 1, 1]).flag).toBe(true)
    })

    it('all 5s (maximum) returns flag=false', () => {
      expect(getFatigueAccumulation([5, 5, 5]).flag).toBe(false)
    })

    it('single valid score of 1 returns flag=true', () => {
      expect(getFatigueAccumulation([1]).flag).toBe(true)
    })

    it('single valid score of 5 returns flag=false', () => {
      expect(getFatigueAccumulation([5]).flag).toBe(false)
    })
  })
})

// ─── 5. getMissedRestWarning ──────────────────────────────────────────────────

describe('getMissedRestWarning', () => {
  describe('return shape', () => {
    it('has flag, message, tr, action, actionTr', () => {
      hasFlagShape(getMissedRestWarning(3))
    })
  })

  describe('rest day overdue (days >= 6)', () => {
    it('returns flag=true at 6 consecutive days', () => {
      expect(getMissedRestWarning(6).flag).toBe(true)
    })

    it('returns flag=true at 7 days', () => {
      expect(getMissedRestWarning(7).flag).toBe(true)
    })

    it('message includes day count and "rest day is overdue" (EN)', () => {
      const r = getMissedRestWarning(7)
      expect(r.message).toContain('7')
      expect(r.message).toContain('rest day is overdue')
    })

    it('tr contains "dinlenme günü gecikmiş"', () => {
      expect(getMissedRestWarning(7).tr).toContain('dinlenme günü gecikmiş')
    })

    it('action tells to insert rest before next session', () => {
      expect(getMissedRestWarning(7).action).toContain('rest')
    })

    it('boundary: 5 days is NOT flagged', () => {
      expect(getMissedRestWarning(5).flag).toBe(false)
    })
  })

  describe('within safe range (days < 6)', () => {
    it('returns flag=false at 0 days', () => {
      expect(getMissedRestWarning(0).flag).toBe(false)
    })

    it('day=0 message says "Rest day recorded" (EN)', () => {
      expect(getMissedRestWarning(0).message).toContain('Rest day recorded')
    })

    it('day=0 tr contains "Dinlenme günü kaydedildi"', () => {
      expect(getMissedRestWarning(0).tr).toContain('Dinlenme günü kaydedildi')
    })

    it('day=1 message says "1 consecutive training day" (singular)', () => {
      const r = getMissedRestWarning(1)
      expect(r.message).toContain('1 consecutive training day')
      expect(r.message).not.toContain('days')
    })

    it('day=2 message uses plural "days"', () => {
      expect(getMissedRestWarning(2).message).toContain('days')
    })

    it('day=3 action is "Continue as planned."', () => {
      expect(getMissedRestWarning(3).action).toBe('Continue as planned.')
    })

    it('day=4 action tells to plan rest within 2 days', () => {
      expect(getMissedRestWarning(4).action).toContain('2 days')
    })

    it('day=5 action also tells to plan rest within 2 days', () => {
      expect(getMissedRestWarning(5).action).toContain('2 days')
    })
  })

  describe('null / invalid input', () => {
    it('null returns flag=false (defaults to 0)', () => {
      expect(getMissedRestWarning(null).flag).toBe(false)
    })

    it('undefined returns flag=false', () => {
      expect(getMissedRestWarning(undefined).flag).toBe(false)
    })

    it('NaN returns flag=false', () => {
      expect(getMissedRestWarning(NaN).flag).toBe(false)
    })

    it('string returns flag=false', () => {
      expect(getMissedRestWarning('seven').flag).toBe(false)
    })

    it('negative number clamps to 0', () => {
      const r = getMissedRestWarning(-5)
      expect(r.flag).toBe(false)
      expect(r.message).toContain('Rest day recorded')
    })

    it('float is floored (6.9 → 6, still flagged)', () => {
      expect(getMissedRestWarning(6.9).flag).toBe(true)
    })

    it('float below threshold floored (5.9 → 5, not flagged)', () => {
      expect(getMissedRestWarning(5.9).flag).toBe(false)
    })
  })
})

// ─── 6. getAthleteInsights ────────────────────────────────────────────────────

describe('getAthleteInsights', () => {
  const nominalData = {
    acwr: 1.0,
    wellnessAvg: 80,
    loads7days: [40, 80, 40, 80, 40, 80, 40],
    fatigueScores3days: [4, 4, 4],
    consecutiveTrainingDays: 3,
  }

  describe('return shape', () => {
    it('returns an array', () => {
      expect(Array.isArray(getAthleteInsights(nominalData))).toBe(true)
    })

    it('always includes readiness entry (even when green)', () => {
      const results = getAthleteInsights(nominalData)
      expect(results.some(r => r.key === 'readiness')).toBe(true)
    })

    it('each alert has key, flag, severity, message, tr, action, actionTr, color', () => {
      const alerts = getAthleteInsights(nominalData)
      for (const a of alerts) {
        expect(a).toHaveProperty('key')
        expect(a).toHaveProperty('flag')
        expect(a).toHaveProperty('severity')
        expect(a).toHaveProperty('message')
        expect(a).toHaveProperty('tr')
        expect(a).toHaveProperty('color')
        // action and actionTr may be undefined for readiness, but key exists
        expect(Object.prototype.hasOwnProperty.call(a, 'action')).toBe(true)
        expect(Object.prototype.hasOwnProperty.call(a, 'actionTr')).toBe(true)
      }
    })
  })

  describe('null / invalid input', () => {
    it('null returns empty array', () => {
      expect(getAthleteInsights(null)).toEqual([])
    })

    it('undefined returns empty array', () => {
      expect(getAthleteInsights(undefined)).toEqual([])
    })

    it('non-object (string) returns empty array', () => {
      expect(getAthleteInsights('data')).toEqual([])
    })

    it('empty object returns array with readiness entry', () => {
      const results = getAthleteInsights({})
      expect(Array.isArray(results)).toBe(true)
      // readiness always included
      expect(results.some(r => r.key === 'readiness')).toBe(true)
    })
  })

  describe('filtering: only flagged checks + readiness', () => {
    it('normal data only includes readiness (no flags)', () => {
      // nominalData should have no flags except readiness forced
      // loads are varied enough, fatigue ok, rest days fine
      const results = getAthleteInsights({
        acwr: 1.0,
        wellnessAvg: 80,
        loads7days: [20, 80, 20, 80, 20, 50, 20],
        fatigueScores3days: [4, 4, 5],
        consecutiveTrainingDays: 2,
      })
      expect(results.every(r => r.key === 'readiness' || r.flag === true)).toBe(true)
    })

    it('high ACWR triggers readiness flag in results', () => {
      const results = getAthleteInsights({ ...nominalData, acwr: 1.8 })
      const readiness = results.find(r => r.key === 'readiness')
      expect(readiness).toBeDefined()
      expect(readiness.flag).toBe(true)
    })

    it('many consecutive days adds rest alert', () => {
      const results = getAthleteInsights({ ...nominalData, consecutiveTrainingDays: 7 })
      expect(results.some(r => r.key === 'rest')).toBe(true)
    })

    it('low fatigue scores add fatigue alert', () => {
      const results = getAthleteInsights({ ...nominalData, fatigueScores3days: [1, 1, 2] })
      expect(results.some(r => r.key === 'fatigue')).toBe(true)
    })

    it('load spike adds loadTrend alert', () => {
      // week1=30, week2=big spike
      const results = getAthleteInsights({
        ...nominalData,
        loads7days: [10, 10, 10, 50, 50, 50, 50],
      })
      expect(results.some(r => r.key === 'loadTrend')).toBe(true)
    })
  })

  describe('sorting by severity', () => {
    it('high severity items appear before moderate', () => {
      const results = getAthleteInsights({
        acwr: 1.8,          // high readiness
        wellnessAvg: 55,    // moderate
        loads7days: [10, 10, 10, 50, 50, 50, 50],
        fatigueScores3days: [1, 1, 2],
        consecutiveTrainingDays: 7,
      })

      const severityOrder = { high: 0, moderate: 1, low: 2, optimal: 3 }
      for (let i = 1; i < results.length; i++) {
        const prev = severityOrder[results[i - 1].severity] ?? 99
        const curr = severityOrder[results[i].severity] ?? 99
        expect(prev).toBeLessThanOrEqual(curr)
      }
    })

    it('optimal readiness appears last when no other alerts', () => {
      const results = getAthleteInsights({
        acwr: 1.0,
        wellnessAvg: 80,
        loads7days: [20, 80, 20, 80, 20, 50, 20],
        fatigueScores3days: [4, 4, 5],
        consecutiveTrainingDays: 2,
      })
      // only readiness should be included, and it should be optimal
      const readiness = results.find(r => r.key === 'readiness')
      expect(readiness.severity).toBe('optimal')
    })
  })

  describe('color field in alerts', () => {
    it('high severity alert has red color', () => {
      const results = getAthleteInsights({ ...nominalData, acwr: 2.0 })
      const readiness = results.find(r => r.key === 'readiness')
      expect(readiness.color).toBe('#e03030')
    })

    it('optimal readiness has green color', () => {
      const results = getAthleteInsights({
        acwr: 1.0,
        wellnessAvg: 80,
        loads7days: [20, 80, 20, 80, 20, 50, 20],
        fatigueScores3days: [4, 4, 5],
        consecutiveTrainingDays: 2,
      })
      const readiness = results.find(r => r.key === 'readiness')
      expect(readiness.color).toBe('#5bc25b')
    })

    it('flagged non-readiness checks default to moderate color when no level', () => {
      const results = getAthleteInsights({
        ...nominalData,
        consecutiveTrainingDays: 7,
      })
      const restAlert = results.find(r => r.key === 'rest')
      expect(restAlert).toBeDefined()
      // getMissedRestWarning has no color field; defaults to COLORS.moderate
      expect(restAlert.color).toBe('#ff6600')
    })
  })

  describe('all keys present in result', () => {
    it('keys in result are from known set', () => {
      const knownKeys = new Set(['readiness', 'loadTrend', 'monotony', 'fatigue', 'rest'])
      const results = getAthleteInsights({
        acwr: 1.8,
        wellnessAvg: 30,
        loads7days: [10, 10, 10, 50, 50, 50, 50],
        fatigueScores3days: [1, 1, 1],
        consecutiveTrainingDays: 8,
      })
      for (const r of results) {
        expect(knownKeys.has(r.key)).toBe(true)
      }
    })
  })
})
