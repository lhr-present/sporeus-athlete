// timeInZone — unit tests
import { describe, it, expect } from 'vitest'
import {
  detectTimeInZone,
  TIME_IN_ZONE_CITATION,
} from '../../athlete/timeInZone.js'

const TODAY = '2026-05-05'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build N daily entries ending at `today`, each with an array-shaped zones row
function makeLog(count, today, zonesArr) {
  const log = []
  for (let i = count - 1; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      zones: zonesArr.slice(),
      type: 'run',
    })
  }
  return log
}

describe('detectTimeInZone — empty / null', () => {
  it('null log → reliable=false, all zeros', () => {
    const r = detectTimeInZone(null, TODAY)
    expect(r.totalMinutes).toBe(0)
    expect(r.minutesPerZone).toEqual([0, 0, 0, 0, 0])
    expect(r.sharePerZone).toEqual([0, 0, 0, 0, 0])
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe(TIME_IN_ZONE_CITATION)
  })

  it('empty array → reliable=false, all zeros', () => {
    const r = detectTimeInZone([], TODAY)
    expect(r.totalMinutes).toBe(0)
    expect(r.reliable).toBe(false)
  })
})

describe('detectTimeInZone — reliability flag', () => {
  it('totalMinutes < 200 → reliable=false', () => {
    const log = makeLog(3, TODAY, [10, 20, 5, 5, 5]) // 3 * 45 = 135
    const r = detectTimeInZone(log, TODAY)
    expect(r.totalMinutes).toBeLessThan(200)
    expect(r.reliable).toBe(false)
  })

  it('totalMinutes >= 200 → reliable=true (boundary)', () => {
    const log = makeLog(4, TODAY, [10, 30, 5, 3, 2]) // 4 * 50 = 200
    const r = detectTimeInZone(log, TODAY)
    expect(r.totalMinutes).toBe(200)
    expect(r.reliable).toBe(true)
  })

  it('reliable flag flips at totalMinutes>=200', () => {
    const below = makeLog(3, TODAY, [10, 30, 5, 3, 2]) // 150
    const at    = makeLog(4, TODAY, [10, 30, 5, 3, 2]) // 200
    expect(detectTimeInZone(below, TODAY).reliable).toBe(false)
    expect(detectTimeInZone(at, TODAY).reliable).toBe(true)
  })
})

describe('detectTimeInZone — polarized-perfect 28d fixture', () => {
  it('all zones on-target, good band', () => {
    const log = makeLog(28, TODAY, [28, 56, 7, 7, 4])
    const r = detectTimeInZone(log, TODAY)
    expect(r.band).toBe('good')
    for (const b of r.byZone) expect(b.status).toBe('on-target')
    expect(r.worstZone).toBeNull()
  })

  it('default scaled targets sum approximately to totalMinutes (within 5%)', () => {
    const log = makeLog(28, TODAY, [28, 56, 7, 7, 4])
    const r = detectTimeInZone(log, TODAY)
    const tSum = r.targets.Z1 + r.targets.Z2 + r.targets.Z3 + r.targets.Z4 + r.targets.Z5
    expect(Math.abs(tSum - r.totalMinutes) / r.totalMinutes).toBeLessThan(0.05)
  })
})

describe('detectTimeInZone — band classification', () => {
  it('single zone over → moderate band with that zone in worstZone', () => {
    // Use literal targets so a single deviating zone is isolated
    const log = makeLog(28, TODAY, [10, 30, 30, 5, 3]) // Z3 ~840 min
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    expect(r.band).toBe('moderate')
    expect(r.worstZone).not.toBeNull()
    expect(r.worstZone.zone).toBe('Z3')
    expect(r.worstZone.status).toBe('over')
  })

  it('3 zones off-target → poor band', () => {
    const log = makeLog(28, TODAY, [0, 30, 30, 30, 0]) // Z1, Z3 over, Z4 over, Z5 zero
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    expect(r.band).toBe('poor')
  })

  it('byZone status correct for each zone in mixed fixture', () => {
    const log = makeLog(28, TODAY, [10, 30, 30, 5, 3])
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    const byZ = Object.fromEntries(r.byZone.map(b => [b.zone, b.status]))
    expect(byZ.Z3).toBe('over')
    expect(byZ.Z2).toBe('on-target')
  })

  it('worstZone null when good band', () => {
    const log = makeLog(28, TODAY, [28, 56, 7, 7, 4])
    const r = detectTimeInZone(log, TODAY)
    expect(r.worstZone).toBeNull()
  })

  it('worstZone identifies max abs delta', () => {
    // Z1 under by ~280, Z3 over by ~640 → worst is Z3
    const log = makeLog(28, TODAY, [0, 30, 30, 5, 3])
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    expect(r.worstZone.zone).toBe('Z3')
  })
})

describe('detectTimeInZone — custom targets', () => {
  it('respects literal targets passed via 3rd arg', () => {
    const log = makeLog(28, TODAY, [10, 20, 5, 3, 2])
    const customTargets = { Z1: 100, Z2: 200, Z3: 50, Z4: 50, Z5: 25 }
    const r = detectTimeInZone(log, TODAY, customTargets)
    expect(r.targets).toEqual(customTargets)
  })

  it('targets with zone=0: status=on-target if minutes=0', () => {
    const log = makeLog(28, TODAY, [10, 50, 5, 0, 0])
    const targets = { Z1: 280, Z2: 1400, Z3: 140, Z4: 0, Z5: 0 }
    const r = detectTimeInZone(log, TODAY, targets)
    const z4 = r.byZone.find(b => b.zone === 'Z4')
    const z5 = r.byZone.find(b => b.zone === 'Z5')
    expect(z4.status).toBe('on-target')
    expect(z5.status).toBe('on-target')
    expect(z4.ratioToTarget).toBeNull()
  })

  it('targets with zone=0 but minutes>0: status=over', () => {
    const log = makeLog(28, TODAY, [10, 50, 5, 5, 5])
    const targets = { Z1: 280, Z2: 1400, Z3: 140, Z4: 0, Z5: 0 }
    const r = detectTimeInZone(log, TODAY, targets)
    const z4 = r.byZone.find(b => b.zone === 'Z4')
    expect(z4.status).toBe('over')
    expect(z4.ratioToTarget).toBeNull()
  })

  it('ratioToTarget null when target=0', () => {
    const log = makeLog(28, TODAY, [10, 50, 5, 0, 0])
    const r = detectTimeInZone(log, TODAY, { Z1: 280, Z2: 1400, Z3: 140, Z4: 0, Z5: 0 })
    const z4 = r.byZone.find(b => b.zone === 'Z4')
    expect(z4.ratioToTarget).toBeNull()
  })
})

describe('detectTimeInZone — zone shape parsing', () => {
  it('array zone shape parsing', () => {
    const log = makeLog(28, TODAY, [28, 56, 7, 7, 4])
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[1]).toBe(56 * 28)
  })

  it('object {Z1..Z5} zone shape parsing', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({
        date: addDays(TODAY, -i),
        zones: { Z1: 28, Z2: 56, Z3: 7, Z4: 7, Z5: 4 },
        type: 'run',
      })
    }
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[1]).toBe(56 * 28)
    expect(r.band).toBe('good')
  })

  it('object {z1..z5} zone shape parsing (lowercase)', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({
        date: addDays(TODAY, -i),
        zones: { z1: 28, z2: 56, z3: 7, z4: 7, z5: 4 },
        type: 'run',
      })
    }
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[1]).toBe(56 * 28)
    expect(r.band).toBe('good')
  })
})

describe('detectTimeInZone — RPE fallback', () => {
  it('rpe=5 with no zones → Z2 (default)', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({ date: addDays(TODAY, -i), duration: 30, rpe: 5, type: 'run' })
    }
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[1]).toBe(30 * 28)
    expect(r.minutesPerZone[0]).toBe(0)
  })

  it('no rpe with duration → Z2 default (RPE 5)', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({ date: addDays(TODAY, -i), duration: 30, type: 'run' })
    }
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[1]).toBe(30 * 28)
  })

  it('rpe=3 → Z1 boundary', () => {
    const log = [{ date: TODAY, duration: 60, rpe: 3, type: 'run' }]
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[0]).toBe(60)
  })

  it('rpe=8 → Z4 boundary', () => {
    const log = [{ date: TODAY, duration: 60, rpe: 8, type: 'run' }]
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[3]).toBe(60)
  })

  it('rpe=9 → Z5 boundary', () => {
    const log = [{ date: TODAY, duration: 60, rpe: 9, type: 'run' }]
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[4]).toBe(60)
  })

  it('entry with no zones AND no duration is skipped', () => {
    const log = [
      { date: TODAY, type: 'run' }, // skipped
      { date: TODAY, duration: 60, rpe: 5, type: 'run' },
    ]
    const r = detectTimeInZone(log, TODAY)
    expect(r.totalMinutes).toBe(60)
  })
})

describe('detectTimeInZone — windowing & aggregation', () => {
  it('multiple entries same date sum minutes', () => {
    const log = [
      { date: TODAY, zones: [10, 20, 5, 5, 5], type: 'run' },
      { date: TODAY, zones: [5, 10, 0, 0, 0], type: 'run' },
    ]
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[0]).toBe(15)
    expect(r.minutesPerZone[1]).toBe(30)
    expect(r.totalMinutes).toBe(60)
  })

  it('entries outside 28d window excluded', () => {
    const log = [
      { date: addDays(TODAY, -28), zones: [0, 0, 0, 0, 1000], type: 'run' }, // out
      { date: addDays(TODAY, -27), zones: [0, 60, 0, 0, 0], type: 'run' },   // in
      { date: TODAY,               zones: [0, 60, 0, 0, 0], type: 'run' },
    ]
    const r = detectTimeInZone(log, TODAY)
    expect(r.minutesPerZone[4]).toBe(0)
    expect(r.minutesPerZone[1]).toBe(120)
  })

  it('options.today override deterministic', () => {
    const log = [
      { date: '2026-05-05', zones: [0, 60, 0, 0, 0], type: 'run' },
      { date: '2026-06-10', zones: [0, 60, 0, 0, 0], type: 'run' },
    ]
    const r = detectTimeInZone(log, '2026-05-05')
    // Only the May 5 entry falls in window
    expect(r.minutesPerZone[1]).toBe(60)
  })
})

describe('detectTimeInZone — invariants', () => {
  it('byZone array length 5 always (Z1..Z5)', () => {
    const r1 = detectTimeInZone(null, TODAY)
    expect(r1.byZone.length).toBe(5)
    expect(r1.byZone.map(b => b.zone)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
    const r2 = detectTimeInZone(makeLog(28, TODAY, [28, 56, 7, 7, 4]), TODAY)
    expect(r2.byZone.length).toBe(5)
    expect(r2.byZone.map(b => b.zone)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
  })

  it('citation present', () => {
    const r = detectTimeInZone(makeLog(28, TODAY, [28, 56, 7, 7, 4]), TODAY)
    expect(r.citation).toBe('Seiler 2010 polarized; Stöggl & Sperlich 2014')
  })
})

describe('detectTimeInZone — bilingual messages', () => {
  it('moderate message substitutes {zone} and {direction} (en + tr)', () => {
    const log = makeLog(28, TODAY, [10, 30, 30, 5, 3])
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    expect(r.band).toBe('moderate')
    expect(r.message.en).toContain('Z3')
    expect(r.message.en).toContain('over')
    expect(r.message.tr).toContain('Z3')
    expect(r.message.tr).toContain('üstünde')
  })

  it('moderate over → reduce recommendation includes {abs_delta}', () => {
    const log = makeLog(28, TODAY, [10, 30, 30, 5, 3])
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    const absDelta = Math.abs(r.worstZone.deltaMin)
    expect(r.recommendation.en).toContain(`${absDelta} minutes`)
    expect(r.recommendation.tr).toContain(`${absDelta} dakika`)
    expect(r.recommendation.en).toContain('Reduce')
    expect(r.recommendation.tr).toContain('azalt')
  })

  it('moderate under → add recommendation includes {target_min}', () => {
    // Z5 well under literal target; rest near target
    const log = makeLog(28, TODAY, [10, 30, 7, 5, 0])
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    expect(r.band).toBe('moderate')
    expect(r.worstZone.zone).toBe('Z5')
    expect(r.recommendation.en).toMatch(/Add \d+ minutes of Z5/)
    expect(r.recommendation.tr).toMatch(/Bu hafta \d+ dakika Z5 ekle/)
  })

  it('good band → empty recommendation', () => {
    const log = makeLog(28, TODAY, [28, 56, 7, 7, 4])
    const r = detectTimeInZone(log, TODAY)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('poor band → multiple-zones message in both languages', () => {
    const log = makeLog(28, TODAY, [0, 30, 30, 30, 0])
    const targets = { Z1: 280, Z2: 840, Z3: 200, Z4: 140, Z5: 84 }
    const r = detectTimeInZone(log, TODAY, targets)
    expect(r.band).toBe('poor')
    expect(r.message.en).toMatch(/Multiple zones/)
    expect(r.message.tr).toMatch(/Birden fazla bölge/)
    expect(r.recommendation.en).toMatch(/Rebalance/)
    expect(r.recommendation.tr).toMatch(/dengele/)
  })
})
