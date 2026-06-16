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

## The thing to watch
`embed-backfill` (every 10 min) and `ai-batch-worker` (every min) will call **OpenAI/
Anthropic automatically once real athlete data flows** — not gated behind a paid tier for
embeddings. Today there's no data so they no-op at $0.

### Levers to guarantee zero external spend (if desired)
1. **Don't set** the `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` edge-fn secrets → those
   functions fail closed at $0 (semantic search / AI reports simply stay off).
2. Or disable the AI/embedding crons:
   `SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='embed-backfill'), active:=false);`
   (same for `ai-batch-worker`, `enqueue-ai-batch`, `generate-report-weekly`,
   `generate-report-monthly-squad`). Reversible (`active:=true`).
3. AI usage is otherwise capped per tier (`ai_proxy_usage` metering, `TIER_LIMITS`).

Edge invocations / cron ticks themselves are within the Supabase plan (cheap); the cost
risk is the external LLM/embedding API calls, which are **currently zero**.
