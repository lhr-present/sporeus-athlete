// ─── dodo-webhook/index.ts — Payment webhook receiver (Dodo + Stripe) ────────
// Verifies HMAC-SHA256 signature, delegates ALL state transitions to
// apply_subscription_event() SQL function (auditable, testable, atomic).
// Side-effects (email) stay here; state transitions live in SQL.
//
// Env: DODO_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET, SUPABASE_URL,
//      SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (optional)

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const DODO_SECRET   = Deno.env.get('DODO_WEBHOOK_SECRET')       ?? ''
const STRIPE_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')     ?? ''
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY')            ?? ''

if (!DODO_SECRET)   throw new Error('DODO_WEBHOOK_SECRET not configured')
if (!STRIPE_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET not configured')

// ── HMAC-SHA256 constant-time verify ─────────────────────────────────────────
async function verifyHMAC(payload: string, sig: string, secret: string): Promise<boolean> {
  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const raw      = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const expected = [...new Uint8Array(raw)].map(b => b.toString(16).padStart(2, '0')).join('')
    if (expected.length !== sig.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
    return diff === 0
  } catch { return false }
}

// ── Best-effort email via Resend ──────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY || !to) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'billing@sporeus.com', to, subject, html }),
    })
  } catch { /* non-critical */ }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body     = await req.text()
  const isDodo   = req.headers.has('x-dodo-signature')
  const isStripe = req.headers.has('stripe-signature')
  const t0       = Date.now()

  // ── Signature verification ─────────────────────────────────────────────────
  let valid    = false
  let provider = ''
  if (isDodo) {
    valid    = await verifyHMAC(body, req.headers.get('x-dodo-signature') ?? '', DODO_SECRET)
    provider = 'dodo'
  } else if (isStripe) {
    const stripeSig = req.headers.get('stripe-signature') ?? ''
    const sigHash   = stripeSig.split(',').find(s => s.startsWith('v1='))?.slice(3) ?? ''
    const tsStr     = stripeSig.split(',').find(s => s.startsWith('t='))?.slice(2) ?? ''
    valid    = await verifyHMAC(`${tsStr}.${body}`, sigHash, STRIPE_SECRET)
    provider = 'stripe'
  }

  if (!valid || !provider) {
    console.warn(JSON.stringify({ fn: 'dodo-webhook', status: 'bad_sig', provider }))
    return json({ error: 'Invalid signature' }, 401)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: Record<string, any>
  try { event = JSON.parse(body) } catch { return json({ error: 'Invalid JSON' }, 400) }

  // ── Delegate state machine to SQL ──────────────────────────────────────────
  const db              = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data, error } = await db.rpc('apply_subscription_event', {
    p_event: { ...event, provider },
  })

  if (error) {
    console.error(JSON.stringify({ fn: 'dodo-webhook', error: error.message, type: event['type'] }))
    return json({ error: 'Internal error' }, 500)
  }

  console.log(JSON.stringify({
    fn: 'dodo-webhook', provider, type: event['type'],
    event_id:    event['id'] ?? 'unknown',
    duplicate:   data?.duplicate ?? false,
    duration_ms: Date.now() - t0,
  }))

  if (data?.duplicate) return json({ ok: true, duplicate: true })

  // ── Side-effects: emails (best-effort, after SQL committed) ───────────────
  const email  = event['metadata']?.email  ?? ''
  const amount = event['metadata']?.amount ?? ''
  const type   = event['type'] as string

  if ((type === 'payment.failed' || type === 'invoice.payment_failed') && email) {
    await sendEmail(email, 'Sporeus — Payment failed',
      `<p>Your payment${amount ? ` of ${amount}` : ''} failed.</p>
       <p>Update your payment method at <a href="https://sporeus.com/billing">sporeus.com/billing</a>
       within 3 days to keep your plan.</p>`)
  }
  if ((type === 'subscription.cancelled' || type === 'customer.subscription.deleted') && email) {
    await sendEmail(email, 'Sporeus — Subscription cancelled',
      `<p>Your subscription was cancelled. Access continues until end of billing period.</p>
       <p>Reactivate at <a href="https://sporeus.com/billing">sporeus.com/billing</a></p>`)
  }

  return json({ ok: true, event_id: data?.event_id })
})
