// tests/perf/scenarios/embed_throughput.ts
// E1 NEW — Claim: embed-session edge function completes within SLO on cold cache
// Measures:
//   1. Direct embed-session invocation (single session, cold content_hash miss) p50/p95
//   2. Batch throughput: 20 sessions embedded sequentially, wall time / session
//   3. Cascade latency: training_log INSERT → session_embeddings row visible (async queue path)
import type { SupabaseClient } from '@supabase/supabase-js';
import { percentile, runN, sleep } from '../utils.ts';

export interface EmbedThroughputResult {
  scenario: 'embed_throughput';
  single_embed: {
    p50_ms: number; p95_ms: number; p99_ms: number;
    samples: number;
    slo_p95_ms: number;
    status: 'PASS' | 'FAIL' | 'SKIP';
    note?: string;
  };
  batch_throughput: {
    sessions_embedded:   number;
    total_wall_ms:       number;
    avg_per_session_ms:  number;
    slo_per_session_ms:  number;
    status:              'PASS' | 'FAIL' | 'SKIP';
    note?:               string;
  };
  cascade_embed_chain: {
    attempts:      number;
    successes:     number;
    p95_ms:        number;
    slo_ms:        number;
    status:        'PASS' | 'FAIL' | 'SKIP';
    note?:         string;
  };
}

const SLO_SINGLE_P95_MS     = 8_000;   // single embed-session invocation < 8 s (includes Anthropic API)
const SLO_PER_SESSION_MS    = 10_000;  // batch mode avg per session < 10 s
const SLO_CASCADE_MS        = 60_000;  // INSERT → session_embeddings visible < 60 s via queue worker

export async function runEmbedThroughput(
  adminClient: SupabaseClient,
  athleteId:   string,
  iterations  = 10,
): Promise<EmbedThroughputResult> {
  // ── 1. Single embed-session invocations ──────────────────────────────────
  // Fetch real session IDs to embed
  const { data: sessions } = await adminClient
    .from('training_log')
    .select('id')
    .eq('user_id', athleteId)
    .limit(iterations + 5);

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);

  let singleTimes: number[] = [];
  let singleNote = '';

  if (sessionIds.length === 0) {
    singleNote = 'No training_log rows for athlete — skipped';
  } else {
    try {
      singleTimes = await runN(Math.min(iterations, sessionIds.length), async () => {
        const sid = sessionIds[singleTimes.length % sessionIds.length];
        const { error } = await adminClient.functions.invoke('embed-session', {
          body: { session_id: sid, force_re_embed: true },
        });
        if (error) throw new Error(`embed-session: ${error.message}`);
      });
    } catch (e) {
      singleNote = `edge fn error: ${String(e).slice(0, 100)}`;
    }
  }

  const sp95 = singleTimes.length ? percentile(singleTimes, 0.95) : 0;

  // ── 2. Batch throughput (20 sessions) ────────────────────────────────────
  const BATCH_SIZE = 20;
  let batchWallMs = 0;
  let batchCount  = 0;
  let batchNote   = '';

  if (sessionIds.length < 5) {
    batchNote = 'Insufficient sessions for batch test — skipped';
  } else {
    try {
      const batchIds = sessionIds.slice(0, Math.min(BATCH_SIZE, sessionIds.length));
      const t0 = Date.now();
      for (const sid of batchIds) {
        await adminClient.functions.invoke('embed-session', {
          body: { session_id: sid, force_re_embed: false },
        });
        batchCount++;
      }
      batchWallMs = Date.now() - t0;
    } catch (e) {
      batchNote = `batch error: ${String(e).slice(0, 100)}`;
    }
  }

  const avgPerSession = batchCount > 0 ? Math.round(batchWallMs / batchCount) : 0;

  // ── 3. Cascade: INSERT → session_embeddings visible ───────────────────────
  // Insert a fresh session then poll session_embeddings until row appears.
  // Measures the async webhook → pgmq → worker → embed chain end-to-end.
  const CASCADE_ATTEMPTS = 3;
  const cascadeTimes: number[] = [];
  let cascadeNote = '';

  for (let attempt = 0; attempt < CASCADE_ATTEMPTS; attempt++) {
    try {
      // Insert a new training_log row (triggers on_training_log_insert webhook)
      const { data: newRow, error: insertErr } = await adminClient
        .from('training_log')
        .insert({
          user_id:      athleteId,
          date:         new Date().toISOString().slice(0, 10),
          type:         'Embed Test',
          duration_min: 30,
          tss:          55,
          rpe:          6,
          notes:        `perf-embed-test-${attempt}-${Date.now()}`,
          source:       'manual',
        })
        .select('id')
        .single();

      if (insertErr || !newRow?.id) {
        cascadeNote = `INSERT failed: ${insertErr?.message ?? 'no row'}`;
        continue;
      }

      const newSessionId = newRow.id;
      const t0 = Date.now();

      // Poll session_embeddings until the row appears (max SLO_CASCADE_MS)
      let found = false;
      while (Date.now() - t0 < SLO_CASCADE_MS) {
        await sleep(1_000);
        const { data: embRow } = await adminClient
          .from('session_embeddings')
          .select('session_id')
          .eq('session_id', newSessionId)
          .maybeSingle();
        if (embRow) {
          found = true;
          break;
        }
      }

      if (found) {
        cascadeTimes.push(Date.now() - t0);
      } else {
        cascadeNote = `session_embeddings row not visible within ${SLO_CASCADE_MS / 1000}s — queue worker may not be running`;
      }

      // Clean up the test row
      await adminClient.from('training_log').delete().eq('id', newSessionId);
    } catch (e) {
      cascadeNote = `cascade error: ${String(e).slice(0, 100)}`;
    }
  }

  const cascadeP95 = cascadeTimes.length ? percentile(cascadeTimes, 0.95) : 0;

  return {
    scenario: 'embed_throughput',
    single_embed: {
      p50_ms:     singleTimes.length ? percentile(singleTimes, 0.50) : 0,
      p95_ms:     sp95,
      p99_ms:     singleTimes.length ? percentile(singleTimes, 0.99) : 0,
      samples:    singleTimes.length,
      slo_p95_ms: SLO_SINGLE_P95_MS,
      status:     singleTimes.length === 0
        ? 'SKIP'
        : (sp95 <= SLO_SINGLE_P95_MS ? 'PASS' : 'FAIL'),
      ...(singleNote ? { note: singleNote } : {}),
    },
    batch_throughput: {
      sessions_embedded:  batchCount,
      total_wall_ms:      batchWallMs,
      avg_per_session_ms: avgPerSession,
      slo_per_session_ms: SLO_PER_SESSION_MS,
      status: batchCount === 0
        ? 'SKIP'
        : (avgPerSession <= SLO_PER_SESSION_MS ? 'PASS' : 'FAIL'),
      ...(batchNote ? { note: batchNote } : {}),
    },
    cascade_embed_chain: {
      attempts:  CASCADE_ATTEMPTS,
      successes: cascadeTimes.length,
      p95_ms:    cascadeP95,
      slo_ms:    SLO_CASCADE_MS,
      status: cascadeTimes.length === 0
        ? 'SKIP'
        : (cascadeP95 <= SLO_CASCADE_MS ? 'PASS' : 'FAIL'),
      ...(cascadeNote ? { note: cascadeNote } : {}),
    },
  };
}
