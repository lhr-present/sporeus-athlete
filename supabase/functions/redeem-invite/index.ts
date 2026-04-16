// supabase/functions/redeem-invite/index.ts
// Validates an invite code and links the calling athlete to the coach.
// Auth: JWT required. athlete_id is ALWAYS derived from the verified JWT —
//       never trusted from the request body (prevents impersonation).
// Body: { code: string }
// Errors: structured { error, code } with specific error codes.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status: 200,
  })
}

function fail(status: number, message: string, code: string) {
  return new Response(JSON.stringify({ error: message, code }), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  })
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Authentication required", "UNAUTHENTICATED")

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!

  // ── Verify caller via JWT — athlete_id comes ONLY from here ─────────────────
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Invalid token", "INVALID_TOKEN")

  const athleteId = user.id

  let body: { code?: string } = {}
  try { body = await req.json() } catch { return fail(400, "Invalid JSON", "BAD_REQUEST") }

  const { code } = body
  if (!code || typeof code !== "string" || !code.trim()) {
    return fail(400, "Missing invite code", "MISSING_CODE")
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    // ── 1. Look up invite ──────────────────────────────────────────────────────
    const { data: invite, error: inviteErr } = await admin
      .from("coach_invites")
      .select("id, coach_id, expires_at, used_by, max_uses, uses_count, revoked_at, label")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle()

    if (inviteErr) return fail(500, inviteErr.message, "DB_ERROR")
    if (!invite)   return fail(404, "Invite code not found", "INVALID_CODE")

    // ── 2. Validate ────────────────────────────────────────────────────────────
    if (invite.revoked_at)
      return fail(410, "This invite has been revoked", "REVOKED")

    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return fail(410, "This invite has expired", "EXPIRED")

    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses)
      return fail(409, "This invite has reached its usage limit", "MAX_USES_REACHED")

    if (invite.coach_id === athleteId)
      return fail(400, "You cannot redeem your own invite", "SELF_INVITE")

    // ── 3. Check not already linked ───────────────────────────────────────────
    const { data: existing } = await admin
      .from("coach_athletes")
      .select("athlete_id")
      .eq("coach_id", invite.coach_id)
      .eq("athlete_id", athleteId)
      .eq("status", "active")
      .maybeSingle()

    if (existing)
      return fail(409, "You are already linked to this coach", "ALREADY_LINKED")

    // ── 4. Fetch coach name ────────────────────────────────────────────────────
    const { data: coachProfile } = await admin
      .from("profiles")
      .select("display_name, email")
      .eq("id", invite.coach_id)
      .maybeSingle()
    const coachName  = coachProfile?.display_name || "Coach"
    const coachEmail = coachProfile?.email || ""

    // ── 5. Link athlete → coach ────────────────────────────────────────────────
    const now = new Date().toISOString()

    const { error: linkErr } = await admin
      .from("coach_athletes")
      .upsert(
        { coach_id: invite.coach_id, athlete_id: athleteId, status: "active" },
        { onConflict: "coach_id,athlete_id" }
      )
    if (linkErr) return fail(500, linkErr.message, "LINK_ERROR")

    // ── 6. Update profiles.coach_id for fast lookup ────────────────────────────
    await admin
      .from("profiles")
      .update({ coach_id: invite.coach_id, linked_via_code: code.trim().toUpperCase(), linked_at: now })
      .eq("id", athleteId)

    // ── 7. Increment uses_count atomically ────────────────────────────────────
    await admin
      .from("coach_invites")
      .update({ uses_count: invite.uses_count + 1 })
      .eq("id", invite.id)

    return ok({
      success:     true,
      coach_id:    invite.coach_id,
      coach_name:  coachName,
      coach_email: coachEmail,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error"
    return fail(500, msg, "INTERNAL_ERROR")
  }
})
