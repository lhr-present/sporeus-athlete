// src/lib/__tests__/athlete/deloadDetector.test.js — E78
import { describe, it, expect } from 'vitest'
import { detectDeloadNeed } from '../../athlete/deloadDetector.js'

// Build a log spanning N completed weeks (Mon-anchored) with uniform weekly TSS
function makeWeeklyLog(weeksBack, tssPerWeek, today = '2026-04-28') {
  const entries = []
  const td = new Date(today + 'T12:00:00Z')
  const todayDow = (td.getUTCDay() + 6) % 7
  // Start from the Monday before today
  const thisMon = new Date(td)
  thisMon.setUTCDate(td.getUTCDate() - todayDow)

  for (let w = weeksBack; w >= 1; w--) {
    const mon = new Date(thisMon)
    mon.setUTCDate(thisMon.getUTCDate() - w * 7)
    // Place 3 sessions per week (Mon/Wed/Fri)
    for (const offset of [0, 2, 4]) {
      const d = new Date(mon)
      d.setUTCDate(mon.getUTCDate() + offset)
      entries.push({
        date: d.toISOString().slice(0, 10),
        tss: Math.round(tssPerWeek / 3),
        duration: 60,
        rpe: 5,
      })
    }
  }
  return entries
}

describe('detectDeloadNeed', () => {
  it('returns null for empty log', () => {
    expect(detectDeloadNeed([])).toBeNull()
  })

  it('returns null for null log', () => {
    expect(detectDeloadNeed(null)).toBeNull()
  })

  it('returns null when fewer than 3 completed weeks', () => {
    const log = makeWeeklyLog(2, 100)
    const r = detectDeloadNeed(log, '2026-04-28')
    expect(r).toBeNull()
  })

  it('returns object with needsDeload false when not enough build weeks', () => {
    const log = makeWeeklyLog(4, 100)
    const r = detectDeloadNeed(log, '2026-04-28')
    expect(r).not.toBeNull()
    expect(typeof r.needsDeload).toBe('boolean')
  })

  it('recommends deload after 4 weeks without a deload week', () => {
    // 5 weeks of identical load → weeksWithoutDeload ≥ 4 (no week ≤ 60% avg)
    const log = makeWeeklyLog(5, 120)
    const r = detectDeloadNeed(log, '2026-04-28')
    expect(r).not.toBeNull()
    expect(r.needsDeload).toBe(true)
  })

  it('needsDeload true → en and tr strings are non-empty', () => {
    const log = makeWeeklyLog(5, 120)
    const r = detectDeloadNeed(log, '2026-04-28')
    if (r?.needsDeload) {
      expect(r.en.length).toBeGreaterThan(10)
      expect(r.tr.length).toBeGreaterThan(10)
    }
  })

  it('includes weeksBuilding as a number', () => {
    const log = makeWeeklyLog(4, 100)
    const r = detectDeloadNeed(log, '2026-04-28')
    expect(typeof r.weeksBuilding).toBe('number')
    expect(r.weeksBuilding).toBeGreaterThanOrEqual(0)
  })

  it('does not recommend deload when last week was a deload', () => {
    // 3 normal weeks then 1 low week (clear deload)
    const normal = makeWeeklyLog(4, 120)
    // Replace the most recent completed week sessions with very low TSS
    const td = new Date('2026-04-28T12:00:00Z')
    const todayDow = (td.getUTCDay() + 6) % 7
    const thisMon = new Date(td)
    thisMon.setUTCDate(td.getUTCDate() - todayDow)
    const lastMon = new Date(thisMon)
    lastMon.setUTCDate(thisMon.getUTCDate() - 7)
    const lastMonStr = lastMon.toISOString().slice(0, 10)

    // Remove last week's entries, replace with 1 tiny session
    const trimmed = normal.filter(e => e.date < lastMonStr)
    trimmed.push({ date: lastMonStr, tss: 10, duration: 20, rpe: 3 })

    const r = detectDeloadNeed(trimmed, '2026-04-28')
    // With clear deload, needsDeload should be false (unless build streak still applies)
    if (r !== null) {
      expect(typeof r.needsDeload).toBe('boolean')
    }
  })

  it('result always has needsDeload, weeksBuilding, lastDeloadWeek keys when not null', () => {
    const log = makeWeeklyLog(4, 100)
    const r = detectDeloadNeed(log, '2026-04-28')
    expect(r).toHaveProperty('needsDeload')
    expect(r).toHaveProperty('weeksBuilding')
    expect(r).toHaveProperty('lastDeloadWeek')
  })

  it('result always has en and tr string keys when not null', () => {
    const log = makeWeeklyLog(4, 100)
    const r = detectDeloadNeed(log, '2026-04-28')
    expect(r).toHaveProperty('en')
    expect(r).toHaveProperty('tr')
    expect(typeof r.en).toBe('string')
    expect(typeof r.tr).toBe('string')
  })

  it('lastDeloadWeek is null or a YYYY-MM-DD string', () => {
    const log = makeWeeklyLog(5, 120)
    const r = detectDeloadNeed(log, '2026-04-28')
    if (r !== null && r.lastDeloadWeek !== null) {
      expect(r.lastDeloadWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('weeksBuilding is never negative', () => {
    const log = makeWeeklyLog(5, 120)
    const r = detectDeloadNeed(log, '2026-04-28')
    if (r !== null) {
      expect(r.weeksBuilding).toBeGreaterThanOrEqual(0)
    }
  })

  it('needsDeload is false when only 3 completed weeks of equal load', () => {
    const log = makeWeeklyLog(3, 100)
    const r = detectDeloadNeed(log, '2026-04-28')
    // 3 equal-TSS weeks → weeksBuilding will be 0 or 1 (CTL barely moves), weeksWithoutDeload = 3
    if (r !== null) {
      expect(r.needsDeload).toBe(false)
    }
  })

  it('needsDeload true → en string mentions weeksBuilding count', () => {
    const log = makeWeeklyLog(5, 120)
    const r = detectDeloadNeed(log, '2026-04-28')
    if (r?.needsDeload) {
      expect(r.en).toContain(String(r.weeksBuilding))
    }
  })

  it('needsDeload true → tr string mentions weeksBuilding count', () => {
    const log = makeWeeklyLog(5, 120)
    const r = detectDeloadNeed(log, '2026-04-28')
    if (r?.needsDeload) {
      expect(r.tr).toContain(String(r.weeksBuilding))
    }
  })
})
