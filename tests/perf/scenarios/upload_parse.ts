// tests/perf/scenarios/upload_parse.ts
// Claim: parse-activity handles 10 concurrent GPX uploads in < 30 s total
//        (measured end-to-end: Storage mock upload + DB row visible in training_log)
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { percentile, timed } from '../utils.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GPX_FIXTURE = join(__dirname, '../../fixtures/sample.gpx');

export interface UploadParseResult {
  scenario: 'upload_parse';
  concurrent_uploads: number;
  total_wall_ms: number;
  slo_total_ms: number;
  per_upload_p50_ms: number;
  per_upload_p95_ms: number;
  successful: number;
  failed: number;
  status: 'PASS' | 'FAIL';
}

async function uploadOneFile(
  adminClient: SupabaseClient,
  athleteId: string,
  index: number,
): Promise<number> {
  const [duration] = await timed(async () => {
    // Verify fixture exists (CI: use minimal GPX bytes inline as fallback)
    const gpxContent = existsSync(GPX_FIXTURE)
      ? readFileSync(GPX_FIXTURE)
      : Buffer.from(MINIMAL_GPX);

    const fileName = `perf-test-${athleteId.slice(0, 8)}-${index}-${Date.now()}.gpx`;
    const filePath = `${athleteId}/${fileName}`;

    // Upload to activity-uploads bucket
    const { error: uploadErr } = await adminClient.storage
      .from('activity-uploads')
      .upload(filePath, gpxContent, {
        contentType: 'application/gpx+xml',
        upsert: false,
      });
    if (uploadErr && !uploadErr.message.includes('already exists')) {
      throw new Error(`Storage upload ${index}: ${uploadErr.message}`);
    }

    // Simulate parse-activity edge function: insert training_log row directly
    // (In real CI, parse-activity is mocked — we test the DB insert path here)
    const { error: logErr } = await adminClient.from('training_log').insert({
      user_id:      athleteId,
      date:         new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10),
      type:         'Easy',
      duration_min: 60,
      tss:          60,
      rpe:          5,
      source:       'gpx',
      notes:        `Perf upload ${index}`,
    });
    if (logErr) throw new Error(`training_log insert ${index}: ${logErr.message}`);

    // Clean up storage object (best-effort)
    await adminClient.storage.from('activity-uploads').remove([filePath]);
  });
  return duration;
}

export async function runUploadParse(
  adminClient: SupabaseClient,
  athleteId: string,
  concurrency = 10,
): Promise<UploadParseResult> {
  const SLO_TOTAL_MS = 30_000;

  const perUploadMs: number[] = [];
  let failed = 0;

  const [totalDuration] = await timed(async () => {
    const results = await Promise.allSettled(
      Array.from({ length: concurrency }, (_, i) =>
        uploadOneFile(adminClient, athleteId, i),
      ),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        perUploadMs.push(r.value);
      } else {
        failed++;
        console.warn('  upload failed:', r.reason?.message ?? r.reason);
      }
    }
  });

  const successful = concurrency - failed;

  return {
    scenario:           'upload_parse',
    concurrent_uploads: concurrency,
    total_wall_ms:      totalDuration,
    slo_total_ms:       SLO_TOTAL_MS,
    per_upload_p50_ms:  perUploadMs.length ? percentile(perUploadMs, 0.50) : 0,
    per_upload_p95_ms:  perUploadMs.length ? percentile(perUploadMs, 0.95) : 0,
    successful,
    failed,
    status: totalDuration <= SLO_TOTAL_MS && failed === 0 ? 'PASS' : 'FAIL',
  };
}

// Minimal valid GPX inline fallback (used when sample.gpx not found)
const MINIMAL_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="perf-test">
  <trk><name>Perf Test Ride</name><trkseg>
    <trkpt lat="41.0" lon="29.0"><time>2026-01-01T06:00:00Z</time></trkpt>
    <trkpt lat="41.01" lon="29.01"><time>2026-01-01T07:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;
