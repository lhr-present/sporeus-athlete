# Billable Surface — what costs money (audited 2026-06-16)

Goal: stay on the base Supabase plan; avoid surprise external spend.

## Branching Compute Hours — the one real overage (FIXED 2026-06-16)
The Jun 14–Jul 13 invoice showed **$8.36 of "Branching Compute Hours"** beyond the $25 Pro
plan (everything else — Compute, Egress, Function Invocations 62.7k/2M, MAU 100/100k,
Realtime 1 conn — netted to $0 under free allowances).

Root cause: CI workflows created a Supabase **preview branch per PR**, and those branches
**chronically failed to provision** (`MIGRATIONS_FAILED`, from the migration drift) yet
still billed compute. `contract-smoke.yml` never cleaned up → **23 dead branches** had
accrued ongoing hours.

Actions taken (2026-06-16):
1. **Deleted all 23 stale branches** via Management API (kept only the `main` default
   branch). `GET /v1/projects/{ref}/branches` → `DELETE /v1/branches/{id}` for each non-default.
2. **Disabled the wasteful branch workflows** (switched to `workflow_dispatch`-only):
   `contract-smoke` (per-PR, lingering — its JS contract tests run in `npm test` now),
   `db-branch-preview` (per-PR preview), and `perf-regression`'s **nightly cron** (1
   branch/night; Lighthouse covers perf). Reversible — re-enable the triggers after the
   migration-squash lets a fresh branch provision cleanly.
3. **Left** `e2e-critical-paths` (per-PR, passes — real value) and `rls-pentest` (weekly,
   security) creating branches — residual minor cost; eliminate fully by fixing the
   migration drift (so one shared branch works) or by the operator disabling the
   Supabase↔GitHub branching integration in the dashboard.

### Residual: Supabase↔GitHub integration auto-preview branch (OPERATOR — dashboard only)
Separate from the CI workflows, the **Supabase GitHub App** auto-creates a preview branch
per PR (the `Supabase Preview` check; e.g. ref `qqjcjopdkvwnyeqhuxzi`). It auto-deletes on
PR close, so it's a small transient cost — but it still bills a short-lived Micro branch
per PR and always fails (`MIGRATIONS_FAILED`). There is **no Management API to disable it**
(endpoints 404) — turn it off in the **Supabase Dashboard → Branches / Project Settings →
Integrations (GitHub) → disable automatic preview branches** (or disconnect the repo from
branching). After that, branch spend is fully $0 until branching is re-enabled (do that
only once the migration-squash lets a fresh branch provision cleanly).

> Branch-based PR checks (`contract-smoke`, `Supabase Preview`, `db-branch-preview`) will
> stop appearing — if any are REQUIRED status checks in branch protection, remove them
> there or non-admin merges will block waiting on a check that no longer runs.

### Unpaid invoice
`GLQJDI-00005` — **$36.33, due Jun 14, payment FAILED**. This is an account/payment-method
issue (operator): update the card + pay it, or the project risks restriction. Not fixable
from code.

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
