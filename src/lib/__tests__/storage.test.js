// @vitest-environment jsdom
// ── storage.test.js — Unit tests for src/lib/storage.js ──────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  // ── regression: non-SCHEMA sporeus keys must be backed up too ────────────────
  // injuries / race-results / training-age are migrated by dataMigration.js and
  // counted by detectLocalData, but are NOT in SCHEMA — they were silently
  // dropped from "Download Backup" when export iterated Object.keys(SCHEMA).
  it('includes sporeus keys that are not in SCHEMA (injuries, race-results, training-age)', () => {
    localStorage.setItem('sporeus-injuries',     JSON.stringify([{ type: 'hamstring' }]))
    localStorage.setItem('sporeus-race-results', JSON.stringify([{ race: '10k', time: 2400 }]))
    localStorage.setItem('sporeus-training-age', JSON.stringify(5))

    const { data } = JSON.parse(exportAllData())

    expect(data).toHaveProperty('sporeus-injuries')
    expect(data).toHaveProperty('sporeus-race-results')
    expect(data).toHaveProperty('sporeus-training-age')
    expect(data['sporeus-injuries']).toEqual([{ type: 'hamstring' }])
    expect(data['sporeus-race-results']).toEqual([{ race: '10k', time: 2400 }])
    expect(data['sporeus-training-age']).toBe(5)
  })

  it('still exports the standard SCHEMA keys', () => {
    saveStorage('sporeus_log', [{ date: '2025-03-01', tss: 50 }])
    const { data } = JSON.parse(exportAllData())
    expect(data).toHaveProperty('sporeus_log')
  })

  it('does NOT export non-sporeus keys', () => {
    localStorage.setItem('unrelated-key', JSON.stringify({ secret: 1 }))
    const { data } = JSON.parse(exportAllData())
    expect(data).not.toHaveProperty('unrelated-key')
  })

  it('round-trips non-SCHEMA keys through export → import', () => {
    localStorage.setItem('sporeus-injuries', JSON.stringify([{ type: 'achilles' }]))
    const exported = exportAllData()
    localStorage.clear()
    expect(importAllData(exported)).toBe(true)
    expect(JSON.parse(localStorage.getItem('sporeus-injuries'))).toEqual([{ type: 'achilles' }])
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

  // ── malformed payloads must be rejected (not silently "succeed") ──────────────
  it('returns false for a JSON array payload', () => {
    expect(importAllData('[1,2,3]')).toBe(false)
  })

  it('returns false for a JSON primitive payload (number)', () => {
    expect(importAllData('5')).toBe(false)
  })

  it('returns false for a JSON string payload', () => {
    expect(importAllData('"hello"')).toBe(false)
  })

  it('returns false for a JSON null payload', () => {
    expect(importAllData('null')).toBe(false)
  })

  // ── non-atomic write failure must surface as false ───────────────────────────
  it('returns false when a key fails to write (e.g. QuotaExceededError)', () => {
    const original = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
      if (k === 'sporeus-plan') { const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err }
      return original(k, v)
    })
    try {
      const payload = JSON.stringify({
        _export: true,
        data: { 'sporeus_log': [{ tss: 10 }], 'sporeus-plan': { weeks: [] } },
      })
      expect(importAllData(payload)).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  it('returns true when all keys write successfully', () => {
    const payload = JSON.stringify({
      _export: true,
      data: { 'sporeus_log': [{ tss: 10 }], 'sporeus-injuries': [] },
    })
    expect(importAllData(payload)).toBe(true)
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

})
