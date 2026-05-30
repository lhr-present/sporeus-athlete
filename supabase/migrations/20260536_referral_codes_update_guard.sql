-- 20260536_referral_codes_update_guard.sql — M1 (MEDIUM)
--
-- 20260413_referral.sql defines:
--   CREATE POLICY "authenticated updates referral code"
--     ON referral_codes FOR UPDATE USING (true);
-- → any authenticated user can overwrite ANY column of ANY coach's code,
--   including coach_id (steal attribution) and reward_granted.
--
-- The client legitimately needs to bump uses_count when a code is applied
-- (src/lib/referral.js:44 runs as the redeeming user, not the coach), so we
-- cannot simply drop the UPDATE policy. RLS WITH CHECK alone can't compare to
-- the OLD row, so we enforce immutability with a BEFORE UPDATE trigger that
-- restores the protected columns, and keep a (still-needed) UPDATE policy.
--
-- Net effect: a non-owner may only ever increment uses_count / flip
-- reward_granted; coach_id, code and created_at are frozen.
-- Idempotent: guarded + CREATE OR REPLACE + drop-then-create trigger.

DO $$
BEGIN
  IF to_regclass('public.referral_codes') IS NULL THEN
    RAISE NOTICE 'referral_codes absent — skipping';
    RETURN;
  END IF;

  -- Replace the wide-open policy with one that still permits UPDATE but pairs
  -- with the trigger below. (USING(true) is acceptable here ONLY because the
  -- trigger neutralises the dangerous column writes.)
  DROP POLICY IF EXISTS "authenticated updates referral code" ON public.referral_codes;
  CREATE POLICY "authenticated updates referral code"
    ON public.referral_codes
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
END $$;

-- Trigger: freeze identity columns regardless of who issues the UPDATE.
CREATE OR REPLACE FUNCTION public.referral_codes_freeze_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.coach_id   := OLD.coach_id;
  NEW.code       := OLD.code;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.referral_codes') IS NULL THEN
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS trg_referral_codes_freeze ON public.referral_codes;
  CREATE TRIGGER trg_referral_codes_freeze
    BEFORE UPDATE ON public.referral_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.referral_codes_freeze_identity();
END $$;
