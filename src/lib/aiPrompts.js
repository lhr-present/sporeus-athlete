// ─── aiPrompts.js — Claude API integration via server-side ai-proxy ───────────
// All Claude calls go through supabase/functions/ai-proxy. The Anthropic API key
// never reaches the browser. Tier enforcement is authoritative on the server.

import { supabase, isSupabaseReady } from './supabase.js'

const CACHE_PREFIX = 'sporeus-ai-'

// ─── clearInsightCache — remove all cached insights for an athlete ─────────────
export async function clearInsightCache(athleteId) {
  // Clear Supabase rows
  if (isSupabaseReady() && athleteId) {
    try {
      await supabase.from('ai_insights').delete().eq('athlete_id', athleteId)
    } catch {}
  }
  // Clear matching localStorage keys
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
    keys.forEach(k => localStorage.removeItem(k))
  } catch {}
}

// ── appendToneModifier ────────────────────────────────────────────────────────
// Returns additional system prompt text based on athlete's AI tone preference.
// tone: 'motivating' | 'clinical' | 'concise' (case-insensitive)
export function appendToneModifier(tone) {
  const t = (tone || '').toLowerCase().trim()
  if (t === 'motivating') return 'End with one encouraging sentence that motivates the athlete.'
  if (t === 'clinical')   return 'Use sport science terminology. Avoid emotional language. Be precise.'
  if (t === 'concise')    return 'Summary must be under 15 words total. No elaboration.'
  return ''
}

// ── getFeedbackStats ──────────────────────────────────────────────────────────
// Calculates positive/negative feedback ratio from an array of audit log entries.
// entries = [{ action, resource, details: { rating: 1|-1 } }]
export function getFeedbackStats(entries) {
  if (!Array.isArray(entries)) return { positive: 0, negative: 0, ratio: 0 }
  const fb = entries.filter(e => e?.action === 'feedback' && e?.resource === 'ai_insights')
  const positive = fb.filter(e => e?.details?.rating === 1).length
  const negative = fb.filter(e => e?.details?.rating === -1).length
  const total = positive + negative
  const ratio = total > 0 ? Math.round((positive / total) * 100) / 100 : 0
  return { positive, negative, ratio }
}
