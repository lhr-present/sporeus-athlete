# Strava Data Enrichment Proposal — 2026-07-03

**Status:** Investigation only — nothing in this document is implemented.
**Scope:** What MORE Strava data the app could consume, tied to the existing science chain.
**Baseline:** v9.461 — OAuth → 90-day backfill → webhook push sync all live; 10-athlete cap on Strava app 223686.

---

## 1. Current state — what the edge functions extract today

Both `supabase/functions/strava-oauth/index.ts` (action `sync`) and
`supabase/functions/strava-backfill-worker/index.ts` map a Strava
**SummaryActivity** into `training_log` using only these fields:

| Strava field | Used as |
|---|---|
| `id` | `external_id` (idempotent upsert key) |
| `start_date_local` / `start_date` | `date` (sliced to `YYYY-MM-DD` — **clock time discarded**) |
| `sport_type` / `type` | `type` via `mapStravaType()` (Rowing/Kayaking/Canoeing → `row`) |
| `moving_time` (fallback `elapsed_time`) | `duration_min` |
| `average_heartrate` | `avg_hr` + input to TRIMP TSS + zone estimate |
| `max_heartrate` | TSS/zone input only — **not persisted** (falls back to profile maxhr / 220−age) |
| `distance` | `distance_m` |
| `average_cadence` | `avg_cadence` (run cadence doubled to steps/min) |
| `name` | prepended to `notes` |

Derived: `tss` (TRIMP HR approximation), `zones` (5-bucket heuristic from
avg-HR fraction — a single-band smear, not a real distribution), `rpe: null`.

### Summary fields Strava ALREADY sends in the same payload that we currently drop

These are in every `/athlete/activities` page response — **zero extra API calls** to use them:

| Field | Notes |
|---|---|
| `average_watts` | All rides with any power source; **rowing ergs (Concept2→Strava) report watts too** |
| `weighted_average_watts` | Strava's Normalized-Power equivalent — only when `device_watts: true` |
| `device_watts` | `true` = real power meter, `false` = Strava estimate (must gate on this) |
| `max_watts`, `kilojoules` | Work done — direct fueling-card input |
| `max_heartrate` | Computed against, then thrown away |
| `total_elevation_gain`, `elev_high`, `elev_low` | Meters climbed |
| `suffer_score` | Strava Relative Effort (HR-based session strain) — present when HR exists |
| `average_speed`, `max_speed` | m/s (moving-time based) |
| `start_date_local` clock time | HH:MM discarded by the `.slice(0,10)` |
| `workout_type` | Run: 1=race, 2=long run, 3=workout; Ride: 11=race, 12=workout |
| `trainer`, `commute`, `manual` | Context flags |
| `map.summary_polyline` | Encoded route — client already has `decodePolyline()` in `src/lib/strava.js` |
| `elapsed_time` (alongside moving) | Stop-time = session structure hint |
| `has_heartrate` | Cheap pre-filter before any stream fetch |

### What needs EXTRA API calls

- **DetailedActivity** — `GET /activities/{id}` (1 call/activity): adds
  `calories`, `perceived_exertion` (athlete-entered RPE in Strava!),
  `description`, `splits_metric`, `laps` (erg/interval pieces),
  `best_efforts` (runs), `gear`, `device_name`.
- **Streams** — `GET /activities/{id}/streams?keys=time,heartrate,watts,velocity_smooth,cadence,altitude&key_by_type=true`
  (1 call/activity regardless of key count): second-by-second series — the
  exact input shape of the app's FIT-import science chain.

### API budget reality

- Strava default: **100 read req/15 min, 1,000/day**. Worker self-caps at
  90/15 min via `strava_rate_state` (shared rolling counter — any new fetches
  MUST increment it).
- App is capped at **10 athletes**. Ongoing webhook flow ≈ 1 list call per new
  activity. Adding +1 streams call (and optionally +1 detail call) per new
  activity ≈ 20–40 extra calls/day at full capacity — **~3–4% of the daily
  budget**. One-time enrichment of a full 90-day history for all 10 athletes
  ≈ 650 calls, which the 90/15-min worker drains in ~2 hours.

---

## 2. What the app can already compute if given richer data

The app's science chain is **already built and tested** — it is starved of
inputs on the Strava path, not missing math:

| Capability | Where | Inputs needed | Strava source |
|---|---|---|---|
| Real power TSS (Coggan) | `computePowerTSS(np, durS, ftp)` — `src/lib/formulas.js:153` | NP + FTP | `weighted_average_watts` (FREE) or watts stream |
| Normalized Power | `normalizedPower(powers)` — `formulas.js:165` | 1-Hz watts | watts stream (or take Strava's `weighted_average_watts` free) |
| W′ balance / exhaustion badge | `computeWPrime(powers, cp, wPrimeMax)` — `formulas.js:233`; badge via `entry.wPrimeExhausted` (`validate.js`, `TrainingLog.jsx`) | watts stream + CP (profile, or 0.95×FTP fallback) | watts stream |
| Aerobic decoupling | `computeDecoupling({hr, power, speed})` — `src/lib/decoupling.js`; trend card `lib/athlete/decouplingTrend.js` reads `entry.decouplingPct`; **DB column `decoupling_pct` already exists** (migration `2026041602`) | HR stream + (watts OR velocity) stream, ≥60 min | streams |
| Efficiency Factor + trend | `computeEF({avgHR, np|avgPower|avgPaceMPerMin})` — `src/lib/science/efficiencyFactor.js` | NP or avg power or pace + avgHR | `average_watts`/`weighted_average_watts` (FREE) — pace branch already computable from stored `distance_m`+`duration_min` |
| Durability score | `computeDurability` — `src/lib/science/durabilityScore.js` | 1-Hz power, ≥90-min session | watts stream |
| Power curve / MMP / CP fit | `calculateMMP`, `fitCriticalPower` — `src/lib/powerAnalysis.js` | 1-Hz watts | watts stream |
| NP-by-duration trend card | `lib/athlete/cyclingNpTrend.js` reads `entry.np ?? entry.normalizedPower` | per-session NP | `weighted_average_watts` (FREE) |
| Tri load balance (bike leg) | `lib/athlete/triLoad.js:144` reads `avgNormalizedPower || avgPower` | per-session power | `average_watts` (FREE) |
| Altitude stimulus card | `lib/athlete/altitudeStimulus.js` reads `e.elevationGainM` (28-day weekly aggregate) | per-session elevation gain | `total_elevation_gain` (FREE) |
| Rowing split consistency | `lib/athlete/rowingSplitConsistency.js` — needs distance + duration + **RPE 4–7 gate** (`Number.isFinite(rpe)` check at line 160) | honest RPE | `suffer_score` (FREE) or DetailedActivity `perceived_exertion` |
| Time-of-day consistency | `lib/athlete/timeOfDayConsistency.js` reads `startTime`/`time` HH:MM | session clock time | `start_date_local` (FREE — currently truncated) |
| Real zone distribution | FIT path builds per-sample zone counts (`fileImport.js:74`) vs the Strava path's single-band `estimateZones()` heuristic | HR stream | heartrate stream |
| Session classification | `classifySession` → `session_tag` column | TSS/RPE quality | improves with all of the above |

**Ceiling / parity target:** `src/lib/fileImport.js` `parseFIT()` — date,
duration, avgHR, maxHR, distance, **NP, IF, power-TSS (headline TSS when
computable)**, real zone distribution, and the three 1-Hz series
(power/HR/speed, capped 10,800 samples) that feed W′, decoupling, durability,
MMP. The server-side twin `supabase/functions/parse-activity/index.ts` already
computes NP + power-TSS + `decoupling_pct` + elevation from uploaded FIT files
— **proving the compute fits fine in an edge function**. Strava streams parity
means a Strava-connected athlete gets everything a FIT-uploading athlete gets.

### training_log schema today (`supabase/migrations/`)

`001_initial_schema.sql` + additions: `id, user_id, date, type, duration_min,
tss, rpe, zones (jsonb), notes, source, external_id, created_at` +
`decoupling_pct` (2026041602), `source_file_path` (2026042102),
`session_tag`/`session_tag_reason` (20260455), `is_demo` (20260459), fts, and
`distance_m` / `avg_hr` / `avg_cadence` (20260616).

**Missing columns for enrichment:** `avg_power`, `np`, `max_hr`,
`elevation_gain_m`, `kilojoules`, `suffer_score` (or fold into rpe),
`start_time` (or `started_at timestamptz`), `w_prime_exhausted boolean`.

### Hydration bottleneck (must fix or columns are useless)

`logRowToEntry` in `src/hooks/useSupabaseData.js:50` only surfaces
`distance_m`/`avg_hr`/`avg_cadence` onto client entries. Notably it **already
drops `decoupling_pct`** — the `parse-activity` FIT path writes that column,
but `decouplingTrend.js` reads `entry.decouplingPct`, which never survives the
DB round-trip on a second device. Any new column needs a matching line here
(and in `logEntryToRow` for round-trip safety), plus `sanitizeLogEntry` in
`src/lib/validate.js` (which already whitelists `np`, `avgHR`,
`wPrimeExhausted`).

### RPE integrity problem (makes QW3 more than a nice-to-have)

Strava imports write `rpe: null`, but `logRowToEntry` hydrates `null → 5`
(line 57). So every Strava session currently enters RPE-gated science
(`rowingSplitConsistency` 4–7 steady-state gate, `decouplingTrend` rpe≤6
aerobic gate, `classifySession`, `highRpeBlock`, monotony) with a **fabricated
neutral 5**, silently passing gates it shouldn't. A `suffer_score`- or
HR-fraction-derived RPE is strictly more honest, and matters directly to the
prod founder whose 28 imported activities are rowing sessions.

---

## 3. Gap analysis — what lights up per unused field

### FREE (already in the backfill/sync payload — zero API cost)

| Dropped field | Feature that lights up | Athlete-visible gain |
|---|---|---|
| `weighted_average_watts` + `device_watts` + profile FTP | `computePowerTSS` replaces TRIMP estimate as headline TSS (FIT path already does exactly this, `fileImport.js:130`); `np` column feeds `cyclingNpTrend` + `computeEF` np/hr | Accurate load → CTL/ATL/ACWR/readiness chain stops under/over-counting powered rides; NP trend + EF cards appear for Strava-only cyclists |
| `average_watts` (incl. rowing ergs) | `triLoad` bike power; `computeEF` power/hr branch; rowing watts context | EF trend ("aerobic engine improving") for riders AND the founder's erg sessions |
| `total_elevation_gain` | `altitudeStimulus` card (reads `e.elevationGainM`); climb context in notes/analysis | Altitude/climbing stimulus card fires for Strava users (today: GPX-upload users only, single-device) |
| `suffer_score` (or HR-fraction) → derived `rpe` + persist `max_heartrate` | Honest RPE for `rowingSplitConsistency`, `decouplingTrend` gate, `classifySession`, monotony/strain; per-session max HR enables "new max HR detected → update profile?" nudge | Rowing split-consistency card finally trustworthy for the founder; session tags stop being built on a fabricated RPE 5 |
| `start_date_local` clock time | `timeOfDayConsistency` card | Circadian-consistency insight fires for imported sessions |
| `workout_type` | race tagging → `detectPRs` / race-results linkage; `session_tag: 'test'` | Races auto-flagged instead of looking like anomalous training days |
| `kilojoules` | fueling/energy cards (kJ ≈ kcal for cycling) | Real energy expenditure instead of estimates |
| `trainer` / `commute` | exclude commutes from EF/decoupling trends; trainer flag = no-elevation context | Cleaner trends, fewer junk data points |
| `map.summary_polyline` | route thumbnail via existing `decodePolyline()` | Cosmetic; low science value |

### PAID — 1 extra call per activity

| Source | Fields | Feature |
|---|---|---|
| DetailedActivity | `perceived_exertion` | **Real athlete-entered RPE** overrides any derived value — highest-integrity input for the whole RPE-gated chain |
| DetailedActivity | `laps`, `splits_metric` | Within-session rowing/interval piece analysis (e.g. erg 4×2000m splits); groundwork for an intra-session split-fade card |
| DetailedActivity | `calories`, `description`, `device_name` | Fueling cards; athlete notes imported verbatim |
| Streams (`watts,heartrate,velocity_smooth,time,cadence,altitude`) | 1-Hz series | `decoupling_pct` (column exists!), `computeDurability`, `computeWPrime` → `wPrimeExhausted` badge, `calculateMMP`/`fitCriticalPower`, real NP, real zone distribution — **full FIT-import parity** |

---

## 4. Prioritized roadmap

### P0 — Quick wins (summary fields already fetched; zero API-budget impact)

> **★ QW1 — Power summary fields → real power TSS + NP persisted**
> Extract `average_watts`, `weighted_average_watts`, `device_watts`,
> `kilojoules`, `max_watts`. When `device_watts === true` and profile FTP set
> (extend `resolveProfileMaxHR` into a `resolveProfilePhysiology` that also
> reads `profile_data.ftp`), compute Coggan power-TSS from
> `weighted_average_watts` and use it as headline `tss` (exact FIT-path
> precedent, `fileImport.js:130`); always persist `avg_power`/`np`/`kilojoules`.
> **Files:** migration (new columns), `strava-oauth/index.ts`,
> `strava-backfill-worker/index.ts`, `useSupabaseData.js` (both mappers),
> `validate.js` (np already whitelisted), tests. **Effort:** ~0.5–1 day.
> **Gain:** accurate CTL/readiness chain for powered rides + erg watts;
> `cyclingNpTrend` + EF cards light up from Strava alone.

> **★ QW2 — `total_elevation_gain` → `elevation_gain_m` column**
> Persist + hydrate as `elevationGainM`. **Files:** same migration + 2 edge fns
> + `logRowToEntry`/`logEntryToRow`. **Effort:** ~1–2 h piggybacked on QW1.
> **Gain:** `altitudeStimulus` card fires for every Strava athlete; climb
> context available to future climb-aware TSS refinement.

> **★ QW3 — Honest RPE: `suffer_score` + persist `max_heartrate`**
> Store `suffer_score` and `max_hr`; derive `rpe` from suffer-score bands
> (fallback: avgHR/maxHR fraction) instead of `null` (which the client
> fabricates into 5). Tag derivation (`rpeMethod: 'derived'`) in notes or a
> column for honesty, mirroring the `wPrimeMethod` pattern. **Files:** same
> migration + 2 edge fns + mappers. **Effort:** ~0.5 day.
> **Gain:** `rowingSplitConsistency` (founder's headline card),
> `decouplingTrend` gating, `classifySession`, monotony/strain all run on real
> effort data; "new max HR > profile max" nudge becomes possible.

**QW0 (freebie, no Strava change):** surface `decoupling_pct` in
`logRowToEntry` — the column already exists and is populated by the FIT-upload
path but is dropped on hydration, so `decouplingTrend` is cross-device dead
today. One line + test.

**QW4 (bundle with the migration):** `start_date_local` clock → `start_time`
column → `timeOfDayConsistency`; `workout_type` race flag → `session_tag`;
skip `trainer`/`commute`/polyline unless free.

*All P0 items are one migration + the same two edge-fn touchpoints + the two
mapper functions. Historical rows self-heal: re-running backfill re-upserts on
`(user_id, external_id)` idempotently, enriching existing entries at zero
schema risk.*

### P1 — Streams worker (the big science unlock; +1 API call/activity)

New `strava-stream-worker` (or a `kind: 'streams'` payload variant in the
existing backfill queue): after an activity upserts, enqueue a stream fetch
for activities where `has_heartrate || device_watts` and duration ≥ ~40 min
(decoupling needs ≥60 min incl. warmup; durability ≥90 min; W′/MMP any length
with watts). One request fetches all keys. Compute in the edge fn and store
**scalars only** (`decoupling_pct`, `w_prime_exhausted`, real `zones`,
recomputed `np`/power-TSS on variable rides, durability %) — no raw-series
storage needed for v1 (matches the compute-and-discard shape of
`parse-activity`; optionally park raw JSON in Storage under the
`source_file_path` pattern for future MMP history).
**Must share `strava_rate_state`** with the backfill worker.
**Files:** new edge fn + enqueue RPC/queue migration, backfill-worker enqueue
hook, `logRowToEntry` additions, tests. **Effort:** ~2–3 days.
**Budget:** ≈ 1 call/new activity (~20–40/day at 10-athlete cap); one-time
history enrichment ≈ 650 calls total.
**Gain:** FIT-import parity from Strava alone — decoupling trend, durability,
W′ badge, power curve/CP, honest zone distributions.

### P2 — DetailedActivity fetch (+1 call/activity, can ride the same worker)

Fetch `/activities/{id}` alongside streams (2 calls/activity total, still
trivial at current scale): take `perceived_exertion` as the authoritative RPE
(overrides QW3 derivation), `calories`, `laps` for erg-piece split analysis,
`description` → notes. **Effort:** ~1 day incremental on P1.
**Gain:** athlete-entered RPE integrity; opens an intra-session rowing split
card (new lib, fits the standard card recipe).

### Deferred / not recommended now

- `summary_polyline` route thumbnails — cosmetic, no science-chain consumer.
- Segment efforts, kudos/social fields — out of scope (training/workout only).
- Raw stream persistence + client-side re-analysis — revisit when a card
  actually needs the series after import time.

---

## 5. Risks & guardrails

1. **Rate counter is shared state** — every new Strava request path must
   increment `strava_rate_state` or the 90/15-min self-cap silently breaks.
2. **`device_watts: false` means Strava-estimated power** — never feed it to
   power-TSS/NP/EF; gate every power write on the flag.
3. **Headline-TSS switch changes CTL history** — re-upserting old rides with
   power-TSS will step CTL/ACWR for existing athletes; announce or backfill in
   one pass so the ramp is a single visible correction, not a drift.
4. **Hydration parity** — every new column needs `logRowToEntry` +
   `logEntryToRow` + `sanitizeLogEntry` coverage, or it becomes another
   `decoupling_pct` (written, never read).
5. **Webhook `update` events** re-enqueue a 2-day window — enrichment must
   stay idempotent under repeated upserts (it is, if all derived fields are
   deterministic functions of the payload).
6. **Derived RPE labeling** — persist the method (`derived` vs `athlete`) so
   coach-facing views don't present estimates as reported effort (same lesson
   as `wPrimeMethod`).
