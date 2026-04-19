// supabase/functions/garmin-oauth/index.ts — E10: Garmin spike (PROTOTYPE)
// Handles Garmin Health API OAuth 2.0: connect, sync, disconnect.
//
// PROTOTYPE ONLY — not production code. Part of the v9 discovery spike.
// Decision gate: see docs/roadmap/garmin_spike_v9.md
//
// Garmin Health API OAuth 2.0 docs:
//   https://developer.garmin.com/health-api/getting-started/
//
// Secrets required (not yet set — spike only):
//   GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET
// Auto-provided by Supabase:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Garmin Health API OAuth 2.0 endpoints ─────────────────────────────────
const GARMIN_AUTH_BASE   = "https://connect.garmin.com"
const GARMIN_API_BASE    = "https://apis.garmin.com"
const GARMIN_AUTH_URL    = `${GARMIN_AUTH_BASE}/oauth-service/oauth/authorize`
const GARMIN_TOKEN_URL   = `${GARMIN_AUTH_BASE}/oauth-service/oauth/exchange/user/2.0`

// Garmin Health API v2 activity endpoint (requires separate health-api subscription)
// NOTE: Garmin requires developer program approval — not a public sandbox
const GARMIN_ACTIVITY_URL = `${GARMIN_API_BASE}/wellness-api/rest/activities`

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

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authHeader = req.headers.get("authorization") ?? ""
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!

  const garminClientId     = Deno.env.get("GARMIN_CLIENT_ID") ?? ""
  const garminClientSecret = Deno.env.get("GARMIN_CLIENT_SECRET") ?? ""

  // Prototype guard — GARMIN_CLIENT_ID not set in production
  if (!garminClientId) {
    return fail(501, "Garmin integration not yet enabled — prototype spike only")
  }

  // Auth: verify caller is a logged-in Sporeus user
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Unauthorized")

  const adminClient = createClient(supabaseUrl, serviceKey)

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? "connect"

  // ── connect: exchange auth code for tokens ─────────────────────────────
  if (action === "connect") {
    const { code } = await req.json().catch(() => ({}))
    if (!code) return fail(400, "code required")

    // Garmin OAuth 2.0 token exchange (PKCE not supported by Garmin — uses basic auth)
    const redirectUri = `${supabaseUrl}/functions/v1/garmin-oauth?action=callback`
    const basicAuth   = btoa(`${garminClientId}:${garminClientSecret}`)

    const tokenResp = await fetch(GARMIN_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    })

    if (!tokenResp.ok) {
      const err = await tokenResp.text()
      console.error("[garmin-oauth] token exchange failed:", err)
      return fail(502, "Garmin token exchange failed")
    }

    const tokens = await tokenResp.json()
    // tokens shape: { access_token, refresh_token, expires_in, token_type }

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    // Upsert into garmin_tokens table (see migration 20260460_garmin_tokens.sql)
    await adminClient.from("garmin_tokens").upsert({
      user_id:       user.id,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    expiresAt,
      scope:         tokens.scope ?? "",
      updated_at:    new Date().toISOString(),
    }, { onConflict: "user_id" })

    // Mark Garmin connected on profiles
    await adminClient.from("profiles")
      .update({ garmin_connected: true, garmin_connected_at: new Date().toISOString() })
      .eq("id", user.id)

    return ok({ connected: true })
  }

  // ── disconnect: revoke tokens and clear DB ─────────────────────────────
  if (action === "disconnect") {
    // Garmin does not expose a token revocation endpoint in Health API v2
    // Just clear our stored tokens
    await adminClient.from("garmin_tokens").delete().eq("user_id", user.id)
    await adminClient.from("profiles")
      .update({ garmin_connected: false, garmin_connected_at: null })
      .eq("id", user.id)
    return ok({ disconnected: true })
  }

  // ── status: check connection ───────────────────────────────────────────
  if (action === "status") {
    const { data: tokenRow } = await adminClient
      .from("garmin_tokens")
      .select("expires_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle()
    return ok({ connected: !!tokenRow, expires_at: tokenRow?.expires_at ?? null })
  }

  return fail(400, `Unknown action: ${action}`)
})
