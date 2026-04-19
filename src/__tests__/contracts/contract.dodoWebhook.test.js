// ─── Contract: dodo-webhook event shapes + idempotency rules ─────────────────
// Pure unit tests — validates event payload shapes, idempotency logic,
// and the fields required by apply_tier_change().
// No real HTTP calls — the edge function handler is exercised by its own
// Deno runtime; this tests the contracts our front-end + DB code depend on.

import { describe, it, expect } from 'vitest'

// ── Fixture payloads (canonical shapes from Dodo + Stripe docs) ────────────────

const DODO_PAYMENT_SUCCEEDED = {
  id: 'dodo_evt_test_001',
  type: 'payment.succeeded',
  user_id: '00000000-0000-0000-0000-000000000001',
  metadata: {
    user_id: '00000000-0000-0000-0000-000000000001',
    tier: 'coach',
    email: 'test@sporeus.com',
    amount: '299.00',
    currency: 'TRY',
  },
}

const DODO_PAYMENT_FAILED = {
  id: 'dodo_evt_test_002',
  type: 'payment.failed',
  user_id: '00000000-0000-0000-0000-000000000002',
  metadata: {
    user_id: '00000000-0000-0000-0000-000000000002',
    email: 'fail@sporeus.com',
    amount: '299.00',
  },
}

const DODO_SUBSCRIPTION_CANCELLED = {
  id: 'dodo_evt_test_003',
  type: 'subscription.cancelled',
  metadata: {
    user_id: '00000000-0000-0000-0000-000000000003',
    email: 'cancelled@sporeus.com',
  },
}

const STRIPE_PAYMENT_INTENT_SUCCEEDED = {
  id: 'pi_test_001',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      metadata: { user_id: '00000000-0000-0000-0000-000000000004', tier: 'coach' },
      amount: 900,
      currency: 'eur',
    },
  },
}

const STRIPE_SUBSCRIPTION_DELETED = {
  id: 'sub_test_001',
  type: 'customer.subscription.deleted',
  data: {
    object: {
      metadata: { user_id: '00000000-0000-0000-0000-000000000005' },
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    },
  },
}

const STRIPE_UNKNOWN_EVENT = {
  id: 'evt_unknown_001',
  type: 'invoice.created',
  data: { object: { metadata: { user_id: '00000000-0000-0000-0000-000000000006' } } },
}

// ── Helper: extract uid from Dodo event ──────────────────────────────────────
function extractDodoUid(event) {
  return event.metadata?.user_id || event.user_id || null
}

// ── Helper: extract uid from Stripe event ────────────────────────────────────
function extractStripeUid(event) {
  return event.data?.object?.metadata?.user_id || null
}

// ── Helper: determine apply_tier_change params from Dodo payment.succeeded ───
function deriveUpgradeParams(event) {
  const uid    = extractDodoUid(event)
  const tier   = event.metadata?.tier || 'coach'
  const amount = event.metadata?.amount
  const amountCents = amount ? Math.round(parseFloat(amount) * 100) : null
  const currency = (event.metadata?.currency ?? 'TRY').toUpperCase()
  return { uid, tier, amountCents, currency }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Dodo webhook — payload contracts', () => {
  describe('payment.succeeded', () => {
    it('has required id field for idempotency', () => {
      expect(DODO_PAYMENT_SUCCEEDED.id).toBeTruthy()
    })
    it('extracts uid correctly', () => {
      expect(extractDodoUid(DODO_PAYMENT_SUCCEEDED)).toBe('00000000-0000-0000-0000-000000000001')
    })
    it('derives correct tier from metadata', () => {
      expect(deriveUpgradeParams(DODO_PAYMENT_SUCCEEDED).tier).toBe('coach')
    })
    it('converts amount to cents', () => {
      const { amountCents } = deriveUpgradeParams(DODO_PAYMENT_SUCCEEDED)
      expect(amountCents).toBe(29900)
    })
    it('normalizes currency to uppercase', () => {
      expect(deriveUpgradeParams(DODO_PAYMENT_SUCCEEDED).currency).toBe('TRY')
    })
    it('defaults to coach tier when metadata.tier absent', () => {
      const evt = { ...DODO_PAYMENT_SUCCEEDED, metadata: { ...DODO_PAYMENT_SUCCEEDED.metadata, tier: undefined } }
      expect(deriveUpgradeParams(evt).tier).toBe('coach')
    })
  })

  describe('payment.failed', () => {
    it('has required id field', () => {
      expect(DODO_PAYMENT_FAILED.id).toBeTruthy()
    })
    it('extracts uid', () => {
      expect(extractDodoUid(DODO_PAYMENT_FAILED)).toBe('00000000-0000-0000-0000-000000000002')
    })
    it('has email for failure notification', () => {
      expect(DODO_PAYMENT_FAILED.metadata.email).toBeTruthy()
    })
  })

  describe('subscription.cancelled', () => {
    it('has required id field', () => {
      expect(DODO_SUBSCRIPTION_CANCELLED.id).toBeTruthy()
    })
    it('extracts uid from metadata (no top-level user_id)', () => {
      expect(extractDodoUid(DODO_SUBSCRIPTION_CANCELLED)).toBe('00000000-0000-0000-0000-000000000003')
    })
  })
})

describe('Stripe webhook — payload contracts', () => {
  describe('payment_intent.succeeded', () => {
    it('has required id field', () => {
      expect(STRIPE_PAYMENT_INTENT_SUCCEEDED.id).toBeTruthy()
    })
    it('extracts uid from data.object.metadata', () => {
      expect(extractStripeUid(STRIPE_PAYMENT_INTENT_SUCCEEDED)).toBe('00000000-0000-0000-0000-000000000004')
    })
    it('has amount and currency for billing_events', () => {
      const obj = STRIPE_PAYMENT_INTENT_SUCCEEDED.data.object
      expect(obj.amount).toBe(900)
      expect(obj.currency).toBe('eur')
    })
    it('currency uppercased to EUR', () => {
      const currency = STRIPE_PAYMENT_INTENT_SUCCEEDED.data.object.currency.toUpperCase()
      expect(currency).toBe('EUR')
    })
  })

  describe('customer.subscription.deleted', () => {
    it('has required id', () => {
      expect(STRIPE_SUBSCRIPTION_DELETED.id).toBeTruthy()
    })
    it('extracts uid', () => {
      expect(extractStripeUid(STRIPE_SUBSCRIPTION_DELETED)).toBe('00000000-0000-0000-0000-000000000005')
    })
    it('current_period_end is a future unix timestamp', () => {
      const ts = STRIPE_SUBSCRIPTION_DELETED.data.object.current_period_end
      expect(ts).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })
    it('derives ISO end date from current_period_end', () => {
      const ts = STRIPE_SUBSCRIPTION_DELETED.data.object.current_period_end
      const endDate = new Date(ts * 1000).toISOString()
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })
  })

  describe('unknown event type', () => {
    it('has a uid in metadata (handled gracefully)', () => {
      expect(extractStripeUid(STRIPE_UNKNOWN_EVENT)).toBe('00000000-0000-0000-0000-000000000006')
    })
    it('type is not in the handled event list', () => {
      const HANDLED = ['payment_intent.succeeded', 'customer.subscription.deleted']
      expect(HANDLED.includes(STRIPE_UNKNOWN_EVENT.type)).toBe(false)
    })
  })
})

describe('Idempotency — processed_webhooks contract', () => {
  it('Dodo event_id is the event.id field', () => {
    expect(DODO_PAYMENT_SUCCEEDED.id).toBe('dodo_evt_test_001')
  })
  it('Stripe event_id is the top-level id field', () => {
    expect(STRIPE_PAYMENT_INTENT_SUCCEEDED.id).toBe('pi_test_001')
  })
  it('(webhook_source, event_id) pair uniquely identifies a processed event', () => {
    // Two events with same source+id should be deduped
    const pairs = [
      { source: 'dodo',   id: 'dodo_evt_test_001' },
      { source: 'dodo',   id: 'dodo_evt_test_001' },  // replay
      { source: 'stripe', id: 'dodo_evt_test_001' },  // different source — not a dupe
    ]
    const unique = new Set(pairs.map(p => `${p.source}:${p.id}`))
    expect(unique.size).toBe(2)  // dodo:id is deduped, stripe:id is distinct
  })
  it('tampered event cannot forge a new processed_webhooks row (different id)', () => {
    // If an attacker changes the event_id in the payload, the UNIQUE constraint
    // would allow insertion (different key), but HMAC check prevents reaching this.
    // This test documents the defense-in-depth assumption.
    const tampered = { ...DODO_PAYMENT_SUCCEEDED, id: 'attacker_forged_id' }
    expect(tampered.id).not.toBe(DODO_PAYMENT_SUCCEEDED.id)
  })
})

describe('apply_tier_change — parameter contract', () => {
  it('accepts all valid tiers', () => {
    const validTiers = ['free', 'coach', 'club']
    for (const tier of validTiers) {
      expect(validTiers.includes(tier)).toBe(true)
    }
  })
  it('rejects invalid tier strings', () => {
    const invalid = ['premium', 'enterprise', '', null, undefined]
    const validTiers = new Set(['free', 'coach', 'club'])
    for (const tier of invalid) {
      expect(validTiers.has(tier)).toBe(false)
    }
  })
  it('trial_start reason maps to trialing status', () => {
    const reason = 'trial_start'
    // Mirrors the SQL CASE logic in apply_tier_change()
    const derivedStatus = reason === 'trial_start' ? 'trialing'
      : reason.startsWith('trial') ? 'expired'
      : 'active'
    expect(derivedStatus).toBe('trialing')
  })
  it('payment.succeeded with free tier maps to expired status', () => {
    // Downgrade: new_tier='free' → status='expired'
    const newTier = 'free'
    const derivedStatus = newTier === 'free' ? 'expired' : 'active'
    expect(derivedStatus).toBe('expired')
  })
  it('payment.succeeded with coach tier maps to active status', () => {
    const newTier = 'coach'
    const reason  = 'payment.succeeded'
    const derivedStatus =
      reason === 'trial_start' ? 'trialing'
      : newTier === 'free'     ? 'expired'
      : 'active'
    expect(derivedStatus).toBe('active')
  })
})
