// supabase/functions/nightly-batch/index.ts — Nightly AI batch processor
// Runs via pg_cron at 03:00 UTC every day.
// Schedule SQL (run once in Supabase SQL editor):
//
//   SELECT cron.schedule(
//     'nightly-batch',
//     '0 3 * * *',
//     $$
//     SELECT net.http_post(
//       url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/nightly-batch',
//       headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
//       body    := '{"source":"pg_cron"}'::jsonb
//     ) AS request_id;
//     $$
//   );

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// v7.43.0: per-session analysis moved to DB webhook → analyse-session edge fn.
// nightly-batch now handles only Sunday weekly squad digests.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const MODEL_HAIKU = "claude-haiku-4-5-20251001"

// ── Simple promise pool (semaphore) ──────────────────────────────────────────
async function withSemaphore<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  let idx = 0

  async function worker() {
    while (idx < tasks.length) {
      const taskIdx = idx++
      try {
        results[taskIdx] = { status: "fulfilled", value: await tasks[taskIdx]() }
      } catch (e) {
        results[taskIdx] = { status: "rejected", reason: e }
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

// ── Retry with exponential backoff (for 429/529 rate-limit errors) ───────────
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
      const isRateLimit = msg.includes('429') || msg.includes('529') || msg.includes('rate limit') || msg.includes('overloaded')
      if (!isRateLimit || attempt === maxAttempts - 1) throw err
      const waitMs = (attempt + 1) * 2000
      console.warn(`retryWithBackoff: attempt ${attempt + 1} failed (${msg.slice(0, 80)}), retrying in ${waitMs}ms`)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  throw lastErr
}

// ── Call Anthropic Haiku ──────────────────────────────────────────────────────
async function callHaiku(system: string, user: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
  if (!key) throw new Error("ANTHROPIC_API_KEY not set")

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_HAIKU,
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: user }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  return data?.content?.[0]?.text ?? ""
}

// ── Parse JSON safely (strip markdown fences) ─────────────────────────────────
function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
  } catch { return null }
}

// ── Weekly digest prompt (RAG-enhanced) ──────────────────────────────────────
// When session context [S1]..[Sn] is available it is prepended to this system prompt.
const WEEKLY_DIGEST_SYSTEM = `You are a sport science assistant. Summarise a coach's squad weekly performance.
Output ONLY valid JSON: {"headline": string, "highlights": string[], "alerts": string[], "recommendation": string, "citations": [{"marker": string, "date": string, "type": string}]}
headline: one sentence overall week summary.
highlights: up to 3 positive individual athlete notes. Cite specific sessions using [S1]..[Sn] where relevant.
alerts: up to 2 athletes needing attention (high ACWR or low wellness). Cite sessions.
recommendation: one sentence focus for next week.
citations: only include markers you actually used in highlights/alerts.
Plain language. Under 140 words total.`

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings"
const EMBED_MODEL = "text-embedding-3-small"

// ── Embed text via EMBEDDING_API_KEY (OpenAI) ────────────────────────────────
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

// ── Retrieve top-k sessions for squad via HNSW cosine search ─────────────────
async function fetchRagSessions(
  sb: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  athleteIds: string[],
  weekStart: string,
  queryEmbedding: number[]
): Promise<{ session_id: string; athlete_id: string; athlete_name: string; date: string; type: string; duration_min: number | null; tss: number | null; rpe: number | null; notes: string | null; similarity: number }[]> {
  if (!athleteIds.length || !queryEmbedding.length) return []
  try {
    // Use match_sessions_for_coach RPC via service-role client (bypasses RLS)
    // We scope to sessions from the current week only by filtering after retrieval.
    const { data, error } = await sb.rpc("match_sessions_for_coach", {
      p_embedding:   `[${queryEmbedding.join(",")}]`,
      p_athlete_ids: athleteIds,
      k:             15,  // fetch 15, filter to week, keep top 10
    })
    if (error || !data) return []
    // Filter to sessions from this week and keep top 10
    return (data as typeof data)
      .filter((s: { date: string }) => s.date >= weekStart)
      .slice(0, 10)
  } catch { return [] }
}

// ── Format RAG context block [S1]..[Sn] ──────────────────────────────────────
function buildRagContext(sessions: { session_id: string; athlete_name?: string; date: string; type: string; duration_min: number | null; tss: number | null; rpe: number | null; notes: string | null }[]): string {
  if (!sessions.length) return ""
  const lines = sessions.map((s, i) => [
    `[S${i + 1}]`,
    s.athlete_name ? `athlete:${s.athlete_name}` : null,
    `date:${s.date}`,
    `type:${s.type || "unknown"}`,
    s.duration_min ? `${s.duration_min}min` : null,
    s.tss ? `TSS:${s.tss}` : null,
    s.rpe ? `RPE:${s.rpe}` : null,
    s.notes ? `notes:"${s.notes.slice(0, 150)}"` : null,
  ].filter(Boolean).join(" "))
  return [
    "=== SQUAD SESSION CONTEXT (most relevant to this week) ===",
    ...lines,
    "=== END CONTEXT — cite as [S1] etc. in highlights/alerts ===",
    "",
  ].join("\n")
}

// ── Monday of the current ISO week (YYYY-MM-DD) ──────────────────────────────
function getWeekStart(dateStr: string): string {
  const d   = new Date(dateStr + "T12:00:00Z")
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diffToMonday)
  return monday.toISOString().slice(0, 10)
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  // Auth guard: only accept requests signed with the service role key.
  // pg_cron sends this in the Authorization header; reject anything else.
  const authHeader = req.headers.get("Authorization") ?? ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }

  const start = Date.now()

  // Service-role client — bypasses RLS
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
  )

  const today = new Date().toISOString().slice(0, 10)

  // v7.43.0: Per-session analysis is now event-driven via the on_training_log_insert
  // DB webhook → analyse-session edge function. nightly-batch now only produces
  // weekly squad digests (Sunday) and exits immediately on other days.

  const ms_pre_digest = Date.now() - start

  // ── Sunday-only: weekly squad digest for coaches ──────────────────────────
  const isSunday = new Date(today + "T12:00:00Z").getUTCDay() === 0
  let weeklyDigestResult: { coaches: number; errors: number } | null = null

  if (isSunday) {
    console.log(`nightly-batch [${today}]: Sunday detected — running weekly digest`)
    const weekStart = getWeekStart(today)
    const sevenDaysAgo = weekStart

    // Query all coaches (role = 'coach') from profiles
    const { data: coaches } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("role", "coach")

    let digestOk = 0, digestErr = 0

    for (const coach of coaches ?? []) {
      try {
        // Fetch this coach's athletes
        const { data: coachAthletes } = await supabase
          .from("coach_athletes")
          .select("athlete_id")
          .eq("coach_id", coach.id)

        if (!coachAthletes || coachAthletes.length === 0) continue

        const athleteIds = coachAthletes.map((r: { athlete_id: string }) => r.athlete_id)

        // Get last 7 days load data for the squad
        const { data: weekLogs } = await supabase
          .from("training_log")
          .select("user_id, date, tss")
          .in("user_id", athleteIds)
          .gte("date", sevenDaysAgo)
          .order("date", { ascending: true })

        // Get wellness scores for the week
        const { data: weekWellness } = await supabase
          .from("recovery")
          .select("user_id, date, score")
          .in("user_id", athleteIds)
          .gte("date", sevenDaysAgo)

        // Build per-athlete summaries for the prompt
        const summaries = athleteIds.map((uid: string) => {
          const logs = (weekLogs ?? []).filter((l: { user_id: string }) => l.user_id === uid)
          const wl   = (weekWellness ?? []).filter((w: { user_id: string }) => w.user_id === uid)
          const weekTSS = logs.reduce((s: number, l: { tss: number }) => s + (l.tss ?? 0), 0)
          const avgWell = wl.length > 0 ? Math.round(wl.reduce((s: number, w: { score: number }) => s + (w.score ?? 0), 0) / wl.length) : null
          return { uid: uid.slice(0, 8), weekTSS, avgWellness: avgWell, sessions: logs.length }
        })

        // ── RAG: embed query, retrieve most relevant squad sessions ─────────
        const ragQuery = `squad weekly performance summary ${weekStart} coach ${coach.display_name}`
        const ragEmbedding = await embedText(ragQuery)
        const ragSessions  = ragEmbedding
          ? await fetchRagSessions(supabase, Deno.env.get("SUPABASE_URL") ?? "", serviceKey, athleteIds, sevenDaysAgo, ragEmbedding)
          : []
        const ragContext   = buildRagContext(ragSessions)

        const userPrompt = `Squad weekly data (coach: ${coach.display_name}, week starting ${weekStart}): ${JSON.stringify(summaries)}`
        const fullSystem  = ragContext ? ragContext + WEEKLY_DIGEST_SYSTEM : WEEKLY_DIGEST_SYSTEM
        const digestText  = await retryWithBackoff(() => callHaiku(fullSystem, userPrompt))
        const digestJson = parseJSON(digestText)

        if (!digestJson) throw new Error("Bad digest JSON")

        // Upsert weekly_digests — idempotent on (coach_id, week_start)
        // Attach RAG citation map so client can resolve [S1] → session date/type
        const citations = ragSessions.map((s, i) => ({
          marker:     `S${i + 1}`,
          session_id: s.session_id,
          date:       s.date,
          type:       s.type || "unknown",
          athlete_id: s.athlete_id,
        }))

        await supabase.from("weekly_digests").upsert({
          coach_id:    coach.id,
          week_start:  weekStart,
          digest_json: { ...(digestJson as object), _citations: citations },
        }, { onConflict: "coach_id,week_start" })

        digestOk++
      } catch (e) {
        digestErr++
        console.error(`weekly-digest error for coach ${coach.id}:`, e instanceof Error ? e.message : String(e))
      }
    }

    weeklyDigestResult = { coaches: digestOk, errors: digestErr }
    console.log(`weekly-digest [${weekStart}]: coaches=${digestOk} errors=${digestErr}`)
  }

  const ms = Date.now() - start
  console.log(`nightly-batch [${today}]: ms=${ms} weeklyDigest=${JSON.stringify(weeklyDigestResult)}`)

  return new Response(
    JSON.stringify({ date: today, weeklyDigest: weeklyDigestResult, ms }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  )
})
