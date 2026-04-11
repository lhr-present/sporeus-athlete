# Sporeus Athlete Console — CLAUDE.md
## Quick Start
```bash
cd ~/sporeus-athlete-app
npm run dev        # local dev server → http://localhost:5173/sporeus-athlete/
npm test           # run 84 unit tests (vitest)
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
| `src/lib/storage.js` | Schema v3, exportAllData, importAllData, importPlanData |
| `src/lib/intelligence.js` | 11 pure analysis functions (CTL, ACWR, race readiness, etc.) |
| `src/lib/patterns.js` | 5 pure personalized pattern detectors |
| `src/lib/validate.js` | Input sanitization (sanitizeLogEntry, sanitizeProfile, etc.) |
| `src/lib/fetch.js` | safeFetch() — 10s timeout + 2-retry exponential backoff |
| `src/lib/strava.js` | Strava OAuth client helpers (token exchange via edge function) |
| `src/components/ui.jsx` | Shared SVG chart primitives (ZoneBar, TSSChart, CTLTimeline, etc.) |

## Conventions
- All styles inline via S.{} from styles.js — no CSS files
- Dark mode via CSS variables: --bg, --text, --card-bg, --border, --muted, --surface, --input-bg
- Bilingual: always use t('key') from LangCtx, add EN+TR strings to LABELS in LangCtx.jsx
- useLocalStorage(key, default) for all persistent state
- localStorage keys: all prefixed `sporeus-` or `sporeus_` (log uses underscore)
- New tabs: add to TABS array in LangCtx.jsx, add route in App.jsx, wrap in `<ErrorBoundary>`
- External HTTP calls: use `safeFetch` from `src/lib/fetch.js` — never raw `fetch()`

## Build + Deploy
```bash
cd ~/sporeus-athlete-app
npm run build          # verify clean build first
git add -A && git commit -m "vX.X: description"
git push               # triggers GitHub Actions: npm test → npm build → deploy Pages
```

## Adding a New Tab
1. Create `src/components/MyTab.jsx` — `export default function MyTab({ ...props })`
2. Add tab entry to TABS in `src/contexts/LangCtx.jsx`
3. Add EN+TR label strings to LABELS
4. Import and render in `src/App.jsx` inside `<ErrorBoundary>`
5. Pass needed props (log, profile, etc.)

## Testing
```bash
npm test              # run all tests (vitest run)
npm run test:watch    # interactive watch mode
```
Test files: `src/lib/*.test.js` — pure function tests only (no React, no DOM).
Target: keep all 84+ tests green before every commit.

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
- Lazy-loaded: CoachDashboard, CoachOverview, PlanGenerator, Glossary (React.lazy + Suspense)
- `CTLTimeline` wrapped in `memo()`; `WeeklyVolChartMemo` + `ZoneDonutMemo` available from ui.jsx
- Main bundle ~375 KB gzip (1308 KB raw); PWA precaches 29 assets

## Supabase Backend (All Complete ✓)
- Project: `pvicqwapvvfempjdgwbm.supabase.co`
- Edge functions: `strava-oauth` (connect/sync/disconnect), `send-push` (VAPID push)
- Migrations in `supabase/migrations/`: 001 (initial schema), 002 (Strava tokens), 003 (coach_plans)
- Manual step done: `coachLevelOverride TEXT` column added to `coach_athletes`

## Known Limitations
- Strava OAuth: code is single-use + 5-min expiry; if edge function crashes, user must retry
- W' exhaustion check requires CP + W' saved in profile (from Protocols → CP Test)
- Push notifications: iOS requires iOS 16.4+ and PWA installed to home screen
- Guest mode: all data in localStorage — lost on browser clear; nudge fires after 30d or 50 sessions
- Coach messaging is file-based (JSON export/import) — not real-time
