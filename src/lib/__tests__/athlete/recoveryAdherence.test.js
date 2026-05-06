// recoveryAdherence lib tests
import { describe, it, expect } from 'vitest'
import {
  detectRecoveryAdherence,
  RECOVERY_ADHERENCE_CITATION,
} from '../../athlete/recoveryAdherence.js'

const TODAY = '2026-05-07'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('detectRecoveryAdherence', () => {
  it('returns vacuous-good for null log', () => {
    const r = detectRecoveryAdherence(null, TODAY)
    expect(r.totalRestDaysPlanned).toBe(0)
    expect(r.reliable).toBe(false)
    expect(r.band).toBe('good')
    expect(r.message.en).toMatch(/No rest days planned/)
    expect(r.message.tr).toMatch(/Planlı dinlenme günü yok/)
  })

  it('returns vacuous-good for empty array', () => {
    const r = detectRecoveryAdherence([], TODAY)
    expect(r.totalRestDaysPlanned).toBe(0)
    expect(r.reliable).toBe(false)
    expect(r.band).toBe('good')
  })

  it('log with 0 planned rest days → reliable=false, no-planned message', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'tempo', rpe: 6, tss: 60 },
      { date: addDaysStr(TODAY, -2), type: 'threshold', rpe: 8, tss: 90 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(0)
    expect(r.reliable).toBe(false)
    expect(r.band).toBe('good')
    expect(r.message.en).toMatch(/No rest days planned/)
    expect(r.recommendation.en).toMatch(/Add 1 full rest day/)
  })

  it('log with <3 planned rest days → reliable=false (count still computed)', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), intent: 'recovery', rpe: 3, tss: 10 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(2)
    expect(r.adherentDays).toBe(2)
    expect(r.reliable).toBe(false)
  })

  it('3 planned rest days, all adherent → good band, 100%', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 3, tss: 15 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 4, tss: 30 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
    expect(r.adherentDays).toBe(3)
    expect(r.adherencePct).toBe(100)
    expect(r.band).toBe('good')
    expect(r.reliable).toBe(true)
  })

  it('3 planned rest days, 2 mild drift → moderate band', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 4, tss: 45 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 5, tss: 20 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
    expect(r.adherentDays).toBe(1)
    expect(r.mildDriftDays).toBe(2)
    expect(r.adherencePct).toBe(33)
    expect(r.band).toBe('poor')
  })

  it('5 planned rest days with 1 mild drift → moderate band (80% boundary)', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 3, tss: 15 },
      { date: addDaysStr(TODAY, -4), type: 'rest', rpe: 4, tss: 25 },
      { date: addDaysStr(TODAY, -5), type: 'rest', rpe: 5, tss: 20 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(5)
    expect(r.adherentDays).toBe(4)
    expect(r.mildDriftDays).toBe(1)
    expect(r.adherencePct).toBe(80)
    expect(r.band).toBe('good')
  })

  it('3 planned rest days, 2 severe drift → poor band', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 8, tss: 80 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 7, tss: 70 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
    expect(r.severeDriftDays).toBe(2)
    expect(r.adherentDays).toBe(1)
    expect(r.adherencePct).toBe(33)
    expect(r.band).toBe('poor')
  })

  it('boundary: exactly 80% → band="good"', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -4), type: 'rest', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -5), type: 'rest', rpe: 7, tss: 50 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.adherencePct).toBe(80)
    expect(r.band).toBe('good')
  })

  it('boundary: exactly 50% → band="moderate"', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 7, tss: 50 },
      { date: addDaysStr(TODAY, -4), type: 'rest', rpe: 7, tss: 50 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.adherencePct).toBe(50)
    expect(r.band).toBe('moderate')
  })

  it('boundary: 49% → band="poor"', () => {
    // 49 adherent + 51 mild = 49%, spread across distinct dates inside window
    const log = []
    for (let i = 0; i < 49; i++) {
      log.push({ date: addDaysStr(TODAY, -(i % 14)), type: 'rest', rpe: 3, tss: 10 })
    }
    for (let i = 0; i < 51; i++) {
      log.push({ date: addDaysStr(TODAY, -(14 + (i % 14))), type: 'rest', rpe: 3, tss: 50 })
    }
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(28)
    expect(r.band).toBe('poor')
  })

  it('adherent boundary inclusive: TSS=30 AND rpe=4 → adherent', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 4, tss: 30 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 4, tss: 30 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 4, tss: 30 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.adherentDays).toBe(3)
    expect(r.mildDriftDays).toBe(0)
    expect(r.severeDriftDays).toBe(0)
  })

  it('mild_drift: TSS=31 AND rpe=4 → mild', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 4, tss: 31 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 4, tss: 31 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 4, tss: 31 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.mildDriftDays).toBe(3)
    expect(r.severeDriftDays).toBe(0)
  })

  it('severe_drift: TSS=70 → severe regardless of rpe', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 70 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 3, tss: 70 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 4, tss: 70 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.severeDriftDays).toBe(3)
  })

  it("intent='recovery' triggers rest-day classification", () => {
    const log = [
      { date: addDaysStr(TODAY, -1), intent: 'recovery', type: 'misc', rpe: 3, tss: 0 },
      { date: addDaysStr(TODAY, -2), intent: 'recovery', type: 'misc', rpe: 3, tss: 0 },
      { date: addDaysStr(TODAY, -3), intent: 'recovery', type: 'misc', rpe: 3, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
    expect(r.adherentDays).toBe(3)
  })

  it("intent='rest' triggers rest-day classification", () => {
    const log = [
      { date: addDaysStr(TODAY, -1), intent: 'rest', type: 'misc', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), intent: 'rest', type: 'misc', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), intent: 'rest', type: 'misc', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
  })

  it("intent='off' triggers rest-day classification", () => {
    const log = [
      { date: addDaysStr(TODAY, -1), intent: 'off', type: 'misc', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), intent: 'off', type: 'misc', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), intent: 'off', type: 'misc', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
  })

  it('type matching /recovery/i triggers rest classification', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'Active Recovery', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -2), type: 'recovery', rpe: 3, tss: 10 },
      { date: addDaysStr(TODAY, -3), type: 'RECOVERY', rpe: 3, tss: 10 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
  })

  it('type matching /rest/i triggers rest classification', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'Rest Day', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), type: 'REST', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
  })

  it('multiple entries same rest day: sum TSS (20+15=35 → mild)', () => {
    const date = addDaysStr(TODAY, -1)
    const log = [
      { date, type: 'rest', rpe: 3, tss: 20 },
      { date, type: 'rest', rpe: 3, tss: 15 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
    expect(r.mildDriftDays).toBe(1)
    expect(r.adherentDays).toBe(2)
  })

  it('multiple entries same rest day: mean rpe across entries', () => {
    const date = addDaysStr(TODAY, -1)
    // mean of 3 and 7 = 5 → mild via rpe band
    const log = [
      { date, type: 'rest', rpe: 3, tss: 10 },
      { date, type: 'rest', rpe: 7, tss: 10 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.mildDriftDays).toBe(1)
    expect(r.adherentDays).toBe(2)
  })

  it('entry with rpe but no tss → use 0 for TSS but factor rpe', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 7 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 3 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.severeDriftDays).toBe(1)
    expect(r.adherentDays).toBe(2)
  })

  it('entry with tss but no rpe → factor TSS, ignore rpe', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', tss: 80 },
      { date: addDaysStr(TODAY, -2), type: 'rest', tss: 10 },
      { date: addDaysStr(TODAY, -3), type: 'rest', tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.severeDriftDays).toBe(1)
    expect(r.adherentDays).toBe(2)
  })

  it('driftDates sorted desc, max 5', () => {
    const log = []
    for (let i = 0; i < 10; i++) {
      log.push({ date: addDaysStr(TODAY, -i), type: 'rest', rpe: 8, tss: 80 })
    }
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.driftDates.length).toBe(5)
    expect(r.driftDates[0]).toBe(TODAY)
    expect(r.driftDates[1]).toBe(addDaysStr(TODAY, -1))
    // strictly descending
    for (let i = 1; i < r.driftDates.length; i++) {
      expect(r.driftDates[i] < r.driftDates[i - 1]).toBe(true)
    }
  })

  it('driftDates contains both mild and severe drift days', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 8, tss: 80 }, // severe
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 4, tss: 45 }, // mild
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2, tss: 0 },  // adherent
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.driftDates).toContain(addDaysStr(TODAY, -1))
    expect(r.driftDates).toContain(addDaysStr(TODAY, -2))
    expect(r.driftDates).not.toContain(addDaysStr(TODAY, -3))
  })

  it('{p} substitution in moderate bilingual message', () => {
    // 5 rest days, 3 adherent + 2 mild → 60%
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -4), type: 'rest', rpe: 5, tss: 20 },
      { date: addDaysStr(TODAY, -5), type: 'rest', rpe: 4, tss: 45 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.adherencePct).toBe(60)
    expect(r.band).toBe('moderate')
    expect(r.message.en).toMatch(/60%/)
    expect(r.message.tr).toMatch(/%60/)
  })

  it('options.today override is deterministic', () => {
    const log = [
      { date: '2026-05-06', type: 'rest', rpe: 2, tss: 0 },
      { date: '2026-05-05', type: 'rest', rpe: 2, tss: 0 },
      { date: '2026-05-04', type: 'rest', rpe: 2, tss: 0 },
    ]
    const r1 = detectRecoveryAdherence(log, '2026-05-07')
    const r2 = detectRecoveryAdherence(log, '2026-05-07')
    expect(r1).toEqual(r2)
    expect(r1.totalRestDaysPlanned).toBe(3)
  })

  it('bilingual EN+TR present for good band (with planned rest)', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.band).toBe('good')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.message.en).toMatch(/100%/)
    expect(r.message.tr).toMatch(/%100/)
  })

  it('bilingual EN+TR present for poor band', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 8, tss: 90 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 8, tss: 90 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 8, tss: 90 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.band).toBe('poor')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('citation present and exported', () => {
    const r = detectRecoveryAdherence([], TODAY)
    expect(r.citation).toBe('Halson 2014 recovery; Foster 2001 monotony')
    expect(RECOVERY_ADHERENCE_CITATION).toBe('Halson 2014 recovery; Foster 2001 monotony')
  })

  it('entries outside 28d window excluded', () => {
    const log = [
      { date: addDaysStr(TODAY, -50), type: 'rest', rpe: 8, tss: 90 },
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.totalRestDaysPlanned).toBe(3)
    expect(r.severeDriftDays).toBe(0)
  })

  it('result has all 11 expected keys', () => {
    const r = detectRecoveryAdherence([], TODAY)
    expect(r).toHaveProperty('totalRestDaysPlanned')
    expect(r).toHaveProperty('adherentDays')
    expect(r).toHaveProperty('mildDriftDays')
    expect(r).toHaveProperty('severeDriftDays')
    expect(r).toHaveProperty('adherencePct')
    expect(r).toHaveProperty('driftDates')
    expect(r).toHaveProperty('band')
    expect(r).toHaveProperty('message')
    expect(r).toHaveProperty('recommendation')
    expect(r).toHaveProperty('reliable')
    expect(r).toHaveProperty('citation')
  })

  it('recommendation is empty for good band when rest days planned', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 2, tss: 0 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(r.band).toBe('good')
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('adherencePct rounded to whole number', () => {
    // 1 adherent + 2 severe = 33.33% → 33
    const log = [
      { date: addDaysStr(TODAY, -1), type: 'rest', rpe: 2, tss: 0 },
      { date: addDaysStr(TODAY, -2), type: 'rest', rpe: 8, tss: 90 },
      { date: addDaysStr(TODAY, -3), type: 'rest', rpe: 8, tss: 90 },
    ]
    const r = detectRecoveryAdherence(log, TODAY)
    expect(Number.isInteger(r.adherencePct)).toBe(true)
    expect(r.adherencePct).toBe(33)
  })
})
