# Migration Squash — Baseline Verification Checklist

Companion to `scripts/squash-baseline.sh` and `docs/ops/migration-squash-runbook.md`.
Goal: collapse the drifted 128-file history into one prod-matching baseline so a
**fresh branch provisions clean** (fixes chronic `MIGRATIONS_FAILED` on
contract-smoke / db-branch-preview / perf-regression / rls-pentest).

> The squash does **NOT** alter prod's live schema. It re-aligns the repo history
> and (optionally) prod's `schema_migrations` bookkeeping with reality.

## Why deferred (env gate)
The baseline MUST come from `pg_dump` / `supabase db dump` — a hand-assembled one
silently drops function bodies, RLS expressions, grants and triggers, making fresh
branches *diverge* from prod (worse than today's loud failure). The agent sandbox
has the PAT but **no Docker and no pg_dump**, so S1 cannot run here.

## Sequencing
1. Do this **after** the service_role key rotation, so the baseline captures the
   post-rotation GUC state and isn't re-dumped. (Rotation is already DONE per
   CHANGELOG v9.413; safe to proceed when an operator machine is available.)
2. Run `CONFIRM=1 PITR_CONFIRMED=1 scripts/squash-baseline.sh` on that machine.
3. **GATE (S5):** disposable-branch provision must be clean + `db diff` empty
   before merging to `main`. Non-negotiable.

## Baseline fingerprint — the dump MUST contain
Tables: `training_log` (with `distance_m`, `avg_hr`, `avg_cadence`), `coach_notes`,
`teams`, `gdpr_erasure_log`, `referral_codes`.
Functions: `tier_for_user(uuid)`, `get_my_tier()`, `get_funnel_cohort_summary`,
`get_acquisition_by_source`, `get_recent_client_errors`, `apply_subscription_event`,
`apply_tier_change`.
View: `ai_feedback_summary` as `security_invoker`.
MVs: `mv_ctl_atl_daily`, `mv_squad_readiness` with anon/authenticated SELECT revoked.
Dropped: `profiles.training_age` must be ABSENT.
Recent policy: `referral_codes` UPDATE policy = `redeemer updates referral code`
(`coach_id <> auth.uid()`) — confirms prod is at >= v9.415.

`squash-baseline.sh` greps for the core objects automatically and aborts if any are missing.

## Items NOT yet on prod (re-stack as fresh migrations post-baseline if still wanted)
Since the baseline is a dump of prod, anything not applied to prod is absent by
definition. Decide per item:
- `20260603_service_role_key_from_guc` — tie to key rotation.
- `20260604_subscription_event_hardening` — review vs prod's live billing fn first.
- `20260449_system_status` / `20260450_client_events` — decide if wanted.

## Staged `git mv` (S3 — run by the script, listed here for review)
```
mkdir -p supabase/migrations_archive
# move every *.sql EXCEPT 20260101000000_prod_baseline.sql into the archive:
for f in supabase/migrations/*.sql; do
  [ "$f" = supabase/migrations/20260101000000_prod_baseline.sql ] && continue
  git mv "$f" supabase/migrations_archive/
done
```

## Risks / gates
- **GATE 1:** disposable-branch clean provision + empty `db diff` BEFORE main merge.
- **Incomplete dump** → divergence. Mitigated by the fingerprint grep + manual diff.
- **S4 bookkeeping** edits only `schema_migrations`; reversible via `migration repair`.
  Do it only after S2 (PITR confirmed).
- **Do not** switch prod to `db push`; prod stays MCP/SQL-editor migrated.
