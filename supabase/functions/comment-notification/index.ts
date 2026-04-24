// supabase/functions/comment-notification/index.ts
// E11 — Sends push notification when a new comment is posted on a session.
//
// Trigger: Database Webhook on session_comments INSERT (set up in Supabase dashboard)
// Auth:    Service role (sent by Supabase webhook with service_role key)
//
// Logic:
//   1. Look up the session owner (training_log.user_id)
//   2. Determine who to notify:
//      - If commenter = session owner → notify their active coach(es)
//      - If commenter = coach → notify the session owner (athlete)
//   3. Call send-push edge function for each recipient
//
// Privacy: never include raw comment body in push title — only summary.

import { withTelemetry } from '../_shared/telemetry.ts'
import { serve }          from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient }   from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
    status: 200,
  })
}

function fail(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
    status,
  })
}

serve(withTelemetry('comment-notification', async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const fnUrl        = `${supabaseUrl}/functions/v1/send-push`
  // DB webhook delivers a hardcoded service_role JWT in Authorization; forward it
  // directly to send-push so edge-to-edge auth never depends on SUPABASE_SERVICE_ROLE_KEY.
  const webhookAuth  = req.headers.get('Authorization') || `Bearer ${serviceKey}`

  // Database Webhook sends the row as JSON body
  const body = await req.json().catch(() => null)

  // Support both webhook format { record } and direct call { record }
  const record = body?.record ?? body
  if (!record?.id || !record?.session_id || !record?.author_id) {
    return fail(400, 'missing record fields')
  }

  // Skip notifications for edited/deleted comments (webhook fires on INSERT only)
  if (record.deleted_at) return ok({ skipped: 'deleted' })

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── Resolve session owner ─────────────────────────────────────────────────────
  const { data: session, error: sessionErr } = await db
    .from('training_log')
    .select('user_id')
    .eq('id', record.session_id)
    .maybeSingle()

  if (sessionErr || !session) {
    console.warn('[comment-notification] session not found', record.session_id)
    return ok({ skipped: 'session_not_found' })
  }

  const sessionOwnerId = session.user_id
  const commenterId    = record.author_id

  // Don't notify if commenter = session owner and no coach link exists
  const recipients: string[] = []

  if (commenterId === sessionOwnerId) {
    // Athlete commented on own session → notify their coach(es)
    const { data: links } = await db
      .from('coach_athletes')
      .select('coach_id')
      .eq('athlete_id', sessionOwnerId)
      .eq('status', 'active')

    for (const link of links ?? []) {
      if (link.coach_id !== commenterId) recipients.push(link.coach_id)
    }
  } else {
    // Someone else (likely coach) commented → notify session owner
    recipients.push(sessionOwnerId)
  }

  if (recipients.length === 0) return ok({ skipped: 'no_recipients' })

  // ── Fetch commenter display name ──────────────────────────────────────────────
  const { data: commenterProfile } = await db
    .from('profiles')
    .select('display_name')
    .eq('id', commenterId)
    .maybeSingle()

  const commenterName = commenterProfile?.display_name || 'Someone'
  // Never include comment body in push — keep it minimal
  const pushTitle = `${commenterName} added a comment`
  const pushBody  = 'Tap to view the session.'

  // ── Send push to each recipient ───────────────────────────────────────────────
  const authHeader = webhookAuth
  const pushResults = await Promise.allSettled(
    recipients.map(userId =>
      fetch(fnUrl, {
        method:  'POST',
        headers: { ...CORS, Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:    userId,
          kind:       'message',
          title:      pushTitle,
          body:       pushBody,
          data:       { session_id: record.session_id, comment_id: record.id },
          dedupe_key: `comment:${record.id}`,
          dedupe_window_hours: 1,
        }),
      })
    )
  )

  const sent   = pushResults.filter(r => r.status === 'fulfilled').length
  const failed = pushResults.filter(r => r.status === 'rejected').length

  return ok({ sent, failed, recipients: recipients.length })
}))
