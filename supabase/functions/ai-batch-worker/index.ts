// supabase/functions/ai-batch-worker/index.ts — pgmq ai_batch consumer
// Cron: every minute (* * * * *)
// Reads up to 20 messages from ai_batch (VT=30s), processes weekly squad digest per coach.
// Retry semantics: on failure, re-enqueues with incremented retry_count + delay [30s/120s/480s].
// After 3 failures: moves to ai_batch_dlq + writes batch_errors row.

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const MODEL_HAIKU       = "claude-haiku-4-5-20251001"
const OPENAI_EMBED_URL  = "https://api.openai.com/v1/embeddings"
const EMBED_MODEL       = "text-embedding-3-small"

const MAX_RETRIES  = 3
const RETRY_DELAYS = [30, 120, 480]  // seconds indexed by current retry_count

function jwtRole(h: string | null): string | null {
  try {
    if (!h) return null
    const p = JSON.parse(atob(h.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    return p.role || null
  } catch { return null }
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn() } catch (err) {
      lastErr = err
      const msg = String(err).toLowerCase()
      const isRate = msg.includes("429") || msg.includes("529") || msg.includes("rate limit") || msg.includes("overloaded")
      if (!isRate || i === maxAttempts - 1) throw err
      await new Promise(r => setTimeout(r, (i + 1) * 2000))
    }
  }
  throw lastErr
}

async function callHaiku(system: string, user: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
  if (!key) throw new Error("ANTHROPIC_API_KEY not set")
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL_HAIKU, max_tokens: 256, system, messages: [{ role: "user", content: user }] }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`)
  const data = await res.json()
  return data?.content?.[0]?.text ?? ""
}

function parseJSON(text: string): unknown {
  try { return JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()) }
  catch { return null }
}

async function embedText(text: string): Promise<number[] | null> {
  const key = Deno.env.get("EMBEDDING_API_KEY")
  if (!key) return null
  try {
    const res = await fetch(OPENAI_EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8192) }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const emb = data?.data?.[0]?.embedding
    return Array.isArray(emb) && emb.length === 1536 ? emb : null
  } catch { return null }
}

async function fetchRagSessions(
  sb: ReturnType<typeof createClient>,
  athleteIds: string[],
  weekStart: string,
  queryEmbedding: number[],
): Promise<{ session_id: string; athlete_id: string; athlete_name: string; date: string; type: string; duration_min: number | null; tss: number | null; rpe: number | null; notes: string | null }[]> {
  if (!athleteIds.length || !queryEmbedding.length) return []
  try {
    const { data, error } = await sb.rpc("match_sessions_for_coach", {
      p_embedding:   `[${queryEmbedding.join(",")}]`,
      p_athlete_ids: athleteIds,
      k:             15,
    })
    if (error || !data) return []
    return (data as { date: string }[]).filter(s => s.date >= weekStart).slice(0, 10) as typeof data
  } catch { return [] }
}

function buildRagContext(sessions: { session_id: string; athlete_name?: string; date: string; type: string; duration_min: number | null; tss: number | null; rpe: number | null; notes: string | null }[]): string {
  if (!sessions.length) return ""
  const lines = sessions.map((s, i) => [
    `[S${i + 1}]`,
    s.athlete_name ? `athlete:${s.athlete_name}` : null,
    `date:${s.date}`, `type:${s.type || "unknown"}`,
    s.duration_min ? `${s.duration_min}min` : null,
    s.tss          ? `TSS:${s.tss}` : null,
    s.rpe          ? `RPE:${s.rpe}` : null,
    s.notes        ? `notes:"${s.notes.slice(0, 150)}"` : null,
  ].filter(Boolean).join(" "))
  return [
    "=== SQUAD SESSION CONTEXT (most relevant to this week) ===",
    ...lines,
    "=== END CONTEXT — cite as [S1] etc. in highlights/alerts ===",
    "",
  ].join("\n")
}

const WEEKLY_DIGEST_SYSTEM = `You are a sport science assistant. Summarise a coach's squad weekly performance.
Output ONLY valid JSON: {"headline": string, "highlights": string[], "alerts": string[], "recommendation": string, "citations": [{"marker": string, "date": string, "type": string}]}
headline: one sentence overall week summary.
highlights: up to 3 positive individual athlete notes. Cite specific sessions using [S1]..[Sn] where relevant.
alerts: up to 2 athletes needing attention (high ACWR or low wellness). Cite sessions.
recommendation: one sentence focus for next week.
citations: only include markers you actually used in highlights/alerts.
Plain language. Under 140 words total.`

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })

  if (jwtRole(req.headers.get("authorization")) !== "service_role") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sb          = createClient(supabaseUrl, serviceKey)
  const today       = new Date().toISOString().slice(0, 10)

  // Read up to 20 messages with VT=30s
  const { data: msgs, error: readErr } = await sb.rpc("read_ai_batch", { batch_size: 20, vt: 30 })
  if (readErr) {
    return new Response(JSON.stringify({ error: readErr.message }), { status: 500 })
  }
  if (!msgs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } })
  }

  let ok = 0, dlq = 0, retried = 0, errs = 0

  for (const row of msgs) {
    const msgId      = row.msg_id as bigint
    const readCt     = row.read_ct as number
    const payload    = row.message as Record<string, unknown>
    const retryCount = typeof payload.retry_count === "number" ? payload.retry_count : 0

    // Move to DLQ if retry budget exceeded (payload retry_count OR pgmq read_ct safety net)
    if (retryCount >= MAX_RETRIES || readCt > MAX_RETRIES) {
      await sb.rpc("move_to_dlq", {
        p_payload: { ...payload, dlq_reason: "max_retries", moved_at: today, read_ct: readCt },
      })
      await sb.rpc("delete_ai_batch_msg", { p_msg_id: msgId })
      await sb.from("batch_errors").upsert({
        athlete_id: payload.coach_id,
        date:       today,
        error_code: "max_retries_exceeded",
        attempts:   retryCount,
      }, { onConflict: "athlete_id,date" })
      dlq++
      continue
    }

    const coachId   = payload.coach_id as string
    const weekStart = payload.week_start as string

    try {
      if (!coachId || !weekStart) throw new Error("invalid_payload: missing coach_id or week_start")

      // Fetch active athletes for this coach
      const { data: coachAthletes } = await sb
        .from("coach_athletes")
        .select("athlete_id")
        .eq("coach_id", coachId)
        .eq("status", "active")

      if (!coachAthletes?.length) {
        // No athletes — ACK cleanly, nothing to generate
        await sb.rpc("delete_ai_batch_msg", { p_msg_id: msgId })
        ok++
        continue
      }

      const athleteIds = coachAthletes.map((r: { athlete_id: string }) => r.athlete_id)

      const { data: weekLogs } = await sb
        .from("training_log")
        .select("user_id, date, tss")
        .in("user_id", athleteIds)
        .gte("date", weekStart)
        .order("date", { ascending: true })

      const { data: weekWellness } = await sb
        .from("recovery")
        .select("user_id, date, score")
        .in("user_id", athleteIds)
        .gte("date", weekStart)

      const summaries = athleteIds.map((uid: string) => {
        const logs     = (weekLogs     ?? []).filter((l: { user_id: string }) => l.user_id === uid)
        const wellness = (weekWellness ?? []).filter((w: { user_id: string }) => w.user_id === uid)
        const weekTSS  = logs.reduce((s: number, l: { tss: number }) => s + (l.tss ?? 0), 0)
        const avgWell  = wellness.length > 0
          ? Math.round(wellness.reduce((s: number, w: { score: number }) => s + (w.score ?? 0), 0) / wellness.length)
          : null
        return { uid: uid.slice(0, 8), weekTSS, avgWellness: avgWell, sessions: logs.length }
      })

      const coachName    = (payload.coach_name as string) || coachId.slice(0, 8)
      const ragQuery     = `squad weekly performance summary ${weekStart} coach ${coachName}`
      const ragEmbedding = await embedText(ragQuery)
      const ragSessions  = ragEmbedding ? await fetchRagSessions(sb, athleteIds, weekStart, ragEmbedding) : []
      const ragContext   = buildRagContext(ragSessions)

      const userPrompt  = `Squad weekly data (coach: ${coachName}, week starting ${weekStart}): ${JSON.stringify(summaries)}`
      const fullSystem  = ragContext ? ragContext + WEEKLY_DIGEST_SYSTEM : WEEKLY_DIGEST_SYSTEM
      const digestText  = await retryWithBackoff(() => callHaiku(fullSystem, userPrompt))
      const digestJson  = parseJSON(digestText)

      if (!digestJson) throw new Error("bad_digest_json: Haiku returned non-JSON")

      const citations = ragSessions.map((s, i) => ({
        marker:     `S${i + 1}`,
        session_id: s.session_id,
        date:       s.date,
        type:       s.type || "unknown",
        athlete_id: s.athlete_id,
      }))

      await sb.from("weekly_digests").upsert({
        coach_id:    coachId,
        week_start:  weekStart,
        digest_json: { ...(digestJson as object), _citations: citations },
      }, { onConflict: "coach_id,week_start" })

      await sb.rpc("delete_ai_batch_msg", { p_msg_id: msgId })
      ok++

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      console.error(`ai-batch-worker: msg ${msgId} coach ${coachId} failed: ${errMsg}`)

      // Re-enqueue with incremented retry_count and exponential delay
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)]
      await sb.rpc("enqueue_ai_batch", {
        p_payload: {
          ...payload,
          retry_count: retryCount + 1,
          retried_at:  new Date().toISOString(),
          last_error:  errMsg.slice(0, 200),
        },
        p_delay_s: delay,
      })

      // Delete the original — the fresh retry message with delay is the new record
      await sb.rpc("delete_ai_batch_msg", { p_msg_id: msgId })
      errs++
      retried++
    }
  }

  console.log(`ai-batch-worker [${today}]: ok=${ok} dlq=${dlq} retried=${retried} errors=${errs} total=${msgs.length}`)
  return new Response(
    JSON.stringify({ processed: ok, dlq, retried, errors: errs, total: msgs.length }),
    { headers: { "Content-Type": "application/json" } },
  )
})
