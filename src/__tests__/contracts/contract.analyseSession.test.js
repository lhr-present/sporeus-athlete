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

/** Shape analyse-session upserts into ai_insights */
function isValidInsightRow(row) {
  return (
    typeof row === 'object' && row !== null &&
    typeof row.athlete_id   === 'string' &&
    typeof row.date         === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
    typeof row.data_hash    === 'string' && row.data_hash.length > 0 &&
    ['session_analysis', 'coach_session_flag', 'weekly_digest', 'hrv', 'ftp', 'daily'].includes(row.kind) &&
    typeof row.insight_json === 'object' && row.insight_json !== null &&
    typeof row.model        === 'string'
  )
}

/** Shape of insight_json for kind='session_analysis' (from analyse-session) */
function isValidSessionAnalysisJson(json) {
  return (
    typeof json === 'object' && json !== null &&
    typeof json.text === 'string' && json.text.length > 0 &&
    Array.isArray(json.flags) &&
    typeof json.ctl  === 'number' &&
    typeof json.tsb  === 'number'
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

    it('kind must be one of the allowed values', () => {
      expect(isValidInsightRow({ ...validRow, kind: 'session_analysis' })).toBe(true)
      expect(isValidInsightRow({ ...validRow, kind: 'coach_session_flag' })).toBe(true)
      expect(isValidInsightRow({ ...validRow, kind: 'unknown_kind' })).toBe(false)
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
  })
})
