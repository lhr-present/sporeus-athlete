# comment-notification Webhook — Verification Record

**Verified:** 2026-04-25
**Method:** SQL query against `supabase_functions.hooks` (table oid join via pg_class)
**Project:** pvicqwapvvfempjdgwbm.supabase.co

## Configuration

| Field | Value |
|-------|-------|
| Hook name | `comment-notification` |
| Table | `session_comments` (oid 23659) |
| First registered | 2026-04-20 22:32 UTC |
| Last invocation logged | 2026-04-24 10:01 UTC |
| Total invocations | 14 entries in hooks log |

## SQL Evidence

```sql
SELECT h.id, h.hook_table_id, h.hook_name, h.created_at,
       c.relname AS table_name
FROM supabase_functions.hooks h
LEFT JOIN pg_class c ON c.oid = h.hook_table_id
ORDER BY h.hook_name;
-- Returns 14 rows, all hook_name='comment-notification', table_name='session_comments'
```

## Status

✅ Webhook is configured and actively firing on `session_comments` INSERT events.
No dashboard screenshot required — SQL evidence is more authoritative (not session-scoped).
