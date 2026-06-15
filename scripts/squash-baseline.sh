#!/usr/bin/env bash
# squash-baseline.sh — runnable form of docs/ops/migration-squash-runbook.md
#
# Collapses the drifted 128-file migration history into a single prod-matching
# baseline so a FRESH branch can provision cleanly (fixes the chronic
# MIGRATIONS_FAILED that reds contract-smoke / db-branch-preview /
# perf-regression / rls-pentest).
#
# THIS DOES NOT CHANGE PROD'S LIVE SCHEMA. It only (a) dumps prod as a baseline
# migration, (b) archives the old history in-repo, (c) optionally reconciles
# prod's schema_migrations bookkeeping.
#
# REQUIRES (none available in the agent sandbox — run on an operator machine):
#   * Docker + pg_dump >= 15
#   * supabase CLI, logged in (SUPABASE_ACCESS_TOKEN)
#   * prod DB password (Dashboard -> Settings -> Database)
#   * a confirmed PITR snapshot (Pro plan)
#
# Nothing destructive runs without CONFIRM=1. Gates abort on the first failure.
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-pvicqwapvvfempjdgwbm}"
MIG_DIR="supabase/migrations"
ARCHIVE_DIR="supabase/migrations_archive"
BASELINE="${MIG_DIR}/20260101000000_prod_baseline.sql"
CHECKLIST="docs/ops/squash-baseline-checklist.md"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mABORT: %s\033[0m\n' "$*" >&2; exit 1; }

# ---- preflight -------------------------------------------------------------
step "Preflight"
command -v docker  >/dev/null || die "docker not found"
command -v pg_dump >/dev/null || die "pg_dump not found (need >=15)"
command -v supabase>/dev/null || die "supabase CLI not found"
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || die "SUPABASE_ACCESS_TOKEN unset"
[ "${CONFIRM:-0}" = "1" ] || die "set CONFIRM=1 to run the destructive steps (S1+). Dry preflight passed."

# ---- S1: dump prod as the single baseline ---------------------------------
step "S1: dump prod schema -> ${BASELINE}"
supabase link --project-ref "$REF"
supabase db dump --linked -f "$BASELINE"
bytes=$(wc -c < "$BASELINE")
[ "$bytes" -gt 50000 ] || die "baseline only ${bytes} bytes — dump looks truncated"

step "S1-verify: baseline must contain the prod fingerprint objects (see ${CHECKLIST})"
for obj in \
  "training_log" "coach_notes" "teams" "gdpr_erasure_log" \
  "tier_for_user" "get_my_tier" "apply_subscription_event" "apply_tier_change" \
  "ai_feedback_summary" "mv_ctl_atl_daily" "mv_squad_readiness"; do
  grep -q "$obj" "$BASELINE" || die "baseline missing expected object: $obj"
done
grep -qi "redeemer updates referral code" "$BASELINE" || \
  echo "  warn: post-v9.415 referral policy not in dump — confirm prod is current"
echo "  baseline fingerprint OK (${bytes} bytes)"

# ---- S2: PITR gate (manual confirm) ---------------------------------------
step "S2: confirm a recent PITR snapshot exists before touching bookkeeping"
[ "${PITR_CONFIRMED:-0}" = "1" ] || die "set PITR_CONFIRMED=1 once you've verified a PITR snapshot"

# ---- S3: archive old history (git-only, non-destructive to DB) -------------
step "S3: archive old migrations -> ${ARCHIVE_DIR}/"
mkdir -p "$ARCHIVE_DIR"
for f in "$MIG_DIR"/*.sql; do
  [ "$f" = "$BASELINE" ] && continue
  git mv "$f" "$ARCHIVE_DIR/"
done

# ---- S5 (run BEFORE S4): prove a fresh branch provisions clean -------------
step "S5: GATE — verify fresh provisioning on a DISPOSABLE branch"
echo "  Run: supabase branches create squash-verify"
echo "       (push baseline) then confirm NO MIGRATIONS_FAILED and 'supabase db diff' is empty,"
echo "       then: supabase branches delete squash-verify"
echo "  Merge to main ONLY after this gate passes. (left manual on purpose)"

# ---- S4: reconcile prod bookkeeping (optional, after S5 passes) ------------
step "S4: (optional) reconcile prod schema_migrations — bookkeeping only, reversible"
echo "  supabase migration repair --status reverted <each old version>"
echo "  supabase migration repair --status applied 20260101000000"
echo
echo "DONE (prep stages executed; S4/S5 left manual). See ${CHECKLIST}."
