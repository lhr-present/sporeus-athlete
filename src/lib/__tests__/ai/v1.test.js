// src/lib/__tests__/ai/v1.test.js
import { describe, it, expect } from 'vitest'
import {
  VERSION,
  SURFACES,
  getPrompt,
  getPromptVariant,
  promptVersionSha,
} from '../../../lib/ai/prompts/v1.js'

describe('VERSION', () => {
  it('is the string "v1"', () => {
    expect(VERSION).toBe('v1')
  })
})

describe('SURFACES', () => {
  it('is an array', () => {
    expect(Array.isArray(SURFACES)).toBe(true)
  })

  it('has at least one element', () => {
    expect(SURFACES.length).toBeGreaterThanOrEqual(1)
  })

  it('contains "analyse_session"', () => {
    expect(SURFACES).toContain('analyse_session')
  })

  it('contains only strings', () => {
    expect(SURFACES.every(s => typeof s === 'string')).toBe(true)
  })
})

describe('getPrompt', () => {
  it('returns { system, version } shape for "analyse_session"', () => {
    const result = getPrompt('analyse_session')
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('version')
    expect(typeof result.system).toBe('string')
    expect(typeof result.version).toBe('string')
  })

  it('system string is non-empty for "analyse_session"', () => {
    const { system } = getPrompt('analyse_session')
    expect(system.length).toBeGreaterThan(0)
  })

  it('lang=tr → system contains "Turkish" or "Türkçe"', () => {
    const { system } = getPrompt('analyse_session', { lang: 'tr' })
    expect(system).toMatch(/Turkish|Türkçe/)
  })

  it('lang=en → system contains "English"', () => {
    const { system } = getPrompt('analyse_session', { lang: 'en' })
    expect(system).toContain('English')
  })

  it('throws on unknown surface', () => {
    expect(() => getPrompt('nonexistent_surface')).toThrow()
  })

  it('every surface returns non-null without throwing', () => {
    for (const surface of SURFACES) {
      expect(() => getPrompt(surface)).not.toThrow()
      const result = getPrompt(surface)
      expect(result).not.toBeNull()
    }
  })

  it('version field starts with "v1:"', () => {
    const { version } = getPrompt('analyse_session')
    expect(version).toMatch(/^v1:/)
  })

  it('returns different system text for different surfaces', () => {
    const a = getPrompt('analyse_session')
    const b = getPrompt('weekly_digest')
    expect(a.system).not.toBe(b.system)
  })
})

describe('getPromptVariant', () => {
  it('returns a string without throwing', () => {
    const result = getPromptVariant('analyse_session', 'user123')
    expect(typeof result).toBe('string')
  })

  it('returns "v1" for any surface/user combination', () => {
    expect(getPromptVariant('analyse_session', 'abc')).toBe('v1')
    expect(getPromptVariant('weekly_digest', 'xyz')).toBe('v1')
  })
})

describe('promptVersionSha', () => {
  it('returns a string', () => {
    expect(typeof promptVersionSha('analyse_session', 'some prompt text')).toBe('string')
  })

  it('starts with "v1:" and has content after the colon', () => {
    const sha = promptVersionSha('analyse_session', 'text')
    expect(sha).toMatch(/^v1:.+/)
  })

  it('is deterministic', () => {
    const a = promptVersionSha('analyse_session', 'text')
    const b = promptVersionSha('analyse_session', 'text')
    expect(a).toBe(b)
  })

  it('differs for different inputs', () => {
    const a = promptVersionSha('analyse_session', 'text')
    const b = promptVersionSha('weekly_digest', 'text')
    expect(a).not.toBe(b)
  })
})
