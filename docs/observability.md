# Sporeus Edge Function Observability

All 21 edge functions emit structured JSON telemetry to [Axiom](https://axiom.co) via the `_shared/telemetry.ts` module.

## Required Secrets

| Secret | Purpose |
|---|---|
| `AXIOM_TOKEN` | Write-only ingest token — set via `supabase secrets set AXIOM_TOKEN=...` |
| `AXIOM_DATASET` | Dataset name (default: `sporeus-edge`) |

Without `AXIOM_TOKEN` the module falls back to `console.log` — safe for local dev.

## Event Schema

Every invocation emits one event:

```json
{
  "fn":           "analyse-session",
  "status":       "ok",
  "duration_ms":  142,
  "request_id":   "a1b2c3d4",
  "http_status":  200,
  "user_id_hash": "3f9a1c2b4e5d6f7a",
  "ts":           "2026-04-18T12:00:00.000Z"
}
```

On errors, additional fields appear:

```json
{
  "status":      "error",
  "error_class": "OpenAIError",
  "error_msg":   "Rate limit exceeded"
}
```

`user_id_hash` is `sha256(user_id).slice(0,16)` — never raw IDs or emails.

## Heartbeat Events (Long-Running Workers)

Three cron workers emit a liveness signal every 60 seconds:

- `ai-batch-worker`
- `push-worker`
- `strava-backfill-worker`

```json
{ "fn": "ai-batch-worker", "status": "alive", "ts": "..." }
```

**Alert rule**: `fn=<worker> AND status=alive | absent for 5min → page on-call`

## Axiom Query Examples

### P95 latency by function (last 24h)

```apl
['sporeus-edge']
| where _time > ago(24h)
| where status == "ok"
| summarize p95_ms = percentile(duration_ms, 95) by fn
| order by p95_ms desc
```

### Error rate by function (last 1h)

```apl
['sporeus-edge']
| where _time > ago(1h)
| summarize
    total = count(),
    errors = countif(status == "error")
    by fn
| extend error_rate = round(errors * 100.0 / total, 1)
| where error_rate > 0
| order by error_rate desc
```

### Slow requests (>2s)

```apl
['sporeus-edge']
| where _time > ago(24h)
| where duration_ms > 2000
| project fn, duration_ms, request_id, ts
| order by duration_ms desc
```

### Worker heartbeat check

```apl
['sporeus-edge']
| where _time > ago(10m)
| where status == "alive"
| summarize last_seen = max(_time) by fn
| where last_seen < ago(5m)
```

### Active users (distinct user_id_hash, last 7d)

```apl
['sporeus-edge']
| where _time > ago(7d)
| where isnotempty(user_id_hash)
| summarize dau = dcount(user_id_hash) by bin(_time, 1d), fn
```

## Local Development

No Axiom token needed. Events go to stdout:

```json
{ "_telemetry": true, "fn": "embed-session", "status": "ok", "duration_ms": 87, ... }
```

Set the token for staging/production:

```bash
supabase secrets set AXIOM_TOKEN=your-ingest-token
supabase secrets set AXIOM_DATASET=sporeus-edge
```
