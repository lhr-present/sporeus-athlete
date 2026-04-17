# Bundle Analysis — v8.6.0-C4

**Date:** 2026-04-18  
**Tool:** Vite build output (`npm run build`)

## Before / After

| Chunk | Before (gzip) | After (gzip) | Delta |
|---|---|---|---|
| `index` (main bundle) | 149.79 kB | 84.05 kB | **-43.9%** |
| `TrainingLog` | — | 36.28 kB | new async chunk |
| `Recovery` | — | 13.66 kB | new async chunk |
| `SearchPalette` | — | 3.75 kB | new async chunk |
| `ZoneCalc` | — | 6.25 kB | new async chunk |
| `Onboarding` | — | 2.89 kB | new async chunk |
| `MigrationModal` | — | 2.11 kB | new async chunk |
| `QuickAddModal` | — | 1.71 kB | new async chunk |
| `MyCoach` (InviteModal) | — | 1.76 kB | new async chunk |
| `KeyboardShortcuts` | — | 1.34 kB | new async chunk |

Pre-existing lazy chunks (already split before this PR):
`vendor-recharts` 105 kB, `vendor-supabase` 44 kB, `vendor-react` 42 kB,
`vendor-fit` 30 kB, `vendor-sentry` 28 kB, `Dashboard` 24 kB, `Profile` 25 kB,
`CoachDashboard` 60 kB, `Periodization` 31 kB, plus others.

## What was lazy-loaded

Nine components were previously static imports in `src/App.jsx` and are now
loaded on demand with `React.lazy()` + `<Suspense fallback={null}>`:

| Component | Trigger |
|---|---|
| `ZoneCalc` | Tab: Zones |
| `TrainingLog` | Tab: Log |
| `Recovery` | Tab: Recovery |
| `SearchPalette` | Cmd+K / search button |
| `QuickAddModal` | Quick-add FAB |
| `MigrationModal` | First-launch migration check |
| `OnboardingWizard` | First launch (not onboarded) |
| `KeyboardShortcuts` | ? / help button |
| `InviteModal` (from MyCoach) | Coach invite flow |

## Methodology

1. Run `npm run build` and read chunk sizes from Vite output.
2. For each top-level static import in `App.jsx`, check if it was conditionally rendered or only visible on non-default tabs.
3. Convert to `lazy()` and wrap render site in `<Suspense fallback={null}>`.
4. Named exports (e.g. `InviteModal`) use the `.then(m => ({ default: m.Export }))` pattern.
5. Run test suite (1807 tests) to confirm no regressions.

## To re-run the analysis

```bash
ANALYZE=1 npm run build
# Opens dist/bundle-stats.html with treemap visualization
```

## Residual opportunities

| Candidate | Est. saving | Blocker |
|---|---|---|
| `CoachSquadView` (already lazy) | — | already split |
| Further splitting within TrainingLog | ~10 kB | requires internal refactor |
| Moving recharts to dynamic `import()` per-chart | ~5 kB | complex, low priority |
