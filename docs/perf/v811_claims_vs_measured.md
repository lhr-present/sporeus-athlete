# v8.1.1 Claims vs Measured — Perf Harness

> **Status**: Baselines estimated at v8.1.1 tag.  
> Replace `ESTIMATED` rows with measured values after first harness run on perf branch.  
> Runner: `npx tsx tests/perf/harness.ts` — requires `E2E_SUPABASE_URL` + `E2E_SUPABASE_SERVICE_KEY`.

---

## Existing Scenarios (carried from v8.0.4)

| # | Scenario | Sub-measurement | Claim | SLO | Measured (v8.0.4) | Status |
|---|----------|-----------------|-------|-----|-------------------|--------|
| 1 | `coach_dashboard` | `get_squad_overview` p95 | Squad overview for 10 athletes | < 500 ms | 310 ms | PASS |
| 2 | `coach_dashboard` | `get_squad_readiness_mv` p95 | MV-backed readiness read | < 5 ms | 4 ms | PASS |
| 3 | `squad_sync` | `refresh_mv_load` total | All 3 MVs, 18 k rows | < 30 s | 8.2 s | PASS |
| 4 | `squad_sync` | MV SELECT after refresh p95 | Post-refresh read latency | < 10 ms | 5 ms | PASS |
| 5 | `upload_parse` | 10× concurrent wall time | 10 GPX uploads end-to-end | < 30 s | 12.4 s | PASS |
| 6 | `insight_chain` | INSERT → ai_insights p95 | Async AI chain latency | < 30 s | 18 s | PASS |
| 7 | `report_generation` | 5× parallel p95/report | PDF generation | < 20 s | 4.2 s | PASS |
| 8 | `search_performance` | `search_everything` FTS p95 | 18 k corpus FTS | < 100 ms | 28 ms | PASS |
| 9 | `search_performance` | `match_sessions_for_user` p95 | HNSW single-athlete | < 50 ms | 35 ms | PASS |
| 10 | `ai_proxy_token_cost` | RAG overhead tokens | Context overhead vs baseline | < 2 000 tokens | 825 tokens | PASS |

---

## New E1 Scenarios (v8.1.1)

### embed_throughput

| Sub-measurement | Claim | SLO | Estimated | Measured | Status |
|-----------------|-------|-----|-----------|----------|--------|
| Single embed-session p95 | `embed-session` edge fn cold-cache | < 8 000 ms | 6 500 ms | — | ESTIMATED |
| Batch 20× avg/session | Sequential embed throughput | < 10 000 ms/session | 7 000 ms | — | ESTIMATED |
| Cascade INSERT→session_embeddings p95 | Async queue chain end-to-end | < 60 000 ms | 18 000 ms | — | ESTIMATED |

**Prerequisites for measurement:**
- `embed-session` edge function deployed and reachable
- `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_KEY` set
- Athlete with ≥ 20 rows in `training_log` (seeded by harness)
- pgmq queue worker running (for cascade test)

**Notes:**
- Single embed SLO of 8 s includes Anthropic Claude Haiku API round-trip (~1–3 s) + DB writes
- `force_re_embed: true` bypasses content_hash dedup — measures true embed latency
- Batch uses `force_re_embed: false` — cache hits will dominate; avg/session should be < single p95
- Cascade chain: `training_log` INSERT → `on_training_log_insert` webhook → pgmq `ai_batch` enqueue → `ai-batch-worker` → `embed-session` call → `session_embeddings` upsert
- If queue worker not running, cascade sub-test SKIPs gracefully (does not fail harness)

---

### squad_pattern_search

| Sub-measurement | Claim | SLO | Estimated | Measured | Status |
|-----------------|-------|-----|-----------|----------|--------|
| `match_sessions_for_coach` p95 | HNSW cross-athlete scan, 10 athletes | < 500 ms | 320 ms | — | ESTIMATED |
| `search_squad_pattern` FTS p95 | Text pattern detection across squad | < 200 ms | 45 ms | — | ESTIMATED |

**Prerequisites for measurement:**
- `match_sessions_for_coach(p_coach_id, query_embedding, match_count, match_threshold)` RPC deployed
- `session_embeddings` table seeded (≥ 1 000 vectors across 10 athletes)
- `search_squad_pattern(p_coach_id, query_text, limit_per_athlete)` RPC deployed (or falls back to `search_everything`)
- Coach linked to ≥ 1 active athlete in `coach_athletes`

**Notes:**
- Vector sub-test uses a dummy 1536-dim embedding (`Array(1536).fill(0.01)`) — measures HNSW index scan overhead, not embedding quality
- HNSW index params (m=16, ef_search=64) assumed from migration; confirm with `\d+ session_embeddings`
- FTS fallback to `search_everything` is measured as proxy if `search_squad_pattern` RPC missing; result marked with note
- 10 bilingual pattern queries (EN + TR) sampled round-robin across 50 iterations

---

## How to Update This Document

1. Run the harness on a perf branch with all prerequisites met:
   ```bash
   npx tsx tests/perf/harness.ts --keep
   ```
2. Copy measured values from the generated `tests/perf/baselines/v8.1.1.json` into the tables above.
3. Replace `ESTIMATED` with `PASS` or `FAIL` based on SLO comparison.
4. Commit as: `perf: update v8.1.1 measured baselines`

---

## Regression Baseline (for CI comparison)

The CI workflow (`perf-regression.yml`) compares each run against `tests/perf/baselines/v8.1.1.json`.  
A run **fails** if any SLO-gated metric exceeds its threshold by > 10% (regression buffer).

Current SLO gates for new E1 scenarios:

| SLO key | Threshold | Regression buffer |
|---------|-----------|-------------------|
| `embed_single_p95_ms` | 8 000 ms | 8 800 ms |
| `embed_batch_avg_per_session_ms` | 10 000 ms | 11 000 ms |
| `embed_cascade_p95_ms` | 60 000 ms | 66 000 ms |
| `squad_vector_search_p95_ms` | 500 ms | 550 ms |
| `squad_fts_pattern_p95_ms` | 200 ms | 220 ms |
