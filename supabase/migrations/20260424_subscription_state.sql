-- ─── 20260424_subscription_state.sql — subscription_events + apply_subscription_event ─
-- Adds provider/period columns to profiles, creates subscription_events table
-- (unified event log + idempotency), and apply_subscription_event() RPC.
-- All webhook state transitions run inside this single SQL function — auditable,
-- testable without Deno, and atomic.
-- NOTE: Requires 20260452/453/454 to be applied first (billing_events, subscription
--       columns, apply_tier_change).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_provider          TEXT CHECK (subscription_provider IN ('dodo','stripe')),
  ADD COLUMN IF NOT EXISTS subscription_id                TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT        NOT NULL,
  provider     TEXT        NOT NULL CHECK (provider IN ('dodo','stripe')),
  type         TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload      JSONB       NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_events_user ON public.subscription_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_events_type ON public.subscription_events(type, created_at DESC);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscription_events' AND policyname='sub_events_service') THEN
    EXECUTE 'CREATE POLICY sub_events_service ON public.subscription_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
GRANT ALL ON public.subscription_events TO service_role;

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
  v_event_id := COALESCE(p_event->>'id', 'evt_' || public.gen_random_uuid()::text);

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
      v_tier := COALESCE(
        p_event->'metadata'->>'tier',
        p_event->'data'->'object'->'metadata'->>'tier',
        'coach'
      );
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

COMMENT ON TABLE  public.subscription_events IS 'Unified webhook event log + idempotency. UNIQUE(event_id).';
COMMENT ON FUNCTION public.apply_subscription_event IS
  'Webhook state machine: upserts subscription_events (idempotency), transitions profiles fields. '
  'SECURITY DEFINER — service_role only. Reuse for stripe-webhook when it lands.';
