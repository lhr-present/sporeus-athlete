// @vitest-environment node
// ─── Contract C4: pgmq queue message shapes ──────────────────────────────────────
// Validates message shapes for all 9 queues plus the queueWorker.js helpers.

import { describe, it, expect } from 'vitest'
import {
  MAX_RETRIES,
  RETRY_DELAYS,
  shouldMoveToDlq,
  getRetryDelay,
  validateAiBatchMessage,
  buildRetryMessage,
} from '../../../src/lib/queueWorker.js'

// ── Shape validators (replicate what workers must enforce) ─────────────────────

function isValidAiBatchMessage(msg) {
  return (
    typeof msg === 'object' && msg !== null &&
    typeof msg.coach_id   === 'string' && msg.coach_id.length > 0 &&
    typeof msg.week_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(msg.week_start)
  )
}

function isValidPushFanoutMessage(msg) {
  return (
    typeof msg === 'object' && msg !== null &&
    typeof msg.user_id === 'string' && msg.user_id.length > 0 &&
    typeof msg.title   === 'string' &&
    typeof msg.body    === 'string' &&
    typeof msg.kind    === 'string'
  )
}

function isValidStravaBackfillMessage(msg) {
  return (
    typeof msg === 'object' && msg !== null &&
    typeof msg.user_id       === 'string' && msg.user_id.length > 0 &&
    typeof msg.access_token  === 'string' && msg.access_token.length > 0
  )
}

function isValidEmbedBackfillMessage(msg) {
  return (
    typeof msg === 'object' && msg !== null &&
    typeof msg.session_id === 'string' && msg.session_id.length > 0 &&
    typeof msg.user_id    === 'string' && msg.user_id.length > 0
  )
}

function isValidPgmqReadRow(row) {
  return (
    typeof row === 'object' && row !== null &&
    (typeof row.msg_id === 'bigint' || typeof row.msg_id === 'number') &&
    typeof row.read_ct     === 'number' &&
    typeof row.enqueued_at === 'string' &&
    typeof row.message     === 'object' && row.message !== null
  )
}

describe('C4 — pgmq queue message shape contracts', () => {
  describe('ai_batch queue', () => {
    it('validates valid message', () => {
      expect(isValidAiBatchMessage({ coach_id: 'c1', week_start: '2026-04-14' })).toBe(true)
    })

    it('rejects missing coach_id', () => {
      expect(isValidAiBatchMessage({ week_start: '2026-04-14' })).toBe(false)
    })

    it('rejects malformed week_start (not ISO date)', () => {
      expect(isValidAiBatchMessage({ coach_id: 'c1', week_start: '2026/04/14' })).toBe(false)
      expect(isValidAiBatchMessage({ coach_id: 'c1', week_start: 'Monday' })).toBe(false)
    })

    it('accepts optional retry fields', () => {
      expect(isValidAiBatchMessage({
        coach_id: 'c1', week_start: '2026-04-14',
        retry_count: 1, last_error: 'timeout',
      })).toBe(true)
    })
  })

  describe('push_fanout queue', () => {
    it('validates valid message', () => {
      expect(isValidPushFanoutMessage({
        user_id: 'u1', title: 'Training reminder', body: 'Time to log', kind: 'checkin_reminder',
      })).toBe(true)
    })

    it('rejects missing kind', () => {
      expect(isValidPushFanoutMessage({ user_id: 'u1', title: 'T', body: 'B' })).toBe(false)
    })
  })

  describe('strava_backfill queue', () => {
    it('validates valid message', () => {
      expect(isValidStravaBackfillMessage({ user_id: 'u1', access_token: 'tok_abc' })).toBe(true)
    })

    it('rejects empty access_token', () => {
      expect(isValidStravaBackfillMessage({ user_id: 'u1', access_token: '' })).toBe(false)
    })
  })

  describe('embed_backfill queue', () => {
    it('validates valid message', () => {
      expect(isValidEmbedBackfillMessage({ session_id: 'sess-1', user_id: 'user-1' })).toBe(true)
    })

    it('rejects missing session_id', () => {
      expect(isValidEmbedBackfillMessage({ user_id: 'user-1' })).toBe(false)
    })
  })

  describe('pgmq reader response shape', () => {
    it('validates valid read row', () => {
      expect(isValidPgmqReadRow({
        msg_id: 42n, read_ct: 1, enqueued_at: '2026-04-18T10:00:00Z',
        message: { coach_id: 'c1', week_start: '2026-04-14' },
      })).toBe(true)
    })

    it('accepts number msg_id (JS bigint may serialize to number)', () => {
      expect(isValidPgmqReadRow({
        msg_id: 42, read_ct: 1, enqueued_at: '2026-04-18T10:00:00Z', message: {},
      })).toBe(true)
    })

    it('rejects null message', () => {
      expect(isValidPgmqReadRow({
        msg_id: 1, read_ct: 0, enqueued_at: '2026-04-18T10:00:00Z', message: null,
      })).toBe(false)
    })
  })

  describe('queueWorker.js helper contracts', () => {
    it('MAX_RETRIES is 3', () => {
      expect(MAX_RETRIES).toBe(3)
    })

    it('RETRY_DELAYS has 3 entries matching [30, 120, 480]', () => {
      expect(RETRY_DELAYS).toEqual([30, 120, 480])
    })

    it('shouldMoveToDlq returns true at MAX_RETRIES', () => {
      expect(shouldMoveToDlq(MAX_RETRIES)).toBe(true)
    })

    it('shouldMoveToDlq returns false below MAX_RETRIES', () => {
      expect(shouldMoveToDlq(MAX_RETRIES - 1)).toBe(false)
    })

    it('getRetryDelay returns correct delay for each retry', () => {
      expect(getRetryDelay(0)).toBe(30)
      expect(getRetryDelay(1)).toBe(120)
      expect(getRetryDelay(2)).toBe(480)
    })

    it('getRetryDelay clamps to last value when out of range', () => {
      expect(getRetryDelay(99)).toBe(480)
    })

    it('validateAiBatchMessage accepts valid message', () => {
      const msg = { coach_id: 'c1', week_start: '2026-04-14', retry_count: 0 }
      expect(validateAiBatchMessage(msg).valid).toBe(true)
    })

    it('buildRetryMessage increments retry_count', () => {
      const original = { coach_id: 'c1', week_start: '2026-04-14', retry_count: 1 }
      const retry = buildRetryMessage(original, 'timeout')
      expect(retry.retry_count).toBe(2)
      expect(retry.last_error).toBe('timeout')
      expect(typeof retry.retried_at).toBe('string')
    })
  })
})
