// src/lib/__tests__/athlete/executionLabels.test.js
import { describe, it, expect } from 'vitest'
import { EXECUTION_LABELS, execLabel } from '../../athlete/executionLabels.js'

describe('executionLabels', () => {
  it('exposes EN+TR pairs for every translated metric prefix', () => {
    for (const k of ['header', 'duration', 'rpe', 'tss', 'hr', 'pace']) {
      expect(EXECUTION_LABELS[k]).toHaveProperty('en')
      expect(EXECUTION_LABELS[k]).toHaveProperty('tr')
    }
  })

  it('keeps vsPlan as a plain string (same in both languages)', () => {
    expect(typeof EXECUTION_LABELS.vsPlan).toBe('string')
    expect(EXECUTION_LABELS.vsPlan).toBe(' / plan ')
  })

  it('execLabel returns the requested language', () => {
    expect(execLabel('header',   'en')).toBe('◆ EXECUTION · ')
    expect(execLabel('header',   'tr')).toBe('◆ İCRA · ')
    expect(execLabel('duration', 'en')).toBe('DUR · ')
    expect(execLabel('duration', 'tr')).toBe('SÜRE · ')
    expect(execLabel('pace',     'tr')).toBe('TEMPO · ')
  })

  it('execLabel returns the string verbatim for plain-string entries', () => {
    expect(execLabel('vsPlan', 'en')).toBe(' / plan ')
    expect(execLabel('vsPlan', 'tr')).toBe(' / plan ')
  })

  it('execLabel falls back to EN when the language is missing', () => {
    expect(execLabel('header', 'de')).toBe('◆ EXECUTION · ')
  })

  it('execLabel returns empty string for unknown keys', () => {
    expect(execLabel('nope', 'en')).toBe('')
    expect(execLabel(null, 'en')).toBe('')
  })
})
