# Sporeus Athlete Console — CLAUDE.md
## Quick Start
```bash
cd ~/sporeus-athlete-app
npm run dev        # local dev server → http://localhost:5173/
npm test           # run 3886 unit tests (vitest) across 232 test files
npm run build      # production build → dist/
git push           # triggers GitHub Actions: test → build → deploy to Pages
```

## Architecture Overview
React 18 + Vite 6 + vite-plugin-pwa (Workbox injectManifest).
Single-page PWA deployed to GitHub Pages via GitHub Actions.
Bloomberg Terminal aesthetic: IBM Plex Mono, #ff6600 orange, #0064ff blue, #0a0a0a dark header.

## Key Files
| File | Purpose |
|---|---|
| `src/App.jsx` | Thin router, top-level state (log, profile, lang, dark, onboarded), SW update banner, guest nudge |
| `src/styles.js` | S{} styles object, ANIM_CSS, CSS variables for light/dark themes |
| `src/contexts/LangCtx.jsx` | LABELS (EN/TR), TABS array, t() translation helper |
| `src/contexts/DataContext.jsx` | DataProvider, useSyncedTable Supabase sync factory |
| `src/hooks/useLocalStorage.js` | localStorage r/w with QuotaExceededError guard |
| `src/lib/constants.js` | Pure data (zones, session types, glossary terms, plan phases) |
| `src/lib/formulas.js` | Pure math (TSS, W', zones, VO2max, Riegel, generatePlan, etc.) |
| `src/lib/decoupling.js` | Aerobic decoupling (Pw:Hr) — Friel method; computeDecoupling(), classifyDecoupling() |
| `src/lib/storage.js` | Schema v3, exportAllData, importAllData, importPlanData |
| `src/lib/intelligence.js` | 11 pure analysis functions (CTL, ACWR, race readiness, etc.) |
| `src/lib/patterns.js` | 5 pure personalized pattern detectors |
| `src/lib/validate.js` | Input sanitization (sanitizeLogEntry, sanitizeProfile, etc.) |
| `src/lib/fetch.js` | safeFetch() — 10s timeout + 2-retry exponential backoff |
| `src/lib/strava.js` | Strava OAuth client helpers (token exchange via edge function) |
| `src/lib/realtimeBackoff.js` | computeBackoff(attempt, maxMs) — exponential backoff for Realtime reconnect |
| `src/lib/realtimeStatus.js` | reportStatus/removeStatus — global channel health registry |
| `src/lib/realtime/commentActions.js` | postComment/editComment/deleteComment/recordSessionView/getSessionViews |
| `src/lib/realtime/squadChannel.js` | createSquadChannel — 3-table postgres_changes + presence for coach dashboard |
| `src/lib/realtime/presenceFormat.js` | formatViewedAt, presenceBucket, formatPresenceList — bilingual presence labels |
| `src/lib/science/efficiencyFactor.js` | computeEF (Coggan 2003: NP/HR or pace/HR) + efTrend (30d window) |
| `src/lib/science/durabilityScore.js` | computeDurability (Maunder 2021: last-hour 5-min peak vs MMP) |
| `src/lib/science/subThresholdTime.js` | weekSubThresholdMin + subThresholdTrend (Seiler 2010 polarized) |
| `src/lib/athlete/` | **30 pure sport-science wrappers** (cyclingZones, swimZones, runningCV, triLoad, sleepRestingHR, etc.) |
| `src/hooks/useSessionComments.js` | Per-session comment thread — Realtime + optimistic updates + offline queue |
| `src/hooks/useSquadChannel.js` | Coach squad feed hook — wraps squadChannel lifecycle |
| `src/components/ui.jsx` | Shared SVG chart primitives (ZoneBar, TSSChart, CTLTimeline, etc.) |
| `src/components/dashboard/` | **74 dashboard cards** — all lazy-loaded via React.lazy + Suspense fallback={null} |
| `src/components/QuickAddModal.jsx` | One-click session logging from any tab (+ button / FAB) |
| `src/components/TodayView.jsx` | Daily HQ — planned session, readiness, quick wellness, suggestions |
| `src/components/TrainingLog.jsx` | Full log with inline edit, bulk-delete, calendar, semantic search |

## Conventions
- All styles inline via S.{} from styles.js — no CSS files
- Dark mode via CSS variables: --bg, --text, --card-bg, --border, --muted, --surface, --input-bg
- Bilingual: always use t('key') from LangCtx, add EN+TR strings to LABELS in LangCtx.jsx
- useLocalStorage(key, default) for all persistent state
- localStorage keys: all prefixed `sporeus-` or `sporeus_` (log uses underscore)
- New tabs: add to TABS array in LangCtx.jsx, add route in App.jsx, wrap in `<ErrorBoundary>`
- External HTTP calls: use `safeFetch` from `src/lib/fetch.js` — never raw `fetch()`
- New dashboard cards: create `src/lib/athlete/X.js` (pure fn), `src/components/dashboard/XCard.jsx` (JSX), add lazy import in Dashboard.jsx
- Sport gating: use `hasCyclingData`/`hasSwimData`/`hasTriData` useMemos in Dashboard.jsx before rendering sport-specific cards

## Build + Deploy
```bash
cd ~/sporeus-athlete-app
npm run build          # verify clean build first
git add -A && git commit -m "feat(vX.X.X): description"
git push               # triggers GitHub Actions: npm test → npm build → deploy Pages
```

## Adding a New Dashboard Card
1. Create `src/lib/athlete/X.js` — pure functions, no React, fully testable
2. Create `src/components/dashboard/XCard.jsx` — `export default function XCard({ log, profile, ... })`
3. Add `const XCard = lazy(() => import('./dashboard/XCard.jsx'))` in Dashboard.jsx
4. Wrap in `<ErrorBoundary><Suspense fallback={null}><XCard .../></Suspense></ErrorBoundary>` in render
5. Add tests in `src/lib/__tests__/components/X.test.js`

## Adding a New Tab
1. Create `src/components/MyTab.jsx` — `export default function MyTab({ ...props })`
2. Add tab entry to TABS in `src/contexts/LangCtx.jsx`
3. Add EN+TR label strings to LABELS
4. Import and render in `src/App.jsx` inside `<ErrorBoundary>`
5. Pass needed props (log, profile, etc.)

## Testing
```bash
npm test              # run all tests (vitest run) — currently 3886 tests, 232 files
npm run test:watch    # interactive watch mode
```
Test files: `src/lib/*.test.js` + `src/hooks/__tests__/` + `src/lib/__tests__/` — pure functions, hooks (jsdom), realtime, science.
Target: keep all tests green before every commit.

**Do not mock internal libraries.** Tests run against real formulas — mock only at system boundaries (external APIs, localStorage when unavoidable).

## Security Rules (MUST READ)
- NEVER add API keys, tokens, or secrets to any source file
- `sporeus.com` REST API is public read-only — no auth needed
- All integrations (Strava, Supabase) use env vars only; `.env` is gitignored
- Before every push: `grep -rn "SECRET\|TOKEN\|sk-\|pk_live" src/` — verify no credentials
- `API_KEY` in formulas.js is a localStorage cache key name — not a real API key
- `SPOREUS_SALT` and `MASTER_SALT` in formulas.js are hardcoded salts for coach invite — acceptable for v1

## Key Patterns

### Auth (Supabase)
- `flowType: 'implicit'` in supabase.js — required for static/GitHub Pages hosting (no PKCE)
- Listen with `onAuthStateChange` ONLY — never call `getSession()` (Web Locks contention)
- See `src/hooks/useAuth.js`

### Data Sync
- `useSyncedTable(tableName, key)` in DataContext.jsx — bidirectional sync localStorage ↔ Supabase
- Unauthenticated users write to localStorage only; sync activates on sign-in

### Sport Gating in Dashboard
```javascript
const hasCyclingData = useMemo(() =>
  parseFloat(profile?.ftp || 0) > 0 ||
  log.some(e => /bike|cycl|ride/i.test(e.type || '') || /cycl/i.test(e.sport || '')),
  [log, profile])
const hasSwimData = useMemo(() =>
  log.some(e => /swim/i.test(e.type || '') || /swim/i.test(e.sport || '')),
  [log])
const hasTriData = useMemo(() =>
  profile?.primarySport === 'triathlon' ||
  new Set(log.map(e => (e.type || '').split(' ')[0].toLowerCase())).size >= 3,
  [log, profile])
```

### Coach Features (v5.2)
- Coach level override: `sporeus-coach-overrides` localStorage + best-effort `coach_athletes.coachLevelOverride` Supabase
- Message thread: `sporeus-messages-{athleteId}` (coach), `sporeus-coach-messages` (athlete); transport via JSON export
- Week notes: `wk.coachNote + wk.noteTs` in `coach_plans.weeks` JSONB; freshness via `wk.noteTs`
- Plan push: coach saves to `coach_plans` table (RLS); athlete reads via CoachPlansCard in Periodization

### W' Balance (v5.3)
- `computeWPrime(powers, cp, wPrimeMax)` — Skiba 2012 differential model, second-by-second
- FIT import: if CP + W' set in profile, checks for exhaustion → saves `wPrimeExhausted: true` on entry
- Log badge: red `⚡W'0` on any entry where `entry.wPrimeExhausted === true`

### Performance
- **74 dashboard cards** all lazy-loaded via React.lazy + Suspense fallback={null}
- Sport gating prevents irrelevant chunk fetches (cycling/swim/tri cards gated)
- `CTLTimeline` wrapped in `memo()`; `WeeklyVolChartMemo` + `ZoneDonutMemo` available from ui.jsx
- Main bundle ~84 kB gzip; PWA precaches all assets

## Supabase Backend (All Complete ✓)
- Project: `pvicqwapvvfempjdgwbm.supabase.co`
- 40 tables + 3 materialized views, 25 edge functions, 14 pg_cron jobs, 9 pgmq queues
- Edge functions: `strava-oauth` (connect/sync/disconnect), `send-push` (VAPID push)
- Migrations in `supabase/migrations/`: 001–003 (schema, Strava, coach_plans)
- Manual step done: `coachLevelOverride TEXT` column added to `coach_athletes`

## Known Limitations
- Strava OAuth: code is single-use + 5-min expiry; if edge function crashes, user must retry
- W' exhaustion check requires CP + W' saved in profile (from Protocols → CP Test)
- Push notifications: iOS requires iOS 16.4+ and PWA installed to home screen
- Guest mode: all data in localStorage — lost on browser clear; nudge fires after 30d or 50 sessions
- Coach messaging is file-based (JSON export/import) — not real-time

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_STRAVA_CLIENT_ID` | Strava OAuth client ID |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VITE_DODO_CHECKOUT_COACH` | Dodo Payments checkout URL for Coach tier (Turkey) |
| `VITE_DODO_CHECKOUT_CLUB` | Dodo Payments checkout URL for Club tier (Turkey) |
| `VITE_STRIPE_CHECKOUT_COACH` | Stripe checkout URL for Coach tier (international) |

## Version History
- v11.76.0 (2026-04-26): 3886 tests, 232 files, 74 dashboard cards, 30 athlete libs
- v6.7.0 (2026-04-14): Launch-ready, 1084 tests, Supabase 25 tables
- See CHANGELOG.md for full history
