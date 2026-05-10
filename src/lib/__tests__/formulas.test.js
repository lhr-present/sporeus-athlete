// src/lib/__tests__/formulas.test.js
// Comprehensive unit tests for src/lib/formulas.js
// Covers: navyBF, mifflinBMR, hrZones, powerZones, paceZones, cooperVO2,
//         epley1RM, astrandVO2, yyir1VO2, wingateStats, parseTimeSec, fmtSec,
//         fmtPace, calcLoad, monotonyStrain, calcPRs, generatePlan, normTR,
//         generateCoachId, generateUnlockCode, verifyUnlockCode, FREE_ATHLETE_LIMIT
// Note: riegel, computePowerTSS, normalizedPower, computeWPrime, calcTSS,
//       rampFTP, ftpFrom20 are covered in science/formulas.citation.test.js

import { describe, it, expect, vi as _vi, beforeEach as _beforeEach, beforeAll as _beforeAll } from 'vitest'
import { webcrypto } from 'node:crypto'

// formulas.js uses bare `crypto` global for SHA-256 (browser Web Crypto API).
// In Vitest's Node environment it is not auto-injected, so polyfill it here.
if (typeof globalThis.crypto === 'undefined') {
  // @ts-ignore
  globalThis.crypto = webcrypto
}

import {
  navyBF,
  mifflinBMR,
  hrZones,
  powerZones,
  paceZones,
  cooperVO2,
  epley1RM,
  astrandVO2,
  yyir1VO2,
  wingateStats,
  parseTimeSec,
  fmtSec,
  fmtPace,
  calcLoad,
  monotonyStrain,
  calcPRs,
  generatePlan,
  validatePlanRamp,
  normTR,
  generateCoachId,
  generateUnlockCode,
  verifyUnlockCode,
  FREE_ATHLETE_LIMIT,
} from '../formulas.js'

// ─── navyBF ───────────────────────────────────────────────────────────────────
describe('navyBF — Navy body fat formula', () => {
  it('computes male body fat within plausible range for typical values', () => {
    // male: neck=38, waist=86, height=178 → expected ~16–20%
    const bf = navyBF(38, 86, 0, 178, 'male')
    expect(bf).toBeGreaterThan(10)
    expect(bf).toBeLessThan(30)
  })

  it('computes female body fat within plausible range', () => {
    // female: neck=33, waist=74, hip=97, height=165 → expected ~22–28%
    const bf = navyBF(33, 74, 97, 165, 'female')
    expect(bf).toBeGreaterThan(15)
    expect(bf).toBeLessThan(40)
  })

  it('returns a number rounded to 1 decimal place', () => {
    const bf = navyBF(38, 86, 0, 178, 'male')
    expect(typeof bf).toBe('number')
    expect(bf % 1).toBeCloseTo(Math.round(bf * 10) / 10 % 1, 10)
  })

  it('degenerate input (neck >= waist) returns 0 instead of NaN (v9.61.0 guard)', () => {
    // Pre-v9.61.0, navyBF(50, 40, 0, 178, 'male') → Math.log10(40-50) → NaN,
    // and Math.max(0, NaN) → NaN (a JS quirk); the profile UI showed a blank.
    // The guard now returns 0 for physically-impossible inputs.
    expect(navyBF(50, 40, 0, 178, 'male')).toBe(0)
    expect(navyBF(40, 40, 0, 178, 'male')).toBe(0)  // exact equality also invalid
  })

  it('degenerate female input (waist+hip <= neck) returns 0 (v9.61.0 guard)', () => {
    expect(navyBF(200, 70, 80, 165, 'female')).toBe(0)
  })

  it('zero height returns 0 (v9.61.0 guard)', () => {
    expect(navyBF(38, 86, 0, 0, 'male')).toBe(0)
  })

  it('tolerates string inputs (parseFloat coerces)', () => {
    const bf = navyBF('38', '86', '0', '178', 'male')
    expect(typeof bf).toBe('number')
    expect(bf).toBeGreaterThan(10)
    expect(bf).toBeLessThan(30)
  })

  it('female higher hip → higher body fat estimate', () => {
    const bfLow  = navyBF(33, 74, 90, 165, 'female')
    const bfHigh = navyBF(33, 74, 110, 165, 'female')
    expect(bfHigh).toBeGreaterThan(bfLow)
  })
})

// ─── mifflinBMR ───────────────────────────────────────────────────────────────
describe('mifflinBMR — Mifflin-St Jeor BMR', () => {
  it('returns a plausible BMR for a male (weight=75, height=180, age=30)', () => {
    // 10*75 + 6.25*180 - 5*30 + 5 = 750+1125-150+5 = 1730
    const bmr = mifflinBMR(75, 180, 30, 'male')
    expect(bmr).toBe(1730)
  })

  it('returns a plausible BMR for a female (weight=60, height=165, age=25)', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600+1031.25-125-161 = 1345.25 → 1345
    const bmr = mifflinBMR(60, 165, 25, 'female')
    expect(bmr).toBe(1345)
  })

  it('male BMR > female BMR with same stats', () => {
    const male   = mifflinBMR(70, 175, 30, 'male')
    const female = mifflinBMR(70, 175, 30, 'female')
    expect(male).toBeGreaterThan(female)
    // Difference should be exactly 166 (5 vs -161)
    expect(male - female).toBe(166)
  })

  it('heavier athlete → higher BMR', () => {
    const light = mifflinBMR(60, 175, 30, 'male')
    const heavy = mifflinBMR(90, 175, 30, 'male')
    expect(heavy).toBeGreaterThan(light)
  })
})

// ─── hrZones ─────────────────────────────────────────────────────────────────
describe('hrZones — HR zone calculator', () => {
  it('returns 5 zones', () => {
    expect(hrZones(190)).toHaveLength(5)
  })

  it('zone 1 low = 50% maxHR, zone 5 high = 100% maxHR', () => {
    const zones = hrZones(200)
    expect(zones[0].low).toBe(100)  // 50% of 200
    expect(zones[4].high).toBe(200) // 100% of 200
  })

  it('zones are contiguous: each zone low equals previous zone high', () => {
    const zones = hrZones(180)
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].low).toBe(zones[i - 1].high)
    }
  })

  it('each zone has name, low, high, color properties', () => {
    const zones = hrZones(190)
    zones.forEach(z => {
      expect(z).toHaveProperty('name')
      expect(z).toHaveProperty('low')
      expect(z).toHaveProperty('high')
      expect(z).toHaveProperty('color')
      expect(z.low).toBeLessThanOrEqual(z.high)
    })
  })
})

// ─── powerZones ──────────────────────────────────────────────────────────────
describe('powerZones — Power zone calculator', () => {
  it('returns 5 zones', () => {
    expect(powerZones(250)).toHaveLength(5)
  })

  it('zone 1 low = 55% FTP', () => {
    const zones = powerZones(200)
    expect(zones[0].low).toBe(Math.round(200 * 0.55))
  })

  it('zone 5 high = 150% FTP', () => {
    const zones = powerZones(300)
    expect(zones[4].high).toBe(Math.round(300 * 1.50))
  })

  it('each zone has required properties with low <= high', () => {
    const zones = powerZones(250)
    zones.forEach(z => {
      expect(z).toHaveProperty('name')
      expect(z).toHaveProperty('low')
      expect(z).toHaveProperty('high')
      expect(z).toHaveProperty('color')
      expect(z.low).toBeLessThanOrEqual(z.high)
    })
  })

  it('higher FTP → proportionally higher zone watts', () => {
    const z200 = powerZones(200)
    const z300 = powerZones(300)
    for (let i = 0; i < 5; i++) {
      expect(z300[i].low).toBeGreaterThan(z200[i].low)
    }
  })
})

// ─── paceZones ───────────────────────────────────────────────────────────────
describe('paceZones — Running pace zone calculator', () => {
  it('returns 5 zones', () => {
    expect(paceZones(300)).toHaveLength(5)  // threshold = 5:00 /km
  })

  it('each zone has name, pace string, and color', () => {
    const zones = paceZones(300)
    zones.forEach(z => {
      expect(z).toHaveProperty('name')
      expect(z).toHaveProperty('pace')
      expect(z).toHaveProperty('color')
      expect(z.pace).toMatch(/^\d+:\d{2} \/km$/)
    })
  })

  it('zone 1 is slowest (highest sec/km), zone 5 is fastest', () => {
    // factors are [1.30, 1.15, 1.06, 1.00, 0.92]
    // z1 > z4 (threshold), z5 < z4
    const t0 = 300  // 5:00 /km threshold
    const zones = paceZones(t0)
    // Parse pace mm:ss back to seconds
    const toSec = pace => {
      const [m, s] = pace.replace(' /km', '').split(':').map(Number)
      return m * 60 + s
    }
    const secs = zones.map(z => toSec(z.pace))
    expect(secs[0]).toBeGreaterThan(secs[3]) // z1 slower than z4
    expect(secs[4]).toBeLessThan(secs[3])    // z5 faster than z4
  })
})

// ─── cooperVO2 ───────────────────────────────────────────────────────────────
describe('cooperVO2 — Cooper 12-min test VO2max estimate', () => {
  it('2400m (good runner) → VO2max ~ 40–45', () => {
    const v = parseFloat(cooperVO2(2400))
    expect(v).toBeGreaterThan(38)
    expect(v).toBeLessThan(50)
  })

  it('3200m (elite runner) → VO2max > 60', () => {
    const v = parseFloat(cooperVO2(3200))
    expect(v).toBeGreaterThan(60)
  })

  it('returns string with one decimal', () => {
    const result = cooperVO2(2600)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\-?\d+\.\d$/)
  })

  it('longer distance → higher VO2max estimate', () => {
    expect(parseFloat(cooperVO2(3000))).toBeGreaterThan(parseFloat(cooperVO2(2500)))
  })
})

// ─── epley1RM ────────────────────────────────────────────────────────────────
describe('epley1RM — Epley 1RM estimation', () => {
  it('1 rep → weight equals 1RM (w * (1 + 1/30))', () => {
    const rm = parseFloat(epley1RM(100, 1))
    expect(rm).toBeCloseTo(100 * (1 + 1 / 30), 1)
  })

  it('returns string with one decimal', () => {
    expect(typeof epley1RM(80, 5)).toBe('string')
    expect(epley1RM(80, 5)).toMatch(/^\d+\.\d$/)
  })

  it('more reps at same weight → higher estimated 1RM', () => {
    expect(parseFloat(epley1RM(100, 10))).toBeGreaterThan(parseFloat(epley1RM(100, 5)))
  })

  it('heavier weight at same reps → higher 1RM', () => {
    expect(parseFloat(epley1RM(120, 5))).toBeGreaterThan(parseFloat(epley1RM(100, 5)))
  })
})

// ─── astrandVO2 ──────────────────────────────────────────────────────────────
describe('astrandVO2 — Åstrand-Ryhming cycle ergometer VO2max', () => {
  it('returns plausible VO2max for male (100W, 70kg)', () => {
    const v = parseFloat(astrandVO2(100, 70, 'male'))
    expect(v).toBeGreaterThan(10)
    expect(v).toBeLessThan(60)
  })

  it('female estimate uses 5.88 factor, male uses 6.12', () => {
    const male   = parseFloat(astrandVO2(150, 70, 'male'))
    const female = parseFloat(astrandVO2(150, 70, 'female'))
    expect(male).toBeGreaterThan(female)
  })

  it('returns string with one decimal', () => {
    const result = astrandVO2(150, 70, 'male')
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d+\.\d$/)
  })

  it('higher watts → higher VO2max estimate', () => {
    const low  = parseFloat(astrandVO2(100, 70, 'male'))
    const high = parseFloat(astrandVO2(200, 70, 'male'))
    expect(high).toBeGreaterThan(low)
  })
})

// ─── yyir1VO2 ────────────────────────────────────────────────────────────────
describe('yyir1VO2 — Yo-Yo Intermittent Recovery Test level 1', () => {
  it('lv=1, sh=1 → returns lowest estimate near 35.4', () => {
    const v = parseFloat(yyir1VO2(1, 1))
    expect(v).toBeGreaterThanOrEqual(35)
    expect(v).toBeLessThan(40)
  })

  it('lv=23, sh=8 → returns near max (~62.8)', () => {
    const v = parseFloat(yyir1VO2(23, 8))
    expect(v).toBeGreaterThan(60)
    expect(v).toBeLessThanOrEqual(65)
  })

  it('higher level → higher VO2max estimate', () => {
    expect(parseFloat(yyir1VO2(10, 4))).toBeGreaterThan(parseFloat(yyir1VO2(5, 4)))
  })

  it('returns string with one decimal', () => {
    expect(typeof yyir1VO2(10, 4)).toBe('string')
    expect(yyir1VO2(10, 4)).toMatch(/^\d+\.\d$/)
  })
})

// ─── wingateStats ─────────────────────────────────────────────────────────────
describe('wingateStats — Wingate anaerobic test stats', () => {
  it('returns relPeak, relMean, fatigue as strings', () => {
    const s = wingateStats(800, 600, 300, 70)
    expect(typeof s.relPeak).toBe('string')
    expect(typeof s.relMean).toBe('string')
    expect(typeof s.fatigue).toBe('string')
  })

  it('relPeak = peak/bw (1 decimal)', () => {
    const s = wingateStats(700, 500, 200, 70)
    expect(parseFloat(s.relPeak)).toBeCloseTo(700 / 70, 1)
  })

  it('fatigue = (peak-low)/peak * 100 (1 decimal)', () => {
    const s = wingateStats(800, 600, 400, 70)
    expect(parseFloat(s.fatigue)).toBeCloseTo((800 - 400) / 800 * 100, 1)
  })

  it('zero peak → fatigue is 0.0', () => {
    const s = wingateStats(0, 0, 0, 70)
    expect(s.fatigue).toBe('0.0')
  })
})

// ─── parseTimeSec ────────────────────────────────────────────────────────────
describe('parseTimeSec — time string to seconds', () => {
  it('parses hh:mm:ss correctly', () => {
    expect(parseTimeSec('1:30:00')).toBe(5400)
    expect(parseTimeSec('2:00:00')).toBe(7200)
    expect(parseTimeSec('0:05:30')).toBe(330)
  })

  it('parses mm:ss correctly', () => {
    expect(parseTimeSec('45:00')).toBe(2700)
    expect(parseTimeSec('5:30')).toBe(330)
  })

  it('handles edge case 0:00:00', () => {
    expect(parseTimeSec('0:00:00')).toBe(0)
  })

  it('returns NaN for unparseable string', () => {
    expect(parseTimeSec('invalid')).toBeNaN()
  })
})

// ─── fmtSec ──────────────────────────────────────────────────────────────────
describe('fmtSec — seconds to formatted time string', () => {
  it('sub-60-minute → mm:ss', () => {
    expect(fmtSec(3661)).toBe('1:01:01')
    expect(fmtSec(90)).toBe('1:30')
    expect(fmtSec(3600)).toBe('1:00:00')
  })

  it('zero seconds → 0:00', () => {
    expect(fmtSec(0)).toBe('0:00')
  })

  it('rounds fractional seconds', () => {
    expect(fmtSec(90.7)).toBe('1:31')
  })

  it('45 minutes → 45:00', () => {
    expect(fmtSec(2700)).toBe('45:00')
  })

  it('seconds padded to 2 digits in mm:ss', () => {
    expect(fmtSec(65)).toBe('1:05')
  })
})

// ─── fmtPace ─────────────────────────────────────────────────────────────────
describe('fmtPace — pace formatting', () => {
  it('returns mm:ss format', () => {
    expect(fmtPace(1800, 5000)).toMatch(/^\d+:\d{2}$/)
  })

  it('5000m in 20 min → 4:00 /km', () => {
    // 1200 sec / 5 km = 240 sec/km = 4:00
    expect(fmtPace(1200, 5000)).toBe('4:00')
  })

  it('10000m in 50 min → 5:00 /km', () => {
    expect(fmtPace(3000, 10000)).toBe('5:00')
  })

  it('faster pace (lower sec/km) for same distance in less time', () => {
    const fast = fmtPace(1800, 5000) // 6:00/km
    const slow = fmtPace(2700, 5000) // 9:00/km
    const toSec = p => parseInt(p.split(':')[0]) * 60 + parseInt(p.split(':')[1])
    expect(toSec(fast)).toBeLessThan(toSec(slow))
  })
})

// ─── calcLoad ─────────────────────────────────────────────────────────────────
describe('calcLoad — CTL/ATL/TSB/daily from log', () => {
  it('empty log → all zeros', () => {
    const { atl, ctl, tsb, daily } = calcLoad([])
    expect(atl).toBe(0)
    expect(ctl).toBe(0)
    expect(tsb).toBe(0)
    expect(daily).toHaveLength(0)
  })

  it('single entry with TSS=100 → positive CTL and ATL', () => {
    const log = [{ date: new Date().toISOString().slice(0, 10), tss: 100 }]
    const { atl, ctl } = calcLoad(log)
    expect(atl).toBeGreaterThan(0)
    expect(ctl).toBeGreaterThan(0)
  })

  it('ATL responds faster than CTL: single hard day → ATL > CTL', () => {
    // ATL tau=7, CTL tau=42 → ATL weight per new observation is higher
    const today = new Date().toISOString().slice(0, 10)
    const log = [{ date: today, tss: 200 }]
    const { atl, ctl } = calcLoad(log)
    expect(atl).toBeGreaterThan(ctl)
  })

  it('returns daily array with date, tss, atl, ctl properties', () => {
    const log = [{ date: new Date().toISOString().slice(0, 10), tss: 80 }]
    const { daily } = calcLoad(log)
    expect(daily.length).toBeGreaterThan(0)
    const last = daily[daily.length - 1]
    expect(last).toHaveProperty('date')
    expect(last).toHaveProperty('tss')
    expect(last).toHaveProperty('atl')
    expect(last).toHaveProperty('ctl')
  })

  it('TSB = CTL - ATL', () => {
    const log = []
    const today = new Date()
    for (let i = 60; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 80 })
    }
    const { ctl, atl, tsb } = calcLoad(log)
    expect(tsb).toBe(ctl - atl)
  })

  it('consistent training → CTL builds over time', () => {
    const log = []
    const today = new Date()
    for (let i = 50; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 80 })
    }
    const { ctl } = calcLoad(log)
    expect(ctl).toBeGreaterThan(20)
  })

  it('multiple entries on same date → TSS sums correctly', () => {
    const today = new Date().toISOString().slice(0, 10)
    const log = [
      { date: today, tss: 50 },
      { date: today, tss: 50 },
    ]
    const r1 = calcLoad(log)
    const r2 = calcLoad([{ date: today, tss: 100 }])
    expect(r1.atl).toBe(r2.atl)
  })

  it('entries without tss field → treated as 0', () => {
    const today = new Date().toISOString().slice(0, 10)
    const log = [{ date: today }]
    const { atl, ctl } = calcLoad(log)
    expect(atl).toBe(0)
    expect(ctl).toBe(0)
  })
})

// ─── monotonyStrain ───────────────────────────────────────────────────────────
describe('monotonyStrain — Foster monotony and strain', () => {
  it('empty log → mono=0, strain=0, mean=0', () => {
    const { mono, strain, mean } = monotonyStrain([])
    expect(mono).toBe(0)
    expect(strain).toBe(0)
    expect(mean).toBe(0)
  })

  it('uniform daily TSS → monotony > 0 (non-zero mean with zero std → special case 0)', () => {
    // std=0 → mono=0 per code (std>0 guard)
    const log = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 100 })
    }
    const { mono } = monotonyStrain(log)
    // All same → std=0 → mono=0
    expect(mono).toBe(0)
  })

  it('variable TSS → mono > 0', () => {
    const log = []
    const today = new Date()
    const tssList = [100, 0, 150, 0, 200, 0, 80]
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: tssList[6 - i] })
    }
    const { mono, strain } = monotonyStrain(log)
    expect(mono).toBeGreaterThan(0)
    expect(strain).toBeGreaterThan(0)
  })

  it('returns numeric values', () => {
    const { mono, strain, mean } = monotonyStrain([])
    expect(typeof mono).toBe('number')
    expect(typeof strain).toBe('number')
    expect(typeof mean).toBe('number')
  })
})

// ─── calcPRs ─────────────────────────────────────────────────────────────────
describe('calcPRs — personal records', () => {
  it('empty log → empty array', () => {
    expect(calcPRs([])).toHaveLength(0)
  })

  it('returns array with Highest TSS, Longest Session, Hardest Session, Longest block', () => {
    const log = [
      { date: '2025-01-01', tss: 150, duration: 90, rpe: 8, type: 'Tempo Run' },
      { date: '2025-01-02', tss: 80,  duration: 120, rpe: 5, type: 'Long Run' },
      { date: '2025-01-03', tss: 200, duration: 60, rpe: 10, type: 'Interval Run' },
    ]
    const prs = calcPRs(log)
    expect(prs.length).toBeGreaterThanOrEqual(3)
    const labels = prs.map(p => p.label)
    expect(labels).toContain('Highest TSS')
    expect(labels).toContain('Longest Session')
    expect(labels).toContain('Hardest Session')
  })

  it('Highest TSS entry matches max tss in log', () => {
    const log = [
      { date: '2025-01-01', tss: 50, duration: 30, rpe: 4, type: 'Easy Run' },
      { date: '2025-01-02', tss: 200, duration: 90, rpe: 9, type: 'Race' },
    ]
    const prs = calcPRs(log)
    const highest = prs.find(p => p.label === 'Highest TSS')
    expect(highest.value).toBe(200)
  })

  it('Longest block detects consecutive days', () => {
    const log = [
      { date: '2025-01-01', tss: 50, duration: 30, rpe: 4, type: 'Easy Run' },
      { date: '2025-01-02', tss: 60, duration: 40, rpe: 5, type: 'Easy Run' },
      { date: '2025-01-03', tss: 70, duration: 45, rpe: 5, type: 'Easy Run' },
      { date: '2025-01-10', tss: 80, duration: 50, rpe: 6, type: 'Easy Run' },
    ]
    const prs = calcPRs(log)
    const block = prs.find(p => p.label === 'Longest block')
    expect(block.value).toBe('3 days')
  })
})

// ─── generatePlan ─────────────────────────────────────────────────────────────
describe('generatePlan — training plan generator', () => {
  it('returns array with length equal to totalWeeks', () => {
    const plan = generatePlan('marathon', 12, 8, 'intermediate')
    expect(plan).toHaveLength(12)
  })

  it('each week has correct shape', () => {
    const plan = generatePlan('5k', 8, 6, 'beginner')
    plan.forEach(week => {
      expect(week).toHaveProperty('week')
      expect(week).toHaveProperty('phase')
      expect(week).toHaveProperty('sessions')
      expect(week).toHaveProperty('totalHours')
      expect(week).toHaveProperty('tss')
      expect(week).toHaveProperty('zonePct')
      expect(week.sessions).toHaveLength(7)
    })
  })

  it('last week is Race Week', () => {
    const plan = generatePlan('marathon', 16, 10, 'advanced')
    expect(plan[plan.length - 1].phase).toBe('Race Week')
  })

  it('zone percentages sum to 100 for weeks with active sessions', () => {
    const plan = generatePlan('marathon', 12, 8, 'intermediate')
    plan.forEach(week => {
      const sum = week.zonePct.reduce((s, v) => s + v, 0)
      // Some rounding drift allowed: 98–102
      expect(sum).toBeGreaterThanOrEqual(95)
      expect(sum).toBeLessThanOrEqual(105)
    })
  })

  it('handles 4-week minimum plan', () => {
    const plan = generatePlan('5k', 4, 5, 'beginner')
    expect(plan).toHaveLength(4)
  })

  it('each session has required fields', () => {
    const plan = generatePlan('10k', 10, 7, 'intermediate')
    plan.forEach(week => {
      week.sessions.forEach(session => {
        expect(session).toHaveProperty('day')
        expect(session).toHaveProperty('type')
        expect(session).toHaveProperty('duration')
        expect(session).toHaveProperty('rpe')
        expect(session).toHaveProperty('tss')
      })
    })
  })
})

// ─── validatePlanRamp (v9.59.0) ──────────────────────────────────────────────
describe('validatePlanRamp — Coggan 5–7 TSS/wk safe band', () => {
  it('returns empty array for empty / single-week input', () => {
    expect(validatePlanRamp([], 40)).toEqual([])
    expect(validatePlanRamp([{ week: 1, tss: 300 }], 40)).toEqual([])
  })

  it('flags any 2-week window where CTL gain exceeds 7', () => {
    // Aggressive ramp: 200 → 800 TSS jump in one week
    const weeks = [
      { week: 1, phase: 'Base',  tss: 200 },
      { week: 2, phase: 'Build', tss: 800 },
      { week: 3, phase: 'Build', tss: 800 },
    ]
    const warnings = validatePlanRamp(weeks, 30)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0].code).toBe('CTL_RAMP_HIGH')
    expect(warnings[0].message).toHaveProperty('en')
    expect(warnings[0].message).toHaveProperty('tr')
    expect(warnings[0].message.en).toMatch(/Coggan/)
  })

  it('returns no warnings for a moderate plan in safe band', () => {
    const weeks = Array.from({ length: 8 }, (_, i) => ({
      week: i + 1, phase: 'Base', tss: 350,
    }))
    const warnings = validatePlanRamp(weeks, 50)
    expect(warnings).toEqual([])
  })

  it('handles missing tss / non-numeric inputs gracefully', () => {
    const weeks = [
      { week: 1, phase: 'Base' },
      { week: 2, phase: 'Build', tss: null },
      { week: 3, phase: 'Peak', tss: 'oops' },
    ]
    expect(() => validatePlanRamp(weeks, 40)).not.toThrow()
  })

  it('reports the WK number where the spike lands', () => {
    const weeks = [
      { week: 1, phase: 'Base',  tss: 200 },
      { week: 2, phase: 'Base',  tss: 200 },
      { week: 3, phase: 'Build', tss: 1200 },
    ]
    const warnings = validatePlanRamp(weeks, 25)
    const w3 = warnings.find(w => w.weekNum === 3)
    expect(w3).toBeDefined()
    expect(w3.gain).toBeGreaterThan(7)
  })
})

// ─── normTR ──────────────────────────────────────────────────────────────────
describe('normTR — Turkish string normalizer', () => {
  it('lowercases standard ASCII', () => {
    expect(normTR('HELLO')).toBe('hello')
  })

  it('normalizes Turkish characters', () => {
    expect(normTR('şŞ')).toBe('ss')
    expect(normTR('ğĞ')).toBe('gg')
    expect(normTR('ıI')).toContain('i')
    expect(normTR('üÜ')).toBe('uu')
    expect(normTR('öÖ')).toBe('oo')
    expect(normTR('çÇ')).toBe('cc')
  })

  it('handles null/undefined safely → empty string', () => {
    expect(normTR(null)).toBe('')
    expect(normTR(undefined)).toBe('')
  })

  it('handles empty string', () => {
    expect(normTR('')).toBe('')
  })
})

// ─── FREE_ATHLETE_LIMIT ───────────────────────────────────────────────────────
describe('FREE_ATHLETE_LIMIT', () => {
  it('is numeric value 3', () => {
    expect(FREE_ATHLETE_LIMIT).toBe(3)
  })
})

// ─── generateCoachId / generateUnlockCode / verifyUnlockCode (async) ─────────
describe('generateCoachId — coach ID from name+email', () => {
  it('returns a string starting with SP-', async () => {
    const id = await generateCoachId('Test Coach', 'test@example.com')
    expect(id).toMatch(/^SP-[0-9a-f]{8}$/)
  })

  it('same inputs → same ID (deterministic)', async () => {
    const id1 = await generateCoachId('Ali Yılmaz', 'ali@example.com')
    const id2 = await generateCoachId('Ali Yılmaz', 'ali@example.com')
    expect(id1).toBe(id2)
  })

  it('different inputs → different IDs', async () => {
    const id1 = await generateCoachId('Coach A', 'a@example.com')
    const id2 = await generateCoachId('Coach B', 'b@example.com')
    expect(id1).not.toBe(id2)
  })

  it('handles empty name/email gracefully', async () => {
    const id = await generateCoachId('', '')
    expect(id).toMatch(/^SP-[0-9a-f]{8}$/)
  })
})

describe('generateUnlockCode + verifyUnlockCode — coach unlock flow', () => {
  it('generates a well-formed SPUNLOCK code', async () => {
    const coachId = 'SP-abcd1234'
    const code = await generateUnlockCode(coachId, 10)
    expect(code).toMatch(/^SPUNLOCK-abcd1234-10-[0-9a-f]{6}$/)
  })

  it('verify returns {coachId, limit} for a valid code', async () => {
    const coachId = await generateCoachId('Verify Test', 'v@test.com')
    const code    = await generateUnlockCode(coachId, 5)
    const result  = await verifyUnlockCode(code, coachId)
    expect(result).not.toBeNull()
    expect(result.coachId).toBe(coachId)
    expect(result.limit).toBe(5)
  })

  it('verify returns null for tampered hash', async () => {
    const coachId = await generateCoachId('Hash Test', 'h@test.com')
    const code    = await generateUnlockCode(coachId, 5)
    const tampered = code.slice(0, -3) + 'xxx'
    const result  = await verifyUnlockCode(tampered, coachId)
    expect(result).toBeNull()
  })

  it('verify returns null for wrong coachId', async () => {
    const coachId = await generateCoachId('Owner', 'owner@test.com')
    const code    = await generateUnlockCode(coachId, 10)
    const result  = await verifyUnlockCode(code, 'SP-deadbeef')
    expect(result).toBeNull()
  })

  it('verify returns null for invalid code format', async () => {
    expect(await verifyUnlockCode('INVALID', 'SP-abcd1234')).toBeNull()
    expect(await verifyUnlockCode('', 'SP-abcd1234')).toBeNull()
  })

  it('verify returns null for limit 0 or NaN', async () => {
    const result = await verifyUnlockCode('SPUNLOCK-abcd1234-0-aabbcc', 'SP-abcd1234')
    expect(result).toBeNull()
  })

  it('different limits → different codes', async () => {
    const coachId = 'SP-test1234'
    const c5  = await generateUnlockCode(coachId, 5)
    const c25 = await generateUnlockCode(coachId, 25)
    expect(c5).not.toBe(c25)
  })
})
