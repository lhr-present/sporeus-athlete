// ─── ai-proxy/index.ts — Server-side Claude API proxy ────────────────────────
// ANTHROPIC_API_KEY never reaches the client. All tier enforcement is here.
// Input:  { model_alias: 'haiku'|'sonnet', system: string, user_msg: string,
//           max_tokens?: number, rag?: boolean }
// Output: { content: string, usage? }
//         With rag:true: { content: string, citations: Citation[], usage? }
//
// When rag:true the proxy:
//  1. Embeds user_msg via EMBEDDING_API_KEY (OpenAI text-embedding-3-small)
//  2. Calls match_sessions_for_user RPC (top 10 by cosine similarity)
//  3. Prepends a context block [S1]–[S10] to the system prompt
//  4. Returns content + citations array so the UI can render source links

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANTHROPIC_API    = 'https://api.anthropic.com/v1/messages'
const ANTHR_VER        = '2023-06-01'
const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const EMBED_MODEL      = 'text-embedding-3-small'
const RAG_K            = 10  // top-k sessions injected into context

const MODEL_MAP: Record<string, string> = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5',
}

const TIER_LIMITS: Record<string, number> = {
  free:  0,
  coach: 50,
  club:  500,
}

interface Citation {
  marker:     string   // 'S1' … 'S10'
  session_id: string
  date:       string
  type:       string
}

interface SessionRow {
  session_id:   string
  date:         string
  type:         string
  duration_min: number | null
  tss:          number | null
  rpe:          number | null
  notes:        string | null
  similarity:   number
}

// Build [S1]–[S10] context block injected before the system prompt
function buildRagContext(sessions: SessionRow[]): string {
  if (!sessions.length) return ''
  const lines = sessions.map((s, i) => {
    const parts = [
      `[S${i + 1}]`,
      `date:${s.date}`,
      `type:${s.type || 'unknown'}`,
      s.duration_min ? `${s.duration_min}min` : null,
      s.tss          ? `TSS:${s.tss}` : null,
      s.rpe          ? `RPE:${s.rpe}` : null,
      s.notes ? `notes:"${s.notes.slice(0, 200)}"` : null,
    ].filter(Boolean).join(' ')
    return parts
  })

  return [
    '=== ATHLETE SESSION CONTEXT (most relevant to this query) ===',
    ...lines,
    '=== END CONTEXT — cite sources as [S1] etc. when relevant ===',
    '',
  ].join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { model_alias = 'haiku', system, user_msg, max_tokens = 512, rag = false } =
      await req.json()
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

    // ── Tier check ────────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle()

    const tier  = profile?.subscription_tier || 'free'
    const limit = TIER_LIMITS[tier] ?? 0
    if (limit === 0) return err('AI features require a Coach or Club plan. Upgrade at sporeus.com.', 403)

    // ── Daily usage check ─────────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10)
    const { count: dailyCount } = await supabase
      .from('ai_insights')
      .select('*', { count: 'exact', head: true })
      .eq('athlete_id', user.id)
      .eq('date', today)

    if ((dailyCount ?? 0) >= limit) {
      return err(`Daily AI limit reached (${limit} calls/${tier} plan). Resets at midnight.`, 429)
    }

    // ── Monthly cap ───────────────────────────────────────────────────────────
    const monthStart = today.slice(0, 7) + '-01'
    const { count: monthCount } = await supabase
      .from('ai_insights')
      .select('*', { count: 'exact', head: true })
      .eq('athlete_id', user.id)
      .gte('date', monthStart)

    // Per-tier monthly cap: Coach = 300, Club = 1500 (flat 1500 allowed Sonnet abuse)
    const MONTHLY_CAPS: Record<string, number> = { free: 0, coach: 300, club: 1500 }
    const monthlyCap = MONTHLY_CAPS[tier] ?? 0
    if ((monthCount ?? 0) >= monthlyCap) {
      return err(`Monthly AI quota reached (${monthlyCap} calls/${tier} plan). Resets on the 1st.`, 429)
    }

    // ── RAG: retrieve grounding context ───────────────────────────────────────
    let ragContext    = ''
    let citations: Citation[] = []

    if (rag) {
      const embeddingKey = Deno.env.get('EMBEDDING_API_KEY')
      if (embeddingKey) {
        try {
          // 1. Embed the user query
          const embedRes = await fetch(OPENAI_EMBED_URL, {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${embeddingKey}`,
            },
            body: JSON.stringify({ model: EMBED_MODEL, input: user_msg.slice(0, 8192) }),
          })

          if (embedRes.ok) {
            const embedData = await embedRes.json()
            const embedding = embedData?.data?.[0]?.embedding as number[]

            if (embedding?.length === 1536) {
              // 2. Search sessions as the authenticated user
              const userClient = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('SUPABASE_ANON_KEY')!,
                { global: { headers: { Authorization: `Bearer ${jwt}` } } }
              )

              const { data: sessions } = await userClient.rpc('match_sessions_for_user', {
                p_embedding: `[${embedding.join(',')}]`,
                k:           RAG_K,
              })

              if (sessions?.length) {
                ragContext = buildRagContext(sessions as SessionRow[])
                citations  = (sessions as SessionRow[]).map((s, i) => ({
                  marker:     `S${i + 1}`,
                  session_id: s.session_id,
                  date:       s.date,
                  type:       s.type || 'unknown',
                }))
              }
            }
          }
        } catch {
          // RAG failure is non-fatal — fall through to plain AI call
        }
      }
    }

    // ── Call Anthropic ────────────────────────────────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return err('Server configuration error — ANTHROPIC_API_KEY not set', 500)

    const model     = MODEL_MAP[model_alias] || MODEL_MAP.haiku
    const fullSystem = ragContext ? ragContext + system : system

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
        system: fullSystem,
        messages: [{ role: 'user', content: user_msg }],
      }),
    })

    if (!anthRes.ok) {
      const e = await anthRes.json().catch(() => ({}))
      return err(e?.error?.message || `Claude API error ${anthRes.status}`, anthRes.status)
    }

    const anthData = await anthRes.json()
    const content  = anthData?.content?.[0]?.text || ''
    const usage    = anthData?.usage ?? null

    return json(rag ? { content, citations, usage } : { content, usage })
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
