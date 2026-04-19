// src/lib/coach/templateUtils.js — E5: Pure template variable substitution
// Extracted from MessageTemplates.jsx so it's independently testable.

export const TEMPLATE_VARIABLES = ['{athlete_name}', '{last_session_tss}', '{week_compliance}', '{acwr}', '{tsb}']

/**
 * Substitute variables in a template body.
 * @param {string} body - template text with {variable} placeholders
 * @param {Object} athlete - { name, lastSessionTSS, weekCompliance, acwr, tsb }
 * @returns {string}
 */
export function renderTemplate(body, athlete = {}) {
  if (!body) return ''
  return body
    .replace(/{athlete_name}/g,       athlete.name            ?? '—')
    .replace(/{last_session_tss}/g,   athlete.lastSessionTSS  != null ? String(athlete.lastSessionTSS) : '—')
    .replace(/{week_compliance}/g,    athlete.weekCompliance  != null ? String(athlete.weekCompliance)  : '—')
    .replace(/{acwr}/g,               athlete.acwr            != null ? athlete.acwr.toFixed(2)          : '—')
    .replace(/{tsb}/g,                athlete.tsb             != null ? String(athlete.tsb)              : '—')
}
