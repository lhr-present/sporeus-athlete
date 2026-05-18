import { describe, it, expect } from 'vitest'
import {
  buildRaceEquipmentChecklist,
  RACE_EQUIPMENT_CHECKLIST_CITATION,
  RACE_EQUIPMENT_CATEGORIES,
} from '../../athlete/raceEquipmentChecklist.js'

const TODAY = '2026-05-17'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('buildRaceEquipmentChecklist — pure fn', () => {
  it('returns null when no race date is set', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Running' },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('returns null when race is more than 7 days out', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Running', raceDate: isoOffset(10) },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('returns null when race is in the past', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Running', raceDate: isoOffset(-3) },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('returns the checklist when race is within 0-7 days (race day)', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Running', raceDate: isoOffset(0) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(0)
    expect(r.sport).toBe('run')
    expect(Array.isArray(r.items)).toBe(true)
  })

  it('running sport excludes cycling-only and transition-only items (no bike / helmet / transitionBag)', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Running', raceDate: isoOffset(3) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    const ids = r.items.map(i => i.id)
    expect(ids).not.toContain('bike')
    expect(ids).not.toContain('helmet')
    expect(ids).not.toContain('transitionBag')
    expect(ids).not.toContain('cycling-kit')
    // and must still have running essentials
    expect(ids).toContain('race-singlet')
    expect(ids).toContain('race-shoes')
  })

  it('cycling sport includes a helmet item', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Cycling', raceDate: isoOffset(4) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.sport).toBe('bike')
    const ids = r.items.map(i => i.id)
    expect(ids).toContain('helmet')
    expect(ids).toContain('cycling-kit')
    // cycling has no race-singlet (that's running)
    expect(ids).not.toContain('race-singlet')
  })

  it('swimming sport includes goggles + cap + swimsuit', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Swimming', raceDate: isoOffset(2) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.sport).toBe('swim')
    const ids = r.items.map(i => i.id)
    expect(ids).toContain('goggles')
    expect(ids).toContain('swim-cap')
    expect(ids).toContain('swimsuit')
    // no bike / running gear
    expect(ids).not.toContain('helmet')
    expect(ids).not.toContain('race-singlet')
  })

  it('triathlon sport is union + transition (includes transitionBag)', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Triathlon', raceDate: isoOffset(5) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.sport).toBe('triathlon')
    const ids = r.items.map(i => i.id)
    expect(ids).toContain('transitionBag')
    expect(ids).toContain('helmet')
    expect(ids).toContain('goggles')
    expect(ids).toContain('tri-suit')
    expect(ids).toContain('race-shoes')
    expect(ids).toContain('cycling-shoes')
  })

  it('every item has a bilingual { en, tr } label and a category', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Triathlon', raceDate: isoOffset(1) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    for (const item of r.items) {
      expect(typeof item.id).toBe('string')
      expect(item.id.length).toBeGreaterThan(0)
      expect(typeof item.label?.en).toBe('string')
      expect(item.label.en.length).toBeGreaterThan(0)
      expect(typeof item.label?.tr).toBe('string')
      expect(item.label.tr.length).toBeGreaterThan(0)
      expect(RACE_EQUIPMENT_CATEGORIES).toContain(item.category)
    }
  })

  it('all six categories are populated for triathlon (highest-coverage sport)', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Triathlon', raceDate: isoOffset(3) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    const cats = new Set(r.items.map(i => i.category))
    for (const cat of RACE_EQUIPMENT_CATEGORIES) {
      expect(cats.has(cat)).toBe(true)
    }
  })

  it('exports the citation constant grounding the card', () => {
    expect(RACE_EQUIPMENT_CHECKLIST_CITATION).toMatch(/Burke 2017/)
    expect(RACE_EQUIPMENT_CHECKLIST_CITATION).toMatch(/Mujika 2010/)
  })

  it('accepts nextRaceDate as a fallback (canonical raceDate getter)', () => {
    const r = buildRaceEquipmentChecklist({
      profile: { primarySport: 'Running', nextRaceDate: isoOffset(4) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(4)
    expect(r.sport).toBe('run')
  })
})
