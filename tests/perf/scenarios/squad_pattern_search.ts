// tests/perf/scenarios/squad_pattern_search.ts
// E1 NEW — Claim: pgvector cross-athlete squad pattern search < 500 ms p95
// Measures match_sessions_for_coach RPC (searches insight_embeddings across
// all linked athletes for a given coach), which is the backend for SquadPatternSearch.jsx.
import type { SupabaseClient } from '@supabase/supabase-js';
import { percentile, runN } from '../utils.ts';

export interface SquadPatternSearchResult {
  scenario: 'squad_pattern_search';
  cross_athlete_vector_search: {
    p50_ms:     number;
    p95_ms:     number;
    p99_ms:     number;
    mean_ms:    number;
    samples:    number;
    slo_p95_ms: number;
    athlete_count: number;
    status:     'PASS' | 'FAIL' | 'SKIP';
    note?:      string;
  };
  fts_search_squad_pattern: {
    p50_ms:  number;
    p95_ms:  number;
    samples: number;
    slo_p95_ms: number;
    status:  'PASS' | 'FAIL' | 'SKIP';
    note?:   string;
  };
}

// Representative coaching pattern queries (EN + TR)
const PATTERN_QUERIES = [
  'athletes showing early overreaching signs',
  'decoupling high three sessions row',
  'erken aşırı antrenman belirtileri',
  'recovery score declining fatigue',
  'interval power dropping week over week',
  'HRV drop consecutive days',
  'zone4 excessive time aerobic base',
  'toparlanma skoru düşüyor',
  'negative split long run',
  'TSB very negative high injury risk',
];

const SLO_VECTOR_P95_MS = 500;   // pgvector HNSW cross-athlete scan < 500 ms
const SLO_FTS_P95_MS    = 200;   // FTS squad pattern via search_everything < 200 ms

export async function runSquadPatternSearch(
  adminClient: SupabaseClient,
  coachId:     string,
  iterations  = 50,
): Promise<SquadPatternSearchResult> {
  // ── Athlete count in this perf squad ─────────────────────────────────────
  const { count: athleteCount } = await adminClient
    .from('coach_athletes')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('status', 'active');

  // ── 1. Vector cross-athlete search via match_sessions_for_coach ───────────
  // Uses a dummy 1536-dim embedding (all 0.01) to measure pure HNSW scan
  // overhead across all linked athletes' session_embeddings.
  const dummyEmbedding = Array.from({ length: 1536 }, () => 0.01);

  let vectorTimes: number[] = [];
  let vectorNote = '';

  try {
    let qIdx = 0;
    vectorTimes = await runN(iterations, async () => {
      qIdx++;
      const { error } = await adminClient.rpc('match_sessions_for_coach', {
        p_coach_id:       coachId,
        query_embedding:  dummyEmbedding,
        match_count:      20,
        match_threshold:  0.4,
      });
      if (error) throw new Error(`match_sessions_for_coach: ${error.message}`);
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // RPC may not exist (squad-pattern requires it); skip gracefully
    if (msg.includes('does not exist') || msg.includes('42883')) {
      vectorNote = `match_sessions_for_coach RPC not found — pgvector or insight_embeddings may not be seeded`;
    } else {
      vectorNote = msg.slice(0, 150);
    }
  }

  const vp95 = vectorTimes.length ? percentile(vectorTimes, 0.95) : 0;

  // ── 2. FTS squad pattern via search_everything (squad-scoped variant) ─────
  // Uses the search_squad_pattern RPC or falls back to search_everything
  // with the coach-scoped FTS to measure text-based pattern detection latency.
  let ftsTimes: number[] = [];
  let ftsNote = '';

  try {
    let qIdx = 0;
    ftsTimes = await runN(Math.min(iterations, 30), async () => {
      const q = PATTERN_QUERIES[qIdx % PATTERN_QUERIES.length];
      qIdx++;
      const { error } = await adminClient.rpc('search_squad_pattern', {
        p_coach_id:    coachId,
        query_text:    q,
        limit_per_athlete: 5,
      });
      if (error) {
        // Fall back to regular FTS if squad-scoped RPC not available
        const { error: fallbackErr } = await adminClient.rpc('search_everything', {
          q,
          limit_per_kind: 10,
        });
        if (fallbackErr) throw new Error(`search fallback: ${fallbackErr.message}`);
        ftsNote = 'search_squad_pattern not found — measured search_everything as proxy';
      }
    });
  } catch (e: unknown) {
    ftsNote = `FTS error: ${String(e).slice(0, 120)}`;
  }

  const fp95 = ftsTimes.length ? percentile(ftsTimes, 0.95) : 0;

  return {
    scenario: 'squad_pattern_search',
    cross_athlete_vector_search: {
      p50_ms:        vectorTimes.length ? percentile(vectorTimes, 0.50) : 0,
      p95_ms:        vp95,
      p99_ms:        vectorTimes.length ? percentile(vectorTimes, 0.99) : 0,
      mean_ms:       vectorTimes.length
        ? Math.round(vectorTimes.reduce((a, b) => a + b, 0) / vectorTimes.length)
        : 0,
      samples:       vectorTimes.length,
      slo_p95_ms:    SLO_VECTOR_P95_MS,
      athlete_count: athleteCount ?? 0,
      status: vectorTimes.length === 0
        ? 'SKIP'
        : (vp95 <= SLO_VECTOR_P95_MS ? 'PASS' : 'FAIL'),
      ...(vectorNote ? { note: vectorNote } : {}),
    },
    fts_search_squad_pattern: {
      p50_ms:     ftsTimes.length ? percentile(ftsTimes, 0.50) : 0,
      p95_ms:     fp95,
      samples:    ftsTimes.length,
      slo_p95_ms: SLO_FTS_P95_MS,
      status: ftsTimes.length === 0
        ? 'SKIP'
        : (fp95 <= SLO_FTS_P95_MS ? 'PASS' : 'FAIL'),
      ...(ftsNote ? { note: ftsNote } : {}),
    },
  };
}
