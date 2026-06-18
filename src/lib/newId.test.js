import { describe, it, expect } from 'vitest'
import { newId, isUuid } from './newId.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('newId', () => {
  it('returns a non-empty string id', () => {
    const id = newId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns a real uuid when crypto.randomUUID is present', () => {
    if (typeof globalThis.crypto?.randomUUID !== 'function') return // fallback env (some jsdom shims)
    expect(newId()).toMatch(UUID_RE)
  })

  it('returns unique values across calls', () => {
    const a = newId(), b = newId()
    expect(a).not.toBe(b)
  })
})

describe('isUuid', () => {
  it('accepts a canonical uuid', () => {
    expect(isUuid('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(true)
  })
  it('rejects a numeric id, non-uuid string, and non-strings', () => {
    expect(isUuid(1700000000000)).toBe(false)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})
