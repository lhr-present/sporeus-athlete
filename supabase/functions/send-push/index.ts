// supabase/functions/send-push/index.ts
// Sends Web Push notifications. Handles VAPID signing + payload encryption via web-push npm.
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Body shape: { user_id, kind?, title, body?, data?, dedupe_key?, dedupe_window_hours? }
// Auth: user JWT (coach→athlete or self) OR service role key (system/cron calls).

// Requires Deno 1.30+ for npm: imports (Supabase runtime satisfies this)
import webPush from "npm:web-push@3.6.7"
import { withTelemetry } from '../_shared/telemetry.ts'
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  })
}
function fail(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}

type NotifKind =
  | 'checkin_reminder' | 'invite_accepted' | 'readiness_red' | 'session_feedback'
  | 'missed_checkin' | 'test' | 'race_countdown' | 'injury_alert' | 'system' | 'message'

const VALID_KINDS = new Set<string>([
  'checkin_reminder','invite_accepted','readiness_red','session_feedback',
  'missed_checkin','test','race_countdown','injury_alert','system','message',
])

// Decode a JWT and return the `role` claim without signature verification.
// Used to detect service_role callers (cron, edge-to-edge). Signature verification
// is handled by the Supabase gateway; we only need the claim here.
function jwtRole(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "")
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    return payload.role || null
  } catch { return null }
}

serve(withTelemetry('send-push', async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Unauthorized")

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!
  const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY")  || ""
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || ""
  const vapidSubject = Deno.env.get("VAPID_SUBJECT")     || "mailto:admin@sporeus.com"

  if (!vapidPublic || !vapidPrivate) return fail(500, "VAPID keys not configured")

  // ── Auth: service_role JWT (cron/edge calls) or user JWT ─────────────────────
  const isSystemCall = jwtRole(authHeader) === "service_role"
  const admin = createClient(supabaseUrl, serviceKey)

  let callerUserId: string | null = null
  if (!isSystemCall) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) return fail(401, "Invalid token")
    callerUserId = user.id
  }

  let reqBody: {
    user_id?: string
    target_user_id?: string
    kind?: string
    title?: string
    body?: string
    data?: Record<string, unknown>
    dedupe_key?: string
    dedupe_window_hours?: number
    url?: string
    tag?: string
  } = {}
  try { reqBody = await req.json() } catch { return fail(400, "Invalid JSON") }

  const targetId = reqBody.user_id || reqBody.target_user_id
  if (!targetId) return fail(400, "Missing user_id")

  const title    = reqBody.title || "Sporeus"
  const msgBody  = reqBody.body  || ""
  const kind     = VALID_KINDS.has(reqBody.kind || "") ? (reqBody.kind as NotifKind) : "system"
  const pushData = reqBody.data  || {}
  const route    = (pushData as any).route || reqBody.url || "/"

  // ── Authorization: user must be self or active coach of target ────────────────
  if (!isSystemCall) {
    const isSelf = callerUserId === targetId
    if (!isSelf) {
      const { data: rel } = await admin
        .from("coach_athletes")
        .select("status")
        .eq("coach_id", callerUserId!)
        .eq("athlete_id", targetId)
        .eq("status", "active")
        .maybeSingle()
      if (!rel) return fail(403, "Not authorized to notify this user")
    }
  }

  // ── Dedupe check ──────────────────────────────────────────────────────────────
  const dedupeKey   = reqBody.dedupe_key
  const windowHours = reqBody.dedupe_window_hours ?? 24

  if (dedupeKey) {
    const windowStart = new Date(Date.now() - windowHours * 3600000).toISOString()
    const { data: dup } = await admin
      .from("notification_log")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .not("delivery_status", "eq", "failed")
      .gte("sent_at", windowStart)
      .maybeSingle()

    if (dup) {
      await admin.from("notification_log").insert({
        user_id:         targetId,
        kind,
        dedupe_key:      dedupeKey,
        payload:         { title, body: msgBody },
        delivery_status: "deduped",
      })
      return ok({ skipped: true, reason: "deduped" })
    }
  }

  // ── Load subscriptions ────────────────────────────────────────────────────────
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, keys")
    .eq("user_id", targetId)

  if (!subs?.length) {
    return ok({ sent: 0, total: 0, message: "No subscriptions for user" })
  }

  // ── Configure VAPID ───────────────────────────────────────────────────────────
  webPush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  // ── Push payload — NO PII: only title, body, kind, deep-link route ───────────
  const notifPayload = JSON.stringify({
    title,
    body: msgBody,
    kind,
    data: { route, ...Object.fromEntries(
      Object.entries(pushData).filter(([k]) => !['route'].includes(k))
    ) },
  })

  let sent = 0
  const expired: string[] = []
  const rateLimited: string[] = []
  let deliveryStatus: string = "delivered"
  let errorMsg: string | undefined

  for (const sub of subs as Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        notifPayload,
      )
      await admin
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString() })
        .eq("endpoint", sub.endpoint)
      sent++
    } catch (err: any) {
      const status = err.statusCode || err.status
      if (status === 410 || status === 404) {
        expired.push(sub.endpoint)
      } else if (status === 429) {
        rateLimited.push(sub.endpoint)
        deliveryStatus = "failed"
        errorMsg = `rate_limited`
      } else {
        deliveryStatus = "failed"
        errorMsg = String(err.message || err).slice(0, 200)
      }
    }
  }

  if (expired.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", expired)
    if (sent === 0 && rateLimited.length === 0) deliveryStatus = "expired_subscription"
  }
  if (sent > 0) deliveryStatus = "delivered"

  // ── Insert notification_log row ───────────────────────────────────────────────
  await admin.from("notification_log").insert({
    user_id:         targetId,
    kind,
    dedupe_key:      dedupeKey ?? null,
    payload:         { title, body: msgBody },
    delivery_status: deliveryStatus,
    error:           errorMsg ?? null,
  })

  return ok({
    sent,
    total:       subs.length,
    expired:     expired.length,
    rateLimited: rateLimited.length,
    status:      deliveryStatus,
  })
}))
