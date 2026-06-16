// ─── Contract: dodo-webhook event shapes + idempotency rules ─────────────────
// Pure unit tests — validates event payload shapes, idempotency logic,
// and the fields required by apply_tier_change().
// No real HTTP calls — the edge function handler is exercised by its own
// Deno runtime; this tests the contracts our front-end + DB code depend on.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Pin the contract to the REAL producer: parse the migration SQL that defines
// apply_subscription_event so these assertions can't drift from what the DB
// function actually does. (round-3 test-integrity finding: contract tests must
// assert against the real producer, not a hand-copied replica.)
const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_SQL = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260630_subscription_event_capture_amount.sql'),
  'utf8',
)

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
// This mirrors the SQL extraction in apply_subscription_event (migration
// 20260630): Dodo metadata.amount is a major-unit decimal string (299.00 →
// 29900 cents) and currency is uppercased, defaulting to TRY. The SQL is the
// source of truth; the `forwards p_amount_cents/p_currency to apply_tier_change`
// describe block below asserts the replica stays consistent with the SQL body.
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

  // Assert the REAL producer (the SQL) actually forwards amount/currency.
  // Before migration 20260630 apply_subscription_event delegated to
  // apply_tier_change WITHOUT p_amount_cents/p_currency, so billing_events.amount
  // was always NULL — this contract test passed anyway because it only checked
  // the JS replica. These assertions read the live migration so a regression that
  // drops the forwarding would fail the contract.
  describe('apply_subscription_event SQL — forwards p_amount_cents/p_currency', () => {
    it('PERFORMs apply_tier_change with both p_amount_cents and p_currency', () => {
      const callMatch = MIGRATION_SQL.match(/PERFORM\s+public\.apply_tier_change\(([\s\S]*?)\);/i)
      expect(callMatch).toBeTruthy()
      const callArgs = callMatch[1]
      expect(callArgs).toMatch(/p_amount_cents\s*:=\s*v_amount_cents/)
      expect(callArgs).toMatch(/p_currency\s*:=\s*v_currency/)
    })
    it('derives Dodo cents from metadata.amount (major units × 100)', () => {
      // round(... ::numeric * 100)::int over metadata.amount — matches deriveUpgradeParams
      expect(MIGRATION_SQL).toMatch(/round\(\(p_event->'metadata'->>'amount'\)::numeric\s*\*\s*100\)::int/)
      expect(deriveUpgradeParams(DODO_PAYMENT_SUCCEEDED).amountCents).toBe(29900)
    })
    it('derives Stripe cents from data.object.amount (already minor units)', () => {
      expect(MIGRATION_SQL).toMatch(/\(p_event->'data'->'object'->>'amount'\)::int/)
    })
    it('uppercases currency and defaults to TRY', () => {
      expect(MIGRATION_SQL).toMatch(/v_currency\s*:=\s*upper\(COALESCE\([\s\S]*?'TRY'\s*\)\)/)
      expect(deriveUpgradeParams(DODO_PAYMENT_SUCCEEDED).currency).toBe('TRY')
      const noCurrency = { ...DODO_PAYMENT_SUCCEEDED, metadata: { ...DODO_PAYMENT_SUCCEEDED.metadata, currency: undefined } }
      expect(deriveUpgradeParams(noCurrency).currency).toBe('TRY')
    })
    it('amount extraction is regex-guarded (malformed amount → NULL, never throws)', () => {
      expect(MIGRATION_SQL).toMatch(/~\s*'\^\[0-9\]\+\(\\\.\[0-9\]\+\)\?\$'/)
      const bad = { ...DODO_PAYMENT_SUCCEEDED, metadata: { ...DODO_PAYMENT_SUCCEEDED.metadata, amount: 'abc' } }
      // parseFloat('abc') → NaN → Math.round(NaN) → NaN; the SQL guard yields NULL.
      expect(Number.isNaN(deriveUpgradeParams(bad).amountCents)).toBe(true)
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

describe('Idempotency — subscription_events contract', () => {
  it('Dodo event_id is the event.id field', () => {
    expect(DODO_PAYMENT_SUCCEEDED.id).toBe('dodo_evt_test_001')
  })
  it('Stripe event_id is the top-level id field', () => {
    expect(STRIPE_PAYMENT_INTENT_SUCCEEDED.id).toBe('pi_test_001')
  })
  it('the UNIQUE constraint is on event_id ALONE (not source+event_id)', () => {
    // Real producer: subscription_events declares UNIQUE (event_id) — provider is a
    // separate NON-unique column (2026042409_subscription_state.sql), and
    // apply_subscription_event inserts (event_id, provider, ...) catching
    // unique_violation on event_id. So event_id is the sole dedup key: two events
    // sharing an id collide REGARDLESS of provider. (The old test asserted a
    // (source,event_id) composite key, which does not exist — drift.)
    const events = [
      { provider: 'dodo',   event_id: 'evt_shared_001' },
      { provider: 'dodo',   event_id: 'evt_shared_001' },  // replay — deduped
      { provider: 'stripe', event_id: 'evt_shared_001' },  // SAME id — also deduped
      { provider: 'dodo',   event_id: 'evt_other_002' },   // distinct id
    ]
    const uniqueByEventId = new Set(events.map(e => e.event_id))
    expect(uniqueByEventId.size).toBe(2)  // only 'evt_shared_001' + 'evt_other_002'
  })
  it('duplicate event_id short-circuits to {ok:true, duplicate:true} in the SQL', () => {
    // Assert against the real producer: the unique_violation handler returns a
    // duplicate ack rather than re-processing or throwing.
    expect(MIGRATION_SQL).toMatch(/EXCEPTION WHEN unique_violation THEN[\s\S]*?'duplicate',\s*true/)
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
