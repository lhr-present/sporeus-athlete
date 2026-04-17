// ─── embed-query/index.ts — Embed a search query + optional cosine search ─────
// Called by: SemanticSearch.jsx, SquadPatternSearch.jsx, ai-proxy (RAG mode)
//
// Input:  { query: string, k?: number, squad?: boolean, athlete_ids?: string[] }
// Output: { sessions: [...], embedding?: number[] }
//   sessions shape: { session_id, date, type, duration_min, tss, rpe, notes, similarity }
//   squad:true returns also { athlete_id, athlete_name } per row
//
// Auth: user JWT required.
// squad:true requires coach tier (enforced here + in match_sessions_for_coach RLS).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const EMBED_MODEL      = 'text-embedding-3-small'
const MAX_K            = 20  // hard cap on top-k results

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { query, k = 10, squad = false, athlete_ids } = await req.json()

    if (!query || typeof query !== 'string' || !query.trim()) {
      return jsonErr('Missing or empty query', 400)
    }

    const embeddingKey = Deno.env.get('EMBEDDING_API_KEY')
    if (!embeddingKey) return jsonErr('Semantic search not configured (EMBEDDING_API_KEY missing)', 501)

    // ── Auth ──────────────────────────────────────────────────────────────────
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!jwt) return jsonErr('Unauthorized', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return jsonErr('Unauthorized', 401)

    // ── Squad mode: verify coach tier ─────────────────────────────────────────
    if (squad) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle()

      const tier = profile?.subscription_tier || 'free'
      if (tier === 'free') {
        return jsonErr('Squad pattern search requires a Coach or Club plan.', 403)
      }
    }

    // ── Embed query ───────────────────────────────────────────────────────────
    const embedRes = await fetch(OPENAI_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${embeddingKey}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: query.trim().slice(0, 8192) }),
    })

    if (!embedRes.ok) {
      const e = await embedRes.json().catch(() => ({}))
      return jsonErr(`OpenAI error: ${e?.error?.message || embedRes.status}`, 502)
    }

    const embedData = await embedRes.json()
    const embedding  = embedData?.data?.[0]?.embedding as number[]
    if (!embedding || embedding.length !== 1536) {
      return jsonErr('Invalid embedding from OpenAI', 502)
    }

    const safeK = Math.min(Math.max(1, k), MAX_K)
    const embeddingLiteral = `[${embedding.join(',')}]`

    // ── Cosine search via RPC (pass user JWT for RLS scoping) ─────────────────
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    )

    let sessions: unknown[]

    if (squad && athlete_ids?.length) {
      const { data, error } = await userClient.rpc('match_sessions_for_coach', {
        p_embedding:   embeddingLiteral,
        p_athlete_ids: athlete_ids,
        k:             safeK,
      })
      if (error) return jsonErr(`Search failed: ${error.message}`, 500)
      sessions = data || []
    } else {
      const { data, error } = await userClient.rpc('match_sessions_for_user', {
        p_embedding: embeddingLiteral,
        k:           safeK,
      })
      if (error) return jsonErr(`Search failed: ${error.message}`, 500)
      sessions = data || []
    }

    return json({ sessions })
  } catch (e) {
    return jsonErr((e as Error).message || 'Internal error', 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function jsonErr(message: string, status = 400) {
  return json({ error: message }, status)
}
