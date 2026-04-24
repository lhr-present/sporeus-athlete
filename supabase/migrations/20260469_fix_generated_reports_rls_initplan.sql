-- Fix auth_rls_initplan warning on generated_reports: use (SELECT auth.uid())
-- subquery pattern to avoid per-row re-evaluation.
DROP POLICY IF EXISTS "generated_reports: own rows" ON public.generated_reports;

CREATE POLICY "generated_reports: own rows" ON public.generated_reports
  FOR ALL USING (user_id = ( SELECT auth.uid() AS uid));
