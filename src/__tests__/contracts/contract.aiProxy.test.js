// @vitest-environment node
// ─── Contract C3: session_embeddings → ai-proxy RAG retrieval ──────────────────
// Validates the RAG context format, citation shape, and match_sessions response.

import { describe, it, expect } from 'vitest'

// ── Pure replicas of ai-proxy logic (for shape verification) ───────────────────

function buildRagContext(sessions) {
  return sessions.map((s, i) => [
    `[S${i + 1}]`,
    `date:${s.date}`,
    `type:${s.type || 'unknown'}`,
    s.duration_min ? `duration:${s.duration_min}min` : null,
    s.tss          ? `tss:${s.tss}` : null,
    s.rpe          ? `rpe:${s.rpe}` : null,
    s.notes        ? `notes:"${s.notes.slice(0, 200)}"` : null,
  ].filter(Boolean).join(' ')).join('\n')
}

function buildCitations(sessions) {
  return sessions.map((s, i) => ({
    marker:     `S${i + 1}`,
    session_id: s.session_id,
    date:       s.date,
    type:       s.type || 'unknown',
  }))
}

function isValidSessionMatch(row) {
  return (
    typeof row === 'object' && row !== null &&
    typeof row.session_id   === 'string' &&
    typeof row.date         === 'string' &&
    typeof row.type         === 'string' &&
    (row.duration_min === null || typeof row.duration_min === 'number') &&
    (row.tss          === null || typeof row.tss          === 'number') &&
    (row.rpe          === null || typeof row.rpe          === 'number') &&
    (row.notes        === null || typeof row.notes        === 'string') &&
    (row.similarity   === undefined || typeof row.similarity === 'number')
  )
}

const SAMPLE_SESSIONS = [
  { session_id: 's1', date: '2026-04-18', type: 'Run', duration_min: 60, tss: 78, rpe: 7, notes: 'felt strong on hills' },
  { session_id: 's2', date: '2026-04-16', type: 'Ride', duration_min: 90, tss: 95, rpe: 6, notes: null },
  { session_id: 's3', date: '2026-04-14', type: 'Swim', duration_min: 45, tss: null, rpe: 5, notes: '' },
]

describe('C3 — ai-proxy RAG retrieval contract', () => {
  describe('match_sessions_for_user response shape', () => {
    it('accepts valid session match row', () => {
      expect(isValidSessionMatch(SAMPLE_SESSIONS[0])).toBe(true)
    })

    it('accepts row with all nullable fields null', () => {
      const min = { session_id: 's4', date: '2026-04-10', type: 'Run', duration_min: null, tss: null, rpe: null, notes: null }
      expect(isValidSessionMatch(min)).toBe(true)
    })

    it('rejects row missing session_id', () => {
      expect(isValidSessionMatch({ date: '2026-04-18', type: 'Run' })).toBe(false)
    })
  })

  describe('RAG context format', () => {
    it('formats sessions as [S1]..[SN] markers', () => {
      const ctx = buildRagContext(SAMPLE_SESSIONS)
      expect(ctx).toContain('[S1]')
      expect(ctx).toContain('[S2]')
      expect(ctx).toContain('[S3]')
    })

    it('includes date, type, duration, tss, rpe when present', () => {
      const ctx = buildRagContext([SAMPLE_SESSIONS[0]])
      expect(ctx).toContain('date:2026-04-18')
      expect(ctx).toContain('type:Run')
      expect(ctx).toContain('duration:60min')
      expect(ctx).toContain('tss:78')
      expect(ctx).toContain('rpe:7')
    })

    it('includes notes when present', () => {
      const ctx = buildRagContext([SAMPLE_SESSIONS[0]])
      expect(ctx).toContain('notes:"felt strong on hills"')
    })

    it('omits notes line when null', () => {
      const ctx = buildRagContext([SAMPLE_SESSIONS[1]])
      expect(ctx).not.toContain('notes:')
    })

    it('omits tss line when null', () => {
      const ctx = buildRagContext([SAMPLE_SESSIONS[2]])
      expect(ctx).not.toContain('tss:')
    })

    it('produces empty string for empty session list', () => {
      expect(buildRagContext([])).toBe('')
    })

    it('markers go up to S10 for 10 sessions', () => {
      const ten = Array.from({ length: 10 }, (_, i) => ({
        session_id: `s${i}`, date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        type: 'Run', duration_min: 60, tss: 80, rpe: 7, notes: null,
      }))
      const ctx = buildRagContext(ten)
      expect(ctx).toContain('[S10]')
      expect(ctx).not.toContain('[S11]')
    })
  })

  describe('citation shape', () => {
    it('returns one citation per session', () => {
      const citations = buildCitations(SAMPLE_SESSIONS)
      expect(citations).toHaveLength(3)
    })

    it('citation has correct marker and session_id', () => {
      const citations = buildCitations(SAMPLE_SESSIONS)
      expect(citations[0]).toMatchObject({ marker: 'S1', session_id: 's1' })
      expect(citations[2]).toMatchObject({ marker: 'S3', session_id: 's3' })
    })

    it('empty sessions → empty citations', () => {
      expect(buildCitations([])).toEqual([])
    })
  })
})
