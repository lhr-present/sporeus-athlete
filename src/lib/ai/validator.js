// src/lib/ai/validator.js — E7: Hallucination defense
// Pure function — validates AI-generated text against the source data context
// that was provided to the model.
//
// STRATEGY:
//   1. Extract numerical claims from the output text (regex: "[0-9]+(\\.[0-9]+)?([%,bpm,W,km,mi,TSS,RPE,min])")
//   2. For each claim, verify it appears in the provided input_context
//   3. Flag the output if any claim cannot be traced to the context
//   4. Banned phrases check — sycophantic filler degrades trust in science coaching
//
// USAGE:
//   const result = validateAiOutput(text, inputContext)
//   if (!result.valid) { show "Analysis unavailable — please retry"; logFailure(result) }

// Banned sycophantic phrases — exact lowercase matches or substrings
const BANNED_PHRASES = [
  "you're doing great",
  "keep up the good work",
  "amazing",
  "awesome",
  "you're amazing",
  "great job",
  "well done",
  "fantastic",
]

/**
 * Extract all numerical claims from an AI output string.
 * Returns an array of {raw, number, unit} objects.
 * @param {string} text
 * @returns {Array<{raw:string, number:number, unit:string}>}
 */
export function extractNumericalClaims(text) {
  if (!text) return []
  const claims = []
  // Match patterns like: "85 TSS", "142 bpm", "78%", "250W", "21.1 km"
  const rx = /\b(\d+(?:\.\d+)?)\s*(TSS|RPE|bpm|W(?:\/kg)?|km|mi|%|min)(?=\b|[^a-zA-Z]|$)/g
  let m
  while ((m = rx.exec(text)) !== null) {
    claims.push({
      raw:    m[0],
      number: parseFloat(m[1]),
      unit:   m[2],
    })
  }
  return claims
}

/**
 * Check whether a numerical claim (number + unit) appears in the context string.
 * Uses a tolerance of ±1 for integer values, ±2% for larger values.
 * @param {{number:number, unit:string}} claim
 * @param {string} context  - the input_context string sent to the model
 * @returns {boolean}
 */
export function claimInContext(claim, context) {
  if (!context) return false
  // Direct substring check — if the exact number string appears with the same unit
  const directRx = new RegExp(String(claim.number).replace('.', '\\.') + '\\s*' + claim.unit.replace('/', '\\/'), 'i')
  if (directRx.test(context)) return true
  // Tolerance check — scan for all numbers in context near this value
  const numRx = /(\d+(?:\.\d+)?)/g
  let m
  const tol = Math.max(1, claim.number * 0.02)  // 2% tolerance or 1 unit
  while ((m = numRx.exec(context)) !== null) {
    if (Math.abs(parseFloat(m[1]) - claim.number) <= tol) return true
  }
  return false
}

/**
 * Check for banned sycophantic phrases.
 * @param {string} text
 * @returns {string[]}  array of matched banned phrases
 */
export function findBannedPhrases(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return BANNED_PHRASES.filter(p => lower.includes(p))
}

/**
 * Full validation of an AI output against its source context.
 *
 * @param {string} text          - AI-generated output text
 * @param {string} inputContext  - the system + user message sent to the model
 * @returns {{
 *   valid: boolean,
 *   claims: Array<{raw, number, unit, inContext}>,
 *   unverifiedClaims: Array<{raw, number, unit}>,
 *   bannedPhrases: string[],
 *   reason: string|null,
 * }}
 */
export function validateAiOutput(text, inputContext) {
  if (!text) {
    return { valid: false, claims: [], unverifiedClaims: [], bannedPhrases: [], reason: 'empty_output' }
  }

  const raw = extractNumericalClaims(text)
  const claims = raw.map(c => ({
    ...c,
    inContext: claimInContext(c, inputContext || ''),
  }))

  const unverifiedClaims = claims.filter(c => !c.inContext)
  const bannedPhrases    = findBannedPhrases(text)

  const valid = unverifiedClaims.length === 0 && bannedPhrases.length === 0

  let reason = null
  if (!valid) {
    const parts = []
    if (unverifiedClaims.length > 0) parts.push(`${unverifiedClaims.length} unverified claim(s): ${unverifiedClaims.map(c => c.raw).join(', ')}`)
    if (bannedPhrases.length > 0)    parts.push(`banned phrase(s): ${bannedPhrases.join(', ')}`)
    reason = parts.join('; ')
  }

  return { valid, claims, unverifiedClaims, bannedPhrases, reason }
}

/**
 * Quick guard — returns true if the output can be shown to the user.
 * Use this at the call site before rendering any AI text.
 * @param {string} text
 * @param {string} inputContext
 * @returns {boolean}
 */
export function isOutputSafe(text, inputContext) {
  return validateAiOutput(text, inputContext).valid
}
