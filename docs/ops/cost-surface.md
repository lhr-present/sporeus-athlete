# Billable Surface — what costs money (audited 2026-06-16)

Goal: stay on the base Supabase plan; avoid surprise external spend.

## Supabase — NO paid add-ons
- `selected_addons: []` — no Custom Domain, no Compute upgrade (default compute),
  no PITR, no Read Replica, no extra storage add-on. (Verified via Management API
  `/v1/projects/{ref}/billing/addons`.)
- Project: `pvicqwapvvfempjdgwbm`, region us-east-2, Postgres 17, ACTIVE_HEALTHY.
- So the Supabase bill is just the base plan. Keep the org **spend cap ON** to prevent
  usage-overage billing. Don't enable PITR / read-replica / compute add-ons without intent.

## External paid APIs the code calls (billed SEPARATELY from Supabase)
| Service | Where | When it bills | Status 2026-06-16 |
|---|---|---|---|
| **OpenAI** embeddings (`api.openai.com/v1/embeddings`) | `ai-proxy`, `ai-batch-worker`; crons `embed-backfill` (*/10 min), `ai-batch-worker` (*/1 min) | per token, as soon as sessions exist to embed | **$0 — dormant.** `insight_embeddings`=0, `training_log`=0, all queues empty. |
| **Anthropic** (`api.anthropic.com/v1/messages`, claude-haiku-4-5) | `ai-proxy` (user-triggered, Coach/Club only), `ai-batch-worker`, `generate-report-*` crons (weekly/monthly) | per token, on AI use / report gen | **$0 — dormant.** `ai_proxy_usage`=0, `generated_reports`=0. |
| **Resend** (`api.resend.com/emails`) | `purge-deleted-accounts`, `dodo-webhook`, `operator-digest` | per email above free tier (~3k/mo) | negligible at current scale |
| **Dodo / Stripe** | billing webhooks | transaction % only (no fixed cost) | n/a |

## AI/embedding crons — DISABLED 2026-06-16 (external spend locked at $0)
The 5 crons that call paid external APIs are now `active = false` on prod (per the
"keep spend at $0" decision). The internal-ops crons (push-worker, purge-*, refresh-mv,
strava-backfill, trigger-checkin-reminders, reconcile-subscriptions, operator-digest,
etc.) stay active — none of them call paid external APIs.

| Cron | Was | External cost |
|---|---|---|
| `embed-backfill` (*/10 min) | active | OpenAI embeddings |
| `ai-batch-worker` (*/1 min) | active | Anthropic + OpenAI |
| `enqueue-ai-batch` (weekly) | active | (enqueues AI work) |
| `generate-report-weekly` (Mon) | active | Anthropic |
| `generate-report-monthly-squad` (monthly) | active | Anthropic |

Disabled with:
```sql
SELECT cron.alter_job(jobid, active := false) FROM cron.job
 WHERE jobname IN ('embed-backfill','ai-batch-worker','enqueue-ai-batch',
                   'generate-report-weekly','generate-report-monthly-squad');
```
**Re-enable** (when you want AI features / are OK paying OpenAI+Anthropic per token):
```sql
SELECT cron.alter_job(jobid, active := true) FROM cron.job
 WHERE jobname IN ('embed-backfill','ai-batch-worker','enqueue-ai-batch',
                   'generate-report-weekly','generate-report-monthly-squad');
```
Effect of disabling: no auto session-embeddings (semantic search won't populate), no
scheduled AI reports. `ai-proxy` (user-triggered, Coach/Club only) is unaffected by the
crons but is dormant anyway (no paid coaches); it also fails closed if the API keys are
unset. Belt-and-suspenders option: also leave `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
edge secrets unset → every AI path is $0 regardless of crons.

AI usage (if ever re-enabled) is capped per tier via `ai_proxy_usage` metering + `TIER_LIMITS`.

Edge invocations / cron ticks themselves are within the Supabase plan (cheap); the cost
risk is the external LLM/embedding API calls, which are **currently zero**.
