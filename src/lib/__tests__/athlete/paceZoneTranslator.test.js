// src/lib/__tests__/athlete/paceZoneTranslator.test.js — E86
import { describe, it, expect } from 'vitest'
import { translatePaceZone, translateAllZones } from '../../athlete/paceZoneTranslator.js'
import { trainingPaces } from '../../sport/running.js'

const VDOT_50K = 50  // representative mid-pack runner
const MAX_HR   = 185

describe('translatePaceZone — basic output shape', () => {
  const paces  = trainingPaces(VDOT_50K)
  const result = translatePaceZone('T', paces, MAX_HR)

  it('returns non-null for valid zone', () => expect(result).not.toBeNull())
  it('has zone key', () => expect(result.zone).toBe('T'))
  it('has label string', () => expect(typeof result.label).toBe('string'))
  it('has labelTR string', () => expect(typeof result.labelTR).toBe('string'))
  it('pace is MM:SS format', () => expect(result.pace).toMatch(/^\d+:\d{2}$/))
  it('paceSecKm is positive number', () => expect(result.paceSecKm).toBeGreaterThan(0))
  it('hrRange has str', () => expect(typeof result.hrRange.str).toBe('string'))
  it('hrRange has bpm values when maxHR provided', () => {
    expect(result.hrRange.low).toBeGreaterThan(0)
    expect(result.hrRange.high).toBeGreaterThan(0)
  })
  it('hrRange low < high', () => expect(result.hrRange.low).toBeLessThan(result.hrRange.high))
  it('rpeRange is a string', () => expect(typeof result.rpeRange).toBe('string'))
  it('color is hex string', () => expect(result.color).toMatch(/^#[0-9a-f]{6}$/i))
  it('feelEN is non-empty', () => expect(result.feelEN.length).toBeGreaterThan(5))
  it('feelTR is non-empty', () => expect(result.feelTR.length).toBeGreaterThan(5))
  it('purposeEN is non-empty', () => expect(result.purposeEN.length).toBeGreaterThan(5))
  it('purposeTR is non-empty', () => expect(result.purposeTR.length).toBeGreaterThan(5))
  it('formatEN is non-empty', () => expect(result.formatEN.length).toBeGreaterThan(5))
  it('formatTR is non-empty', () => expect(result.formatTR.length).toBeGreaterThan(5))
})

describe('translatePaceZone — without maxHR', () => {
  const paces  = trainingPaces(VDOT_50K)
  const result = translatePaceZone('E', paces)

  it('returns non-null', () => expect(result).not.toBeNull())
  it('hrRange.low is null without maxHR', () => expect(result.hrRange.low).toBeNull())
  it('hrRange.str contains % without maxHR', () => expect(result.hrRange.str).toContain('%'))
})

describe('translatePaceZone — invalid inputs', () => {
  it('returns null for unknown zone', () => {
    const paces = trainingPaces(VDOT_50K)
    expect(translatePaceZone('X', paces)).toBeNull()
  })
  it('returns null for null paces', () => {
    expect(translatePaceZone('T', null)).toBeNull()
  })
})

describe('translatePaceZone — HR range correctness', () => {
  const paces = trainingPaces(VDOT_50K)

  it('E zone HR 60–79% maxHR', () => {
    const r = translatePaceZone('E', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(60)
    expect(r.hrRange.highPct).toBe(79)
  })
  it('T zone HR 88–92% maxHR', () => {
    const r = translatePaceZone('T', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(88)
    expect(r.hrRange.highPct).toBe(92)
  })
  it('I zone HR 93–97% maxHR', () => {
    const r = translatePaceZone('I', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(93)
    expect(r.hrRange.highPct).toBe(97)
  })
})

describe('translatePaceZone — pace ordering (E slowest, R fastest)', () => {
  const paces = trainingPaces(VDOT_50K)
  const zones = ['E', 'M', 'T', 'I', 'R'].map(z => translatePaceZone(z, paces, MAX_HR))

  it('E pace > M pace (E slower)', () => expect(zones[0].paceSecKm).toBeGreaterThan(zones[1].paceSecKm))
  it('M pace > T pace', () => expect(zones[1].paceSecKm).toBeGreaterThan(zones[2].paceSecKm))
  it('T pace > I pace', () => expect(zones[2].paceSecKm).toBeGreaterThan(zones[3].paceSecKm))
  it('I pace > R pace (R fastest)', () => expect(zones[3].paceSecKm).toBeGreaterThan(zones[4].paceSecKm))
})

describe('translateAllZones', () => {
  const all = translateAllZones(VDOT_50K, MAX_HR)

  it('returns non-null for valid VDOT', () => expect(all).not.toBeNull())
  it('has all 5 zones', () => {
    expect(all.E).not.toBeNull()
    expect(all.M).not.toBeNull()
    expect(all.T).not.toBeNull()
    expect(all.I).not.toBeNull()
    expect(all.R).not.toBeNull()
  })
  it('returns null for VDOT 0', () => expect(translateAllZones(0)).toBeNull())
  it('returns null for null VDOT', () => expect(translateAllZones(null)).toBeNull())
  it('each zone has correct zone key', () => {
    for (const z of ['E', 'M', 'T', 'I', 'R']) {
      expect(all[z].zone).toBe(z)
    }
  })
  it('colors are all different', () => {
    const colors = ['E', 'M', 'T', 'I', 'R'].map(z => all[z].color)
    const unique = new Set(colors)
    expect(unique.size).toBe(5)
  })
  it('works without maxHR (no bpm values)', () => {
    const noHR = translateAllZones(VDOT_50K)
    expect(noHR).not.toBeNull()
    expect(noHR.T.hrRange.low).toBeNull()
  })
})
