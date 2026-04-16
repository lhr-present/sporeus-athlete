// supabase/functions/trigger-checkin-reminders/index.ts
// Cron-driven (hourly): sends check-in reminder push notifications.
// Reads preferred_checkin_time + timezone from profiles.profile_data.
// Dedupes per user per calendar day via notification_log.
//
// pg_cron schedule (run once via Dashboard SQL Editor):
//   SELECT cron.schedule(
//     'trigger-checkin-reminders', '0 * * * *',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/trigger-checkin-reminders',
//       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
//       body := '{}'::jsonb
//     )$$
//   );

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

// Get the user's local hour for a given IANA timezone string.
function getLocalHour(timezone: string): number {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const hourPart = parts.find(p => p.type === "hour")
    // "24" can appear for midnight in some locales; map to 0
    const h = parseInt(hourPart?.value || "0", 10)
    return h === 24 ? 0 : h
  } catch {
    // Unknown timezone — fall back to UTC hour
    return new Date().getUTCHours()
  }
}

// Get today's date string in a given timezone.
function getLocalDateStr(timezone: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    return formatter.format(now) // en-CA gives YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!

  // Only accept calls from the service role (cron or manual trigger)
  if (authHeader !== `Bearer ${serviceKey}`) return fail(401, "Unauthorized")

  const admin = createClient(supabaseUrl, serviceKey)

  // ── Query users with checkin_reminder enabled ─────────────────────────────────
  // profiles.profile_data must have:
  //   { notifications: { checkin_reminder: true }, preferred_checkin_time: "HH:MM", timezone?: "..." }
  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id, profile_data")
    .not("profile_data->preferred_checkin_time", "is", null)
    .filter("profile_data->notifications->>checkin_reminder", "eq", "true")

  if (profileErr) return fail(500, `profiles query failed: ${profileErr.message}`)
  if (!profiles?.length) return ok({ processed: 0, sent: 0, message: "No eligible users" })

  const utcNow = new Date()
  let sent = 0

  // Process in chunks of 20 to avoid edge function timeouts
  const CHUNK = 20
  for (let i = 0; i < profiles.length; i += CHUNK) {
    const chunk = profiles.slice(i, i + CHUNK)
    await Promise.allSettled(chunk.map(async (row) => {
      const pd = (row.profile_data as Record<string, unknown>) || {}
      const prefTime   = (pd.preferred_checkin_time as string) || ""
      const timezone   = (pd.timezone as string)                || "UTC"

      if (!prefTime) return

      const [hStr] = prefTime.split(":")
      const preferredHour = parseInt(hStr, 10)
      if (isNaN(preferredHour)) return

      // Compare user's local current hour with their preferred hour
      const localHour    = getLocalHour(timezone)
      if (localHour !== preferredHour) return

      // Dedupe: one notification per user per local calendar day
      const localToday = getLocalDateStr(timezone)
      const dedupeKey  = `checkin_reminder:${row.id}:${localToday}`

      // Check notification_log — already sent today?
      const dayStart = new Date(utcNow)
      dayStart.setUTCHours(0, 0, 0, 0)
      const { data: dup } = await admin
        .from("notification_log")
        .select("id")
        .eq("user_id", row.id)
        .eq("kind", "checkin_reminder")
        .gte("sent_at", dayStart.toISOString())
        .not("delivery_status", "eq", "failed")
        .maybeSingle()

      if (dup) return  // already sent today

      // Check if user has any push subscriptions
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", row.id)
        .limit(1)

      if (!subs?.length) return  // not subscribed

      // Fire send-push via HTTP (uses service role key → no user auth needed)
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id:     row.id,
            kind:        "checkin_reminder",
            title:       "Sporeus — Daily Check-in",
            body:        "How are you feeling today? Log your wellness in 30 seconds.",
            data:        { route: "/?tab=today" },
            dedupe_key:  dedupeKey,
            dedupe_window_hours: 20,  // prevents double-fire on adjacent cron ticks
          }),
        })
        if (resp.ok) sent++
      } catch {
        // Network error — skip this user, log will be missing (will retry next hour)
      }
    }))
  }

  return ok({ processed: profiles.length, sent })
})
