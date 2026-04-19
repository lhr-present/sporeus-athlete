#!/usr/bin/env -S npx tsx
// tests/perf/harness.ts — Sporeus Performance Harness v8.1.1
//
// Usage:
//   npx tsx tests/perf/harness.ts               # full run (setup → bench → teardown)
//   npx tsx tests/perf/harness.ts --setup-only  # create test users + seed data
//   npx tsx tests/perf/harness.ts --bench-only  # skip setup (users already exist)
//   npx tsx tests/perf/harness.ts --teardown    # delete test users + data
//   npx tsx tests/perf/harness.ts --scenario=coach_dashboard
//
// Env vars (loaded from .env.e2e):
//   E2E_SUPABASE_URL         Supabase project URL
//   E2E_SUPABASE_SERVICE_KEY service_role key (bypasses RLS)
//
// Output: tests/perf/baselines/v8.1.1.json
// Exit code 1 if any SLO is FAIL.
// v8.1.1 additions: embed_throughput + squad_pattern_search scenarios

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as dotenvConfig }             from 'dotenv';
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname }                      from 'path';
import { fileURLToPath }                      from 'url';
import { performance }                        from 'perf_hooks';

dotenvConfig({ path: '.env.e2e', override: false });

import { runCoachDashboard }     from './scenarios/coach_dashboard.ts';
import { runSquadSync }          from './scenarios/squad_sync.ts';
import { runUploadParse }        from './scenarios/upload_parse.ts';
import { runInsightChain }       from './scenarios/insight_chain.ts';
import { runReportGeneration }   from './scenarios/report_generation.ts';
import { runSearchPerformance }  from './scenarios/search_performance.ts';
import { runAiProxyTokenCost }   from './scenarios/ai_proxy_token_cost.ts';
import { runEmbedThroughput }    from './scenarios/embed_throughput.ts';
import { runSquadPatternSearch } from './scenarios/squad_pattern_search.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

const VERSION       = 'v8.1.1';
const __dir         = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR  = join(__dir, 'baselines');
const BASELINE_PATH = join(BASELINE_DIR, `${VERSION}.json`);

const STATE_FILE    = join(__dir, '.perf-state.json');

const PERF_COACH_EMAIL   = 'coach@perf.sporeus.dev';
const PERF_ATHLETE_PREFIX = 'athlete';
const NUM_ATHLETES        = 10;

interface PerfState {
  coachId:    string;
  athleteIds: string[];
}

// ── Supabase admin client ─────────────────────────────────────────────────────

function adminClient(): SupabaseClient {
  const url = process.env.E2E_SUPABASE_URL    ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_KEY
           ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing E2E_SUPABASE_URL or E2E_SUPABASE_SERVICE_KEY in .env.e2e');
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Setup: create 11 perf test users ─────────────────────────────────────────

async function setup(supabase: SupabaseClient): Promise<PerfState> {
  console.log('── Setup: creating perf test users ──────────────────────────────');

  // Coach
  const { data: coachData, error: coachErr } = await supabase.auth.admin.createUser({
    email:            PERF_COACH_EMAIL,
    password:         'perf-test-pw-123!',
    email_confirm:    true,
    user_metadata:    { role: 'coach', display_name: 'Perf Coach' },
  });
  if (coachErr && !coachErr.message.includes('already been registered')) {
    throw new Error(`Create coach failed: ${coachErr.message}`);
  }

  let coachId: string;
  if (coachData?.user?.id) {
    coachId = coachData.user.id;
  } else {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find(u => u.email === PERF_COACH_EMAIL);
    if (!found) throw new Error('Could not find perf coach user after create');
    coachId = found.id;
  }

  // Ensure coach profile + tier
  await supabase.from('profiles').upsert({
    id:                coachId,
    email:             PERF_COACH_EMAIL,
    display_name:      'Perf Coach',
    role:              'coach',
    subscription_tier: 'coach',
  }, { onConflict: 'id' });

  console.log(`  coach created: ${coachId}`);

  // Athletes
  const athleteIds: string[] = [];
  for (let i = 0; i < NUM_ATHLETES; i++) {
    const email = `${PERF_ATHLETE_PREFIX}${i}@perf.sporeus.dev`;
    const { data: athData, error: athErr } = await supabase.auth.admin.createUser({
      email,
      password:      'perf-test-pw-123!',
      email_confirm: true,
      user_metadata: { role: 'athlete', display_name: `Perf Athlete ${i}` },
    });

    let aid: string;
    if (athData?.user?.id) {
      aid = athData.user.id;
    } else if (athErr?.message.includes('already been registered')) {
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find(u => u.email === email);
      if (!found) throw new Error(`Could not find athlete ${email}`);
      aid = found.id;
    } else {
      throw new Error(`Create athlete ${i} failed: ${athErr?.message}`);
    }

    await supabase.from('profiles').upsert({
      id:           aid,
      email,
      display_name: `Perf Athlete ${i}`,
      role:         'athlete',
      subscription_tier: 'free',
    }, { onConflict: 'id' });

    // Link to coach
    await supabase.from('coach_athletes').upsert({
      coach_id:   coachId,
      athlete_id: aid,
      status:     'active',
    }, { onConflict: 'coach_id,athlete_id' });

    // Seed consent
    for (const ct of ['data_processing', 'health_data'] as const) {
      await supabase.from('consents').upsert({
        user_id:      aid,
        consent_type: ct,
        version:      '1.1',
        granted_at:   new Date().toISOString(),
      }, { onConflict: 'user_id,consent_type' });
    }

    athleteIds.push(aid);
  }

  console.log(`  ${NUM_ATHLETES} athletes created/verified`);

  const state: PerfState = { coachId, athleteIds };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  // Seed training sessions via SQL (generate_series approach)
  console.log('── Seeding 18 k training sessions (SQL) ─────────────────────────');
  await seedViaSql(supabase, state);

  // Trigger MV refresh now that data is loaded
  console.log('── Refreshing materialized views ─────────────────────────────────');
  const { error: mvErr } = await supabase.rpc('refresh_mv_load');
  if (mvErr) console.warn('  MV refresh error (non-fatal):', mvErr.message);
  else        console.log('  MV refresh complete');

  return state;
}

async function seedViaSql(
  supabase: SupabaseClient,
  state: PerfState,
): Promise<void> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 364);

  const sessionTypes = ['Easy', 'Threshold', 'VO2max', 'Long Run', 'Tempo', 'Intervals', 'Race', 'Rest'];
  const sources      = ['manual', 'strava', 'gpx'];
  const notes        = [
    'threshold run at LT2 power, felt strong',
    'easy recovery jog, aerobic base building',
    'VO2max intervals on track, legs heavy',
    'long ride with moderate headwind and rain',
    'tempo run at lactate threshold pace today',
    null, null, null,  // ~37 % no notes (realistic)
  ];

  let totalInserted = 0;
  const BATCH_SIZE = 500;
  const rows: object[] = [];

  for (const athleteId of state.athleteIds) {
    for (let d = 0; d <= 364; d++) {
      const date = new Date(startDate.getTime() + d * 86_400_000)
        .toISOString()
        .slice(0, 10);

      // ~5 sessions/day on average (1–8 per day)
      const sessionsPerDay = d % 7 === 0 ? 1 : (d % 7 === 6 ? 2 : (d % 3 === 0 ? 7 : 5));

      for (let s = 0; s < sessionsPerDay; s++) {
        rows.push({
          user_id:      athleteId,
          date,
          type:         sessionTypes[(d * 7 + s) % sessionTypes.length],
          duration_min: 30 + (d * 7 + s * 13) % 120,
          tss:          Math.round(10 + (d * 11 + s * 17) % 115),
          rpe:          1 + (d + s) % 9,
          notes:        notes[(d + s) % notes.length],
          source:       sources[(d + s) % sources.length],
        });

        if (rows.length >= BATCH_SIZE) {
          await supabase.from('training_log').insert(rows).then(() => undefined).catch(() => undefined);
          totalInserted += rows.length;
          rows.length = 0;
          if (totalInserted % 5000 === 0) {
            process.stdout.write(`  seeded ${totalInserted} rows…\r`);
          }
        }
      }
    }
  }

  // Flush remaining
  if (rows.length > 0) {
    await supabase.from('training_log').insert(rows).then(() => undefined).catch(() => undefined);
    totalInserted += rows.length;
  }

  // Also seed recovery rows for HRV data
  const recoveryRows: object[] = [];
  for (const athleteId of state.athleteIds) {
    for (let d = 0; d <= 364; d++) {
      const date = new Date(startDate.getTime() + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      recoveryRows.push({
        user_id:   athleteId,
        date,
        score:     50 + (d % 50),
        sleep_hrs: 6 + (d % 3),
        soreness:  1 + (d % 5),
        stress:    1 + (d % 5),
        mood:      1 + (d % 5),
        hrv:       55 + (d % 40),
      });

      if (recoveryRows.length >= BATCH_SIZE) {
        await supabase.from('recovery').insert(recoveryRows).then(() => undefined).catch(() => undefined);
        recoveryRows.length = 0;
      }
    }
  }
  if (recoveryRows.length > 0) {
    await supabase.from('recovery').insert(recoveryRows).then(() => undefined).catch(() => undefined);
  }

  console.log(`\n  Seeded ~${totalInserted} training_log rows + ${state.athleteIds.length * 365} recovery rows`);
}

// ── Teardown: delete perf test users ─────────────────────────────────────────

async function teardown(supabase: SupabaseClient): Promise<void> {
  console.log('── Teardown: deleting perf test users ────────────────────────────');

  const state = loadState();
  const ids   = state ? [state.coachId, ...state.athleteIds] : [];

  // Find all perf test users by email pattern
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const perfUsers = (data?.users ?? []).filter(u =>
    u.email?.endsWith('@perf.sporeus.dev'),
  );

  for (const u of perfUsers) {
    if (!ids.includes(u.id)) ids.push(u.id);
  }

  let deleted = 0;
  for (const id of ids) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (!error) deleted++;
    else console.warn(`  could not delete ${id}:`, error.message);
  }

  console.log(`  deleted ${deleted} users (CASCADE removes all their data)`);

  try { unlinkSync(STATE_FILE); } catch { /* already gone */ }
}

// ── State persistence ─────────────────────────────────────────────────────────

function loadState(): PerfState | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

// ── Run all scenarios ─────────────────────────────────────────────────────────

async function runBenchmarks(
  supabase:  SupabaseClient,
  state:     PerfState,
  onlyScene: string | null,
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  const t0 = performance.now();

  const run = (name: string) =>
    onlyScene === null || onlyScene === name;

  if (run('coach_dashboard')) {
    console.log('\n[1/9] coach_dashboard …');
    results.coach_dashboard = await runCoachDashboard(supabase, state.coachId);
  }

  if (run('squad_sync')) {
    console.log('[2/9] squad_sync …');
    results.squad_sync = await runSquadSync(supabase, state.coachId);
  }

  if (run('upload_parse')) {
    console.log('[3/9] upload_parse …');
    results.upload_parse = await runUploadParse(supabase, state.athleteIds[0]);
  }

  if (run('insight_chain')) {
    console.log('[4/9] insight_chain …');
    results.insight_chain = await runInsightChain(supabase, state.athleteIds[1]);
  }

  if (run('report_generation')) {
    console.log('[5/9] report_generation …');
    results.report_generation = await runReportGeneration(supabase, state.coachId);
  }

  if (run('search_performance')) {
    console.log('[6/9] search_performance …');
    results.search_performance = await runSearchPerformance(supabase);
  }

  if (run('ai_proxy_token_cost')) {
    console.log('[7/9] ai_proxy_token_cost …');
    results.ai_proxy_token_cost = await runAiProxyTokenCost(
      supabase,
      state.athleteIds[2],
    );
  }

  if (run('embed_throughput')) {
    console.log('[8/9] embed_throughput …');
    results.embed_throughput = await runEmbedThroughput(
      supabase,
      state.athleteIds[3],
    );
  }

  if (run('squad_pattern_search')) {
    console.log('[9/9] squad_pattern_search …');
    results.squad_pattern_search = await runSquadPatternSearch(
      supabase,
      state.coachId,
    );
  }

  const totalMs = Math.round(performance.now() - t0);
  console.log(`\nBenchmarks complete in ${(totalMs / 1000).toFixed(1)} s`);

  return results;
}

// ── Write baseline JSON ───────────────────────────────────────────────────────

function writeBaseline(
  results:  Record<string, unknown>,
  state:    PerfState,
): void {
  mkdirSync(BASELINE_DIR, { recursive: true });

  const baseline = {
    version:      VERSION,
    generated_at: new Date().toISOString(),
    dataset: {
      athletes:             NUM_ATHLETES,
      sessions_per_athlete: 1825,
      total_sessions_est:   NUM_ATHLETES * 1825,
    },
    results,
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`\nBaseline written → ${BASELINE_PATH}`);
}

// ── Print summary table ───────────────────────────────────────────────────────

function printSummary(results: Record<string, unknown>): boolean {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          Sporeus Perf Harness — Results Summary          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');

  const ROWS: Array<{ label: string; key: string; subkey?: string }> = [
    { label: 'coach_dashboard get_squad_overview p95',   key: 'coach_dashboard',    subkey: 'get_squad_overview' },
    { label: 'coach_dashboard mv_readiness p95',         key: 'coach_dashboard',    subkey: 'get_squad_readiness_mv' },
    { label: 'squad_sync MV refresh',                    key: 'squad_sync',         subkey: 'mv_refresh_all' },
    { label: 'squad_sync MV read p95',                   key: 'squad_sync',         subkey: 'mv_read_after_refresh' },
    { label: 'upload_parse 10× concurrent wall',         key: 'upload_parse' },
    { label: 'insight_chain p95',                        key: 'insight_chain' },
    { label: 'report_generation 5× parallel p95',        key: 'report_generation' },
    { label: 'search_performance FTS p95',               key: 'search_performance', subkey: 'fts_search_everything' },
    { label: 'ai_proxy_token_cost RAG overhead',         key: 'ai_proxy_token_cost' },
  ];

  let allPass = true;

  for (const row of ROWS) {
    const r = results[row.key] as Record<string, unknown> | undefined;
    if (!r) continue;

    const sub     = row.subkey ? (r[row.subkey] as Record<string, unknown>) : r;
    const status  = (sub?.status ?? 'SKIP') as string;
    const metric  = (
      sub?.p95_ms    ?? sub?.per_report_p95_ms ??
      sub?.duration_ms ?? sub?.total_wall_ms   ??
      sub?.rag_overhead_tokens ?? sub?.p95_ms  ?? '—'
    );
    const slo     = (
      sub?.slo_p95_ms ?? sub?.slo_ms ?? sub?.slo_total_ms ?? sub?.slo_overhead_tokens ?? '—'
    );

    if (status === 'FAIL') allPass = false;

    const icon  = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '–';
    const label = row.label.padEnd(42);
    console.log(`║ ${icon} ${label} ${String(metric).padStart(6)}ms  SLO=${slo}ms ║`);
  }

  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(allPass ? '\n✅ All SLOs met.' : '\n🚨 One or more SLOs FAILED — see details above.');

  return allPass;
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

async function main() {
  const args       = process.argv.slice(2);
  const setupOnly  = args.includes('--setup-only');
  const benchOnly  = args.includes('--bench-only');
  const doTeardown = args.includes('--teardown');
  const scenarioArg = args.find(a => a.startsWith('--scenario='));
  const onlyScene  = scenarioArg ? scenarioArg.replace('--scenario=', '') : null;

  const supabase = adminClient();

  if (doTeardown) {
    await teardown(supabase);
    process.exit(0);
  }

  let state: PerfState;

  if (benchOnly) {
    const loaded = loadState();
    if (!loaded) {
      console.error('No perf state found. Run without --bench-only first.');
      process.exit(1);
    }
    state = loaded;
  } else {
    state = await setup(supabase);
    if (setupOnly) {
      console.log('\nSetup complete. Run with --bench-only to run benchmarks.');
      process.exit(0);
    }
  }

  const results = await runBenchmarks(supabase, state, onlyScene);
  writeBaseline(results, state);
  const allPass = printSummary(results);

  // Clean up test data unless --bench-only (preserve for repeated runs)
  if (!benchOnly && !args.includes('--keep')) {
    console.log('\n── Cleanup ───────────────────────────────────────────────────────');
    await teardown(supabase);
  }

  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Harness failed:', err);
  process.exit(1);
});
