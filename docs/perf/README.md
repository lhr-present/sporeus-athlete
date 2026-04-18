# Sporeus Performance Harness — v8.0.4

End-to-end performance verification for the 9 claims shipped in P1–P8.  
Runs against a real Supabase branch with 18 k seeded training sessions.

---

## SLO Table

| # | Scenario | Claim | SLO (p95) |
|---|----------|-------|-----------|
| 1 | `coach_dashboard` | `get_squad_overview()` for 10-athlete squad | **< 500 ms** |
| 2 | `coach_dashboard` | `get_squad_readiness()` — MV-backed read | **< 5 ms** |
| 3 | `squad_sync` | `refresh_mv_load()` all 3 MVs (18 k rows) | **< 30 s** total |
| 4 | `squad_sync` | MV SELECT after refresh | **< 10 ms** |
| 5 | `upload_parse` | 10 concurrent GPX uploads end-to-end | **< 30 s** wall |
| 6 | `insight_chain` | `training_log` INSERT → `ai_insights` visible | **< 30 s** |
| 7 | `report_generation` | 5 parallel weekly PDFs | **< 20 s** p95/report |
| 8 | `search_performance` | `search_everything()` FTS on 18 k corpus | **< 100 ms** |
| 9 | `ai_proxy_token_cost` | RAG context overhead vs non-RAG | **< 2 000 tokens** |

---

## Prerequisites

### 1. Environment

```bash
# .env.e2e (git-ignored)
E2E_SUPABASE_URL=https://xxxx.supabase.co
E2E_SUPABASE_SERVICE_KEY=eyJ...    # service_role key — bypasses RLS
```

### 2. Supabase branch

The target branch must have:
- Full schema applied (`supabase db push`)
- Email confirmation disabled (Dashboard → Auth → Email)
- `activity-uploads` Storage bucket exists and is accessible

---

## Running locally

```bash
# Full run (setup → bench → teardown)
npx tsx tests/perf/harness.ts

# Keep test users for repeated bench runs
npx tsx tests/perf/harness.ts --keep

# Bench only (users already created by prior run)
npx tsx tests/perf/harness.ts --bench-only

# Single scenario
npx tsx tests/perf/harness.ts --bench-only --scenario=coach_dashboard

# Teardown only (clean up test users)
npx tsx tests/perf/harness.ts --teardown
```

### Expected output

```
── Setup: creating perf test users ──────────────────────────────
  coach created: <uuid>
  10 athletes created/verified
── Seeding 18 k training sessions (SQL) ─────────────────────────
  Seeded ~18 250 training_log rows + 3 650 recovery rows
── Refreshing materialized views ─────────────────────────────────
  MV refresh complete

[1/7] coach_dashboard …
[2/7] squad_sync …
[3/7] upload_parse …
[4/7] insight_chain …
[5/7] report_generation …
[6/7] search_performance …
[7/7] ai_proxy_token_cost …

╔══════════════════════════════════════════════════════════╗
║          Sporeus Perf Harness — Results Summary          ║
╠══════════════════════════════════════════════════════════╣
║ ✓ coach_dashboard get_squad_overview p95    310ms  SLO=500ms ║
║ ✓ coach_dashboard mv_readiness p95            4ms  SLO=5ms   ║
...
╚══════════════════════════════════════════════════════════╝

✅ All SLOs met.
```

---

## Baseline JSON

Each run writes (or overwrites) `tests/perf/baselines/<version>.json`.  
The committed baseline at `v8.0.4.json` contains **estimated values**.  
Replace with measured values after the first CI run on the perf branch.

### Updating the baseline

1. Run the harness on a fresh perf branch.
2. Copy the generated `v8.0.4.json` back into `tests/perf/baselines/`.
3. Commit as `perf: update v8.0.4 baseline — measured on perf branch`.

---

## CI

`.github/workflows/perf-regression.yml` runs:
- **Nightly** at 03:30 UTC against the `main` branch
- On any PR that has the `perf` label

The CI gate **fails** the workflow if any SLO is not met.  
It posts a PR comment with the full results table.

---

## Architecture

```
tests/perf/
├── harness.ts              Main orchestrator — setup, bench, teardown, write baseline
├── utils.ts                percentile(), timed(), runN(), sleep()
├── seed-perf-data.sql      SQL fallback seed (called by harness; uses generate_series)
├── baselines/
│   └── v8.0.4.json         Committed estimated baseline; overwritten by CI measured run
└── scenarios/
    ├── coach_dashboard.ts  get_squad_overview + get_squad_readiness_mv
    ├── squad_sync.ts       refresh_mv_load + post-refresh MV reads
    ├── upload_parse.ts     10 concurrent Storage upload + training_log insert
    ├── insight_chain.ts    INSERT training_log → poll ai_insights (async chain)
    ├── report_generation.ts 5 parallel generated_reports inserts
    ├── search_performance.ts search_everything FTS + match_sessions_for_user HNSW
    └── ai_proxy_token_cost.ts RAG context token overhead vs baseline
```

---

## Debugging

### FTS SLO missed

Check `EXPLAIN ANALYZE` on `search_everything()`:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM search_everything('threshold', 10);
```

Expected: GIN index scan on `notes_tsv`. If you see `Seq Scan`, the tsvector
column or its GIN index may be missing. Check:

```sql
SELECT tablename, indexname FROM pg_indexes
WHERE indexname LIKE 'idx_%_tsv%';
```

### MV refresh too slow

Check MV row counts and last refresh time:

```sql
SELECT * FROM get_mv_health();
```

If `mv_ctl_atl_daily` has > 50 k rows and refresh > 30 s, add:

```sql
-- Narrow the window to last 2 years only
-- (edit 20260420_materialized_views.sql — add WHERE date > CURRENT_DATE - 730)
```

### Coach dashboard p95 > 500 ms

`get_squad_overview` does a 180-day EWMA loop per athlete.  
With 10 athletes × 180 days = 1 800 iterations plus ACWR subqueries,
latency scales linearly with athlete count.

Check the execution plan:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM get_squad_overview('<coach_id>');
```

If `training_log` scans are appearing as Seq Scans, verify:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'training_log'
  AND indexname LIKE '%user_id_date%';
```

---

## Invariants (never change)

- `SLO_P95_MS` constants in each scenario file are authoritative — match the table above
- Do not lower SLOs without a signed-off architecture change
- Baseline JSON values may be updated with measured data; SLO values may not
