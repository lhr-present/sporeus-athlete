# Backend Sweep 2026-07-06 (non-Strava)

Status: IN PROGRESS. Findings appended as found.

## Findings (running log)

### F1 — HIGH (latent): parse-activity writes 3 columns that don't exist in prod `activity_upload_jobs`
- Evidence: `supabase/functions/parse-activity/index.ts:285,291,307,330,358,367` write `error`, `parsed_session_id`, `parsed_at`. Prod columns (information_schema): `id,user_id,file_path,file_name,file_type,file_size,status,log_entry_id,parse_meta,error_msg,created_at` — the code's names don't exist (`error`→`error_msg`, `parsed_session_id`→`log_entry_id`, `parsed_at`→ absent).
- Failure: PostgREST rejects UPDATEs containing unknown columns (PGRST204) → every error-path AND done-path update fails → job stuck in `parsing` forever; user never sees failure; success-path training_log row inserts but job never marked done.
- Prod impact today: `activity_upload_jobs` is EMPTY (0 rows) — latent, will break on first real file upload. (Matches known "client dead-import unwired" residual.)
- Fix: rename payload keys to `error_msg`/`log_entry_id`, drop `parsed_at` or add column via migration.

### F2 — HIGH (prod, active): cron `maybe-refresh-squad-mv` failing EVERY MINUTE for 7+ days
- Evidence: cron.job_run_details last 7d: jobname=maybe-refresh-squad-mv, status=failed, n=10080 (100% failure), msg `ERROR: column "updated_at" does not exist ... WHERE updated_at >= now() - interval '2 minutes'`.
- Failure: `public.maybe_refresh_squad_mv()` references a non-existent `updated_at` column → squad materialized view never refreshes via this path → coach squad overview stale (unless refreshed elsewhere). Also 10k error rows/week of cron log noise.
- Fix: patch function to use an existing column (e.g. training_log.created_at or a trigger-maintained touch table), or drop the job if MV refresh moved elsewhere.

### F3 — MEDIUM: attribution-log trusts UNVERIFIED JWT decode for user identity
- Evidence: `supabase/functions/attribution-log/index.ts:72-80` — `JSON.parse(atob(payloadB64))`, uses `payload.sub` as userId with NO signature verification (fn is verify_jwt=false per config.toml).
- Failure: attacker forges `Bearer x.<base64 {"sub":"<victim-uuid>","role":"authenticated"}>.y` → (a) inserts attribution_events attributed to any user, (b) stamps `profiles.first_touch` for any victim whose first_touch is still NULL (service-role update). Data-integrity/attribution poisoning, not account takeover.
- Fix: use `supabase.auth.getUser(jwt)` like every other fn (pattern already fixed elsewhere per H1 audit — this fn was missed).

### F4 — MEDIUM: garmin-oauth / garmin-sync write to `garmin_tokens` which DOES NOT EXIST in prod
- Evidence: `garmin-oauth/index.ts:111,132,142`, `garmin-sync/index.ts:156` target `garmin_tokens`; prod information_schema has no such table (query returned only `strava_tokens`). Known "L1 garmin_tokens prototype".
- Failure: any Garmin connect attempt 500s at token upsert; feature entirely dead. Also both garmin fns are ABSENT from `supabase/config.toml` verify_jwt pinning → deploy default verify_jwt=true (OK for user-called fns, but unpinned = drift risk the config comment itself warns about).
- Fix: either ship the garmin_tokens migration or remove/disable the fns; pin verify_jwt in config.toml.

### F5 — LOW/MEDIUM: ingest-telemetry — unauthenticated, unlimited insert into client_events
- Evidence: `ingest-telemetry/index.ts` — no auth, no rate limit (only 50 events/request, unlimited requests), CORS `*`, service-role insert.
- Failure: trivial table-flooding DoS (storage + queries on 30-day TTL table); user_id_hash spoofable. Bounded by TTL cron but a bot could insert millions/day.
- Fix: per-IP/session rate limit (like attribution-log's, ideally durable), or require anon JWT + gateway rate limits.

### F6 — INFO: AI digest + scheduled report pipelines are DISABLED in prod cron
- Evidence: cron.job active=false for `enqueue-ai-batch`, `ai-batch-worker`, `embed-backfill`, `generate-report-weekly`, `generate-report-monthly-squad`.
- Failure: weekly_digests/generated_reports never produced on schedule; coaches see stale/no digests. Verify intentional (cost gating?) — if intentional, document; if not, re-enable after webhook-secret header check.

### F7 — LOW: duplicate TTL crons on client_events
- Evidence: `client-events-ttl` (04:00) and `purge-client-events` (03:30) run the identical DELETE. Harmless but one should be unscheduled.

### F8 — HIGH (prod, active): analyse-session writes non-existent `ai_insights.session_id` — ai_insights table is EMPTY
- Evidence: `supabase/functions/analyse-session/index.ts:217` and `:259` upsert include `session_id: sessionId`; prod ai_insights columns = `id,athlete_id,date,data_hash,insight_json,model,created_at,explanation_text,kind,source_id` (NO session_id). Prod check: `select count(*) from ai_insights` → 0 rows.
- Failure: PGRST204 on every upsert → session analyses and coach flags NEVER persist; the insight-embedding re-trigger (gated on `!insertErr`) never fires, so insight_embeddings chain is dead too. User still sees the returned text (stored:false) so it fails silently.
- Fix: drop `session_id` key (source_id already carries it) or add the column by migration; then backfill/verify webhook wiring.

### F9 — MEDIUM (prod): cron/queue observations
- pgmq clean: all 9 queues depth 0, ai_batch_dlq 0. BUT `push_fanout` total_messages=0 ever and `notification_log` has 0 rows — the push pipeline has never delivered anything end-to-end in prod (subs missing or fanout never enqueued). trigger-checkin-reminders cron succeeds hourly; verify it actually finds eligible users.
- `weekly_digests` = 0 rows and `subscription_events` = 0 rows (billing webhook has never processed an event — matches known OPERATOR item: DODO/STRIPE secrets unset; note dodo-webhook/index.ts:18-19 THROWS at boot without them, so the fn 500s on every call until secrets are set).
- 4 legacy pgmq queues (`ai-session-analysis`,`nightly-digest`,`hrv-analysis`,`coach-report`) have 0 total messages ever — dead infrastructure, candidates for pgmq.drop_queue.
- operator_alerts `check_dependencies_stale` ×462 (stopped 2026-06-12) — alert-monitor spam history; no TTL on operator_alerts.

### F10 — HIGH (latent, feature-dead-on-first-use): comment-notification DB trigger does NOT send x-sporeus-webhook-secret
- Evidence (prod): trigger `"comment-notification"` on session_comments = `supabase_functions.http_request('.../comment-notification','POST','{"Content-Type":...,"Authorization":"Bearer <service_role JWT>"}','{}','10000')` — headers contain ONLY Authorization, no `x-sporeus-webhook-secret`. The fn (`comment-notification/index.ts:49`) hard-401s without the secret (fail-closed). Contrast: `on_training_log_embed()` (embed-session trigger) WAS patched and appends the secret header.
- Impact: every session-comment notification 401s. Currently latent — session_comments has 0 rows in prod — but the first coach/athlete comment silently notifies no one. This is the exact deploy-order failure the fn's own comment warns about.
- Fix: recreate the trigger with the secret header (same pattern as on_training_log_embed), operator action.

### F11 — HIGH (prod, active): analyse-session has NO invoker in prod (and would fail anyway per F8)
- Evidence: only training_log triggers in prod are `trg_training_log_embed_insert/update` → embed-session. No trigger/webhook/cron calls analyse-session, despite `analyse-session/index.ts:228` claiming "Both analyse-session and embed-session are triggered in parallel by the same training_log INSERT webhook".
- Impact: per-session AI analysis chain never runs server-side; combined with F8 (session_id column drift) even client-invoked runs can't persist. ai_insights = 0 rows. embed-session's C1 insight-embed block also queries `ai_insights.session_id` (`embed-session/index.ts:~230`) → 400 (swallowed best-effort) → insight_embeddings chain dead.
- Fix order: fix F8 column drift → add training_log INSERT webhook/trigger for analyse-session (with secret header) → verify ai_insights populates.

### F12 — MEDIUM: garmin cluster also references non-existent `training_log.garmin_activity_id`
- Evidence: `garmin-sync/index.ts:239-241` selects and inserts `garmin_activity_id`; prod training_log has no such column (also mapActivity rows carry it). Together with the missing `garmin_tokens` table (F4) the Garmin feature is dead end-to-end.

### F13 — LOW/MEDIUM: cron.job_run_details bloat — 498,320 rows, no cleanup job
- Evidence: `select count(*) from cron.job_run_details` = 498,320; ~24k rows/day added (3 every-minute jobs). No purge cron exists. F2's failing job contributes 1,440 failure rows/day.
- Fix: daily `DELETE FROM cron.job_run_details WHERE end_time < now()-interval '7 days'` cron (standard practice).

### F14 — LOW: alert-monitor is blind to pg_cron failures
- Evidence: `alert-monitor/index.ts` checks queue depth SLOs, DLQ, system_status — but never cron.job_run_details. F2 failed 10,080 times in 7 days with zero operator_alerts fired.
- Fix: add a check: any cron job with >N consecutive failures fires an alert.

### F15 — LOW: config.toml lists ai-batch-worker under "called by the client with a user JWT" (verify_jwt=true)
- Evidence: `supabase/config.toml` — ai-batch-worker pinned verify_jwt=true, but it is a pgmq CRON consumer gated by isVerifiedServiceCall; its code comment says it's deployed verify_jwt=false. Its cron is currently INACTIVE, so harmless today — but re-enabling the digest pipeline (F6) with verify_jwt=true + a legacy/rotated JWT in the cron header would 401 at the gateway before the fn even runs.
- Fix: move to the verify_jwt=false block when re-enabling.

### F16 — LOW: misc hygiene
- attribution_events (1,323 rows) and operator_alerts (473) have no TTL crons (client_events/generated_reports do). Slow growth; add TTLs eventually.
- public-api `checkRateLimit` fails OPEN: if the count query errors, `count ?? 0 < 100` passes (public-api/index.ts:59-66). LOW given key auth required first.
- redeem-invite `ATHLETE_LIMITS[coachTier] ?? 3` fallback grants 3 seats to any unknown tier string vs free=1 (redeem-invite/index.ts:120).
- parse-activity comment (index.ts:~316) still claims the (user_id,external_id) unique index is PARTIAL; prod index `training_log_user_external` is now FULL (migration 20260530). Comment-only staleness — device-sync's `onConflict:"user_id,external_id"` is valid.
- `.env.local` holds a live `sb_secret_...` key in plaintext — gitignored and dir is not a git repo; acceptable, just noting.
- dodo-webhook: module-level `throw` when DODO/STRIPE secrets unset (index.ts:18-19) → fn 500s on every call until operator sets them (subscription_events = 0 rows confirms nothing processed yet; known OPERATOR item).

## Checked clean
- **Auth gating**: all cron/webhook fns gate on `isVerifiedServiceCall` (constant-time secret, fail-closed): alert-monitor, check-dependencies, operator-digest, purge-deleted-accounts, nightly-batch, enqueue-ai-batch, ai-batch-worker, push-worker, trigger-checkin-reminders, comment-notification, generate-report (service path), analyse-session (service path), embed-session (service path), adjust-coach-plan, send-push (system path). User-JWT fns verify via `auth.getUser()`: ai-proxy, embed-query, redeem-invite, device-sync, squad-sync, export-user-data, parse-activity, garmin-oauth/sync, send-push (user path w/ self-or-coach check). dodo-webhook: HMAC-SHA256 constant-time for Dodo + Stripe (with ±5min replay window + event_id idempotency via apply_subscription_event RPC). public-api: api_keys Bearer + club-tier check + rate limit. EXCEPTIONS: attribution-log (F3), ingest-telemetry (F5).
- **All 12 active net.http_post crons carry x-sporeus-webhook-secret** (verified `command like '%x-sporeus-webhook-secret%'` = true for all).
- **Column drift** — verified write payloads vs information_schema, all matching: coach_notes, system_status (+PK service), operator_alerts, data_rights_requests, audit_log, notification_log, push_subscriptions, request_counts, api_keys, generated_reports, batch_errors, weekly_digests (+unique coach_id,week_start), recovery (+unique user_id,date), session_embeddings/insight_embeddings (+PKs), coach_athletes (+PK coach_id,athlete_id), profiles (first_touch, coach_id, linked_via_code, linked_at, subscription cols), training_log writes from device-sync/parse-activity insert path, attribution_events, client_events. Exceptions: F1 (activity_upload_jobs), F8 (ai_insights.session_id), F12 (garmin).
- **All RPCs called by edge fns exist in prod** with matching signatures: apply_subscription_event, enqueue_ai_batch, enqueue_push_fanout, read_push_fanout, delete_push_fanout_msg, tier_for_user, check_and_increment_ai_usage, match_sessions_for_user/coach, get_squad_overview.
- **pgmq health**: all 9 queues depth 0, ai_batch_dlq empty, no stuck messages. net._http_response (retained window): 100% status 200.
- **RLS spot-check** (pg_policies, prod): RLS enabled on all 25 audited tables. training_log SELECT = owner OR active-linked coach; UPDATE/DELETE/INSERT owner-only. session_comments = author-update, participants read/insert (via training_log ownership/coach link subquery). coach_plans = coach CRUD, athlete SELECT. messages = participant-scoped, athlete may only update (read_at) coach-sent rows. Intent preserved.
- **Secrets in repo**: no live JWTs/whsec_/sb_secret in tracked source (only forged test fixtures in supabase/tests/rls/pentest/personas.ts); .env files gitignored.
- **Correct-looking logic re-verified**: send-push early dedupe-slot reservation + targeted final update; push-worker poison cap; trigger-checkin-reminders local-day dedupe; redeem-invite atomic increment_invite_use + server-side roster cap; operator-digest targeted `notified` update; export-user-data self-only + bounded upload; dodo-webhook Stripe replay tolerance; enqueue-ai-batch time budget; nightly-batch intentional no-op (delegated to disabled queue pipeline — see F6).

## Status: COMPLETE 2026-07-06
