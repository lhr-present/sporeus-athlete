// ─── _shared/telemetry.ts — Structured telemetry for all edge functions ────────
// Usage:
//   import { withTelemetry } from '../_shared/telemetry.ts'
//   serve(withTelemetry('my-function', async (req) => { ... }))
//
// Every invocation emits a structured JSON event:
//   { fn, status:'ok'|'error', duration_ms, request_id, user_id_hash?, error_class?, ts }
//
// Delivery: Axiom HTTP ingest (fire-and-forget, 500ms timeout).
//   AXIOM_TOKEN  — write-only ingest token (set via supabase secrets)
//   AXIOM_DATASET — dataset name (default: 'sporeus-edge')
//
// Heartbeat: long-running workers call telemetryHeartbeat(fnName) every 60s to
//   prove liveness. Missing heartbeat > 5 min should alert in Axiom.
//
// Privacy: user_id_hash = sha256(user_id).slice(0,16) — never raw IDs or emails.

const AXIOM_INGEST  = 'https://api.axiom.co/v1/datasets'
const HEARTBEAT_MS  = 60_000

// ── emitEvent — fire-and-forget telemetry event ───────────────────────────────
async function emitEvent(event: Record<string, unknown>): Promise<void> {
  const token   = Deno.env.get('AXIOM_TOKEN')
  const dataset = Deno.env.get('AXIOM_DATASET') || 'sporeus-edge'

  if (!token) {
    // Dev/local: just log to console; no Axiom token needed
    console.log(JSON.stringify({ _telemetry: true, ...event }))
    return
  }

  const url = `${AXIOM_INGEST}/${dataset}/ingest`

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 500)  // 500ms hard timeout

    await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/x-ndjson',
      },
      body:    JSON.stringify(event) + '\n',
      signal:  ctrl.signal,
    }).catch(() => { /* swallowed — telemetry must not affect hot path */ })

    clearTimeout(timer)
  } catch {
    // Intentionally swallowed — telemetry failure must never affect fn response
  }
}

// ── hashUserId — sha256 → 16-char hex prefix, never raw IDs ──────────────────
async function hashUserId(userId: string): Promise<string> {
  try {
    const enc = new TextEncoder()
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(userId))
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
  } catch {
    return 'unknown'
  }
}

// ── extractUserId — parse user_id from JWT payload (best-effort) ──────────────
function extractUserId(req: Request): string | null {
  try {
    const auth = req.headers.get('authorization') || ''
    const jwt  = auth.replace('Bearer ', '')
    if (!jwt) return null
    const [, b64] = jwt.split('.')
    const payload = JSON.parse(atob(b64.replace(/-/g,'+').replace(/_/g,'/')))
    if (payload?.role === 'service_role') return null  // no user_id in service calls
    return payload?.sub || null
  } catch {
    return null
  }
}

// ── withTelemetry — wrap a Deno.serve handler with telemetry ─────────────────
export function withTelemetry(
  fnName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return handler(req)  // passthrough preflight

    const t0          = Date.now()
    const requestId   = crypto.randomUUID().slice(0, 8)
    const rawUserId   = extractUserId(req)

    let status: 'ok' | 'error' = 'ok'
    let errorClass: string | undefined

    try {
      const res = await handler(req)
      if (res.status >= 500) {
        status     = 'error'
        errorClass = `HTTP${res.status}`
      }

      const userIdHash = rawUserId ? await hashUserId(rawUserId) : undefined

      // fire-and-forget — don't await
      emitEvent({
        fn:           fnName,
        status,
        duration_ms:  Date.now() - t0,
        request_id:   requestId,
        http_status:  res.status,
        ...(userIdHash  ? { user_id_hash: userIdHash }  : {}),
        ...(errorClass  ? { error_class: errorClass }   : {}),
        ts: new Date().toISOString(),
      })

      return res
    } catch (err) {
      status     = 'error'
      errorClass = (err as Error)?.constructor?.name || 'UnknownError'

      const userIdHash = rawUserId ? await hashUserId(rawUserId) : undefined

      emitEvent({
        fn:           fnName,
        status:       'error',
        duration_ms:  Date.now() - t0,
        request_id:   requestId,
        error_class:  errorClass,
        error_msg:    (err as Error)?.message?.slice(0, 200),
        ...(userIdHash ? { user_id_hash: userIdHash } : {}),
        ts: new Date().toISOString(),
      })

      // Re-throw so the default Deno error handler returns a 500
      throw err
    }
  }
}

// ── telemetryHeartbeat — liveness signal for long-running workers ─────────────
// Call once: const stopHeartbeat = telemetryHeartbeat('ai-batch-worker')
// Cancel on shutdown: stopHeartbeat()
//
// Expected cadence: every 60s. Alert rule in Axiom:
//   fn=<workerName> AND status=alive | absent for 5min → page on-call
export function telemetryHeartbeat(fnName: string): () => void {
  const iv = setInterval(() => {
    emitEvent({
      fn:     fnName,
      status: 'alive',
      ts:     new Date().toISOString(),
    })
  }, HEARTBEAT_MS)

  return () => clearInterval(iv)
}
