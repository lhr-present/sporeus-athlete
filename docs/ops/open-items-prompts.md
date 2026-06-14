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

---
---

# Grounded follow-ups (verified against code 2026-06-15)

## 8. 🔴 Operator: deploy the v9.387–v9.396 queue (exact list)
> These are committed but inert until deployed. SEQUENCE: (1) rotate the service_role key
> first (item #1). (2) Apply the 3 new migrations in order: `20260611_harden_definer_search_path.sql`,
> `20260614_coach_notes_active_link_rls.sql`, `20260615_funnel_cohort_rpc.sql`. (3) Deploy the
> changed edge functions: `supabase functions deploy strava-oauth strava-backfill-worker ai-proxy
> analyse-session embed-session embed-query nightly-batch export-user-data` (the `_shared/fetchWithTimeout.ts`
> helper ships with whichever functions import it). Smoke-test after each: connect Strava → expect
> activities within ~2s (immediate sync); revoke at strava.com → next sync writes `last_error`
> "please reconnect" and the Profile panel shows RECONNECT. NOTE: branch CI cannot provision a
> fresh Supabase branch (chronic `MIGRATIONS_FAILED` from history drift) — apply against the live
> project, not a preview branch.

## 9. Strava + manual: persist activity METRICS to training_log (distance / HR / cadence)
> VERIFIED GAP: `training_log` has only `duration_min, tss, rpe, zones, notes` columns — NO
> distance/HR/cadence. `logEntryToRow` (src/hooks/useSupabaseData.js) drops `distanceM/avgHR/
> avgCadence/durationSec`, and the Strava edge sync only puts distance+HR into the notes *text*.
> So on any second device these metrics are gone, and vo2max/EF/runningCV/cadence analytics that
> read `e.distanceM`/`e.avgHR`/`e.avgCadence` silently get nothing once data round-trips through
> Supabase. FIX: (a) migration adding `distance_m numeric, avg_hr int, avg_cadence int` to
> training_log (idempotent `ADD COLUMN IF NOT EXISTS`); (b) wire `logEntryToRow`/`logRowToEntry`
> to write+read them; (c) Strava edge (strava-oauth sync + strava-backfill-worker) to write
> `distance_m: a.distance`, `avg_hr: Math.round(a.average_heartrate)`, and `avg_cadence` —
> DOUBLING running cadence (`/run/i.test(type) ? a.average_cadence*2 : a.average_cadence`) since
> Strava reports run cadence per-leg. Add tests for the round-trip + the run-cadence doubling.
> Deploy-pending (migration + edge). This is the highest-value Strava follow-up — it's a real
> cross-device data-loss bug, not just a nicety.

## 10. Strava: route-map / trackpoint persistence (scope decision first)
> VERIFIED: `decodePolyline()` exists in src/lib/strava.js and the dead `stravaToEntry` built a
> `trackpoints` array, but NO table or column persists them and no import path writes them. Decide
> scope BEFORE building: route maps are storage-heavy (a 1h run ≈ thousands of points). Options:
> (a) skip entirely (recommended unless maps are a product goal); (b) store a downsampled polyline
> string on a new `training_log.route_polyline text` column (cheap, ~1KB); (c) a separate
> `activity_tracks` table with JSONB points (heavy). If (b): add the column, persist
> `a.map.summary_polyline` from the Strava edge, render with a lightweight map component. Don't
> store full trackpoints in localStorage (quota risk).

## 11. Strava: RPE on synced rows — founder/science decision
> VERIFIED: both Strava sync paths write `rpe: null`. Strava rows DO carry estimated `zones[]`, so
> zone-based analysis still works; the gap is anything that falls back to `e.rpe || 5` (which the
> v9.387 round flagged as a fabricated-default smell). DECIDE: (a) leave null (honest — no RPE was
> logged), and instead fix the consumers to treat missing RPE as missing rather than 5; or (b)
> estimate RPE from HR (the dead client used `min(10,max(1,round(avgHR/20)))`) and store it,
> accepting a fabricated effort value. (a) is more defensible. This is your call as the sport-science
> owner — tell me which and I'll implement.
