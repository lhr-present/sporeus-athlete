# Axiom APL Queries — Sporeus v8.0.5

Dataset: `sporeus-edge` (edge function telemetry via `_shared/telemetry.ts`)  
Log drain: `sporeus-prod` (Supabase log drain → Axiom HTTP ingest)

Import dashboard JSONs from `ops/axiom_dashboards/*.json` via  
Axiom → Dashboards → Import.

---

## Dashboard 1: Overview

### Invocation count by function (5-min buckets)
```apl
['sporeus-edge']
| where fn != ""
| summarize count() by bin(_time, 5m), fn
| sort by _time desc
```

### Error rate % per function (last 1h)
```apl
['sporeus-edge']
| where fn != ""
| summarize
    total  = count(),
    errors = countif(status == "error")
  by fn
| extend error_pct = round(errors * 100.0 / total, 2)
| sort by error_pct desc
```

### p50/p95/p99 latency per function (last 1h)
```apl
['sporeus-edge']
| where status != "alive"
| summarize
    p50 = percentile(duration_ms, 50),
    p95 = percentile(duration_ms, 95),
    p99 = percentile(duration_ms, 99)
  by fn
| sort by p95 desc
```

### Heartbeat liveness (workers must emit status=alive every 60s)
```apl
['sporeus-edge']
| where status == "alive"
| summarize last_beat = max(_time) by fn
| extend stale = (now() - last_beat) > timespan(5m)
| where stale == true
```

---

## Dashboard 2: Queues

### Queue depth over time (from queue_metrics events, if forwarded)
```apl
['sporeus-prod']
| where event_message contains "queue_metrics"
| parse event_message "queue_name=\"*\" depth=*" as queue_name, depth
| summarize avg(toint(depth)) by bin(_time, 5m), queue_name
```

### DLQ activity (any message in ai_batch_dlq = page immediately)
```apl
['sporeus-edge']
| where fn == "ai-batch-worker"
| where status == "error"
| summarize failures = count() by bin(_time, 5m)
| where failures > 0
```

### Strava backfill drain rate
```apl
['sporeus-edge']
| where fn == "strava-backfill-worker"
| summarize
    runs       = count(),
    errors     = countif(status == "error"),
    avg_ms     = avg(duration_ms)
  by bin(_time, 2m)
```

### Push worker throughput
```apl
['sporeus-edge']
| where fn == "push-worker"
| summarize runs = count(), avg_ms = avg(duration_ms) by bin(_time, 1m)
```

---

## Dashboard 3: User Funnel

### Funnel step counts (today)
> Source: `client_events` table via `get_funnel_today()` RPC.  
> Direct Axiom query requires forwarding client_events to Axiom.

### Signups per day (last 30d)
```apl
['sporeus-prod']
| where event_message contains "signup_completed"
| summarize signups = count() by bin(_time, 1d)
| sort by _time desc
```

### Strava connect events
```apl
['sporeus-edge']
| where fn == "strava-oauth"
| where status == "ok"
| summarize connections = count() by bin(_time, 1d)
```

### First AI insight per user (analyse-session success)
```apl
['sporeus-edge']
| where fn == "analyse-session"
| where status == "ok"
| summarize insights = count() by bin(_time, 1d)
```

### Tier upgrade events (dodo/stripe webhooks)
```apl
['sporeus-edge']
| where fn in ("dodo-webhook", "generate-report")
| where status == "ok"
| summarize by bin(_time, 1d), fn
```

---

## Dashboard 4: Money

### Webhook invocations (dodo + stripe)
```apl
['sporeus-edge']
| where fn in ("dodo-webhook")
| summarize count() by bin(_time, 1h), status
```

### Failed payment webhooks (retry visible as duplicate request_id)
```apl
['sporeus-edge']
| where fn == "dodo-webhook"
| where status == "error"
| summarize failures = count() by bin(_time, 1h), error_class
```

### Payment webhook latency (should be <5s per S-8)
```apl
['sporeus-edge']
| where fn == "dodo-webhook"
| summarize
    p50 = percentile(duration_ms, 50),
    p95 = percentile(duration_ms, 95),
    max_ms = max(duration_ms)
  by bin(_time, 1h)
```

---

## Dashboard 5: Errors

### Top error classes last 24h
```apl
['sporeus-edge']
| where status == "error"
| summarize count() by fn, error_class
| sort by count_ desc
| take 20
```

### RLS denial spike (>20/min = alert)
```apl
['sporeus-prod']
| where event_message contains "permission denied"
| summarize denials = count() by bin(_time, 1m)
| where denials > 5
```

### Anthropic API errors
```apl
['sporeus-edge']
| where fn in ("ai-proxy", "analyse-session", "ai-batch-worker")
| where status == "error"
| where error_class contains "Anthropic" or error_msg contains "429" or error_msg contains "overloaded"
| summarize count() by bin(_time, 5m), fn, error_class
```

### Storage quota warning (supabase log drain)
```apl
['sporeus-prod']
| where event_message contains "storage" and event_message contains "quota"
| summarize count() by bin(_time, 1h)
```

### Cold-start / timeout spikes
```apl
['sporeus-edge']
| where duration_ms > 10000
| summarize slow_calls = count() by bin(_time, 5m), fn
| where slow_calls > 3
```

---

## Alert Monitor Queries (Axiom Monitor UI)

Import via Axiom → Monitors → Import JSON from `ops/axiom_dashboards/monitors.json`.

| Monitor | Query | Threshold | Frequency | Channel |
|---------|-------|-----------|-----------|---------|
| Error rate spike | `error_pct > 5` (5min window) | 5% | 5 min | Telegram + operator_alerts |
| DLQ non-empty | `fn=ai-batch-worker status=error` | any | 1 min | Telegram (critical) |
| Heartbeat miss | `status=alive absent 5min` | absent | 5 min | Telegram (critical) |
| RLS denial spike | `denials > 20 per min` | 20/min | 1 min | operator_alerts |
| Slow Anthropic | `fn=ai-proxy p95 > 45s` | 45s | 15 min | operator_alerts |
| Payment failure | `fn=dodo-webhook status=error` | any | 1 min | Telegram (critical) |
| Cron lag | `heartbeat absent 10min for workers` | absent | 10 min | Telegram |
| Storage 80% | `storage quota > 80%` | 80% | 1 hour | operator_alerts |
