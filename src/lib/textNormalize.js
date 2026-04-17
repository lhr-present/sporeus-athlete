// src/lib/textNormalize.js — Turkish-aware text normalization for FTS queries
// Folds Turkish diacritics so 'kosu' finds 'koşu' and vice versa.
// Used as a pre-processor before calling search_everything() RPC.

const TR_FOLD = {
  'ı': 'i', 'İ': 'i',
  'ş': 's', 'Ş': 's',
  'ç': 'c', 'Ç': 'c',
  'ğ': 'g', 'Ğ': 'g',
  'ü': 'u', 'Ü': 'u',
  'ö': 'o', 'Ö': 'o',
}

const TR_PATTERN = /[ışçğüöİŞÇĞÜÖ]/g

/**
 * Lowercase + fold Turkish diacritics for consistent FTS matching.
 * @param {string} text
 * @returns {string}
 */
export function normalizeForSearch(text) {
  // Fold TR diacritics BEFORE toLowerCase: İ.toLowerCase() → 'i̇' (two chars) in JS,
  // but the TR_FOLD map maps 'İ' → 'i' directly.
  return String(text ?? '')
    .replace(TR_PATTERN, ch => TR_FOLD[ch] ?? ch)
    .toLowerCase()
}

/**
 * Split text into search tokens, removing stopwords and short tokens.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return normalizeForSearch(text)
    .split(/\s+/)
    .filter(t => t.length >= 2)
}
