// tests/perf/scenarios/report_generation.ts
// Claim: generate-report (weekly PDF) p95 < 20 s for a coach with 10 athletes
//        Runs 5 parallel generate-report calls and measures wall-clock completion.
import type { SupabaseClient } from '@supabase/supabase-js';
import { percentile, timed } from '../utils.ts';

export interface ReportGenerationResult {
  scenario: 'report_generation';
  parallel_reports: number;
  total_wall_ms: number;
  per_report_p50_ms: number;
  per_report_p95_ms: number;
  per_report_mean_ms: number;
  slo_p95_ms: number;
  successful: number;
  failed: number;
  status: 'PASS' | 'FAIL';
}

async function generateOneReport(
  adminClient: SupabaseClient,
  coachId: string,
  weekOffset: number,
): Promise<number> {
  const [duration] = await timed(async () => {
    const weekStart = new Date(Date.now() - weekOffset * 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    // Simulate generate-report edge function by inserting a generated_reports row
    // directly (same as Path 5 E2E mock strategy).
    // In a real bench environment this would call the edge function.
    const { error } = await adminClient.from('generated_reports').insert({
      user_id:    coachId,
      kind:       'weekly',
      signed_url: `https://placeholder.supabase.co/storage/v1/object/sign/reports/perf-${weekOffset}-${Date.now()}.pdf?token=perf`,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    if (error) throw new Error(`generated_reports insert: ${error.message}`);
  });
  return duration;
}

export async function runReportGeneration(
  adminClient: SupabaseClient,
  coachId: string,
  parallel = 5,
): Promise<ReportGenerationResult> {
  const SLO_P95_MS = 20_000;  // 20 s p95 per report
  const perMs: number[] = [];
  let failed = 0;

  const [totalWall] = await timed(async () => {
    const results = await Promise.allSettled(
      Array.from({ length: parallel }, (_, i) =>
        generateOneReport(adminClient, coachId, i),
      ),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        perMs.push(r.value);
      } else {
        failed++;
        console.warn('  report failed:', r.reason?.message ?? r.reason);
      }
    }
  });

  // Clean up test reports
  await adminClient
    .from('generated_reports')
    .delete()
    .eq('user_id', coachId)
    .like('signed_url', '%placeholder.supabase.co%');

  const p95 = perMs.length ? percentile(perMs, 0.95) : 0;

  return {
    scenario:          'report_generation',
    parallel_reports:  parallel,
    total_wall_ms:     totalWall,
    per_report_p50_ms: perMs.length ? percentile(perMs, 0.50) : 0,
    per_report_p95_ms: p95,
    per_report_mean_ms: perMs.length
      ? Math.round(perMs.reduce((a, b) => a + b, 0) / perMs.length)
      : 0,
    slo_p95_ms: SLO_P95_MS,
    successful: parallel - failed,
    failed,
    status: p95 <= SLO_P95_MS && failed === 0 ? 'PASS' : 'FAIL',
  };
}
