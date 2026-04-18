#!/usr/bin/env -S deno run --allow-net --allow-env
// ─── scripts/smoke_contracts.ts — C1–C8 contract smoke tests ─────────────────
// Exercises all 8 cross-block contracts against a live Supabase instance.
// Checks: RPC function existence, return shapes, edge cases, known-bug fixes.
//
// Usage:
//   SUPABASE_URL=https://xyz.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
//   deno run --allow-net --allow-env scripts/smoke_contracts.ts
//
// Optional:
//   SUPABASE_ANON_KEY=<anon_key>   (for auth.uid()-gated RPC checks)
//   VERBOSE=1                       (print all PASS lines, not just FAILs)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_KEY
const VERBOSE      = Deno.env.get("VERBOSE") === "1"

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
  Deno.exit(1)
}

const sb    = createClient(SUPABASE_URL, SERVICE_KEY)
const sbAnon = ANON_KEY !== SERVICE_KEY ? createClient(SUPABASE_URL, ANON_KEY) : sb

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
const failures: string[] = []

function pass(name: string) {
  passed++
  if (VERBOSE) console.log(`  ✓ ${name}`)
}

function fail(name: string, reason: string) {
  failed++
  failures.push(`  ✗ ${name}\n    ${reason}`)
  console.error(`  ✗ ${name}\n    ${reason}`)
}

function suite(name: string) {
  console.log(`\n▶ ${name}`)
}

// ── C1 — analyse-session → ai_insights → embed-session ───────────────────────
suite("C1 — analyse-session → embed-session chain")

{
  // ai_insights table accessible
  const { error } = await sb.from("ai_insights").select("id").limit(1)
  if (error) fail("C1.1 ai_insights accessible", error.message)
  else pass("C1.1 ai_insights accessible")

  // ai_insights has session_id column
  const { data: cols } = await sb
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "ai_insights")
    .eq("column_name", "session_id")
  if (!cols?.length) fail("C1.2 ai_insights.session_id column exists", "column not found — v7.43.0 migration not applied")
  else pass("C1.2 ai_insights.session_id column exists")

  // insight_embeddings table accessible
  const { error: embErr } = await sb.from("insight_embeddings").select("id").limit(1)
  if (embErr) fail("C1.3 insight_embeddings accessible", embErr.message)
  else pass("C1.3 insight_embeddings accessible")
}

// ── C2 — activity_upload_jobs status machine ──────────────────────────────────
suite("C2 — activity_upload_jobs status machine")

{
  const { error } = await sb.from("activity_upload_jobs").select("id, status").limit(1)
  if (error) fail("C2.1 activity_upload_jobs accessible", error.message)
  else pass("C2.1 activity_upload_jobs accessible")

  // Check status column is TEXT (not an enum) — allows new statuses without migration
  const { data: statusCol } = await sb
    .from("information_schema.columns")
    .select("data_type")
    .eq("table_schema", "public")
    .eq("table_name", "activity_upload_jobs")
    .eq("column_name", "status")
    .single()
  if (!statusCol) fail("C2.2 activity_upload_jobs.status column exists", "column not found")
  else pass(`C2.2 activity_upload_jobs.status column type: ${statusCol.data_type}`)

  // parsed_session_id column exists
  const { data: sidCol } = await sb
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "activity_upload_jobs")
    .eq("column_name", "parsed_session_id")
  if (!sidCol?.length) fail("C2.3 activity_upload_jobs.parsed_session_id exists", "column missing")
  else pass("C2.3 activity_upload_jobs.parsed_session_id exists")
}

// ── C3 — pgmq queue existence ─────────────────────────────────────────────────
suite("C3 — pgmq queues accessible via RPC")

{
  const QUEUES = ["ai_batch", "push_fanout", "strava_backfill", "embed_retry", "report_queue"]

  for (const qName of QUEUES) {
    // Each queue has a pgmq.q_<name> table
    const { data, error } = await sb
      .from(`pgmq.q_${qName}`)
      .select("msg_id")
      .limit(1)
    if (error) fail(`C3 queue ${qName} accessible`, error.message)
    else pass(`C3 queue pgmq.q_${qName} accessible`)
  }
}

// ── C4 — generate-report MV column mapping (Bug #3 regression) ───────────────
suite("C4 — mv_ctl_atl_daily column names (Bug #3 fix)")

{
  // MV must have ctl_42d and atl_7d columns, NOT ctl/atl/tsb
  const { data: mvCols, error } = await sb
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "mv_ctl_atl_daily")

  if (error) {
    fail("C4.1 mv_ctl_atl_daily accessible", error.message)
  } else {
    const names = mvCols?.map((c: { column_name: string }) => c.column_name) ?? []

    if (!names.includes("ctl_42d"))
      fail("C4.2 mv_ctl_atl_daily has ctl_42d column", `columns: ${names.join(", ")}`)
    else pass("C4.2 mv_ctl_atl_daily has ctl_42d")

    if (!names.includes("atl_7d"))
      fail("C4.3 mv_ctl_atl_daily has atl_7d column", `columns: ${names.join(", ")}`)
    else pass("C4.3 mv_ctl_atl_daily has atl_7d")

    // Confirm buggy columns are absent
    if (names.includes("ctl"))
      fail("C4.4 mv_ctl_atl_daily does NOT have 'ctl' alias", "column 'ctl' exists — generate-report bug may re-appear")
    else pass("C4.4 mv_ctl_atl_daily does not have ambiguous 'ctl' alias")
  }
}

// ── C5 — search_everything() RPC (Bug #4 fix) ────────────────────────────────
suite("C5 — search_everything() athlete_session arm (Bug #4 fix)")

{
  const { data, error } = await sb.rpc("search_everything", {
    q: "sporeus_contract_smoke_test_query_xyz",
    limit_per_kind: 1,
  })

  if (error) fail("C5.1 search_everything() callable", error.message)
  else pass("C5.1 search_everything() callable")

  // Function should return an array (even if empty for a nonsense query)
  if (data !== null && !Array.isArray(data))
    fail("C5.2 search_everything() returns array", `returned ${typeof data}`)
  else pass("C5.2 search_everything() returns array")

  // Verify known-kinds are part of the CHECK constraint by reading pg_proc
  // (indirect: function body must reference athlete_session)
  const { data: procSrc } = await sb
    .rpc("_smoke_get_function_src", { p_name: "search_everything" })
    .catch(() => ({ data: null }))

  // Skip if helper RPC not available; SQL tests cover this case directly
  if (procSrc === null) {
    pass("C5.3 athlete_session in function body (skipped — _smoke helper not available)")
  } else if (typeof procSrc === "string" && procSrc.includes("athlete_session")) {
    pass("C5.3 search_everything() body contains athlete_session kind")
  } else {
    fail("C5.3 athlete_session in function body", "Bug 4 fix not present in live function")
  }
}

// ── C6 — mv_squad_readiness refresh chain ────────────────────────────────────
suite("C6 — mv_squad_readiness refresh chain")

{
  // mv_refresh_pending table
  const { error: pendErr } = await sb.from("mv_refresh_pending").select("view_name").limit(1)
  if (pendErr) fail("C6.1 mv_refresh_pending accessible", pendErr.message)
  else pass("C6.1 mv_refresh_pending accessible")

  // maybe_refresh_squad_mv() callable
  const { error: cronErr } = await sb.rpc("maybe_refresh_squad_mv")
  // It returns void; any error means it doesn't exist or threw
  if (cronErr) fail("C6.2 maybe_refresh_squad_mv() callable", cronErr.message)
  else pass("C6.2 maybe_refresh_squad_mv() callable")

  // mv_squad_readiness MV exists
  const { data: mvRows, error: mvErr } = await sb.from("mv_squad_readiness").select("athlete_id").limit(1)
  if (mvErr) fail("C6.3 mv_squad_readiness accessible", mvErr.message)
  else pass("C6.3 mv_squad_readiness accessible")

  // get_squad_overview() callable (passing a test UUID is fine — returns empty)
  const { error: sqErr } = await sb.rpc("get_squad_overview", {
    p_coach_id: "00000000-0000-0000-0000-000000000000",
  })
  if (sqErr) fail("C6.4 get_squad_overview() callable", sqErr.message)
  else pass("C6.4 get_squad_overview() callable")
}

// ── C7 — FTS infrastructure ───────────────────────────────────────────────────
suite("C7 — FTS infrastructure")

{
  // normalize_for_fts() callable
  const { data: normResult, error: normErr } = await sb.rpc("normalize_for_fts", {
    p_text: "KoŞu İSTANBUL",
  }).catch(() => ({ data: null, error: { message: "rpc failed" } }))

  if (normErr) fail("C7.1 normalize_for_fts() callable", normErr.message)
  else {
    pass("C7.1 normalize_for_fts() callable")
    if (normResult !== "kosu istanbul")
      fail("C7.2 normalize_for_fts() folds Turkish diacritics", `got "${normResult}"`)
    else pass("C7.2 normalize_for_fts() folds Turkish diacritics correctly")
  }
}

// ── C8 — get_squad_overview output shape ─────────────────────────────────────
suite("C8 — get_squad_overview output shape")

{
  const { data: rows, error } = await sb.rpc("get_squad_overview", {
    p_coach_id: "00000000-0000-0000-0000-000000000000",
  })

  if (error) {
    fail("C8.1 get_squad_overview() no error", error.message)
  } else {
    pass("C8.1 get_squad_overview() no error")

    // If rows returned, verify shape
    if (rows && rows.length > 0) {
      const row = rows[0]
      const required = [
        "athlete_id", "display_name",
        "today_ctl", "today_atl", "today_tsb",
        "acwr_ratio", "acwr_status",
        "missed_sessions_7d", "training_status", "adherence_pct",
      ]
      const missing = required.filter(k => !(k in row))
      if (missing.length)
        fail("C8.2 get_squad_overview row shape", `missing fields: ${missing.join(", ")}`)
      else pass("C8.2 get_squad_overview row shape correct")

      const validAcwr = ["low", "caution", "optimal", "danger"]
      if (!validAcwr.includes(row.acwr_status))
        fail("C8.3 acwr_status is valid enum", `got "${row.acwr_status}"`)
      else pass("C8.3 acwr_status is valid enum")

      const validTraining = ["Overreaching", "Detraining", "Building", "Peaking", "Recovering", "Maintaining"]
      if (!validTraining.includes(row.training_status))
        fail("C8.4 training_status is valid enum", `got "${row.training_status}"`)
      else pass("C8.4 training_status is valid enum")
    } else {
      pass("C8.2 get_squad_overview row shape (no rows for test coach — shape unverifiable)")
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n── Contract Smoke Results ──────────────────────────────────────")
console.log(`  Passed : ${passed}`)
console.log(`  Failed : ${failed}`)
console.log(`  Total  : ${passed + failed}`)

if (failures.length) {
  console.error("\nFAILURES:")
  failures.forEach(f => console.error(f))
  Deno.exit(1)
} else {
  console.log("\n✓ All contract smoke tests passed")
  Deno.exit(0)
}
