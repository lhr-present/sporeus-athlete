import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getLocal, setLocal, removeLocal, clearAllAppData } from './local.js'
import { ALL_STATIC_KEYS } from './keys.js'

// Minimal localStorage stub
function makeLs() {
  const store = {}
  return {
    getItem:    k => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = v },
    removeItem: k => { delete store[k] },
    clear:      () => { for (const k in store) delete store[k] },
    _store:     store,
  }
}

beforeEach(() => {
  const ls = makeLs()
  vi.stubGlobal('localStorage', ls)
})

// ── getLocal ──────────────────────────────────────────────────────────────────
describe('getLocal', () => {
  it('returns defaultValue for missing key', () => {
    expect(getLocal('no-such-key', 42)).toBe(42)
  })

  it('returns null default when not specified', () => {
    expect(getLocal('no-such-key')).toBeNull()
  })

  it('round-trips a complex object', () => {
    localStorage.setItem('test-key', JSON.stringify({ a: 1, b: [2, 3] }))
    expect(getLocal('test-key')).toEqual({ a: 1, b: [2, 3] })
  })

  it('returns defaultValue on malformed JSON', () => {
    localStorage.setItem('bad-json', '{not valid json}')
    expect(getLocal('bad-json', 'fallback')).toBe('fallback')
  })
})

// ── setLocal ──────────────────────────────────────────────────────────────────
describe('setLocal', () => {
  it('persists a string value', () => {
    setLocal('my-key', 'hello')
    expect(JSON.parse(localStorage.getItem('my-key'))).toBe('hello')
  })

  it('persists a number value', () => {
    setLocal('num', 42)
    expect(JSON.parse(localStorage.getItem('num'))).toBe(42)
  })

  it('returns true on success', () => {
    expect(setLocal('k', 'v')).toBe(true)
  })

  it('returns false when localStorage.setItem throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded') })
    expect(setLocal('k', 'v')).toBe(false)
  })
})

// ── removeLocal ───────────────────────────────────────────────────────────────
describe('removeLocal', () => {
  it('removes an existing key', () => {
    localStorage.setItem('to-remove', '"value"')
    removeLocal('to-remove')
    expect(localStorage.getItem('to-remove')).toBeNull()
  })

  it('does not throw for non-existent key', () => {
    expect(() => removeLocal('never-existed')).not.toThrow()
  })
})

// ── clearAllAppData ───────────────────────────────────────────────────────────
describe('clearAllAppData', () => {
  it('removes all static app keys', () => {
    // Plant a value for every static key
    for (const key of ALL_STATIC_KEYS) {
      localStorage.setItem(key, '"planted"')
    }
    clearAllAppData()
    for (const key of ALL_STATIC_KEYS) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it('does not throw even when keys are absent', () => {
    expect(() => clearAllAppData()).not.toThrow()
  })
})
