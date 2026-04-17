// ─── analyse-session/index.ts — Per-session AI coaching feedback ─────────────
// Called by the client immediately after a training_log entry is saved.
// Tier-gated: only coach/club users get AI analysis.
// Stores result in ai_insights (kind='session', source_id=entry_id).
//
// Request body:
//   { entry: { id, date, type, tss, rpe, duration, notes, source?, distanceM? },
//     context?: { recent_ctl?, recent_atl?, hrv_trend? } }
//
// Response: { insight: string } | { error: string }

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHR_VER     = '2023-06-01'
const MODEL         = 'claude-haiku-4-5-20251001'
const MAX_TOKENS    = 256

const TIER_ELIGIBLE = new Set(['coach', 'club'])

function ok(body: unknown)           { return new Response(JSON.stringify(body),       { headers: { ...CORS, 'Content-Type': 'application/json' } }) }
function err(msg: string, s = 400)   { return new Response(JSON.stringify({ error: msg }), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } }) }

serve(async (req) => {
  if (req.method === 'OPTIONS') return ok('ok')
  if (req.method !== 'POST') return err('Method not allowed', 405)

  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader) return err('Unauthorized', 401)

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!anthropicKey) return err('AI analysis not configured', 503)

  // Identify caller from JWT
  const sb = createClient(supabaseUrl, serviceKey)
  const anonSb = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await anonSb.auth.getUser()
  if (authErr || !user) return err('Unauthorized', 401)

  // ── Tier check ──────────────────────────────────────────────────────────────
  const { data: subRow } = await sb
    .from('subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle()
  const tier = subRow?.tier || 'free'
  if (!TIER_ELIGIBLE.has(tier)) {
    return ok({ insight: null, reason: 'upgrade_required' })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { entry?: Record<string, unknown>, context?: Record<string, unknown> }
  try { body = await req.json() } catch { return err('Invalid JSON', 400) }

  const entry   = body.entry
  const context = body.context || {}
  if (!entry?.id || !entry?.date) return err('Missing entry.id or entry.date', 400)

  // ── Dedup: skip if already analysed ─────────────────────────────────────────
  const { data: existing } = await sb
    .from('ai_insights')
    .select('id')
    .eq('athlete_id', user.id)
    .eq('source_id', String(entry.id))
    .eq('kind', 'session')
    .maybeSingle()
  if (existing) return ok({ insight: null, reason: 'already_analysed', id: existing.id })

  // ── Build prompt ────────────────────────────────────────────────────────────
  const distLabel  = entry.distanceM ? ` · ${(Number(entry.distanceM) / 1000).toFixed(1)} km` : ''
  const sessionSummary = [
    `Date: ${entry.date}`,
    `Type: ${entry.type || 'Training'}`,
    `Duration: ${entry.duration || entry.durationMin || '?'} min`,
    `TSS: ${entry.tss ?? '?'}`,
    `RPE: ${entry.rpe ?? '?'}/10`,
    distLabel ? `Distance: ${distLabel.trim()}` : null,
    entry.notes ? `Notes: ${String(entry.notes).slice(0, 200)}` : null,
    context.recent_ctl ? `Recent CTL: ${context.recent_ctl}` : null,
    context.recent_atl ? `Recent ATL: ${context.recent_atl}` : null,
    context.hrv_trend  ? `HRV trend: ${context.hrv_trend}` : null,
  ].filter(Boolean).join('\n')

  const systemPrompt = `You are a concise endurance sports coach. Given a training session, provide 2-3 sentences of coaching feedback: what was well executed, and one specific actionable recommendation for recovery or next session. Be direct, evidence-based, and avoid generic platitudes. Keep under 60 words.`

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  let insightText: string
  try {
    const resp = await fetch(ANTHROPIC_API, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': ANTHR_VER,
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: `Analyse this session:\n${sessionSummary}` }],
      }),
    })
    if (!resp.ok) {
      const errBody = await resp.text()
      console.error('Anthropic error:', resp.status, errBody)
      return err('AI service error', 502)
    }
    const aiResp = await resp.json()
    insightText = aiResp?.content?.[0]?.text?.trim() || ''
    if (!insightText) return err('Empty AI response', 502)
  } catch (e) {
    console.error('Anthropic fetch error:', e)
    return err('AI service error', 502)
  }

  // ── Store in ai_insights ────────────────────────────────────────────────────
  const dataHash = `session-${entry.id}`
  const { error: insertErr } = await sb
    .from('ai_insights')
    .upsert({
      athlete_id:       user.id,
      date:             String(entry.date),
      data_hash:        dataHash,
      kind:             'session',
      source_id:        String(entry.id),
      insight_json:     { text: insightText, session: entry },
      explanation_text: insightText,
      model:            MODEL,
    }, { onConflict: 'athlete_id,date,data_hash' })

  if (insertErr) {
    console.error('DB insert error:', insertErr.message)
    // Return insight even if storage failed
    return ok({ insight: insightText, stored: false })
  }

  return ok({ insight: insightText, stored: true })
})
