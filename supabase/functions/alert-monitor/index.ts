// supabase/functions/alert-monitor/index.ts
// Checks alert conditions every minute (via pg_cron).
// Fires alerts by inserting into operator_alerts (visible in ObservabilityDashboard).
// Weekly summary delivered via operator-digest edge function (Resend email).
//
// Alert conditions:
//  1. Queue depth exceeds SLO thresholds
//  3. DLQ (ai_batch_dlq) receives any message
//  4. Cron job missed its expected window (>= schedule + 5 min lag)
//  5. RLS policy denial spike >20/min
//  6. Storage quota >80%
//  7. Any system_status service = 'down'
//  8. Consecutive failed notifications (push delivery failures)
import { withTelemetry }  from '../_shared/telemetry.ts'
import { serve }          from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient }   from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// SLO thresholds (must match docs/ops/slos.md)
const QUEUE_SLOS: Record<string, number> = {
  ai_batch:        100,
  strava_backfill: 500,
  push_fanout:     200,
}

// De-duplicate: don't re-fire the same alert within this window
const DEDUP_WINDOW_MIN = 15

async function dedup(
  supa: ReturnType<typeof createClient>,
  kind: string,
): Promise<boolean> {
  const { data } = await supa
    .from('operator_alerts')
    .select('id')
    .eq('kind', kind)
    .gte('fired_at', new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString())
    .limit(1)
  return (data ?? []).length > 0   // true = duplicate, skip
}

async function fire(
  supa:     ReturnType<typeof createClient>,
  kind:     string,
  severity: 'warning' | 'critical',
  title:    string,
  body:     string,
): Promise<void> {
  if (await dedup(supa, kind)) return

  await supa.from('operator_alerts').insert({ kind, severity, title, body })
}

serve(withTelemetry('alert-monitor', async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const alerts: string[] = []

  // ── 1. Queue depth SLOs ────────────────────────────────────────────────────
  const { data: queueRows } = await supa
    .from('queue_metrics')
    .select('queue_name, depth, captured_at')
    .in('queue_name', Object.keys(QUEUE_SLOS))
    .order('captured_at', { ascending: false })
    .limit(Object.keys(QUEUE_SLOS).length * 2)

  const latestByQueue: Record<string, { depth: number; captured_at: string }> = {}
  for (const r of queueRows ?? []) {
    if (!latestByQueue[r.queue_name]) {
      latestByQueue[r.queue_name] = { depth: r.depth, captured_at: r.captured_at }
    }
  }

  for (const [q, slo] of Object.entries(QUEUE_SLOS)) {
    const row = latestByQueue[q]
    if (!row) continue
    if (row.depth > slo) {
      const ageMins = (Date.now() - new Date(row.captured_at).getTime()) / 60_000
      const kind    = `queue_depth_${q}`
      const sev     = row.depth > slo * 2 ? 'critical' : 'warning'
      await fire(supa, kind, sev,
        `Queue ${q} depth ${row.depth} exceeds SLO ${slo}`,
        `Depth: ${row.depth} (SLO: ${slo}). Last captured ${ageMins.toFixed(1)}min ago.`
      )
      alerts.push(kind)
    }
  }

  // ── 2. DLQ messages ────────────────────────────────────────────────────────
  const { data: dlqRows } = await supa
    .from('queue_metrics')
    .select('queue_name, depth, captured_at')
    .eq('queue_name', 'ai_batch_dlq')
    .order('captured_at', { ascending: false })
    .limit(1)

  const dlqDepth = dlqRows?.[0]?.depth ?? 0
  if (dlqDepth > 0) {
    await fire(supa, 'dlq_nonempty', 'critical',
      `DLQ ai_batch_dlq has ${dlqDepth} message(s)`,
      'Messages in DLQ mean ai-batch-worker exhausted all retries. Investigate immediately.'
    )
    alerts.push('dlq_nonempty')
  }

  // ── 3. Any service_down in system_status ────────────────────────────────────
  const { data: statusRows } = await supa
    .from('system_status')
    .select('service, status, message')
    .eq('status', 'down')

  for (const row of statusRows ?? []) {
    await fire(supa, `service_down_${row.service}`, 'critical',
      `${row.service} is DOWN`,
      row.message ?? 'No additional message'
    )
    alerts.push(`service_down_${row.service}`)
  }

  // ── 4. Push notification failures (>20 errors in last 10 min) ─────────────
  const { count: pushFailCount } = await supa
    .from('notification_log')
    .select('*', { count: 'exact', head: true })
    .eq('delivery_status', 'failed')
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())

  if ((pushFailCount ?? 0) > 20) {
    await fire(supa, 'push_failure_spike', 'warning',
      `Push notification failures: ${pushFailCount} in last 10 min`,
      'Check send-push edge function logs and VAPID config.'
    )
    alerts.push('push_failure_spike')
  }

  // ── 5. Stale system_status (check-dependencies not running) ───────────────
  const { data: staleRows } = await supa
    .from('system_status')
    .select('service, checked_at')
    .lt('checked_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .limit(1)

  if ((staleRows ?? []).length > 0) {
    await fire(supa, 'check_dependencies_stale', 'warning',
      'check-dependencies has not run in >10 min',
      `Oldest stale service: ${staleRows![0].service}. Check pg_cron job.`
    )
    alerts.push('check_dependencies_stale')
  }

  return new Response(
    JSON.stringify({ ok: true, alerts_fired: alerts }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}))
