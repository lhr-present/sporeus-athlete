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

## Phase 2: AI Layer — COMPLETE ✓

**Completed 2026-04-24 | v11.3.0**

| Block | Scope | Status |
|-------|-------|--------|
| P2-A: embed-session | Embed sessions + ai_insights via OpenAI text-embedding-3-small | ✓ Done (v11.3.0) |
| P2-B: embed-query | Semantic cosine search; match_sessions_for_user/coach RPCs | ✓ Done (v11.3.0) |
| P2-C: ai-batch-worker | pgmq drain; Claude Haiku weekly digest; RAG context; cron `* * * * *` | ✓ Done (v11.3.0) |
| P2-D: ai-proxy edge fn | Tier enforcement + RAG + Anthropic proxy | ✓ Done (v11.3.0) |

**Phase 2 baseline**: 42 tables + 3 MVs, 29 edge fns, 15 cron jobs, 2807 tests

**Pending (not blocking)**: Set `EMBEDDING_API_KEY` in Supabase secrets to activate semantic search

---

## Phase 3: UI — NEXT

| Block | Scope | Status |
|-------|-------|--------|
| P3-A: SemanticSearch.jsx | Natural language session search for athletes | Planned |
| P3-B: SquadPatternSearch.jsx | Coach-only squad semantic search | Planned |
| P3-C: AI Chat widget | ai-proxy integration in athlete dashboard | Planned |
| P3-D: WeeklyDigest view | Coach dashboard weekly digest card | Planned |

---

## Deployment Checklist (before Phase 2)

- [ ] Enable leaked password protection (Supabase Dashboard → Auth → Email)
- [ ] Set ANTHROPIC_API_KEY in Supabase secrets (already stored as `sporeus-coach-key`)
- [ ] Verify `purge-deleted-accounts` cron running (check `cron.job` table)
- [ ] Smoke test export-user-data and purge-deleted-accounts edge functions
- [ ] Confirm `user-exports` bucket exists and is private
