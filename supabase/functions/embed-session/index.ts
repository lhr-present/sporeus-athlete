// ─── embed-session/index.ts — Embed a training session via OpenAI ─────────────
// Triggered by: DB webhook (on_training_log_insert_embed) OR explicit user invoke
// EMBEDDING_API_KEY: OpenAI API key (text-embedding-3-small, 1536d)
//
// Input (webhook):  { session_id: string, user_id: string, source: 'db_webhook' }
// Input (user):     { session_id: string } — user JWT in Authorization header
// Output:           { session_id, embedded: boolean, skipped?: boolean, reason?: string }
//
// C2 guard: sessions with < MIN_EMBED_TEXT_CHARS of meaningful text are skipped.
//   Empty or whitespace-only notes produce noise vectors — skip them entirely.
//
// C1 closure: after embedding the session, also embeds any linked ai_insights rows
//   into insight_embeddings. This closes the orphan chain: insight_embeddings was
//   defined (v7.44.0) but never written by this function until now.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const EMBED_MODEL      = 'text-embedding-3-small'  // 1536 dimensions

// C2: minimum meaningful text length before we call OpenAI.
// Sessions with only structured fields (date/type) and no notes/TSS are skipped.
const MIN_EMBED_TEXT_CHARS = 20

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const t0 = Date.now()

  try {
    const body = await req.json()
    const { session_id, user_id: bodyUserId, insight_only } = body

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

    const [_h, payloadB64] = jwt.split('.')
    let isServiceRole = false
    try {
      const payload = JSON.parse(atob(payloadB64.replace(/-/g,'+').replace(/_/g,'/')))
      isServiceRole = payload?.role === 'service_role'
    } catch { /* ignore */ }

    if (isServiceRole) {
      if (!bodyUserId) return jsonErr('Missing user_id for webhook call', 400)
      resolvedUserId = bodyUserId
    } else {
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

    // ── insight_only: skip session embed, only run C1 insight embedding ──────
    // Used by analyse-session after it writes ai_insights to close the race
    // condition: both functions are triggered in parallel by the same webhook.
    if (insight_only) {
      try {
        const { data: insights } = await supabase
          .from('ai_insights')
          .select('id, insight_json, kind, date')
          .eq('athlete_id', resolvedUserId)
          .eq('session_id', session_id)
          .not('insight_json', 'is', null)
        if (insights && insights.length > 0) {
          for (const ins of insights) {
            await embedInsight(supabase, embeddingKey, ins, resolvedUserId)
          }
        }
      } catch { /* best-effort */ }
      return json({ session_id, embedded: false, insight_only: true })
    }

    // ── Load session row ──────────────────────────────────────────────────────
    const { data: session, error: fetchErr } = await supabase
      .from('training_log')
      .select('id, date, type, duration_min, tss, rpe, zones, notes, decoupling_pct, source')
      .eq('id', session_id)
      .maybeSingle()

    if (fetchErr || !session) return jsonErr('Session not found', 404)

    // ── C2: guard — skip sessions with insufficient content ───────────────────
    // Meaningful = notes ≥ MIN_EMBED_TEXT_CHARS OR structured training data present.
    // A session with only a date+type produces a noise vector — skip it.
    const noteText      = (session.notes || '').trim()
    const hasNotes      = noteText.length >= MIN_EMBED_TEXT_CHARS
    const hasTrainingData = (session.tss && session.tss > 0) || (session.rpe && session.rpe > 0)

    if (!hasNotes && !hasTrainingData) {
      const dur = Date.now() - t0
      console.log(JSON.stringify({
        fn: 'embed-session', status: 'ok', duration_ms: dur,
        skipped: true, reason: 'insufficient_text',
        session_id: session_id.slice(0, 8),
      }))
      return json({ session_id, embedded: false, skipped: true, reason: 'insufficient_text' })
    }

    // ── Build content text ────────────────────────────────────────────────────
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
      noteText ? `notes:${noteText.slice(0, 400)}` : null,
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
      // Content unchanged — skip re-embedding the session vector, but still run C1
      // so that ai_insights written AFTER the last embed get picked up.
      try {
        const { data: insights } = await supabase
          .from('ai_insights')
          .select('id, insight_json, kind, date')
          .eq('athlete_id', resolvedUserId)
          .eq('session_id', session_id)
          .not('insight_json', 'is', null)
        if (insights && insights.length > 0) {
          for (const insight of insights) {
            await embedInsight(supabase, embeddingKey, insight, resolvedUserId)
          }
        }
      } catch { /* best-effort */ }
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
      console.error(JSON.stringify({
        fn: 'embed-session', status: 'error', duration_ms: Date.now() - t0,
        error_class: 'OpenAIError', session_id: session_id.slice(0, 8),
      }))
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
        embedding:    `[${embedding.join(',')}]`,
        content_hash: hashHex,
        created_at:   new Date().toISOString(),
      }, { onConflict: 'session_id' })

    if (upsertErr) {
      console.error(JSON.stringify({
        fn: 'embed-session', status: 'error', duration_ms: Date.now() - t0,
        error_class: 'UpsertError', message: upsertErr.message,
      }))
      return jsonErr(`DB upsert failed: ${upsertErr.message}`, 500)
    }

    // ── C1: embed linked ai_insights → insight_embeddings (best-effort) ───────
    // Closes the orphan chain. Failure here does NOT fail the session embed.
    try {
      const { data: insights } = await supabase
        .from('ai_insights')
        .select('id, insight_json, kind, date')
        .eq('athlete_id', resolvedUserId)
        .eq('session_id', session_id)
        .not('insight_json', 'is', null)

      if (insights && insights.length > 0) {
        for (const insight of insights) {
          await embedInsight(supabase, embeddingKey, insight, resolvedUserId)
        }
      }
    } catch (insightErr) {
      console.warn(JSON.stringify({
        fn: 'embed-session', status: 'warn',
        message: 'insight embedding failed (non-fatal)',
        error: (insightErr as Error)?.message,
      }))
    }

    const dur = Date.now() - t0
    console.log(JSON.stringify({
      fn: 'embed-session', status: 'ok', duration_ms: dur,
      skipped: false, session_id: session_id.slice(0, 8),
    }))

    return json({ session_id, embedded: true })

  } catch (e) {
    console.error(JSON.stringify({
      fn: 'embed-session', status: 'error', duration_ms: Date.now() - t0,
      error_class: (e as Error)?.constructor?.name || 'Unknown',
    }))
    return jsonErr((e as Error).message || 'Internal error', 500)
  }
})

// ── embedInsight — embed a single ai_insights row into insight_embeddings ─────
// Idempotent: content_hash dedup prevents re-embedding unchanged insights.
async function embedInsight(
  supabase: ReturnType<typeof createClient>,
  embeddingKey: string,
  insight: { id: string; insight_json: unknown; kind: string; date: string },
  userId: string,
): Promise<void> {
  const insightData = insight.insight_json as Record<string, unknown>
  // analyse-session stores: { text, flags (array), session, acwr, ctl, tsb }
  // nightly-batch digest stores: { summary, insights (array), athletes, etc. }
  // Support both shapes.
  const textParts = [
    insight.date ? `date:${insight.date}` : null,
    insight.kind ? `kind:${insight.kind}` : null,
    // Primary: session_analysis / coach_session_flag text field
    typeof insightData?.text === 'string'
      ? `insight:${(insightData.text as string).slice(0, 500)}`
      : null,
    // Secondary: weekly digest summary field
    typeof insightData?.summary === 'string'
      ? `summary:${(insightData.summary as string).slice(0, 500)}`
      : null,
    // Array insights (weekly digest)
    Array.isArray(insightData?.insights)
      ? `insights:${(insightData.insights as string[]).slice(0, 3).join(' | ')}`
      : null,
    // Flags: array (session_analysis) or string (legacy)
    Array.isArray(insightData?.flags) && (insightData.flags as string[]).length > 0
      ? `flags:${(insightData.flags as string[]).join(' ')}`
      : typeof insightData?.flags === 'string' ? `flags:${insightData.flags}` : null,
  ].filter(Boolean).join(' | ')

  if (!textParts || textParts.length < MIN_EMBED_TEXT_CHARS) return

  // Content hash dedup
  const encoder = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(textParts))
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const { data: existing } = await supabase
    .from('insight_embeddings')
    .select('content_hash')
    .eq('insight_id', insight.id)
    .maybeSingle()

  if (existing?.content_hash === hashHex) return  // unchanged — skip

  const embedRes = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${embeddingKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: textParts }),
  })
  if (!embedRes.ok) return  // best-effort

  const embedData = await embedRes.json()
  const embedding = embedData?.data?.[0]?.embedding as number[]
  if (!embedding || embedding.length !== 1536) return

  await supabase.from('insight_embeddings').upsert({
    insight_id:   insight.id,
    user_id:      userId,
    embedding:    `[${embedding.join(',')}]`,
    content_hash: hashHex,
    created_at:   new Date().toISOString(),
  }, { onConflict: 'insight_id' })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function jsonErr(message: string, status = 400) {
  return json({ error: message }, status)
}
