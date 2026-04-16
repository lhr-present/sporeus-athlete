# Observability — Sporeus Athlete Console

## What we send to Sentry

| Category | Fields sent | Example |
|---|---|---|
| Error identity | Error message, stack trace | `"[useAuth] profile fetch: ..."` |
| Release | Version string | `sporeus-athlete@7.26.0` |
| Environment | `production` / `development` | `production` |
| User identity | **UUID only** (`id` field) | `{ id: "3fa85f64-..." }` |
| Breadcrumbs | Category, message, scrubbed data | `{ category: "auth", message: "signed in" }` |
| Request context | URL **without query string** | `https://app.sporeus.com/` |
| ACWR/CTL/TSB values | Numeric metrics only | `{ acwr: 1.3 }` |
| Error codes | Supabase/HTTP codes | `{ code: "PGRST116" }` |

Query strings are stripped from all URLs before transmission. Invite codes (`?invite=SP-...`) and referral codes never reach Sentry.

## What we never send

- **Email addresses** — scraped from all context objects by `scrubData()` before transmission. Also scrubbed defensively in `beforeSend`.
- **Display names / full names** — fields named `name`, `display_name`, `full_name`, `username` are filtered.
- **Phone numbers** — filtered by key name.
- **Training data content** — log entries, recovery scores, HRV values, power data, TSS history. Counts and aggregates (e.g. `total_sessions: 3`) are fine; individual entries are not.
- **Body metrics** — weight, FTP, VO2max, threshold values.
- **Location data** — GPS coordinates, city, IP address.
- **Session recordings** — `replaysSessionSampleRate: 0` and `replaysOnErrorSampleRate: 0`. We never record user sessions.

## Adding new breadcrumbs safely

Use the wrapper from `src/lib/sentry.js`:

```js
import { addBreadcrumb } from '../lib/sentry.js'

// OK: non-PII identifiers and counts
addBreadcrumb('invite', 'code redeemed', { coachId: coachId, status: 'ok' })

// NOT OK: anything a user typed, any health data
// addBreadcrumb('profile', 'updated', { weight: profile.weight }) ← forbidden
```

Rule: if in doubt, omit the `data` argument entirely.

## How Sentry is loaded

Sentry uses **dynamic import** (`await import('@sentry/react')`) after first paint. It never appears in the main JavaScript bundle. If `VITE_SENTRY_DSN` is not set, `initSentry()` returns immediately — the app works identically with Sentry off.

## Sentry retention and GDPR

Sentry retains error events for 90 days by default (free tier). Users who want their error events deleted should contact support with their user UUID — we do not hold a direct mapping to email (we only send UUIDs to Sentry). Sentry's data retention and deletion policy is documented at [sentry.io/privacy](https://sentry.io/privacy/).

If a user submits a GDPR deletion request, use the Sentry dashboard to search by user `id` (UUID) and delete matching events. This is a manual step.

## Sample rates

| Metric | Value | Rationale |
|---|---|---|
| `tracesSampleRate` (production) | `0.1` | 10% of transactions — sufficient signal, low noise |
| `tracesSampleRate` (development) | `0` | No traces sent from dev |
| `replaysSessionSampleRate` | `0` | Session recordings disabled — athlete health data |
| `replaysOnErrorSampleRate` | `0` | Same |

## Ignored errors

These are suppressed as noise:
- `ResizeObserver loop` browser warnings
- `Failed to fetch` / `NetworkError` / `AbortError` — expected on mobile
- `Load failed` — expected on poor connections
