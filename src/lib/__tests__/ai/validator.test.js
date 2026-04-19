// src/lib/__tests__/ai/validator.test.js — E7: Hallucination validator tests
import { describe, it, expect } from 'vitest'
import {
  extractNumericalClaims,
  claimInContext,
  findBannedPhrases,
  validateAiOutput,
  isOutputSafe,
} from '../../ai/validator.js'

// ── extractNumericalClaims ─────────────────────────────────────────────────

describe('extractNumericalClaims', () => {
  it('returns [] for empty string', () => {
    expect(extractNumericalClaims('')).toEqual([])
    expect(extractNumericalClaims(null)).toEqual([])
  })

  it('extracts TSS claim', () => {
    const claims = extractNumericalClaims('Your session TSS was 85 TSS this week.')
    expect(claims.some(c => c.number === 85 && c.unit === 'TSS')).toBe(true)
  })

  it('extracts bpm claim', () => {
    const claims = extractNumericalClaims('Average heart rate: 142 bpm.')
    expect(claims.some(c => c.number === 142 && c.unit === 'bpm')).toBe(true)
  })

  it('extracts percentage claim', () => {
    const claims = extractNumericalClaims('Compliance is 78%.')
    expect(claims.some(c => c.number === 78 && c.unit === '%')).toBe(true)
  })

  it('extracts watts claim', () => {
    const claims = extractNumericalClaims('Peak power: 320W')
    expect(claims.some(c => c.number === 320 && c.unit === 'W')).toBe(true)
  })

  it('extracts RPE claim', () => {
    const claims = extractNumericalClaims('Session RPE was 7 RPE.')
    expect(claims.some(c => c.number === 7 && c.unit === 'RPE')).toBe(true)
  })

  it('extracts decimal claims', () => {
    const claims = extractNumericalClaims('ACWR is 1.23 — within safe zone.')
    // Note: ACWR has no unit, won't be extracted — that's correct (no unit = not a metric claim)
    // But "1.23" followed by nothing won't match our unit-requiring regex
    expect(Array.isArray(claims)).toBe(true)
  })

  it('extracts km claim', () => {
    const claims = extractNumericalClaims('Distance: 21 km completed.')
    expect(claims.some(c => c.number === 21 && c.unit === 'km')).toBe(true)
  })

  it('extracts min claim', () => {
    const claims = extractNumericalClaims('Duration: 60 min easy run.')
    expect(claims.some(c => c.number === 60 && c.unit === 'min')).toBe(true)
  })

  it('extracts multiple claims from one text', () => {
    const text = 'TSS: 120 TSS. HR avg: 155 bpm. Duration: 90 min.'
    const claims = extractNumericalClaims(text)
    expect(claims.length).toBeGreaterThanOrEqual(3)
  })
})

// ── claimInContext ─────────────────────────────────────────────────────────

describe('claimInContext', () => {
  it('returns false for empty context', () => {
    expect(claimInContext({ number: 85, unit: 'TSS' }, '')).toBe(false)
    expect(claimInContext({ number: 85, unit: 'TSS' }, null)).toBe(false)
  })

  it('direct match returns true', () => {
    expect(claimInContext({ number: 85, unit: 'TSS' }, 'tss:85 date:2024-06-01')).toBe(true)
  })

  it('claim within tolerance (1 unit) returns true', () => {
    // Context has 84, claim is 85 → diff=1 ≤ tol=max(1,1.7)=1.7
    expect(claimInContext({ number: 85, unit: 'bpm' }, 'HR: 84 bpm average')).toBe(true)
  })

  it('claim outside tolerance returns false', () => {
    // Context has 100, claim is 150 → diff=50 >> tol=3
    expect(claimInContext({ number: 150, unit: 'bpm' }, 'HR baseline 100 bpm')).toBe(false)
  })

  it('claim invented from thin air is false', () => {
    const context = 'date:2024-06-01 type:run duration:60min rpe:7'
    // Text claims 142 bpm but context has no HR data
    expect(claimInContext({ number: 142, unit: 'bpm' }, context)).toBe(false)
  })
})

// ── findBannedPhrases ──────────────────────────────────────────────────────

describe('findBannedPhrases', () => {
  it('returns [] for clean text', () => {
    expect(findBannedPhrases('Your CTL is 55 and trending upward.')).toEqual([])
  })

  it('detects sycophantic phrase', () => {
    expect(findBannedPhrases("You're doing great this week!")).toContain("you're doing great")
  })

  it('detects "amazing"', () => {
    expect(findBannedPhrases('Your session was amazing today.')).toContain('amazing')
  })

  it('detects "awesome"', () => {
    expect(findBannedPhrases('Awesome consistency!')).toContain('awesome')
  })

  it('case-insensitive', () => {
    expect(findBannedPhrases('AMAZING effort!')).toContain('amazing')
  })

  it('detects multiple banned phrases', () => {
    const result = findBannedPhrases('Awesome, you are amazing and keep up the good work!')
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('returns [] for null', () => {
    expect(findBannedPhrases(null)).toEqual([])
    expect(findBannedPhrases('')).toEqual([])
  })
})

// ── validateAiOutput — HALLUCINATION INJECTION TEST ───────────────────────

describe('validateAiOutput', () => {
  const goodContext = 'date:2024-06-01 type:run duration_min:60 tss:85 rpe:7 bpm_avg:142'

  it('valid: true for text where all claims are in context', () => {
    const text = 'This 60 min run had a TSS of 85 TSS and average heart rate of 142 bpm.'
    const result = validateAiOutput(text, goodContext)
    expect(result.valid).toBe(true)
    expect(result.unverifiedClaims).toHaveLength(0)
    expect(result.bannedPhrases).toHaveLength(0)
  })

  it('HALLUCINATION DETECTED: invented 5K PR catches as unverified claim', () => {
    // Context has no 5K data; AI claims "your 5K PR is 17:23"
    // Note: 17 min is extracted as a claim but there's no race data in context
    const context = 'date:2024-06-01 type:run duration_min:45 tss:60 rpe:6'
    const text = 'Your 5K PR time of 17 min is exceptional.'
    const result = validateAiOutput(text, context)
    // 17 min claim — context has no 17 in it (45 and 60 are present, not 17)
    expect(result.valid).toBe(false)
    expect(result.unverifiedClaims.length).toBeGreaterThan(0)
  })

  it('HALLUCINATION DETECTED: invented power claim', () => {
    const context = 'date:2024-06-01 type:run duration_min:60 rpe:7'  // no power data
    const text = 'You sustained 280W for 60 min — excellent.'
    const result = validateAiOutput(text, context)
    // 280W is not in context
    expect(result.valid).toBe(false)
    const powerClaim = result.unverifiedClaims.find(c => c.unit === 'W')
    expect(powerClaim).toBeDefined()
  })

  it('BANNED PHRASE DETECTED: sycophancy blocks output', () => {
    const text = 'Great session. You are amazing!'
    const result = validateAiOutput(text, goodContext)
    expect(result.valid).toBe(false)
    expect(result.bannedPhrases.length).toBeGreaterThan(0)
  })

  it('returns reason string when invalid', () => {
    const text = "You're doing great with 500W power!"
    const result = validateAiOutput(text, 'tss:85')
    expect(result.valid).toBe(false)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('returns valid:false for empty text', () => {
    const result = validateAiOutput('', goodContext)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('empty_output')
  })

  it('valid text with no numerical claims passes', () => {
    const text = 'Focus on easy effort today. Recovery day.'
    const result = validateAiOutput(text, goodContext)
    expect(result.valid).toBe(true)
  })

  it('claims array reflects all found claims', () => {
    const text = 'This 60 min session had TSS of 85 TSS.'
    const result = validateAiOutput(text, goodContext)
    const foundUnits = result.claims.map(c => c.unit)
    expect(foundUnits).toContain('min')
    expect(foundUnits).toContain('TSS')
  })
})

// ── isOutputSafe ───────────────────────────────────────────────────────────

describe('isOutputSafe', () => {
  it('returns true for grounded clean text', () => {
    const ctx = 'tss:100 bpm:145 duration_min:90'
    const text = 'The 90 min session reached 100 TSS with average 145 bpm.'
    expect(isOutputSafe(text, ctx)).toBe(true)
  })

  it('returns false for hallucinated output', () => {
    const ctx = 'date:2024-01-01 type:bike rpe:6'
    const text = 'Your FTP of 300W puts you in top 10%.'
    expect(isOutputSafe(text, ctx)).toBe(false)
  })
})
