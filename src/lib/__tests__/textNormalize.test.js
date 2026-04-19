import { describe, it, expect } from 'vitest'
import { normalizeForSearch, tokenize } from '../textNormalize.js'

// ── normalizeForSearch — 15 cases ─────────────────────────────────────────────
describe('normalizeForSearch', () => {
  // Each Turkish diacritic lower + upper
  it('folds ı → i', () => expect(normalizeForSearch('ışık')).toBe('isik'))
  it('folds İ → i', () => expect(normalizeForSearch('İstanbul')).toBe('istanbul'))
  it('folds ş → s', () => expect(normalizeForSearch('şans')).toBe('sans'))
  it('folds Ş → s', () => expect(normalizeForSearch('Şeker')).toBe('seker'))
  it('folds ç → c', () => expect(normalizeForSearch('çalışma')).toBe('calisma'))
  it('folds Ç → c', () => expect(normalizeForSearch('Çay')).toBe('cay'))
  it('folds ğ → g', () => expect(normalizeForSearch('dağ')).toBe('dag'))
  it('folds Ğ → g', () => expect(normalizeForSearch('Ğ')).toBe('g'))
  it('folds ü → u', () => expect(normalizeForSearch('üçgen')).toBe('ucgen'))
  it('folds Ü → u', () => expect(normalizeForSearch('Üniversite')).toBe('universite'))
  it('folds ö → o', () => expect(normalizeForSearch('öğrenci')).toBe('ogrenci'))
  it('folds Ö → o', () => expect(normalizeForSearch('Özel')).toBe('ozel'))

  // Practical search terms
  it('koşu → kosu (bidirectional FTS match)', () => expect(normalizeForSearch('koşu')).toBe('kosu'))
  it('full phrase: Uzun Koşu Antrenmanı', () =>
    expect(normalizeForSearch('Uzun Koşu Antrenmanı')).toBe('uzun kosu antrenmani')
  )
  it('plain ASCII is unchanged except lowercase', () =>
    expect(normalizeForSearch('RUNNING intervals')).toBe('running intervals')
  )
  it('empty string → empty string', () => expect(normalizeForSearch('')).toBe(''))
  it('null/undefined → empty string', () => {
    expect(normalizeForSearch(null)).toBe('')
    expect(normalizeForSearch(undefined)).toBe('')
  })
  it('numbers pass through', () => expect(normalizeForSearch('zone 4')).toBe('zone 4'))
})

// ── tokenize — 5 cases ────────────────────────────────────────────────────────
describe('tokenize', () => {
  it('splits on whitespace and folds TR diacritics', () =>
    expect(tokenize('koşu antrenman')).toEqual(['kosu', 'antrenman'])
  )
  it('filters tokens shorter than 2 characters', () =>
    expect(tokenize('a interval b')).toEqual(['interval'])
  )
  it('handles extra whitespace', () =>
    expect(tokenize('  run  hill  ')).toEqual(['run', 'hill'])
  )
  it('returns empty array for empty string', () =>
    expect(tokenize('')).toEqual([])
  )
  it('lowercases ASCII tokens', () =>
    expect(tokenize('EASY RUN')).toEqual(['easy', 'run'])
  )
})
