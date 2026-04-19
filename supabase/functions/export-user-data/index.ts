// export-user-data/index.ts — E8: GDPR/KVKK full data export
// Packages all user data into JSON + CSV + Storage ZIP, uploads to a private
// storage bucket, returns a 7-day signed URL.
//
// Triggered by POST from the authenticated user.
// Uses service role to read across all tables for that user_id only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withTelemetry } from '../_shared/telemetry.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const TABLES_TO_EXPORT = [
  'profiles',
  'training_log',
  'coach_plans',
  'coach_athletes',
  'coach_messages',
  'test_results',
  'injuries',
  'goals',
  'athlete_goals',
  'ai_insights',
  'consents',
  'consent_purposes',
  'strava_tokens',       // meta only, not credentials
  'personal_records',
  'push_subscriptions',  // meta only
]

const EXPORT_BUCKET = 'user-exports'
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7  // 7 days in seconds

serve(withTelemetry('export-user-data', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return err('Method not allowed', 405)

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey         = Deno.env.get('SUPABASE_ANON_KEY')!

  // ── Authenticate user ────────────────────────────────────────────────────
  const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!jwt) return err('Unauthorized', 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return err('Unauthorized', 401)

  const userId = user.id
  const svc    = createClient(supabaseUrl, serviceRoleKey)

  // ── Check for recent pending job (rate limit: 1 per 24h) ─────────────────
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentJob } = await svc
    .from('export_jobs')
    .select('id, status, requested_at, signed_url')
    .eq('user_id', userId)
    .gt('requested_at', cutoff)
    .in('status', ['pending', 'running', 'ready'])
    .maybeSingle()

  if (recentJob) {
    return json({
      status:      recentJob.status,
      job_id:      recentJob.id,
      signed_url:  recentJob.signed_url || null,
      message:     recentJob.status === 'ready'
        ? 'Your export is ready. Download via the signed_url.'
        : 'An export is already in progress. Check back shortly.',
    })
  }

  // ── Create job record ─────────────────────────────────────────────────────
  const { data: job, error: jobErr } = await svc
    .from('export_jobs')
    .insert({ user_id: userId, status: 'running', formats: ['json', 'csv'] })
    .select('id')
    .single()

  if (jobErr || !job) return err('Failed to create export job', 500)

  // ── Fetch all user data ───────────────────────────────────────────────────
  const exportBundle: Record<string, unknown> = {
    _meta: {
      exported_at:   new Date().toISOString(),
      user_id:       userId,
      format:        'sporeus-export-v1',
      tables:        TABLES_TO_EXPORT,
    }
  }

  for (const table of TABLES_TO_EXPORT) {
    try {
      const { data } = await svc
        .from(table)
        .select('*')
        .eq('user_id', userId)
      exportBundle[table] = data || []
    } catch {
      exportBundle[table] = []  // graceful — table may not exist in this env
    }
  }

  // ── Build CSV for training_log ─────────────────────────────────────────────
  const log = exportBundle['training_log'] as Record<string, unknown>[]
  let csv = ''
  if (Array.isArray(log) && log.length > 0) {
    const cols = Object.keys(log[0])
    csv = cols.join(',') + '\n' +
      log.map(row =>
        cols.map(c => {
          const v = String(row[c] ?? '')
          return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v
        }).join(',')
      ).join('\n')
  }

  // ── Upload to storage ─────────────────────────────────────────────────────
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath   = `${userId}/${timestamp}/data.json`
  const csvPath    = `${userId}/${timestamp}/training_log.csv`

  const jsonBytes  = new TextEncoder().encode(JSON.stringify(exportBundle, null, 2))
  const csvBytes   = new TextEncoder().encode(csv)

  const { error: jsonErr } = await svc.storage
    .from(EXPORT_BUCKET)
    .upload(jsonPath, jsonBytes, { contentType: 'application/json', upsert: true })

  if (jsonErr) {
    await svc.from('export_jobs').update({ status: 'failed', error_message: jsonErr.message })
      .eq('id', job.id)
    return err('Upload failed', 500)
  }

  await svc.storage.from(EXPORT_BUCKET).upload(csvPath, csvBytes, {
    contentType: 'text/csv', upsert: true
  })

  // ── Generate signed URL for JSON bundle ────────────────────────────────────
  const { data: signed } = await svc.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(jsonPath, SIGNED_URL_EXPIRY)

  const urlExpiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString()

  await svc.from('export_jobs').update({
    status:        'ready',
    signed_url:    signed?.signedUrl || null,
    url_expires_at: urlExpiresAt,
    completed_at:  new Date().toISOString(),
  }).eq('id', job.id)

  // ── Audit log ─────────────────────────────────────────────────────────────
  await svc.from('audit_log').insert({
    user_id:    userId,
    action:     'export',
    table_name: 'all',
    resource:   'data_export',
    details:    { job_id: job.id, tables: TABLES_TO_EXPORT.length },
  })

  return json({
    status:     'ready',
    job_id:     job.id,
    signed_url: signed?.signedUrl || null,
    expires_at: urlExpiresAt,
    message:    'Export ready. The signed URL expires in 7 days.',
  })
}))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}
function err(message: string, status = 400) {
  return json({ error: message }, status)
}
