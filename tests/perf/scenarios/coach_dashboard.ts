// tests/perf/scenarios/coach_dashboard.ts
// Claim: get_squad_overview() p95 < 500 ms for a 10-athlete squad
//        get_squad_readiness() (MV read) p95 < 5 ms
import type { SupabaseClient } from '@supabase/supabase-js';
import { percentile, runN } from '../utils.ts';

export interface CoachDashboardResult {
  scenario: 'coach_dashboard';
  slo_p95_ms: number;
  get_squad_overview: {
    p50_ms: number; p95_ms: number; p99_ms: number;
    mean_ms: number; min_ms: number; max_ms: number;
    samples: number; status: 'PASS' | 'FAIL';
  };
  get_squad_readiness_mv: {
    p50_ms: number; p95_ms: number; p99_ms: number;
    mean_ms: number; min_ms: number; max_ms: number;
    samples: number; status: 'PASS' | 'FAIL';
    slo_p95_ms: number;
  };
}

export async function runCoachDashboard(
  adminClient: SupabaseClient,
  coachId: string,
  iterations = 100,
): Promise<CoachDashboardResult> {
  // ── get_squad_overview (SECURITY DEFINER — runs as coach) ──────────────────
  const overviewTimes = await runN(iterations, async () => {
    const { error } = await adminClient.rpc('get_squad_overview', {
      p_coach_id: coachId,
    });
    if (error) throw new Error(`get_squad_overview: ${error.message}`);
  });

  // ── get_squad_readiness (reads mv_squad_readiness MV — must be < 5 ms) ─────
  // Simulate reading directly from the MV as the coach user would via RPC.
  const readinessTimes = await runN(iterations, async () => {
    const { error } = await adminClient.rpc('get_squad_readiness');
    if (error) throw new Error(`get_squad_readiness: ${error.message}`);
  });

  const SLO_OVERVIEW    = 500;  // ms p95 for live RPC over 10 athletes
  const SLO_READINESS   = 5;    // ms p95 for MV-backed read

  const op95 = percentile(overviewTimes, 0.95);
  const rp95 = percentile(readinessTimes, 0.95);

  return {
    scenario: 'coach_dashboard',
    slo_p95_ms: SLO_OVERVIEW,
    get_squad_overview: {
      p50_ms:  percentile(overviewTimes, 0.50),
      p95_ms:  op95,
      p99_ms:  percentile(overviewTimes, 0.99),
      mean_ms: Math.round(overviewTimes.reduce((a, b) => a + b, 0) / overviewTimes.length),
      min_ms:  Math.min(...overviewTimes),
      max_ms:  Math.max(...overviewTimes),
      samples: overviewTimes.length,
      status:  op95 <= SLO_OVERVIEW ? 'PASS' : 'FAIL',
    },
    get_squad_readiness_mv: {
      p50_ms:  percentile(readinessTimes, 0.50),
      p95_ms:  rp95,
      p99_ms:  percentile(readinessTimes, 0.99),
      mean_ms: Math.round(readinessTimes.reduce((a, b) => a + b, 0) / readinessTimes.length),
      min_ms:  Math.min(...readinessTimes),
      max_ms:  Math.max(...readinessTimes),
      samples: readinessTimes.length,
      status:  rp95 <= SLO_READINESS ? 'PASS' : 'FAIL',
      slo_p95_ms: SLO_READINESS,
    },
  };
}
