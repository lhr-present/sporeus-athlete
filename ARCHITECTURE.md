# Sporeus Athlete App — Architecture Map

## Data Flow
User Input → Component State → useLocalStorage → localStorage
↕ (if authenticated)
DataContext → Supabase Postgres

## File Responsibilities (DO NOT MIX)

### src/lib/ — Pure Logic (NO React, NO DOM, NO localStorage)
Every file here is a pure function module. Import React = violation.
- formulas.js: mathematical calculations (TSS, NP, W', zones, Riegel, etc.)
- intelligence.js: analysis functions (load trend, injury risk, race readiness, etc.)
- patterns.js: pattern mining (training↔test, recovery, injury, optimal week, seasonal)
- validate.js: input sanitization (sanitizeLogEntry, sanitizeProfile)
- constants.js: static data objects (zones, session types, sport configs, etc.)
- storage.js: localStorage schema, export/import helpers
- vdot.js: Daniels VDOT lookup and training paces
- scienceNotes.js: triggered science facts database
- fileImport.js: FIT/GPX binary parsing
- fetch.js: safeFetch with timeout + retry
- strava.js: Strava OAuth client helpers
- pushNotify.js: push notification subscription management
- reportGenerator.js: HTML report generation for print/PDF
- dataMigration.js: localStorage → Supabase migration detection

### src/components/ — React UI (NO direct math, NO business logic)
Components call lib/ functions and render results. Complex math in a component = violation.
- Dashboard.jsx (imports from intelligence.js, patterns.js, scienceNotes.js)
- TrainingLog.jsx (imports from formulas.js, validate.js, fileImport.js)
- Protocols.jsx (imports from formulas.js, vdot.js)
- Recovery.jsx (imports from intelligence.js for injury risk)
- Profile.jsx (imports from formulas.js, validate.js, storage.js)
- CoachDashboard.jsx (imports from intelligence.js, patterns.js, formulas.js)
- All others: see CLAUDE.md Key Files table

### src/contexts/ — React Context Providers
- LangCtx.jsx: translation labels (EN/TR), TABS array, t() helper
- DataContext.jsx: Supabase sync factory (useSyncedTable)

### src/hooks/ — Custom React Hooks
- useLocalStorage.js: quota-guarded persistence
- useAuth.js: Supabase auth state listener
- useCountUp.js: number animation

## Critical Invariants (break these = break the app)

1. `sporeus_log` uses UNDERSCORE not hyphen — every other key uses hyphen
   Renaming this key = every existing user loses their training history

2. supabase.js uses `flowType: 'implicit'` — required for GitHub Pages (static)
   Changing to PKCE = auth breaks on every deployment

3. useAuth.js uses `onAuthStateChange` only — never `getSession()`
   Adding getSession() = Web Locks contention on Safari/iOS

4. Coach invite SHA-256 salts in formulas.js are hardcoded
   Changing them = every existing unlock code stops working

5. service worker uses `injectManifest` mode (not generateSW)
   Changing mode = push notifications break

6. ErrorBoundary wraps every tab in App.jsx
   Removing any wrapper = one tab crash takes down the entire app

7. deploy.yml runs `npm test` before `npm build`
   Removing the test step = broken math can reach production

## localStorage Keys (23 total — DO NOT rename any)

### Athlete Data
sporeus_log, sporeus_profile, sporeus-recovery, sporeus-injuries,
sporeus-test-results, sporeus-race-results, sporeus-weight,
sporeus-plan, sporeus-plan-status, sporeus-plan-responses,
sporeus-plan-updates

### Preferences
sporeus-lang, sporeus-dark, sporeus-onboarded, sporeus-reminders,
sporeus-achievements, sporeus-milestones, sporeus-shown-notes,
sporeus-training-age, sporeus-dash-layout, sporeus-last-backup

### Coach
sporeus-coach-mode, sporeus-coach-profile, sporeus-coach-athletes,
sporeus-coach-templates, sporeus-coach-onboarded, sporeus-coach-last-athlete,
sporeus-my-coach, sporeus-admin-codes, sporeus-coach-overrides,
sporeus-coach-messages, sporeus-messages-*

### System
sporeus-api-cache, sporeus-articles-cache, sporeus-api-last-fetch,
sporeus-guest-mode

## Supabase Tables (12)
profiles, training_log, recovery, injuries, test_results, race_results,
coach_athletes, coach_notes, coach_invites, coach_plans,
strava_tokens, push_subscriptions
