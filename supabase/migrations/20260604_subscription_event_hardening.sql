-- 20260604_subscription_event_hardening.sql — webhook billing-integrity fixes
--
-- Hardens apply_subscription_event() (originally 20260424_subscription_state.sql).
-- Plain CREATE OR REPLACE — safe to apply any time, takes effect immediately for
-- the next webhook, no cron/secret coupling. (round-4 audit MED, billing)
--
-- Three fixes:
--   1. id-less events were given a FABRICATED random event_id
--      (`'evt_' || gen_random_uuid()`), which defeats the UNIQUE(event_id) replay
--      guard — a webhook with no `id` replayed N times → processed N times. Now
--      rejected outright (`reason: no_event_id`) so the idempotency key is real.
--   2. `payment.succeeded` with no tier metadata defaulted to granting 'coach'
--      (the paid tier) for FREE. Default removed.
--   3. No tier whitelist — any string flowed into apply_tier_change. Now the tier
--      must be one of ('coach','club') or the grant is refused (`invalid_tier`).
--      The event is still logged before the refusal (audit + idempotency).
--
-- Everything else (user_id resolution, the other event branches, the audit
-- inserts, grants) is reproduced verbatim from 20260424.

CREATE OR REPLACE FUNCTION public.apply_subscription_event(p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id text;
  v_type     text;
  v_provider text;
  v_user_id  uuid;
  v_tier     text;
BEGIN
  v_type     := p_event->>'type';
  v_provider := COALESCE(p_event->>'provider', 'dodo');

  -- Fix 1: require a real event id — no fabrication (would defeat replay dedup).
  v_event_id := p_event->>'id';
  IF v_event_id IS NULL OR v_event_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_event_id');
  END IF;

  v_user_id := COALESCE(
    (p_event->'metadata'->>'user_id')::uuid,
    (p_event->>'user_id')::uuid,
    (p_event->'data'->'object'->'metadata'->>'user_id')::uuid
  );

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_user_id');
  END IF;

  BEGIN
    INSERT INTO public.subscription_events(event_id, provider, type, user_id, payload, processed_at)
    VALUES (v_event_id, v_provider, v_type, v_user_id, p_event, now());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'event_id', v_event_id);
  END;

  CASE v_type
    WHEN 'payment.succeeded', 'payment_intent.succeeded', 'invoice.payment_succeeded' THEN
      -- Fix 2 + 3: no 'coach' default; tier must be explicitly one of the paid set.
      v_tier := COALESCE(
        p_event->'metadata'->>'tier',
        p_event->'data'->'object'->'metadata'->>'tier'
      );
      IF v_tier IS NULL OR v_tier NOT IN ('coach', 'club') THEN
        -- Event is already logged above (audit + idempotency); refuse the grant.
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tier',
                                  'event_id', v_event_id, 'tier', v_tier);
      END IF;
      PERFORM public.apply_tier_change(
        p_user_id := v_user_id, p_new_tier := v_tier, p_reason := v_type,
        p_webhook_event_id := v_event_id, p_webhook_source := v_provider
      );
      UPDATE public.profiles SET subscription_provider = v_provider, updated_at = now()
      WHERE id = v_user_id;

    WHEN 'payment.failed', 'invoice.payment_failed' THEN
      UPDATE public.profiles SET
        subscription_status  = 'past_due',
        grace_period_ends_at = now() + INTERVAL '3 days',
        updated_at           = now()
      WHERE id = v_user_id;

    WHEN 'subscription.cancelled', 'customer.subscription.deleted' THEN
      UPDATE public.profiles SET
        subscription_status   = 'cancelled',
        subscription_end_date = COALESCE(
          to_timestamp((p_event->'data'->'object'->>'current_period_end')::double precision),
          subscription_expires_at, now() + INTERVAL '30 days'
        ),
        updated_at = now()
      WHERE id = v_user_id;
      INSERT INTO public.billing_events(user_id, event_type, reason, webhook_source, webhook_event_id)
      VALUES (v_user_id, 'tier_downgrade', v_type, v_provider, v_event_id);

    WHEN 'subscription.created', 'subscription.trial_start' THEN
      UPDATE public.profiles SET
        subscription_status   = 'trialing',
        subscription_provider = v_provider,
        trial_ends_at = COALESCE((p_event->>'trial_ends_at')::timestamptz, now() + INTERVAL '14 days'),
        updated_at = now()
      WHERE id = v_user_id;

    WHEN 'subscription.updated' THEN
      UPDATE public.profiles SET
        subscription_current_period_end = COALESCE(
          (p_event->>'current_period_end')::timestamptz, subscription_current_period_end
        ),
        updated_at = now()
      WHERE id = v_user_id;

    ELSE NULL;
  END CASE;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_event(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_subscription_event(jsonb) TO service_role;
