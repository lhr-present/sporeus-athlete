// ─── src/lib/ragPrompts.js — RAG context formatting for grounded AI responses ──
// Pure functions — no DOM, no React, no network calls.
// Used by: ai-proxy (server, copy of formatting logic), SemanticSearch.jsx,
//          SquadPatternSearch.jsx for client-side citation rendering.

export const MAX_CITATIONS = 10

/**
 * Format top-k sessions into a context block for injection into Claude's system prompt.
 * Returns an empty string for empty input.
 *
 * @param {Array<{session_id:string, date:string, type:string, duration_min:number|null,
 *                tss:number|null, rpe:number|null, notes:string|null, similarity:number}>} sessions
 * @returns {string}
 */
export function formatRagContext(sessions) {
  if (!sessions || sessions.length === 0) return ''

  const capped = sessions.slice(0, MAX_CITATIONS)

  const lines = capped.map((s, i) => {
    const parts = [
      `[S${i + 1}]`,
      `date:${s.date ?? 'unknown'}`,
      `type:${s.type ?? 'unknown'}`,
      s.duration_min != null ? `${s.duration_min}min` : null,
      s.tss           != null ? `TSS:${s.tss}` : null,
      s.rpe           != null ? `RPE:${s.rpe}` : null,
      s.notes ? `notes:"${String(s.notes).slice(0, 200)}"` : null,
    ].filter(Boolean).join(' ')
    return parts
  })

  return [
    '=== ATHLETE SESSION CONTEXT (most relevant to this query) ===',
    ...lines,
    '=== END CONTEXT — cite as [S1] etc. when referencing sessions ===',
    '',
  ].join('\n')
}

/**
 * Build a lookup map from citation marker key ('S1' … 'S10') to session object.
 * Provides O(1) lookup when rendering inline citations in UI.
 *
 * @param {Array} sessions
 * @returns {Record<string, object>}
 */
export function buildCitationIndex(sessions) {
  if (!sessions || sessions.length === 0) return {}

  return sessions.slice(0, MAX_CITATIONS).reduce((acc, s, i) => {
    acc[`S${i + 1}`] = s
    return acc
  }, {})
}

/**
 * Parse a Claude response that may contain [S1]…[S10] markers, returning an
 * array of segments with citation metadata attached.
 *
 * Segments: { text: string } or { citation: true, marker: 'S1', session: object|null }
 *
 * @param {string} text — Claude's response text
 * @param {Array}  sessions — the same sessions array used when building context
 * @returns {Array<{text:string}|{citation:true, marker:string, session:object|null}>}
 */
export function injectCitations(text, sessions) {
  if (!text) return [{ text: '' }]
  const index = buildCitationIndex(sessions || [])

  // Split on [S1] … [S10] markers
  const parts = text.split(/(\[S(?:10|[1-9])\])/)

  return parts
    .filter(p => p !== '')
    .map(part => {
      const m = part.match(/^\[S(10|[1-9])\]$/)
      if (!m) return { text: part }
      const key = `S${m[1]}`
      return { citation: true, marker: key, session: index[key] ?? null }
    })
}

/**
 * Extract all unique citation markers ([S1]…[S10]) referenced in a text.
 *
 * @param {string} text
 * @returns {string[]} — e.g. ['S1', 'S3']
 */
export function extractCitationMarkers(text) {
  if (!text) return []
  const matches = [...text.matchAll(/\[S(10|[1-9])\]/g)]
  const seen = new Set()
  return matches
    .map(m => `S${m[1]}`)
    .filter(key => { if (seen.has(key)) return false; seen.add(key); return true })
}
