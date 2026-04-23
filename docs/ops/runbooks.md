# Sporeus Operations Runbooks

## How to Handle a KVKK/GDPR Deletion Inquiry

A user contacts you (email, social) requesting account deletion under KVKK Art.11 or GDPR Art.17.

### 1. If the user has app access (self-service)

Direct them to: **Profile → Data & Privacy → "Delete my account"**

- This inserts a `data_rights_requests` row with `kind='deletion'`, `status='pending'`, `scheduled_purge_at = now() + 30 days`.
- The `purge-deleted-accounts` cron job runs daily at 04:00 UTC and processes all due requests.
- The user can cancel from the same screen until the grace period ends.

### 2. If the user cannot access their account

Run the following SQL via Supabase Dashboard → SQL Editor (service role):

```sql
-- Step 1: Find the user
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Step 2: Schedule deletion (30-day grace)
INSERT INTO public.data_rights_requests (user_id, kind, status, scheduled_purge_at)
VALUES (
  '<user_uuid>',
  'deletion',
  'pending',
  now() + INTERVAL '30 days'
);

-- Step 3: Confirm it was inserted
SELECT id, status, scheduled_purge_at FROM public.data_rights_requests
WHERE user_id = '<user_uuid>' AND kind = 'deletion';
```

The cron job will pick it up within 24 hours after the grace period ends.

### 3. If immediate deletion is required (regulatory order / court order)

```sql
-- Immediate purge (bypasses grace period)
SELECT public.purge_user('<user_uuid>');
```

Then delete the auth user:
```bash
# Via Supabase CLI (requires service role)
supabase auth admin delete-user <user_uuid> --project-ref pvicqwapvvfempjdgwbm
```

Or via Supabase Dashboard → Authentication → Users → Delete.

### 4. Verify purge completion

```sql
SELECT
  u.email,
  drr.status,
  drr.completed_at,
  drr.notes
FROM public.data_rights_requests drr
LEFT JOIN auth.users u ON u.id = drr.user_id
WHERE drr.user_id = '<user_uuid>'
ORDER BY drr.requested_at DESC
LIMIT 5;
```

After a successful purge, `auth.users` row is gone and all app tables return 0 rows for that `user_id`.

---

## How to Handle a KVKK/GDPR Export Inquiry

### Self-service (preferred)

Direct user to: **Profile → Data & Privacy → "Export my data"**

This calls the `export-user-data` edge function which:
1. Calls `build_user_export()` SQL function
2. Uploads JSON to `user-exports` bucket
3. Returns a 7-day signed download URL

### Manual export

```sql
SELECT public.build_user_export('<user_uuid>');
```

Copy the returned JSON and email it to the user.

---

## Cron Job: purge-deleted-accounts

- **Schedule:** `0 4 * * *` (daily 04:00 UTC)
- **Function:** `supabase/functions/purge-deleted-accounts`
- **Processes:** `data_rights_requests WHERE kind='deletion' AND status='pending' AND scheduled_purge_at <= now()`
- **Limit:** 20 accounts per run (prevents timeout)
- **On error:** Sets `status='failed'`, notes contain error message, continues to next

To check job status:
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'purge-deleted-accounts';
```

To inspect recent runs:
```sql
SELECT * FROM cron.job_run_details WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'purge-deleted-accounts'
) ORDER BY start_time DESC LIMIT 10;
```

---

## Storage: user-exports bucket

- Bucket: `user-exports` (private)
- Path pattern: `user-{user_id}/{iso_timestamp}.json`
- Signed URL TTL: 7 days
- File cleanup: Files are deleted during `purge_user()` when the account is erased

To manually clean up stale exports:
```bash
# List files older than 30 days
npx supabase storage ls user-exports --project-ref pvicqwapvvfempjdgwbm
```
