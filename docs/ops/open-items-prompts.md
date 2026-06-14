# Open-items prompts (post deep-dive rounds v9.387–v9.394)

Runnable prompts for the items deliberately NOT auto-applied. Each is self-contained —
paste into a Claude Code session in this repo. Order is rough priority.

---

## 1. 🔴 Operator: rotate the leaked service_role key + work the deploy queue
> The service_role JWT was leaked in public-repo SQL history; code-side is scrubbed
> (v9.373) but the key is STILL VALID. Rotate it in the Supabase dashboard
> (Settings → API → roll service_role), update the `SUPABASE_SERVICE_ROLE_KEY`
> secret in edge-function config + the `app.service_role_key` GUC, redeploy all edge
> functions. THEN work the deploy-pending queue accumulated across v9.387–v9.394:
> apply migrations `20260611_harden_definer_search_path`, `20260614_coach_notes_active_link_rls`,
> `20260615_funnel_cohort_rpc`, and `supabase functions deploy` for ai-proxy,
> analyse-session, embed-session, nightly-batch, embed-query, strava-backfill-worker,
> export-user-data. Run `docs/ops/DEPLOY_NOW.md` sequence; smoke-test after each.

## 2. Founder decision: is personal (non-squad) semantic search a paid feature?
> `embed-query/index.ts` gates the squad path on tier but leaves the non-squad path
> (semantic search over the user's OWN sessions) open to all tiers. Decide: (a) free —
> then no change, add a code comment documenting it as intentional; or (b) paid — then
> add a `tier_for_user` gate mirroring the squad branch. Tell me which and I'll implement.

## 3. Founder decision: session-comment soft-delete — enforced or cosmetic?
> `session_comments` RLS returns soft-deleted rows; the UI renders a `[deleted]`
> tombstone. Decide: (a) cosmetic tombstone is intended → add a one-line note to
> CLAUDE.md Known Limitations; or (b) deleted comments must be unreadable → add
> `AND deleted_at IS NULL` to the SELECT policy (this removes the tombstone). Tell me which.

## 4. Founder (sport-science MSc): method calls flagged by the intellectual review
> Validate against literature and tell me which to implement:
> - ACWR uses EWMA (λ_acute 0.25, λ_chronic 0.067) but Hulin/Gabbett thresholds
>   (1.3/1.5) were derived from ROLLING averages — recalibrate the thresholds for EWMA?
> - Race readiness sets targetCTL from the goal string alone and ignores VO₂max — add a
>   "aerobic ceiling vs goal" factor?
> - ACWR danger line is uniform 1.5 across sports while monotony is sport-specific —
>   sport-parameterize ACWR (cyclists sustain 1.8–2.0)?
> - `predictInjuryRisk` is additive+capped (flattens magnitude) — move to severity-graded
>   dominant-factor scoring?
> - Pattern-mining emits `confidence:'high'` at n≥4–6 — raise the finding threshold / reframe
>   as hypotheses below some n?
> NOTE: the 4 CTL engines having different decay constants is NOT a bug — nextAction's
> λ=0.067 is the intentional Hulin ACWR model. Only consolidate if you want one number.

## 5. Implement: GDPR/KVKK purge backfill (do this carefully, not blind)
> `purge_user()` / `build_user_export()` omit some user-scoped tables. FIRST read the
> COMPLETE current `purge_user` body (migrations 2026042501_data_rights.sql +
> 20260531_fix_data_rights_functions.sql) and confirm: (a) does it delete the auth.users
> row (then ON DELETE CASCADE covers message_reads/session_views) or only app tables?
> (b) is ctl_daily_cache user-scoped derived data worth purging? THEN author a new
> migration that CREATE OR REPLACEs purge_user faithfully (reproduce ALL existing
> deletes — do not drop any) adding only the genuinely-missing tables, each guarded with
> `IF to_regclass(...) IS NOT NULL`. Add a CI test that diffs information_schema
> user-scoped tables against the function body. Operator applies the migration.

## 6. Implement: edge resilience + cost (deploy-pending)
> - `ai-batch-worker`: pre-check `get_system_status()`/`system_status` for `anthropic_api`
>   health at startup; skip the batch (re-queue) if down instead of eating timeouts.
> - `ai-proxy`: add Anthropic prompt caching (`cache_control: {type:'ephemeral'}`) on the
>   STABLE system+ragContext prefix — verify stable-before-volatile ordering first so the
>   cache key is reused (volatile user_msg must come last). Measure token savings.
> Both require `supabase functions deploy`.

## 7. Build: funnel-cohort observability surface (RPC already shipped v9.394)
> `get_funnel_cohort_summary(start,end)` exists. Build the operator-digest / admin view
> that calls it and renders signed_up → first_session → first_week → activation_rate so
> n=8 becomes legible. Optional: a billing-reconciliation cron auditing subscription_status
> vs subscription_events + an Axiom alert on dodo-webhook failure rate.
