// ─── enqueue-ai-batch/index.ts — pgmq consumer for AI session analysis ───────
// Reads from 'ai-session-analysis' queue, calls analyse-session for each msg,
// then archives (ACKs) processed messages.
// Called by pg_cron every 5 minutes or manually for immediate processing.
// Requires service_role JWT.
//
// POST body (optional): { batch_size?: number }

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ok(body: unknown)         { return new Response(JSON.stringify(body),       { headers: { ...CORS, 'Content-Type': 'application/json' } }) }
function err(msg: string, s = 400) { return new Response(JSON.stringify({ error: msg }), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } }) }

function jwtRole(authHeader: string | null): string | null {
  try {
    if (!authHeader) return null
    const token   = authHeader.replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role || null
  } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return ok('ok')
  if (req.method !== 'POST') return err('Method not allowed', 405)

  const authHeader = req.headers.get('authorization')
  if (jwtRole(authHeader) !== 'service_role') return err('Unauthorized', 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb          = createClient(supabaseUrl, serviceKey)

  let batchSize = 10
  try {
    const body = await req.json()
    if (body?.batch_size) batchSize = Math.min(50, Math.max(1, body.batch_size))
  } catch { /* no body */ }

  // ── Drain queue ─────────────────────────────────────────────────────────────
  const { data: msgs, error: drainErr } = await sb.rpc('drain_ai_session_queue', {
    batch_size: batchSize,
    vt:         300,
  })
  if (drainErr) return err('Queue drain failed: ' + drainErr.message, 500)
  if (!msgs?.length) return ok({ processed: 0, queued: 0 })

  // ── Process each message via analyse-session ─────────────────────────────────
  const results: { msg_id: number, status: string, error?: string }[] = []
  const analyseUrl = `${supabaseUrl}/functions/v1/analyse-session`

  for (const msg of msgs) {
    const payload = msg.message as Record<string, unknown>
    const msgId   = msg.msg_id as number

    // Build a fake user JWT (service role calls analyse-session on behalf of user)
    // analyse-session needs the user's bearer token to call getUser()
    // Alternative: call Anthropic directly from here instead of delegating
    // For simplicity: call Anthropic directly here, bypassing analyse-session
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      results.push({ msg_id: msgId, status: 'skipped', error: 'ANTHROPIC_API_KEY not set' })
      continue
    }

    // Check tier via subscriptions table
    const { data: sub } = await sb
      .from('subscriptions')
      .select('tier')
      .eq('user_id', payload.user_id)
      .maybeSingle()
    const tier = sub?.tier || 'free'
    if (!['coach', 'club'].includes(tier)) {
      await sb.rpc('ack_ai_session_msg', { p_msg_id: msgId })
      results.push({ msg_id: msgId, status: 'skipped', error: 'tier_ineligible' })
      continue
    }

    // Dedup check
    const { data: existing } = await sb
      .from('ai_insights')
      .select('id')
      .eq('athlete_id', payload.user_id)
      .eq('source_id', String(payload.entry_id))
      .eq('kind', 'session')
      .maybeSingle()
    if (existing) {
      await sb.rpc('ack_ai_session_msg', { p_msg_id: msgId })
      results.push({ msg_id: msgId, status: 'skipped', error: 'already_done' })
      continue
    }

    // Call Anthropic
    try {
      const sessionSummary = [
        `Date: ${payload.date}`,
        `Type: ${payload.type || 'Training'}`,
        `Duration: ${payload.duration ?? '?'} min`,
        `TSS: ${payload.tss ?? '?'}`,
        `RPE: ${payload.rpe ?? '?'}/10`,
      ].join('\n')

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 256,
          system:     'You are a concise endurance sports coach. Provide 2-3 sentences of coaching feedback for this session. Be specific and actionable. Under 60 words.',
          messages:   [{ role: 'user', content: `Analyse this training session:\n${sessionSummary}` }],
        }),
      })
      if (!resp.ok) throw new Error(`Anthropic ${resp.status}`)
      const aiResp = await resp.json()
      const insightText = aiResp?.content?.[0]?.text?.trim() || ''
      if (!insightText) throw new Error('empty_response')

      await sb.from('ai_insights').upsert({
        athlete_id:       payload.user_id,
        date:             String(payload.date),
        data_hash:        `session-${payload.entry_id}`,
        kind:             'session',
        source_id:        String(payload.entry_id),
        insight_json:     { text: insightText, queued: true },
        explanation_text: insightText,
        model:            'claude-haiku-4-5-20251001',
      }, { onConflict: 'athlete_id,date,data_hash' })

      await sb.rpc('ack_ai_session_msg', { p_msg_id: msgId })
      results.push({ msg_id: msgId, status: 'done' })
    } catch (e) {
      // Leave in queue for retry (don't ACK)
      results.push({ msg_id: msgId, status: 'error', error: (e as Error).message })
    }
  }

  const done    = results.filter(r => r.status === 'done').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors  = results.filter(r => r.status === 'error').length
  return ok({ processed: done, skipped, errors, total: msgs.length })
})
