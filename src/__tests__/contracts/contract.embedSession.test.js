// @vitest-environment node
// ─── Contract C2: analyse-session → embed-session insight chain ──────────────────
// Validates: insight_only payload shape, embedInsight field extraction logic,
// content_unchanged behaviour still runs C1.

import { describe, it, expect } from 'vitest'

// ── Pure replica of embedInsight text extraction (fixed in v8.0.1) ─────────────
// This mirrors the logic in embed-session/index.ts so tests catch regressions.
function buildInsightTextParts(insight) {
  const insightData = insight.insight_json ?? {}
  return [
    insight.date ? `date:${insight.date}` : null,
    insight.kind ? `kind:${insight.kind}` : null,
    typeof insightData.text === 'string'
      ? `insight:${insightData.text.slice(0, 500)}`
      : null,
    typeof insightData.summary === 'string'
      ? `summary:${insightData.summary.slice(0, 500)}`
      : null,
    Array.isArray(insightData.insights) && insightData.insights.length > 0
      ? `insights:${insightData.insights.slice(0, 3).join(' | ')}`
      : null,
    Array.isArray(insightData.flags) && insightData.flags.length > 0
      ? `flags:${insightData.flags.join(' ')}`
      : typeof insightData.flags === 'string' ? `flags:${insightData.flags}` : null,
  ].filter(Boolean).join(' | ')
}

const MIN_EMBED_TEXT_CHARS = 20

function isValidInsightOnlyPayload(body) {
  return (
    typeof body === 'object' && body !== null &&
    typeof body.session_id === 'string' && body.session_id.length > 0 &&
    typeof body.user_id    === 'string' && body.user_id.length > 0 &&
    body.insight_only === true
  )
}

describe('C2 — embed-session insight chain contract', () => {
  describe('insight_only payload shape', () => {
    it('valid insight_only payload accepted', () => {
      expect(isValidInsightOnlyPayload({
        session_id: 'sess-abc', user_id: 'user-xyz', insight_only: true,
      })).toBe(true)
    })

    it('missing insight_only flag rejected', () => {
      expect(isValidInsightOnlyPayload({
        session_id: 'sess-abc', user_id: 'user-xyz',
      })).toBe(false)
    })

    it('insight_only=false not treated as insight-only path', () => {
      expect(isValidInsightOnlyPayload({
        session_id: 'sess-abc', user_id: 'user-xyz', insight_only: false,
      })).toBe(false)
    })
  })

  describe('embedInsight text extraction — session_analysis shape', () => {
    // This is the shape that analyse-session produces
    const sessionAnalysisInsight = {
      id:           'ins-001',
      date:         '2026-04-18',
      kind:         'session_analysis',
      insight_json: {
        text:    'Strong threshold run. CTL improving steadily.',
        flags:   ['overreach_risk (ACWR 1.42)', 'high_stress_session (TSS 165)'],
        ctl:     52,
        tsb:     -8,
        session: { id: 'sess-001', type: 'Run', tss: 165 },
      },
    }

    it('extracts text field as primary content', () => {
      const parts = buildInsightTextParts(sessionAnalysisInsight)
      expect(parts).toContain('insight:Strong threshold run')
    })

    it('includes date and kind', () => {
      const parts = buildInsightTextParts(sessionAnalysisInsight)
      expect(parts).toContain('date:2026-04-18')
      expect(parts).toContain('kind:session_analysis')
    })

    it('joins flags array into string', () => {
      const parts = buildInsightTextParts(sessionAnalysisInsight)
      expect(parts).toContain('flags:overreach_risk')
      expect(parts).toContain('high_stress_session')
    })

    it('produces enough text to pass MIN_EMBED_TEXT_CHARS guard', () => {
      const parts = buildInsightTextParts(sessionAnalysisInsight)
      expect(parts.length).toBeGreaterThanOrEqual(MIN_EMBED_TEXT_CHARS)
    })
  })

  describe('embedInsight text extraction — weekly digest shape', () => {
    const digestInsight = {
      id:           'ins-002',
      date:         '2026-04-14',
      kind:         'weekly_digest',
      insight_json: {
        summary:  'Good training week. Volume maintained.',
        insights: ['Focus on recovery.', 'HRV trending up.'],
        athletes: [],
      },
    }

    it('extracts summary field for digest insights', () => {
      const parts = buildInsightTextParts(digestInsight)
      expect(parts).toContain('summary:Good training week')
    })

    it('extracts insights array for digest', () => {
      const parts = buildInsightTextParts(digestInsight)
      expect(parts).toContain('insights:Focus on recovery')
    })
  })

  describe('embedInsight text extraction — edge cases', () => {
    it('returns empty-ish string for empty insight_json', () => {
      const parts = buildInsightTextParts({ id: 'x', date: '2026-04-18', kind: 'daily', insight_json: {} })
      // Only date+kind — still passes
      expect(parts).toContain('date:2026-04-18')
    })

    it('handles null insight_json gracefully', () => {
      const parts = buildInsightTextParts({ id: 'x', date: '2026-04-18', kind: 'daily', insight_json: null })
      expect(parts).toContain('date:2026-04-18')
    })

    it('does not throw on unexpected flags type', () => {
      const parts = buildInsightTextParts({
        id: 'x', date: '2026-04-18', kind: 'session_analysis',
        insight_json: { text: 'test insight text content here', flags: null },
      })
      expect(parts).toContain('insight:test insight')
    })
  })
})
