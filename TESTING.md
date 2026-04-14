# Testing Guide

## Unit Tests (fast, no external deps)

```bash
npm test           # run all 860 unit tests
npm run test:watch # interactive watch mode
```

All unit tests live in `src/lib/*.test.js`. They run against pure functions only — no React, no DOM, no network.

## E2E Smoke Tests (requires Supabase test project)

E2E tests in `tests/e2e/` verify RLS policies and edge functions against a **real** Supabase project.

### Required environment variables

| Variable | Description |
|---|---|
| `SUPABASE_TEST_URL` | Test project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_TEST_ANON_KEY` | Anon/public key for the test project |
| `SUPABASE_TEST_SERVICE_KEY` | Service role key (needed for direct DB ops if required) |
| `SUPABASE_TEST_ATHLETE_A` | Email of a pre-created athlete-A test user |
| `SUPABASE_TEST_ATHLETE_A_PW` | Password for athlete-A |
| `SUPABASE_TEST_ATHLETE_B` | Email of athlete-B (different org from A) |
| `SUPABASE_TEST_ATHLETE_B_PW` | Password for athlete-B |
| `SUPABASE_TEST_COACH` | Email of a coach user |
| `SUPABASE_TEST_COACH_PW` | Password for the coach |

### One-time setup — create test users

1. In your Supabase test project dashboard → **Authentication → Users → Add User**
2. Create: `athlete-a@test.sporeus.com`, `athlete-b@test.sporeus.com`, `coach@test.sporeus.com`
3. In the SQL editor, assign roles:
   ```sql
   UPDATE profiles SET role = 'athlete', subscription_tier = 'free'
     WHERE id = (SELECT id FROM auth.users WHERE email = 'athlete-a@test.sporeus.com');
   UPDATE profiles SET role = 'athlete', subscription_tier = 'free'
     WHERE id = (SELECT id FROM auth.users WHERE email = 'athlete-b@test.sporeus.com');
   UPDATE profiles SET role = 'coach', subscription_tier = 'coach'
     WHERE id = (SELECT id FROM auth.users WHERE email = 'coach@test.sporeus.com');
   ```
4. Apply all migrations: `supabase db push` (or run each SQL file in the SQL editor)

### Running e2e tests

```bash
# Export env vars (or put in .env.e2e and source it)
export SUPABASE_TEST_URL=https://xxxx.supabase.co
export SUPABASE_TEST_ANON_KEY=eyJ...
export SUPABASE_TEST_ATHLETE_A=athlete-a@test.sporeus.com
export SUPABASE_TEST_ATHLETE_A_PW=<password>
export SUPABASE_TEST_ATHLETE_B=athlete-b@test.sporeus.com
export SUPABASE_TEST_ATHLETE_B_PW=<password>
export SUPABASE_TEST_COACH=coach@test.sporeus.com
export SUPABASE_TEST_COACH_PW=<password>

npm run test:e2e
```

When env vars are absent, all 5 e2e tests are skipped automatically — CI is unaffected.

### What the e2e tests verify

1. **Athlete reads own wellness_log** — RLS `SELECT` policy allows `auth.uid() = user_id`
2. **Athlete-B cannot read athlete-A's data** — cross-user RLS isolation
3. **Coach reads org athletes** — `coach_athletes` RLS allows coach to see their athletes
4. **Coach cannot read other coach's athletes** — cross-org isolation
5. **Free-tier POST to ai-proxy returns error** — unauthenticated request blocked by edge function
