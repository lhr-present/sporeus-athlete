# Sporeus Athlete App — Publish Command Center

## Phase 1: Backend + Security Foundation — COMPLETE ✓

**Completed 2026-04-23 | v11.0.10 → v11.2.0**

| Block | Scope | Status |
|-------|-------|--------|
| B1: Webhook state machine | `apply_subscription_event` SQL + `dodo-webhook` rewrite | ✓ Done (v11.1.0) |
| B2: KVKK/GDPR data rights | Export + deletion + 30-day grace + legal docs | ✓ Done (v11.1.1) |
| B3: Security hardening | search_path + RLS initplan + index cleanup | ✓ Done (v11.2.0) |

**Phase 1 baseline:** 40 tables + 3 MVs, 25 edge functions, 14 cron jobs, 2807 tests

---

## Phase 2: AI Layer — NEXT

Target: embed-session → embed-query → ai-batch-worker behind ai-proxy

| Block | Scope | Status |
|-------|-------|--------|
| P2-A: embed-session | Trigger embedding on training log insert | Planned |
| P2-B: embed-query | Semantic search over session embeddings | Planned |
| P2-C: ai-batch-worker | Drain `ai_batch` queue, call ANTHROPIC_API_KEY | Planned |
| P2-D: ai-proxy edge fn | Auth gateway for all AI calls | Planned |

---

## Deployment Checklist (before Phase 2)

- [ ] Enable leaked password protection (Supabase Dashboard → Auth → Email)
- [ ] Set ANTHROPIC_API_KEY in Supabase secrets (already stored as `sporeus-coach-key`)
- [ ] Verify `purge-deleted-accounts` cron running (check `cron.job` table)
- [ ] Smoke test export-user-data and purge-deleted-accounts edge functions
- [ ] Confirm `user-exports` bucket exists and is private
