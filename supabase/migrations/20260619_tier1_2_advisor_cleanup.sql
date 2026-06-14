-- Tier-1/2 advisor cleanup (v9.402): RLS initplan perf + duplicate/missing indexes
-- + fixed search_path on 2 functions + duplicate permissive policy.
-- All semantics-preserving (verified against pg_policies / pg_indexes on prod).
--
-- Intentionally NOT changed (documented):
--   * ai_proxy_usage: RLS-enabled-no-policy is a deliberate deny-all (service_role metering table).
--   * 11 "unused" indexes: false positive at n=8 users; keep (would hurt at scale, esp. vector/FK).
--   * extensions in public (pg_net/vector/pgtap): moving them breaks dependents — operator/deferred.
--   * leaked-password protection: Dashboard toggle (operator).

-- ── auth_rls_initplan: wrap auth.uid()/get_my_tier() in (select ...) so they evaluate once/query ──
alter policy "attribution_own_read"  on public.attribution_events using ((select auth.uid()) = user_id);
alter policy "attribution_own_write" on public.attribution_events with check ((user_id is null) or (user_id = (select auth.uid())));
alter policy "message_reads_own"     on public.message_reads using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "export_jobs: user owns rows" on public.export_jobs using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "deletion_requests: user can insert/select own" on public.deletion_requests with check ((select auth.uid()) = user_id);
alter policy "deletion_requests: user can read own" on public.deletion_requests using ((select auth.uid()) = user_id);
alter policy "consent_purposes: user owns rows" on public.consent_purposes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "onboarding_state: user owns row" on public.onboarding_state using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "ai_feedback: athlete can insert own" on public.ai_feedback with check ((select auth.uid()) = user_id);
alter policy "ai_feedback: athlete can read own"   on public.ai_feedback using ((select auth.uid()) = user_id);
alter policy "org_branding_owner" on public.org_branding
  using (org_id = (select auth.uid()))
  with check ((org_id = (select auth.uid())) and ((select get_my_tier()) = 'club'::text));

-- ── multiple_permissive_policies: drop the duplicate SELECT policy (identical to "team_announcements: select") ──
drop policy if exists "ta_athlete_read" on public.team_announcements;

-- ── duplicate_index: idx_client_events_ttl_col == idx_client_events_created_at (both btree(created_at DESC)) ──
drop index if exists public.idx_client_events_ttl_col;

-- ── unindexed_foreign_keys: add covering indexes ──
create index if not exists idx_deletion_requests_purge_audit_id on public.deletion_requests (purge_audit_id);
create index if not exists idx_message_reads_user_id on public.message_reads (user_id);

-- ── function_search_path_mutable: pin an explicit search_path ──
alter function public.log_consent_change()             set search_path = 'public';
alter function public.search_everything(text, integer) set search_path = 'public';
