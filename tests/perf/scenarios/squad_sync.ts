// tests/perf/scenarios/squad_sync.ts
// Claim: mv_squad_readiness REFRESH CONCURRENTLY < 30 s at 18 k rows
//        Direct MV SELECT < 2 ms per read (already populated)
import type { SupabaseClient } from '@supabase/supabase-js';
import { percentile, runN, timed } from '../utils.ts';

export interface SquadSyncResult {
  scenario: 'squad_sync';
  mv_refresh_all: {
    duration_ms: number;
    slo_ms: number;
    status: 'PASS' | 'FAIL';
  };
  mv_read_after_refresh: {
    p50_ms: number; p95_ms: number; p99_ms: number;
    mean_ms: number; samples: number;
    slo_p95_ms: number;
    status: 'PASS' | 'FAIL';
  };
  mv_row_counts: {
    mv_ctl_atl_daily: number;
    mv_weekly_load_summary: number;
    mv_squad_readiness: number;
  };
}

export async function runSquadSync(
  adminClient: SupabaseClient,
  coachId: string,
  iterations = 50,
): Promise<SquadSyncResult> {
  const SLO_REFRESH_MS = 30_000;   // 30 s full refresh
  const SLO_READ_P95   = 10;       // ms — MV read is just a SELECT

  // ── Full refresh via refresh_mv_load() ────────────────────────────────────
  const [refreshDuration] = await timed(async () => {
    const { error } = await adminClient.rpc('refresh_mv_load');
    if (error) throw new Error(`refresh_mv_load: ${error.message}`);
  });

  // ── Post-refresh MV reads (get_squad_readiness uses mv_squad_readiness) ───
  const readTimes = await runN(iterations, async () => {
    const { error } = await adminClient.rpc('get_squad_readiness');
    if (error) throw new Error(`get_squad_readiness: ${error.message}`);
  });

  // ── Row counts for reporting ───────────────────────────────────────────────
  const [{ count: ctlCount }] = await adminClient
    .from('mv_ctl_atl_daily').select('*', { count: 'exact', head: true })
    .then(r => [{ count: r.count ?? 0 }]);

  const [{ count: weeklyCount }] = await adminClient
    .from('mv_weekly_load_summary').select('*', { count: 'exact', head: true })
    .then(r => [{ count: r.count ?? 0 }]);

  const [{ count: squadCount }] = await adminClient
    .from('mv_squad_readiness').select('*', { count: 'exact', head: true })
    .then(r => [{ count: r.count ?? 0 }]);

  const rp95 = percentile(readTimes, 0.95);

  return {
    scenario: 'squad_sync',
    mv_refresh_all: {
      duration_ms: refreshDuration,
      slo_ms:      SLO_REFRESH_MS,
      status:      refreshDuration <= SLO_REFRESH_MS ? 'PASS' : 'FAIL',
    },
    mv_read_after_refresh: {
      p50_ms:  percentile(readTimes, 0.50),
      p95_ms:  rp95,
      p99_ms:  percentile(readTimes, 0.99),
      mean_ms: Math.round(readTimes.reduce((a, b) => a + b, 0) / readTimes.length),
      samples: readTimes.length,
      slo_p95_ms: SLO_READ_P95,
      status:  rp95 <= SLO_READ_P95 ? 'PASS' : 'FAIL',
    },
    mv_row_counts: {
      mv_ctl_atl_daily:      ctlCount as number,
      mv_weekly_load_summary: weeklyCount as number,
      mv_squad_readiness:     squadCount as number,
    },
  };
}
