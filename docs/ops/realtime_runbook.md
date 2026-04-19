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

1. Supabase Dashboard → Database → Webhooks → Create Webhook
2. Name: `comment-notification`
3. Table: `public.session_comments`
4. Events: `INSERT`
5. Webhook URL: `https://<project>.supabase.co/functions/v1/comment-notification`
6. HTTP Headers:
   - `Authorization: Bearer <service_role_key>`
   - `Content-Type: application/json`
7. Test with a manual comment insert; verify push arrives within 5s

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
