# RLS Policy Inventory — Sporeus Athlete App
**Generated**: 2026-04-18 | **Schema version**: v8.0.2 (post-hardening)  
**Migration**: `20260433_rls_hardening.sql` applied  
**Audit script**: `supabase/tests/rls/policy_inventory.sql`

---

## Tenancy Buckets

| # | Bucket | Tables |
|---|--------|--------|
| 1 | **Personal** — `user_id = auth.uid()` | profiles, training_log, recovery, injuries, test_results, race_results, strava_tokens, push_subscriptions, consents, notification_log, activity_upload_jobs, ctl_daily_cache, audit_log, attribution_events, generated_reports |
| 2 | **Shared via coach_athletes** | coach_notes, coach_plans, messages, team_announcements, coach_sessions, session_attendance |
| 3 | **Org-tenant (Club tier)** | api_keys, org_branding, request_counts |
| 4 | **Tier-gated (coach/club only)** | ai_insights, weekly_digests |
| 5 | **Service-role only** | mv_refresh_pending, mv_refresh_log, batch_errors, referral_codes, referral_rewards, session_embeddings, insight_embeddings |
| MV | **Materialized views** (no RLS) | mv_ctl_atl_daily, mv_weekly_load_summary, mv_squad_readiness |

---

## Bucket 1 — Personal Tables

### `profiles`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `id = auth.uid()` |
| Policies | `"profiles: own row"` (ALL, using + check `id = uid()`) |
|  | `"profiles: coaches read athletes"` (SELECT, EXISTS coach_athletes active link) |
| Risk | **MEDIUM** — `subscription_tier` column is writable by the owner. A client could UPDATE their own tier. Mitigated: tier also enforced via `get_my_tier()` SECURITY DEFINER in RLS policies and JWT injection hook. Recommendation: add RESTRICTIVE policy blocking tier updates from `authenticated` role, allow only `service_role`. |

### `training_log`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"training_log: own rows"` (ALL, using + check) |
|  | `"training_log: coaches read athletes"` (SELECT, active coach link) |
| Risk | LOW — correctly scoped. `source` and `external_id` fields are user-writable but non-privileged. |

### `recovery`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"recovery: own rows"` (ALL) |
|  | `"recovery: coaches read athletes"` (SELECT) |
| Risk | LOW |

### `injuries`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"injuries: own rows"` (ALL) |
|  | `"injuries: coaches read athletes"` (SELECT) |
| Risk | LOW |

### `test_results`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"test_results: own rows"` (ALL) |
|  | `"test_results: coaches read athletes"` (SELECT) |
| Risk | LOW |

### `race_results`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"race_results: own rows"` (ALL) |
|  | `"race_results: coaches read athletes"` (SELECT) |
| Risk | LOW |

### `strava_tokens`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"strava_tokens: own row"` (ALL) |
| Risk | LOW — access token/refresh token only readable by owner. |

### `push_subscriptions`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"push_subscriptions: own rows"` (ALL) |
| Risk | LOW |

### `consents`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"consents_self_all"` (ALL, `user_id = uid()`) |
|  | `"consents_service_read"` (SELECT, `auth.role() = 'service_role'`) |
| Risk | LOW — append-friendly; `withdrawn_at` field allows soft withdrawal without DELETE. |

### `notification_log`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"notif_log_own_read"` (SELECT only) |
| INSERT/UPDATE/DELETE | Service_role only (no policy → denied to authenticated) |
| Risk | LOW |

### `activity_upload_jobs`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"activity_upload_jobs: own rows"` (ALL) |
| Risk | LOW — `status` column writable by user; no privilege escalation possible. |

### `ctl_daily_cache`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"ctl_cache_own"` (SELECT, `user_id = uid()`) |
|  | `"ctl_cache_service"` (ALL TO service_role) |
| INSERT | Blocked for authenticated (service_role via `compute_ctl_for_user()` SECURITY DEFINER) |
| Risk | LOW |

### `audit_log`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"audit_log_insert"` (INSERT TO authenticated, `user_id = uid()`) |
|  | `"audit_log_select"` (SELECT TO authenticated, `user_id = uid()`) |
| UPDATE/DELETE | No policies → denied (immutable by design) |
| Risk | LOW — append-only. Users cannot forge entries for other user_ids. |

### `attribution_events`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"attribution_own_read"` (SELECT, `uid() = user_id`) |
|  | `"attribution_own_write"` (INSERT, `user_id IS NULL OR user_id = uid()`) |
|  | `"attribution_service_write"` (INSERT TO service_role, `true`) |
| Pre-fix status | ~~**BUG-E (MEDIUM) FIXED**~~ — old policy had `WITH CHECK (true)` allowing user_id spoofing |
| Risk | LOW (post-fix) — anonymous events allowed; authenticated users can only attribute to themselves |

### `generated_reports`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"reports_own"` (ALL, `user_id = uid()`) |
|  | `"reports_coach_squad"` (SELECT, `kind='monthly_squad'` AND coach-athlete active link) |
| Risk | LOW — storage path enforces same UID prefix via storage.objects policy. |

---

## Bucket 2 — Shared via coach_athletes

### `messages`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | Coach thread + athlete thread isolation |
| Policies | `"msg_coach_select"` (SELECT, `coach_id = uid()`) |
|  | `"msg_coach_insert"` (INSERT, `coach_id = uid() AND sender_role = 'coach'`) |
|  | `"msg_athlete_select"` (SELECT, `athlete_id = uid()`) |
|  | `"msg_athlete_insert"` (INSERT, `athlete_id = uid() AND sender_role = 'athlete'`) |
|  | `"msg_athlete_update"` (UPDATE, USING `athlete_id = uid() AND sender_role = 'coach'`, CHECK `athlete_id = uid()`) — read receipts only |
| Risk | LOW — sender_role is enforced in WITH CHECK; cross-thread leakage not possible. |

### `coach_notes`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `coach_id` writes, `athlete_id` reads |
| Policies | `"coach_notes: coach writes, athlete reads own"` (ALL, `uid()=coach_id OR uid()=athlete_id`; CHECK `uid()=coach_id`) |
| Risk | LOW — athletes cannot INSERT or UPDATE notes. |

### `coach_plans`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `coach_id` owner, `athlete_id` read-only |
| Policies | `"coach_plans: coach manages"` (ALL, coach_id) |
|  | `"coach_plans: athlete reads"` (SELECT, athlete_id) |
| Risk | LOW |

### `coach_athletes`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | Either party in relationship |
| Policies | `"coach_athletes: coach or athlete"` (ALL, `uid()=coach_id OR uid()=athlete_id`) |
| Risk | LOW — either party can revoke the link (`status='revoked'`). Athletes cannot forge `coach_id`. |

### `team_announcements`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `coach_id` owner; athletes read their own team |
| Policies | `"ta_coach_all"` (ALL, `coach_id = uid()`) |
|  | `"ta_athlete_read"` (SELECT, EXISTS active coach-athlete link) |
| Pre-fix status | ~~**BUG H-3 FIXED** (20260416)~~ — old `USING(true)` exposed all clubs' announcements |
| Risk | LOW (post-fix) |

### `coach_sessions`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `coach_id` owner; athletes read from linked coach |
| Policies | `"coach_sessions_coach_read"` + `"coach_sessions_coach_write"` (coach) |
|  | `"coach_sessions_athlete_read"` (SELECT, active link) |
| Risk | LOW |

### `session_attendance`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `athlete_id` for writes; `coach_id` reads via session join |
| Policies | `"attendance_athlete_write"` (ALL, `athlete_id = uid()`) |
|  | `"attendance_coach_read"` (SELECT, via coach_sessions join) |
| Risk | LOW |

---

## Bucket 3 — Org-tenant (Club tier)

### `api_keys`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `org_id = auth.uid()` (org owner) |
| Policies | `"api_keys_owner"` (SELECT only, `org_id = uid()`) |
| INSERT/UPDATE/DELETE | No policy for authenticated — denied. Only service_role manages key creation. |
| Risk | LOW |

### `org_branding`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `org_id = auth.uid()` |
| Policies | `"org_branding_owner"` (ALL, `org_id = uid()`) |
| Risk | LOW — Club-tier users can modify their own branding. `custom_domain` writable by owner (intended). |

### `request_counts`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Policies | **NONE** — deny all to authenticated/anon |
| Access | Service_role only (rate-limit tracking for public API edge function) |
| Risk | LOW — zero public access by design. |

---

## Bucket 4 — Tier-gated

### `ai_insights`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `athlete_id = auth.uid()` + tier gate |
| Policies | `"ai_insights_tier_check"` (SELECT+UPDATE+DELETE, `athlete_id=uid() AND get_my_tier() IN ('coach','club')`) |
|  | `"ai_insights: service write"` (INSERT TO service_role, `true`) |
| Pre-fix BUG-A | ~~**FIXED**~~ — `"ai_insights: own rows"` (no tier check) was OR'd with tier_check, letting free users read |
| Pre-fix BUG-B | ~~**FIXED**~~ — `"ai_insights: service write"` had no `TO service_role` — any authenticated user could INSERT with arbitrary athlete_id |
| Risk | LOW (post-fix) |

### `weekly_digests`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `coach_id = auth.uid()` |
| Policies | `"wd_coach_read"` (SELECT, `coach_id = uid()`) |
| INSERT/UPDATE/DELETE | Service_role only (nightly-batch writes) |
| Risk | LOW — no tier enforcement in the RLS policy itself (trust nightly-batch to only generate for coach/club). Acceptable: table is write-locked to service_role. |

---

## Bucket 5 — Service-role only

### `mv_refresh_pending`
| Field | Value |
|---|---|
| RLS enabled | ✅ (enabled by 20260433, was **disabled** before) |
| Policies | `"mv_refresh_pending_service"` (ALL TO service_role, `true`) |
| Pre-fix BUG-D | ~~**FIXED**~~ — no RLS allowed any authenticated user to INSERT, triggering spurious REFRESH MATERIALIZED VIEW CONCURRENTLY (DoS) |
| Risk | LOW (post-fix) |

### `mv_refresh_log`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Policies | `"mv_refresh_log_admin"` (SELECT, profiles.role='admin') |
|  | `"mv_refresh_log_service"` (ALL TO service_role) |
| Risk | LOW |

### `batch_errors`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Policies | `"batch_errors_service_only"` USING `false` — deny all to authenticated/anon |
| Risk | LOW — nightly-batch writes via service key, bypasses RLS. |

### `referral_codes`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Policies | `"coach reads own referral code"` (SELECT, `coach_id = uid()`) |
|  | `"coach inserts own referral code"` (INSERT, `coach_id = uid()`) |
| UPDATE | ~~Removed~~ (20260416 security fix) — UPDATE now only via `increment_referral_uses()` SECURITY DEFINER RPC |
| Pre-fix BUG H-1 | ~~**FIXED**~~ — `USING(true)` UPDATE policy let any user zero out competitor counts |
| Risk | LOW (post-fix) |

### `referral_rewards`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Policies | `"coach reads own rewards"` (SELECT, `coach_id = uid()`) |
| INSERT | No policy → service_role only |
| Risk | LOW |

### `session_embeddings`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Policies | `"session_embeddings: own rows select"` (SELECT, `uid() = user_id`) |
|  | `"session_embeddings: service role write"` (ALL, USING `true` WITH CHECK `true`) |
| Risk | **MEDIUM** — the ALL write policy with `USING(true)` applies to all roles (no `TO service_role` restriction). A non-service authenticated client making direct Postgres queries could INSERT or UPDATE embeddings for arbitrary user_ids. Mitigation: embed-session uses the service key; PostgREST clients are authenticated role and cannot write other users' rows because embedding generation requires the service key. **Recommendation**: Add `TO service_role` to the write policy for consistency. |

### `insight_embeddings`
| Field | Value |
|---|---|
| RLS enabled | ✅ |
| Tenancy | `user_id = auth.uid()` |
| Policies | `"insight_embeddings: own rows select"` (SELECT, `uid() = user_id`) |
|  | `"insight_embeddings: service role write"` (ALL, USING `true` WITH CHECK `true`) |
| Risk | Same as session_embeddings: write policy has no `TO service_role` restriction. Note: `insight_id UUID` references `ai_insights(id)` but ai_insights PK is BIGSERIAL — **schema type mismatch** (pre-existing known issue, tracked in completion audit). |

---

## Materialized Views (no RLS — gated by SECURITY DEFINER RPCs)

Postgres materialized views cannot have RLS. Access is gated by function-level security.

| View | Auth access | RPC gate | Risk |
|------|-------------|----------|------|
| `mv_ctl_atl_daily` | SELECT granted to `authenticated` (for direct read) | `get_mv_health()` SECURITY DEFINER | **MEDIUM** — direct SELECT by any authenticated user returns all athletes' CTL data (no user_id filter). Full dataset exposure. Mitigation: CTL data is not PII-sensitive, but coach data is visible to all authenticated users. **Recommendation**: revoke direct SELECT from authenticated; gate via `get_load_timeline()` or similar SECURITY DEFINER RPC. |
| `mv_weekly_load_summary` | SELECT granted to `authenticated` | `refresh_mv_load()` | Same as above |
| `mv_squad_readiness` | SELECT granted to `authenticated` | `get_squad_overview(p_coach_id)` | **MEDIUM** — returns squad readiness data including athlete names + HRV scores. Direct SELECT bypasses the coach_id filter in `get_squad_overview()`. **Recommendation**: same — revoke direct authenticated access. |

---

## Storage Buckets

### `reports` (private)
| Policy | Applies to |
|---|---|
| `"reports_user_rls"` (ALL) | `bucket_id='reports' AND foldername[1] = uid()::text` |
| `"reports_service_rls"` (ALL TO service_role) | `bucket_id='reports'` |
| Risk | LOW — path-based isolation matches row-level design. |

### `activity-uploads` (private)
| Policy | Applies to |
|---|---|
| `"activity_uploads: own files only — insert"` | `bucket_id='activity-uploads' AND foldername[1] = uid()::text` |
| `"activity_uploads: own files only — select"` | same |
| `"activity_uploads: own files only — delete"` | same |
| Risk | LOW |

---

## SECURITY DEFINER Functions (bypass RLS)

| Function | Caller | Purpose | Risk |
|---|---|---|---|
| `get_my_tier()` | authenticated | Read own tier from profiles | LOW — reads own row only |
| `inject_tier_jwt_claim(jsonb)` | supabase_auth_admin | JWT hook — inject tier into token | LOW — runs as system during auth |
| `compute_ctl_for_user(uuid)` | trigger (SECURITY DEFINER) | Compute CTL/ATL cache | LOW — scoped to p_user_id |
| `fn_update_ctl_cache()` | trigger | Calls compute_ctl_for_user for NEW.user_id | LOW |
| `fn_request_squad_refresh()` | trigger | Upsert to mv_refresh_pending | LOW — pre-hardening was DoS vector (BUG-D) |
| `maybe_refresh_squad_mv()` | pg_cron | REFRESH MV CONCURRENTLY | LOW — service-side only |
| `refresh_mv_load()` | pg_cron, admin RPC | REFRESH all 3 MVs | LOW — service-side only |
| `get_mv_health()` | authenticated RPC | MV stats — no data leakage | LOW |
| `get_squad_overview(uuid)` | authenticated RPC | Coach squad read — filters by p_coach_id | LOW — but caller must pass correct p_coach_id; no server-side validation that caller IS p_coach_id. **Note**: any authenticated user can call `get_squad_overview(arbitrary_uuid)` and get another coach's squad data. **Recommendation**: add `ASSERT p_coach_id = auth.uid()` guard. |
| `search_everything(q, limit)` | SECURITY INVOKER | FTS across tables | LOW — runs as caller; athlete_session arm joins coach_athletes so only linked sessions visible |
| `match_sessions_for_user(vector,int)` | authenticated | Cosine search own sessions | LOW |
| `match_sessions_for_coach(uuid,vector,int)` | authenticated (coach) | Cross-athlete cosine search | LOW — filters by coach_athletes active link |
| `increment_referral_uses(text)` | service_role RPC | Atomic uses_count increment | LOW |
| `fn_webhook_analyse_session()` | trigger | HTTP webhook to analyse-session | LOW — runs at service level |

---

## Function Grants

| Function | authenticated | anon | service_role | Risk |
|---|---|---|---|---|
| `enqueue_push_fanout(jsonb)` | ~~YES~~ → **REVOKED (BUG-C)** | NO | YES | Pre-fix: any user could queue arbitrary push payloads |
| `enqueue_ai_batch(...)` | NO | NO | YES | LOW |
| `enqueue_strava_backfill(...)` | NO | NO | YES | LOW |
| `get_squad_overview(uuid)` | YES | NO | YES | See SECURITY DEFINER note above |
| `search_everything(q,limit)` | YES | NO | YES | LOW (SECURITY INVOKER) |
| `get_mv_health()` | YES | NO | YES | LOW |
| `get_my_tier()` | YES | NO | YES | LOW |
| `maybe_refresh_squad_mv()` | NO | NO | YES | LOW |
| `refresh_mv_load()` | NO | NO | YES | LOW |
| `increment_referral_uses(text)` | NO | NO | YES | LOW |

---

## Bug Summary (C2 Audit — v8.0.2)

| ID | Severity | Table / Object | Description | Status |
|---|---|---|---|---|
| BUG-A | MEDIUM | `ai_insights` | `"ai_insights: own rows"` policy (no tier check) ORed with tier_check → free users could read insights | **FIXED** (DROP policy) |
| BUG-B | HIGH | `ai_insights` | `"ai_insights: service write"` INSERT had no `TO service_role` → any auth user could INSERT with arbitrary athlete_id | **FIXED** (drop + recreate with `TO service_role`) |
| BUG-C | MEDIUM | `enqueue_push_fanout` | GRANT EXECUTE to `authenticated` → any user could queue push notifications to any device | **FIXED** (REVOKE from authenticated) |
| BUG-D | LOW | `mv_refresh_pending` | RLS disabled → any auth user could INSERT, triggering spurious MV refreshes (DoS) | **FIXED** (ENABLE RLS + service_role-only policy) |
| BUG-E | MEDIUM | `attribution_events` | INSERT `WITH CHECK (true)` → any auth user could attribute events to arbitrary user_ids | **FIXED** (`WITH CHECK (user_id IS NULL OR user_id = uid())`) |
| H-1 | HIGH | `referral_codes` | UPDATE `USING(true)` → any user could zero competitor counts | **FIXED** (20260416) |
| H-3 | MEDIUM | `team_announcements` | SELECT `USING(true)` → any user could read all clubs' announcements | **FIXED** (20260416) |

### Remaining Recommendations (not yet fixed)

| Priority | Object | Issue |
|---|---|---|
| MEDIUM | `profiles` | Owner can UPDATE `subscription_tier` directly; consider RESTRICTIVE policy blocking tier changes from authenticated role |
| MEDIUM | `mv_ctl_atl_daily`, `mv_weekly_load_summary`, `mv_squad_readiness` | Direct SELECT by any authenticated user exposes all athletes' training data — revoke direct access, gate via SECURITY DEFINER RPCs |
| MEDIUM | `get_squad_overview(uuid)` | No server-side guard that caller IS the requested p_coach_id — any user can view any coach's squad |
| LOW | `session_embeddings`, `insight_embeddings` | Write policy lacks `TO service_role` restriction (cosmetic risk — still write-blocked in practice) |

---

## Verification Queries

Run after applying `20260433_rls_hardening.sql`:

```sql
-- 1. ai_insights: should have 2 policies (tier_check + service write to service_role)
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname='public' AND tablename='ai_insights';

-- 2. enqueue_push_fanout: authenticated should NOT have EXECUTE
SELECT has_function_privilege('authenticated','enqueue_push_fanout(jsonb)','EXECUTE');
-- Expected: false

-- 3. mv_refresh_pending: RLS must be enabled
SELECT relrowsecurity FROM pg_class
WHERE relnamespace='public'::regnamespace AND relname='mv_refresh_pending';
-- Expected: true

-- 4. attribution_events: should have 3 policies
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname='public' AND tablename='attribution_events';

-- 5. Tables with RLS disabled (should return 0 rows post-hardening)
SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false;
```
