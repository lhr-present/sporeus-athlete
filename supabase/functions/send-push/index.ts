// supabase/functions/send-push/index.ts
// Sends Web Push notifications to a user or coach's athletes.
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@email.com)
// Called by: coaches to notify athletes, system triggers (injury alert, race countdown)

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

// Build a JWT for VAPID authentication
async function buildVapidJwt(endpoint: string, subject: string, publicKey: string, privateKeyB64: string): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const expSeconds = Math.floor(Date.now() / 1000) + 12 * 3600 // 12h

  const header = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const payload = btoa(JSON.stringify({ aud: audience, exp: expSeconds, sub: subject }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const sigInput = `${header}.${payload}`

  // Import EC private key
  const rawKey = Uint8Array.from(atob(privateKeyB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", rawKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  )
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(sigInput)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  return `${sigInput}.${sigB64}`
}

// Send a push message to a single subscription
async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublic: string,
  vapidPrivate: string,
  vapidSubject: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const jwt = await buildVapidJwt(subscription.endpoint, vapidSubject, vapidPublic, vapidPrivate)

    const resp = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        "Authorization": `vapid t=${jwt},k=${vapidPublic}`,
        "TTL": "86400",
      },
      body: new TextEncoder().encode(payload),
    })

    if (resp.status === 410 || resp.status === 404) {
      return { ok: false, error: "subscription_expired" }
    }
    if (!resp.ok) {
      return { ok: false, error: `push_failed:${resp.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Unauthorized")

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") || ""
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || ""
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@sporeus.com"

  if (!vapidPublic || !vapidPrivate) return fail(500, "VAPID keys not configured")

  // Verify calling user
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Invalid token")

  const admin = createClient(supabaseUrl, serviceKey)

  let body: { target_user_id?: string; title?: string; body?: string; url?: string; tag?: string } = {}
  try { body = await req.json() } catch {}

  const { target_user_id, title, body: msgBody, url, tag } = body
  if (!target_user_id || !title) return fail(400, "Missing target_user_id or title")

  // Coach must have an active athlete relationship
  const { data: rel } = await admin
    .from("coach_athletes")
    .select("status")
    .eq("coach_id", user.id)
    .eq("athlete_id", target_user_id)
    .eq("status", "active")
    .maybeSingle()

  const isSelf = user.id === target_user_id
  if (!rel && !isSelf) return fail(403, "Not authorized to notify this user")

  // Get subscriptions for target user
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, keys")
    .eq("user_id", target_user_id)

  if (!subs?.length) return ok({ sent: 0, message: "No subscriptions" })

  const payload = JSON.stringify({ title, body: msgBody || "", url: url || "/", tag: tag || "sporeus" })

  let sent = 0
  const expired: string[] = []
  for (const sub of subs) {
    const result = await sendPush(sub as any, payload, vapidPublic, vapidPrivate, vapidSubject)
    if (result.ok) {
      sent++
    } else if (result.error === "subscription_expired") {
      expired.push(sub.endpoint)
    }
  }

  // Clean up expired subscriptions
  if (expired.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", expired)
  }

  return ok({ sent, total: subs.length, expired: expired.length })
})
