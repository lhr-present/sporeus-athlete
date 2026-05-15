// src/lib/__tests__/athlete/vo2maxToPace.test.js
import { describe, it, expect } from 'vitest'
import {
  vdotToThresholdSec,
  vdotToThresholdStr,
  formatPaceStr,
} from '../../athlete/vo2maxToPace.js'

describe('vdotToThresholdSec', () => {
  it('returns null for missing or malformed input', () => {
    expect(vdotToThresholdSec(undefined)).toBeNull()
    expect(vdotToThresholdSec(null)).toBeNull()
    expect(vdotToThresholdSec('')).toBeNull()
    expect(vdotToThresholdSec('foo')).toBeNull()
    expect(vdotToThresholdSec(NaN)).toBeNull()
  })

  it('returns null below the physiological floor', () => {
    expect(vdotToThresholdSec(29)).toBeNull()
    expect(vdotToThresholdSec(0)).toBeNull()
    expect(vdotToThresholdSec(-50)).toBeNull()
  })

  it('returns null above the physiological ceiling', () => {
    expect(vdotToThresholdSec(86)).toBeNull()
    expect(vdotToThresholdSec(200)).toBeNull()
  })

  it('matches anchor points from Daniels Running Formula', () => {
    // Direct anchors — no interpolation
    expect(vdotToThresholdSec(30)).toBe(334)  // 5:34/km
    expect(vdotToThresholdSec(50)).toBe(251)  // 4:11/km
    expect(vdotToThresholdSec(65)).toBe(211)  // 3:31/km
    expect(vdotToThresholdSec(85)).toBe(180)  // 3:00/km
  })

  it('interpolates linearly between anchors', () => {
    // VDOT 52.5 should be midway between VDOT 50 (251) and VDOT 55 (235):
    // halfway = (251 + 235) / 2 = 243
    expect(vdotToThresholdSec(52.5)).toBe(243)
    // VDOT 42.5 — midway between 40 (287) and 45 (269): 278
    expect(vdotToThresholdSec(42.5)).toBe(278)
  })

  it('accepts numeric-string input (matches profile.vo2max storage)', () => {
    expect(vdotToThresholdSec('50')).toBe(251)
    expect(vdotToThresholdSec('65')).toBe(211)
  })

  it('threshold pace strictly decreases as VDOT increases', () => {
    let prev = Infinity
    for (let v = 30; v <= 85; v += 5) {
      const pace = vdotToThresholdSec(v)
      expect(pace).toBeLessThan(prev)
      prev = pace
    }
  })
})

describe('formatPaceStr', () => {
  it('formats seconds to M:SS', () => {
    expect(formatPaceStr(251)).toBe('4:11')
    expect(formatPaceStr(330)).toBe('5:30')
    expect(formatPaceStr(180)).toBe('3:00')
  })

  it('pads single-digit seconds', () => {
    expect(formatPaceStr(305)).toBe('5:05')
    expect(formatPaceStr(241)).toBe('4:01')
  })

  it('handles 59.5 rollover to next minute', () => {
    expect(formatPaceStr(299.7)).toBe('5:00')  // rounds to 300 → 5:00
    expect(formatPaceStr(359.5)).toBe('6:00')
  })

  it('returns null on invalid input', () => {
    expect(formatPaceStr(0)).toBeNull()
    expect(formatPaceStr(-30)).toBeNull()
    expect(formatPaceStr(NaN)).toBeNull()
    expect(formatPaceStr(null)).toBeNull()
  })
})

describe('vdotToThresholdStr', () => {
  it('returns formatted pace string for valid VDOT', () => {
    expect(vdotToThresholdStr(50)).toBe('4:11')
    expect(vdotToThresholdStr(65)).toBe('3:31')
  })

  it('returns null for out-of-range VDOT', () => {
    expect(vdotToThresholdStr(20)).toBeNull()
    expect(vdotToThresholdStr(100)).toBeNull()
    expect(vdotToThresholdStr(null)).toBeNull()
  })
})
