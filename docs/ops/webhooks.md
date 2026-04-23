# Webhook Configuration

## Dodo Payments (Turkey / TRY)

### Endpoint
```
https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/dodo-webhook
```

### Events to subscribe (Dodo dashboard → Developer → Webhooks)
| Event | Effect |
|---|---|
| `payment.succeeded` | Upgrades tier to `coach`/`club`, sets `subscription_status=active` |
| `payment.failed` | Sets `subscription_status=past_due`, starts 3-day grace period |
| `subscription.created` | Sets `subscription_status=trialing`, 14-day trial |
| `subscription.updated` | Syncs `subscription_current_period_end` |
| `subscription.cancelled` | Sets `subscription_status=cancelled`, retains access until period end |
| `subscription.trial_will_end` | Recorded; no status change (send reminder email manually) |
| `invoice.payment_failed` | Same as `payment.failed` |
| `invoice.payment_succeeded` | Same as `payment.succeeded` (resolves past_due → active) |

### Required metadata on every checkout session
```json
{
  "metadata": {
    "user_id": "<supabase auth.uid()>",
    "tier": "coach",
    "email": "<user email for failure notifications>",
    "amount": "299.00",
    "currency": "TRY"
  }
}
```

### Signature verification
- Header: `x-dodo-signature`
- Algorithm: HMAC-SHA256 over raw request body
- Secret: `DODO_WEBHOOK_SECRET` Supabase secret

### Rotating the secret
1. Generate new secret: `openssl rand -hex 32`
2. Update in Dodo dashboard first, then immediately update Supabase secret:
   ```bash
   npx supabase secrets set DODO_WEBHOOK_SECRET=<new_value> --project-ref pvicqwapvvfempjdgwbm
   ```
3. There is a brief window where old events with the old secret will return 401 — Dodo will retry. No data loss.

---

## Stripe (International / EUR)

Routes through the same `dodo-webhook` edge function. Stripe events are detected by the `stripe-signature` header.

### Signature verification
- Header: `stripe-signature` (Stripe standard)
- Algorithm: HMAC-SHA256 over `${timestamp}.${body}`
- Secret: `STRIPE_WEBHOOK_SECRET` Supabase secret

### Events to subscribe (Stripe dashboard → Developers → Webhooks)
| Event | Effect |
|---|---|
| `payment_intent.succeeded` | Upgrades tier, sets active |
| `customer.subscription.deleted` | Sets cancelled + period end |
| `invoice.payment_failed` | Sets past_due + grace period |
| `invoice.payment_succeeded` | Resolves past_due → active |

> **TODO**: When `stripe-webhook` is built as a dedicated edge function, reuse
> `apply_subscription_event()` SQL RPC — it already handles all Stripe event shapes.

---

## Idempotency

All events are stored in `public.subscription_events` with `UNIQUE(event_id)`.
Duplicate deliveries return `{ ok: true, duplicate: true }` with HTTP 200 — safe for
Dodo/Stripe automatic retry.

## Testing locally

```bash
# Sign a test payload with your local secret
SECRET=your_dodo_webhook_secret
BODY='{"id":"test_001","type":"payment.succeeded","metadata":{"user_id":"<uid>","tier":"coach","amount":"299.00","currency":"TRY"}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/dodo-webhook \
  -H "Content-Type: application/json" \
  -H "x-dodo-signature: $SIG" \
  -d "$BODY"
# Expected: {"ok":true,"event_id":"test_001"}
# Check: SELECT subscription_status, subscription_tier FROM profiles WHERE id='<uid>';
```
