# Sporeus Athlete Console — CLAUDE.md

## Architecture Overview
React 18 + Vite 6 + vite-plugin-pwa (Workbox). Single-page PWA deployed to GitHub Pages via GitHub Actions.
Bloomberg Terminal aesthetic: IBM Plex Mono, #ff6600 orange, #0064ff blue, #0a0a0a dark header.

## Key Files
- `src/App.jsx` — thin router, top-level state (log, profile, lang, dark, onboarded), SW update banner
- `src/styles.js` — S{} styles object, ANIM_CSS with CSS variables for light/dark themes
- `src/contexts/LangCtx.jsx` — LABELS (EN/TR), TABS array, t() translation helper
- `src/hooks/useLocalStorage.js` — localStorage read/write with QuotaExceededError guard
- `src/lib/constants.js` — all pure data (zones, session types, glossary terms, plan phases)
- `src/lib/formulas.js` — all pure math (TSS, zones, VO2max, Riegel, generatePlan, normTR, etc.)
- `src/lib/storage.js` — versioned schema v3, exportAllData, importAllData, importPlanData
- `src/components/ui.jsx` — shared SVG chart primitives (ZoneBar, TSSChart, CTLTimeline, etc.)

## Conventions
- All styles inline via S.{} from styles.js — no CSS files
- Dark mode via CSS variables: --bg, --text, --card-bg, --border, --muted, --surface, --input-bg
- Bilingual: always use t('key') from LangCtx, add EN+TR strings to LABELS in LangCtx.jsx
- useLocalStorage(key, default) for all persistent state
- localStorage keys: all prefixed sporeus- or sporeus_ (log uses underscore)
- New tabs: add to TABS array in LangCtx.jsx, add route in App.jsx, wrap in <ErrorBoundary>
- New calculators: add as sub-components inside relevant tab component

## Build + Deploy
```bash
cd ~/sporeus-athlete-app
npm run build          # verify clean build
git add -A && git commit -m "vX.X: description"
git push               # triggers GitHub Actions deploy
```

## Adding a New Tab
1. Create `src/components/MyTab.jsx` — export default function MyTab({ ...props })
2. Add tab entry to TABS in `src/contexts/LangCtx.jsx`
3. Add EN+TR label strings to LABELS
4. Import and render in `src/App.jsx` inside `<ErrorBoundary>`
5. Pass needed props (log, profile, etc.)

## Adding a Calculator
Add as a named function component inside the relevant tab file (e.g., ZoneCalc.jsx).
Render at the bottom of the tab's return JSX. No new file needed for a calculator.

## Testing Checklist
- [ ] npm run build passes clean
- [ ] Dark mode: toggle in Profile, all cards readable
- [ ] TR/EN: switch in header, all labels translate
- [ ] Mobile: narrow viewport, no horizontal scroll
- [ ] New feature: works with empty log (no crashes)

## Security Rules (MUST READ)
- NEVER add API keys, tokens, or secrets to any source file
- sporeus.com REST API is public read-only — no auth needed
- All future integrations (Strava, Supabase, Claude API) must use env vars only
- .env is gitignored — never commit it
- Before every push: `grep -rn "API_KEY\|SECRET\|TOKEN\|sk-\|pk_" src/` — verify only cache key hits, no real credentials
- User data stays in localStorage only — zero server-side storage
- GitHub repo is PRIVATE, GitHub Pages is PUBLIC (requires GitHub Pro or public repo)
- The const named API_KEY in formulas.js is a localStorage cache key name — not a real API key
- SPOREUS_SALT and MASTER_SALT in formulas.js are hardcoded salts for coach invite system — acceptable for v1 (no auth server)

## Coach Gating (v4.1)
- Coach registration: name + email → SHA-256 → SP-XXXXXXXX via `generateCoachId()` in formulas.js
- Free limit: 3 connected athletes (FREE_ATHLETE_LIMIT)
- Unlock: SPUNLOCK-{id}-{limit}-{hash} code verified by `verifyUnlockCode()`
- Admin generator: visible only when profile.name contains 'Hüseyin'/'Huseyin' or email is huseyinakbulut@marun.edu.tr
- Coach profile stored in 'sporeus-coach-profile' localStorage key
- Backward compat: ?coach=huseyin-sporeus still accepted in App.jsx

## Validation (v4.2)
- src/lib/validate.js: sanitizeString, sanitizeNumber, sanitizeDate, sanitizeLogEntry, sanitizeProfile
- All user inputs go through validation before localStorage write
- TrainingLog uses sanitizeLogEntry on every add/edit
- Profile uses sanitizeProfile on save
- ErrorBoundary: enhanced with Export Data button, Technical Details collapsible, tab name display
- Glossary: 5-min rate limit between fetches (RATE_KEY), fetchWithRetry with exponential backoff
- Dashboard: BackupReminder at 50+ entries, 30-day snooze
- Profile: storage monitor shows sporeus-* key usage vs 5MB limit

## Lazy Loading (v4.2)
- CoachDashboard, PlanGenerator, Glossary are React.lazy() chunks in App.jsx
- Wrapped in <Suspense fallback={<LazyFallback/>}> with ErrorBoundary
- Main bundle reduced; heavy tabs only load on first open
