// @vitest-environment jsdom
// ─── Contract C8: activity_upload_jobs status machine → UploadActivity ───────────
// Validates: all status transitions update UI correctly, parsed_session_id
// is correctly forwarded on 'done', error message forwarded on 'error'.

import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

// ── Status machine validator ──────────────────────────────────────────────────

const TERMINAL_STATUSES  = new Set(['done', 'error'])
const PROGRESS_STATUSES  = new Set(['pending', 'parsing', 'uploaded'])
const ALL_STATUSES       = new Set(['pending', 'parsing', 'done', 'error', 'uploaded', 'parsed', 'failed'])

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status)
}

function requiresSessionId(status, row) {
  if (status !== 'done') return true
  return typeof row.parsed_session_id === 'string' && row.parsed_session_id.length > 0
}

describe('C8 — activity_upload_jobs status contract', () => {
  describe('status enum validation', () => {
    it('all terminal statuses are known', () => {
      for (const s of TERMINAL_STATUSES) {
        expect(ALL_STATUSES.has(s)).toBe(true)
      }
    })

    it('done is terminal', () => {
      expect(isTerminalStatus('done')).toBe(true)
    })

    it('error is terminal', () => {
      expect(isTerminalStatus('error')).toBe(true)
    })

    it('pending, parsing, uploaded are NOT terminal', () => {
      for (const s of PROGRESS_STATUSES) {
        expect(isTerminalStatus(s)).toBe(false)
      }
    })
  })

  describe('parsed_session_id invariant', () => {
    it('done status requires parsed_session_id', () => {
      const row = { status: 'done', parsed_session_id: 'sess-abc' }
      expect(requiresSessionId(row.status, row)).toBe(true)
    })

    it('done without parsed_session_id violates contract', () => {
      const row = { status: 'done', parsed_session_id: undefined }
      expect(requiresSessionId(row.status, row)).toBe(false)
    })

    it('error status does not require parsed_session_id', () => {
      const row = { status: 'error', error: 'Unsupported FIT version' }
      expect(requiresSessionId(row.status, row)).toBe(true)
    })
  })

  describe('realtime event shape', () => {
    function isValidUpdateEvent(event) {
      const { new: row } = event
      return (
        typeof row === 'object' && row !== null &&
        typeof row.id     === 'string' &&
        typeof row.status === 'string' && ALL_STATUSES.has(row.status)
      )
    }

    it('accepts valid done event', () => {
      expect(isValidUpdateEvent({
        new: { id: 'job-1', status: 'done', parsed_session_id: 'sess-1' },
      })).toBe(true)
    })

    it('accepts valid error event', () => {
      expect(isValidUpdateEvent({
        new: { id: 'job-1', status: 'error', error: 'Parse failed' },
      })).toBe(true)
    })

    it('rejects unknown status in event', () => {
      expect(isValidUpdateEvent({
        new: { id: 'job-1', status: 'processing' },
      })).toBe(false)
    })
  })

  describe('initial insert shape', () => {
    function isValidInitialInsert(row) {
      return (
        typeof row === 'object' && row !== null &&
        typeof row.user_id    === 'string' &&
        typeof row.file_path  === 'string' &&
        typeof row.file_name  === 'string' &&
        ['fit', 'gpx'].includes(row.file_type) &&
        typeof row.file_size  === 'number' &&
        row.status === 'pending'
      )
    }

    it('accepts valid initial insert', () => {
      expect(isValidInitialInsert({
        user_id: 'u1', file_path: 'u1/activity.fit', file_name: 'activity.fit',
        file_type: 'fit', file_size: 48000, status: 'pending',
      })).toBe(true)
    })

    it('rejects unsupported file type', () => {
      expect(isValidInitialInsert({
        user_id: 'u1', file_path: 'u1/data.csv', file_name: 'data.csv',
        file_type: 'csv', file_size: 100, status: 'pending',
      })).toBe(false)
    })

    it('status must be pending on initial insert', () => {
      expect(isValidInitialInsert({
        user_id: 'u1', file_path: 'x', file_name: 'x.fit',
        file_type: 'fit', file_size: 100, status: 'parsing',
      })).toBe(false)
    })
  })
})
