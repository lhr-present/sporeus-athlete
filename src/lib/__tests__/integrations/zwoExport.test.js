// src/lib/__tests__/integrations/zwoExport.test.js — E125 Zwift .zwo export
import { describe, it, expect } from 'vitest'
import {
  buildZwoWorkout,
  sessionToZwoWorkout,
  downloadZwoFile,
} from '../../integrations/zwoExport.js'

// ── buildZwoWorkout — required-field validation ──────────────────────────────
describe('buildZwoWorkout — validation', () => {
  it('returns errors and empty xml when name is missing', () => {
    const { xml, errors } = buildZwoWorkout({ blocks: [{ type: 'steady', durationSec: 60, power: 0.7 }] })
    expect(xml).toBe('')
    expect(errors.some(e => /name/i.test(e))).toBe(true)
  })

  it('returns errors and empty xml when blocks array is empty', () => {
    const { xml, errors } = buildZwoWorkout({ name: 'Test', blocks: [] })
    expect(xml).toBe('')
    expect(errors.some(e => /blocks/i.test(e))).toBe(true)
  })

  it('returns errors and empty xml when blocks is missing entirely', () => {
    const { xml, errors } = buildZwoWorkout({ name: 'Test' })
    expect(xml).toBe('')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('returns errors when workout is null', () => {
    const { xml, errors } = buildZwoWorkout(null)
    expect(xml).toBe('')
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ── buildZwoWorkout — XML envelope ────────────────────────────────────────────
describe('buildZwoWorkout — envelope', () => {
  const valid = {
    name: 'Sporeus Test',
    blocks: [{ type: 'steady', durationSec: 600, power: 0.75 }],
  }

  it('starts with XML declaration', () => {
    const { xml } = buildZwoWorkout(valid)
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  })

  it('contains <workout_file> root element', () => {
    const { xml } = buildZwoWorkout(valid)
    expect(xml).toContain('<workout_file>')
    expect(xml).toContain('</workout_file>')
  })

  it('defaults author to Sporeus', () => {
    const { xml } = buildZwoWorkout(valid)
    expect(xml).toContain('<author>Sporeus</author>')
  })

  it('defaults sportType to bike', () => {
    const { xml } = buildZwoWorkout(valid)
    expect(xml).toContain('<sportType>bike</sportType>')
  })

  it("emits sportType=run when sport='run'", () => {
    const { xml } = buildZwoWorkout({ ...valid, sport: 'run' })
    expect(xml).toContain('<sportType>run</sportType>')
  })

  it('falls back to bike for any non-run sport value', () => {
    const { xml } = buildZwoWorkout({ ...valid, sport: 'swim' })
    expect(xml).toContain('<sportType>bike</sportType>')
  })

  it('uses provided author when given', () => {
    const { xml } = buildZwoWorkout({ ...valid, author: 'Coach K' })
    expect(xml).toContain('<author>Coach K</author>')
  })

  it('always emits empty <tags></tags>', () => {
    const { xml } = buildZwoWorkout(valid)
    expect(xml).toContain('<tags></tags>')
  })

  it('wraps blocks inside <workout> ... </workout>', () => {
    const { xml } = buildZwoWorkout(valid)
    expect(xml).toContain('<workout>')
    expect(xml).toContain('</workout>')
  })
})

// ── buildZwoWorkout — XML escaping ────────────────────────────────────────────
describe('buildZwoWorkout — XML escaping', () => {
  it('escapes & in name', () => {
    const { xml } = buildZwoWorkout({
      name: 'Threshold & Sweetspot',
      blocks: [{ type: 'steady', durationSec: 60, power: 0.85 }],
    })
    expect(xml).toContain('Threshold &amp; Sweetspot')
    expect(xml).not.toContain('Threshold & Sweetspot')
  })

  it('escapes < > " in description', () => {
    const { xml } = buildZwoWorkout({
      name: 'Test',
      description: '<b>Hard "session"</b>',
      blocks: [{ type: 'steady', durationSec: 60, power: 0.85 }],
    })
    expect(xml).toContain('&lt;b&gt;Hard &quot;session&quot;&lt;/b&gt;')
  })
})

// ── buildZwoWorkout — block types ─────────────────────────────────────────────
describe('buildZwoWorkout — block types', () => {
  it('emits Warmup with Duration / PowerLow / PowerHigh', () => {
    const { xml } = buildZwoWorkout({
      name: 'WU',
      blocks: [{ type: 'warmup', durationSec: 600, powerLow: 0.50, powerHigh: 0.75 }],
    })
    expect(xml).toContain('<Warmup Duration="600" PowerLow="0.50" PowerHigh="0.75"/>')
  })

  it('emits Cooldown with Duration / PowerLow / PowerHigh', () => {
    const { xml } = buildZwoWorkout({
      name: 'CD',
      blocks: [{ type: 'cooldown', durationSec: 300, powerLow: 0.65, powerHigh: 0.40 }],
    })
    expect(xml).toContain('<Cooldown Duration="300" PowerLow="0.65" PowerHigh="0.40"/>')
  })

  it('emits SteadyState with Duration / Power', () => {
    const { xml } = buildZwoWorkout({
      name: 'SS',
      blocks: [{ type: 'steady', durationSec: 1200, power: 0.85 }],
    })
    expect(xml).toContain('<SteadyState Duration="1200" Power="0.85"/>')
  })

  it('emits IntervalsT with all 5 attributes', () => {
    const { xml } = buildZwoWorkout({
      name: 'INT',
      blocks: [{ type: 'intervals', repeat: 5, onSec: 180, offSec: 120, onPower: 1.05, offPower: 0.55 }],
    })
    expect(xml).toContain('<IntervalsT Repeat="5" OnDuration="180" OffDuration="120" OnPower="1.05" OffPower="0.55"/>')
  })

  it('emits FreeRide with Duration only', () => {
    const { xml } = buildZwoWorkout({
      name: 'FR',
      blocks: [{ type: 'freeride', durationSec: 600 }],
    })
    expect(xml).toContain('<FreeRide Duration="600"/>')
    expect(xml).not.toMatch(/<FreeRide[^/]*Power/)
  })

  it('emits Ramp with Duration / PowerLow / PowerHigh', () => {
    const { xml } = buildZwoWorkout({
      name: 'RAMP',
      blocks: [{ type: 'ramp', durationSec: 300, powerLow: 0.50, powerHigh: 1.00 }],
    })
    expect(xml).toContain('<Ramp Duration="300" PowerLow="0.50" PowerHigh="1.00"/>')
  })

  it('emits multiple blocks in order', () => {
    const { xml } = buildZwoWorkout({
      name: 'Combo',
      blocks: [
        { type: 'warmup', durationSec: 600, powerLow: 0.5, powerHigh: 0.75 },
        { type: 'steady', durationSec: 1200, power: 0.85 },
        { type: 'cooldown', durationSec: 300, powerLow: 0.6, powerHigh: 0.4 },
      ],
    })
    const wuIdx = xml.indexOf('<Warmup')
    const ssIdx = xml.indexOf('<SteadyState')
    const cdIdx = xml.indexOf('<Cooldown')
    expect(wuIdx).toBeGreaterThan(-1)
    expect(ssIdx).toBeGreaterThan(wuIdx)
    expect(cdIdx).toBeGreaterThan(ssIdx)
  })
})

// ── buildZwoWorkout — unknown / invalid blocks ────────────────────────────────
describe('buildZwoWorkout — unknown blocks', () => {
  it('omits unknown block type but still emits XML for valid ones', () => {
    const { xml, errors } = buildZwoWorkout({
      name: 'Mixed',
      blocks: [
        { type: 'steady', durationSec: 600, power: 0.75 },
        { type: 'rocketship', durationSec: 60 },
        { type: 'freeride', durationSec: 300 },
      ],
    })
    expect(xml).toContain('<SteadyState Duration="600" Power="0.75"/>')
    expect(xml).toContain('<FreeRide Duration="300"/>')
    expect(xml).not.toContain('rocketship')
    expect(errors.some(e => /unknown/i.test(e) && /rocketship/i.test(e))).toBe(true)
  })

  it('reports errors but emits XML when at least one block is valid', () => {
    const { xml, errors } = buildZwoWorkout({
      name: 'Mostly bad',
      blocks: [
        { type: 'unknown_a' },
        { type: 'steady', durationSec: 60, power: 0.7 },
      ],
    })
    expect(xml).toContain('<SteadyState')
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ── buildZwoWorkout — power formatting ────────────────────────────────────────
describe('buildZwoWorkout — power formatting', () => {
  it('formats power as 2-decimal FTP fraction', () => {
    const { xml } = buildZwoWorkout({
      name: 'P',
      blocks: [{ type: 'steady', durationSec: 60, power: 1 }],
    })
    expect(xml).toContain('Power="1.00"')
  })

  it('clamps powers above 2.0 to 2.00', () => {
    const { xml } = buildZwoWorkout({
      name: 'P',
      blocks: [{ type: 'steady', durationSec: 60, power: 5 }],
    })
    expect(xml).toContain('Power="2.00"')
  })

  it('clamps negative power to 0.00', () => {
    const { xml } = buildZwoWorkout({
      name: 'P',
      blocks: [{ type: 'steady', durationSec: 60, power: -1 }],
    })
    expect(xml).toContain('Power="0.00"')
  })
})

// ── sessionToZwoWorkout — intent dispatch ─────────────────────────────────────
describe('sessionToZwoWorkout — intent dispatch', () => {
  it('recovery → single steady block at 0.50 FTP, no warmup/cooldown', () => {
    const w = sessionToZwoWorkout({ intent: 'recovery', duration: 30 }, 250)
    expect(w.blocks).toHaveLength(1)
    expect(w.blocks[0].type).toBe('steady')
    expect(w.blocks[0].power).toBe(0.50)
  })

  it('long → warmup + steady@0.65 + cooldown', () => {
    const w = sessionToZwoWorkout({ intent: 'long', duration: 120 }, 250)
    expect(w.blocks.map(b => b.type)).toEqual(['warmup', 'steady', 'cooldown'])
    expect(w.blocks[1].power).toBe(0.65)
  })

  it('steady → warmup + steady@0.75 + cooldown', () => {
    const w = sessionToZwoWorkout({ intent: 'steady', duration: 60 }, 250)
    expect(w.blocks.map(b => b.type)).toEqual(['warmup', 'steady', 'cooldown'])
    expect(w.blocks[1].power).toBe(0.75)
  })

  it('tempo → warmup + steady@0.85 + cooldown', () => {
    const w = sessionToZwoWorkout({ intent: 'tempo', duration: 60 }, 250)
    expect(w.blocks.map(b => b.type)).toEqual(['warmup', 'steady', 'cooldown'])
    expect(w.blocks[1].power).toBe(0.85)
  })

  it('intervals → warmup + IntervalsT(5×3on/2off @1.05/0.55) + cooldown', () => {
    const w = sessionToZwoWorkout({ intent: 'intervals', duration: 60 }, 250)
    expect(w.blocks.map(b => b.type)).toEqual(['warmup', 'intervals', 'cooldown'])
    const it = w.blocks[1]
    expect(it.repeat).toBe(5)
    expect(it.onSec).toBe(180)
    expect(it.offSec).toBe(120)
    expect(it.onPower).toBe(1.05)
    expect(it.offPower).toBe(0.55)
  })

  it('unknown intent falls back to a freeride block', () => {
    const w = sessionToZwoWorkout({ intent: 'somethingweird', duration: 45 }, 250)
    expect(w.blocks).toHaveLength(1)
    expect(w.blocks[0].type).toBe('freeride')
  })
})

// ── sessionToZwoWorkout — duration math ───────────────────────────────────────
describe('sessionToZwoWorkout — duration math', () => {
  it('non-recovery: total block duration ≤ session.duration × 60', () => {
    const session = { intent: 'steady', duration: 60 }
    const w = sessionToZwoWorkout(session, 250)
    const totalSec = w.blocks.reduce((s, b) => s + (b.durationSec || 0), 0)
    expect(totalSec).toBeLessThanOrEqual(session.duration * 60)
  })

  it('non-recovery: warmup is 600s and cooldown is 300s', () => {
    const w = sessionToZwoWorkout({ intent: 'tempo', duration: 60 }, 250)
    expect(w.blocks[0].durationSec).toBe(600)
    expect(w.blocks[w.blocks.length - 1].durationSec).toBe(300)
  })

  it('non-recovery: main steady duration = totalSec - 900', () => {
    const w = sessionToZwoWorkout({ intent: 'steady', duration: 60 }, 250)
    expect(w.blocks[1].durationSec).toBe(60 * 60 - 900)
  })

  it('produces a valid XML through buildZwoWorkout for every intent', () => {
    const intents = ['recovery', 'long', 'steady', 'tempo', 'intervals', 'unknown']
    for (const intent of intents) {
      const w = sessionToZwoWorkout({ intent, duration: 60 }, 250)
      const { xml, errors } = buildZwoWorkout(w)
      expect(errors).toEqual([])
      expect(xml.startsWith('<?xml')).toBe(true)
    }
  })

  it('records FTP in description when supplied', () => {
    const w = sessionToZwoWorkout({ intent: 'tempo', duration: 60 }, 285)
    expect(w.description).toContain('285')
  })
})

// ── downloadZwoFile — surface check ───────────────────────────────────────────
describe('downloadZwoFile', () => {
  it('is exported as a function', () => {
    expect(typeof downloadZwoFile).toBe('function')
  })
})
