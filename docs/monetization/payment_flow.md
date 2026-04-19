# Payment Flow — Sporeus

**Last updated:** 2026-04-18

---

## Overview

Sporeus uses two payment providers:
- **Dodo Payments** — Turkey (TRY pricing, local compliance)
- **Stripe** — International (EUR/USD pricing)

Both route through the same `dodo-webhook` edge function.

---

## Checkout Flow

```
User clicks "Upgrade" (UpgradeModal)
  │
  ├─ lang='tr' ──▶ VITE_DODO_CHECKOUT_COACH / _CLUB  (Dodo hosted page)
  │
  └─ lang='en' ──▶ VITE_STRIPE_CHECKOUT_COACH / _CLUB (Stripe Checkout)
         │
         ▼ User completes payment on provider's page
         │
         ▼ Provider sends webhook to:
           https://{project}.supabase.co/functions/v1/dodo-webhook
```

---

## Webhook Processing Flow

```
POST /functions/v1/dodo-webhook
  │
  ├─ [1] Verify HMAC-SHA256 signature
  │       x-dodo-signature   → DODO_WEBHOOK_SECRET
  │       stripe-signature   → STRIPE_WEBHOOK_SECRET
  │       Bad sig → 400 "Invalid signature"
  │
  ├─ [2] Idempotency check
  │       INSERT INTO processed_webhooks (webhook_source, event_id, ...)
  │       Conflict (23505) → 200 "duplicate" — STOP
  │
  ├─ [3] Route by event type
  │
  ├─── payment.succeeded / payment_intent.succeeded
  │       → rpc("apply_tier_change", {
  │             user_id, new_tier, reason='payment.succeeded',
  │             webhook_event_id, amount_cents, currency, webhook_source
  │           })
  │       → profiles: tier=coach/club, status=active, expires_at=NOW+30d
  │       → billing_events: event_type='tier_upgrade'
  │       → 200 "ok"
  │
  ├─── payment.failed
  │       → profiles UPDATE: status='past_due', grace_period_ends_at=NOW+3d
  │       → sendFailureEmail(email, amount)
  │       → 200 "ok"
  │
  ├─── subscription.cancelled / customer.subscription.deleted
  │       → profiles UPDATE: status='cancelled', subscription_end_date=expires_at
  │       → billing_events INSERT: event_type='tier_downgrade'
  │       → sendCancelledEmail(email, endDate)
  │       → 200 "ok"
  │
  └─── unknown type → 200 "unhandled: {type}"
```

---

## Cron — Daily Reconciliation

`reconcile-subscriptions` runs daily at **00:30 UTC**.

```
cron.schedule('reconcile-subscriptions', '30 0 * * *')
  │
  ├─ [1] trialing + trial_ends_at < NOW()
  │       → tier='free', status='expired', trial_ends_at=NULL
  │
  ├─ [2] past_due + grace_period_ends_at < NOW()
  │       → tier='free', status='expired', grace_period_ends_at=NULL
  │
  ├─ [3] cancelled + subscription_end_date < NOW()
  │       → tier='free', status='expired', subscription_end_date=NULL
  │
  └─ [4] catch-all: status='active' + subscription_expires_at < NOW()
          → tier='free', status='expired'
```

---

## Trial Flow

```
User signs up → lands on Coach checkout with trial CTA
  │
  ├─ Dodo: no credit card required for trial
  │
  ▼ payment.succeeded with trial metadata
  │
  ▼ apply_tier_change(..., p_reason='trial_start')
          → profiles: tier='coach', status='trialing',
                      trial_ends_at=NOW+14d, expires_at=NOW+14d
          → billing_events: event_type='trial_start'
  │
  ├─ [After 14 days] reconcile cron: tier='free', status='expired'
  │
  └─ [User upgrades before expiry] payment.succeeded
            → apply_tier_change: status='active', expires_at=NOW+30d
```

---

## apply_tier_change() SQL Function

Defined in migration `20260454_apply_tier_change.sql`.  
SECURITY DEFINER — only callable by service_role.

```sql
apply_tier_change(
  p_user_id          UUID,
  p_new_tier         TEXT,      -- 'free' | 'coach' | 'club'
  p_reason           TEXT,      -- 'payment.succeeded' | 'trial_start' | ...
  p_webhook_event_id TEXT,      -- idempotency link to processed_webhooks
  p_old_tier         TEXT,      -- auto-read from profiles if NULL
  p_amount_cents     INT,       -- for billing_events
  p_currency         TEXT,      -- 'TRY' | 'EUR' | 'USD'
  p_webhook_source   TEXT,      -- 'dodo' | 'stripe'
  p_sub_status       TEXT,      -- override status (auto-derived if NULL)
  p_expires_days     INT        -- default 30
)
```

---

## Client-Side Gate Check

```
Component renders
  │
  ▼ getTierSync() — reads localStorage 'sporeus-tier' (cached from last getTier() call)
  │
  ▼ isFeatureGated(featureKey, tier) → boolean
  │
  ├─ false → render feature normally
  │
  └─ true → show upgrade CTA + openUpgrade(featureKey)
                │
                ▼ UpgradeModal opens
                │
                ▼ User clicks checkout → getCheckoutUrl(tier, lang) → window.open()
                │
                ▼ trackEvent('upgrade', 'checkout_started', tier)
```

---

## Env Vars Required

| Variable                    | Purpose                             |
|-----------------------------|-------------------------------------|
| `DODO_WEBHOOK_SECRET`       | Supabase secret (edge fn)           |
| `STRIPE_WEBHOOK_SECRET`     | Supabase secret (edge fn)           |
| `RESEND_API_KEY`            | Supabase secret (dunning emails)    |
| `VITE_DODO_CHECKOUT_COACH`  | Dodo hosted checkout URL (Coach)    |
| `VITE_DODO_CHECKOUT_CLUB`   | Dodo hosted checkout URL (Club)     |
| `VITE_STRIPE_CHECKOUT_COACH`| Stripe Checkout URL (Coach, intl)   |
| `VITE_STRIPE_CHECKOUT_CLUB` | Stripe Checkout URL (Club, intl)    |

---

## Security Notes

- **HMAC verification** is mandatory on all incoming webhooks. An empty secret throws at cold-start.
- **Idempotency** is enforced by `UNIQUE(webhook_source, event_id)` in `processed_webhooks`.
  A duplicate replay returns 200 without re-processing.
- **Tier manipulation** from the client is impossible: `apply_tier_change()` is SECURITY DEFINER,
  REVOKE'd from `authenticated`. Only service_role (the edge function) can call it.
- **Non-200 on DB errors** causes the provider to retry (correct behavior for transient failures).
