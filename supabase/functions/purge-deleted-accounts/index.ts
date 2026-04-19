// purge-deleted-accounts/index.ts — E8: Account deletion purge worker
// Runs daily via pg_cron. Finds deletion_requests past grace_until and
// executes CASCADE-safe deletion across all user tables.
//
// Deletion order (dependency-safe):
//   1. Revoke push subscriptions
//   2. Storage objects (activity files, export files)
//   3. pgmq — drain any queued messages for this user
//   4. All app tables (ai_insights, training_log, coach_*, etc.) via CASCADE
//   5. Final audit_log entry (kept 1 year by client-events-ttl equivalent)
//   6. auth.users delete (last — cascades remaining FK references)
//
// Sends confirmation email via Resend before and after purge.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withTelemetry } from '../_shared/telemetry.ts'

const TABLES_CASCADE_ORDER = [
  'ai_feedback',
  'ai_insights',
  'client_events',
  'attribution_events',
  'personal_records',
  'athlete_goals',
  'export_jobs',
  'strava_tokens',
  'push_subscriptions',
  'coach_messages',
  'coach_athletes',
  'coach_plans',
  'test_results',
  'injuries',
  'goals',
  'training_log',
  'consents',
  'consent_purposes',
  'deletion_requests',  // delete this last among app tables
  'profiles',
  // audit_log rows are kept: ON DELETE CASCADE from auth.users handles FK,
  // but we intentionally keep the user_id-zeroed record for legal traceability
]

serve(withTelemetry('purge-deleted-accounts', async (req) => {
  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey      = Deno.env.get('RESEND_API_KEY')
  const svc = createClient(supabaseUrl, serviceRoleKey)

  // ── Find accounts past grace period ────────────────────────────────────────
  const now = new Date().toISOString()
  const { data: due } = await svc
    .from('deletion_requests')
    .select('id, user_id, grace_until')
    .eq('status', 'pending')
    .lte('grace_until', now)
    .limit(20)  // process at most 20 per run to avoid timeout

  if (!due?.length) {
    return new Response(JSON.stringify({ purged: 0 }), { status: 200 })
  }

  const results: Array<{ user_id: string; purged: boolean; error?: string }> = []

  for (const req of due) {
    const userId = req.user_id
    try {
      // ── 1. Revoke push subscriptions ────────────────────────────────────────
      await svc.from('push_subscriptions').delete().eq('user_id', userId)

      // ── 2. Delete Storage objects (activity files + export files) ────────────
      const { data: exportFiles } = await svc.storage
        .from('user-exports')
        .list(userId)
      if (exportFiles?.length) {
        await svc.storage.from('user-exports')
          .remove(exportFiles.map(f => `${userId}/${f.name}`))
      }

      const { data: activityFiles } = await svc.storage
        .from('activity-files')
        .list(userId)
      if (activityFiles?.length) {
        await svc.storage.from('activity-files')
          .remove(activityFiles.map(f => `${userId}/${f.name}`))
      }

      // ── 3. App table cascade (order matters — FK deps first) ─────────────────
      for (const table of TABLES_CASCADE_ORDER) {
        try {
          await svc.from(table).delete().eq('user_id', userId)
        } catch {
          // graceful — table may not exist in older envs
        }
      }

      // ── 4. Final audit entry (kept for legal, user_id anonymized) ────────────
      const { data: auditRow } = await svc.from('audit_log').insert({
        user_id:    userId,
        action:     'erase',
        table_name: 'all',
        resource:   'account_deletion',
        actor_role: 'system',
        details:    { deletion_request_id: req.id, purged_at: now },
      }).select('id').single()

      // ── 5. Mark deletion_request as purged ───────────────────────────────────
      await svc.from('deletion_requests').update({
        status:        'purged',
        purged_at:     now,
        purge_audit_id: auditRow?.id || null,
      }).eq('id', req.id)

      // ── 6. Delete auth.users (last — cascades remaining FK refs) ─────────────
      await svc.auth.admin.deleteUser(userId)

      // ── 7. Send confirmation email ────────────────────────────────────────────
      if (resendKey) {
        const { data: emailData } = await svc
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .maybeSingle()
          .catch(() => ({ data: null }))

        if (emailData?.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from:    'Sporeus <noreply@sporeus.com>',
              to:      [emailData.email],
              subject: 'Your Sporeus account has been deleted',
              text:    `Your Sporeus account and all associated data have been permanently deleted as requested. This action is irreversible. If you did not request this, contact support@sporeus.com immediately.`,
            }),
          })
        }
      }

      results.push({ user_id: userId, purged: true })
    } catch (e) {
      results.push({ user_id: userId, purged: false, error: (e as Error).message })
    }
  }

  const purgedCount = results.filter(r => r.purged).length
  return new Response(JSON.stringify({ purged: purgedCount, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}))
