// supabase/functions/push-worker/index.ts — pgmq push_fanout consumer
// Cron: every minute (* * * * *)
// Reads up to 50 push notification messages, calls send-push for each.
// On success: delete from queue. Rate limit: 50/sec via 10-msg parallel batches.

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function jwtRole(h: string | null): string | null {
  try {
    if (!h) return null
    const p = JSON.parse(atob(h.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    return p.role || null
  } catch { return null }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })

  if (jwtRole(req.headers.get("authorization")) !== "service_role") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sb          = createClient(supabaseUrl, serviceKey)

  // Read up to 50 messages with VT=30s
  const { data: msgs, error: readErr } = await sb.rpc("read_push_fanout", { batch_size: 50, vt: 30 })
  if (readErr) return new Response(JSON.stringify({ error: readErr.message }), { status: 500 })
  if (!msgs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } })
  }

  let sent = 0, failed = 0
  const pushUrl = `${supabaseUrl}/functions/v1/send-push`

  // Process in parallel batches of 10 (~50/sec with 20ms gap)
  const BATCH = 10
  for (let i = 0; i < msgs.length; i += BATCH) {
    const chunk = msgs.slice(i, i + BATCH)
    await Promise.allSettled(chunk.map(async (row) => {
      const msgId   = row.msg_id as bigint
      const payload = row.message as Record<string, unknown>

      try {
        const resp = await fetch(pushUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
        // 404 = no subscriptions (send-push handles 410 internally); treat as success
        if (!resp.ok && resp.status !== 404) {
          throw new Error(`send-push responded ${resp.status}`)
        }
        await sb.rpc("delete_push_fanout_msg", { p_msg_id: msgId })
        sent++
      } catch (e) {
        // Leave in queue for VT-based retry
        console.error(`push-worker: msg ${msgId} failed: ${e instanceof Error ? e.message : String(e)}`)
        failed++
      }
    }))

    // 20ms gap between batches → ≈50 msgs/sec ceiling
    if (i + BATCH < msgs.length) await new Promise(r => setTimeout(r, 20))
  }

  console.log(`push-worker: sent=${sent} failed=${failed} total=${msgs.length}`)
  return new Response(
    JSON.stringify({ sent, failed, total: msgs.length }),
    { headers: { "Content-Type": "application/json" } },
  )
})
