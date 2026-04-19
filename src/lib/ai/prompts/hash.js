// src/lib/ai/prompts/hash.js — E7: Lightweight djb2 hash for prompt SHA
// Browser + Node compatible. No crypto dependency.
// Returns 8-char hex string stable across environments.

/**
 * djb2 hash → 8-char lowercase hex string.
 * Deterministic: same input always produces same output.
 * @param {string} str
 * @returns {string}
 */
export function createHash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0  // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0')
}
