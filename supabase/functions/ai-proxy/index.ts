// ─── ai-proxy/index.ts — Server-side Claude API proxy ────────────────────────
// ANTHROPIC_API_KEY never reaches the client. All tier enforcement is here.
// Input:  { model_alias: 'haiku'|'sonnet', system: string, user_msg: string, max_tokens?: number }
// Output: { content: string } | { error: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHR_VER     = '2023-06-01'

const MODEL_MAP: Record<string, string> = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5',
}

// Daily call limits per tier (source of truth — mirrors subscription.js for UX only)
const TIER_LIMITS: Record<string, number> = {
  free:  0,
  coach: 50,
  club:  500,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return ok('ok')

  try {
    const { model_alias = 'haiku', system, user_msg, max_tokens = 512 } = await req.json()
    if (!system || !user_msg) return err('Missing system or user_msg', 400)

    // ── Auth: verify JWT ─────────────────────────────────────────────────────
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!jwt) return err('Unauthorized', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return err('Unauthorized', 401)

    // ── Tier check (read from DB — not from client) ──────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle()

    const tier  = profile?.subscription_tier || 'free'
    const limit = TIER_LIMITS[tier] ?? 0
    if (limit === 0) return err('AI features require a Coach or Club plan. Upgrade at sporeus.com.', 403)

    // ── Daily usage check (count today's cached rows as a proxy) ─────────────
    const today = new Date().toISOString().slice(0, 10)
    const { count } = await supabase
      .from('ai_insights')
      .select('*', { count: 'exact', head: true })
      .eq('athlete_id', user.id)
      .eq('date', today)

    if ((count ?? 0) >= limit) {
      return err(`Daily AI limit reached (${limit} calls/${tier} plan). Resets at midnight.`, 429)
    }

    // ── Call Anthropic ────────────────────────────────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return err('Server configuration error — ANTHROPIC_API_KEY not set', 500)

    const model  = MODEL_MAP[model_alias] || MODEL_MAP.haiku
    const anthRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': ANTHR_VER,
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(max_tokens, 4096),
        system,
        messages: [{ role: 'user', content: user_msg }],
      }),
    })

    if (!anthRes.ok) {
      const e = await anthRes.json().catch(() => ({}))
      return err(e?.error?.message || `Claude API error ${anthRes.status}`, anthRes.status)
    }

    const anthData = await anthRes.json()
    const content  = anthData?.content?.[0]?.text || ''
    return json({ content })
  } catch (e) {
    return err((e as Error).message || 'Internal error', 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function ok(body: string) {
  return new Response(body, { headers: CORS })
}
function err(message: string, status = 400) {
  return json({ error: message }, status)
}
