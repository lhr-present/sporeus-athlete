// ─── embed-session/index.ts — Embed a training session via OpenAI ─────────────
// Triggered by: DB webhook (on_training_log_insert_embed) OR explicit user invoke
// EMBEDDING_API_KEY: OpenAI API key (text-embedding-3-small, 1536d)
//
// Input (webhook):  { session_id: string, user_id: string, source: 'db_webhook' }
// Input (user):     { session_id: string } — user JWT in Authorization header
// Output:           { session_id, embedded: boolean, skipped?: boolean }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const EMBED_MODEL      = 'text-embedding-3-small'  // 1536 dimensions

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { session_id, user_id: bodyUserId, source } = body

    if (!session_id) return jsonErr('Missing session_id', 400)

    const embeddingKey = Deno.env.get('EMBEDDING_API_KEY')
    if (!embeddingKey) return jsonErr('EMBEDDING_API_KEY not configured', 500)

    // ── Auth: service-role webhook path vs user JWT path ─────────────────────
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!jwt) return jsonErr('Unauthorized', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let resolvedUserId: string

    // Determine if this is a service-role call (webhook) or user JWT call
    const [_h, payloadB64] = jwt.split('.')
    let isServiceRole = false
    try {
      const payload = JSON.parse(atob(payloadB64.replace(/-/g,'+').replace(/_/g,'/')))
      isServiceRole = payload?.role === 'service_role'
    } catch { /* ignore */ }

    if (isServiceRole) {
      // Webhook path: trust user_id from body
      if (!bodyUserId) return jsonErr('Missing user_id for webhook call', 400)
      resolvedUserId = bodyUserId
    } else {
      // User JWT path: verify user owns this session
      const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
      if (authErr || !user) return jsonErr('Unauthorized', 401)

      const { data: sessionRow } = await supabase
        .from('training_log')
        .select('user_id')
        .eq('id', session_id)
        .maybeSingle()

      if (!sessionRow || sessionRow.user_id !== user.id) {
        return jsonErr('Session not found or access denied', 403)
      }
      resolvedUserId = user.id
    }

    // ── Load session row ──────────────────────────────────────────────────────
    const { data: session, error: fetchErr } = await supabase
      .from('training_log')
      .select('id, date, type, duration_min, tss, rpe, zones, notes, decoupling_pct, source')
      .eq('id', session_id)
      .maybeSingle()

    if (fetchErr || !session) return jsonErr('Session not found', 404)

    // ── Build content text ────────────────────────────────────────────────────
    // Structured text representation embedded into the vector store.
    // Changing this format will invalidate existing embeddings (bump content_hash).
    const zonesStr = session.zones
      ? Object.entries(session.zones as Record<string, number>)
          .map(([z, s]) => `${z}:${Math.round(s)}s`).join(' ')
      : ''

    const contentText = [
      `date:${session.date}`,
      `type:${session.type || 'unknown'}`,
      session.duration_min ? `duration:${session.duration_min}min` : null,
      session.tss          ? `tss:${session.tss}` : null,
      session.rpe          ? `rpe:${session.rpe}` : null,
      session.decoupling_pct != null ? `decoupling:${session.decoupling_pct.toFixed(1)}%` : null,
      zonesStr ? `zones:${zonesStr}` : null,
      session.notes ? `notes:${session.notes.slice(0, 400)}` : null,
    ].filter(Boolean).join(' | ')

    // ── Content hash — skip re-embedding if content unchanged ─────────────────
    const encoder = new TextEncoder()
    const hashBuf  = await crypto.subtle.digest('SHA-256', encoder.encode(contentText))
    const hashHex  = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    const { data: existing } = await supabase
      .from('session_embeddings')
      .select('content_hash')
      .eq('session_id', session_id)
      .maybeSingle()

    if (existing?.content_hash === hashHex) {
      return json({ session_id, embedded: false, skipped: true, reason: 'content_unchanged' })
    }

    // ── Call OpenAI text-embedding-3-small ────────────────────────────────────
    const embedRes = await fetch(OPENAI_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${embeddingKey}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: contentText }),
    })

    if (!embedRes.ok) {
      const e = await embedRes.json().catch(() => ({}))
      return jsonErr(`OpenAI error: ${e?.error?.message || embedRes.status}`, 502)
    }

    const embedData = await embedRes.json()
    const embedding  = embedData?.data?.[0]?.embedding as number[]
    if (!embedding || embedding.length !== 1536) {
      return jsonErr('Invalid embedding response from OpenAI', 502)
    }

    // ── UPSERT session_embeddings ─────────────────────────────────────────────
    const { error: upsertErr } = await supabase
      .from('session_embeddings')
      .upsert({
        session_id,
        user_id:      resolvedUserId,
        embedding:    `[${embedding.join(',')}]`,  // pgvector text literal
        content_hash: hashHex,
        created_at:   new Date().toISOString(),
      }, { onConflict: 'session_id' })

    if (upsertErr) return jsonErr(`DB upsert failed: ${upsertErr.message}`, 500)

    return json({ session_id, embedded: true })
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
