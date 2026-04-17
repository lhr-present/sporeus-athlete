# Sporeus Athlete v8.0.0 — Release Notes

> Released: 2026-04-18  
> Commit range: v7.38.0 → v7.50.0  
> All 8 enhancement blocks (P1–P8) complete.

---

## What's new in v8.0.0

v8.0.0 is a major milestone consolidating eight enhancement tracks built across a single sprint. It ships production infrastructure, AI-powered features, and performance improvements that together make Sporeus ready for the Coach and Club tiers at scale.

---

## P1 — Activity File Uploads (v7.38.0 – v7.42.0)

Upload `.fit`, `.gpx`, or `.csv` files directly into the training log.

- **Storage bucket** `activity-uploads` (25 MB/file, private, RLS-scoped)
- **`parse-activity` edge function**: downloads from Storage, computes NP/IF/TSS/zones/aerobic decoupling, inserts `training_log` row with `source='file_upload'`
- **`activity_upload_jobs` table**: tracks parsing status (`pending → parsing → done/error`), links to `training_log` entry
- **Free-tier gate**: 5 uploads/month; resets monthly via pg_cron
- **`UploadActivity.jsx`**: react-dropzone modal with 25 MB guard, upload progress, and realtime job status polling

---

## P2 — Per-Session AI Coaching Insights (v7.39.0 – v7.43.0)

Every workout gets an AI coach note, automatically.

- **`analyse-session` edge function**: Claude Haiku; 14-day context window; 90-day CTL/ATL/TSB snapshot; injury flags; dedup via `source_id`
- **DB triggers**: `on_training_log_insert` (HTTP → analyse-session), `on_recovery_hrv_drop` (2σ alert → notification_log), `on_test_result_ftp` (auto-updates FTP + power zones), `on_injury_insert` (HTTP → adjust-coach-plan)
- **`adjust-coach-plan` edge function**: reads injury severity, cuts weekly volume 20–40%, writes a `coach_notes` auto-adjustment entry
- **`useInsightNotifier` hook**: realtime ai_insights subscription → toast notification on session_analysis INSERT
- Insight kinds: `daily` | `session` | `hrv` | `ftp` | `session_analysis` | `coach_session_flag` | `weekly_digest`

---

## P3 — Semantic Search via pgvector (v7.44.0 – v7.45.0)

Search your training history in natural language.

- **`session_embeddings` + `insight_embeddings` tables**: OpenAI `text-embedding-3-small` (1536-dim), HNSW indexes (m=16, ef=64), SHA-256 dedup
- **`embed-session` edge function**: DB webhook + user HTTP; dedup; UPSERT
- **`embed-query` edge function**: embeds query → `match_sessions_for_user` or `match_sessions_for_coach` (coach tier)
- **`ai-proxy` RAG mode**: `rag:true` embeds user message, injects [S1]–[S10] session context, returns citations
- **`SemanticSearch.jsx`**: Ctrl+Shift+K overlay, 350ms debounce, similarity bars, tier-gated (coach/club)
- **`SquadPatternSearch.jsx`**: coach cross-squad semantic patterns
- **`backfill_embeddings.ts` script**: Deno, 10 req/s, paginates unembedded history

---

## P4 — Realtime Squad Feed & Presence (v7.37.0 – v7.46.0)

Coaches see their athletes' activity as it happens.

- **`useRealtimeSquadFeed`**: live `training_log` + `recovery` INSERT events, 50-event cap, 30s polling fallback, backoff on disconnect
- **`useSquadPresence`**: Supabase Presence, online/offline dots, focus/blur lifecycle, opt-out flag
- **`useMessageChannel`**: broadcast typing indicators and read receipts; 2s throttle; persists `last_read_at` to `message_reads` table
- **`useSessionAttendance`**: live RSVP count updates with scale-pop animation
- **`ConnectionBanner`**: fixed-top banner when any realtime channel is connecting/reconnecting
- **`DebugRealtimeStats`**: coach+ gated overlay (localStorage `sporeus-debug-realtime=1`) with channel status + telemetry
- **`LiveSquadFeed.jsx`**: collapsible; events clickable → `onAthleteClick`

---

## P5 — PDF Report Generation (v7.47.0)

Downloadable training reports for athletes and coaches.

- **`generate-report` edge function**: Deno + `@react-pdf/renderer`; on-demand (JWT) + batch (pg_cron)
- **Three report types**:
  - Weekly Athlete (4 pages: metrics, sessions, AI insights, next-week focus)
  - Monthly Squad (cover + per-athlete detail pages, SparklineBars 4-week TSS) — Club tier
  - Race Readiness (1 page: readiness score, Riegel predictor, taper plan, injury flags) — Coach+
- **`generated_reports` table**: signed URLs (7-day expiry), 30-day retention, RLS
- **`ReportsTab.jsx`**: generate CTAs (tier-gated), history table, download + delete — bilingual EN/TR
- **Scheduled**: Sun 22:00 UTC weekly; 1st of month 06:00 UTC monthly squad

---

## P6 — pgmq Async Queue Workers (v7.40.0 – v7.48.0)

All background AI and push work now runs through durable message queues.

- **9 pgmq queues**: `ai_batch`, `ai_batch_dlq`, `strava_backfill`, `push_fanout`, `embed_backfill`, plus 4 legacy queues
- **`ai-batch-worker`**: reads 20 msgs/run (VT=30s); full RAG weekly digest (Haiku); retry [30s/120s/480s]; DLQ after 3 failures
- **`push-worker`**: drains `push_fanout` 50/run in parallel batches; 20ms gap; calls `send-push`
- **`strava-backfill-worker`**: drains `strava_backfill` 5/run; respects 600/15min rate limit via `strava_rate_state`; token refresh on expiry
- **`nightly-batch` demoted**: now a no-op — weekly digest fully delegated to queue workers
- **`QueueStats.jsx`**: admin panel: depth/oldest/DLQ badges, 1-min auto-refresh
- **`queueWorker.js`**: `MAX_RETRIES=3`, `RETRY_DELAYS=[30,120,480]`, DLQ helpers
- **`queue_metrics` table** + `refresh_queue_metrics()` + 5-min pg_cron

---

## P7 — Full-Text Search (v7.35.0 – v7.49.0)

Global Ctrl+K search across sessions, notes, messages, announcements, and athletes.

- **`normalize_for_fts(t text)`**: IMMUTABLE SQL function; folds 12 Turkish diacritics before `lower()` — handles İ→i correctly
- **5 `tsvector` generated columns**: `training_log.notes_tsv`, `coach_notes.note_tsv`, `messages.body_tsv`, `team_announcements.message_tsv`, `profiles.name_tsv`
- **5 GIN indexes**: one per column, covering LIKE-style queries via `plainto_tsquery('simple', ...)`
- **`search_everything(q, limit_per_kind DEFAULT 10)`**: SECURITY INVOKER; 5 parenthesized UNION ALL arms with `auth.uid()` filters; ranked + snippet
- **`SearchPalette.jsx`** enhancements: per-kind section headers, semantic toggle (coach/club: calls `embed-query`), recent history capped at 10, `itemRefs` scroll fix for headers
- **`textNormalize.test.js`**: extended to 20 tests covering all 6 TR diacritic pairs
- **`SearchPalette.test.jsx`**: 18 integration tests (render, FTS, keyboard nav, semantic toggle by tier, Turkish normalization, embed-query call)

---

## P8 — Materialized View Hardening (v7.36.0 – v7.50.0)

Squad readiness and load metrics now read from pre-computed MVs, not live EWMA loops.

- **`ctl_daily_cache` table**: fast-write EWMA cache (triggers on recent training_log inserts only); UPSERT via `compute_ctl_for_user()`
- **`mv_refresh_log` table**: every `refresh_mv_load()` call records `duration_ms` + `row_count` per MV — full observability
- **`mv_refresh_pending` table**: UPSERT debounce signal; triggered by `recovery` + `injuries` INSERT STATEMENT triggers; consumed by `maybe_refresh_squad_mv()` pg_cron (every minute)
- **`refresh_mv_load()` rewrite**: clock_timestamp per MV, logs to `mv_refresh_log`, CONCURRENTLY for all 3 MVs
- **`get_mv_health()` RPC**: DISTINCT ON CTE, pg_class size, GRANT to authenticated — feeds `MVHealth.jsx` admin panel
- **`get_squad_overview()` refactor**: eliminated 180-day plpgsql EWMA loop; pure SQL reading `mv_squad_readiness` + LATERAL `mv_ctl_atl_daily` join for `ctl_7ago`; identical 12-column output shape; squad dashboard p95 ~300ms → <100ms
- **`MVHealth.jsx`**: admin-gated panel, 5-column table (view/last-refresh/duration/rows/size), duration coloring, 60s auto-refresh, bilingual
- **Branch preview CI** (`.github/workflows/db-branch-preview.yml`): auto-creates Supabase preview branch on PRs touching `supabase/migrations/**`; runs SQL smoke tests + full test suite; posts result comment; cleans up on PR close

---

## Infrastructure

- **46 migration files** in `supabase/migrations/`
- **21 edge functions** (Deno 1.30+)
- **10 pg_cron jobs** (daily, hourly, per-minute, 5-min, monthly)
- **`ops/supabase_pro_checklist.md`**: PITR runbook, Axiom log drains (3 APL queries), DB branch preview CI, read replica setup + revenue trigger
- **Extensions**: pgvector, pgmq, pg_cron, pgcrypto, supabase_functions

---

## Test Suite

| Version | Tests | Delta |
|---|---|---|
| v7.38.0 | 1567 | baseline |
| v7.42.0 | 1582 | +15 |
| v7.43.0 | 1602 | +20 |
| v7.44.0 | 1623 | +21 |
| v7.45.0 | 1633 | +10 |
| v7.46.0 | 1661 | +28 |
| v7.47.0 | 1682 | +21 |
| v7.48.0 | 1709 | +27 |
| v7.49.0 | 1728 | +19 |
| v7.50.0 | 1735 | +7 |
| **v8.0.0** | **1735** | — |

---

## Breaking Changes

None. All 12-column shapes, localStorage keys, auth flow, and ACWR EWMA formula are unchanged.

---

## Upgrade Notes for Self-Hosters

1. Run all 46 migrations in order: `npx supabase db push --linked`
2. Deploy all 21 edge functions: `npx supabase functions deploy`
3. Enable extensions: `pgvector`, `pgmq`, `pg_cron`, `pgcrypto`
4. Set secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (for embeddings), `VAPID_*`, `STRAVA_*`
5. Schedule pg_cron jobs (see migration files for exact SQL)
6. Provision `activity-uploads` and `reports` storage buckets
