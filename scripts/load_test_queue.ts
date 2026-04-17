#!/usr/bin/env -S deno run --allow-net --allow-env
// ─── scripts/load_test_queue.ts — ai_batch queue load test ───────────────────
// Sends 1000 fake weekly_digest messages to ai_batch, then drains and measures
// throughput. All test messages have _test:true so they can be identified.
//
// Usage:
//   SUPABASE_URL=https://xyz.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
//   deno run --allow-net --allow-env scripts/load_test_queue.ts
//
// Optional:
//   MESSAGE_COUNT=500    (default 1000)
//   DRAIN_BATCH_SIZE=20  (default 20)
//   DRY_RUN=1            (only send, skip drain)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const MSG_COUNT    = parseInt(Deno.env.get("MESSAGE_COUNT") || "1000", 10)
const DRAIN_BATCH  = parseInt(Deno.env.get("DRAIN_BATCH_SIZE") || "20", 10)
const DRY_RUN      = Deno.env.get("DRY_RUN") === "1"

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
  Deno.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Phase 1: Send messages ────────────────────────────────────────────────────
console.log(`\n▶ Sending ${MSG_COUNT} messages to ai_batch queue...`)
const SEND_BATCH = 50  // parallel send batch size
const sendStart  = Date.now()
let enqueued     = 0
let sendErrors   = 0

for (let i = 0; i < MSG_COUNT; i += SEND_BATCH) {
  const batchSize = Math.min(SEND_BATCH, MSG_COUNT - i)
  const batch     = Array.from({ length: batchSize }, (_, j) => {
    const idx = i + j
    return sb.rpc("enqueue_ai_batch", {
      p_payload: {
        coach_id:    `load-test-${idx}`,
        coach_name:  `Load Test Coach ${idx}`,
        kind:        "weekly_digest",
        week_start:  "2026-04-14",
        retry_count: 0,
        enqueued_at: new Date().toISOString(),
        _test:       true,
      },
      p_delay_s: 0,
    })
  })

  const results = await Promise.allSettled(batch)
  for (const r of results) {
    if (r.status === "fulfilled" && !r.value.error) {
      enqueued++
    } else {
      sendErrors++
    }
  }

  Deno.stdout.write(new TextEncoder().encode(`\r  Enqueued: ${enqueued}/${MSG_COUNT} (errors: ${sendErrors})`))
}

const sendMs = Date.now() - sendStart
console.log(`\n✓ Sent ${enqueued} messages in ${sendMs}ms (${(enqueued / sendMs * 1000).toFixed(0)} msg/s)`)

if (DRY_RUN) {
  console.log("\nDRY_RUN=1 — skipping drain phase.")
  Deno.exit(0)
}

// ── Phase 2: Drain and measure ────────────────────────────────────────────────
console.log(`\n▶ Draining queue (batch_size=${DRAIN_BATCH})...`)
const drainStart = Date.now()
let drained      = 0
let drainErrors  = 0
let iterations   = 0

while (true) {
  const { data: msgs, error: readErr } = await sb.rpc("read_ai_batch", {
    batch_size: DRAIN_BATCH,
    vt:         5,
  })

  if (readErr) {
    console.error(`\n  Read error: ${readErr.message}`)
    drainErrors++
    break
  }

  if (!msgs?.length) break

  // Parallel delete
  const delResults = await Promise.allSettled(
    msgs.map((m: { msg_id: bigint }) => sb.rpc("delete_ai_batch_msg", { p_msg_id: m.msg_id }))
  )

  const deleted = delResults.filter(r => r.status === "fulfilled").length
  drained    += deleted
  drainErrors += delResults.length - deleted
  iterations++

  Deno.stdout.write(new TextEncoder().encode(
    `\r  Drained: ${drained}/${enqueued} (iteration ${iterations})`
  ))
}

const drainMs = Date.now() - drainStart
console.log(`\n✓ Drained ${drained} messages in ${drainMs}ms`)
console.log(`  Drain rate : ${drained > 0 ? (drained / drainMs * 1000).toFixed(0) : 0} msg/s`)
console.log(`  Iterations : ${iterations}`)
if (drainErrors) console.log(`  Errors     : ${drainErrors}`)

// ── Phase 3: Cleanup any leftover test messages ────────────────────────────────
console.log("\n▶ Purging remaining test messages from ai_batch...")
const { error: purgeErr } = await sb.rpc("purge_queue", { queue_name: "ai_batch" }).catch(() => ({ error: null }))
if (purgeErr) {
  console.warn("  Warning: purge_queue not available — drain manually if needed")
} else {
  console.log("  Queue purged.")
}

console.log("\n── Summary ─────────────────────────────────────────────────────")
console.log(`  Messages sent  : ${enqueued}`)
console.log(`  Messages drained: ${drained}`)
console.log(`  Send rate      : ${(enqueued / sendMs * 1000).toFixed(0)} msg/s`)
console.log(`  Drain rate     : ${drained > 0 ? (drained / drainMs * 1000).toFixed(0) : 0} msg/s`)
console.log(`  Total time     : ${((Date.now() - sendStart) / 1000).toFixed(1)}s`)
