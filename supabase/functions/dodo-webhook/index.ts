// supabase/functions/dodo-webhook/index.ts — Payment webhook handler
// Handles Dodo Payments (Turkey-compatible) and Stripe events.
// Routes by Content-Type: application/json + x-dodo-signature → Dodo
//                         application/json + stripe-signature → Stripe
// Env vars required: DODO_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")  ?? ""
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const DODO_SECRET   = Deno.env.get("DODO_WEBHOOK_SECRET") ?? ""
const STRIPE_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? ""

// Guard: reject cold-start if payment secrets are missing — an empty secret
// makes HMAC-SHA256 trivially forgeable (attacker signs with "" key).
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
    // Constant-time comparison
    if (expected.length !== signature.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    return diff === 0
  } catch { return false }
}

// ── Send failure email via Resend ─────────────────────────────────────────────
async function sendFailureEmail(email: string, amount: string) {
  if (!RESEND_KEY || !email) return
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "billing@sporeus.com",
        to:   email,
        subject: "Sporeus — Payment failed",
        html: `<p>Your Sporeus payment of ${amount} failed. Please update your payment method at sporeus.com/billing.</p>`,
      }),
    })
  } catch { /* non-critical */ }
}

// ── Dodo event handler ────────────────────────────────────────────────────────
async function handleDodoEvent(event: {
  type: string
  metadata?: { tier?: string; user_id?: string; email?: string; amount?: string }
  user_id?: string
}) {
  const db  = supabaseAdmin()
  const uid = event.metadata?.user_id || event.user_id
  if (!uid) return { status: 400, message: "Missing user_id in event" }

  if (event.type === "payment.succeeded") {
    const tier = event.metadata?.tier || "coach"
    const { error } = await db.from("profiles").update({
      subscription_tier:       tier,
      subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).eq("id", uid)
    if (error) return { status: 500, message: error.message }
    console.log(`[dodo] payment.succeeded uid=${uid} tier=${tier}`)
    return { status: 200, message: "ok" }
  }

  if (event.type === "payment.failed") {
    const email  = event.metadata?.email || ""
    const amount = event.metadata?.amount || ""
    await sendFailureEmail(email, amount)
    console.log(`[dodo] payment.failed uid=${uid}, email sent to ${email}`)
    return { status: 200, message: "ok" }
  }

  if (event.type === "subscription.cancelled") {
    // Do not downgrade immediately — let subscription_expires_at govern access
    // A separate cron job should set tier='free' after expiry
    console.log(`[dodo] subscription.cancelled uid=${uid} — will expire at current subscription_expires_at`)
    return { status: 200, message: "ok" }
  }

  return { status: 200, message: `unhandled event type: ${event.type}` }
}

// ── Stripe event handler ──────────────────────────────────────────────────────
async function handleStripeEvent(event: { type: string; data?: { object?: { metadata?: { user_id?: string; tier?: string; email?: string }; amount?: number } } }) {
  const db  = supabaseAdmin()
  const obj = event.data?.object
  const uid = obj?.metadata?.user_id

  if (event.type === "payment_intent.succeeded" && uid) {
    const tier = obj?.metadata?.tier || "coach"
    await db.from("profiles").update({
      subscription_tier:       tier,
      subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).eq("id", uid)
    console.log(`[stripe] payment_intent.succeeded uid=${uid} tier=${tier}`)
  }

  if (event.type === "customer.subscription.deleted" && uid) {
    // Deferred downgrade — same as Dodo cancelled
    console.log(`[stripe] subscription.deleted uid=${uid} — deferred downgrade`)
  }

  return { status: 200, message: "ok" }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const body     = await req.text()
  const isDodo   = req.headers.has("x-dodo-signature")
  const isStripe = req.headers.has("stripe-signature")

  // ── Dodo path ──────────────────────────────────────────────────────────────
  if (isDodo) {
    const sig = req.headers.get("x-dodo-signature") ?? ""
    const valid = await verifyHMAC(body, sig, DODO_SECRET)
    if (!valid) {
      console.warn("[dodo] bad signature")
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 })
    }

    let event: Parameters<typeof handleDodoEvent>[0]
    try { event = JSON.parse(body) } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
    }

    const result = await handleDodoEvent(event)
    return new Response(JSON.stringify({ message: result.message }), { status: result.status })
  }

  // ── Stripe path ────────────────────────────────────────────────────────────
  if (isStripe) {
    const sig = req.headers.get("stripe-signature") ?? ""
    // Note: full Stripe webhook verification requires the Stripe SDK or manual timestamp check.
    // Here we verify HMAC against the raw body with STRIPE_WEBHOOK_SECRET.
    const sigHash = sig.split(",").find(s => s.startsWith("v1="))?.slice(3) ?? ""
    const tsStr   = sig.split(",").find(s => s.startsWith("t="))?.slice(2) ?? ""
    const valid = await verifyHMAC(`${tsStr}.${body}`, sigHash, STRIPE_SECRET)
    if (!valid) {
      console.warn("[stripe] bad signature")
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 })
    }

    let event: Parameters<typeof handleStripeEvent>[0]
    try { event = JSON.parse(body) } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
    }

    const result = await handleStripeEvent(event)
    return new Response(JSON.stringify({ message: result.message }), { status: result.status })
  }

  return new Response(JSON.stringify({ error: "Unknown webhook source" }), { status: 400 })
})
