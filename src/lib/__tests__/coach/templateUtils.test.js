// src/lib/__tests__/coach/templateUtils.test.js — E5
import { describe, it, expect } from 'vitest'
import { renderTemplate, TEMPLATE_VARIABLES } from '../../coach/templateUtils.js'

describe('renderTemplate', () => {
  it('substitutes athlete_name', () => {
    expect(renderTemplate('Hi {athlete_name}!', { name: 'Ali' })).toBe('Hi Ali!')
  })

  it('substitutes last_session_tss', () => {
    expect(renderTemplate('TSS: {last_session_tss}', { lastSessionTSS: 85 })).toBe('TSS: 85')
  })

  it('substitutes week_compliance', () => {
    expect(renderTemplate('{week_compliance}% this week', { weekCompliance: 80 })).toBe('80% this week')
  })

  it('substitutes acwr with 2 decimal places', () => {
    expect(renderTemplate('ACWR: {acwr}', { acwr: 1.234 })).toBe('ACWR: 1.23')
  })

  it('substitutes tsb', () => {
    expect(renderTemplate('TSB={tsb}', { tsb: -12 })).toBe('TSB=-12')
  })

  it('missing values render as —', () => {
    const result = renderTemplate('{athlete_name} / {acwr} / {tsb}', {})
    expect(result).toBe('— / — / —')
  })

  it('null inputs return empty string', () => {
    expect(renderTemplate(null, {})).toBe('')
    expect(renderTemplate(undefined, {})).toBe('')
  })

  it('multiple occurrences of same variable all replaced', () => {
    expect(renderTemplate('{athlete_name} and {athlete_name}', { name: 'Ana' })).toBe('Ana and Ana')
  })

  it('TEMPLATE_VARIABLES list is complete and non-empty', () => {
    expect(Array.isArray(TEMPLATE_VARIABLES)).toBe(true)
    expect(TEMPLATE_VARIABLES.length).toBeGreaterThan(0)
    for (const v of TEMPLATE_VARIABLES) {
      expect(v.startsWith('{')).toBe(true)
      expect(v.endsWith('}')).toBe(true)
    }
  })
})
