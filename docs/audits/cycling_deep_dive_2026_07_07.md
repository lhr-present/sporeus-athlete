# Cycling Deep-Dive Audit — 2026-07-07

App version at audit time: see package.json. Scope: powerAnalysis.js, cyclingZones, PowerCurve.jsx (post-v9.481), DurabilityCard (post-v9.480), cyclingNpTrend / triLoad bike / EF cycling branch / IF / tssBand, hasCyclingData gating + FIT power path + localStorage power blobs, Protocols FTP/CP tests.

Out of scope (fuzz-verified this week): normalizedPower, computePowerTSS, computeWPrime formula fidelity.

Findings appended as verified. Severity: CRITICAL / HIGH / MED / LOW / QUESTION.

---
## Tranche 1 — powerAnalysis.js, cyclingZones, PowerCurve.jsx, DurabilityCard

### HIGH — PowerCurve activity view dead for all UUID-id entries (`parseInt` mangles the key)
**File**: `src/components/PowerCurve.jsx:103` — `const stream = loadStream(parseInt(selectedId))`
Entry ids are v4 UUID strings since the uuid migration (`src/lib/newId.js:21`; `useSupabaseData.js` rekeys `sporeus-power-<id>` blobs to uuids). `parseInt('9f3a…')` → `9`, `parseInt('ab12…')` → `NaN`, so the lookup key becomes `sporeus-power-9`/`sporeus-power-NaN` and never matches. The blob-existence check in `powerEntries` (line 67) uses the raw `e.id`, so entries appear in the ACTIVITY selector, but selecting one silently renders nothing (activity MMP line + interval breakdown both dead). Only pre-migration numeric-id guests ever see the feature.
**Fix**: `loadStream(selectedId)` (keys are strings either way; drop the parseInt).

### MED — CP fit impossible for peaks-only athletes; silently absent, no fallback
**File**: `src/components/PowerCurve.jsx:87-98,109-116` + `src/lib/powerAnalysis.js:64`
`fitCriticalPower` fits only durations 120–1800 s and needs ≥3 points. The v9.481 peaks merge contributes at most 5 durations {5, 60, 300, 1200, 3600}; only {300, 1200} fall inside the fit range → a peaks-only envelope (Strava-enriched / cross-device athlete with no local streams) can NEVER produce a fitted CP — `fitCriticalPower` returns null every time. Not a wrong number (good), but the CP-model line/badge silently vanish for exactly the athlete class v9.481 was shipped for, and there is no hint why. A 2-point Morton fit over {300, 1200} (`CP=(W2−W1)/(t2−t1)` on work-time) would be a defensible fallback, or add p600/p1800 to the peaks vector.
**Fit math itself verified correct**: linearised P = CP + W′·(1/t); OLS slope = (nΣxy−ΣxΣy)/(nΣx²−(Σx)²) = W′, intercept = CP; equivalent parameterisation of Monod & Scherrer (1965) W = CP·t + W′. r² = 1 − SSres/SStot computed against the model ✓. Note: OLS on P–1/t weights short durations more heavily than OLS on the W–t form — a legitimate published variant, not a bug, but the two forms give slightly different CP on noisy data.

### MED — `estimateFTP` priority order underestimates FTP; wrong pick when 20-min beats 60-min
**File**: `src/lib/powerAnalysis.js:152-159`
Priority-first: p3600 → p1200×0.95 → p480×0.90. All three are LOWER BOUNDS on FTP, so the correct combinator is `max()`, not first-hit. Concrete failure: 2 h Z2 ride at ~185 W containing one hard 20-min effort at 250 W → p3600 ≈ 190 W, p1200×0.95 ≈ 237 W; card shows "FTP est. 190W", a 20% underestimate, because the 60-min MMP of a non-maximal ride wins the priority race. Constants themselves are sourced correctly: FTP ≈ 60-min power / 95% of 20-min (Allen & Coggan, *Training and Racing with a Power Meter*); 90% of 8-min (Carmichael 8-min protocol). Fix: `return Math.round(Math.max(p60||0, (p20||0)*0.95, (p8||0)*0.90)) || null`.

### MED — merged season envelope can be non-monotonic; biases CP fit and kinks the chart
**File**: `src/components/PowerCurve.jsx:76-98`
The envelope takes a per-duration max across sessions, mixing stream MMP (all 29 KEY_DURATIONS) with peaks vectors (5 durations). Because peaks sessions contribute NO points at neighbouring durations, the merged curve can rise with duration (physically impossible for a true MMP curve): stream session gives 200 W @ 900 s, a stronger peaks-only session gives 210 W @ 1200 s but nothing at 900 s → envelope 200→210 going 900→1200 s. `fitCriticalPower` then fits a mixture in which some durations are systematically stale, biasing CP up and W′ down (the stale short-duration points sit below the athlete's true curve). Standard fix: enforce monotone non-increase (`best[d] = max(best[d], best[d'] for all d' ≥ d)` cascade) before charting/fitting, or fit only points from the same source class.

### LOW — PEAK_DUR duplicated instead of imported
**File**: `src/components/PowerCurve.jsx:87` vs `src/lib/athlete/powerPeaks.js:19` (`PEAK_WINDOWS`)
Same 5 constants re-typed. Values currently agree, and all 5 are members of KEY_DURATIONS ✓, but a future edit to PEAK_WINDOWS (e.g. adding p600) silently won't reach the chart. Import `PEAK_WINDOWS`.

### LOW — empty-state copy says ".FIT file" although Strava peaks now light the card
**File**: `src/components/PowerCurve.jsx:158` — `hasSomeData` (line 150) correctly includes peaks-only athletes, but the zero-state still instructs FIT import only. Cosmetic.

### CHECKED CLEAN — calculateMMP
`src/lib/powerAnalysis.js:19-54`: O(n) sliding sum per duration ✓; ≥90% non-zero-sample validity gate applied to the initial window AND every slid window ✓; durations longer than the stream skipped ✓; zero/undefined samples coerced to 0 ✓; result rounded to 0.1 W. No off-by-one (window [i−d+1 … i] tracked correctly; validCount increments on `inc>0`, decrements on `out>0`).

### CHECKED CLEAN — detectIntervals
`src/lib/powerAnalysis.js:104-144`: run detection, tail-segment flush, gap merge (`start − prevEnd ≤ mergeSec`), ≥minDuration filter, NP only when slice ≥30 s (30-s rolling window requirement) ✓. Note (informational): zone label uses Coggan FTP-percent boundaries against CP — CP ≈ FTP within a few %, acceptable for a label; avg includes merged sub-threshold gap samples, standard behaviour.

### CHECKED CLEAN — cyclingZones / Coggan 7-zone boundaries
`src/lib/sport/cycling.js:39-47`: AR <0.55 / End 0.55–0.75 / Tempo 0.75–0.90 / Threshold 0.90–1.05 / VO2max 1.05–1.20 / Anaerobic 1.20–1.50 / NM >1.50 — matches the published Coggan table (half-open intervals make the 55/75/… boundary conventions continuous; published "56–75%" etc. are the same cuts expressed as integer percents). `getCyclingZone` interval logic and `getCyclingZones` watt rounding ✓. `calculateCyclingTSS` = (min/60)×IF²×100 ✓ (Coggan). `wattsPerKg` ✓.
`src/lib/athlete/cyclingZones.js:34-41`: ftp20×0.95 ✓ (Coggan 20-min protocol); ramp×0.75 ✓ (standard ramp-test factor of best 1-min power); cp_test → FTP≈CP pass-through, acceptable (CP is typically a few W above FTP — see QUESTION list). Most-recent-test-wins ordering ✓; profile.ftp precedence ✓.

### LOW — `getFTPFromData` cp_test branch contains dead conditional
**File**: `src/lib/athlete/cyclingZones.js:41` — `parseFloat(raw.toFixed(0)) === raw ? Math.round(raw) : raw` is a no-op disguised as logic (integer → same integer; non-integer → returned unrounded, inconsistent with the other two branches which round). Should be `Math.round(raw)`.

### MED — `predictCyclingTime` ignores FTP and body weight entirely
**File**: `src/lib/sport/cycling.js:123-137`
Every athlete gets `speed = max(8, 35 − 2.5×grade%)` regardless of `ftpWatts` (only validated, never used) or `_bodyWeightKg` (underscore-parked). `computeCyclingPredictions` (cyclingZones.js:60-92) then displays per-athlete "route predictions" — 40 km TT, Gran Fondo, Alpe — that are IDENTICAL for a 150 W and a 400 W rider, alongside a "power" number faked as `ftp×0.9` that the time calculation never used. A 165 lb rider at 4.3 W/kg climbs Alpe d'Huez in ~48 min; a 2 W/kg rider takes ~90 min — the card shows both ~58 min. Physics fix (flat-ish): v ≈ (P/(0.5·CdA·ρ))^(1/3); climbs: v ≈ P/(m·g·grade) — even the simplified VAM form `VAM ≈ (W/kg at threshold)·~1700 m/h` would restore athlete-dependence.

### LOW — bogus source citations across cycling.js
`src/lib/sport/cycling.js:54,71,92,119` cite "Morton (1986) — A 3-parameter critical power model" for Coggan zones, Coggan TSS, and the speed heuristic — none of which come from Morton. Misleading for a "science-cited" app surface (zones/TSS should cite Allen & Coggan; the predictor has no source).

### MED — DurabilityCard duration gate: `durationSec: 0` shape bypasses the minutes fallback
**File**: `src/components/dashboard/DurabilityCard.jsx:45` — `(s.durationSec ?? (s.duration != null ? s.duration * 60 : 0)) >= 5400` uses `??`, so an entry carrying `durationSec: 0` (imports that default-fill the field) with a valid `duration: 120` min fails the gate. `computeDurabilityFromPeaks` (durabilityScore.js:44-46) uses the different — correct — `Number(durationSec) > 0 ? … : duration*60` semantics. Same data, two gate behaviours; card filter should adopt the `> 0` form. Also the inverse: a stream-bearing entry passing the card gate via minutes fallback reaches `computeDurability`, which never falls back to minutes (`session.durationSec ?? powerStream.length`, durabilityScore.js:117) — a <5400-sample stream on a ≥90-min session returns null and the session silently vanishes from the trend.

### LOW — peaks p300 (integer) vs stream MMP5 (0.1 W) mixing in baseline: bias ≤ 0.5 W
**File**: `src/components/dashboard/DurabilityCard.jsx:16-35`. `p300 = Math.round(x)` can exceed the true mean by up to 0.5 W while the stream path keeps 0.1 W precision; when the same ride exists as both blob and peaks, the rounded value can win the max. Effect on durability% is ≤ ~0.3 pp — negligible, documented for completeness. Same applies to lh300 numerator (rounded int) vs stream `_rollingMean` (float): a session can score 100.2% from rounding alone (see next item).

### LOW — durabilityPct not capped at 100; trend bar overflows its 28 px track
**File**: `src/lib/science/durabilityScore.js:49,132` + card line 149. Numerator lh300 ≤ p300 within one session, so the OWN session can't exceed baseline — but the baseline is the 12-month max, and a session whose `powerPeaks` survived sanitisation WITHOUT p300 (sanitizePowerPeaks keeps any subset) while lh300 > every other session's p300 → pct > 100, bar height `round(pct/100×28)` > 28 px, no clamp (only `Math.max(3, …)`). Cosmetic; clamp to 100.

### CHECKED CLEAN — durabilityScore.js math + threshold/shape parity
`computeDurability` vs `computeDurabilityFromPeaks`: identical thresholds (95/90/85, Maunder 2021 tiering) via the shared DURABILITY_THRESHOLDS, identical rounding (×100, round to 0.1), identical return shape incl. citation ✓. Last-hour window slice `max(0, len−3600)`, ≥300-sample guard, ≥5400 s gate ✓. `_trendOf` latest-vs-prior-mean with ±1.5 pp deadband ✓. `baselineMMP5` sliding window (card, lines 24-33) is a correct O(n) 300-s MMP ✓; 12-month cutoff applied to both stream and peaks contributions ✓; baseline includes the scored session's own p300, which caps normal-path scores at 100% by construction ✓.

### NOTE — DurabilityCard stream path (`s.powerStream`) is still dead code in practice
Nothing writes `powerStream` onto log entries (confirmed: FIT import stores the series ONLY in `sporeus-power-<id>` localStorage and on `importPreview`; validate.js has no powerStream whitelist). All live scoring flows through `computeDurabilityFromPeaks`. Keep or delete, but tests asserting the stream path are exercising unreachable production shape.

## Tranche 2 — EF, triLoad, cyclingNpTrend, gating, import/sync plumbing, Protocols

### HIGH — computeEF's cycling branch is unreachable for real entries: EF Trend card permanently "Need ≥8 sessions"
**Files**: `src/components/Dashboard.jsx:403-414` + `src/lib/science/efficiencyFactor.js:52-56`
Dashboard builds `sport: e.sport || e.type` — i.e. 'bike' (Strava), 'Easy Ride', 'Power Intervals', 'Easy Run' … `computeEF` accepts the cycling branch ONLY when `sport === 'cycling'` (exact) OR `sport == null` (auto-detect). Since Dashboard always passes a non-null string that is never exactly 'cycling'/'running', BOTH branches fail and `computeEF` returns null for essentially every real session — powered or not. `efTrend` therefore never reaches its ≥8-session threshold and EFTrendCard renders the empty state forever. The one field combination that would work (`e.sport` and `e.type` both empty) doesn't occur (type is always set).
**Fix**: normalize in Dashboard — `sport: /bike|cycl|ride/i.test(t) ? 'cycling' : /run/i.test(t) ? 'running' : undefined` — or relax computeEF to regex-match. (EF math itself: NP/avgHR resp. pace/avgHR per Coggan 2003 — correct; `np ?? avgPower` preference correct; efTrend half-split means, CV, ±2% classification verified correct.)

### HIGH — triLoad sport classifier misses the app's own type vocabulary: manual + FIT cycling (and run/swim) invisible
**File**: `src/lib/athlete/triLoad.js:19-28`
`sessionSport` requires `type === 'bike' || type === 'cycling'` (exact, lowercased) for bike, `type === 'run'`/`sport === 'running'` for run, `type === 'swim'` for swim. The app's manual vocabulary (`src/lib/constants.js:8`) is 'Easy Ride', 'Tempo Ride', 'Power Intervals', 'Long Ride', 'Bike Race', 'FTP Test'; the CSV importer normalizes to 'Ride'; FIT imports carry the user-selected type. None equal 'bike'/'cycling', and these entries have no `sport` field → every manually logged or file-imported ride contributes ZERO to TriathlonLoadCard's bike TSS, brick detection, and discipline counts. Only Strava-synced rows (`type='bike'` via mapStravaType) count. Same failure for 'Easy Run'/'Long Run' ('run' exact-match) and 'Easy Swim'. A manual-logging triathlete sees a card claiming near-zero swim/bike/run TSS despite a full log — or no card at all (disciplineCount < 2).
**Fix**: reuse the regex vocabulary the rest of the app uses (`/bike|cycl|ride/i`, `/run/i`, `/swim/i` — cf. cyclingNpTrend.js:40-45, Dashboard RE_CYCLE_TYPE).

### MED — triLoad representative-TSS bike leg is dead code: reads `s.ftp` (never exists) and misses `np`
**File**: `src/lib/athlete/triLoad.js:144-157`
`ftpVals = bike.map(s => s.ftp || 0)` — no log entry ever carries an `ftp` field (not written by any import path; not whitelisted in `sanitizeLogEntry`), so `avgFtp` is always null and `bikeArg` stays null → `computeRepresentativeTSS` silently excludes the bike leg for every athlete, even Strava-enriched ones with per-session power. Additionally `s.avgNormalizedPower || s.avgPower` misses the canonical `np` field (FIT imports store `np` only, no `avgPower`). Fix: pass `profile` into the function and use `parseFloat(profile.ftp)`; read `s.np ?? s.avgNormalizedPower ?? s.avgPower`.

### MED — hasTriData gate counts workout adjectives, not sports
**File**: `src/components/Dashboard.jsx:484-488`
`new Set(log.map(e => (e.type||'').split(' ')[0].toLowerCase())).size >= 3` — for the app's own type list the FIRST WORD is 'easy', 'tempo', 'long', 'interval', 'power'…: a pure runner logging 'Easy Run' + 'Tempo Run' + 'Long Run' yields {easy, tempo, long} = 3 → hasTriData true → TriathlonLoadCard chunk fetched for a single-sport athlete (it then renders null via computeTriLoad, masking the broken gate — and conversely a real triathlete is only saved by `primarySport === 'triathlon'`). Intended semantics presumably: count distinct SPORTS. Fix: classify each entry with the shared sport regexes and count distinct classifications.

### MED — cyclingNpTrend: whole-session NP labelled as "best NP for 5/20/60-min duration"; hard sessions excluded by name
**File**: `src/lib/athlete/cyclingNpTrend.js:47-55` (+ card copy)
`bestNpAtBucket` takes the SESSION-level NP of any ride whose total duration ≥ bucket and reports it as the bucket best. A 3-h Z2 ride (NP 190 W) populates the "5-min" bucket with 190 W — that is not "best NP held for 5 min" (which would need the stream/MMP; the true 5-min best of that ride might be 320 W). Buckets are therefore near-duplicates of each other whenever the athlete rides long, and the "rising 20-min best NP = FTP rising" claim in the header only holds for athletes who happen to do maximal 20-min rides. Not wrong math, but the label/interpretation over-promises; consider deriving 5/20-min bests from `powerPeaks.p300/p1200` (already synced!) instead of session NP — the data for the honest metric is now on the entries. Separately, `isBike` (`/bike|cycl|ride/i`) excludes the manual types 'Power Intervals' and 'FTP Test' — a cyclist's HIGHEST-NP sessions vanish from the trend while 'Easy Ride' counts. Window/sub-window date math (90d, thirds, half-open boundaries) verified correct; ≥3% trend classification and majority vote verified correct.

### MED — "last hour" durability numerator is computed on the FIRST 3 h of long rides (both import paths)
**Files**: `src/lib/fileImport.js:12,95` (MAX_SERIES_LEN cap) + `supabase/functions/strava-backfill-worker/index.ts:245` (`slice(0, 10800)`) → `computePowerPeaks` lh300
Both paths truncate the stream to the first 10,800 samples before computing peaks. For any ride > 3 h — precisely the durability-relevant sessions — `lh300` is the best 5-min power in hours 2–3, not the actual final hour. Durability% is then systematically OVERSTATED for 4–6 h rides (the analysed segment is less fatigued than the true last hour). Maunder 2021's construct is last-hour-of-session. Fix: for peaks, keep the cap for p-windows if needed but compute lh300 on `powers.slice(-3600)` of the FULL stream before capping (edge worker has the full stream in memory; FIT parser can compute peaks pre-cap). Also inherited: p1200/p3600 season-envelope points slightly understate on >3 h rides.

### QUESTION — EBikeRide watts feed FTP/CP surfaces
**File**: `supabase/functions/_shared/stravaActivity.ts:22` — `EBikeRide: "bike"`.
E-bike rides type as 'bike', so their np/powerPeaks flow into the PowerCurve envelope, estimateFTP, cyclingNpTrend and durability like any ride. With a crank/pedal power meter the watts ARE genuine rider watts (motor assist doesn't inflate a real PM), so peaks are arguably legitimate — but ride character (drafting the motor to hold 5-min power deep into a "long" ride) distorts durability and NP-trend narratives, and TrainingPeaks/WKO convention is to exclude e-bike rides from power PBs. Founder decision needed: (a) keep as-is, (b) map EBikeRide→'other', or (c) type 'bike' but skip stream enrichment (no np/peaks) for EBikeRide. Flagging only — no code change made.

### QUESTION / LOW — stream-path power lacks the `device_watts` gate the summary path has
**Files**: `supabase/functions/_shared/stravaActivity.ts:165,291-295` vs `strava-backfill-worker/index.ts:246-286`
Summary import correctly refuses Strava-ESTIMATED power (`device_watts === true` gate, QW1). But enrichment qualifies on `has_heartrate === true || device_watts === true` and the worker then uses whatever `watts` stream comes back with no device_watts check — np, power-TSS (overwrites `tss`!), W′-exhaustion and powerPeaks would all ingest estimated power if Strava ever serves a watts stream for a PM-less ride. Today Strava's streams API generally omits `watts` without a power meter, so this is latent, but the asymmetry is one API-behaviour change away from polluting FTP/CP surfaces. Cheap hardening: skip the watts block unless `logRow`/activity has device_watts (persist the flag at summary time).

### LOW — `intensityFactor` computed on FIT import but never persisted; sessionTargets' "authoritative" IF signal is dead
**Files**: `src/lib/fileImport.js:127` (returned), `src/components/TrainingLog.jsx:571` (notes-string only), `src/lib/validate.js` (no whitelist), `src/lib/athlete/sessionTargets.js:182` (reads `session.intensityFactor`)
IF reaches the entry only as free text inside `notes`; the numeric field is dropped by confirmImport/sanitizeLogEntry. deriveIfTarget's priority-1 signal can never fire; every IF target comes from the RPE/zone heuristics. Either whitelist + persist `intensityFactor` (it's `np/ftp`, 2 dp) or delete the dead branch. (Displayed IF at import time — `np/ftp` guarded against missing FTP — verified correct, v9.465 plumbing confirmed: np survives sanitize, syncs via `np` column, hydrates back.)

### LOW — `src/lib/fitParser.js` is an orphaned second FIT/NP implementation
No production imports (only fileImport.js is wired). Duplicate NP/IF/TSS math that can drift from formulas.js. Delete or consolidate.

### LOW — orphaned `sporeus-power-<id>` blobs on cross-device deletion
Delete paths on THIS device clean up (TrainingLog.jsx:417,1003; Calendar.jsx:132; clearAllAppData sweeps `sporeus*` ✓; uuid migration rekeys ✓). But an entry deleted on device B (or any sync-driven removal applied via useSupabaseData) never triggers removeItem on device A → blob lingers until sign-out/reset. Bounded (≤10800 numbers/entry) but a slow localStorage leak toward the quota that already has a guard elsewhere. Cheap fix: periodic sweep of `sporeus-power-*` keys whose id is not in the current log.

### LOW — parseFIT powerSeries filter is a no-op
`src/lib/fileImport.js:96-98` — `.filter((_, i, a) => a.length > 0)` returns every element of any non-empty array (constant predicate). Dead code; delete or replace with the presumably-intended emptiness check outside the filter.

### CHECKED CLEAN — Protocols.jsx FTP/CP test math
`src/components/Protocols.jsx:119-124`: ramp FTP = 0.75 × final step (`formulas.js rampFTP`) ✓ standard ramp factor; 20-min FTP = 0.95 × avg (`ftpFrom20`) ✓ Allen & Coggan.
CP test (lines 155-156): 3-min + 12-min two-point Monod-Scherrer — `CP = (720·P12 − 180·P3)/(720 − 180)` is exactly `(W2 − W1)/(t2 − t1)` ✓; `W′ = 180·(P3 − CP)` is `W1 − CP·t1` ✓; durations sit inside the recommended 2–15 min separation. W′ sanity copy (<8 kJ low, >30 kJ high) physiologically reasonable.
Save path: profile `cp` (30–2000) and `wPrime` (1000–60000) whitelisted in sanitizeProfile (validate.js:410-411, v9.483) ✓; FTP-overwrite is opt-in behind a confirm modal ✓. NOTE (question, not defect): confirming sets `ftp = CP` 1:1 — CP is typically a few % above FTP; the modal at least states what it does.
`fitCP` (sport/rowing.js:186-205, reused by cycling calculateFTP): OLS on the work–time form W = CP·t + W′, slope = CP, intercept = W′ ✓ textbook Monod-Scherrer; degenerate-denominator and non-positive guards ✓.

### CHECKED CLEAN — sync/sanitize contracts for cycling fields
`sanitizeLogEntry` whitelists + bounds: np ≤2500 (accepts `np`/`normalizedPower`) ✓, avgPower ≤2500 ✓, durationSec >0 ✓, powerPeaks via sanitizePowerPeaks (known keys, ≤2500 W, ints) ✓, hasPower/wPrimeExhausted/wPrimeMethod/decouplingPct ✓. `logRowToEntry` hydrates np/avg_power/power_peaks/duration_min→duration with the exact key names the cycling cards read ✓. `logEntryToRow` writes power_peaks through sanitizePowerPeaks ✓. Deno `computePowerPeaks` port is line-for-line equivalent to the client source of truth (verified side-by-side) ✓.

### CHECKED CLEAN — gating + display misc
`hasCyclingData` (Dashboard.jsx:263-264,476-478): `/bike|cycl|ride/i` on type, `/cycl/i` on sport, OR profile.ftp > 0 — matches Strava 'bike', all manual Ride types, FIT 'Ride'; 'Power Intervals'/'FTP Test' sessions alone wouldn't trip it, but any such athlete has FTP set or other rides, and cyclingZones/NpTrend cards are correctly gated on it ✓. tssBand/tssBandColor (TrainingLog.jsx:38-51): display-only 50/100/150 banding, no math risk ✓. powerPeaks computePowerPeaks/sanitizePowerPeaks: sliding-sum O(n) correct, <30-sample and no-positive-power rejections, window-longer-than-series omission ✓ (note: intentionally NO 90% dropout-validity gate, unlike calculateMMP — zero-filled gaps can only lower a mean, so peaks are conservative; documented convention).

---
## Summary (severity-ordered)

| # | Sev | Finding | File |
|---|-----|---------|------|
| 1 | HIGH | PowerCurve activity view dead: `parseInt(selectedId)` mangles UUID ids → stream lookup never matches | PowerCurve.jsx:103 |
| 2 | HIGH | computeEF cycling branch unreachable (Dashboard passes 'bike'/'Easy Ride', computeEF wants exact 'cycling' or null) → EF Trend card permanently empty | Dashboard.jsx:412 / efficiencyFactor.js:54 |
| 3 | HIGH | triLoad sessionSport exact-match misses 'Easy Ride'/'Ride'/'Easy Run'/'Easy Swim' → manual+FIT sessions invisible to tri card | triLoad.js:19-28 |
| 4 | MED | CP fit impossible for peaks-only athletes (only 300/1200 s inside 120–1800 s fit range; needs ≥3) | PowerCurve.jsx + powerAnalysis.js:64 |
| 5 | MED | estimateFTP priority-first instead of max() → underestimates when 20-min effort beats 60-min MMP | powerAnalysis.js:152-159 |
| 6 | MED | Merged stream+peaks envelope can be non-monotonic → CP-fit bias + chart kinks | PowerCurve.jsx:76-98 |
| 7 | MED | predictCyclingTime ignores FTP and weight — identical route predictions for all athletes; fake "power" display | sport/cycling.js:123-137 |
| 8 | MED | lh300 "last hour" computed on FIRST 3 h of >3 h rides (both FIT and Strava paths) → durability overstated on the longest rides | fileImport.js:95 / strava-backfill-worker:245 |
| 9 | MED | DurabilityCard gate `durationSec ?? duration*60` vs lib `>0` fallback mismatch; stream path never falls back to minutes | DurabilityCard.jsx:45 / durabilityScore.js:117 |
| 10 | MED | hasTriData counts first words ('easy','tempo','long') not sports | Dashboard.jsx:484-488 |
| 11 | MED | cyclingNpTrend: session NP mislabelled as duration-bucket best; 'Power Intervals'/'FTP Test' excluded by isBike | cyclingNpTrend.js:40-55 |
| 12 | MED | triLoad bike rep-TSS dead: reads nonexistent `s.ftp`, misses `np` field | triLoad.js:144-157 |
| 13 | QUESTION | EBikeRide→'bike': e-bike watts feed FTP/CP/durability surfaces — founder call | stravaActivity.ts:22 |
| 14 | QUESTION/LOW | Stream enrichment lacks the device_watts gate the summary path enforces (latent estimated-power ingestion) | strava-backfill-worker:246-286 |
| 15 | LOW | intensityFactor never persisted; sessionTargets' authoritative IF signal dead | TrainingLog.jsx:571 / validate.js |
| 16 | LOW | getFTPFromData cp_test dead conditional; PEAK_DUR duplicated; fitParser.js orphan; powerSeries no-op filter; bogus Morton citations; FIT-only empty-state copy; cross-device power-blob orphans; durabilityPct >100 uncapped; int-vs-decimal baseline mixing (≤0.5 W) | various (see body) |

## Checked clean
- calculateMMP (sliding window, 90% validity gate, rounding)
- fitCriticalPower OLS math + r² (P–1/t linearisation of Monod-Scherrer; correct given the model choice)
- detectIntervals (runs, merge, NP≥30 s, tail flush)
- Coggan 7-zone boundaries + getCyclingZone/getCyclingZones + calculateCyclingTSS + wattsPerKg
- getFTPFromData constants (20-min ×0.95, ramp ×0.75) + recency ordering + profile precedence
- durabilityScore.js: thresholds (95/90/85 Maunder), scalar/stream parity of shape+rounding+citation, baseline MMP5 window math, trend deadband
- powerPeaks.js computePowerPeaks/sanitizePowerPeaks + Deno port parity
- Protocols: ramp/20-min constants, 2-point CP (Morton work-time), W′, save whitelists (cp 30–2000, wPrime 1000–60000, v9.483), FTP-overwrite confirm
- rowing.js fitCP (work–time OLS)
- Sanitize/sync round-trip for np, avgPower, durationSec, powerPeaks, hasPower, decouplingPct, wPrimeMethod
- hasCyclingData gating; tssBand display; EF pace units (m/min) in Dashboard efSessions
