// export-user-data/index.ts — KVKK/GDPR data portability (Article 20 / Law 6698 Art.11)
// Authenticated by user bearer JWT. Calls build_user_export() SQL function,
// uploads result to user-exports bucket, returns 7-day signed URL.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const EXPORT_BUCKET   = 'user-exports'
const SIGNED_URL_SECS = 60 * 60 * 24 * 7  // 7 days

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')              ?? ''
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')         ?? ''
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // ── Authenticate user ──────────────────────────────────────────────────────
  const bearer = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!bearer) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const userId = user.id
  const svc    = createClient(supabaseUrl, serviceKey)
  const now    = new Date()

  // ── Rate-limit: one in-flight export per user ──────────────────────────────
  const { data: inflight } = await svc
    .from('data_rights_requests')
    .select('id, status')
    .eq('user_id', userId)
    .eq('kind', 'export')
    .in('status', ['pending', 'processing'])
    .maybeSingle()

  if (inflight) {
    return json({ status: inflight.status, request_id: inflight.id,
                  message: 'Export already in progress.' })
  }

  // ── Create request row ─────────────────────────────────────────────────────
  const { data: reqRow, error: reqErr } = await svc
    .from('data_rights_requests')
    .insert({ user_id: userId, kind: 'export', status: 'processing' })
    .select('id').single()

  if (reqErr || !reqRow) return json({ error: 'Failed to create request' }, 500)
  const reqId = reqRow.id

  // ── Collect all user data via SQL function ─────────────────────────────────
  const { data: exportData, error: exportErr } = await svc.rpc('build_user_export', {
    p_user_id: userId,
  })

  if (exportErr) {
    await svc.from('data_rights_requests').update({
      status: 'failed', notes: exportErr.message, completed_at: now.toISOString(),
    }).eq('id', reqId)
    console.error(JSON.stringify({ fn: 'export-user-data', error: exportErr.message }))
    return json({ error: 'Export failed' }, 500)
  }

  // ── Upload to user-exports bucket ──────────────────────────────────────────
  const ts      = now.toISOString().replace(/[:.]/g, '-')
  const path    = `user-${userId}/${ts}.json`
  const bytes   = new TextEncoder().encode(JSON.stringify(exportData, null, 2))

  const { error: uploadErr } = await svc.storage
    .from(EXPORT_BUCKET)
    .upload(path, bytes, { contentType: 'application/json', upsert: true })

  if (uploadErr) {
    await svc.from('data_rights_requests').update({
      status: 'failed', notes: uploadErr.message, completed_at: now.toISOString(),
    }).eq('id', reqId)
    return json({ error: 'Upload failed' }, 500)
  }

  // ── Generate 7-day signed URL ──────────────────────────────────────────────
  const { data: signed } = await svc.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECS)

  const expiresAt = new Date(Date.now() + SIGNED_URL_SECS * 1000).toISOString()

  await svc.from('data_rights_requests').update({
    status:            'completed',
    export_url:        signed?.signedUrl ?? null,
    export_expires_at: expiresAt,
    completed_at:      now.toISOString(),
  }).eq('id', reqId)

  // ── Audit log ──────────────────────────────────────────────────────────────
  await svc.from('audit_log').insert({
    user_id:    userId,
    action:     'export',
    table_name: 'all',
    resource:   'data_export',
    actor_role: 'user',
    details:    { request_id: reqId },
  }).catch(() => {})

  console.log(JSON.stringify({ fn: 'export-user-data', user_id: userId, request_id: reqId }))

  return json({
    download_url: signed?.signedUrl ?? null,
    expires_at:   expiresAt,
    request_id:   reqId,
  })
})
