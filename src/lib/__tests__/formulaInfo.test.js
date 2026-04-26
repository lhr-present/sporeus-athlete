// src/lib/__tests__/formulaInfo.test.js — E71
import { describe, it, expect } from 'vitest'
import { FORMULA_INFO } from '../formulaInfo.js'

const REQUIRED_KEYS = ['ctl', 'atl', 'tsb', 'acwr', 'vdot', 'ftp', 'wkg', 'lthr']

describe('FORMULA_INFO completeness', () => {
  it('exports an object with all required metric keys', () => {
    expect(typeof FORMULA_INFO).toBe('object')
    for (const key of REQUIRED_KEYS) {
      expect(FORMULA_INFO).toHaveProperty(key)
    }
  })

  for (const key of REQUIRED_KEYS) {
    describe(`key: ${key}`, () => {
      it('has name.en and name.tr strings', () => {
        const info = FORMULA_INFO[key]
        expect(typeof info.name.en).toBe('string')
        expect(info.name.en.length).toBeGreaterThan(3)
        expect(typeof info.name.tr).toBe('string')
        expect(info.name.tr.length).toBeGreaterThan(3)
      })

      it('has a formula string', () => {
        expect(typeof FORMULA_INFO[key].formula).toBe('string')
        expect(FORMULA_INFO[key].formula.length).toBeGreaterThan(5)
      })

      it('has explanation.en and explanation.tr strings', () => {
        const info = FORMULA_INFO[key]
        expect(typeof info.explanation.en).toBe('string')
        expect(info.explanation.en.length).toBeGreaterThan(10)
        expect(typeof info.explanation.tr).toBe('string')
        expect(info.explanation.tr.length).toBeGreaterThan(10)
      })

      it('has a citation string', () => {
        expect(typeof FORMULA_INFO[key].citation).toBe('string')
        expect(FORMULA_INFO[key].citation.length).toBeGreaterThan(5)
      })

      it('has esik.en and esik.tr strings', () => {
        const info = FORMULA_INFO[key]
        expect(typeof info.esik?.en).toBe('string')
        expect(typeof info.esik?.tr).toBe('string')
      })
    })
  }

  it('no extra unexpected keys contaminate the object', () => {
    const keys = Object.keys(FORMULA_INFO)
    // Allow tss which is documented but not in the 8 required
    const allowed = new Set([...REQUIRED_KEYS, 'tss'])
    for (const k of keys) {
      expect(allowed.has(k)).toBe(true)
    }
  })
})
