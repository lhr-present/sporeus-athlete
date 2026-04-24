// supabase/functions/ingest-telemetry/index.ts
// Receives batched client telemetry from the upgraded telemetry.js flush.
// Inserts into client_events table (30-day TTL, privacy-safe user_id_hash).
//
// Body: { session_id, user_id_hash?, events: [{ event_type, category, action, label?, value?, page?, app_version? }] }
// Auth: anon key is sufficient — no PII, user_id is pre-hashed client-side.
import { withTelemetry } from '../_shared/telemetry.ts'
import { serve }         from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_EVENT_TYPES = new Set(['page_view', 'feature', 'error', 'perf', 'funnel'])
const MAX_EVENTS_PER_BATCH = 50

interface ClientEvent {
  event_type:   string
  category:     string
  action:       string
  label?:       string | null
  value?:       number | null
  page?:        string | null
  app_version?: string | null
}

interface IngestBody {
  session_id:   string
  user_id_hash?: string | null
  events:        ClientEvent[]
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function fail(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(withTelemetry('ingest-telemetry', async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return fail(405, 'POST only')

  let body: IngestBody
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Invalid JSON')
  }

  const { session_id, user_id_hash, events } = body

  if (!session_id || typeof session_id !== 'string') {
    return fail(400, 'session_id required')
  }
  if (!Array.isArray(events) || events.length === 0) {
    return ok({ ok: true, inserted: 0 })
  }
  if (events.length > MAX_EVENTS_PER_BATCH) {
    return fail(400, `Max ${MAX_EVENTS_PER_BATCH} events per batch`)
  }

  // Validate and sanitise each event
  const rows = []
  for (const ev of events) {
    if (!VALID_EVENT_TYPES.has(ev.event_type)) continue
    if (!ev.category || !ev.action) continue

    rows.push({
      session_id,
      user_id_hash: user_id_hash ?? null,
      event_type:   ev.event_type,
      category:     String(ev.category).slice(0, 80),
      action:       String(ev.action).slice(0, 80),
      label:        ev.label   ? String(ev.label).slice(0, 200)   : null,
      value:        typeof ev.value === 'number' ? ev.value : null,
      page:         ev.page         ? String(ev.page).slice(0, 200)        : null,
      app_version:  ev.app_version  ? String(ev.app_version).slice(0, 20)  : null,
    })
  }

  if (rows.length === 0) return ok({ ok: true, inserted: 0 })

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { error } = await supa.from('client_events').insert(rows)
  if (error) {
    console.error('client_events insert failed:', error.message)
    return fail(500, 'DB insert failed')
  }

  return ok({ ok: true, inserted: rows.length })
}))
