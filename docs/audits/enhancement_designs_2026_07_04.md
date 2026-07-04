# Enhancement designs — 2026-07-04 (post-v9.466 scout)

Implementation-ready designs for the next enhancement round, prioritized by
**athlete-visible value per unit risk**. Investigated against the live code at
v9.466 (Strava P0+P1+P2 enrichment shipped, migration 20260638 + prod-drift
columns applied). All file references verified against the working tree.

| # | Item | Value | Risk | Effort | Verdict |
|---|------|-------|------|--------|---------|
| E1 | Enrichment UI surfacing (log chips + derived-RPE label + measured-kcal line) | HIGH — visible on every enriched entry today | Near-zero (display only) | S (~2–3 h) | **SHIP FIRST** |
| E2 | Guest migration parity (reuse `logEntryToRow`) | HIGH at conversion moment — stops silent metric loss on signup | Low (guests-only path, guards untouched) | S (~2 h) | Ship second |
| E3 | RPE null→5 fabrication fix (honest hydration + 4 average fixes) | MED — integrity of avg-RPE/sRPE numbers | MED (visible numbers change, by design) | M (~half day) | Ship third |
| E4 | session_tag DB wiring | LOW **today** — zero consumers exist | Low | S–M | **DEFER** (ship only WITH a coach-facing reader) |
| E5 | Backlog quick wins (see §5) | varies | low | S each | pick 1–2 |

---

## E1 — Enrichment UI surfacing (recommended next ship)

v9.465/466 hydrate `np, avgPower, maxHR, elevationGainM, kilojoules,
sufferScore, startTime, rpeMethod, calories, wPrimeExhausted, wPrimeMethod`
onto entries — but the UI shows almost none of it. Three zero-new-data surfaces:

### E1a — TrainingLog expanded-entry chips
`src/components/TrainingLog.jsx` lines 971–988: the "RAW METRICS" pill-chip row
already renders `{lbl,val,color}` objects, `.filter(Boolean)` → spans. Today it
shows only avgPower/avgHR/avgCadence/distanceM. Extend the array (lines 973–978):

```js
const metrics = [
  expandedEntry.avgPower       && { lbl:'AVG PWR', val:`${expandedEntry.avgPower}W`,  color:'#ff6600' },
  expandedEntry.np             && { lbl:'NP',      val:`${expandedEntry.np}W`,        color:'#ff6600' },
  expandedEntry.avgHR          && { lbl:'AVG HR',  val:`${expandedEntry.avgHR}bpm`,   color:'#e03030' },
  expandedEntry.maxHR          && { lbl:'MAX HR',  val:`${expandedEntry.maxHR}bpm`,   color:'#e03030' },
  expandedEntry.avgCadence     && { lbl:'CADENCE', val:`${expandedEntry.avgCadence}rpm`, color:'#0064ff' },
  expandedEntry.distanceM      && { lbl:'DIST',    val:`${(expandedEntry.distanceM/1000).toFixed(2)}km`, color:'#888' },
  expandedEntry.elevationGainM && { lbl:'ELEV',    val:`${expandedEntry.elevationGainM}m`, color:'#5bc25b' },
  expandedEntry.kilojoules     && { lbl:'WORK',    val:`${expandedEntry.kilojoules}kJ`,   color:'#0064ff' },
  expandedEntry.calories       && { lbl:'KCAL',    val:`${expandedEntry.calories}`,       color:'#888' },
  expandedEntry.sufferScore    && { lbl:'SUFFER',  val:`${expandedEntry.sufferScore}`,    color:'#e03030' },
  expandedEntry.startTime      && { lbl:'START',   val:expandedEntry.startTime,           color:'#888' },
].filter(Boolean)
```

Simplify the outer guard at line 972: build the array first, render when
`metrics.length > 0` (instead of hand-listing fields in the `&&` guard — that
list is already out of sync). Chips use hardcoded EN abbreviations by existing
precedent (AVG PWR / DIST) — no LangCtx keys needed. NP could get a
`ScienceTooltip` later; keep this pass chips-only.

### E1b — derived-RPE honesty label
`rpeMethod` is stored (`derived_hr` / `derived_suffer` / `athlete` from Strava
perceived_exertion) but read NOWHERE. Minimal honest surfacing at the RPE cell,
`src/components/TrainingLog.jsx:883`:

```jsx
<td style={{ ...existing }} title={s.rpeMethod?.startsWith('derived')
    ? (lang==='tr' ? 'Nabızdan türetildi (tahmini)' : 'Derived from HR (estimated)') : undefined}>
  {s.rpe}{s.rpeMethod?.startsWith('derived') ? '~' : ''}
</td>
```

`~` suffix (e.g. `6~`) is language-neutral and matches the terminal aesthetic;
the tooltip explains it. Do NOT annotate `rpe_method='athlete'` (that IS
athlete-reported). Optional same-pattern site: TodayView weekly-recap avg-RPE
badge (`src/components/TodayView.jsx:2115`) — skip this round, the recap mixes
methods.

### E1c — measured calories line in FuelGuidanceCard
`src/components/dashboard/FuelGuidanceCard.jsx` prescribes CHO from today's
TSS (lines 42–44). Add a **display-only** context line when today's entries
carry measured energy — do not change the g/kg prescription logic (fueling
prescriptions are founder-domain; a measured-burn readout is not):

```js
const todayKcal = todayEntries.reduce((s,e) => s + (Number(e.calories) || 0), 0)
// render when > 0:  "MEASURED BURN: 742 kcal (device)"  — new LangCtx key measuredBurnL (EN/TR)
```

Do not fall back to `kilojoules→kcal` conversion (efficiency assumption =
sport-science). `entry.kilojoules` stays a data-only field for now.

**Files:** `src/components/TrainingLog.jsx`, `src/components/dashboard/FuelGuidanceCard.jsx`,
`src/contexts/LangCtx.jsx` (1 new key `measuredBurnL` EN+TR).
**Tests:** component tests asserting (a) chips render for an entry with all new fields
and hide when absent, (b) `~` suffix + title only when `rpeMethod` starts with
`derived`, (c) FuelGuidance shows measured line only when calories present.
**Risks:** none material — display-only; chip row already overflow-wraps
(`flexWrap:'wrap'`). Watch chip-row length on mobile with all 11 chips (wraps fine).
**Effort:** S.

---

## E2 — Guest migration parity (dataMigration reuses logEntryToRow)

### Problem
`src/lib/dataMigration.js:79–89` hand-builds a minimal `training_log` row
(date/type/duration/tss/rpe/zones/notes/source) — dropping `distance_m, avg_hr,
avg_cadence, decoupling_pct, np, avg_power, max_hr, elevation_gain_m,
kilojoules, suffer_score, start_time, rpe_method, w_prime_exhausted,
w_prime_method, calories`. A guest who logged rich FIT/manual data for weeks
silently loses every metric column at the exact moment they convert to an
account. Pre-existing since v9.397; each enrichment version widened the gap.

### Design — direct reuse
```js
import { logEntryToRow } from '../hooks/useSupabaseData.js'
// ...
const rows = log
  .filter(e => e && typeof e === 'object' && e.date)
  .map(e => logEntryToRow(e, userId))
```

Verified compatibility point-by-point:
- **No circular import.** `useSupabaseData.js` imports react + `lib/{logger,
  supabase, offlineQueue, deepEqual, newId, validate}` + `hooks/useLocalStorage`;
  none of those imports `dataMigration.js` (validate.js/storage.js mention it in
  comments only — verified; real importers are App.jsx and MigrationModal.jsx). A
  `lib → hooks` import is new but cycle-free; React at module top-level is
  side-effect-free under vitest. (Purist alternative: extract the two mappers to
  `src/lib/logMappers.js` and re-export from useSupabaseData — more churn, same
  result; not required.)
- **source:** `logEntryToRow` hardcodes `source:'manual'` — exactly what the
  v9.360 retry-idempotency cleanup keys on
  (`delete().match({ user_id, source:'manual' })`, dataMigration.js:103). Guard
  logic unchanged.
- **id (the v9.340/v9.360 comments):** `logEntryToRow` sends `id` only when
  `isUuid(entry.id)`. Guest entries are uuid-keyed (the one-time
  `migrateLogIdsToUuid` pass in `useTrainingLog` runs for guests too); legacy
  numeric ids are omitted → `gen_random_uuid()` default, same as today. Keeping
  uuid ids is a strict improvement: post-migration server rows carry the SAME
  ids as local entries, so the diff-by-id sync's first edit targets the right
  row instead of relying on hydration replacement. `insert()` (not upsert) is
  preserved; the cleanup-first guard means retries never PK-collide, and the
  existing "skip insert if cleanup failed" branch still protects the pile-up case.
- **Value coercions:** `duration_min`/`tss`/`rpe` produce identical output
  (`Number(x)||null` ≡ `parseFloat(x)||null` for these inputs). `zones` gets
  stricter (all-zero arrays → null) — desirable.

### Same gap in the other tables (checked all 5)
- **recovery** — NO gap. dataMigration maps all 9 fields `recEntryToRow` maps.
- **injuries / test_results** — NO gap (id omission is intentional there).
- **race_results — REAL GAP:** dataMigration.js:188–195 drops `conditions`
  (`raceEntryToRow` maps it, useSupabaseData.js:229). One-line fix:
  `conditions: e.conditions || null`. (Reusing `raceEntryToRow` would force
  sending `id: undefined` for id-less guest race entries — PostgREST rejects
  explicit null id? It sends the key; safer to keep the hand-built row + add the
  one field.)

**Files:** `src/lib/dataMigration.js` (+ import), `src/lib/__tests__/dataMigration.test.js`.
**Tests:** (1) rich guest entry (all 15 metric fields) → row contains every
column `logEntryToRow` emits; (2) uuid id preserved, numeric id omitted;
(3) `source:'manual'` on every row (cleanup contract); (4) race_results row
carries `conditions`; (5) existing idempotency-retry tests still green.
**Risks:** low. Only the signup-migration path changes; columns all exist in
prod (re-verified during v9.466 drift fix). One behavior nuance: entries with
all-zero `zones` now store null (correct). Watch: dataMigration test file must
not import the whole hook module into a non-jsdom environment — vitest config
here runs jsdom for hook tests; if the lib test env is node, import
`logEntryToRow` inside the test the same way dataMigration does (it's a pure fn;
react import is inert).
**Effort:** S.

---

## E3 — rpe null→5 fabrication: honest hydration

### Current state (fully enumerated)
- **The fabrication:** `src/hooks/useSupabaseData.js:63` —
  `rpe: row.rpe != null ? Number(row.rpe) : 5`. Post-v9.465 the edge derives
  honest RPE for HR/suffer rows, so the remaining null-rpe rows are genuinely
  metric-less (manual Strava entries, SessionLogger general-dashboard entries
  which emit `rpe:null`, some importer paths) — and they still become a fake
  "athlete said 5".
- **A second, CONFLICTING fabrication:** `src/lib/validate.js:89`
  `rpe: clamp(e.rpe,0,10)` where `clamp(null)→0`. Any edit/import that passes
  sanitizeLogEntry turns missing rpe into **0**, not 5.
- **`rpeMethod` is stored but read nowhere** (plumbing only: useSupabaseData
  86/130, validate 150).

### Consumer census (all `entry.rpe` readers in src/)
- **CRASHES on null: none.** Every arithmetic path self-defaults, finite-guards,
  or filters.
- **SILENTLY WRONG once null flows (the `||0`-inside-an-average group):**
  `src/components/Dashboard.jsx:349` (avgRPE) + `:350` (srpeLoad — 0-contribution,
  numerically same as excluding, no change needed),
  `src/lib/patterns.js:69` (findRecoveryPatterns avgRPE),
  `src/lib/intelligence.js:452` (weekly avg RPE),
  `src/components/profile/AthleteCard.jsx:13` (avgRPE28),
  `src/lib/athlete/ruleAlerts.js:59` (adds 0 — same as excluding, no change needed).
  → **4 real fixes**: make the averages divide by count-of-present-rpe
  (pattern already used in `src/lib/trainingLoad.js:370` and
  `src/lib/athlete/injuryForecast.js:171`).
- **HANDLES NULL already:** ~30 athlete libs (`Number.isFinite` gates),
  zoneDistrib (`rpeToZone(null)→null`), pdfReport, rpeStability/paceByRpe/
  hrForRpe bin builders, etc. — no changes.
- **GATES (`>=7` style):** null fails the threshold → entry excluded — correct
  and desired (a metric-less session should NOT count as "hard" or "easy").
- **Self-defaulting `||5` group** (timeInZone, trainingPolarization,
  trainingDistribution, staleZones, vo2GapDetector, patterns/intelligence zone
  bucketing, ZoneChart, WeeklyReport/ReviewCard, intensityBalance): behavior
  identical whether hydration gives 5 or null — they re-fabricate locally.
  **Leave untouched this round** (a "no-RPE ⇒ assume moderate zone" fallback is
  a modeling default; whether to exclude instead is a per-card question, some of
  it founder-domain). Document as known follow-up.

### Recommended fix (option A — hydrate honest null, fix the 4 averages). ONE recommendation.
1. `src/hooks/useSupabaseData.js:63` →
   `rpe: row.rpe != null ? Number(row.rpe) : null,`
   (keep the key for entry-shape stability; guards all treat null==undefined).
2. `src/lib/validate.js:89` →
   `rpe: e.rpe == null || e.rpe === '' ? null : clamp(e.rpe, 0, 10),`
   — kills the conflicting null→0 fabrication and stops edits from mutating a
   null into 0.
3. Fix the 4 averages to present-only denominators, e.g. Dashboard.jsx:
   ```js
   const withRpe = filteredLog.filter(e => Number.isFinite(Number(e.rpe)) && Number(e.rpe) > 0)
   const avgRPE = withRpe.length ? withRpe.reduce((s,e)=>s+Number(e.rpe),0)/withRpe.length : 0
   ```
   (same shape in patterns.js:69, intelligence.js:452, AthleteCard.jsx:13).
4. `logEntryToRow` (line 109 `Number(entry.rpe)||null`) already round-trips
   null correctly — no change. QuickAddModal (valibot-required, default 6) and
   TrainingLog form (default '5') stay — those are athlete-entered values.

Rejected alternatives: **sentinel** (breaks the `||`-family in the wrong
direction, worse than either fabrication); **rpeMethod='assumed' marker kept at
5** (requires teaching every gate about provenance — far more invasive, and the
averages stay dishonest).

**Files:** `src/hooks/useSupabaseData.js`, `src/lib/validate.js`,
`src/components/Dashboard.jsx`, `src/lib/patterns.js`, `src/lib/intelligence.js`,
`src/components/profile/AthleteCard.jsx` + their test files.
**Tests:** logRowToEntry null stays null (update existing rpe:5 expectation);
sanitizeLogEntry preserves null / '' → null / clamps numbers unchanged; each of
the 4 averages with a mixed null/valued log divides by present-count; snapshot
a metric-less-entry log through Dashboard useMemos (no NaN).
**Risks:** MED — displayed avg-RPE will RISE for athletes with metric-less
entries (it was being dragged toward 5, and toward 0 post-sanitize). That is
the point; call it out in the changelog. Grep test suite for `rpe: 5`
expectations before shipping — several mapper tests will need updating.
**Effort:** M (half day incl. test sweep).

---

## E4 — session_tag wiring: honest verdict = DEFER

### What exists
- Column + vocabulary + 2 indexes: `supabase/migrations/20260455_coach_retention.sql`
  (`session_tag`, `session_tag_reason`, `idx_training_log_tag`,
  `idx_training_log_user_tag`) — applied to prod during the v9.466 drift fix.
- Classifier: `src/lib/coach/classifySession.js` —
  `classifySession(session, plan=null) → {tag, reason}`; inputs
  `session.{duration,rpe,tss,type,date}` + optional **coach_plans-shaped** plan
  (`plan.weeks[].startDate/tssEst`). Plan-less it can emit only
  `test|junk|recovery|unplanned_high|moderate`; `planned_match/unplanned_low`
  need the plan branch; `planned_miss` only from sibling `classifyMiss()`.
- **Consumers of the DB column: ZERO.** No client reader, no coach dashboard
  component, no edge fn, no SQL view/RPC, and the intended E5 "morning
  briefing" edge fn was never built (no `briefing` match in supabase/functions/).
  The only production classifySession call is
  `src/components/dashboard/SessionClassifierBreakdownCard.jsx:101` — athlete-
  facing, computes tags **on the fly, plan-less**, works fine without the column.

### Is it worth doing at all?
**Not standalone.** Writing session_tag today is write-only plumbing: the one
consumer recomputes client-side anyway (pure fn over in-memory log — cheap), and
the plan-context tags can't even be produced (client localStorage plan
`sporeus-plan` has a DIFFERENT shape — `plan.weeks[].sessions[]` via
`getTodayPlannedSession`, intelligence.js:746 — than `findPlanWeek`'s
coach_plans contract; the Strava edge mapper `_shared/stravaActivity.ts
buildTrainingLogRow(a, userId, physio)` has no plan access at all, and porting
the JS classifier to Deno recreates exactly the mapper-drift problem v9.465
just consolidated away). Recommendation: **defer until a coach-facing reader
ships**, then wire writer+reader in the same version.

### The design to use when that day comes (so it's ready)
1. **Classify client-side at write time, plan-less**, inside `logEntryToRow`
   (single choke point — QuickAdd, TrainingLog edit, offline replay all pass
   through it):
   ```js
   import { classifySession } from '../lib/coach/classifySession.js' // pure, cycle-free
   const { tag, reason } = classifySession(entry)
   // in the row: session_tag: tag, session_tag_reason: reason.slice(0,200)
   ```
2. Hydrate `session_tag → sessionTag` in `logRowToEntry`; whitelist
   `sessionTag`/`sessionTagReason` in `sanitizeLogEntry` (it strips unknown keys
   — verified it would eat them today).
3. `SessionClassifierBreakdownCard` prefers `s.sessionTag` before recomputing
   (keeps the synthetic `s.tag` test hook).
4. **Strava rows:** tag in `_shared/stravaActivity.ts` by porting ONLY the
   plan-less absolute rules (~15 lines) with a "port of classifySession — do
   not diverge" header, same policy as `streamScience.ts`. Never attempt the
   plan branch on the edge.
5. Plan-context tags (`planned_match/planned_miss/unplanned_low`) need a shape
   adapter from the athlete plan (`plan.weeks[].sessions[]` → weekly TSS target)
   — a real design decision about which plan is authoritative (coach_plans vs
   local generated plan). Park it with the coach-feature work.

**Effort:** S (steps 1–3) + S (step 4). **Risk:** low, but value is zero until a
reader exists — that's why it's last.

---

## E5 — Backlog scan: cheap-now quick wins

Sources scanned: `docs/audits/strava_data_enhancements_2026_07_03.md` (P0/P1/P2
now fully consumed by v9.464–466), `docs/audits/audit_2026_07_03_v9450_461.md`
(HIGH/MED/LOW-1 fixed in v9.463), `strava_audit_2026_06_17.md`, the three
`deep_dive_2026_06_16*` docs, `docs/roadmap/`. Cross-checked against CHANGELOG
v9.450–466; raw-series items (durability/MMP/power-curve, lap storage) and
founder-domain science excluded. Items overlapping E2/E3/E4 above are not
repeated. **Top 3 now-cheap items:**

### E5a — "New max HR detected" profile nudge (best of the three)
Source: strava_data_enhancements §3/QW3 "Gain". Per-session `max_hr` is now
stored + hydrated (`entry.maxHR`, useSupabaseData.js:81) but nothing compares
it to `profile.maxhr` — the number that feeds every HR zone + TRIMP-TSS calc.
Design: pure detector `src/lib/athlete/maxHrNudge.js` —
`detectNewMaxHr(log, profile)` returns `{ observedMax, entryDate }` when any
recent entry's `maxHR` exceeds `Number(profile.maxhr)` by ≥2 bpm (guard against
spike noise: require the entry to also have `avgHR`, i.e. a real HR session).
Surface via the existing nudge pattern (`ProfileCompletenessNudge.jsx` as the
template) with a one-tap "update profile max to N" action + dismiss persisted
in localStorage (`sporeus-maxhr-nudge-dismissed-<value>` so a new higher max
re-nudges). Athlete decides; no automatic overwrite — keeps it out of
founder-domain. Effort S (~half day). Risk: low; profile write path already
exists.

### E5b — Strava scope-error banner offers SYNC NOW instead of RECONNECT
Source: audit_2026_07_03 LOW-2, still open. A grant missing `activity:read_all`
lands in `sync_status='error'` → `classifyStravaSync` → TodayView banner
(`TodayView.jsx:1779–1789`) whose primary action `handleBannerSync` just
re-triggers sync — which can never succeed on a plain-`read` token. Design:
thread the failure kind (scope vs transient) from the health classifier; when
scope-caused, the banner's primary action becomes RECONNECT (the forced
re-consent path already exists in `StravaConnect` with `{force:true}`). Effort
S (~2–4 h). Risk: low — routing change only, no new states.

### E5c — Efficiency Factor for rowing erg watts
Source: strava_data_enhancements §2/§3 ("average_watts incl. rowing ergs → EF
trend for the founder's erg sessions"). `src/lib/science/efficiencyFactor.js`
has cycling (NP/HR) and running (pace/HR) branches only; `sport==='row'` never
computes, so `EFTrendCard` stays blank for the founder — a rower — despite
`avgPower`/`np` now being on every erg entry (device_watts-gated). Design:
extend the power branch to accept rowing (EF = NP-or-avgPower / avgHR — the
identical Coggan power-EF formula, no new science invented). Effort S (one
branch + tests; card already consumes the output). **Caveat:** although this
reuses the existing approved formula unchanged, it widens a science card's
sport coverage — worth a one-line founder confirmation before ship, so ranked
after E5a/E5b.

Also noted, tied to E4's fate: Strava `workout_type` (1/11 = race) auto-flag —
races currently look like anomalous high-TSS days. It requires adding `race`
to the classifySession/session_tag vocabulary (the v9.465 deferral reason), so
park it with the E4 coach-reader work rather than shipping a lone flag.

---

## Recommended ship order

1. **E1 enrichment surfacing** — highest visible value, zero data risk; the
   founder's 28 enriched activities light up the day it ships.
2. **E2 guest migration parity** (+ race_results `conditions` one-liner) —
   silent-data-loss fix at the conversion moment; tiny, guards untouched.
3. **E5a max-HR nudge** and/or **E5b scope-error reconnect** — small,
   self-contained.
4. **E3 rpe honesty** — right thing, but changes displayed numbers; ship alone
   with a clear changelog note and a test sweep.
5. **E4 session_tag** — defer until a coach-facing reader exists; design above
   is ready when it does.
