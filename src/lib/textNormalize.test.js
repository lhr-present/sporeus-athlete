import { describe, it, expect } from 'vitest'
import { normalizeForSearch, tokenize } from './textNormalize.js'

describe('normalizeForSearch', () => {
  it('lowercases ASCII', () => {
    expect(normalizeForSearch('Hello World')).toBe('hello world')
  })

  it('folds ı → i', () => {
    expect(normalizeForSearch('ıspanak')).toBe('ispanak')
  })

  it('folds İ → i', () => {
    expect(normalizeForSearch('İstanbul')).toBe('istanbul')
  })

  it('folds ş → s', () => {
    expect(normalizeForSearch('koşu')).toBe('kosu')
  })

  it('folds Ş → s', () => {
    expect(normalizeForSearch('ŞEHİR')).toBe('sehir')
  })

  it('folds ç → c', () => {
    expect(normalizeForSearch('çalış')).toBe('calis')
  })

  it('folds ğ → g', () => {
    expect(normalizeForSearch('dağ')).toBe('dag')
  })

  it('folds ü → u', () => {
    expect(normalizeForSearch('üzüm')).toBe('uzum')
  })

  it('folds ö → o', () => {
    expect(normalizeForSearch('öğretmen')).toBe('ogretmen')
  })

  it('handles mixed TR+EN', () => {
    expect(normalizeForSearch('Tempo koşu 12km')).toBe('tempo kosu 12km')
  })

  it('handles null/undefined gracefully', () => {
    expect(normalizeForSearch(null)).toBe('')
    expect(normalizeForSearch(undefined)).toBe('')
  })

  it('handles empty string', () => {
    expect(normalizeForSearch('')).toBe('')
  })

  it('preserves digits and punctuation', () => {
    expect(normalizeForSearch('Z4 @ 200W — 45min')).toBe('z4 @ 200w — 45min')
  })

  it('round-trip: search term matches content after fold', () => {
    const query   = normalizeForSearch('koşu')   // 'kosu'
    const content = normalizeForSearch('KOŞU')   // 'kosu'
    expect(query).toBe(content)
  })

  it('folds Ç → c', () => {
    expect(normalizeForSearch('ÇARŞAMBA')).toBe('carsamba')
  })

  it('folds Ğ → g', () => {
    expect(normalizeForSearch('ĞUĞUK')).toBe('guguk')
  })

  it('folds Ü → u', () => {
    expect(normalizeForSearch('ÜNLÜ')).toBe('unlu')
  })
})

describe('tokenize', () => {
  it('splits on whitespace and filters short tokens', () => {
    const tokens = tokenize('run Z4 interval')
    expect(tokens).toContain('run')
    expect(tokens).toContain('interval')
    // 'Z4' → 'z4' (length 2, kept)
    expect(tokens).toContain('z4')
  })

  it('folds Turkish in tokens', () => {
    const tokens = tokenize('koşu antrenmanı')
    expect(tokens).toContain('kosu')
    expect(tokens).toContain('antrenmani')
  })

  it('returns empty array for short input', () => {
    expect(tokenize('a')).toEqual([])
  })
})
