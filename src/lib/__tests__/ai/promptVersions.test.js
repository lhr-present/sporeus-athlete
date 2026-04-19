// src/lib/__tests__/ai/promptVersions.test.js — E7: Prompt versioning tests
import { describe, it, expect } from 'vitest'
import { getPrompt, getPromptVariant, promptVersionSha, SURFACES } from '../../ai/prompts/v1.js'
import { createHash } from '../../ai/prompts/hash.js'

// ── createHash (djb2) ──────────────────────────────────────────────────────

describe('createHash', () => {
  it('returns 8-char hex string', () => {
    const h = createHash('hello')
    expect(h).toMatch(/^[0-9a-f]{8}$/)
  })
  it('is deterministic (same input → same output)', () => {
    expect(createHash('sporeus')).toBe(createHash('sporeus'))
  })
  it('different inputs produce different hashes', () => {
    expect(createHash('v1')).not.toBe(createHash('v2'))
  })
})

// ── promptVersionSha ───────────────────────────────────────────────────────

describe('promptVersionSha', () => {
  it('starts with v1:', () => {
    const sha = promptVersionSha('analyse_session', 'some prompt')
    expect(sha.startsWith('v1:')).toBe(true)
  })
  it('is deterministic', () => {
    const a = promptVersionSha('weekly_digest', 'prompt text')
    const b = promptVersionSha('weekly_digest', 'prompt text')
    expect(a).toBe(b)
  })
  it('changes when prompt text changes', () => {
    const a = promptVersionSha('ask_coach', 'version 1 text')
    const b = promptVersionSha('ask_coach', 'version 2 text')
    expect(a).not.toBe(b)
  })
})

// ── getPrompt ──────────────────────────────────────────────────────────────

describe('getPrompt', () => {
  it('returns system and version for all defined surfaces', () => {
    for (const surface of SURFACES) {
      const result = getPrompt(surface)
      expect(typeof result.system).toBe('string')
      expect(result.system.length).toBeGreaterThan(50)
      expect(typeof result.version).toBe('string')
      expect(result.version).toMatch(/^v1:[0-9a-f]{8}$/)
    }
  })

  it('throws for unknown surface', () => {
    expect(() => getPrompt('nonexistent_surface')).toThrow()
  })

  it('English prompt does not contain Turkish keyword (dil tutarlılığı)', () => {
    const { system } = getPrompt('analyse_session', { lang: 'en' })
    // The lang directive should say English, not Turkish
    expect(system).toContain('English')
    expect(system).not.toContain('Türkçe')
  })

  it('Turkish prompt contains Turkish directive', () => {
    const { system } = getPrompt('analyse_session', { lang: 'tr' })
    expect(system).toContain('Türkçe')
  })

  it('version sha differs between en and tr variants (prompts are different)', () => {
    const en = getPrompt('analyse_session', { lang: 'en' })
    const tr = getPrompt('analyse_session', { lang: 'tr' })
    expect(en.version).not.toBe(tr.version)
  })

  it('every prompt contains anti-sycophancy rules', () => {
    for (const surface of SURFACES) {
      const { system } = getPrompt(surface)
      // All prompts should have at least one rule about data grounding or tone
      const hasGuard = system.includes('Only') || system.includes('only') ||
                       system.includes('RULES') || system.includes('Never') ||
                       system.includes('never') || system.includes('Do not')
      expect(hasGuard, `Surface ${surface} is missing guardrail rules`).toBe(true)
    }
  })
})

// ── getPromptVariant ───────────────────────────────────────────────────────

describe('getPromptVariant', () => {
  it('returns v1 for all users (A/B disabled by default)', () => {
    expect(getPromptVariant('analyse_session', 'user-001')).toBe('v1')
    expect(getPromptVariant('weekly_digest', 'user-abc')).toBe('v1')
  })
})

// ── SURFACES list ──────────────────────────────────────────────────────────

describe('SURFACES', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(SURFACES)).toBe(true)
    expect(SURFACES.length).toBeGreaterThanOrEqual(5)
    for (const s of SURFACES) expect(typeof s).toBe('string')
  })
  it('includes the 6 expected surfaces', () => {
    const expected = ['analyse_session','weekly_digest','ask_coach','generate_plan','squad_pattern_search','morning_briefing']
    for (const s of expected) expect(SURFACES).toContain(s)
  })
})
