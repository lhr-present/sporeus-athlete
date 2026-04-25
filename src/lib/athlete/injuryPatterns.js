// ── src/lib/athlete/injuryPatterns.js — E35 InjuryPatternCard helpers ─────────
import { mineInjuryPatterns } from '../patterns.js'

/**
 * Wrap mineInjuryPatterns with safety guards.
 * Returns null if injuries.length < 2 (not enough data).
 * Returns { patterns, vulnerableZones, protectiveFactors, topPattern, citation }
 */
export function computeInjuryPatterns(log = [], injuries = [], recovery = []) {
  if (!injuries || injuries.length < 2) return null
  const result = mineInjuryPatterns(log, injuries, recovery)
  const topPattern = result.patterns.length > 0 ? result.patterns[0] : null
  return {
    ...result,
    topPattern,
    citation: 'Gabbett 2016 · Malone 2017 · Drew 2016',
  }
}

/**
 * Returns the most frequently injured body zone (highest occurrences),
 * or null if patterns array is empty.
 */
export function topVulnerableZone(patterns = []) {
  if (!patterns || patterns.length === 0) return null
  return patterns.reduce((best, p) => {
    if (!best || (p.occurrences || 0) > (best.occurrences || 0)) return p
    return best
  }, null)?.zone || null
}

/**
 * Returns confidence tier color.
 * 'high'     → #5bc25b
 * 'moderate' → #f5c542
 * 'low'      → #888
 * unknown    → #888
 */
export function confidenceColor(confidence) {
  if (confidence === 'high')     return '#5bc25b'
  if (confidence === 'moderate') return '#f5c542'
  return '#888'
}
