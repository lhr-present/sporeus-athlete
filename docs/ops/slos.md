# Sporeus — Service Level Objectives (SLOs) v8.0.5

Effective: 2026-04-18  
Owner: Operator (huseyinakbulut71@gmail.com)  
Review cadence: monthly, or after any SLO breach

---

## SLO Inventory

| # | SLO | Metric | Target | Window | Alert threshold | Alert window |
|---|-----|--------|--------|--------|----------------|--------------|
| S-1 | API availability | Edge function non-5xx rate | **99.5%** | 30-day rolling | Error rate >5% | 5 min |
| S-2 | Coach dashboard latency | `get_squad_overview` p95 | **< 200 ms** | 7-day rolling | p95 >500ms | 5 min |
| S-3 | FIT/GPX parse success | `parse-activity` success rate | **95%** | 7-day rolling | Success rate <90% | 10 min |
| S-4 | Session → insight latency | `training_log` INSERT → `ai_insights` p95 | **< 30 s** | 7-day rolling | p95 >45s | 15 min |
| S-5 | Push notification delivery | Push delivered within 60s | **90%** | 24-hour rolling | Delivery rate <80% | 10 min |
| S-6 | pgmq queue depth | See table below (sustained) | **See below** | 10-min sustained | See below | 10 min |
| S-7 | Realtime message delivery | Message → client p95 | **< 3 s** | 1-hour rolling | p95 >5s | 5 min |
| S-8 | Payment webhook processing | Idempotent 100%, processed <5s | **99%** | 30-day rolling | Any failure | immediate |

### S-6 Queue Depth Thresholds

| Queue | SLO limit | Severity |
|-------|-----------|----------|
| `ai_batch` | < 100 messages | warning at 100, critical at 200 |
| `strava_backfill` | < 500 messages | warning at 500, critical at 1000 |
| `push_fanout` | < 200 messages | warning at 200, critical at 400 |
| `ai_batch_dlq` | **0** (empty always) | critical on any message |
| `embed_backfill` | < 1000 messages | warning only |

---

## Error Budget

| SLO | Monthly error budget |
|-----|---------------------|
| S-1 (99.5%) | 3.65 hours of downtime / 0.5% of requests |
| S-2 (p95 <200ms) | 5% of coach dashboard requests may exceed 200ms |
| S-3 (95%) | 5% of valid files may fail parse |
| S-4 (p95 <30s) | 5% of sessions may exceed 30s for insight |

---

## Measurement Sources

| SLO | Primary source | Backup |
|-----|---------------|--------|
| S-1 | Supabase edge function logs (stdout JSON from `withTelemetry`) | `operator_alerts` error counts |
| S-2 | `tests/perf/baselines/` | Supabase edge function logs `fn=squad-sync` |
| S-3 | `activity_upload_jobs.status` | Supabase edge function logs `fn=parse-activity` |
| S-4 | `ai_insights.created_at - training_log.created_at` | Supabase edge function logs `fn=analyse-session` |
| S-5 | `notification_log.delivery_status` | Supabase edge function logs `fn=send-push` |
| S-6 | `queue_metrics` table (refresh every 5 min) | pgmq.queue_details() RPC |
| S-7 | `useRealtimeSquadFeed` telemetry | Supabase Realtime dashboard |
| S-8 | `operator_alerts.kind=payment_*` | Dodo/Stripe dashboard |

---

## Alert Routing

All alerts → `operator_alerts` table (always visible in admin ObservabilityDashboard).

Weekly digest email → `huseyinakbulut71@gmail.com` (Monday 08:00 Istanbul / 05:00 UTC)  
Requires `RESEND_API_KEY` secret in Supabase vault.

---

## SLO Breach Runbook

**S-1 API availability breach (error rate >5%):**
1. Check `operator_alerts` for which function is failing
2. Check Axiom → Error Rate dashboard for stack traces
3. Check Supabase Dashboard → Edge Functions → Logs
4. Roll back latest migration if breach coincides with deploy

**S-6 DLQ non-empty (ai_batch_dlq > 0):**
1. Read failed message: `SELECT * FROM pgmq.read('ai_batch_dlq', 30, 1);`
2. Check error: likely Anthropic API 429 or bad message shape
3. Fix root cause, then replay: move DLQ message back to ai_batch queue
4. Monitor: next worker cycle should drain it

**S-4 Session → insight latency >30s:**
1. Check `ai_insights` for recent rows — is analyse-session writing at all?
2. Check ANTHROPIC_API_KEY secret is set: `supabase secrets list`
3. Check ai_batch queue depth — may be backlogged
4. Check if embedding API is rate-limiting (embed-session logs)

---

## Incident Log

| Date | SLO | Severity | Root cause | Resolution | Duration |
|------|-----|----------|-----------|------------|---------|
| (first entry after v8.0.5 deploy) | | | | | |
