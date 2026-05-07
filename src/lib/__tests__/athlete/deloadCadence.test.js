import { describe, it, expect } from 'vitest'
import {
  detectDeloadCadence,
  DELOAD_CADENCE_CITATION,
} from '../../athlete/deloadCadence.js'

const TODAY = '2026-05-07'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// today is Thursday → last Sunday before/on today is 2026-05-03
const LAST_SUNDAY = '2026-05-03'

/**
 * Build a log spanning N trailing weeks (ending lastSunday). Each week index
 * is 0=most recent → N-1=oldest. weekTssFn(weekIdx) → weekly TSS distributed
 * evenly across 7 days.
 */
function makeWeeklyLog(numWeeks, weekTssFn) {
  const log = []
  for (let w = 0; w < numWeeks; w++) {
    const weekEnd = addDays(LAST_SUNDAY, -7 * w)
    const weekStart = addDays(weekEnd, -6)
    const weekTSS = weekTssFn(w)
    const perDay = weekTSS / 7
    for (let d = 0; d < 7; d++) {
      log.push({ date: addDays(weekStart, d), type: 'run', tss: perDay })
    }
  }
  return log
}

// ─── Empty / null inputs ────────────────────────────────────────────────────
describe('detectDeloadCadence — empty / null inputs', () => {
  it('null log → reliable=false, no-pattern band, all zeros', () => {
    const r = detectDeloadCadence(null, TODAY)
    expect(r.weeksAnalyzed).toBe(0)
    expect(r.meanWeekTSS).toBe(0)
    expect(r.actualDeloads).toBe(0)
    expect(r.expectedDeloads).toBe(0)
    expect(r.deloadRatio).toBe(0)
    expect(r.weeksSinceLastDeload).toBe(null)
    expect(r.deloadWeekTSSValues).toEqual([])
    expect(r.band).toBe('no-pattern')
    expect(r.reliable).toBe(false)
  })

  it('empty array log → reliable=false, no-pattern band', () => {
    const r = detectDeloadCadence([], TODAY)
    expect(r.band).toBe('no-pattern')
    expect(r.reliable).toBe(false)
  })

  it('non-array log → safe defaults', () => {
    const r = detectDeloadCadence({ foo: 'bar' }, TODAY)
    expect(r.band).toBe('no-pattern')
    expect(r.reliable).toBe(false)
  })
})

// ─── Reliability ────────────────────────────────────────────────────────────
describe('detectDeloadCadence — reliability', () => {
  it('log <8 weeks → reliable=false', () => {
    const log = makeWeeklyLog(5, () => 400)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.weeksAnalyzed).toBeLessThan(8)
    expect(r.reliable).toBe(false)
  })

  it('meanWeekTSS ≤ 50 → reliable=false even with 12 weeks', () => {
    const log = makeWeeklyLog(12, () => 30)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.meanWeekTSS).toBeLessThanOrEqual(50)
    expect(r.reliable).toBe(false)
  })

  it('12 weeks with healthy mean TSS → reliable=true', () => {
    const log = makeWeeklyLog(12, () => 400)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.reliable).toBe(true)
  })
})

// ─── Band fixtures ──────────────────────────────────────────────────────────
describe('detectDeloadCadence — band fixtures', () => {
  it('12-week perfect 3:1 cadence → on-schedule, deloadRatio=1.0', () => {
    // w=0 most recent: deload, build, build, build, deload, ... pattern
    // (deload occurs at w=0, 4, 8) — 3 deloads in 12 weeks
    const log = makeWeeklyLog(12, (w) => (w % 4 === 0 ? 200 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(3)
    expect(r.expectedDeloads).toBe(3)
    expect(r.deloadRatio).toBe(1.0)
    expect(r.weeksSinceLastDeload).toBe(0)
    expect(r.band).toBe('on-schedule')
  })

  it('12-week constant TSS (no deloads) → no-pattern band', () => {
    const log = makeWeeklyLog(12, () => 400)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(0)
    expect(r.weeksSinceLastDeload).toBe(null)
    expect(r.band).toBe('no-pattern')
  })

  it('12-week 1 deload 8 weeks ago, no recent deload → overdue band', () => {
    // single deload week at index 8, others at 400
    const log = makeWeeklyLog(12, (w) => (w === 8 ? 100 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(1)
    expect(r.weeksSinceLastDeload).toBe(8)
    expect(r.band).toBe('overdue')
  })

  it('12-week deload every 2 weeks → too-frequent band, deloadRatio>1.5', () => {
    // deload at even week indices: w=0,2,4,6,8,10 → 6 deloads
    const log = makeWeeklyLog(12, (w) => (w % 2 === 0 ? 150 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(6)
    expect(r.expectedDeloads).toBe(3)
    expect(r.deloadRatio).toBeGreaterThan(1.5)
    expect(r.band).toBe('too-frequent')
  })

  it('priority: overdue wins when weeksSinceLastDeload > 4', () => {
    // single deload at w=9 → 9 weeks since last deload
    const log = makeWeeklyLog(12, (w) => (w === 9 ? 80 : 380))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(1)
    expect(r.weeksSinceLastDeload).toBe(9)
    expect(r.band).toBe('overdue')
  })
})

// ─── Math correctness ──────────────────────────────────────────────────────
describe('detectDeloadCadence — math', () => {
  it('weeksSinceLastDeload computed correctly (most-recent deload at w=2)', () => {
    const log = makeWeeklyLog(12, (w) => (w === 2 || w === 7 ? 100 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.weeksSinceLastDeload).toBe(2)
  })

  it('deloadRatio = actualDeloads / expectedDeloads', () => {
    // 12 weeks → expected = 3. Place 2 deloads.
    const log = makeWeeklyLog(12, (w) => (w === 1 || w === 5 ? 100 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(2)
    expect(r.expectedDeloads).toBe(3)
    expect(r.deloadRatio).toBeCloseTo(2 / 3, 2)
  })

  it('expectedDeloads = floor(weeksAnalyzed / 4)', () => {
    const log = makeWeeklyLog(11, () => 400)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.weeksAnalyzed).toBe(11)
    expect(r.expectedDeloads).toBe(2)
  })

  it('meanWeekTSS averages all weekly TSS values', () => {
    const log = makeWeeklyLog(12, (w) => (w % 4 === 0 ? 200 : 400))
    const r = detectDeloadCadence(log, TODAY)
    // 9 × 400 + 3 × 200 = 4200; mean = 350
    expect(r.meanWeekTSS).toBeCloseTo(350, 0)
  })

  it('weeksAnalyzed reports actual count (12 with 12+ weeks logged)', () => {
    const log = makeWeeklyLog(12, () => 400)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.weeksAnalyzed).toBe(12)
  })

  it('weeksAnalyzed less than 12 for shorter logs', () => {
    const log = makeWeeklyLog(6, () => 300)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.weeksAnalyzed).toBe(6)
  })
})

// ─── Rounding ───────────────────────────────────────────────────────────────
describe('detectDeloadCadence — rounding', () => {
  it('meanWeekTSS rounded to 1 decimal', () => {
    const log = makeWeeklyLog(12, (w) => (w % 4 === 0 ? 213 : 437))
    const r = detectDeloadCadence(log, TODAY)
    const decimals = (Math.abs(r.meanWeekTSS).toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(1)
  })

  it('deloadRatio rounded to 2 decimals', () => {
    const log = makeWeeklyLog(12, (w) => (w === 1 || w === 5 ? 100 : 400))
    const r = detectDeloadCadence(log, TODAY)
    const decimals = (Math.abs(r.deloadRatio).toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(2)
  })

  it('deloadWeekTSSValues entries rounded to 1 decimal', () => {
    const log = makeWeeklyLog(12, (w) => (w % 4 === 0 ? 213.456 : 400))
    const r = detectDeloadCadence(log, TODAY)
    for (const v of r.deloadWeekTSSValues) {
      const decimals = (Math.abs(v).toString().split('.')[1] || '').length
      expect(decimals).toBeLessThanOrEqual(1)
    }
  })
})

// ─── deloadWeekTSSValues ────────────────────────────────────────────────────
describe('detectDeloadCadence — deloadWeekTSSValues', () => {
  it('contains weekly TSS of deload weeks, most recent first', () => {
    const log = makeWeeklyLog(12, (w) => (w === 1 || w === 5 || w === 9 ? 100 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.deloadWeekTSSValues.length).toBe(3)
    expect(r.deloadWeekTSSValues[0]).toBeCloseTo(100, 0)
  })

  it('limited to max 5 most-recent deloads', () => {
    // 6 deloads (every 2 weeks)
    const log = makeWeeklyLog(12, (w) => (w % 2 === 0 ? 100 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(6)
    expect(r.deloadWeekTSSValues.length).toBe(5)
  })

  it('empty when no deloads', () => {
    const log = makeWeeklyLog(12, () => 400)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.deloadWeekTSSValues).toEqual([])
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────────────
describe('detectDeloadCadence — edge cases', () => {
  it('multiple entries on the same date sum into one daily TSS', () => {
    // Single-week log with split entries on one day
    const baseLog = makeWeeklyLog(12, () => 400)
    // Add additional entries on TODAY
    const splitLog = [
      ...baseLog,
      { date: TODAY, type: 'bike', tss: 30 },
      { date: TODAY, type: 'run', tss: 30 },
    ]
    const mergedLog = [...baseLog, { date: TODAY, type: 'combined', tss: 60 }]
    const a = detectDeloadCadence(splitLog, TODAY)
    const b = detectDeloadCadence(mergedLog, TODAY)
    expect(a.meanWeekTSS).toBeCloseTo(b.meanWeekTSS, 1)
    expect(a.actualDeloads).toBe(b.actualDeloads)
  })

  it('options.today override is deterministic', () => {
    const log = makeWeeklyLog(12, (w) => (w % 4 === 0 ? 200 : 400))
    const r1 = detectDeloadCadence(log, TODAY)
    const r2 = detectDeloadCadence(log, TODAY)
    expect(r1.meanWeekTSS).toBe(r2.meanWeekTSS)
    expect(r1.actualDeloads).toBe(r2.actualDeloads)
    expect(r1.band).toBe(r2.band)
  })

  it('entries dated after today are ignored', () => {
    const past = makeWeeklyLog(12, () => 400)
    const future = [
      { date: addDays(TODAY, 14), type: 'run', tss: 999 },
      { date: addDays(TODAY, 21), type: 'run', tss: 999 },
    ]
    const r1 = detectDeloadCadence(past, TODAY)
    const r2 = detectDeloadCadence([...past, ...future], TODAY)
    expect(r1.meanWeekTSS).toBeCloseTo(r2.meanWeekTSS, 1)
    expect(r1.actualDeloads).toBe(r2.actualDeloads)
  })

  it('NaN / missing tss values do not corrupt the totals', () => {
    const log = [
      ...makeWeeklyLog(12, () => 400),
      { date: TODAY, type: 'mystery' },
      { date: addDays(TODAY, -1), type: 'broken', tss: 'oops' },
    ]
    const r = detectDeloadCadence(log, TODAY)
    expect(Number.isFinite(r.meanWeekTSS)).toBe(true)
    expect(Number.isFinite(r.deloadRatio)).toBe(true)
  })

  it('all weeks similar TSS (no deloads) → no-pattern band', () => {
    const log = makeWeeklyLog(12, (w) => 400 + (w % 2) * 5)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.actualDeloads).toBe(0)
    expect(r.band).toBe('no-pattern')
  })
})

// ─── Bilingual messages ─────────────────────────────────────────────────────
describe('detectDeloadCadence — bilingual messages', () => {
  it('on-schedule has {n} substitution and EN+TR', () => {
    const log = makeWeeklyLog(12, (w) => (w % 4 === 0 ? 200 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.band).toBe('on-schedule')
    expect(r.message.en).toMatch(/0w ago/)
    expect(r.message.tr).toMatch(/0h önce/)
    expect(r.message.en).not.toMatch(/\{n\}/)
    expect(r.message.tr).not.toMatch(/\{n\}/)
  })

  it('overdue includes {n} weeks-since count in EN+TR', () => {
    const log = makeWeeklyLog(12, (w) => (w === 8 ? 100 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.band).toBe('overdue')
    expect(r.message.en).toMatch(/8w since/)
    expect(r.message.tr).toMatch(/8h geçti/)
    expect(r.recommendation.en).toMatch(/40-50%/)
    expect(r.recommendation.tr).toMatch(/40-50/)
  })

  it('too-frequent shows EN+TR without {n} placeholder', () => {
    const log = makeWeeklyLog(12, (w) => (w % 2 === 0 ? 150 : 400))
    const r = detectDeloadCadence(log, TODAY)
    expect(r.band).toBe('too-frequent')
    expect(r.message.en).toMatch(/too often/i)
    expect(r.message.tr).toMatch(/Çok sık/)
    expect(r.message.en).not.toMatch(/\{n\}/)
    expect(r.recommendation.en).toMatch(/Skip/)
    expect(r.recommendation.tr).toMatch(/Sıradaki/)
  })

  it('no-pattern shows EN+TR fixed message', () => {
    const log = makeWeeklyLog(12, () => 400)
    const r = detectDeloadCadence(log, TODAY)
    expect(r.band).toBe('no-pattern')
    expect(r.message.en).toMatch(/No deload pattern/)
    expect(r.message.tr).toMatch(/Deload ritmi tespit edilmedi/)
    expect(r.recommendation.en).toMatch(/3-week build/)
    expect(r.recommendation.tr).toMatch(/3-hafta yapım/)
  })

  it('all 4 bands produce non-empty bilingual messages', () => {
    const fixtures = [
      makeWeeklyLog(12, (w) => (w % 4 === 0 ? 200 : 400)), // on-schedule
      makeWeeklyLog(12, () => 400), // no-pattern
      makeWeeklyLog(12, (w) => (w === 8 ? 100 : 400)), // overdue
      makeWeeklyLog(12, (w) => (w % 2 === 0 ? 150 : 400)), // too-frequent
    ]
    for (const log of fixtures) {
      const r = detectDeloadCadence(log, TODAY)
      expect(r.message.en.length).toBeGreaterThan(0)
      expect(r.message.tr.length).toBeGreaterThan(0)
    }
  })
})

// ─── Citation + return shape ────────────────────────────────────────────────
describe('detectDeloadCadence — return shape', () => {
  it('citation matches export constant', () => {
    const r = detectDeloadCadence([], TODAY)
    expect(r.citation).toBe(DELOAD_CADENCE_CITATION)
    expect(DELOAD_CADENCE_CITATION).toBe(
      'Bompa & Haff 2009 periodization; Issurin 2010 block periodization',
    )
  })

  it('result has all expected keys', () => {
    const r = detectDeloadCadence([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'actualDeloads',
      'band',
      'citation',
      'deloadRatio',
      'deloadWeekTSSValues',
      'expectedDeloads',
      'meanWeekTSS',
      'message',
      'recommendation',
      'reliable',
      'weeksAnalyzed',
      'weeksSinceLastDeload',
    ])
  })

  it('uses default today when omitted', () => {
    const r = detectDeloadCadence([])
    expect(r.band).toBe('no-pattern')
    expect(typeof r.meanWeekTSS).toBe('number')
  })
})
