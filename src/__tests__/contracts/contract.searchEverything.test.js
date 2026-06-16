// @vitest-environment node
// ─── Contract C6: search_everything RPC → SearchPalette component ───────────────
// Validates the RPC return shape, KIND_TAB mapping (including new athlete_session),
// and that all known kinds are handled correctly.
//
// Note: SearchPalette rendering tests live in the component test suite.
// This contract covers the data contract (shapes and mappings) only.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ── Kind constants (mirrored from SearchPalette.jsx) ──────────────────────────
const KNOWN_KINDS = ['session', 'athlete_session', 'note', 'message', 'announcement', 'athlete']
const EXPECTED_TABS = {
  session:          'log',
  athlete_session:  'log',
  note:             'coach',
  message:          'coach',
  announcement:     'coach',
  athlete:          'coach',
}

// ── RPC result shape validator ─────────────────────────────────────────────────
function isValidSearchResult(row) {
  return (
    typeof row === 'object' && row !== null &&
    KNOWN_KINDS.includes(row.kind) &&
    typeof row.record_id  === 'string' &&
    typeof row.rank       === 'number' && row.rank >= 0 &&
    typeof row.snippet    === 'string' &&
    (row.date_hint === null || typeof row.date_hint === 'string')
  )
}

describe('C6 — search_everything contract', () => {
  describe('RPC return shape validation', () => {
    it('accepts valid session result', () => {
      expect(isValidSearchResult({ kind: 'session', record_id: 'r1', rank: 0.8, snippet: 'long run felt good', date_hint: '2026-04-18' })).toBe(true)
    })

    it('accepts new athlete_session kind (v8.0.1)', () => {
      expect(isValidSearchResult({ kind: 'athlete_session', record_id: 'r2', rank: 0.7, snippet: 'interval session', date_hint: '2026-04-16' })).toBe(true)
    })

    it('accepts athlete result with null date_hint', () => {
      expect(isValidSearchResult({ kind: 'athlete', record_id: 'u1', rank: 0.9, snippet: 'Ali Yilmaz', date_hint: null })).toBe(true)
    })

    it('rejects unknown kind', () => {
      expect(isValidSearchResult({ kind: 'workout', record_id: 'r1', rank: 0.5, snippet: 'x', date_hint: null })).toBe(false)
    })

    it('rejects negative rank', () => {
      expect(isValidSearchResult({ kind: 'session', record_id: 'r1', rank: -0.1, snippet: 'x', date_hint: null })).toBe(false)
    })

    it('accepts all 6 known kinds', () => {
      for (const kind of KNOWN_KINDS) {
        expect(isValidSearchResult({
          kind, record_id: 'r1', rank: 0.5, snippet: 'test',
          date_hint: kind !== 'athlete' ? '2026-04-18' : null,
        })).toBe(true)
      }
    })
  })

  describe('KIND_TAB mapping completeness', () => {
    it('every known kind maps to a tab', () => {
      for (const kind of KNOWN_KINDS) {
        expect(EXPECTED_TABS[kind]).toBeTruthy()
      }
    })

    it('session and athlete_session both map to log tab', () => {
      expect(EXPECTED_TABS.session).toBe('log')
      expect(EXPECTED_TABS.athlete_session).toBe('log')
    })

    it('coach-facing kinds all map to coach tab', () => {
      expect(EXPECTED_TABS.note).toBe('coach')
      expect(EXPECTED_TABS.message).toBe('coach')
      expect(EXPECTED_TABS.announcement).toBe('coach')
      expect(EXPECTED_TABS.athlete).toBe('coach')
    })

    it('athlete_session was added in v8.0.1 (Bug 4 fix)', () => {
      // Regression guard: this kind must remain in KNOWN_KINDS forever
      expect(KNOWN_KINDS).toContain('athlete_session')
      expect(EXPECTED_TABS.athlete_session).toBe('log')
    })
  })

  // ── SQL ↔ client contract (the real regression guard) ───────────────────────
  // The blocks above only check client constants; that is exactly why v9.327.0
  // silently dropped athlete_session/athlete from the RPC while these stayed green.
  // This block parses the LATEST migration that (re)defines search_everything and
  // asserts the kinds the SQL actually emits == KNOWN_KINDS. A future migration that
  // drops or adds an arm now fails here.
  describe('SQL emitted kinds match the client KNOWN_KINDS', () => {
    function latestSearchEverythingKinds() {
      const dir = join(process.cwd(), 'supabase', 'migrations')
      const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
      let body = null
      for (const f of files) {
        const sql = readFileSync(join(dir, f), 'utf8')
        // Only consider migrations that define the FUNCTION BODY (not bare GRANT/REVOKE).
        if (/function\s+public\.search_everything/i.test(sql) && /RETURN QUERY|UNION ALL/i.test(sql)) {
          body = sql // keep the last (highest-sorted) one
        }
      }
      if (!body) throw new Error('no search_everything function-body migration found')
      // The kind is the first projected column of each arm: SELECT 'x'::text, ...
      const kinds = new Set()
      for (const m of body.matchAll(/SELECT\s+'([a-z_]+)'::text/gi)) kinds.add(m[1])
      return kinds
    }

    it('emits exactly the 6 known kinds (no silent drop/add)', () => {
      const sqlKinds = latestSearchEverythingKinds()
      expect([...sqlKinds].sort()).toEqual([...KNOWN_KINDS].sort())
    })

    it('SQL includes the coach arms (athlete_session + athlete)', () => {
      const sqlKinds = latestSearchEverythingKinds()
      expect(sqlKinds.has('athlete_session')).toBe(true)
      expect(sqlKinds.has('athlete')).toBe(true)
    })
  })

  describe('result set normalization', () => {
    it('all valid results in a mixed batch pass shape check', () => {
      const batch = KNOWN_KINDS.map((kind, i) => ({
        kind,
        record_id: `id-${i}`,
        rank: 0.9 - i * 0.1,
        snippet: `Sample content for ${kind}`,
        date_hint: kind !== 'athlete' ? '2026-04-18' : null,
      }))
      for (const row of batch) {
        expect(isValidSearchResult(row)).toBe(true)
      }
    })

    it('snippet is never null (empty string is acceptable)', () => {
      const row = { kind: 'session', record_id: 'r1', rank: 0.5, snippet: '', date_hint: null }
      expect(isValidSearchResult(row)).toBe(true)
    })

    it('rank=0 is valid (no match score edge case)', () => {
      expect(isValidSearchResult({ kind: 'session', record_id: 'r1', rank: 0, snippet: 'x', date_hint: null })).toBe(true)
    })
  })
})
