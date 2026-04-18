// supabase/functions/operator-digest/index.ts
// Weekly operator digest — Monday 08:00 Istanbul (05:00 UTC) via pg_cron.
// Compiles: MAU/DAU, signups, tier conversions, top errors, queue health,
//           perf deltas, storage estimate, alert count.
// Delivery: Resend API email (if RESEND_API_KEY set) + stored in operator_alerts table.
import { withTelemetry } from '../_shared/telemetry.ts'
import { serve }         from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPERATOR_EMAIL = 'huseyinakbulut71@gmail.com'

function fmt(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString()
}

serve(withTelemetry('operator-digest', async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const now     = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const today   = now.toISOString().slice(0, 10)

  // ── MAU/DAU ────────────────────────────────────────────────────────────────
  const { count: mau } = await supa
    .from('training_log')
    .select('*', { count: 'exact', head: true })
    .gte('date', new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10))

  const { count: dau } = await supa
    .from('training_log')
    .select('*', { count: 'exact', head: true })
    .eq('date', today)

  // ── New signups (last 7 days) ──────────────────────────────────────────────
  // Proxy: profiles rows created in last 7 days
  const { count: newSignups } = await supa
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo)

  // ── Tier breakdown ─────────────────────────────────────────────────────────
  const { data: tierRows } = await supa
    .from('profiles')
    .select('subscription_tier')
    .in('subscription_tier', ['free', 'coach', 'club'])

  const tierCounts: Record<string, number> = { free: 0, coach: 0, club: 0 }
  for (const r of tierRows ?? []) {
    tierCounts[r.subscription_tier] = (tierCounts[r.subscription_tier] ?? 0) + 1
  }

  // ── Queue health ───────────────────────────────────────────────────────────
  const { data: queueRows } = await supa
    .from('queue_metrics')
    .select('queue_name, depth, oldest_age_s, captured_at')
    .in('queue_name', ['ai_batch', 'strava_backfill', 'push_fanout', 'ai_batch_dlq'])
    .order('captured_at', { ascending: false })
    .limit(8)

  const latestQ: Record<string, { depth: number; oldest_age_s: number }> = {}
  for (const r of queueRows ?? []) {
    if (!latestQ[r.queue_name]) latestQ[r.queue_name] = r
  }

  // ── Top client errors (last 24h) ───────────────────────────────────────────
  const { data: errorRows } = await supa.rpc('get_recent_client_errors', { p_limit: 5 })

  // ── Alert count (last 7 days) ──────────────────────────────────────────────
  const { count: alertCount } = await supa
    .from('operator_alerts')
    .select('*', { count: 'exact', head: true })
    .gte('fired_at', weekAgo)

  const { count: criticalAlerts } = await supa
    .from('operator_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('severity', 'critical')
    .gte('fired_at', weekAgo)

  // ── System status ──────────────────────────────────────────────────────────
  const { data: statusRows } = await supa.from('system_status').select('*')

  // ── Compose digest ─────────────────────────────────────────────────────────
  const weekStr = `${new Date(weekAgo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`

  const queueSection = Object.entries(latestQ)
    .map(([q, r]) => `  ${q.padEnd(20)} depth=${r.depth}  oldest=${r.oldest_age_s}s`)
    .join('\n') || '  (no data)'

  const errorSection = (errorRows ?? [])
    .map((r: { category: string; action: string; count: number }) =>
      `  [${r.count}×] ${r.category}/${r.action}`)
    .join('\n') || '  No errors'

  const statusSection = (statusRows ?? [])
    .map((r: { service: string; status: string; latency_ms: number }) =>
      `  ${r.service.padEnd(16)} ${r.status.toUpperCase()}${r.status === 'ok' ? ` (${r.latency_ms}ms)` : ''}`)
    .join('\n')

  const htmlBody = `
<h2>Sporeus Weekly Digest — ${weekStr}</h2>

<h3>Usage</h3>
<table>
  <tr><td>MAU (active, 30d)</td><td><b>${fmt(mau)}</b></td></tr>
  <tr><td>DAU (today)</td><td><b>${fmt(dau)}</b></td></tr>
  <tr><td>New signups (7d)</td><td><b>${fmt(newSignups)}</b></td></tr>
</table>

<h3>Tiers</h3>
<table>
  <tr><td>Free</td><td>${fmt(tierCounts.free)}</td></tr>
  <tr><td>Coach</td><td>${fmt(tierCounts.coach)}</td></tr>
  <tr><td>Club</td><td>${fmt(tierCounts.club)}</td></tr>
</table>

<h3>Queue Health</h3>
<pre>${queueSection}</pre>

<h3>System Status</h3>
<pre>${statusSection}</pre>

<h3>Top Errors (last 24h)</h3>
<pre>${errorSection}</pre>

<h3>Alerts (last 7d)</h3>
<p>Total: ${fmt(alertCount)} | Critical: ${fmt(criticalAlerts)}</p>

<hr>
<small>Sporeus v8.0.5 — operator-digest — ${now.toISOString()}</small>
`

  const textBody = `
SPOREUS WEEKLY DIGEST — ${weekStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USAGE
  MAU (30d):   ${fmt(mau)}
  DAU (today): ${fmt(dau)}
  New signups: ${fmt(newSignups)}

TIERS  Free=${fmt(tierCounts.free)}  Coach=${fmt(tierCounts.coach)}  Club=${fmt(tierCounts.club)}

QUEUE HEALTH
${queueSection}

SYSTEM STATUS
${statusSection}

TOP ERRORS (24h)
${errorSection}

ALERTS (7d)  Total=${fmt(alertCount)}  Critical=${fmt(criticalAlerts)}
`

  // Persist to operator_alerts (always)
  await supa.from('operator_alerts').insert({
    kind:     'weekly_digest',
    severity: 'warning',
    title:    `Weekly digest ${weekStr}`,
    body:     textBody.slice(0, 4000),
    notified: false,
  })

  // Send email via Resend (if configured)
  const resendKey = Deno.env.get('RESEND_API_KEY')
  let emailSent   = false

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'sporeus@noreply.sporeus.com',
        to:      [OPERATOR_EMAIL],
        subject: `Sporeus Weekly Digest — ${weekStr}`,
        html:    htmlBody,
        text:    textBody,
      }),
    }).catch(() => null)

    if (res?.ok) {
      emailSent = true
      await supa.from('operator_alerts')
        .update({ notified: true })
        .eq('kind', 'weekly_digest')
        .order('fired_at', { ascending: false })
        .limit(1)
    }
  }

  return new Response(
    JSON.stringify({ ok: true, email_sent: emailSent, week: weekStr }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}))
