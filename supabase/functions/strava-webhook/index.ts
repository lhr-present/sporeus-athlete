// supabase/functions/strava-webhook/index.ts — Strava push-subscription callback.
//
// GET  = subscription validation handshake (echo hub.challenge when verify_token matches).
// POST = activity event → enqueue a small recent-window backfill for that athlete's
//        user, so NEW activities import in near-real-time (no more stale log after the
//        one-time 90-day backfill). Reuses the proven strava_backfill pipeline (idempotent
//        upsert on user_id,external_id).
//
// PUBLIC endpoint (Strava calls it with no JWT) — deploy with `--no-verify-jwt`. Strava
// webhooks are UNSIGNED by design, so every POST must be treated as attacker-forgeable
// (athlete ids are enumerable). Guards (hardened per audit 2026-07-03):
//   • enqueue only for owner_ids that map to a real connected user, AND at most one
//     webhook-driven enqueue per user per THROTTLE_SECONDS — claimed via one atomic
//     conditional UPDATE on strava_tokens.webhook_last_enqueue_at, so a forged-event
//     flood can neither grow the queue unbounded nor burn the shared strava_rate_state
//     API budget. Coalescing is lossless: the worker runs every 2 min and each enqueue
//     imports a 2-day window, so a suppressed event is covered by any later enqueue
//     (or by the client's reconcile-on-load / manual sync).
//   • athlete-deauth events are advisory-only (NO DB write): an unsigned event must not
//     be able to flip a victim's connection into an error state. Real revocations are
//     detected authoritatively by the worker/oauth token-refresh path.
//   • GET verify_token comparison is constant-time (digest compare).

import { serve }         from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry } from "../_shared/telemetry.ts"
import { createClient }  from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY  = (Deno.env.get("SPOREUS_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
const VERIFY_TOKEN = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") || ""

// One webhook-driven enqueue per user per this window. Matches the backfill worker's
// 2-min cron cadence — more frequent enqueues add queue rows but no fresher imports.
const THROTTLE_SECONDS = 120

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Constant-time-ish equality: compare fixed-length digests, not raw strings.
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)])
  let diff = 0
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i)
  return diff === 0
}

serve(withTelemetry("strava-webhook", async (req) => {
  const url = new URL(req.url)

  // ── Subscription validation handshake (Strava GET) ──────────────────────────
  if (req.method === "GET") {
    const mode      = url.searchParams.get("hub.mode")
    const token     = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")
    if (mode === "subscribe" && challenge && VERIFY_TOKEN && token && (await safeEqual(token, VERIFY_TOKEN))) {
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

      // Deauth events are advisory-only: unsigned + forgeable, so they must not
      // write anything. The token-refresh path surfaces real revocations.
      const isActivityEvent =
        ev?.owner_id &&
        ev.object_type === "activity" &&
        (ev.aspect_type === "create" || ev.aspect_type === "update")

      if (isActivityEvent) {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY)

        // Atomic throttle claim: update webhook_last_enqueue_at only if the row
        // maps to a real connected athlete AND the last claim is old enough.
        // A single conditional UPDATE = no race between concurrent events.
        const cutoff = new Date(Date.now() - THROTTLE_SECONDS * 1000).toISOString()
        const { data: claimed } = await admin
          .from("strava_tokens")
          .update({ webhook_last_enqueue_at: new Date().toISOString() })
          .eq("strava_athlete_id", ev.owner_id)
          .or(`webhook_last_enqueue_at.is.null,webhook_last_enqueue_at.lt.${cutoff}`)
          .select("user_id")

        const userId = claimed?.[0]?.user_id
        if (userId) {
          // Enqueue a small recent-window import (2 days covers the new/updated activity).
          const after = Math.floor(Date.now() / 1000) - 2 * 24 * 3600
          await admin.rpc("enqueue_strava_backfill", {
            p_payload: {
              user_id:     userId,
              page:        1,
              after,
              source:      "webhook",
              object_id:   ev.object_id,
              enqueued_at: new Date().toISOString(),
            },
          })
        }
      }
    } catch (_e) {
      // Always 200 so Strava doesn't retry-storm; enqueue is best-effort.
    }
    return new Response("ok", { status: 200 })
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 })
}))
