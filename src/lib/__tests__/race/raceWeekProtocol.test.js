// E123 Race-Week Protocol — unit tests
import { describe, it, expect } from 'vitest'
import { generateRaceWeekProtocol } from '../../race/raceWeekProtocol.js'

const RACE_DATE = '2026-05-10' // arbitrary Sunday
const RACE_TYPES = ['5K', '10K', 'Half Marathon', 'Marathon', '2000m Row']

function bothBilingual(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.en === 'string' &&
    typeof obj.tr === 'string' &&
    obj.en.length > 0 &&
    obj.tr.length > 0
  )
}

describe('generateRaceWeekProtocol — shape', () => {
  it.each(RACE_TYPES)('returns 7 protocol entries for %s', (raceType) => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
    expect(out).not.toBeNull()
    expect(out.protocol).toHaveLength(7)
  })

  it.each(RACE_TYPES)('protocol entries have dayOffset -6..0 in order for %s', (raceType) => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
    const offsets = out.protocol.map((p) => p.dayOffset)
    expect(offsets).toEqual([-6, -5, -4, -3, -2, -1, 0])
  })

  it('includes citation field', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    expect(out.citation).toBe('Mujika & Padilla 2003; Bompa 2005')
  })

  it('echoes raceType and raceDate', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Marathon' })
    expect(out.raceType).toBe('Marathon')
    expect(out.raceDate).toBe(RACE_DATE)
  })
})

describe('generateRaceWeekProtocol — race day', () => {
  it.each(RACE_TYPES)('race day session intent is RACE for %s', (raceType) => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
    const raceDay = out.protocol.find((p) => p.dayOffset === 0)
    expect(raceDay.session).not.toBeNull()
    expect(raceDay.session.intent).toBe('RACE')
  })

  it('5K race-day description names the distance (en)', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '5K' })
    const raceDay = out.protocol.find((p) => p.dayOffset === 0)
    expect(raceDay.session.description.en).toMatch(/5K/)
  })

  it('Marathon race-day description names the distance (en)', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Marathon' })
    const raceDay = out.protocol.find((p) => p.dayOffset === 0)
    expect(raceDay.session.description.en).toMatch(/Marathon/)
  })
})

describe('generateRaceWeekProtocol — Friday rest day', () => {
  it.each(RACE_TYPES)('D-2 (Friday) session is null for %s', (raceType) => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
    const friday = out.protocol.find((p) => p.dayOffset === -2)
    expect(friday.session).toBeNull()
  })
})

describe('generateRaceWeekProtocol — sleep targets', () => {
  it('D-6 sleep is 8h with build-buffer note', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d6 = out.protocol.find((p) => p.dayOffset === -6)
    expect(d6.sleep.targetHours).toBe(8)
    expect(d6.sleep.note.en).toMatch(/sleep debt buffer/i)
    expect(d6.sleep.note.tr).toMatch(/uyku rezervi/i)
  })

  it('D-2 sleep is 8.5h flagged most important', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d2 = out.protocol.find((p) => p.dayOffset === -2)
    expect(d2.sleep.targetHours).toBe(8.5)
    expect(d2.sleep.note.en).toMatch(/most important/i)
  })

  it('D-1 sleep is 8h with don\'t-stress note', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d1 = out.protocol.find((p) => p.dayOffset === -1)
    expect(d1.sleep.targetHours).toBe(8)
    expect(d1.sleep.note.en).toMatch(/don'?t stress/i)
  })

  it('D-0 sleep is 7h with honor recovery note', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d0 = out.protocol.find((p) => p.dayOffset === 0)
    expect(d0.sleep.targetHours).toBe(7)
    expect(d0.sleep.note.en).toMatch(/honor recovery/i)
  })
})

describe('generateRaceWeekProtocol — nutrition cues', () => {
  it('D-6 to D-4 are normal eating', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    for (const off of [-6, -5, -4]) {
      const day = out.protocol.find((p) => p.dayOffset === off)
      expect(day.nutrition[0].en).toMatch(/Normal eating/)
    }
  })

  it('D-3 begins carb-load', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d3 = out.protocol.find((p) => p.dayOffset === -3)
    expect(d3.nutrition[0].en).toMatch(/Begin carb-load/i)
  })

  it('D-2 and D-1 are carb-load + hydration check', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    for (const off of [-2, -1]) {
      const day = out.protocol.find((p) => p.dayOffset === off)
      expect(day.nutrition[0].en).toMatch(/hydration/i)
    }
  })

  it('D-0 has race-morning fueling guidance', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d0 = out.protocol.find((p) => p.dayOffset === 0)
    expect(d0.nutrition[0].en).toMatch(/Race morning/i)
    expect(d0.nutrition[0].tr).toMatch(/Yarış sabahı/i)
  })
})

describe('generateRaceWeekProtocol — gear checklist', () => {
  it('Marathon checklist contains body glide item', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Marathon' })
    const hasGlide = out.gearChecklist.some((g) => /glide|chafe/i.test(g.en))
    expect(hasGlide).toBe(true)
  })

  it('Half Marathon checklist contains body glide item', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Half Marathon' })
    const hasGlide = out.gearChecklist.some((g) => /glide|chafe/i.test(g.en))
    expect(hasGlide).toBe(true)
  })

  it('5K and 10K checklists do NOT contain body glide item', () => {
    for (const raceType of ['5K', '10K']) {
      const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
      const hasGlide = out.gearChecklist.some((g) => /glide|chafe/i.test(g.en))
      expect(hasGlide).toBe(false)
    }
  })

  it('2000m Row checklist contains PM5 calibration item', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '2000m Row' })
    const hasPM5 = out.gearChecklist.some((g) => /PM5/.test(g.en))
    expect(hasPM5).toBe(true)
  })

  it('non-rowing race types do NOT contain PM5 calibration item', () => {
    for (const raceType of ['5K', '10K', 'Half Marathon', 'Marathon']) {
      const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
      const hasPM5 = out.gearChecklist.some((g) => /PM5/.test(g.en))
      expect(hasPM5).toBe(false)
    }
  })

  it('every gear item is bilingual', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Marathon' })
    for (const g of out.gearChecklist) {
      expect(bothBilingual(g)).toBe(true)
    }
  })
})

describe('generateRaceWeekProtocol — mental cues', () => {
  it.each([-3, -2, -1, 0])('mental cue present on D%i', (off) => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const day = out.protocol.find((p) => p.dayOffset === off)
    expect(day.mental.length).toBeGreaterThan(0)
    expect(bothBilingual(day.mental[0])).toBe(true)
  })

  it('D-3 mental cue mentions visualization', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d3 = out.protocol.find((p) => p.dayOffset === -3)
    expect(d3.mental[0].en).toMatch(/Visualize/i)
  })
})

describe('generateRaceWeekProtocol — TSS scaling with CTL', () => {
  it('CTL=100 produces higher total TSS than CTL=50', () => {
    const a = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K', currentCTL: 50 })
    const b = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K', currentCTL: 100 })
    const sumA = a.protocol.reduce((s, p) => s + (p.session?.tssTarget || 0), 0)
    const sumB = b.protocol.reduce((s, p) => s + (p.session?.tssTarget || 0), 0)
    expect(sumB).toBeGreaterThan(sumA)
  })

  it('default CTL of 50 is applied when omitted', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const explicit = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K', currentCTL: 50 })
    const sumA = out.protocol.reduce((s, p) => s + (p.session?.tssTarget || 0), 0)
    const sumB = explicit.protocol.reduce((s, p) => s + (p.session?.tssTarget || 0), 0)
    expect(sumA).toBe(sumB)
  })

  it('rest days have tssTarget implicitly 0 (session is null)', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K', currentCTL: 80 })
    const friday = out.protocol.find((p) => p.dayOffset === -2)
    expect(friday.session).toBeNull()
  })
})

describe('generateRaceWeekProtocol — invalid input', () => {
  it('invalid raceType returns null', () => {
    expect(generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '15K' })).toBeNull()
  })

  it('missing raceType returns null', () => {
    expect(generateRaceWeekProtocol({ raceDate: RACE_DATE })).toBeNull()
  })

  it('invalid raceDate returns null', () => {
    expect(generateRaceWeekProtocol({ raceDate: '2026-13-01', raceType: '10K' })).toBeNull()
  })

  it('non-ISO raceDate returns null', () => {
    expect(generateRaceWeekProtocol({ raceDate: '05/10/2026', raceType: '10K' })).toBeNull()
  })

  it('null input returns null', () => {
    expect(generateRaceWeekProtocol(null)).toBeNull()
  })

  it('undefined input returns null', () => {
    expect(generateRaceWeekProtocol(undefined)).toBeNull()
  })
})

describe('generateRaceWeekProtocol — date math', () => {
  it('every protocol entry has YYYY-MM-DD date string', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    for (const p of out.protocol) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('D-0 date matches raceDate exactly', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    const d0 = out.protocol.find((p) => p.dayOffset === 0)
    expect(d0.date).toBe(RACE_DATE)
  })

  it('D-6 date is exactly 6 days before raceDate', () => {
    const out = generateRaceWeekProtocol({ raceDate: '2026-05-10', raceType: '10K' })
    const d6 = out.protocol.find((p) => p.dayOffset === -6)
    expect(d6.date).toBe('2026-05-04')
  })

  it('dates increment by 1 day from D-6 to D-0', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '10K' })
    for (let i = 1; i < out.protocol.length; i++) {
      const prev = new Date(out.protocol[i - 1].date + 'T00:00:00Z')
      const cur  = new Date(out.protocol[i].date + 'T00:00:00Z')
      expect(cur - prev).toBe(86400000)
    }
  })

  it('handles month boundary correctly', () => {
    // race on 2026-03-03 → D-6 should be 2026-02-25
    const out = generateRaceWeekProtocol({ raceDate: '2026-03-03', raceType: '5K' })
    const d6 = out.protocol.find((p) => p.dayOffset === -6)
    expect(d6.date).toBe('2026-02-25')
  })
})

describe('generateRaceWeekProtocol — bilingual coverage', () => {
  it('every session description is bilingual', () => {
    for (const raceType of RACE_TYPES) {
      const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
      for (const p of out.protocol) {
        if (p.session) {
          expect(bothBilingual(p.session.description)).toBe(true)
        }
      }
    }
  })

  it('every sleep note is bilingual', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Marathon' })
    for (const p of out.protocol) {
      expect(bothBilingual(p.sleep.note)).toBe(true)
    }
  })

  it('every nutrition cue is bilingual', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Marathon' })
    for (const p of out.protocol) {
      for (const n of p.nutrition) {
        expect(bothBilingual(n)).toBe(true)
      }
    }
  })
})

describe('generateRaceWeekProtocol — session details', () => {
  it('non-rest sessions have rpeLow <= rpeHigh', () => {
    for (const raceType of RACE_TYPES) {
      const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
      for (const p of out.protocol) {
        if (p.session) {
          expect(p.session.rpeLow).toBeLessThanOrEqual(p.session.rpeHigh)
        }
      }
    }
  })

  it('non-rest sessions have positive duration', () => {
    for (const raceType of RACE_TYPES) {
      const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType })
      for (const p of out.protocol) {
        if (p.session) {
          expect(p.session.duration).toBeGreaterThan(0)
        }
      }
    }
  })

  it('5K Mon (D-6) session is easy 30min', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: '5K' })
    const d6 = out.protocol.find((p) => p.dayOffset === -6)
    expect(d6.session.duration).toBe(30)
    expect(d6.session.intent).toBe('easy')
  })

  it('Marathon Tue (D-5) session is at marathon pace', () => {
    const out = generateRaceWeekProtocol({ raceDate: RACE_DATE, raceType: 'Marathon' })
    const d5 = out.protocol.find((p) => p.dayOffset === -5)
    expect(d5.session.intent).toMatch(/marathon pace/i)
  })
})
