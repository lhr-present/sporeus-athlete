import { describe, it, expect, beforeEach } from 'vitest'
import { getUpsellTrigger } from './bookUpsell.js'

describe('getUpsellTrigger', () => {
  it('returns acwr_danger (highest priority) when ACWR > 1.3, even if other triggers also fire', () => {
    const r = getUpsellTrigger({ acwr: 1.45, tsb: -25, consistency: 30, isFirstCheckin: true }, 'en')
    expect(r?.trigger_reason).toBe('acwr_danger')
    expect(r?.url).toContain('threshold')
  })

  it('returns tsb_fatigue when TSB < -20 and ACWR within safe range', () => {
    const r = getUpsellTrigger({ acwr: 1.1, tsb: -21, consistency: 30, isFirstCheckin: true }, 'en')
    expect(r?.trigger_reason).toBe('tsb_fatigue')
  })

  it('returns consistency_low when consistency < 40 and no higher triggers', () => {
    const r = getUpsellTrigger({ acwr: 1.0, tsb: -5, consistency: 35, isFirstCheckin: false }, 'en')
    expect(r?.trigger_reason).toBe('consistency_low')
  })

  it('returns first_checkin when all thresholds are ok but athlete just checked in for the first time', () => {
    const r = getUpsellTrigger({ acwr: 1.0, tsb: 5, consistency: 80, isFirstCheckin: true }, 'en')
    expect(r?.trigger_reason).toBe('first_checkin')
    expect(r?.cta).toBeTruthy()
  })

  it('returns null when no trigger conditions are met', () => {
    const r = getUpsellTrigger({ acwr: 1.0, tsb: 5, consistency: 70, isFirstCheckin: false }, 'en')
    expect(r).toBeNull()
  })

  it('uses TR url and TR copy when lang is tr', () => {
    const r = getUpsellTrigger({ acwr: 1.5, tsb: 0, consistency: 80, isFirstCheckin: false }, 'tr')
    expect(r?.url).toContain('/esik')
    expect(r?.trigger_reason).toBe('acwr_danger')
  })
})
