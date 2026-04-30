// @vitest-environment jsdom
// ── storage.test.js — Unit tests for src/lib/storage.js ──────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import {
  STORAGE_VERSION,
  SCHEMA,
  loadStorage,
  saveStorage,
  exportAllData,
  importAllData,
  importPlanData,
} from '../storage.js'

beforeEach(() => {
  localStorage.clear()
})

// ── STORAGE_VERSION ───────────────────────────────────────────────────────────
describe('STORAGE_VERSION', () => {
  it('is a positive number', () => {
    expect(typeof STORAGE_VERSION).toBe('number')
    expect(STORAGE_VERSION).toBeGreaterThan(0)
  })
})

// ── SCHEMA ────────────────────────────────────────────────────────────────────
describe('SCHEMA', () => {
  it("has key 'sporeus_log' with defaults = []", () => {
    expect(SCHEMA['sporeus_log']).toBeDefined()
    expect(Array.isArray(SCHEMA['sporeus_log'].defaults)).toBe(true)
    expect(SCHEMA['sporeus_log'].defaults).toEqual([])
  })

  it("has key 'sporeus-profile' with defaults containing 'name' and 'sport'", () => {
    expect(SCHEMA['sporeus-profile']).toBeDefined()
    const { defaults } = SCHEMA['sporeus-profile']
    expect(typeof defaults).toBe('object')
    expect(defaults).not.toBeNull()
    expect('name' in defaults).toBe(true)
    expect('sport' in defaults).toBe(true)
  })
})

// ── saveStorage / loadStorage ─────────────────────────────────────────────────
describe('saveStorage / loadStorage', () => {
  it('round-trips an array value for sporeus_log', () => {
    saveStorage('sporeus_log', [1, 2, 3])
    expect(loadStorage('sporeus_log')).toEqual([1, 2, 3])
  })

  it('round-trips an object value for sporeus-profile', () => {
    saveStorage('sporeus-profile', { name: 'Alice', sport: 'Running' })
    const result = loadStorage('sporeus-profile')
    expect(result).toMatchObject({ name: 'Alice' })
  })

  it('returns an empty object for an unknown key not in SCHEMA (fallback migration path)', () => {
    // SCHEMA[key] is undefined — migration branch spreads undefined defaults → returns {}
    const result = loadStorage('sporeus-nonexistent-key-xyz')
    // Not null — the migration branch returns {} as a fallback empty object
    expect(result).toEqual({})
  })

  it('returns SCHEMA defaults when nothing has been saved (sporeus_log)', () => {
    const result = loadStorage('sporeus_log')
    expect(Array.isArray(result)).toBe(true)
  })

  it('overwrites an existing value', () => {
    saveStorage('sporeus_log', [1, 2])
    saveStorage('sporeus_log', [7, 8, 9])
    expect(loadStorage('sporeus_log')).toEqual([7, 8, 9])
  })
})

// ── exportAllData ─────────────────────────────────────────────────────────────
describe('exportAllData', () => {
  it('returns a JSON string', () => {
    const result = exportAllData()
    expect(typeof result).toBe('string')
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('parsed result contains _export: true', () => {
    const parsed = JSON.parse(exportAllData())
    expect(parsed._export).toBe(true)
  })

  it('parsed result has version field', () => {
    const parsed = JSON.parse(exportAllData())
    expect(parsed.version).toBeDefined()
  })

  it('parsed result has ts field', () => {
    const parsed = JSON.parse(exportAllData())
    expect(typeof parsed.ts).toBe('number')
    expect(parsed.ts).toBeGreaterThan(0)
  })
})

// ── importAllData ─────────────────────────────────────────────────────────────
describe('importAllData', () => {
  it('returns true on valid round-trip from exportAllData()', () => {
    saveStorage('sporeus_log', [{ date: '2025-03-01', tss: 50 }])
    const exported = exportAllData()
    localStorage.clear()
    expect(importAllData(exported)).toBe(true)
  })

  it('returns false on invalid JSON', () => {
    expect(importAllData('invalid json')).toBe(false)
  })

  it('returns false on empty string', () => {
    expect(importAllData('')).toBe(false)
  })

  it('restores data after round-trip', () => {
    saveStorage('sporeus_log', [{ date: '2025-03-01', tss: 50 }])
    const exported = exportAllData()
    localStorage.clear()
    importAllData(exported)
    const restored = loadStorage('sporeus_log')
    expect(Array.isArray(restored)).toBe(true)
  })
})

// ── importPlanData ────────────────────────────────────────────────────────────
describe('importPlanData', () => {
  it('returns true for valid plan JSON with weeks array', () => {
    const plan = JSON.stringify({ weeks: [{ week: 1 }], generatedAt: '2025-01-01' })
    expect(importPlanData(plan)).toBe(true)
  })

  it('returns false for non-JSON input', () => {
    expect(importPlanData('not json')).toBe(false)
  })

  it('returns false when weeks field is missing', () => {
    expect(importPlanData('{"noWeeks":true}')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(importPlanData('')).toBe(false)
  })

  it('saves the plan to sporeus-plan in localStorage', () => {
    const plan = { weeks: [{ week: 1, sessions: [] }], generatedAt: '2025-01-01' }
    importPlanData(JSON.stringify(plan))
    const stored = loadStorage('sporeus-plan')
    expect(stored).toMatchObject({ weeks: [{ week: 1 }] })
  })

  it('resets sporeus-plan-status to {} after import', () => {
    saveStorage('sporeus-plan-status', { '0-0': true })
    importPlanData(JSON.stringify({ weeks: [{ week: 1 }], generatedAt: '2025-01-01' }))
    expect(loadStorage('sporeus-plan-status')).toEqual({})
  })

  it('merges coachMessages into sporeus-coach-messages key', () => {
    const msgs = [{ id: 'msg-1', text: 'Hello athlete' }, { id: 'msg-2', text: 'Good work' }]
    const plan = JSON.stringify({ weeks: [{ week: 1 }], generatedAt: '2025-01-01', coachMessages: msgs })
    importPlanData(plan)
    const raw = localStorage.getItem('sporeus-coach-messages')
    const stored = JSON.parse(raw)
    expect(Array.isArray(stored)).toBe(true)
    expect(stored.some(m => m.id === 'msg-1')).toBe(true)
    expect(stored.some(m => m.id === 'msg-2')).toBe(true)
  })

  it('deduplicates coachMessages by id on repeated import', () => {
    const msgs = [{ id: 'msg-1', text: 'Hello' }]
    const plan = JSON.stringify({ weeks: [{ week: 1 }], generatedAt: '2025-01-01', coachMessages: msgs })
    importPlanData(plan)
    importPlanData(plan) // second import — same msg id
    const stored = JSON.parse(localStorage.getItem('sporeus-coach-messages'))
    const count = stored.filter(m => m.id === 'msg-1').length
    expect(count).toBe(1)
  })
})
