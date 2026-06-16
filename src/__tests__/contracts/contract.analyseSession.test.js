// @vitest-environment node
// ─── Contract C1: training_log INSERT → analyse-session webhook payload ─────────
// Validates the webhook payload shape and analyse-session output shape (ai_insights
// row) that consumers downstream (embed-session C1, useInsightNotifier) depend on.

import { describe, it, expect } from 'vitest'

// ── Payload shapes ─────────────────────────────────────────────────────────────

/** Shape the DB trigger sends to analyse-session */
function isValidWebhookPayload(p) {
  return (
    typeof p === 'object' && p !== null &&
    typeof p.session_id === 'string' && p.session_id.length > 0 &&
    typeof p.user_id    === 'string' && p.user_id.length > 0 &&
    p.source === 'db_webhook'
  )
}

/**
 * Shape analyse-session upserts into ai_insights.
 * Real producer (supabase/functions/analyse-session/index.ts) writes EXACTLY two
 * kinds: 'session_analysis' (upsert, line 214) and 'coach_session_flag' (coach
 * mirror, line 262). It NEVER writes 'weekly_digest', 'hrv', 'ftp', or 'daily' —
 * the old allow-list accepted kinds this producer can't emit (round-3 drift).
 * Narrowed to the kinds analyse-session actually emits.
 */
const ANALYSE_SESSION_KINDS = ['session_analysis', 'coach_session_flag']

function isValidInsightRow(row) {
  return (
    typeof row === 'object' && row !== null &&
    typeof row.athlete_id   === 'string' &&
    typeof row.date         === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
    typeof row.data_hash    === 'string' && row.data_hash.length > 0 &&
    ANALYSE_SESSION_KINDS.includes(row.kind) &&
    typeof row.insight_json === 'object' && row.insight_json !== null &&
    typeof row.model        === 'string'
  )
}

/**
 * Shape of insight_json for kind='session_analysis' (from analyse-session, line 220):
 *   { text, flags, session: { id, type, tss }, acwr, ctl, tsb }
 * `acwr` is part of the real shape (number | null when CTL=0) and downstream
 * consumers read it, so the contract must assert it — not just text/flags/ctl/tsb.
 */
function isValidSessionAnalysisJson(json) {
  return (
    typeof json === 'object' && json !== null &&
    typeof json.text === 'string' && json.text.length > 0 &&
    Array.isArray(json.flags) &&
    typeof json.ctl  === 'number' &&
    typeof json.tsb  === 'number' &&
    (json.acwr === null || typeof json.acwr === 'number') &&
    typeof json.session === 'object' && json.session !== null
  )
}

describe('C1 — analyse-session webhook payload contract', () => {
  describe('webhook payload shape', () => {
    it('accepts valid webhook payload', () => {
      const payload = { session_id: 'abc-123', user_id: 'user-456', source: 'db_webhook' }
      expect(isValidWebhookPayload(payload)).toBe(true)
    })

    it('rejects payload missing session_id', () => {
      expect(isValidWebhookPayload({ user_id: 'u', source: 'db_webhook' })).toBe(false)
    })

    it('rejects payload missing user_id', () => {
      expect(isValidWebhookPayload({ session_id: 's', source: 'db_webhook' })).toBe(false)
    })

    it('rejects payload with wrong source', () => {
      expect(isValidWebhookPayload({ session_id: 's', user_id: 'u', source: 'client' })).toBe(false)
    })

    it('rejects null payload', () => {
      expect(isValidWebhookPayload(null)).toBe(false)
    })
  })

  describe('ai_insights output row', () => {
    const validRow = {
      athlete_id:   'user-123',
      date:         '2026-04-18',
      data_hash:    'session_analysis-abc',
      kind:         'session_analysis',
      session_id:   'abc-123',
      source_id:    'abc-123',
      insight_json: { text: 'Good aerobic session. TSS in range.', flags: [], ctl: 45, tsb: -3, acwr: 1.1, session: {} },
      model:        'claude-haiku-4-5-20251001',
    }

    it('valid row passes shape check', () => {
      expect(isValidInsightRow(validRow)).toBe(true)
    })

    it('date must be YYYY-MM-DD format', () => {
      expect(isValidInsightRow({ ...validRow, date: '2026/04/18' })).toBe(false)
      expect(isValidInsightRow({ ...validRow, date: '' })).toBe(false)
    })

    it('kind must be one analyse-session actually emits', () => {
      expect(isValidInsightRow({ ...validRow, kind: 'session_analysis' })).toBe(true)
      expect(isValidInsightRow({ ...validRow, kind: 'coach_session_flag' })).toBe(true)
      expect(isValidInsightRow({ ...validRow, kind: 'unknown_kind' })).toBe(false)
    })

    it('rejects kinds analyse-session never writes', () => {
      // These were accepted by the old over-broad allow-list but this producer
      // never emits them (they come from other edge fns / consumers).
      for (const kind of ['weekly_digest', 'hrv', 'ftp', 'daily']) {
        expect(isValidInsightRow({ ...validRow, kind })).toBe(false)
      }
    })
  })

  describe('insight_json (session_analysis) shape', () => {
    const validJson = {
      text:    'Good session. Aerobic base work at appropriate load.',
      flags:   ['overreach_risk (ACWR 1.42)'],
      ctl:     48.5,
      tsb:     -6.2,
      acwr:    1.1,
      session: { id: 'abc', type: 'Run', tss: 85 },
    }

    it('valid insight_json passes shape check', () => {
      expect(isValidSessionAnalysisJson(validJson)).toBe(true)
    })

    it('text field is required and non-empty', () => {
      expect(isValidSessionAnalysisJson({ ...validJson, text: '' })).toBe(false)
      expect(isValidSessionAnalysisJson({ ...validJson, text: undefined })).toBe(false)
    })

    it('flags must be an array', () => {
      expect(isValidSessionAnalysisJson({ ...validJson, flags: 'some flag' })).toBe(false)
      expect(isValidSessionAnalysisJson({ ...validJson, flags: [] })).toBe(true)
    })

    it('flags can be empty (no issues detected)', () => {
      expect(isValidSessionAnalysisJson({ ...validJson, flags: [] })).toBe(true)
    })

    it('acwr is part of the real shape (number, or null when CTL=0)', () => {
      expect(validJson.acwr).toBeDefined()
      expect(isValidSessionAnalysisJson({ ...validJson, acwr: 1.42 })).toBe(true)
      expect(isValidSessionAnalysisJson({ ...validJson, acwr: null })).toBe(true)  // CTL=0 → acwr null in producer
      expect(isValidSessionAnalysisJson({ ...validJson, acwr: '1.1' })).toBe(false)
    })

    it('session sub-object is required (producer always writes session:{id,type,tss})', () => {
      expect(isValidSessionAnalysisJson({ ...validJson, session: undefined })).toBe(false)
    })
  })
})
