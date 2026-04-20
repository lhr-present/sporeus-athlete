# RLS Testing Guide

How to add, run, and debug RLS assertions for the Sporeus Supabase backend.

## Architecture

Three layers, each with a distinct purpose:

```
supabase/tests/rls/
├── harness.ts          # Deno — 210+ assertions via REST (SUPABASE_URL + anon/service keys)
├── sql_smoke_runner.py # Python — 7 CLI-based SQL isolation checks
├── sql_smoke_seed.sql  # seeds deterministic test data (dddddddd- UUIDs) before smoke
└── sql_smoke_cleanup.sql # cleans up seeded data; always() runs in CI
```

**CI entry point:** `.github/workflows/rls-harness.yml` — two jobs:
- `rls-harness`: runs `harness.ts` via Deno against live project
- `rls-sql-smoke`: seeds → runs Python runner → always cleans up

---

## Layer 1 — Deno harness (`harness.ts`)

**When to use:** Adding a new table or policy and you want assertion coverage at the application layer (same credentials the app uses).

**How it works:** Makes authenticated REST calls to `${SUPABASE_URL}/rest/v1/{table}` using the anon key plus a `Authorization: Bearer {jwt}` header that impersonates different user IDs. Service role key used for setup/teardown.

**How to add a new suite:**

1. Find the `SUITES` array in `harness.ts`
2. Add a new suite object:
```ts
{
  name: "S33: my_new_table isolation",
  setup: async () => { /* insert test rows via service role */ },
  teardown: async () => { /* delete test rows via service role */ },
  assertions: [
    { desc: "owner reads own row", uid: OWNER_UID, table: "my_new_table", filter: `id=eq.${ROW_ID}`, expect: 1 },
    { desc: "unlinked user blocked", uid: OTHER_UID, table: "my_new_table", filter: `id=eq.${ROW_ID}`, expect: 0 },
  ],
}
```
3. Raise the `MIN_ASSERTIONS` threshold at the bottom of the file to match the new count
4. Run locally: `deno run --allow-net --allow-env supabase/tests/rls/harness.ts`

**Suites added in debt session:**
- S31 — `session_comments` (6 assertions: read by owner/coach/unlinked, INSERT block, spoof block)
- S32 — `session_views` (5 assertions: CoachPresenceBadge visibility, athlete isolation, unlinked block, presence spoof)

---

## Layer 2 — Python SQL smoke (`sql_smoke_runner.py`)

**When to use:** Verifying `SET ROLE authenticated; SET request.jwt.claims=...` behavior at the SQL level — specifically INSERT blocks (42501), or when you want to test policy logic that the REST layer doesn't expose directly.

**Why Python + CLI instead of pgTAP:**
- pgTAP's `throws_ok()` uses SAVEPOINTs internally; the Supabase Management API doesn't support them (returns error)
- `\set` metacommands don't work over the Management API
- `npx supabase db query --linked` routes through the CLI correctly and returns JSON

**How it works:** Each scenario calls either:
- `count_as(uid, sql_fragment)` — wraps with `SET ROLE authenticated; SET request.jwt.claims=...` and counts rows
- `insert_blocked(uid, insert_sql)` — checks if CLI stderr/stdout contains `42501` or `violates row-level security`

**How to add a new scenario:**

Add to the `SCENARIOS` list in `sql_smoke_runner.py`:
```python
{
    "id": "8",
    "name": "description of what is being checked (expect N or True)",
    "fn":   lambda: count_as(UID, f"FROM public.my_table WHERE id='{ROW_ID}'"),
    "expect": 1,  # or 0, or True for insert_blocked
},
```

Add corresponding rows to `sql_smoke_seed.sql` (INSERT with deterministic UUID) and `sql_smoke_cleanup.sql` (DELETE by same UUID).

**Run locally:**
```bash
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
python3 supabase/tests/rls/sql_smoke_runner.py
```

---

## Test data conventions

All CI test data uses `dddddddd-0000-4000-8000-00000000000N` UUIDs (coach=1, athlete=2, unlinked=3) and `eeeeeeee-0000-4000-8000-000000000001` for session/training_log rows. This prefix makes grepping and cleanup unambiguous.

Never use random UUIDs in seed/cleanup SQL — deterministic UUIDs are the only way to guarantee cleanup catches every row even after a partial failure.

---

## Debugging a failing assertion

**Deno harness returns wrong count:**
1. Check the policy name in `supabase/migrations/` — policies are named `{table}: {read/insert/update/delete} {scope}`
2. Connect directly: `SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) npx supabase db query --linked "SELECT * FROM pg_policies WHERE tablename='my_table'"`
3. Simulate the JWT: `SET ROLE authenticated; SET request.jwt.claims='{"sub":"<uid>"}'; SELECT * FROM my_table WHERE ...`

**SQL smoke runner returns -1:**
- The CLI call failed. Run manually: `npx supabase db query --linked "SET ROLE authenticated; SET request.jwt.claims='{\"sub\":\"<uid>\"}'; SELECT count(*)::int AS n FROM ..."`
- Check SUPABASE_ACCESS_TOKEN is set and project is linked (`npx supabase status`)

**INSERT not blocked (expect True, got False):**
- The INSERT probably succeeded — check if the INSERT policy is missing or too permissive
- Check: `SELECT * FROM pg_policies WHERE tablename='...' AND cmd='INSERT'`

**Session_views RLS gotcha (fixed in 20260461):**
The original `sv: read own or linked` policy third branch checked `ca.coach_id = tl.user_id` — this never fires since sessions are athlete-owned, not coach-owned. The correct fourth branch is `ca.coach_id = session_views.user_id AND ca.athlete_id = tl.user_id`. If you add new policies involving join chains across `coach_athletes`, verify which side (coach_id or athlete_id) maps to each foreign key.
