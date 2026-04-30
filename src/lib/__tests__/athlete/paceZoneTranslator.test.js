// src/lib/__tests__/athlete/paceZoneTranslator.test.js — E86 comprehensive tests
import { describe, it, expect } from 'vitest'
import { translatePaceZone, translateAllZones } from '../../athlete/paceZoneTranslator.js'
import { trainingPaces } from '../../sport/running.js'

const VDOT_50  = 50   // representative mid-pack runner
const VDOT_30  = 30   // slower runner
const VDOT_70  = 70   // elite runner
const MAX_HR   = 185

// ─── translatePaceZone — basic output shape ───────────────────────────────────
describe('translatePaceZone — basic output shape', () => {
  const paces  = trainingPaces(VDOT_50)
  const result = translatePaceZone('T', paces, MAX_HR)

  it('returns non-null for valid zone', () => expect(result).not.toBeNull())
  it('has zone key', () => expect(result.zone).toBe('T'))
  it('has label string', () => expect(typeof result.label).toBe('string'))
  it('has labelTR string', () => expect(typeof result.labelTR).toBe('string'))
  it('pace is M:SS format', () => expect(result.pace).toMatch(/^\d+:\d{2}$/))
  it('paceSecKm is positive number', () => expect(result.paceSecKm).toBeGreaterThan(0))
  it('hrRange has str property', () => expect(typeof result.hrRange.str).toBe('string'))
  it('hrRange has bpm values when maxHR provided', () => {
    expect(result.hrRange.low).toBeGreaterThan(0)
    expect(result.hrRange.high).toBeGreaterThan(0)
  })
  it('hrRange low < high', () => expect(result.hrRange.low).toBeLessThan(result.hrRange.high))
  it('rpeRange is a string', () => expect(typeof result.rpeRange).toBe('string'))
  it('color is hex string', () => expect(result.color).toMatch(/^#[0-9a-f]{6}$/i))
  it('feelEN is non-empty string', () => {
    expect(typeof result.feelEN).toBe('string')
    expect(result.feelEN.length).toBeGreaterThan(5)
  })
  it('feelTR is non-empty string', () => {
    expect(typeof result.feelTR).toBe('string')
    expect(result.feelTR.length).toBeGreaterThan(5)
  })
  it('purposeEN is non-empty string', () => {
    expect(typeof result.purposeEN).toBe('string')
    expect(result.purposeEN.length).toBeGreaterThan(5)
  })
  it('purposeTR is non-empty string', () => {
    expect(typeof result.purposeTR).toBe('string')
    expect(result.purposeTR.length).toBeGreaterThan(5)
  })
  it('formatEN is non-empty string', () => {
    expect(typeof result.formatEN).toBe('string')
    expect(result.formatEN.length).toBeGreaterThan(5)
  })
  it('formatTR is non-empty string', () => {
    expect(typeof result.formatTR).toBe('string')
    expect(result.formatTR.length).toBeGreaterThan(5)
  })
  it('hrRange has lowPct and highPct as integers', () => {
    expect(Number.isInteger(result.hrRange.lowPct)).toBe(true)
    expect(Number.isInteger(result.hrRange.highPct)).toBe(true)
  })
  it('hrRange str contains bpm when maxHR provided', () => {
    expect(result.hrRange.str).toContain('bpm')
  })
})

// ─── translatePaceZone — without maxHR ───────────────────────────────────────
describe('translatePaceZone — without maxHR', () => {
  const paces  = trainingPaces(VDOT_50)
  const result = translatePaceZone('E', paces)

  it('returns non-null when maxHR omitted', () => expect(result).not.toBeNull())
  it('hrRange.low is null without maxHR', () => expect(result.hrRange.low).toBeNull())
  it('hrRange.high is null without maxHR', () => expect(result.hrRange.high).toBeNull())
  it('hrRange.str contains % without maxHR', () => expect(result.hrRange.str).toContain('%'))
  it('hrRange.str does NOT contain bpm without maxHR', () => {
    expect(result.hrRange.str).not.toContain('bpm')
  })
  it('pace is still valid M:SS format', () => expect(result.pace).toMatch(/^\d+:\d{2}$/))
  it('paceSecKm is still positive', () => expect(result.paceSecKm).toBeGreaterThan(0))
})

// ─── translatePaceZone — invalid inputs ──────────────────────────────────────
describe('translatePaceZone — invalid inputs', () => {
  it('returns null for unknown zone key', () => {
    const paces = trainingPaces(VDOT_50)
    expect(translatePaceZone('X', paces)).toBeNull()
  })
  it('returns null for null paces', () => {
    expect(translatePaceZone('T', null)).toBeNull()
  })
  it('returns null for undefined paces', () => {
    expect(translatePaceZone('T', undefined)).toBeNull()
  })
  it('returns null for empty string zone', () => {
    const paces = trainingPaces(VDOT_50)
    expect(translatePaceZone('', paces)).toBeNull()
  })
  it('returns null for null zone', () => {
    const paces = trainingPaces(VDOT_50)
    expect(translatePaceZone(null, paces)).toBeNull()
  })
})

// ─── translatePaceZone — HR range correctness ────────────────────────────────
describe('translatePaceZone — HR range correctness per zone', () => {
  const paces = trainingPaces(VDOT_50)

  it('E zone HR: lowPct=60, highPct=79', () => {
    const r = translatePaceZone('E', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(60)
    expect(r.hrRange.highPct).toBe(79)
  })
  it('M zone HR: lowPct=80, highPct=87', () => {
    const r = translatePaceZone('M', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(80)
    expect(r.hrRange.highPct).toBe(87)
  })
  it('T zone HR: lowPct=88, highPct=92', () => {
    const r = translatePaceZone('T', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(88)
    expect(r.hrRange.highPct).toBe(92)
  })
  it('I zone HR: lowPct=93, highPct=97', () => {
    const r = translatePaceZone('I', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(93)
    expect(r.hrRange.highPct).toBe(97)
  })
  it('R zone HR: lowPct=97, highPct=100', () => {
    const r = translatePaceZone('R', paces, MAX_HR)
    expect(r.hrRange.lowPct).toBe(97)
    expect(r.hrRange.highPct).toBe(100)
  })
  it('E zone bpm low is ~60% of maxHR (rounded)', () => {
    const r = translatePaceZone('E', paces, MAX_HR)
    expect(r.hrRange.low).toBe(Math.round(MAX_HR * 0.60))
  })
  it('T zone bpm high is ~92% of maxHR (rounded)', () => {
    const r = translatePaceZone('T', paces, MAX_HR)
    expect(r.hrRange.high).toBe(Math.round(MAX_HR * 0.92))
  })
})

// ─── translatePaceZone — zone-specific labels ────────────────────────────────
describe('translatePaceZone — zone labels and RPE', () => {
  const paces = trainingPaces(VDOT_50)

  it('E zone label is Easy', () => {
    expect(translatePaceZone('E', paces).label).toBe('Easy')
    expect(translatePaceZone('E', paces).labelTR).toBe('Kolay')
  })
  it('M zone label is Marathon', () => {
    expect(translatePaceZone('M', paces).label).toBe('Marathon')
    expect(translatePaceZone('M', paces).labelTR).toBe('Maraton')
  })
  it('T zone label is Threshold', () => {
    expect(translatePaceZone('T', paces).label).toBe('Threshold')
    expect(translatePaceZone('T', paces).labelTR).toBe('Eşik')
  })
  it('I zone label is Interval', () => {
    expect(translatePaceZone('I', paces).label).toBe('Interval')
    expect(translatePaceZone('I', paces).labelTR).toBe('İnterval')
  })
  it('R zone label is Repetition', () => {
    expect(translatePaceZone('R', paces).label).toBe('Repetition')
    expect(translatePaceZone('R', paces).labelTR).toBe('Tekrar')
  })
  it('E zone rpeRange is 1–4', () => {
    expect(translatePaceZone('E', paces).rpeRange).toBe('1–4')
  })
  it('I zone rpeRange is 8–9', () => {
    expect(translatePaceZone('I', paces).rpeRange).toBe('8–9')
  })
  it('R zone rpeRange is 9–10', () => {
    expect(translatePaceZone('R', paces).rpeRange).toBe('9–10')
  })
})

// ─── translatePaceZone — pace ordering (E slowest, R fastest) ─────────────────
describe('translatePaceZone — pace ordering (E slowest → R fastest)', () => {
  const paces = trainingPaces(VDOT_50)
  const zones = ['E', 'M', 'T', 'I', 'R'].map(z => translatePaceZone(z, paces, MAX_HR))

  it('E pace > M pace (E is slower)', () => {
    expect(zones[0].paceSecKm).toBeGreaterThan(zones[1].paceSecKm)
  })
  it('M pace > T pace', () => {
    expect(zones[1].paceSecKm).toBeGreaterThan(zones[2].paceSecKm)
  })
  it('T pace > I pace', () => {
    expect(zones[2].paceSecKm).toBeGreaterThan(zones[3].paceSecKm)
  })
  it('I pace > R pace (R is fastest)', () => {
    expect(zones[3].paceSecKm).toBeGreaterThan(zones[4].paceSecKm)
  })
  it('E pace > R pace (easy zone is much slower than rep zone)', () => {
    expect(zones[0].paceSecKm).toBeGreaterThan(zones[4].paceSecKm)
  })
})

// ─── translatePaceZone — VDOT sensitivity ────────────────────────────────────
describe('translatePaceZone — VDOT sensitivity', () => {
  it('higher VDOT yields faster T pace (lower secKm)', () => {
    const paces30 = trainingPaces(VDOT_30)
    const paces70 = trainingPaces(VDOT_70)
    const t30 = translatePaceZone('T', paces30)
    const t70 = translatePaceZone('T', paces70)
    expect(t70.paceSecKm).toBeLessThan(t30.paceSecKm)
  })
  it('higher VDOT yields faster E pace (lower secKm)', () => {
    const paces30 = trainingPaces(VDOT_30)
    const paces70 = trainingPaces(VDOT_70)
    const e30 = translatePaceZone('E', paces30)
    const e70 = translatePaceZone('E', paces70)
    expect(e70.paceSecKm).toBeLessThan(e30.paceSecKm)
  })
  it('pace M:SS formatted correctly for VDOT 70 (fast runner)', () => {
    const paces = trainingPaces(VDOT_70)
    const t = translatePaceZone('T', paces)
    expect(t.pace).toMatch(/^\d+:\d{2}$/)
  })
})

// ─── translateAllZones ────────────────────────────────────────────────────────
describe('translateAllZones', () => {
  const all = translateAllZones(VDOT_50, MAX_HR)

  it('returns non-null for valid VDOT', () => expect(all).not.toBeNull())
  it('has all 5 zone keys', () => {
    expect(all).toHaveProperty('E')
    expect(all).toHaveProperty('M')
    expect(all).toHaveProperty('T')
    expect(all).toHaveProperty('I')
    expect(all).toHaveProperty('R')
  })
  it('all 5 zones are non-null', () => {
    expect(all.E).not.toBeNull()
    expect(all.M).not.toBeNull()
    expect(all.T).not.toBeNull()
    expect(all.I).not.toBeNull()
    expect(all.R).not.toBeNull()
  })
  it('returns null for VDOT 0', () => expect(translateAllZones(0)).toBeNull())
  it('returns null for null VDOT', () => expect(translateAllZones(null)).toBeNull())
  it('returns null for negative VDOT', () => expect(translateAllZones(-10)).toBeNull())
  it('each zone has correct zone key', () => {
    for (const z of ['E', 'M', 'T', 'I', 'R']) {
      expect(all[z].zone).toBe(z)
    }
  })
  it('colors are all different across 5 zones', () => {
    const colors = ['E', 'M', 'T', 'I', 'R'].map(z => all[z].color)
    const unique = new Set(colors)
    expect(unique.size).toBe(5)
  })
  it('works without maxHR — no crash, no bpm values', () => {
    const noHR = translateAllZones(VDOT_50)
    expect(noHR).not.toBeNull()
    for (const z of ['E', 'M', 'T', 'I', 'R']) {
      expect(noHR[z].hrRange.low).toBeNull()
      expect(noHR[z].hrRange.high).toBeNull()
    }
  })
  it('all zones have pace in M:SS format', () => {
    for (const z of ['E', 'M', 'T', 'I', 'R']) {
      expect(all[z].pace).toMatch(/^\d+:\d{2}$/)
    }
  })
  it('all zones have non-empty feelEN, feelTR, purposeEN, purposeTR, formatEN, formatTR', () => {
    for (const z of ['E', 'M', 'T', 'I', 'R']) {
      expect(all[z].feelEN.length).toBeGreaterThan(0)
      expect(all[z].feelTR.length).toBeGreaterThan(0)
      expect(all[z].purposeEN.length).toBeGreaterThan(0)
      expect(all[z].purposeTR.length).toBeGreaterThan(0)
      expect(all[z].formatEN.length).toBeGreaterThan(0)
      expect(all[z].formatTR.length).toBeGreaterThan(0)
    }
  })
  it('E pace > M pace in translateAllZones output', () => {
    expect(all.E.paceSecKm).toBeGreaterThan(all.M.paceSecKm)
  })
  it('M pace > T pace in translateAllZones output', () => {
    expect(all.M.paceSecKm).toBeGreaterThan(all.T.paceSecKm)
  })
  it('T pace > I pace in translateAllZones output', () => {
    expect(all.T.paceSecKm).toBeGreaterThan(all.I.paceSecKm)
  })
  it('I pace > R pace in translateAllZones output', () => {
    expect(all.I.paceSecKm).toBeGreaterThan(all.R.paceSecKm)
  })
  it('returns valid result for VDOT 30 (slow runner)', () => {
    const result30 = translateAllZones(VDOT_30, 170)
    expect(result30).not.toBeNull()
    expect(result30.E).not.toBeNull()
    expect(result30.R).not.toBeNull()
  })
  it('returns valid result for VDOT 70 (elite runner)', () => {
    const result70 = translateAllZones(VDOT_70, 195)
    expect(result70).not.toBeNull()
    expect(result70.T.paceSecKm).toBeGreaterThan(0)
  })
})
