// ─── realtimeBackoff.js — Exponential backoff for Realtime reconnects ─────────
// computeBackoff(attempt, maxMs) → delay in milliseconds
// Sequence: 1000, 2000, 4000, 8000, 16000, 30000, 30000, …

export function computeBackoff(attempt, maxMs = 30000) {
  return Math.min(1000 * Math.pow(2, attempt), maxMs)
}
