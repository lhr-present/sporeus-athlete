// src/lib/__tests__/ai/hash.test.js
import { describe, it, expect } from 'vitest'
import { createHash } from '../../../lib/ai/prompts/hash.js'

const HEX_RE = /^[0-9a-f]{8}$/

describe('createHash', () => {
  it('returns an 8-char hex string for a normal input', () => {
    expect(createHash('hello')).toMatch(HEX_RE)
  })

  it('is deterministic — same input produces same output', () => {
    expect(createHash('hello')).toBe(createHash('hello'))
  })

  it('produces different hashes for different inputs', () => {
    expect(createHash('hello')).not.toBe(createHash('world'))
  })

  it('returns an 8-char hex string for empty string', () => {
    expect(createHash('')).toMatch(HEX_RE)
  })

  it('return type is string', () => {
    expect(typeof createHash('test')).toBe('string')
  })

  it('returns an 8-char hex string for a long input (1000 chars)', () => {
    expect(createHash('x'.repeat(1000))).toMatch(HEX_RE)
  })

  it('return value is always exactly 8 characters', () => {
    expect(createHash('hello')).toHaveLength(8)
    expect(createHash('')).toHaveLength(8)
    expect(createHash('x'.repeat(500))).toHaveLength(8)
  })

  it('hashes of adjacent strings are different', () => {
    expect(createHash('abc')).not.toBe(createHash('abd'))
  })

  it('hash of a single character is valid 8-char hex', () => {
    expect(createHash('a')).toMatch(HEX_RE)
  })

  it('multiple calls with the same long input are stable', () => {
    const long = 'sporeus'.repeat(200)
    expect(createHash(long)).toBe(createHash(long))
  })
})
