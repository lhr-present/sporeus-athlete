#!/usr/bin/env -S deno run --allow-net --allow-env
// ─── scripts/backfill_embeddings.ts — Backfill session embeddings ─────────────
// Paginates training_log rows that have no session_embeddings entry,
// calls embed-session for each, throttles to 10 req/s, logs failures.
//
// Usage:
//   SUPABASE_URL=https://xyz.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<key> \
//   deno run --allow-net --allow-env scripts/backfill_embeddings.ts
//
// Optional env:
//   BATCH_SIZE=50   — rows per page (default 50)
//   RATE_LIMIT=10   — max concurrent requests (default 10)
//   DRY_RUN=1       — log sessions that need embedding but don't call edge fn

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BATCH_SIZE       = parseInt(Deno.env.get('BATCH_SIZE') || '50', 10)
const RATE_LIMIT       = parseInt(Deno.env.get('RATE_LIMIT') || '10', 10)
const DRY_RUN          = Deno.env.get('DRY_RUN') === '1'
const EMBED_FN_URL     = `${SUPABASE_URL}/functions/v1/embed-session`

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  Deno.exit(1)
}

const HEADERS = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey':        SERVICE_KEY,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchPage(offset: number): Promise<{ id: string; user_id: string }[]> {
  const url = `${SUPABASE_URL}/rest/v1/training_log` +
    `?select=id,user_id` +
    `&id=not.in.(select:session_embeddings.session_id)` +
    `&order=date.asc` +
    `&offset=${offset}&limit=${BATCH_SIZE}`

  // Use PostgREST sub-select filter syntax to exclude already-embedded sessions
  const notEmbeddedUrl =
    `${SUPABASE_URL}/rest/v1/rpc/` +
    // Actually use a raw SQL approach via RPC isn't ideal here.
    // Use the simpler approach: fetch all, check against batch.
    `get_unembedded_sessions?offset=${offset}&limit=${BATCH_SIZE}`

  // Fallback: simpler direct query — fetch training_log rows not in session_embeddings
  // PostgREST doesn't support nested NOT IN easily; use a custom RPC or two-step.
  // Step 1: fetch session_ids that ARE embedded
  const embeddedRes = await fetch(
    `${SUPABASE_URL}/rest/v1/session_embeddings?select=session_id`,
    { headers: HEADERS }
  )
  const embedded: { session_id: string }[] = embeddedRes.ok ? await embeddedRes.json() : []
  const embeddedSet = new Set(embedded.map(r => r.session_id))

  // Step 2: fetch training_log page and filter client-side
  const logRes = await fetch(
    `${SUPABASE_URL}/rest/v1/training_log?select=id,user_id&order=date.asc&offset=${offset}&limit=${BATCH_SIZE * 3}`,
    { headers: HEADERS }
  )
  if (!logRes.ok) throw new Error(`training_log fetch failed: ${logRes.status}`)
  const rows: { id: string; user_id: string }[] = await logRes.json()

  return rows.filter(r => !embeddedSet.has(r.id)).slice(0, BATCH_SIZE)
}

async function embedSession(id: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] would embed session ${id}`)
    return { ok: true }
  }

  const res = await fetch(EMBED_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ session_id: id, user_id: userId, source: 'backfill' }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, error: (body as { error?: string }).error || `HTTP ${res.status}` }
  }

  const data = await res.json()
  return { ok: true, ...(data.skipped ? { error: 'skipped:content_unchanged' } : {}) }
}

// Rate limiter: process at most RATE_LIMIT concurrent requests
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Sporeus backfill_embeddings — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} mode`)
  console.log(`SUPABASE_URL: ${SUPABASE_URL}`)
  console.log(`batch_size=${BATCH_SIZE} rate_limit=${RATE_LIMIT}`)
  console.log('─'.repeat(60))

  let offset  = 0
  let total   = 0
  let success = 0
  let failed  = 0
  const failedIds: { id: string; error: string }[] = []

  while (true) {
    let page: { id: string; user_id: string }[]

    try {
      page = await fetchPage(offset)
    } catch (e) {
      console.error(`Fetch error at offset ${offset}:`, (e as Error).message)
      break
    }

    if (!page.length) {
      console.log('No more sessions to embed.')
      break
    }

    console.log(`Processing batch offset=${offset}, ${page.length} sessions...`)

    const tasks = page.map(row => async () => {
      const result = await embedSession(row.id, row.user_id)
      total++
      if (result.ok) {
        success++
        process.stdout?.write?.('.')
      } else {
        failed++
        failedIds.push({ id: row.id, error: result.error || 'unknown' })
        process.stdout?.write?.('E')

        // Log persistent failures to batch_errors table
        if (!DRY_RUN && result.error && !result.error.startsWith('skipped:')) {
          await fetch(`${SUPABASE_URL}/rest/v1/batch_errors`, {
            method: 'POST',
            headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({
              athlete_id: row.user_id,
              date:       new Date().toISOString().slice(0, 10),
              error_code: `embed_fail:${result.error.slice(0, 80)}`,
              attempts:   1,
            }),
          }).catch(() => {/* non-fatal */})
        }
      }
      return result
    })

    await withConcurrencyLimit(tasks, RATE_LIMIT)
    console.log()  // newline after dots

    offset += page.length
    // Add a small delay between pages to stay under rate limits
    if (page.length === BATCH_SIZE) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log('─'.repeat(60))
  console.log(`Done. total=${total} success=${success} failed=${failed}`)

  if (failedIds.length) {
    console.warn('\nFailed session IDs:')
    failedIds.forEach(f => console.warn(`  ${f.id}: ${f.error}`))
  }
}

main().catch(e => {
  console.error('Fatal:', e)
  Deno.exit(1)
})
