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

## Intelligence Engine (v4.3+v4.4)
- src/lib/intelligence.js — pure functions, no React imports
- analyzeLoadTrend, analyzeRecoveryCorrelation, analyzeZoneBalance, predictInjuryRisk, predictFitness, scoreSession
- generateWeeklyNarrative, detectMilestones (v4.4)
- src/lib/scienceNotes.js — 40+ triggered science facts, bilingual, getTriggeredNotes(log, recovery, profile, shownIds)
- Dashboard cards: TRAINING INSIGHTS, THIS WEEK'S STORY, DID YOU KNOW?, milestone overlays (3.5s auto-dismiss)
- Profile: training age dropdown + CTL fitness scale visual

## Pattern Recognition (v4.5)
- src/lib/patterns.js — 5 pure personalized pattern functions (no React)
- correlateTrainingToResults: pairs test results with 4-week preceding training blocks
- findRecoveryPatterns: optimal readiness/sleep range from athlete's own session history
- mineInjuryPatterns: 14-day pre-injury window analysis (volume spike, consec hard days, low readiness)
- findOptimalWeekStructure: scores Mon-Sun weeks, clusters top 25%, extracts day-by-day pattern
- findSeasonalPatterns: groups by month, requires 3+ months span
- Dashboard: YOUR PATTERNS card (HIGH/MODERATE/LOW confidence badges), proactive RED injury alert
- PlanGenerator: "BASED ON YOUR DATA" card with optimal week visual + "Use This Pattern" button
- CoachDashboard: PATTERNS section with confidence badges + Copy Patterns button

## Race Readiness & Performance Prediction (v4.6)
- intelligence.js additions: computeRaceReadiness, predictRacePerformance
- computeRaceReadiness: 10-factor weighted composite 0-100 → A+ through F grade
  - Factors: FITNESS(20%), FRESHNESS(15%), TAPER(10%), CONSISTENCY(10%), RECOVERY(10%),
             SLEEP(8%), INJURY(8%), COMPLIANCE(7%), ZONES(7%), LONG_SESSION(5%)
- predictRacePerformance: CTL-adjusted Riegel (exp=1.06+0.001×max(0,70-CTL)), LT pace, VDOT/Daniels, training pace
- Dashboard: SVG ring gauge (strokeDasharray/strokeDashoffset), factor breakdown, Race Week Mode (≤7 days: taper checklist), Post-Race Analysis
- Race results stored in 'sporeus-race-results' localStorage key
- CoachDashboard: RACE BRIEF section (score, predicted time, top concerns + action items, Copy Brief button)
