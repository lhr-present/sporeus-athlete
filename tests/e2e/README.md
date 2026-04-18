# Sporeus E2E — Critical Path Tests

Five Playwright tests that cover the five flows where a regression means lost revenue.

| # | Path | What it tests |
|---|------|---------------|
| 1 | `path1-signup-log-session` | New user signup → onboarding → log first session → DB row |
| 2 | `path2-strava-connect` | Strava OAuth connect → token in DB → synced session in log |
| 3 | `path3-upload-fit` | GPX upload → parse-activity → session + TSS + AI insight |
| 4 | `path4-upgrade-invite` | Upgrade gate → coach tier → invite code → athlete redeems |
| 5 | `path5-report-pdf` | Weekly report generation → PDF download → valid %PDF + names |

---

## Prerequisites

### 1. Environment variables

Copy `.env.e2e.example` to `.env.e2e` and fill in:

```bash
# Supabase test branch URL and keys
E2E_SUPABASE_URL=https://xxxx.supabase.co
E2E_SUPABASE_ANON_KEY=eyJ...
E2E_SUPABASE_SERVICE_KEY=eyJ...   # service_role key — bypasses RLS

# App URL (local dev server or tunnel)
PLAYWRIGHT_BASE_URL=http://localhost:5173/
```

> **Never commit `.env.e2e`** — it contains service-role keys.

### 2. Supabase branch requirements

The test branch must have:
- **Email confirmation disabled** — Dashboard → Auth → Email → "Enable email confirmations" = OFF  
  (Otherwise Path 1 signup blocks on email delivery)
- Full schema applied (`supabase db push` or branch creation via CI)
- Seed data applied: `npx supabase db query --linked < supabase/tests/seed-test-data.sql`

### 3. Dev server running

```bash
npm run dev    # starts on :5173
```

---

## Running locally

```bash
# Install browsers (once)
npx playwright install chromium

# Run all 5 critical paths (chromium only, fast)
npx playwright test --project=chromium-e2e

# Run a single path
npx playwright test path1 --project=chromium-e2e

# Headed mode (watch the browser)
npx playwright test path1 --headed --project=chromium-e2e

# UI mode (time-travel debugger)
npx playwright test --ui
```

---

## Flaky-test guardrail

Before landing any change to a spec file, run it 10 consecutive times and confirm 10/10 pass:

```bash
for i in $(seq 1 10); do
  npx playwright test path1 --project=chromium-e2e --reporter=line || exit 1
done
echo "10/10 passed"
```

---

## Performance baseline

Each test appends its wall-clock duration to `tests/e2e/perf-baseline.json`.  
The C4 performance regression check (`.github/workflows/e2e-critical-paths.yml`) reads this file and fails CI if any path exceeds its rolling P95 by >50%.

Acceptable CI durations (P95):

| Path | Acceptable |
|------|-----------|
| Path 1 | ≤ 60 s |
| Path 2 | ≤ 30 s |
| Path 3 | ≤ 45 s |
| Path 4 | ≤ 60 s |
| Path 5 | ≤ 45 s |

Total suite: **≤ 5 min** (paths run in parallel across 5 workers).

---

## Debugging failures

1. **Trace viewer** — failures capture a Playwright trace automatically:
   ```bash
   npx playwright show-trace test-results/*/trace.zip
   ```

2. **Screenshots + video** — saved in `test-results/` on failure.

3. **DB state** — if a test fails partway through, test users may be left in DB.
   Run teardown manually:
   ```bash
   npx tsx tests/e2e/global-teardown.ts
   ```

4. **Common failure: "User should have been created"** — email confirmation is ON in the test branch. Disable it (see Prerequisites §2).

5. **Common failure: "tab not found"** — the app defaulted to Turkish. The `injectSession` helper forces `sporeus-lang = "en"`. If this keeps failing, check that `addInitScript` fires before the page loads (it must be called before `page.goto()`).

---

## Architecture

```
tests/
  fixtures/
    factories.ts        Data builders (users, sessions, webhooks)
    sample.gpx          60-min cycling activity fixture
  e2e/
    helpers/
      auth.ts           injectSession(), signUpViaUI(), clickTab()
      db.ts             Admin Supabase ops (create user, seed, waitForRow)
    global-setup.ts     Creates 3 test users, seeds sessions, writes .e2e-users.json
    global-teardown.ts  Deletes all test users (CASCADE cleans data)
    path1-*.spec.ts     … path5-*.spec.ts
    perf-baseline.json  Rolling timing history (last 10 runs per path)
    README.md           This file
```

External calls that are **mocked** in CI:

| Service | Mock strategy |
|---------|--------------|
| Strava OAuth | `page.route()` intercept → return success JSON |
| Dodo Payments | `page.route()` intercept + direct DB tier update |
| Stripe | `page.route()` intercept |
| parse-activity edge fn | `page.route()` → DB insert + success response |
| generate-report edge fn | `page.route()` → DB insert + signed URL |
| Supabase Storage upload | `page.route()` → 200 OK |
