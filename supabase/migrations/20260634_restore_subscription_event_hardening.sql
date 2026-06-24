-- 20260634_restore_subscription_event_hardening.sql
-- v9.458 — Restore the billing-webhook hardening that 20260627 + 20260630 silently
-- reverted. Those CREATE OR REPLACEs rebuilt apply_subscription_event from the
-- pre-hardening body, dropping the two 20260604 guards:
--   (1) reject events with no top-level `id` (else the subscription_events
--       UNIQUE(event_id) replay guard is defeated by a fabricated random id ->
--       a replayed payment.succeeded re-grants tier / double-inserts billing_events);
--   (2) require an explicit tier IN ('coach','club') (else a malformed/odd event
--       silently defaults to a paid 'coach' grant).
-- This migration re-applies both guards on top of the current (20260630) body.
-- Already applied to prod via Management API on 2026-06-24 (verified: 0 live
-- subscriptions, so no replay/grant occurred under the regression). Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.apply_subscription_event(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_event_id text;
  v_type     text;
  v_provider text;
  v_user_id  uuid;
  v_tier     text;
  v_amount_cents int;
  v_currency text;
BEGIN
  v_type     := p_event->>'type';
  v_provider := COALESCE(p_event->>'provider', 'dodo');
  -- v9.458: reject events with no top-level id so the subscription_events UNIQUE(event_id)
  -- replay guard can't be defeated by a fabricated random id (restores 20260604 hardening).
  IF p_event->>'id' IS NULL OR length(trim(p_event->>'id')) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_event_id');
  END IF;
  v_event_id := p_event->>'id';

  -- Resolve user_id across Dodo + Stripe payload shapes
  v_user_id := COALESCE(
    (p_event->'metadata'->>'user_id')::uuid,
    (p_event->>'user_id')::uuid,
    (p_event->'data'->'object'->'metadata'->>'user_id')::uuid
  );

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_user_id');
  END IF;

  -- Idempotency: insert or detect duplicate
  BEGIN
    INSERT INTO public.subscription_events(event_id, provider, type, user_id, payload, processed_at)
    VALUES (v_event_id, v_provider, v_type, v_user_id, p_event, now());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'event_id', v_event_id);
  END;

  -- State machine: delegate paid upgrades to apply_tier_change for billing_events audit
  CASE v_type
    WHEN 'payment.succeeded', 'payment_intent.succeeded', 'invoice.payment_succeeded' THEN
      v_tier := COALESCE(
        p_event->'metadata'->>'tier',
        p_event->'data'->'object'->'metadata'->>'tier'
      );
      -- v9.458: require an explicit valid paid tier; never default to a paid grant
      -- (restores 20260604 hardening dropped by 20260627/20260630).
      IF v_tier IS NULL OR v_tier NOT IN ('coach', 'club') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tier', 'event_id', v_event_id);
      END IF;
      -- Capture payment amount/currency for billing_events. Dodo: metadata.amount is a
      -- major-unit decimal string (299.00 -> 29900 cents). Stripe: data.object.amount is
      -- already minor units (900 -> 900 cents). Regex-guarded so a malformed amount can
      -- NEVER throw and break tier provisioning (falls to NULL instead).
      v_amount_cents := COALESCE(
        CASE WHEN (p_event->'metadata'->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'
             THEN round((p_event->'metadata'->>'amount')::numeric * 100)::int END,
        CASE WHEN (p_event->'data'->'object'->>'amount') ~ '^[0-9]+$'
             THEN (p_event->'data'->'object'->>'amount')::int END
      );
      v_currency := upper(COALESCE(
        p_event->'metadata'->>'currency',
        p_event->'data'->'object'->>'currency',
        'TRY'
      ));
      PERFORM public.apply_tier_change(
        p_user_id          := v_user_id,
        p_new_tier         := v_tier,
        p_reason           := v_type,
        p_webhook_event_id := v_event_id,
        p_webhook_source   := v_provider,
        p_amount_cents     := v_amount_cents,
        p_currency         := v_currency
      );
      UPDATE public.profiles SET
        subscription_provider = v_provider,
        updated_at            = now()
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
          subscription_expires_at,
          now() + INTERVAL '30 days'
        ),
        updated_at = now()
      WHERE id = v_user_id;
      INSERT INTO public.billing_events(user_id, event_type, reason, webhook_source, webhook_event_id)
      VALUES (v_user_id, 'tier_downgrade', v_type, v_provider, v_event_id);

    WHEN 'subscription.created', 'subscription.trial_start' THEN
      UPDATE public.profiles SET
        subscription_status   = 'trialing',
        subscription_provider = v_provider,
        trial_ends_at         = COALESCE(
          (p_event->>'trial_ends_at')::timestamptz,
          now() + INTERVAL '14 days'
        ),
        updated_at = now()
      WHERE id = v_user_id;

    WHEN 'subscription.updated', 'customer.subscription.updated' THEN
      -- Advance period end on renewal. Dodo puts current_period_end at the top
      -- level (ISO); Stripe nests it under data.object as a unix timestamp. (Was
      -- top-level only and matched the Dodo event name only.)
      UPDATE public.profiles SET
        subscription_current_period_end = COALESCE(
          (p_event->>'current_period_end')::timestamptz,
          to_timestamp((p_event->'data'->'object'->>'current_period_end')::double precision),
          subscription_current_period_end
        ),
        updated_at = now()
      WHERE id = v_user_id;

    ELSE NULL; -- unknown type: recorded in subscription_events, no state change
  END CASE;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_event_id);
END;
$function$
;
