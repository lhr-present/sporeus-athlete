# Realtime Runbook — E11

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
