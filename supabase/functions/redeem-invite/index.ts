// supabase/functions/redeem-invite/index.ts
// Validates an invite code, links athlete to coach, marks invite used.
// Auth: JWT required (athlete must be signed in).
// Body: { code: string, athlete_id: string }

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

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Unauthorized")

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!

  // Verify calling user via their JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Invalid token")

  const admin = createClient(supabaseUrl, serviceKey)

  let body: { code?: string; athlete_id?: string } = {}
  try { body = await req.json() } catch { return fail(400, "Invalid JSON") }

  const { code, athlete_id } = body
  if (!code || !athlete_id) return fail(400, "Missing code or athlete_id")

  try {
    // 1. Look up invite
    const { data: invite, error: inviteErr } = await admin
      .from("coach_invites")
      .select("id, coach_id, expires_at, used_by")
      .eq("code", code)
      .single()

    if (inviteErr || !invite) return fail(404, "Invalid invite")
    if (invite.used_by)                              return fail(409, "Invite already used")
    if (new Date(invite.expires_at) < new Date())    return fail(410, "Invite expired")

    // 2. Fetch coach display name
    const { data: coachProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", invite.coach_id)
      .single()
    const coachName = coachProfile?.display_name || "Coach"

    // 3. Link athlete to coach (idempotent)
    const { error: linkErr } = await admin
      .from("coach_athletes")
      .upsert(
        { coach_id: invite.coach_id, athlete_id, status: "active" },
        { onConflict: "coach_id,athlete_id" }
      )
    if (linkErr) return fail(500, linkErr.message)

    // 4. Mark invite as used
    const { error: updateErr } = await admin
      .from("coach_invites")
      .update({ used_by: athlete_id })
      .eq("code", code)
    if (updateErr) return fail(500, updateErr.message)

    return ok({ coach_id: invite.coach_id, coach_name: coachName, athlete_id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error"
    return fail(500, msg)
  }
})
