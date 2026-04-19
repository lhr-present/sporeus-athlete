// supabase/functions/dodo-webhook/index.ts — Payment webhook handler
// Handles Dodo Payments (Turkey-compatible) and Stripe events.
// Routes by header: x-dodo-signature → Dodo, stripe-signature → Stripe
//
// Idempotency: every event is inserted into processed_webhooks before processing.
// UNIQUE(webhook_source, event_id) causes a conflict on replay → skip + return 200.
//
// Tier transitions use apply_tier_change() SQL function for atomicity:
//   profile update + billing_events insert in one transaction.
//
// Env vars required: DODO_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")  ?? ""
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const DODO_SECRET   = Deno.env.get("DODO_WEBHOOK_SECRET") ?? ""
const STRIPE_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? ""

// Guard: reject cold-start if payment secrets are missing — an empty secret
// makes HMAC-SHA256 trivially forgeable.
if (!DODO_SECRET)   throw new Error("DODO_WEBHOOK_SECRET not configured — set it in Supabase secrets")
if (!STRIPE_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not configured — set it in Supabase secrets")

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SERVICE_KEY)
}

// ── HMAC-SHA256 verification ──────────────────────────────────────────────────
async function verifyHMAC(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    )
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("")
    // Constant-time comparison — prevents timing attacks
    if (expected.length !== signature.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    return diff === 0
  } catch { return false }
}

// ── Idempotency dedup ─────────────────────────────────────────────────────────
// Returns true if this event was already processed (duplicate → skip).
// Returns false if it's new (proceed with handling).
// On DB error throws so the caller returns 500 and the provider retries.
async function markProcessed(
  db: ReturnType<typeof supabaseAdmin>,
  source: string,
  eventId: string,
  eventType: string,
  userId: string | null,
): Promise<boolean> {
  const { error } = await db.from("processed_webhooks").insert({
    webhook_source: source,
    event_id:       eventId,
    event_type:     eventType,
    user_id:        userId,
  })
  if (!error) return false   // inserted → new event
  if (error.code === "23505") return true  // unique violation → duplicate
  throw new Error(`processed_webhooks insert failed: ${error.message}`)
}

// ── Send emails via Resend ────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY || !to) return
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "billing@sporeus.com", to, subject, html }),
    })
  } catch { /* non-critical */ }
}

async function sendFailureEmail(email: string, amount: string) {
  await sendEmail(
    email,
    "Sporeus — Payment failed",
    `<p>Your Sporeus payment of ${amount} failed.</p>
     <p>You have a 3-day grace period to update your payment method at
     <a href="https://sporeus.com/billing">sporeus.com/billing</a>.</p>
     <p>After that your account will be downgraded to the free plan.</p>`,
  )
}

async function sendCancelledEmail(email: string, endDate: string) {
  await sendEmail(
    email,
    "Sporeus — Subscription cancelled",
    `<p>Your Sporeus subscription has been cancelled.</p>
     <p>You retain full access until <strong>${endDate}</strong>.</p>
     <p>To reactivate, visit <a href="https://sporeus.com/billing">sporeus.com/billing</a>.</p>`,
  )
}

// ── Dodo event handler ────────────────────────────────────────────────────────
async function handleDodoEvent(
  db: ReturnType<typeof supabaseAdmin>,
  event: {
    id?: string
    type: string
    metadata?: { tier?: string; user_id?: string; email?: string; amount?: string; currency?: string }
    user_id?: string
  }
): Promise<{ status: number; message: string }> {
  const uid    = event.metadata?.user_id || event.user_id
  const evtId  = event.id ?? `dodo-${Date.now()}`
  const email  = event.metadata?.email  ?? ""
  const amount = event.metadata?.amount ?? ""

  if (!uid) return { status: 400, message: "Missing user_id in event" }

  // Idempotency check — skip duplicate replays
  const isDuplicate = await markProcessed(db, "dodo", evtId, event.type, uid)
  if (isDuplicate) {
    console.log(`[dodo] duplicate ${event.type} evtId=${evtId} — skipped`)
    return { status: 200, message: "duplicate" }
  }

  // ── payment.succeeded → upgrade tier ──────────────────────────────────────
  if (event.type === "payment.succeeded") {
    const tier     = event.metadata?.tier     || "coach"
    const currency = event.metadata?.currency ?? "TRY"
    const amountN  = amount ? Math.round(parseFloat(amount) * 100) : null

    const { error } = await db.rpc("apply_tier_change", {
      p_user_id:          uid,
      p_new_tier:         tier,
      p_reason:           "payment.succeeded",
      p_webhook_event_id: evtId,
      p_amount_cents:     amountN,
      p_currency:         currency,
      p_webhook_source:   "dodo",
    })
    if (error) {
      console.error(`[dodo] apply_tier_change failed uid=${uid}:`, error.message)
      return { status: 500, message: error.message }
    }
    console.log(`[dodo] payment.succeeded uid=${uid} tier=${tier}`)
    return { status: 200, message: "ok" }
  }

  // ── payment.failed → mark past_due + start grace period ───────────────────
  if (event.type === "payment.failed") {
    const { error } = await db.from("profiles").update({
      subscription_status:  "past_due",
      grace_period_ends_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      updated_at:           new Date().toISOString(),
    }).eq("id", uid)
    if (error) {
      console.error(`[dodo] past_due update failed uid=${uid}:`, error.message)
      return { status: 500, message: error.message }
    }
    await sendFailureEmail(email, amount)
    console.log(`[dodo] payment.failed uid=${uid} — past_due set, email sent`)
    return { status: 200, message: "ok" }
  }

  // ── subscription.cancelled → mark cancelled, set end_date ─────────────────
  if (event.type === "subscription.cancelled") {
    // Fetch current subscription_expires_at to use as end_date
    const { data: prof } = await db
      .from("profiles")
      .select("subscription_expires_at, email")
      .eq("id", uid)
      .maybeSingle()

    const endDate = prof?.subscription_expires_at ?? new Date(Date.now() + 30 * 86400000).toISOString()
    const profEmail = prof ? (email || "") : email

    const { error } = await db.from("profiles").update({
      subscription_status:    "cancelled",
      subscription_end_date:  endDate,
      updated_at:             new Date().toISOString(),
    }).eq("id", uid)
    if (error) {
      console.error(`[dodo] cancelled update failed uid=${uid}:`, error.message)
      return { status: 500, message: error.message }
    }

    // Insert billing audit event for cancellation
    await db.from("billing_events").insert({
      user_id:          uid,
      event_type:       "tier_downgrade",
      reason:           "subscription.cancelled",
      webhook_source:   "dodo",
      webhook_event_id: evtId,
    })

    const endDateStr = new Date(endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    await sendCancelledEmail(profEmail, endDateStr)
    console.log(`[dodo] subscription.cancelled uid=${uid} — access until ${endDate}`)
    return { status: 200, message: "ok" }
  }

  console.log(`[dodo] unhandled event type: ${event.type}`)
  return { status: 200, message: `unhandled: ${event.type}` }
}

// ── Stripe event handler ──────────────────────────────────────────────────────
async function handleStripeEvent(
  db: ReturnType<typeof supabaseAdmin>,
  event: {
    id?: string
    type: string
    data?: {
      object?: {
        metadata?: { user_id?: string; tier?: string; email?: string }
        amount?: number
        currency?: string
        current_period_end?: number
      }
    }
  }
): Promise<{ status: number; message: string }> {
  const obj   = event.data?.object
  const uid   = obj?.metadata?.user_id
  const evtId = event.id ?? `stripe-${Date.now()}`

  if (!uid) {
    console.log(`[stripe] ${event.type} — no user_id in metadata, skipping`)
    return { status: 200, message: "no user_id" }
  }

  // Idempotency check
  const isDuplicate = await markProcessed(db, "stripe", evtId, event.type, uid)
  if (isDuplicate) {
    console.log(`[stripe] duplicate ${event.type} evtId=${evtId} — skipped`)
    return { status: 200, message: "duplicate" }
  }

  // ── payment_intent.succeeded → upgrade ─────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    const tier     = obj?.metadata?.tier     || "coach"
    const amountN  = obj?.amount             ?? null
    const currency = (obj?.currency ?? "eur").toUpperCase()

    const { error } = await db.rpc("apply_tier_change", {
      p_user_id:          uid,
      p_new_tier:         tier,
      p_reason:           "payment_intent.succeeded",
      p_webhook_event_id: evtId,
      p_amount_cents:     amountN,
      p_currency:         currency,
      p_webhook_source:   "stripe",
    })
    if (error) {
      console.error(`[stripe] apply_tier_change failed uid=${uid}:`, error.message)
      return { status: 500, message: error.message }
    }
    console.log(`[stripe] payment_intent.succeeded uid=${uid} tier=${tier}`)
    return { status: 200, message: "ok" }
  }

  // ── customer.subscription.deleted → cancelled, deferred downgrade ──────────
  if (event.type === "customer.subscription.deleted") {
    const periodEnd = obj?.current_period_end
    const endDate   = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()

    const { error } = await db.from("profiles").update({
      subscription_status:   "cancelled",
      subscription_end_date: endDate,
      updated_at:            new Date().toISOString(),
    }).eq("id", uid)
    if (error) {
      console.error(`[stripe] cancelled update failed uid=${uid}:`, error.message)
      return { status: 500, message: error.message }
    }
    await db.from("billing_events").insert({
      user_id:          uid,
      event_type:       "tier_downgrade",
      reason:           "customer.subscription.deleted",
      webhook_source:   "stripe",
      webhook_event_id: evtId,
    })
    console.log(`[stripe] subscription.deleted uid=${uid} — access until ${endDate}`)
    return { status: 200, message: "ok" }
  }

  console.log(`[stripe] unhandled event type: ${event.type}`)
  return { status: 200, message: `unhandled: ${event.type}` }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(withTelemetry('dodo-webhook', async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const body     = await req.text()
  const isDodo   = req.headers.has("x-dodo-signature")
  const isStripe = req.headers.has("stripe-signature")
  const db       = supabaseAdmin()

  // ── Dodo path ──────────────────────────────────────────────────────────────
  if (isDodo) {
    const sig   = req.headers.get("x-dodo-signature") ?? ""
    const valid = await verifyHMAC(body, sig, DODO_SECRET)
    if (!valid) {
      console.warn("[dodo] bad signature")
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 })
    }

    let event: Parameters<typeof handleDodoEvent>[1]
    try { event = JSON.parse(body) } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
    }

    try {
      const result = await handleDodoEvent(db, event)
      return new Response(JSON.stringify({ message: result.message }), { status: result.status })
    } catch (e) {
      console.error("[dodo] handler error:", e)
      return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 })
    }
  }

  // ── Stripe path ────────────────────────────────────────────────────────────
  if (isStripe) {
    const sig     = req.headers.get("stripe-signature") ?? ""
    const sigHash = sig.split(",").find(s => s.startsWith("v1="))?.slice(3) ?? ""
    const tsStr   = sig.split(",").find(s => s.startsWith("t="))?.slice(2) ?? ""
    const valid   = await verifyHMAC(`${tsStr}.${body}`, sigHash, STRIPE_SECRET)
    if (!valid) {
      console.warn("[stripe] bad signature")
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 })
    }

    let event: Parameters<typeof handleStripeEvent>[1]
    try { event = JSON.parse(body) } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
    }

    try {
      const result = await handleStripeEvent(db, event)
      return new Response(JSON.stringify({ message: result.message }), { status: result.status })
    } catch (e) {
      console.error("[stripe] handler error:", e)
      return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 })
    }
  }

  return new Response(JSON.stringify({ error: "Unknown webhook source" }), { status: 400 })
}))
