# Sporeus Internal Contracts

Cross-block data contracts between P1–P8 integration blocks.  
Last updated: 2026-04-18 · v8.0.1

A **contract** is a declared agreement on the payload shape, invariants, and
error conditions that a *consumer* depends on from a *producer*.  Violating a
contract causes silent data loss or runtime errors.

---

## Contract Index

| # | Contract | Producer | Consumer |
|---|---|---|---|
| C1 | training_log INSERT → analyse-session webhook | DB trigger | analyse-session edge function |
| C2 | analyse-session → embed-session insight chain | analyse-session | embed-session |
| C3 | session_embeddings row → ai-proxy RAG retrieval | embed-session | ai-proxy |
| C4 | pgmq queue message shapes | Various enqueue RPCs | Queue worker edge functions |
| C5 | generate-report data bundle → PDF template inputs | fetchWeeklyData / fetchMonthlySquadData / fetchRaceReadinessData | WeeklyAthleteReport / MonthlySquadReport / RaceReadinessReport |
| C6 | search_everything RPC → SearchPalette component | Postgres FTS function | SearchPalette.jsx |
| C7 | mv_squad_readiness → get_squad_overview → CoachDashboard | MV + SQL function + squad-sync edge fn | CoachDashboard.jsx |
| C8 | activity_upload_jobs status machine → UploadActivity realtime | parse-activity edge function | UploadActivity.jsx |

---

## C1 — training_log INSERT → analyse-session webhook

**Producer:** `supabase/migrations/20260422_webhooks.sql` · trigger `on_training_log_insert` → `pg_net.http_post`  
**Consumer:** `supabase/functions/analyse-session/index.ts`  

### Payload

```typescript
interface WebhookPayload {
  session_id: string   // UUID of the newly inserted training_log row
  user_id:    string   // auth.uid() of the row owner
  source:     'db_webhook'
}
```

### Request

```
POST /functions/v1/analyse-session
Authorization: Bearer <service_role_key>
Content-Type: application/json
```

### Invariants

1. `session_id` is always a non-null UUID that exists in `training_log` at time of handler invocation.
2. `user_id` matches `training_log.user_id` for the given `session_id`.
3. The trigger fires AFTER INSERT, so the row is visible to `SELECT` inside the handler.
4. The webhook is **fire-and-forget** — no ACK or retry.  If the function crashes or returns an error, the insight is permanently lost for this insertion event.
5. Tier guard: if `profiles.subscription_tier` is not `'coach'` or `'club'`, the function returns `{ insight: null, reason: 'upgrade_required' }` — not an error.
6. Duplicate guard: if `ai_insights` already has a `session_analysis` row for this `session_id`, returns `{ insight: null, reason: 'already_analysed' }`.

### Error conditions

| Scenario | Producer behaviour | Consumer receives |
|---|---|---|
| `session_id` not found in DB | 404 from analyse-session | Silently dropped by pg_net |
| Anthropic API unreachable | 502 from analyse-session | Silently dropped by pg_net |
| service_role key wrong | 401 from analyse-session | Silently dropped by pg_net |
| `ANTHROPIC_API_KEY` not set | 503 from analyse-session | Silently dropped by pg_net |

---

## C2 — analyse-session → embed-session insight chain

**Producer:** `supabase/functions/analyse-session/index.ts` (after line 217)  
**Consumer:** `supabase/functions/embed-session/index.ts` (C1 insight embedding block)  

### The race condition (fixed in v8.0.1)

Both `on_training_log_insert` and `on_training_log_insert_embed` fire in parallel on the same row.
When embed-session's C1 block queries `ai_insights WHERE session_id = X`, analyse-session may not
have written the row yet (it makes a 1–3 s Anthropic API call).

**Fix:** After successfully upserting `ai_insights`, analyse-session fires-and-forgets a POST to
embed-session with `insight_only: true`.

### Payload (insight_only invocation)

```typescript
interface InsightOnlyPayload {
  session_id:   string   // UUID — the session whose linked insights to embed
  user_id:      string   // athlete's auth.uid()
  insight_only: true     // signals embed-session to skip session vector, only embed insights
}
```

### What embed-session does with insight_only

1. Authenticates (service role only).
2. Queries `ai_insights WHERE athlete_id = user_id AND session_id = session_id`.
3. For each row, calls `embedInsight()` → upserts into `insight_embeddings`.
4. Returns `{ session_id, embedded: false, insight_only: true }`.

### insight_json shape stored by analyse-session

```typescript
interface SessionAnalysisInsightJson {
  text:    string           // 1–3 sentence coaching feedback (max 75 words)
  flags:   string[]         // e.g. ['overreach_risk (ACWR 1.42)', 'high_stress_session (TSS 158)']
  session: { id: string; type: string | null; tss: number | null }
  acwr:    number | null
  ctl:     number
  tsb:     number
}
```

### embedInsight field extraction contract

`embedInsight()` MUST extract the `text` field as the primary semantic content.
It MUST handle `flags` as a string array (not a string).

```
Content text = "date:{date} | kind:{kind} | insight:{text} | flags:{flags.join(' ')}"
```

### Invariants

1. `insight_only` calls are always service-role (from analyse-session).
2. embed-session with `insight_only: true` never re-embeds the session vector.
3. `embedInsight` deduplicates via SHA-256 of content text — identical text is never re-embedded.
4. Failure to embed insights is non-fatal and does not affect the session embedding.

---

## C3 — session_embeddings row → ai-proxy RAG retrieval

**Producer:** `supabase/functions/embed-session/index.ts`  
**Consumer:** `supabase/functions/ai-proxy/index.ts` via `match_sessions_for_user` RPC  

### session_embeddings row shape

```typescript
interface SessionEmbeddingRow {
  session_id:   string    // UUID FK → training_log.id
  user_id:      string    // UUID FK → auth.users.id
  embedding:    string    // pgvector literal "[0.12,-0.03,...]" (1536 floats)
  content_hash: string    // SHA-256 hex of content text
  created_at:   string    // ISO timestamp
}
```

### match_sessions_for_user RPC input/output

```typescript
// Input
interface MatchSessionsParams {
  p_embedding:  number[]   // 1536-float query vector
  k:            number     // default 10
}

// Output row
interface SessionMatch {
  session_id:   string
  date:         string
  type:         string
  duration_min: number | null
  tss:          number | null
  rpe:          number | null
  notes:        string | null
  similarity:   number   // cosine similarity [0, 1]
}
```

### RAG context format (injected into system prompt)

```
[S1] date:2026-04-10 type:Run duration:60min TSS:78 RPE:7 notes:"felt strong..."
[S2] date:2026-04-08 type:Ride duration:90min TSS:95 RPE:6 notes:""
...up to [S10]
```

### Invariants

1. Embedding vector MUST be exactly 1536 floats (text-embedding-3-small output).
2. RAG is optional (`rag: true` in ai-proxy request); failure is non-fatal.
3. If `match_sessions_for_user` returns 0 rows, ai-proxy proceeds without context.
4. Citations array is always returned, even if empty.
5. Sessions with `content_hash` unchanged since last embed are NOT re-embedded.

---

## C4 — pgmq queue message shapes

**Producer:** Various SQL RPC enqueue functions and edge functions  
**Consumer:** ai-batch-worker, push-worker, strava-backfill-worker  

### Queue: `ai_batch`

```typescript
interface AiBatchMessage {
  coach_id:     string          // UUID of the coach whose squad to digest
  week_start:   string          // ISO date (Monday), e.g. "2026-04-14"
  coach_name?:  string          // optional display name for logging
  retry_count?: number          // 0 if first attempt
  retried_at?:  string          // ISO timestamp of last retry
  last_error?:  string          // error message from previous attempt
}
```

### Queue: `ai_batch_dlq`

```typescript
interface AiBatchDlqMessage extends AiBatchMessage {
  dlq_reason:  string    // why it was moved to DLQ
  moved_at:    string    // ISO timestamp
  read_ct:     number    // how many times it was read before DLQ
}
```

### Queue: `push_fanout`

```typescript
// Forwarded verbatim to send-push edge function
interface PushFanoutMessage {
  user_id:    string          // recipient
  title:      string
  body:       string
  kind:       string          // notification_log.kind value
  route?:     string          // e.g. "/profile", "/log"
  data?:      Record<string, unknown>
}
```

### Queue: `strava_backfill`

```typescript
interface StravaBackfillMessage {
  user_id:        string    // athlete UUID
  access_token:   string    // current Strava access token
  athlete_id?:    string    // Strava athlete ID
  page?:          number    // Strava activities page (default 1)
  activity_count?: number   // cumulative activities synced
}
```

### Queue: `embed_backfill`

```typescript
interface EmbedBackfillMessage {
  session_id: string    // UUID of training_log row to embed
  user_id:    string    // owner UUID
}
```

### pgmq reader response (all queues)

```typescript
interface PgmqReadRow {
  msg_id:      bigint
  read_ct:     number
  enqueued_at: string   // ISO timestamp
  message:     Record<string, unknown>   // queue-specific shape above
}
```

### Invariants

1. `ai_batch` messages MUST contain `coach_id` (UUID string) and `week_start` (ISO date).
2. `push_fanout` messages are forwarded verbatim — consumer must not mutate them.
3. Failed messages remain in queue until VT expires (30s for push_fanout, 120s for strava_backfill).
4. After 3 read_ct failures, ai_batch moves to DLQ and records in `batch_errors`.
5. `embed_backfill` queue currently has no scheduled worker — consumed only by `backfill_embeddings.ts` script.

---

## C5 — generate-report data bundles → PDF template inputs

**Producer:** `fetchWeeklyData`, `fetchMonthlySquadData`, `fetchRaceReadinessData`  
**Consumer:** `WeeklyAthleteReport`, `MonthlySquadReport`, `RaceReadinessReport` (react-pdf templates)  

### WeeklyReportData

```typescript
interface WeeklyReportData {
  athlete:  { display_name: string; email: string }
  weekStart: string        // "YYYY-MM-DD" (Monday)
  weekEnd:   string        // "YYYY-MM-DD" (Sunday)
  metrics: {
    ctl:              number    // from mv_ctl_atl_daily.ctl_42d
    atl:              number    // from mv_ctl_atl_daily.atl_7d
    tsb:              number    // computed: ctl_42d - atl_7d
    weekTss:          number
    sessionsCount:    number
    totalDurationMin: number
    avgRpe:           number | null
  }
  sessions:  Array<{ date: string; type: string; duration_min: number | null; tss: number | null; rpe: number | null; notes?: string | null }>
  insights:  Array<{ kind: string; content: string; created_at: string }>
  suggestedFocus?: string
}
```

### MonthlySquadData / AthleteMonthlyData

```typescript
interface AthleteMonthlyData {
  athlete_id:    string
  display_name:  string
  ctl:           number    // from mv_ctl_atl_daily.ctl_42d
  atl:           number    // from mv_ctl_atl_daily.atl_7d
  tsb:           number    // computed: ctl_42d - atl_7d
  weeklyTss:     number[]  // 4 entries, oldest first
  sessionsCount: number
  plannedSessions?: number
  flags:         string[]  // e.g. ['High ACWR (overload risk)', 'Injury logged: knee strain']
}

interface MonthlySquadData {
  coach:      { display_name: string }
  month:      string        // "YYYY-MM"
  monthStart: string
  monthEnd:   string
  athletes:   AthleteMonthlyData[]
}
```

### RaceReadinessData

```typescript
interface RaceReadinessData {
  athlete:       { display_name: string }
  race:          { name: string; date: string; distance_km: number; sport: string }
  predictedTime:  string | null
  predictionBasis?: string
  taperStatus:   'fresh' | 'trained' | 'fatigued' | 'unknown'
  readinessScore: number     // 0–100
  metrics:       { ctl: number; atl: number; tsb: number }
  recentSessions: Array<{ date: string; type: string; duration_min: number | null; tss: number | null; notes?: string | null }>
  injuryFlags:   string[]
  taperPlan?:    string
  daysToRace:    number
}
```

### MV column mapping (critical — fixed in v8.0.1)

| Report field | MV column | Notes |
|---|---|---|
| `ctl` | `mv_ctl_atl_daily.ctl_42d` | Was wrongly mapped to `.ctl` (undefined) |
| `atl` | `mv_ctl_atl_daily.atl_7d` | Was wrongly mapped to `.atl` (undefined) |
| `tsb` | computed `ctl_42d - atl_7d` | MV has no tsb column |

### Invariants

1. `avgRpe` is `null` when no sessions have RPE data — never NaN.
2. `ctl`, `atl`, `tsb` default to 0 when MV row not found.
3. `weeklyTss` always has exactly 4 entries (one per week bucket).
4. `injuryFlags` is always an array (may be empty).
5. `predictedTime` is null when no previous race result exists.

---

## C6 — search_everything RPC → SearchPalette

**Producer:** `public.search_everything(q text, limit_per_kind int)` in Postgres  
**Consumer:** `src/components/SearchPalette.jsx`  

### RPC return shape

```typescript
interface SearchResult {
  kind:       'session' | 'athlete_session' | 'note' | 'message' | 'announcement' | 'athlete'
  record_id:  string    // UUID cast to text
  rank:       number    // ts_rank_cd result
  snippet:    string    // left(content_column, 150)
  date_hint:  string | null
}
```

### SearchPalette mapping

```typescript
// For each result:
{
  id:      `db-${r.kind}-${r.record_id}`,
  name:    r.snippet || `${r.kind} result`,   // fallback when snippet is ''
  desc:    `${KIND_LABEL[r.kind] || r.kind} · ${r.date_hint || ''}`,
  tab:     KIND_TAB[r.kind] || 'log',
  _dbKind: r.kind,
  _dbId:   r.record_id,
}
```

### KIND_TAB mapping

| kind | tab | color |
|---|---|---|
| `session` | `log` | `#5bc25b` |
| `athlete_session` | `log` | `#2dd4bf` (new in v8.0.1) |
| `note` | `coach` | `#ff6600` |
| `message` | `coach` | `#0064ff` |
| `announcement` | `coach` | `#f5c542` |
| `athlete` | `coach` | `#a78bfa` |

### Access control (SECURITY INVOKER)

| Caller role | 'session' | 'athlete_session' | 'note' | 'message' | 'announcement' | 'athlete' |
|---|---|---|---|---|---|---|
| Athlete | own sessions only | ✗ | own notes | own threads | if on a squad | ✗ |
| Coach | own sessions | squad athletes' sessions (v8.0.1) | own notes + written about athletes | own threads | own + if on squad | own squad |

### Invariants

1. RPC is SECURITY INVOKER — auth.uid() must be set (requires valid JWT).
2. `snippet` may be empty string when the matched column has no content.
3. `rank` is always a positive float when returned (non-matching rows excluded by @@ predicate).
4. `limit_per_kind` caps each arm independently — total results can be up to `6 × limit_per_kind`.

---

## C7 — mv_squad_readiness → get_squad_overview → CoachDashboard

**Producer chain:**
1. `mv_squad_readiness` (MV, refreshed every minute if pending)
2. `public.get_squad_overview(p_coach_id uuid)` SQL function
3. `supabase/functions/squad-sync/index.ts`

**Consumer:** `src/components/CoachDashboard.jsx` (via CoachSquadView + squad-sync)  

### get_squad_overview return shape

```typescript
interface AthleteOverview {
  athlete_id:          string    // UUID
  display_name:        string
  today_ctl:           number    // from sr.ctl_42d
  today_atl:           number    // from sr.atl_7d
  today_tsb:           number    // ctl_42d - atl_7d
  acwr_ratio:          number    // atl / ctl, null-safe (0 when ctl=0)
  acwr_status:         'low' | 'caution' | 'optimal' | 'danger'
  last_hrv_score:      number | null
  last_session_date:   string | null   // ISO date
  missed_sessions_7d:  number
  training_status:     'Overreaching' | 'Detraining' | 'Building' | 'Peaking' | 'Recovering' | 'Maintaining'
  adherence_pct:       number    // 0–100
}
```

### Refresh trigger chain

```
recovery INSERT/UPDATE  ─┐
                          ├──► fn_request_squad_refresh()
injuries INSERT/UPDATE  ─┘      └──► mv_refresh_pending UPSERT
                                       └──► maybe_refresh_squad_mv() (pg_cron, every 1 min)
                                              └──► REFRESH MATERIALIZED VIEW CONCURRENTLY mv_squad_readiness
```

### Invariants

1. `today_ctl`, `today_atl`, `today_tsb` are 0 (not null) when no training history.
2. `acwr_status` is always one of the four strings above.
3. `training_status` is always one of the six strings above.
4. MV refresh is asynchronous — data may be up to 1 minute stale after a recovery/injury insert.
5. `get_squad_overview` returns 0 rows if the coach has no active athletes.

---

## C8 — activity_upload_jobs status machine → UploadActivity

**Producer:** `supabase/functions/parse-activity/index.ts`  
**Consumer:** `src/components/UploadActivity.jsx` (realtime subscription on postgres_changes)  

### activity_upload_jobs row shape

```typescript
interface ActivityUploadJob {
  id:               string    // UUID primary key
  user_id:          string    // owner UUID
  file_path:        string    // Storage path
  file_name:        string
  file_type:        'fit' | 'gpx'
  file_size:        number
  status:           ActivityUploadStatus
  parsed_session_id?: string  // UUID, set when status='done'
  error?:           string    // set when status='error'
  parsed_at?:       string    // ISO timestamp, set when status='done'
  created_at:       string
}

type ActivityUploadStatus = 'pending' | 'parsing' | 'done' | 'error' | 'uploaded' | 'parsed' | 'failed'
```

### Status machine

```
[client]  pending
             │
[parse-activity] parsing
             │
       ┌─────┴──────┐
      done         error
  (parsed_session_id set)  (error set)
```

### Client-visible status values

| Status | UploadActivity behaviour |
|---|---|
| `pending` | Initial insert by client — shows spinner |
| `parsing` | parse-activity started — shows "Parsing…" |
| `done` | Success — calls `onSuccess(parsed_session_id)` |
| `error` | Failed — shows `updated.error` or "Parse error" |
| `uploaded` | Legacy/unused — client shows spinner (default) |
| `parsed` | Legacy alias for `done` — client shows spinner (bug: not handled) |
| `failed` | Legacy alias for `error` — client shows spinner (bug: not handled) |

### Invariants

1. `parsed_session_id` is only set when `status = 'done'`.
2. `error` field is only set when `status = 'error'`.
3. Realtime channel filter is `id=eq.{jobId}` — only updates for the specific job arrive.
4. `onSuccess(parsed_session_id)` is called exactly once on `status = 'done'`.
5. Client subscribes to `UPDATE` events only (not INSERT/DELETE).

---

## Cross-block dependency graph

```
training_log INSERT
    │
    ├──[webhook]──► analyse-session ──[fire-and-forget]──► embed-session (insight_only)
    │                    │                                      │
    │                    └──► ai_insights                       └──► insight_embeddings
    │
    └──[webhook]──► embed-session ──► session_embeddings
                                           │
                                  ai-proxy (RAG) ◄── user query

pgmq queues:
  enqueue-ai-batch ──► [ai_batch queue] ──► ai-batch-worker
  trigger-checkin  ──► [push_fanout]    ──► push-worker ──► send-push
  strava-oauth     ──► [strava_backfill]──► strava-backfill-worker

MV chain:
  training_log ──► ctl_daily_cache (trigger)
  recovery/injuries ──► mv_refresh_pending ──► mv_squad_readiness (pg_cron)
  mv_squad_readiness ──► get_squad_overview ──► squad-sync ──► CoachDashboard

Reports:
  fetchWeeklyData / fetchMonthlySquadData / fetchRaceReadinessData
      ──► mv_ctl_atl_daily (ctl_42d, atl_7d — no tsb column!)
      ──► PDF templates (WeeklyAthleteReport, MonthlySquadReport, RaceReadinessReport)

FTS:
  training_log.notes_tsv / coach_notes.note_tsv / etc.
      ──► search_everything(q) ──► SearchPalette
```
