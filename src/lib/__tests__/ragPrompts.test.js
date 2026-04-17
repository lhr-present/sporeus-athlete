// ─── ragPrompts.test.js — Unit tests for RAG context formatting ───────────────
import { describe, it, expect } from 'vitest'
import {
  formatRagContext,
  buildCitationIndex,
  injectCitations,
  extractCitationMarkers,
  MAX_CITATIONS,
} from '../ragPrompts.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeSession = (i, overrides = {}) => ({
  session_id:   `sess-${i}`,
  date:         `2026-0${(i % 9) + 1}-15`,
  type:         'run',
  duration_min: 60 + i,
  tss:          50 + i * 5,
  rpe:          7,
  notes:        `Training session ${i}`,
  similarity:   0.9 - i * 0.05,
  ...overrides,
})

const five  = Array.from({ length: 5 },  (_, i) => makeSession(i + 1))
const ten   = Array.from({ length: 10 }, (_, i) => makeSession(i + 1))
const twelve = Array.from({ length: 12 }, (_, i) => makeSession(i + 1))

// ── formatRagContext ──────────────────────────────────────────────────────────

describe('formatRagContext', () => {
  it('returns empty string for empty input', () => {
    expect(formatRagContext([])).toBe('')
    expect(formatRagContext(null)).toBe('')
    expect(formatRagContext(undefined)).toBe('')
  })

  it('produces [S1] through [S5] for 5 sessions', () => {
    const ctx = formatRagContext(five)
    expect(ctx).toContain('[S1]')
    expect(ctx).toContain('[S5]')
    expect(ctx).not.toContain('[S6]')
  })

  it('caps at MAX_CITATIONS (10) even when given 12 sessions', () => {
    const ctx = formatRagContext(twelve)
    expect(ctx).toContain(`[S${MAX_CITATIONS}]`)
    expect(ctx).not.toContain(`[S${MAX_CITATIONS + 1}]`)
  })

  it('includes session date and type in output', () => {
    const ctx = formatRagContext([makeSession(1)])
    expect(ctx).toContain('date:2026')
    expect(ctx).toContain('type:run')
  })

  it('includes TSS and RPE when present', () => {
    const ctx = formatRagContext([makeSession(1)])
    expect(ctx).toContain('TSS:')
    expect(ctx).toContain('RPE:')
  })

  it('omits null optional fields gracefully', () => {
    const session = makeSession(1, { duration_min: null, tss: null, rpe: null, notes: null })
    const ctx = formatRagContext([session])
    expect(ctx).toContain('[S1]')
    expect(ctx).not.toContain('min')  // duration omitted
    expect(ctx).not.toContain('TSS:')
  })

  it('truncates long notes to 200 chars', () => {
    const longNotes = 'x'.repeat(500)
    const ctx = formatRagContext([makeSession(1, { notes: longNotes })])
    // notes in context: "notes:\"xxx...\"" — should contain the first 200 chars
    const notesMatch = ctx.match(/notes:"([^"]+)"/)
    expect(notesMatch).not.toBeNull()
    expect(notesMatch[1].length).toBeLessThanOrEqual(200)
  })

  it('includes header and footer markers', () => {
    const ctx = formatRagContext(five)
    expect(ctx).toContain('ATHLETE SESSION CONTEXT')
    expect(ctx).toContain('END CONTEXT')
  })
})

// ── buildCitationIndex ────────────────────────────────────────────────────────

describe('buildCitationIndex', () => {
  it('returns empty object for empty sessions', () => {
    expect(buildCitationIndex([])).toEqual({})
    expect(buildCitationIndex(null)).toEqual({})
  })

  it('builds correct S1..Sn keys', () => {
    const index = buildCitationIndex(five)
    expect(Object.keys(index)).toHaveLength(5)
    expect(index['S1']).toMatchObject({ session_id: 'sess-1' })
    expect(index['S5']).toMatchObject({ session_id: 'sess-5' })
  })

  it('caps at MAX_CITATIONS', () => {
    const index = buildCitationIndex(twelve)
    expect(Object.keys(index)).toHaveLength(MAX_CITATIONS)
    expect(index[`S${MAX_CITATIONS}`]).toBeDefined()
    expect(index[`S${MAX_CITATIONS + 1}`]).toBeUndefined()
  })

  it('preserves all session fields', () => {
    const index = buildCitationIndex([makeSession(3)])
    expect(index['S1'].tss).toBe(65)
    expect(index['S1'].type).toBe('run')
  })
})

// ── injectCitations ───────────────────────────────────────────────────────────

describe('injectCitations', () => {
  it('returns single text segment for text without markers', () => {
    const segments = injectCitations('No markers here.', five)
    expect(segments).toEqual([{ text: 'No markers here.' }])
  })

  it('returns empty text for falsy input', () => {
    const segments = injectCitations('', [])
    expect(segments).toEqual([{ text: '' }])
    const nil = injectCitations(null, [])
    expect(nil).toEqual([{ text: '' }])
  })

  it('splits text on [S1] and attaches session', () => {
    const text = 'Last week [S1] you ran well [S2] despite fatigue.'
    const segments = injectCitations(text, five)
    const citations = segments.filter(s => 'citation' in s)
    expect(citations).toHaveLength(2)
    expect(citations[0]).toMatchObject({ citation: true, marker: 'S1', session: five[0] })
    expect(citations[1]).toMatchObject({ citation: true, marker: 'S2', session: five[1] })
  })

  it('sets session to null for out-of-range marker', () => {
    const text = 'See [S9] for context'
    const segments = injectCitations(text, five)  // only 5 sessions → S9 not in index
    const cite = segments.find(s => 'citation' in s)
    expect(cite.session).toBeNull()
  })

  it('handles [S10] correctly (two-digit marker)', () => {
    const text = 'Best session was [S10].'
    const segments = injectCitations(text, ten)
    const cite = segments.find(s => 'citation' in s)
    expect(cite).toMatchObject({ marker: 'S10', session: ten[9] })
  })

  it('does not create false positives for [S11] or [S0]', () => {
    const text = '[S0] and [S11] should not parse'
    const segments = injectCitations(text, ten)
    const citations = segments.filter(s => 'citation' in s)
    expect(citations).toHaveLength(0)
  })
})

// ── Cost guard — RAG context is token-efficient vs raw flat dump ──────────────

describe('RAG cost guard', () => {
  it('formatRagContext(50 sessions) uses ≤60% chars vs raw JSON of all 50', () => {
    // Simulate a user with 50 sessions, each with substantial notes
    const fifty = Array.from({ length: 50 }, (_, i) =>
      makeSession(i + 1, { notes: `Training note for session ${i + 1}. HR was elevated and power dropped slightly. Focus next time on pacing.` })
    )

    // RAG context: capped at MAX_CITATIONS (10) with notes truncated to 200 chars
    const ragContext = formatRagContext(fifty)

    // Naive non-RAG approach: dump all 50 sessions as raw JSON
    const rawFlatDump = fifty.map(s => JSON.stringify(s)).join('\n')

    // RAG should use ≤ 60% of raw dump size (token proxy = character count)
    expect(ragContext.length).toBeLessThan(rawFlatDump.length * 0.60)
  })

  it('formatRagContext caps at MAX_CITATIONS regardless of input size', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => makeSession(i + 1))
    const ctx = formatRagContext(hundred)
    // Only [S1]–[S10] should appear
    expect(ctx).toContain('[S10]')
    expect(ctx).not.toContain('[S11]')
    // Session 11 data should not appear
    expect(ctx).not.toContain(`sess-11`)
  })
})

// ── extractCitationMarkers ────────────────────────────────────────────────────

describe('extractCitationMarkers', () => {
  it('returns empty array for text with no markers', () => {
    expect(extractCitationMarkers('')).toEqual([])
    expect(extractCitationMarkers(null)).toEqual([])
    expect(extractCitationMarkers('no markers here')).toEqual([])
  })

  it('extracts unique markers in order of first appearance', () => {
    const text = 'Based on [S3] and [S1], then [S3] again.'
    const markers = extractCitationMarkers(text)
    expect(markers).toEqual(['S3', 'S1'])  // S3 appears first, deduped
  })

  it('handles [S10] in extraction', () => {
    const text = 'Compare [S10] with [S1]'
    expect(extractCitationMarkers(text)).toEqual(['S10', 'S1'])
  })
})
