# Sporeus Operator Runbook v8.0.5

> **Observability complete milestone** — from v8.0.5 forward, silent failures are a bug class.  
> Every failure must produce: an `operator_alerts` row + Telegram (if `TELEGRAM_BOT_TOKEN` set) + appear in Axiom.

---

## Quick Reference

| Need | Where |
|------|-------|
| Live queue depths | Admin dashboard → Queue Depths panel |
| Edge fn error rate | Axiom: Error Rate dashboard |
| Last MV refresh | Admin dashboard → run `get_mv_health()` |
| Recent alerts | Admin dashboard → Recent Alerts panel |
| Weekly stats | Monday email OR `operator_alerts WHERE kind='weekly_digest'` |
| PITR restore | `ops/supabase_pro_checklist.md §1` |
| Secrets list | `supabase secrets list` |

---

## On-Call Response Matrix

| Signal | Severity | First response | SLA |
|--------|----------|----------------|-----|
| Telegram 🚨 + `service_down_*` | Critical | Check `system_status` + Axiom | 15 min |
| Telegram 🚨 + `dlq_nonempty` | Critical | Read DLQ, fix root cause | 30 min |
| Telegram ⚠️ + queue depth | Warning | Check queue drain rate | 2 hours |
| Telegram ⚠️ + `push_failure_spike` | Warning | Check VAPID + send-push logs | 2 hours |
| Weekly digest — critical alerts > 0 | — | Review + post-mortem if >3 | Next business day |

---

## Common Procedures

### 1. Drain stalled DLQ

```bash
# Read failed message (VT=30s to prevent race)
npx supabase db query --linked <<'SQL'
SELECT id, message, read_ct, enqueued_at
FROM pgmq.read('ai_batch_dlq', 30, 1);
SQL

# After fixing root cause, move back to main queue
npx supabase db query --linked <<'SQL'
SELECT pgmq.send('ai_batch', message::jsonb)
FROM   pgmq.read('ai_batch_dlq', 0, 10);
-- Then delete from DLQ:
SELECT pgmq.delete('ai_batch_dlq', ARRAY(
  SELECT id FROM pgmq.read('ai_batch_dlq', 0, 100)
));
SQL
```

### 2. Force MV refresh

```bash
npx supabase db query --linked <<'SQL'
SELECT refresh_mv_load();
SELECT * FROM get_mv_health();
SQL
```

### 3. Check which alerts fired today

```bash
npx supabase db query --linked <<'SQL'
SELECT kind, severity, title, fired_at
FROM operator_alerts
WHERE fired_at >= CURRENT_DATE
ORDER BY fired_at DESC;
SQL
```

### 4. Trigger weekly digest manually

```bash
curl -X POST "$SUPABASE_URL/functions/v1/operator-digest" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual"}'
```

### 5. Run dependency check manually

```bash
curl -X POST "$SUPABASE_URL/functions/v1/check-dependencies" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### 6. Test alert monitor manually

```bash
# Simulate a queue depth breach by inserting a fake queue_metrics row:
npx supabase db query --linked <<'SQL'
INSERT INTO queue_metrics (queue_name, depth, oldest_age_s)
VALUES ('ai_batch', 150, 600);  -- 150 > SLO of 100
SQL
# Then call alert-monitor — should fire 'queue_depth_ai_batch' alert
curl -X POST "$SUPABASE_URL/functions/v1/alert-monitor" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### 7. Rotate Anthropic API key

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Redeploy affected functions:
supabase functions deploy ai-proxy analyse-session ai-batch-worker
```

---

## Secrets Required for Full Observability

| Secret | Purpose | How to set |
|--------|---------|------------|
| `AXIOM_TOKEN` | Edge function telemetry to Axiom | `supabase secrets set AXIOM_TOKEN=...` |
| `AXIOM_DATASET` | Axiom dataset name (default: `sporeus-edge`) | `supabase secrets set AXIOM_DATASET=sporeus-edge` |
| `TELEGRAM_BOT_TOKEN` | Telegram alert delivery | `supabase secrets set TELEGRAM_BOT_TOKEN=...` |
| `TELEGRAM_CHAT_ID` | Operator's Telegram chat ID | `supabase secrets set TELEGRAM_CHAT_ID=...` |
| `RESEND_API_KEY` | Weekly digest email delivery | `supabase secrets set RESEND_API_KEY=...` |

Without these, alerts are stored in `operator_alerts` table only (still visible in admin dashboard).

---

## New Cron Jobs (v8.0.5)

| Job | Schedule | Function |
|-----|----------|----------|
| `check-dependencies` | `*/5 * * * *` | Pings 5 external services → `system_status` |
| `alert-monitor` | `* * * * *` | Evaluates 5 alert conditions → `operator_alerts` |
| `operator-digest-weekly` | `0 5 * * 1` | Weekly summary email (Mon 08:00 Istanbul) |
| `client-events-ttl` | `0 4 * * *` | Purge `client_events` older than 30 days |

---

## Observability Architecture

```
Browser client
  └─ telemetry.js (localStorage ring + 30s server flush)
       └─ POST /functions/v1/ingest-telemetry
            └─ client_events table (30-day TTL)

Edge functions
  └─ _shared/telemetry.ts (withTelemetry wrapper)
       └─ AXIOM_TOKEN → Axiom sporeus-edge dataset

pg_cron jobs
  ├─ check-dependencies → system_status table → StatusBanner
  ├─ alert-monitor      → operator_alerts table → Telegram
  └─ operator-digest    → Resend email (Mon 08:00 Istanbul)

Admin dashboard (ObservabilityDashboard.jsx)
  ├─ get_system_status() RPC
  ├─ queue_metrics table
  ├─ get_funnel_today() RPC
  ├─ get_recent_client_errors() RPC
  └─ operator_alerts table
```

---

## SLO Breach Escalation

1. Alert fires → `operator_alerts` row inserted
2. `alert-monitor` picks up Telegram notification
3. Operator acknowledges: set `resolved_at = NOW()` in `operator_alerts`
4. Post-mortem for Critical alerts (Duration × Impact matrix):
   - < 5 min: no post-mortem required
   - 5–30 min: brief incident note in `operator_alerts.body`
   - > 30 min: full post-mortem, add to incident log in `docs/ops/slos.md`

---

## First Week Checklist (v8.0.5 deploy)

- [ ] Set `AXIOM_TOKEN` + `AXIOM_DATASET` secrets
- [ ] Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets  
- [ ] Set `RESEND_API_KEY` secret
- [ ] Import 5 dashboards from `ops/axiom_dashboards/` into Axiom
- [ ] Trigger `check-dependencies` manually — verify `system_status` updates
- [ ] Trigger `alert-monitor` with synthetic queue depth — verify Telegram fires
- [ ] Trigger `operator-digest` manually — verify email received
- [ ] Verify `StatusBanner` shows during simulated outage (set any service to 'down' manually)
- [ ] Verify `ObservabilityDashboard` renders for admin user
