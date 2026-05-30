// ─── _shared/serviceAuth.ts — Verify internal (cron/DB-webhook) callers ───────
//
// WHY THIS EXISTS (audit H1, 2026-05-30):
// Several functions used to authorize "system" callers solely by decoding the
// JWT payload (`JSON.parse(atob(token.split('.')[1]))`) and checking
// `payload.role === 'service_role'`. That decode performs NO signature
// verification. If a function is ever deployed with `verify_jwt = false`
// (CHANGELOG confirms embed-session and ai-batch-worker are), an attacker can
// forge `Bearer <anything>.<base64 {"role":"service_role"}>.<anything>` and be
// treated as the service role — yielding IDOR with service-role DB writes.
//
// FIX: in addition to (or instead of) trusting the unsigned role claim, require
// a caller-supplied shared secret and compare it in CONSTANT TIME against the
// `WEBHOOK_SECRET` env var. DB webhooks / pg_cron HTTP calls must send this
// secret in the `x-sporeus-webhook-secret` header. This is safe regardless of
// the `verify_jwt` setting: even if Supabase's gateway lets the request through
// unverified, the function itself will not act as the service role without the
// secret. Mirrors the HMAC/constant-time pattern in dodo-webhook/index.ts.
//
// INTEGRATOR ACTION REQUIRED:
//   1. `supabase secrets set WEBHOOK_SECRET=<long-random-value>`
//   2. Add header `x-sporeus-webhook-secret: <same value>` to every DB webhook
//      and pg_cron net.http_post() that targets these functions.
//   If WEBHOOK_SECRET is unset, the service-role path is DENIED (fail closed) —
//   except that the legitimate user-JWT paths in dual-mode functions still work.

// ── constantTimeEqual — length-safe, timing-safe string compare ───────────────
export function constantTimeEqual(a: string, b: string): boolean {
  // Compare against a fixed-length digest of each input so the loop length does
  // not leak the secret length, and a missing/short input can never short-circuit.
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ── isVerifiedServiceCall ─────────────────────────────────────────────────────
// Returns true ONLY when the request carries the correct shared secret in the
// `x-sporeus-webhook-secret` header. Does NOT trust the JWT role claim at all.
// Fails closed when WEBHOOK_SECRET is not configured.
export function isVerifiedServiceCall(req: Request): boolean {
  const expected = Deno.env.get('WEBHOOK_SECRET') || ''
  if (!expected) return false                     // fail closed — not configured
  const provided = req.headers.get('x-sporeus-webhook-secret') || ''
  if (!provided) return false
  return constantTimeEqual(provided, expected)
}
