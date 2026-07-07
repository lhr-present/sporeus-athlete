# Rowing Deep Dive — 2026-07-07

Scope: rowing.js math/contracts, RowingMetricsCard post-v9.474, rowingSplitConsistency post-v9.474, parseC2CSV, rowing-adjacent consumers, founder-shape smoke.
Founder data shape: Strava `type='row'`, distanceM, duration (MINUTES), start_time, elevation; no HR/power/suffer-score; rpe null unless tapped. Profile: maxhr=205, age=31, no ftp/cp, sport='Running'.

Findings appended as verified. Checked-clean list at end.

---
## Findings — batch 1 (rowing.js core + card + consistency + C2 parser + sync contract)

### F1 [HIGH — misleading science] 2k prediction runs Paul's Law on submaximal steady rows
`src/components/dashboard/RowingMetricsCard.jsx:84-118` — `pred2k` takes `last` = most recent rowing session of ANY kind and feeds `predict2000m(timeSec, distM)`. Paul's Law is a maximal-effort scaling law (t2 = t1 × (d2/d1)^k across BEST efforts). The founder's shape is exactly the failure case: steady outdoor rows (RPE null, no HR), e.g. 8 km at 2:30/500m steady → "2000m PREDICTION 8:47" plus a VO2max, W/kg band ("Recreational") and %WR derived from a UT2 paddle. Every steady session repaints the prediction pessimistically; a real 2k test is overwritten the next easy row. Expected: gate on effort (rpe ≥ 8/9, session_tag test/race, or notes match /test|2k/), or use best split-adjusted effort in window, and label the basis. Severity HIGH (numbers actively wrong for the primary persona, presented as science with citations).

### F2 [MEDIUM] concept2VO2max is NOT the published Concept2/Hagerman formula it's labeled as
`src/lib/sport/rowing.js:112-123` + UI label "VO2max (Concept2)" (`RowingMetricsCard.jsx:293,329`). Published Concept2 calculator (concept2.com/training/vo2max-calculator, Hagerman): VO2max = Y×1000/wt with Y branched by sex/weight/training — e.g. male >75 kg highly trained Y = 15.7 − 1.5×(2k time in min); male not-trained Y = 10.7 − 0.9×t; four female/lightweight branches. Code instead uses a generic linear economy model VO2(mL/min) = 14.7×W + 250 with no sex/training branches. Divergence vs the published trained-male branch: 7:00/80 kg → code 58.7 vs C2 65.0 (−10%); 6:00/90 kg → code 81.2 vs C2 74.4 (+9%). Direction of error flips ≈6:30. Fix: implement the published branches (profile has gender + weight) or relabel ("economy-model estimate") and drop the Concept2 attribution. The power step P = 2.80/(split/500)³ itself is the published C2 watts formula — correct.

### F3 [MEDIUM] Concept2 CSV rowing fields do not survive the Supabase sync round-trip (v9.474 fix only holds for guests)
`src/hooks/useSupabaseData.js:123-179` (`logEntryToRow`) has no mapping for `durationSec`, `avg_spm`, `strokes`, `drag_factor`, `sport_type`, `avgPaceSec500m` — no DB columns exist. `logRowToEntry` (60-121) likewise never emits them. For a signed-in user: C2 import → local entry has the fields (sanitize whitelists them post-v9.474, validate.js:165-171) → sync upsert DROPS them → server hydration replaces local rows (validate.js:184 comment) → RowingMetricsCard loses stroke-rate badge, strokes, DPS, drag analysis even on the same device; split precision degrades from durationSec to whole minutes (a 7:07.4 2k becomes 7:00 → split off by ~1.8 s/500m). Also `avg_power` (snake) from parseC2CSV is stripped by sanitize (only `avgPower` camel read, validate.js:149). Fix: add columns (or a metrics JSONB) + map both directions; or normalize parser output to camelCase fields that already round-trip.

### F4 [MEDIUM-LOW] Kayaking + Canoeing map to 'row' — paddlesport sessions feed rowing-specific science
`supabase/functions/_shared/stravaActivity.ts:29` — `Kayaking: "row", Canoeing: "row"`. Everything downstream (RowingMetricsCard split/500m, Paul's Law 2k, C2 VO2max, W/kg vs rowing WR, DPS bands, rowingSplitConsistency, Dashboard hasRowingData gate) treats them as rowing. Kayak splits/stroke rates are physiologically different (single-sided, ~90+ spm). Concrete: one kayak outing makes the rowing cards render and can become `last` for the 2k prediction. Fix: map to 'other' (or a 'paddle' type excluded by /row/i… note 'paddle' does NOT match /row/i, so any distinct string works).

### F5 [LOW] mm:ss rounding produces "6:60" / "1:60"
Two sites: `src/lib/sport/rowing.js:90-95` (`fmtSplit`: s = Math.round(splitSec%60) can be 60, e.g. fmtSplit(119.7) → "1:60") and `RowingMetricsCard.jsx:115-116` (predicted 2k 419.6s → mm=6, ss=round(59.6)=60 → "6:60"). Fix: round total seconds first (as `formatSplit` at rowing.js:279-287 correctly does via totalTenths) — `const tot = Math.round(x); mm=floor(tot/60); ss=tot%60`.

### F6 [LOW] "measured 2k" tolerance ±200 m is 10% of the distance
`RowingMetricsCard.jsx:90` — `Math.abs(distM - 2000) < 200` shows the session time as MEASURED 2000m. An 1801 m piece's time is presented as the athlete's 2k (flatters by ~10%); a 2199 m piece penalizes ~10%. Expected: tolerance ≈ ±1-2% (Strava GPS jitter), e.g. 25-50 m; anything else should go through Paul's Law (which handles 1800→2000 correctly).

### F7 [LOW] classifyStrokeRate: unguarded input → 'sprint'; 'race' band low vs literature
`src/lib/sport/rowing.js:307-321` — NaN/undefined spm falls through every `<` comparison and returns `{zone:'sprint'}`. Card guards with `last.avg_spm ?` (safe there), but the fn's contract is unsafe for other consumers. Also bands label 26-30 spm 'Race pace' and >30 'Sprint'; published 2k race rates (Nolte 2005; Kleshnev) are ~32-38 spm with sprints 38+. On-water head-race rates fit 26-30, so bands are defensible for steady racing but mislabel erg 2k work. LOW/editorial.

### F8 [LOW] splitPer500m returns NaN (not null) when durationSec is missing
`src/lib/sport/rowing.js:268-271` — guards `distanceM` only; `splitPer500m(2000, undefined)` → NaN, `(2000, 0)` → 0. Current consumers guard (card: truthiness; consistency lib: Number.isFinite at rowingSplitConsistency.js:177) but the null-contract in the JSDoc is not honored. One-line guard.

### F9 [LOW — docs] Wrong docstring examples + fabricated-looking citation in rowing.js
- `paulsLaw` example (rowing.js:24): claims 360s@1000→2000 ⇒ ~776s; actual 360×2^1.07 = 755.8s (776 implies exponent 1.108).
- `predict2000m` example (line 38): claims 390→~841; actual 818.8.
- `concept2VO2max` example (line 110): claims (420,80) ⇒ ~56.2; actual 58.7.
- "Paul (1969) — International rowing performance prediction" is cited on nearly every export (incl. rowingZone, fitCP CI helper where it is irrelevant). Paul's Law is rowing-community lore (+5 s/500m per doubling; power-law form exponent 1.06-1.07 per c2forum/machars.net); no 1969 paper exists to cite. Exponent 1.07 itself is within the accepted 1.06-1.07 range — the CONSTANT is fine, the citations/examples are not.

### F10 [INFO] rowingConsistencyBlockedByRpe ignores durationSec (asymmetric with the analysis path)
`src/lib/athlete/rowingSplitConsistency.js:238` — helper requires `Number(e.duration) > 0` (minutes only) while computeRowingSplitConsistency (line 163) accepts durationSec-first. A C2 entry with durationSec but duration rounded to 0 (piece < 30 s) — or any future producer emitting only durationSec — counts for analysis but not for the blocked-state, so the card could silently hide instead of showing "add RPE to unlock". Not reachable with current producers (parseC2CSV always sets duration = round(sec/60); Strava always sets duration ≥ 3 min). Symmetry fix is one line.

## Findings — batch 2 (rowing-adjacent surfaces)

### F11 [MEDIUM] SeasonBestsCard "2000m Erg Split" is dead for every real rowing producer (field + unit mismatch)
`src/components/dashboard/SeasonBestsCard.jsx:97-109` — two independent kills:
1. `isRow` tests `e.sessionType / e.sport / e.discipline` — never `e.type`. Strava rowing entries carry `type='row'` only (logRowToEntry has no sport/sessionType) → isRow false.
2. `const dist = e.distance || 0; if (dist < 1.8 || dist > 2.2) return` — expects KILOMETRES in `e.distance`. Strava entries carry `distanceM` only (undefined → 0 → rejected); parseC2CSV sets `distance` in METRES (2000 → rejected as >2.2).
Result: the metric can never populate from Strava or C2 imports; founder's actual 2k pieces are invisible here. Also `fmtSplit` (line 21-28) has the `:60` rounding bug class and whole-minute duration gives 60s-granularity "splits". Fix: match `/row/i.test(e.type)`, read `distanceM ?? distance*1000`, use `durationSec ?? duration*60`.

### F12 [MEDIUM — latent] `split2kSec` means two different units in two documented contracts (eliteProgram)
Producer `src/lib/athlete/eliteProgram.js:1371` sets `currentLevel.split2kSec = c2kSec` = 2000 m TOTAL time (~420 s; `split500Sec` = c2kSec/4 alongside proves it). Consumers consistent with that: `rowingGainPerBlock` (380-480 s bands, line 264), `eliteProgramCohorts.js:60-64` (>480 beginner). BUT `applyFieldTest` (eliteProgram.js:1663,1693) documents `fieldTest.split2kSec` as **sec/500 m** ("split × 4 over 2000m"). `fieldTestGainRatio` (line 249-255) compares `actualResults.split2kSec` RAW against currentLevel's 2k-time. A caller following the applyFieldTest convention (split ≈ 105) yields actual gain = 420−105 = 315 s → ratio ≫ 1 → clamped +30% Peak/Taper TSS ("Ahead of schedule") for any rowing field test. No live JSX caller passes `actualFieldTestResults` today (grep clean), so latent — but both conventions are documented in the same file, so the first consumer wired will pick one at coin-flip. Fix: rename (`time2kSec` vs `split500Sec`) or convert at the fieldTestGainRatio boundary.

### F13 [LOW — dead code] eliteProgramStaleness rowing drift check can never fire
`src/lib/athlete/eliteProgramStaleness.js:94` requires `typeof profile.split2kSec === 'number'`, but sanitizeProfile never preserves `split2kSec` (grep validate.js: zero hits; acknowledged in derivedSessionTargets.js:276-277). Rowing plan-staleness detection is dead. If ever wired, same F12 unit hazard applies (profile field named "split" vs cl 2k-time → guaranteed "major drift").

### F14 [LOW] goalActivityMismatch pattern order: run-workout words shadow 'row'
`src/lib/athlete/goalActivityMismatch.js:23-29` — run bucket regex `/run|jog|tempo|interval|track/i` is tested BEFORE row's `/row|erg/i`. An entry with no `sport` and type "Row — tempo" or "Erg intervals" buckets as **run**. Current producers emit bare `type='row'` (safe), but manual/free-form rowing entries with tempo/interval in the name miscount toward run share and can mask (or fabricate) a goal-sport mismatch. Fix: order row before run, or strip workout-intent words.

### F15 [LOW — display] ZoneCalc rowing zone range renders slow–fast, contradicting its own comment; duplicated fmtSplit has the :60 bug
`src/components/ZoneCalc.jsx:216-220` — comment says "Interior zones show 'fast–slow' range" but code renders `${fmtSplit(z.splitMax)}–${fmtSplit(z.splitMin)}` = slower split first (e.g. UT1 for 7:00 2k → "2:06–1:58 /500m"), opposite of deriveSessionPace's stated fast-first convention. Local `fmtSplit` (lines 204-208) is a third copy of the `Math.round(s%60)`→60 bug (F5): boundary 119.7 s renders "1:60". The rowingZones() boundary semantics themselves (UT2 "≥ splitMin", Sprint "≤ splitMax") are handled correctly.

### F16 [INFO] rowingTemplates.instantiateTemplate TSS uses 2k race split as session-average split
`src/lib/sport/rowingTemplates.js:186-189` — totalSec = (totalWorkM/500) × split2000Sec assumes the athlete rows EVERY session at 2k race pace; a UT2 12 km at ~1.2× split takes ~20% longer than estimated, so duration-based TSS is systematically low for low-zone templates unless tssMultiplier silently compensates (it is per-template, so it can — but the coupling is undocumented). Commented as approximation; flagging so nobody "fixes" tssMultiplier alone.

## Founder-shape smoke (post v9.462/v9.474, prod founder: type='row', distanceM, duration min, start_time, elevation, no HR/power/suffer, rpe null; maxhr=205, no ftp/cp, sport='Running')

What each rowing surface NOW does for his exact entries:
- **Dashboard gating** (`Dashboard.jsx:266,490-495`): `RE_ROW_TYPE=/row|erg|2k\s*test/i` matches type='row' → both rowing cards render. ✓
- **RowingMetricsCard**: filter matches; normalization → duration=min×60 (durationSec absent, no double conversion ✓), distance=distanceM ✓, avg_hr=null, avg_spm=null (no avgCadence on his rows), strokes=null. Shows: /500m split (CORRECT — formatSplit, seconds); km + min subline ✓. DPS / EF / stroke-rate badge correctly hidden (null inputs). Drag badge only if dragFactor set ✓. **2k PREDICTION block: shows for EVERY latest row** — %WR always (needs no weight), VO2max + W/kg if weight set — all derived via Paul's Law from a submaximal steady row = F1 (the one still-wrong-and-loud surface). If his latest row is 1.8-2.2 km it's labeled MEASURED (F6).
- **RowingSplitConsistencyCard**: his typical variable outdoor distances rarely land in the 500/1k/2k/5k/10k ±5% buckets → card silently null (by design). When bucket-matched pieces exist with rpe null → "add RPE to unlock" state fires ✓ (v9.474 works). After he taps RPE 4-7 on ≥3 same-bucket pieces → CV with correct seconds-valued mean split ✓.
- **SeasonBests "2000m Erg Split"**: DEAD for him (F11 — type not checked, km-vs-metres).
- **goalActivityMismatch**: profile sport 'Running' vs ≥60% row sessions → mismatch flag fires. Correct behavior — it surfaces his stale sport setting (he should flip profile sport to Rowing; also unlocks primarySport-gated rowing paths).
- **derivedSessionTargets**: his PLAN is running-typed, so rowingTarget=null there; deriveSessionHr works off maxhr=205 for any rowing-typed planned session. dragFactor cue works when both a rowing session and dragFactor exist ✓.
- **TSS on his rows**: no HR → unified fallback 50 TSS/h (stravaActivity.ts:45) — honest, documented.
- **rpe**: deriveRPE(null HR, null suffer) → null ✓ (stravaActivity.ts:81-95) — matches the rpe-blocked design.

## Checked clean (verified correct)
- `paulsLaw`/`predict2000m` MATH: exponent 1.07 within the published 1.06-1.07 range (c2forum/machars.net; "+5 s/500m per doubling" ≈ 2^1.07/2 = +5.0% split, i.e. ~5 s at 1:40 pace); direction correct (longer distance → slower); null guards correct. (Docs/examples wrong — F9.)
- Concept2 watts step `P = 2.80/(split/500)^3` (rowing.js:116, RowingMetricsCard.jsx:103): exactly the published C2 formula (pace in sec/m); 1:30 split → 480 W ✓.
- `secToSplit`/`splitToVelocity`/`velocityToSplit`: dimensionally correct, guarded.
- `formatSplit` (rowing.js:279-287): tenths-first rounding — immune to the :60 bug; the model implementation the other three copies should use.
- `rowingZone`/`rowingZones`: band edges half-open [pctMin,pctMax) with no gaps/overlaps; UT2 Infinity and Sprint 0 bounds → null boundaries handled by ZoneCalc correctly; ratio<0.93→zone 7, ≥1.20→zone 1 verified. % -of-2k-split bands consistent with British Rowing-style guidance (UT2 ≥120% split ≈ ≤58% of 2k watts).
- `fitCP`: work = CP·t + W′ linearization of the hyperbolic model is exact (P·t = CP·t + W′); OLS algebra verified; degenerate-denominator and non-positive-solution guards present.
- `predict2000mFromMultipleTests`: correct sample stddev (n−1), correct t-critical table (df≤30, z=1.96 beyond), CI of mean = t·s/√n ✓; n=1 → null CI ✓.
- `strokeEfficiency`: distance/strokes with falsy guards ✓. Card's derived strokes = avg_spm × minutes is arithmetically right (slight overestimate on rest-included elapsed time — inherent).
- **v9.474 normalization core**: durationSec-first is correct for BOTH producers — C2 entries carry BOTH duration(min)+durationSec and durationSec wins (no double conversion; verified parseC2CSV:416-417); Strava entries carry duration(min) only → ×60 ✓. Same logic replicated consistently in rowingSplitConsistency:163.
- **Cadence doubling regex** (stravaActivity.ts:288): `/run|walk/i.test(sType)` on the MAPPED type; 'row' never matches → Strava rowing avg_cadence (which IS full strokes/min per Strava semantics) passes through undoubled ✓. avg_spm←avgCadence in the card is therefore unit-correct.
- **W/kg bands + %WR**: thresholds 6.4/5.4/4.4/3.5 monotonic and sane vs Mikulic/Kerr-type norms; pctWR = WR/predicted (faster→higher, capped naturally) with WR 335.8 s = published men's 2k erg record 5:35.8 (sportsRecords.js:84) ✓. (Note: WR is men's — %WR for female athletes compares against men's record; gender-blind by design of getReference.)
- **parseC2CSV**: HH:MM:SS.t / MM:SS.t / SS.t parsing correct incl. non-numeric → 0 → row skipped; BOM strip; header normalization + fallback names; RFC-4180 quote handling (splitCSVLine) verified incl. "" escapes; date ISO+US formats; emitted shape matches what sanitize now whitelists (avg_spm 10-60, drag_factor 50-250, strokes bound, durationSec, sport_type='rowing', avg_hr via the 3-name fallback). split500 math done downstream from distance+durationSec — no duplicate split math in the parser ✓.
- **rowingSplitConsistency**: bucket tolerance edges non-overlapping (500:475-525 … 10000:9500-10500); population stddev is a documented deliberate choice; CV band edges match header doc (2%→DEVELOPING, 4%→DEVELOPING, >4→INCONSISTENT); rpe==null explicit skip + in-band check semantics correct; daysAgo UTC-safe.
- **rowingConsistencyBlockedByRpe semantics**: returns false when ANY in-band RPE exists (analysis path owns it) and true only when null-RPE bucket-matched pieces exist — out-of-band real RPEs correctly do NOT count as blocked ✓ (asymmetric durationSec handling is F10, cosmetic today).
- **derivedSessionTargets rowing**: isRowingSession sport-gate + /row|erg/i ✓; E13→BR zone label mapping documented and intent-sane; dragFactor 80-220 window matches validate.js; WRIC cap note (140M/130W) correct; deriveSessionHr not incorrectly gated off for rowing ✓.
- **eliteProgram rowingGainPerBlock**: monotonic, unit-consistent with its producer (2k time), plausible progression bands; rowingSampleWeek zone split targets (UT 1.15×, AT 1.08×, TR 1.03×) sit inside the BR band definitions ✓; SPM prescriptions (UT2 18-20 … AN 36-40) match Nolte-style guidance and, notably, are more literature-faithful than classifyStrokeRate's bands (F7).
- **rowingTemplates.instantiateTemplate**: zone-midpoint split math correct incl. null-bounded zones (UT2 → splitMax null → falls back sensibly); pctOf2k path correct.
- **ZoneCalc rowing**: uses rowingZones() (single source of truth), t2k/4 → split ✓, boundary null handling (≥/≤) correct.
- **testBattery erg_2km**: instruction-only protocol (max effort, record seconds) — no math to be wrong; correctly maximal-framed (unlike F1's consumer).
- **normalizeSport('row')** → 'Rowing' (constants.js:90-104) — consistent with sanitizeProfile and profile.sport comparisons.
- **Sync round-trip for STRAVA rowing fields**: distance_m/avg_hr/avg_cadence/start_time/elevation/max_hr all survive logRowToEntry↔logEntryToRow ✓ (the loss in F3 is specific to the C2-only fields).
