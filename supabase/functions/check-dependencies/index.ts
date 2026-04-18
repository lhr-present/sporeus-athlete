// supabase/functions/check-dependencies/index.ts
// Pings external dependencies every 5 min (via pg_cron) and updates system_status.
// Requires no user auth — called with service_role key by pg_cron.
import { withTelemetry } from '../_shared/telemetry.ts'
import { serve }         from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckResult {
  service:    string
  status:     'ok' | 'degraded' | 'down' | 'unknown'
  message:    string
  latency_ms: number
}

// Probe an endpoint: HEAD request with 5s timeout.
// Returns { ok, latency_ms, statusCode }.
async function probe(
  url:        string,
  timeoutMs:  number = 5_000,
): Promise<{ ok: boolean; latency_ms: number; statusCode: number }> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const t0    = Date.now()

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    return { ok: res.ok || res.status < 500, latency_ms: Date.now() - t0, statusCode: res.status }
  } catch (err: unknown) {
    clearTimeout(timer)
    const latency_ms = Date.now() - t0
    const isTimeout  = (err as Error)?.name === 'AbortError'
    return { ok: false, latency_ms, statusCode: isTimeout ? 408 : 503 }
  }
}

async function checkSupabaseApi(supabaseUrl: string, anonKey: string): Promise<CheckResult> {
  const { ok, latency_ms, statusCode } = await probe(`${supabaseUrl}/rest/v1/`, 5_000)
  return {
    service:    'supabase_api',
    status:     ok ? 'ok' : latency_ms > 3000 ? 'degraded' : 'down',
    message:    ok ? `HTTP ${statusCode} in ${latency_ms}ms` : `HTTP ${statusCode}`,
    latency_ms,
  }
}

async function checkStravaApi(): Promise<CheckResult> {
  // Strava's public-facing health indicator URL
  const { ok, latency_ms, statusCode } = await probe('https://status.strava.com/', 6_000)
  return {
    service:    'strava_api',
    status:     ok ? 'ok' : 'degraded',
    message:    ok ? `Reachable in ${latency_ms}ms` : `HTTP ${statusCode}`,
    latency_ms,
  }
}

async function checkAnthropicApi(): Promise<CheckResult> {
  // Anthropic's status page
  const { ok, latency_ms, statusCode } = await probe('https://anthropicstatus.com/', 6_000)
  return {
    service:    'anthropic_api',
    status:     ok ? 'ok' : 'degraded',
    message:    ok ? `Reachable in ${latency_ms}ms` : `HTTP ${statusCode}`,
    latency_ms,
  }
}

async function checkDodoPayments(): Promise<CheckResult> {
  const { ok, latency_ms, statusCode } = await probe('https://dodopayments.com/', 6_000)
  return {
    service:    'dodo_payments',
    status:     ok ? 'ok' : 'degraded',
    message:    ok ? `Reachable in ${latency_ms}ms` : `HTTP ${statusCode}`,
    latency_ms,
  }
}

async function checkStripe(): Promise<CheckResult> {
  // Stripe's public status endpoint
  const { ok, latency_ms, statusCode } = await probe('https://status.stripe.com/', 6_000)
  return {
    service:    'stripe',
    status:     ok ? 'ok' : 'degraded',
    message:    ok ? `Reachable in ${latency_ms}ms` : `HTTP ${statusCode}`,
    latency_ms,
  }
}

serve(withTelemetry('check-dependencies', async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  const supa = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Run all checks in parallel (with individual timeouts)
  const results = await Promise.allSettled([
    checkSupabaseApi(supabaseUrl, anonKey),
    checkStravaApi(),
    checkAnthropicApi(),
    checkDodoPayments(),
    checkStripe(),
  ])

  const checks: CheckResult[] = results.map((r, i) => {
    const services = ['supabase_api', 'strava_api', 'anthropic_api', 'dodo_payments', 'stripe']
    if (r.status === 'fulfilled') return r.value
    return { service: services[i], status: 'unknown', message: String(r.reason), latency_ms: 0 }
  })

  // Upsert all results
  const { error } = await supa.from('system_status').upsert(
    checks.map(c => ({
      service:    c.service,
      status:     c.status,
      message:    c.message,
      latency_ms: c.latency_ms,
      checked_at: new Date().toISOString(),
    })),
    { onConflict: 'service' },
  )

  if (error) console.error('system_status upsert failed:', error.message)

  // Fire alert for any 'down' service
  const downServices = checks.filter(c => c.status === 'down')
  for (const svc of downServices) {
    await supa.from('operator_alerts').insert({
      kind:     'service_down',
      severity: 'critical',
      title:    `${svc.service} is DOWN`,
      body:     svc.message,
    })
  }

  return new Response(
    JSON.stringify({ ok: true, checks }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}))
