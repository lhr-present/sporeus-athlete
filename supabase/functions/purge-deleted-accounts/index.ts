// purge-deleted-accounts/index.ts — KVKK/GDPR account deletion worker
// Cron-triggered daily at 04:00 UTC. Processes data_rights_requests where
// kind='deletion', status='pending', scheduled_purge_at <= now().
// Calls purge_user() SQL function, then auth.admin.deleteUser().
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (optional)

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')              ?? ''
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const resendKey   = Deno.env.get('RESEND_API_KEY')            ?? ''
  const svc         = createClient(supabaseUrl, serviceKey)

  const now = new Date().toISOString()

  // ── Find accounts past grace period ───────────────────────────────────────
  const { data: due, error: fetchErr } = await svc
    .from('data_rights_requests')
    .select('id, user_id, scheduled_purge_at')
    .eq('kind', 'deletion')
    .eq('status', 'pending')
    .lte('scheduled_purge_at', now)
    .limit(20)  // cap per run to stay within function timeout

  if (fetchErr) {
    console.error(JSON.stringify({ fn: 'purge-deleted-accounts', error: fetchErr.message }))
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 })
  }

  if (!due?.length) {
    return new Response(JSON.stringify({ purged: 0 }), { status: 200 })
  }

  const results: Array<{ user_id: string; purged: boolean; error?: string }> = []

  for (const entry of due) {
    const userId = entry.user_id
    try {
      // ── 1. Delete storage objects ──────────────────────────────────────────
      const { data: exportFiles } = await svc.storage
        .from('user-exports').list(`user-${userId}`)
      if (exportFiles?.length) {
        await svc.storage.from('user-exports')
          .remove(exportFiles.map((f: { name: string }) => `user-${userId}/${f.name}`))
      }
      try {
        const { data: actFiles } = await svc.storage.from('activity-files').list(userId)
        if (actFiles?.length) {
          await svc.storage.from('activity-files')
            .remove(actFiles.map((f: { name: string }) => `${userId}/${f.name}`))
        }
      } catch { /* bucket may not exist in all envs */ }

      // ── 2. Get email before purging profiles ───────────────────────────────
      const { data: { user: authUser } } = await svc.auth.admin.getUserById(userId)
      const userEmail = authUser?.email ?? ''

      // ── 3. App-level cascade via SQL (dependency-safe) ────────────────────
      const { data: purgeResult } = await svc.rpc('purge_user', { p_user_id: userId })

      if (!purgeResult?.ok) {
        throw new Error(purgeResult?.error ?? 'purge_user returned ok=false')
      }

      // ── 4. Mark request completed BEFORE deleting auth row ────────────────
      await svc.from('data_rights_requests').update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        notes:        'Purged by purge-deleted-accounts cron',
      }).eq('id', entry.id)

      // ── 5. Delete auth.users (last — cascades remaining FK refs) ──────────
      await svc.auth.admin.deleteUser(userId)

      // ── 6. Send confirmation email (best-effort) ───────────────────────────
      if (resendKey && userEmail) {
        await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body:    JSON.stringify({
            from:    'Sporeus <noreply@sporeus.com>',
            to:      [userEmail],
            subject: 'Your Sporeus account has been deleted',
            text:    'Your account and all associated data have been permanently deleted as requested. Contact support@sporeus.com if you have questions.',
          }),
        }).catch(() => {})
      }

      results.push({ user_id: userId, purged: true })
    } catch (e) {
      const msg = (e as Error).message
      await svc.from('data_rights_requests').update({
        status: 'failed', notes: msg,
      }).eq('id', entry.id).catch(() => {})
      console.error(JSON.stringify({ fn: 'purge-deleted-accounts', user_id: userId, error: msg }))
      results.push({ user_id: userId, purged: false, error: msg })
    }
  }

  const purgedCount = results.filter(r => r.purged).length
  console.log(JSON.stringify({ fn: 'purge-deleted-accounts', purged: purgedCount, total: due.length }))
  return new Response(JSON.stringify({ purged: purgedCount, results }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
})
