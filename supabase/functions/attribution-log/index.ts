// ─── attribution-log/index.ts — First-touch attribution event ingestion ───────
// Accepts anonymous or authenticated attribution events from the client.
// On first authenticated event per user: stamps profiles.first_touch once.
// Rate limit: 20 requests / minute per anon_id (in-process Map, resets on cold start).
//
// Input:  { anon_id, event_name, utm_source?, utm_medium?, utm_campaign?,
//           utm_content?, utm_term?, referrer?, landing_path?,
//           user_agent_class?, first_touch?, props? }
// Output: { ok: true, event_id } | { error: string }

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

// In-process rate limiter: anon_id → { count, window_start }
const rateLimiter = new Map<string, { count: number; windowStart: number }>()

function checkRate(anonId: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(anonId)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimiter.set(anonId, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

serve(withTelemetry('attribution-log', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const t0 = Date.now()

  try {
    const body = await req.json().catch(() => null)
    if (!body) return jsonErr('Invalid JSON', 400)

    const {
      anon_id, event_name, utm_source, utm_medium, utm_campaign,
      utm_content, utm_term, referrer, landing_path, user_agent_class,
      first_touch, props,
    } = body

    if (!anon_id || typeof anon_id !== 'string') return jsonErr('Missing anon_id', 400)
    if (!event_name || typeof event_name !== 'string') return jsonErr('Missing event_name', 400)

    // Rate limit by anon_id
    if (!checkRate(anon_id)) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Resolve authenticated user (if JWT present) ────────────────────────
    let userId: string | null = null
    const authHeader = req.headers.get('authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')
    if (jwt) {
      try {
        const [, payloadB64] = jwt.split('.')
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
        if (payload?.sub && payload?.role !== 'service_role') {
          userId = payload.sub
        }
      } catch { /* non-JWT token or guest */ }
    }

    // ── Insert attribution event ───────────────────────────────────────────
    const { data: event, error: insertErr } = await supabase
      .from('attribution_events')
      .insert({
        user_id:          userId,
        anon_id,
        event_name,
        utm_source:       utm_source       ?? null,
        utm_medium:       utm_medium       ?? null,
        utm_campaign:     utm_campaign     ?? null,
        utm_content:      utm_content      ?? null,
        utm_term:         utm_term         ?? null,
        referrer:         referrer         ?? null,
        landing_path:     landing_path     ?? null,
        user_agent_class: user_agent_class ?? null,
        props:            props            ?? null,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[attribution-log] insert error:', insertErr.message)
      return jsonErr('Database insert failed', 500)
    }

    // ── Stamp profiles.first_touch once per authenticated user ─────────────
    // Only on first event for this user AND when we have a meaningful first_touch.
    if (userId && first_touch && typeof first_touch === 'object') {
      const { data: existing } = await supabase
        .from('profiles')
        .select('first_touch')
        .eq('id', userId)
        .single()

      if (existing && existing.first_touch === null) {
        await supabase
          .from('profiles')
          .update({ first_touch })
          .eq('id', userId)
          // Belt-and-suspenders: only overwrite if still null
          .is('first_touch', null)
      }
    }

    const duration = Date.now() - t0
    console.log(JSON.stringify({
      fn: 'attribution-log', status: 'ok', duration_ms: duration,
      event_name, anon_id: anon_id.slice(0, 8) + '…',
    }))

    return new Response(JSON.stringify({ ok: true, event_id: event.id }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const duration = Date.now() - t0
    console.error(JSON.stringify({
      fn: 'attribution-log', status: 'error', duration_ms: duration,
      error_class: err instanceof Error ? err.constructor.name : 'Unknown',
    }))
    return jsonErr('Internal error', 500)
  }
}))

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
