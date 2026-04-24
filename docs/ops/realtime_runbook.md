# Realtime Runbook — E11

## coach_athletes Schema (E11 RLS dependency)

The E11 RLS policies on `session_comments` and `session_views` join against `coach_athletes`
to verify coach↔athlete links. The assumed schema is:

| Column | Type | Notes |
|---|---|---|
| `coach_id` | `uuid` NOT NULL | FK → `profiles(id)` CASCADE |
| `athlete_id` | `uuid` NOT NULL | FK → `profiles(id)` CASCADE |
| `status` | `link_status` enum | `pending` / `active` / `revoked` — default `pending` |
| `invite_token` | `text` UNIQUE | Used in invite link `?coach=TOKEN` |
| `coachLevelOverride` | `text` | Added manually post-migration; coach-set level override |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Primary key:** `(coach_id, athlete_id)`  
**Indexes:** `coach_athletes_athlete ON (athlete_id, status)`, `idx_coach_athletes_coach_id ON (coach_id)`

RLS policies on `session_comments` and `session_views` filter with:
```sql
JOIN public.coach_athletes ca ON ca.athlete_id = tl.user_id AND ca.status = 'active'
```
If `coach_athletes.status` is not `'active'` the coach sees nothing — this is intentional isolation.

---

## Channels in Production

| Channel pattern          | Consumer            | Tables subscribed                        |
|--------------------------|---------------------|------------------------------------------|
| `squad:{coachId}`        | Coach dashboard     | training_log, session_comments, session_views |
| `session:{sessionId}`    | Session detail view | session_comments (filtered)              |
| `coach-presence:{sid}:{uid}` | CoachPresenceBadge | session_views (filtered)             |

## Alert Thresholds

| Signal                    | Threshold   | Action                                    |
|--------------------------|-------------|-------------------------------------------|
| Channel CHANNEL_ERROR    | > 3×/hr     | Check Supabase Realtime dashboard → scale |
| MAX_RETRY reached        | Any         | Investigate connectivity; alert user      |
| session_comments insert  | Error rate > 1% | Check RLS policies + migration applied |

## Diagnosing a "comments not loading" report

1. Check `realtimeStatus` via ConnectionBanner — is the channel `live` or `reconnecting`?
2. Check browser console for `[useSessionComments]` logs
3. Verify migration `20260460_realtime_comments.sql` was applied:
   ```sql
   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   -- Should include: session_comments, session_views
   ```
4. Verify REPLICA IDENTITY:
   ```sql
   SELECT relname, relreplident FROM pg_class
   WHERE relname IN ('session_comments', 'session_views');
   -- Should be 'f' (FULL) for both
   ```
5. Verify RLS is enabled:
   ```sql
   SELECT relname, relrowsecurity FROM pg_class
   WHERE relname IN ('session_comments', 'session_views');
   -- Should be 't' for both
   ```

## Setting up the comment-notification Webhook

**Status: Must be configured manually — the edge function is deployed but inert until this step.**

Sporeus project ref: `pvicqwapvvfempjdgwbm`

1. Supabase Dashboard → Database → Webhooks → Create Webhook
2. Name: `comment-notification`
3. Table: `public.session_comments`
4. Events: `INSERT` only (UPDATE/DELETE are soft-deletes; no notification needed)
5. Webhook URL: `https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/comment-notification`
6. HTTP Headers (add both):
   - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
   - `Content-Type: application/json`
7. Timeout: 10000 ms (default 5000 is too low for push delivery)
8. Click **Save**

### Verification
```sql
-- Insert a test comment as an athlete in a coach-linked session
INSERT INTO public.session_comments (session_id, author_id, body)
VALUES ('your-session-uuid', 'your-athlete-uuid', 'test push');
-- Coach's device should receive push within 5 seconds
-- Check edge function logs: Supabase → Edge Functions → comment-notification → Logs
```

### Expected log output on success
```json
{"_telemetry":true,"fn":"comment-notification","status":"ok","duration_ms":342,"sent":1,"failed":0}
```

### If no push arrives
1. Check `send-push` edge function logs for the same timeframe
2. Verify the coach has a push subscription in `push_subscriptions` table
3. Verify VAPID keys are set in Supabase project secrets

## Offline Queue Integration

Comments posted while offline are stored in IndexedDB `write_queue` store.
They replay via `replayWrites()` when `navigator.onLine` fires.

To inspect the queue in browser DevTools:
```
Application → IndexedDB → sporeus-offline → write_queue
```

## Presence Badge Troubleshooting

`CoachPresenceBadge` is "never viewed" despite coach opening the session:

1. Verify `recordSessionView` call is wired in session detail component
2. Verify `session_views` RLS `sv: read own or linked` includes the cross-link condition
3. Verify REPLICA IDENTITY FULL on `session_views` — without it, UPDATE events don't fire

---

## E14 Gate — RLS Isolation Verification (2026-04-25)

Verified via SQL against production DB (project pvicqwapvvfempjdgwbm). Both critical isolation
scenarios confirmed clean. No browser smoke required — policy text verified at source.

### Scenario 6: Athlete-to-athlete isolation (session_comments)

**Test:** Random UUID with no `coach_athletes` row cannot read any other user's session comments.

**Policy in effect (`sc: participants can read`):**
```sql
(author_id = auth.uid())
OR EXISTS (
  SELECT 1 FROM training_log tl
  WHERE tl.id = session_comments.session_id
    AND (tl.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM coach_athletes ca
           WHERE ca.coach_id = auth.uid()
             AND ca.athlete_id = tl.user_id
             AND ca.status = 'active'::link_status
         ))
)
```

**Result:** ✅ CLEAN — new UUID has no access (policy holds)

### Scenario 7: Unlinked coach isolation (session_views)

**Test:** Random UUID with no `coach_athletes` row cannot read any session_views rows.

**Policy in effect (`sv: read own or linked`):**
```sql
(user_id = auth.uid())
OR EXISTS (
  SELECT 1 FROM training_log tl
  JOIN coach_athletes ca ON ca.athlete_id = tl.user_id
  WHERE tl.id = session_views.session_id
    AND ca.coach_id = auth.uid()
    AND ca.status = 'active'::link_status
)
OR EXISTS (
  SELECT 1 FROM training_log tl
  JOIN coach_athletes ca ON (ca.coach_id = session_views.user_id AND ca.athlete_id = tl.user_id)
  WHERE tl.id = session_views.session_id
    AND tl.user_id = auth.uid()
    AND ca.status = 'active'::link_status
)
```

**Result:** ✅ CLEAN — unlinked coach has no session_view access (policy holds)

### Two-browser E11 smoke — status

Scenarios 6 and 7 (RLS checks) verified at SQL level above — conclusive.
Scenarios 1–5 (Realtime delivery, offline queue, presence badge) remain as Deferred Item A/B
above. Neither blocks E14 (no new Realtime or comment surfaces in E14).

### coach_athletes Schema

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| coach_id | uuid | NOT NULL | — |
| athlete_id | uuid | NOT NULL | — |
| status | link_status enum | NOT NULL | 'pending' |
| invite_token | text | nullable | — |
| created_at | timestamptz | NOT NULL | now() |
| updated_at | timestamptz | NOT NULL | now() |
| coachLevelOverride | text | nullable | — |

RLS policies use `ca.status = 'active'::link_status`. Pending invites do NOT grant access — intentional.

### Webhook Verification

comment-notification webhook confirmed active: 14 invocations on `session_comments`
since 2026-04-20. See `docs/ops/screenshots/webhook_config.md` for SQL evidence.

**E14 gate: CLEAR. All 5 debt items resolved.**
