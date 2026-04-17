// supabase/functions/enqueue-ai-batch/index.ts — pgmq ai_batch producer
// Cron: 0 3 * * * (daily 03:00 UTC)
// On Sunday: loops all coaches, enqueues one weekly_digest message per coach to ai_batch.
// Exits in < 30s. Processing is done by ai-batch-worker (every minute).

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function jwtRole(h: string | null): string | null {
  try {
    if (!h) return null
    const p = JSON.parse(atob(h.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    return p.role || null
  } catch { return null }
}

function getWeekStart(dateStr: string): string {
  const d    = new Date(dateStr + "T12:00:00Z")
  const day  = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon  = new Date(d)
  mon.setUTCDate(d.getUTCDate() + diff)
  return mon.toISOString().slice(0, 10)
}

serve(withTelemetry('enqueue-ai-batch', async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  if (jwtRole(req.headers.get("authorization")) !== "service_role") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sb          = createClient(supabaseUrl, serviceKey)

  const today    = new Date().toISOString().slice(0, 10)
  const isSunday = new Date(today + "T12:00:00Z").getUTCDay() === 0

  // Only produce weekly_digest messages on Sunday
  if (!isSunday) {
    return new Response(
      JSON.stringify({ enqueued: 0, skipped: true, reason: "not_sunday" }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  const weekStart = getWeekStart(today)

  // Fetch all coaches
  const { data: coaches, error: coachErr } = await sb
    .from("profiles")
    .select("id, display_name")
    .eq("role", "coach")

  if (coachErr) {
    return new Response(JSON.stringify({ error: coachErr.message }), { status: 500 })
  }

  let enqueued = 0
  const start  = Date.now()

  for (const coach of coaches ?? []) {
    // Abort if approaching 25s wall to stay under Supabase's 30s limit
    if (Date.now() - start > 25_000) {
      console.warn(`enqueue-ai-batch: time budget reached after ${enqueued} messages`)
      break
    }

    // Skip coaches with no active athletes (avoid wasteful messages)
    const { count } = await sb
      .from("coach_athletes")
      .select("athlete_id", { count: "exact", head: true })
      .eq("coach_id", coach.id)
      .eq("status", "active")

    if (!count || count === 0) continue

    const { error: sendErr } = await sb.rpc("enqueue_ai_batch", {
      p_payload: {
        coach_id:    coach.id,
        coach_name:  coach.display_name ?? coach.id.slice(0, 8),
        kind:        "weekly_digest",
        week_start:  weekStart,
        retry_count: 0,
        enqueued_at: new Date().toISOString(),
      },
      p_delay_s: 0,
    })

    if (sendErr) {
      console.error(`enqueue-ai-batch: failed to enqueue coach ${coach.id}: ${sendErr.message}`)
    } else {
      enqueued++
    }
  }

  const ms = Date.now() - start
  console.log(`enqueue-ai-batch [${today}]: enqueued=${enqueued} week_start=${weekStart} ms=${ms}`)

  return new Response(
    JSON.stringify({ enqueued, week_start: weekStart, ms }),
    { headers: { "Content-Type": "application/json" } },
  )
}))
