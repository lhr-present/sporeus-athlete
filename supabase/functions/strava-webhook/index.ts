// supabase/functions/strava-webhook/index.ts — Strava push-subscription callback.
//
// GET  = subscription validation handshake (echo hub.challenge when verify_token matches).
// POST = activity/athlete event → enqueue a small recent-window backfill for that athlete's
//        user, so NEW activities import in near-real-time (no more stale log after the
//        one-time 90-day backfill). Reuses the proven strava_backfill pipeline (idempotent
//        upsert on user_id,external_id).
//
// PUBLIC endpoint (Strava calls it with no JWT) — deploy with `--no-verify-jwt`. Abuse
// surface is minimal: POST only enqueues for owner_ids that map to a REAL connected user,
// the payload carries no attacker-controlled data that reaches the DB, and the backfill
// worker is itself rate-limited + idempotent. Strava webhooks are unsigned by design, so
// the GET verify_token + the owner_id→user lookup are the guards.

import { serve }         from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry } from "../_shared/telemetry.ts"
import { createClient }  from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY  = (Deno.env.get("SPOREUS_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
const VERIFY_TOKEN = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") || ""

serve(withTelemetry("strava-webhook", async (req) => {
  const url = new URL(req.url)

  // ── Subscription validation handshake (Strava GET) ──────────────────────────
  if (req.method === "GET") {
    const mode      = url.searchParams.get("hub.mode")
    const token     = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")
    if (mode === "subscribe" && challenge && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(JSON.stringify({ "hub.challenge": challenge }), {
        status: 200, headers: { "content-type": "application/json" },
      })
    }
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })
  }

  // ── Event delivery (Strava POST) — must ack within ~2s, so just enqueue ─────
  if (req.method === "POST") {
    try {
      const ev = (await req.json().catch(() => null)) as {
        object_type?: string
        aspect_type?: string
        owner_id?: number
        object_id?: number
        updates?: Record<string, unknown>
      } | null

      if (ev?.owner_id) {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY)
        const { data: tok } = await admin
          .from("strava_tokens")
          .select("user_id")
          .eq("strava_athlete_id", ev.owner_id)
          .maybeSingle()

        if (tok?.user_id) {
          if (ev.object_type === "athlete" && String(ev.updates?.authorized) === "false") {
            // Athlete revoked the app from their Strava account → surface it.
            await admin.from("strava_tokens").update({
              sync_status: "error",
              last_error:  "Strava access was revoked from your Strava account — reconnect to resume.",
            }).eq("user_id", tok.user_id)
          } else if (ev.object_type === "activity" && (ev.aspect_type === "create" || ev.aspect_type === "update")) {
            // Enqueue a small recent-window import (2 days covers the new/updated activity).
            const after = Math.floor(Date.now() / 1000) - 2 * 24 * 3600
            await admin.rpc("enqueue_strava_backfill", {
              p_payload: {
                user_id:     tok.user_id,
                page:        1,
                after,
                source:      "webhook",
                object_id:   ev.object_id,
                enqueued_at: new Date().toISOString(),
              },
            })
          }
        }
      }
    } catch (_e) {
      // Always 200 so Strava doesn't retry-storm; enqueue is best-effort.
    }
    return new Response("ok", { status: 200 })
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 })
}))
