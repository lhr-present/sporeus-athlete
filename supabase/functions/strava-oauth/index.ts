// supabase/functions/strava-oauth/index.ts
// Handles Strava OAuth: connect (token exchange), sync (activity import), disconnect
// Secrets required: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// v9.465: activity→row mapping is shared with strava-backfill-worker (was
// duplicated + drifting). Enrichment (power/elevation/RPE/clock) lives there.
import { buildTrainingLogRow, resolveProfilePhysiology, enqueueStreamEnrichment, fetchStreamEnrichedIds, stripStreamDerived } from '../_shared/stravaActivity.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  })
}

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}


async function refreshIfExpired(
  adminClient: ReturnType<typeof createClient>,
  tokenRow: { expires_at: string; refresh_token: string; user_id: string },
  stravaClientId: string,
  stravaClientSecret: string,
): Promise<string | null> {
  // Refresh if within 5 minutes of expiry
  const expiresAt = new Date(tokenRow.expires_at)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)
  if (expiresAt > fiveMinFromNow) return null

  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  })
  // Distinguish "refresh failed" (throw) from "not expired" (the early `return null`
  // above). Previously a failed refresh also returned null, so the caller silently
  // fell back to the stale token → 401 with no signal. A 400 / invalid_grant means
  // the refresh token was revoked → the user must reconnect.
  const refreshed = await resp.json().catch(() => ({} as Record<string, unknown>))
  if (!resp.ok || !refreshed.access_token) {
    const blob = JSON.stringify(refreshed)
    if (resp.status === 400 || /invalid_grant|revoked|invalid/i.test(blob)) {
      throw new Error("Strava authorization revoked — please reconnect Strava")
    }
    throw new Error(`Strava token refresh failed (${resp.status})`)
  }

  await adminClient.from("strava_tokens").update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", tokenRow.user_id)

  return refreshed.access_token
}

// Fetch one page of activities, respecting rate limit headers.
// Returns { activities, rateLimitExceeded, retryAfter }
async function fetchActivitiesPage(
  accessToken: string,
  after: number,
  page: number,
): Promise<{ activities: unknown[]; rateLimitExceeded: boolean; retryAfter: number }> {
  const resp = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get("Retry-After") || "60", 10)
    return { activities: [], rateLimitExceeded: true, retryAfter }
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "")
    throw new Error(`Strava API ${resp.status}: ${body.slice(0, 200)}`)
  }

  const activities = await resp.json()
  return { activities: Array.isArray(activities) ? activities : [], rateLimitExceeded: false, retryAfter: 0 }
}

serve(withTelemetry('strava-oauth', async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Unauthorized")

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!
  const serviceKey   = (Deno.env.get("SPOREUS_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
  const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!
  const stravaId     = Deno.env.get("STRAVA_CLIENT_ID")     || ""
  const stravaSecret = Deno.env.get("STRAVA_CLIENT_SECRET") || ""

  // Verify calling user via their JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Invalid token")

  const admin = createClient(supabaseUrl, serviceKey)

  let body: { action?: string; code?: string; redirectUri?: string } = {}
  try { body = await req.json() } catch { return fail(400, "Invalid JSON") }
  const { action, code, redirectUri } = body

  // ── CONNECT: exchange Strava code for tokens ─────────────────────────────────
  if (action === "connect") {
    if (!code) return fail(400, "Missing code")
    if (!stravaId || !stravaSecret) return fail(500, "Strava credentials not configured")

    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: stravaId,
        client_secret: stravaSecret,
        code,
        grant_type: "authorization_code",
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }),
    })
    const tokens = await resp.json()
    if (!tokens.access_token) {
      return fail(400, tokens.message || tokens.errors?.[0]?.message || "Strava token exchange failed")
    }

    const athleteName = tokens.athlete
      ? `${tokens.athlete.firstname || ""} ${tokens.athlete.lastname || ""}`.trim()
      : null

    // F4: validate granted scope. Strava returns the granted scopes on the token
    // exchange (e.g. "read,activity:read_all"). A reused "read"-only grant returns
    // ZERO activities → a silent empty import. Record it (don't hard-fail — keep the
    // token) so the client can prompt a re-consent.
    const grantedScope = typeof tokens.scope === "string" ? tokens.scope : ""
    const hasActivityRead = /(^|,)\s*activity:read_all\s*(,|$)/.test(grantedScope)
    const scopeError = grantedScope && !hasActivityRead
      ? 'Strava granted read-only — reconnect and allow "View data about your activities"'
      : null

    // F2: mark the row "syncing" at connect so a never-completed first import is
    // visibly not-done rather than looking like a healthy idle. The first successful
    // sync/backfill page flips it to idle + sets last_sync_at. If scope is bad we
    // record 'error' instead so sync-health surfaces the re-consent prompt.
    const { error: upsertErr } = await admin.from("strava_tokens").upsert({
      user_id:               user.id,
      access_token:          tokens.access_token,
      refresh_token:         tokens.refresh_token,
      expires_at:            new Date(tokens.expires_at * 1000).toISOString(),
      strava_athlete_id:     tokens.athlete?.id ?? null,
      provider_athlete_name: athleteName,
      sync_status:           scopeError ? "error" : "syncing",
      last_error:            scopeError,
      last_sync_at:          null,
      updated_at:            new Date().toISOString(),
    })
    if (upsertErr) return fail(500, upsertErr.message)

    // Read-only grant → no point enqueuing a backfill that will import nothing.
    // Surface the scope error to the client so it can re-prompt consent.
    if (scopeError) {
      return ok({ athlete: athleteName, strava_id: tokens.athlete?.id, scope_error: scopeError })
    }

    // v7.48.0: enqueue historical backfill (last 90 days) via strava_backfill queue.
    // strava-backfill-worker processes these pages in the background every 2 minutes.
    // F1: PostgREST RPC errors come back as { error } in the response body — they do
    // NOT reject, so a bare .catch() ignored them and returned ok() as if the backfill
    // was queued. Capture the returned { error }, retry with small backoff, and if it
    // still fails set a durable error state so the client/reconciler can recover.
    const backfillAfter = Math.floor(Date.now() / 1000) - 90 * 24 * 3600
    let enqueued = false
    let lastEnqueueErr = ""
    for (let attempt = 1; attempt <= 3 && !enqueued; attempt++) {
      try {
        const { error: rpcErr } = await admin.rpc("enqueue_strava_backfill", {
          p_payload: {
            user_id:     user.id,
            page:        1,
            after:       backfillAfter,
            enqueued_at: new Date().toISOString(),
          },
        })
        if (!rpcErr) { enqueued = true; break }
        lastEnqueueErr = rpcErr.message || String(rpcErr)
      } catch (e) {
        lastEnqueueErr = e instanceof Error ? e.message : String(e)
      }
      if (!enqueued && attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 300))
      }
    }

    if (!enqueued) {
      // Durable state so the never-run backfill is recoverable — client/reconciler
      // sees sync_status='error' and can prompt a reconnect or manual Sync tap.
      console.error("strava-oauth: backfill enqueue failed after retries:", lastEnqueueErr)
      await admin.from("strava_tokens").update({
        sync_status: "error",
        last_error:  "backfill_pending — reconnect or tap Sync",
        updated_at:  new Date().toISOString(),
      }).eq("user_id", user.id)
      return ok({
        athlete:   athleteName,
        strava_id: tokens.athlete?.id,
        backfill_enqueued: false,
        backfill_error: "backfill_pending — reconnect or tap Sync",
      })
    }

    return ok({ athlete: athleteName, strava_id: tokens.athlete?.id, backfill_enqueued: true })
  }

  // ── SYNC: import recent Strava activities ────────────────────────────────────
  if (action === "sync") {
    const { data: tokenRow, error: fetchErr } = await admin
      .from("strava_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchErr || !tokenRow) return fail(404, "Strava not connected")

    // Athlete physiology: max HR (real → 220−age → null, honest "unknown") + FTP
    // for headline power-TSS. profiles.profile_data holds flat { maxhr, age, ftp }.
    const physio = await resolveProfilePhysiology(admin, user.id)

    // Mark syncing
    await admin.from("strava_tokens").update({ sync_status: "syncing" }).eq("user_id", user.id)

    const setSyncDone = async (error?: string) => {
      await admin.from("strava_tokens").update({
        sync_status:  error ? "error" : "idle",
        last_error:   error ?? null,
        last_sync_at: error ? tokenRow.last_sync_at : new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }).eq("user_id", user.id)
    }

    // Refresh token if expiring within 5 minutes
    let accessToken: string
    try {
      const newToken = await refreshIfExpired(admin, tokenRow, stravaId, stravaSecret)
      accessToken = newToken || tokenRow.access_token
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await setSyncDone(`Token refresh failed: ${msg}`)
      return fail(502, `Token refresh failed: ${msg}`)
    }

    // Fetch activities — max 2 pages (200 activities) to stay within rate limits
    const after = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
    const allActivities: unknown[] = []

    for (let page = 1; page <= 2; page++) {
      let pageResult: { activities: unknown[]; rateLimitExceeded: boolean; retryAfter: number }
      try {
        pageResult = await fetchActivitiesPage(accessToken, after, page)
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        // Audit MED-1: a 401/403 here means the token was revoked/rejected while
        // still unexpired (refreshIfExpired's early return skipped the refresh).
        // Write the CANONICAL reconnect string (same as the worker) so the
        // client's needsReconnect routing fires — the raw "Strava API 401: …"
        // string matched nothing and left the athlete in the SYNC NOW loop.
        const msg = /^Strava API 40[13]:/.test(raw)
          ? "Strava authorization rejected — please reconnect Strava"
          : raw
        await setSyncDone(msg)
        return fail(502, msg)
      }

      if (pageResult.rateLimitExceeded) {
        await setSyncDone(`Rate limit hit — retry after ${pageResult.retryAfter}s`)
        return fail(429, `Strava rate limit — retry after ${pageResult.retryAfter}s`)
      }

      allActivities.push(...pageResult.activities)
      // Stop early if page wasn't full (no more data)
      if (pageResult.activities.length < 100) break
    }

    // Upsert activities into training_log (shared enriched mapper).
    // HIGH-1 fix: a summary re-import must not clobber streams-derived values
    // on already-enriched rows (SYNC NOW covers a 30-day window — pre-fix every
    // tap reverted zones/np/tss/rpe to summary estimates, permanently).
    const enrichedIds = await fetchStreamEnrichedIds(admin, user.id, allActivities as Record<string, unknown>[])
    let synced = 0
    for (const a of allActivities as Record<string, unknown>[]) {
      const row = buildTrainingLogRow(a, user.id, physio)
      if (!row) continue

      const payload = enrichedIds.has(String(row.external_id)) ? stripStreamDerived(row) : row
      const { error: insertErr } = await admin
        .from("training_log")
        .upsert(payload, { onConflict: "user_id,external_id" })
      if (!insertErr) synced++
    }

    // v9.466 P1: queue streams+detail enrichment (processed by the backfill
    // worker cron, rate-budgeted there — no extra API calls on this request).
    await enqueueStreamEnrichment(admin, user.id, allActivities as Record<string, unknown>[])

    await setSyncDone()
    return ok({ synced, total: allActivities.length })
  }

  // ── DISCONNECT: revoke at Strava, then remove local tokens ──────────────────
  if (action === "disconnect") {
    // Fetch the current access token to send to Strava's deauthorize endpoint
    const { data: tokenRow } = await admin
      .from("strava_tokens")
      .select("access_token")
      .eq("user_id", user.id)
      .maybeSingle()

    if (tokenRow?.access_token) {
      // Best-effort revocation — don't fail the disconnect if Strava is unreachable
      try {
        await fetch("https://www.strava.com/oauth/deauthorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenRow.access_token }),
        })
      } catch {
        // Network error during revocation — proceed with local deletion anyway
      }
    }

    await admin.from("strava_tokens").delete().eq("user_id", user.id)
    return ok({ ok: true })
  }

  return fail(400, `Unknown action: ${action}`)
}))
