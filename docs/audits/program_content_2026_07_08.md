# Sport-Specific Program Content Audit — RUN / ROW / BIKE Elite Programs
Date: 2026-07-08. Scope: elite-program modules under src/lib/athlete/ — target derivation, session math, unit conventions, progression vs validatePlan, output contract.
READ-ONLY audit; findings appended as verified.

## Findings

### F1 — HIGH (latent contract bug): `split2kSec` means 2k-TIME in the orchestrator's field-test-ratio contract but sec/500m everywhere the UI produces it
- **Sites mapped (every producer/consumer):**
  - `src/lib/athlete/eliteProgram.js:1371,1377` — `currentLevel.split2kSec = c2kSec` = **total 2000m time (sec)** (e.g. 420 for 7:00). `split500Sec` = c2kSec/4 = sec/500m. Producer of record.
  - `src/lib/athlete/eliteProgram.js:250-253` (`fieldTestGainRatio`) — `start = currentLevel.split2kSec` (2k TIME) and `actual = start - actualResults.split2kSec`, so **`actualResults.split2kSec` must be a 2k TIME** for the math to be sane (rowingGainPerBlock is calibrated in sec-of-2k-time per block, eliteProgram.js:264-270).
  - `src/lib/athlete/eliteProgram.js:1663,1693-1698` (`reAnchorEliteProgram`) — `fieldTest.split2kSec` is **sec/500m** ("2k row time = split sec/500m × 4").
  - `src/components/FieldTestModal.jsx:38` — collects rowing field test as **sec/500m** (min 70 / max 180) under key `split2kSec`; stores raw entries to `sporeus-field-test-results`; calls reAnchorEliteProgram (consistent with THAT function).
  - `src/components/dashboard/FieldTestHistoryCard.jsx:33` — labels `split2kSec` as **s/500m**.
  - `src/lib/athlete/eliteProgramCohorts.js:60` — `currentLevel.split2kSec` (2k TIME) — see F1b check below.
  - `src/lib/athlete/eliteProgramStaleness.js:94-101` — compares `profile.split2kSec` vs `currentLevel.split2kSec` (2k TIME); currently dead for rowing because EliteProgramCard.jsx:1051 passes `split2kSec: undefined` (v9.485 comment).
  - `src/lib/athlete/physiologyGapInsight.js:127-130` — already documents the ambiguity; prefers `split500Sec`, falls back to `split2kSec` — the fallback would compute a "gap" between 2k-times as if they were splits, but since split500Sec is always emitted alongside, fallback is unreachable in practice.
- **Failure scenario:** any caller that forwards a stored field-test result (sec/500m, e.g. 105) into `buildEliteProgram({ actualFieldTestResults })` for rowing gets `actual = 420 − 105 = 315 s` of "gain" vs an expected ~2 s → ratio ≈ 150 → half-step then clamped to **+30% Peak/Taper TSS, always**, regardless of whether the athlete improved or regressed. Today `actualFieldTestResults` has **no UI caller** (grep: only eliteProgram.js + a FieldTestModal comment), so the bug is latent, but the two halves of the same feature (v9.8.0 input + v9.177.0 modal) use opposite conventions under the same key — first person to wire them together ships the bug.
- **Fix suggestion:** rename the currentLevel field to `time2kSec` (it is not a split), keep `split500Sec` as the only split-unit field, and make `fieldTestGainRatio` accept `{ split500Sec }` (× 4 internally). At minimum add unit suffixes to the JSDoc contracts at eliteProgram.js:224 and :1628 — :1628 currently documents `split2kSec` for BOTH functions while they disagree.

### F2 — MED (founder question, quantified): rowing template TSS assumes 2k pace for ALL zones
- `src/lib/sport/rowingTemplates.js:186-189`: `avgSplitSec = split2000Sec // approximation for total session time`; `totalSec = (totalWorkM/500) × split2000Sec`; `TSS = tssMultiplier × 100 × hours`.
- The prescribed interval splits (same function, lines 171-183) are zone-midpoint splits — UT2 = 1.20× 2k split (open-ended band, uses splitMin), UT1 mid = 1.16×, AT mid = 1.09×, TR mid = 1.035×, 2k-pace mid = 0.99×, AN mid = 0.95×. Session **duration** is therefore systematically wrong by exactly that factor, and TSS scales linearly with it:
  | Template | pace factor vs 2k | TSS error |
  |---|---|---|
  | ut2_steady (12km) | 1.20 | **−16.7%** (underestimates duration+TSS) |
  | ut1_steady (14km) | 1.16 | −13.8% |
  | at_threshold (4×2k) | 1.09 | −8.3% |
  | tr_pieces (6×1k) | 1.035 | −3.4% |
  | race_pace (8×500) | 0.99 | +1.0% |
  | an_power (10×250) | 0.95 | +5.3% |
- Concrete: athlete with 1:45.0 2k split (105 s/500m, 7:00 2k). ut2_steady: assumed 2520 s (42:00) → TSS 38.5. Actual at prescribed 2:06 UT2 split: 3024 s (50:24) → TSS 46.2. Every UT2 session under-counts ~7.7 TSS; on the base weekly mix (2× ut2 + ut1 + at, weeklyTemplatePlan) the week under-counts ≈ **−25 TSS/wk (~12%)** vs its own prescriptions.
- Also excludes rest time between intervals from duration (restMin 3-6 × reps), a second (smaller, deliberate for work-TSS) omission.
- **Fix:** use the interval's own targetSplitSec to compute totalSec (the data is already computed 3 lines above); duration for step_test already carries durationMin.
- Note: `rowingSampleWeek` itself (eliteProgram.js:856-934) carries explicit `durationMin` per session and no TSS field — the 2k-pace assumption lives only in the template instantiation path (SportProgramBuilder.jsx:89).

### F3 — HIGH (live, verified by execution): applyCyclePhaseGate destroys the entire weeklyTSS array for opted-in female athletes
- `src/lib/athlete/eliteProgram.js:1476-1479` passes `weeklyTSS` — an **array of numbers** (buildWeeklyTSS pushes `Math.round(...)`; fieldTestRecal and the ACWR cap keep numbers) — into `applyCyclePhaseGate`.
- `src/lib/athlete/cyclePhaseGate.js:195-215` documents and implements the input as `Array<{week, phase, tss}>`: it returns `{ ...w, cycleMultiplier, cyclePhase, cycleAdjustedTSS: Math.round((Number(w.tss)||0) × mult) }`. Spreading a **number** yields `{}`, and `w.tss` is undefined.
- Executed: `applyCyclePhaseGate([350,365,380], gate2wk)` → `[{cycleMultiplier:0.95,cyclePhase:"luteal",cycleAdjustedTSS:0},{...,cycleAdjustedTSS:0},380]`. The canonical TSS value is erased and cycleAdjustedTSS is 0.
- The gate is built with `weeks: weeklyTSS.length` (eliteProgram.js:1476), so **every week** of the plan is converted. The path is LIVE: EliteProgramCard.jsx:1718-1751 (v9.182.0) deliberately injects `gender` + `lastPeriodStart` into the profile so `buildCyclePhaseGate` resolves. Any female athlete who set lastPeriodStart gets a program whose weeklyTSS is `[{...no tss...}, ...]`.
- Blast radius: `eliteProgramToYearlyWeeks` (eliteProgramToYearly.js:146) does `Number(tss[i]) || 0` → **targetTSS = 0 for all weeks** on ProgramCalendar; `buildRecoveryProgram({ weeklyTSS })` (eliteProgram.js:1545, called after the gate) scales against corrupted objects; the weekly-TSS chart and FieldTestModal sums read 0/NaN. Contradicts the v9.181 comment at eliteProgram.js:1471-1474 ("tss ... stays authoritative").
- **Fix:** map numbers → `{ tss: w, cycle... }` explicitly, or (less invasive) compute `cycleAdjustedTSS` from `Number(w.tss ?? w) || 0` and keep emitting numbers plus a parallel `cycleAdjustments` array so downstream numeric consumers survive.

### F4 — MED: elite programs are never run through the app's own plan validators; the 3:1 deload rebound would fail one of them
- No call path passes elite output through `validatePlanRamp` (src/lib/formulas.js:434 — the Coggan 5-7 TSS/wk CTL band; only PlanGenerator.jsx:366/374 calls it) or `periodization.validatePlan` (src/lib/periodization.js:229) or `plan/planValidators.validatePlan`.
- Executed check (buildWeeklyTSS replica, 16wk run/marathon split Base6/Build6/Peak2/Taper2):
  - CTL 50 → weeklyTSS `350,365,380,285,410,425,425,285,445,455,465,285,475,475,200,125`; projected CTL never gains >7/wk (max ≈ +2) → **passes the Coggan 5-7 band** at CTL 50, 20 and 10. The curve is CTL-anchored (baseLow = CTL×7), so ramp safety is structural. ✓
  - BUT `periodization.validatePlan`'s ">50% week-over-week TSS jump — injury risk" rule fires at wk9 (285→445, +56%) and wk13 (285→475, +67%): the 60% deload (DELOAD_NOTE, eliteProgram.js:158) mathematically guarantees a 1/0.6 = 1.67× rebound whenever the post-deload target has kept climbing. Either the deload should be phase-local (60% of the *surrounding* weeks, not of buildPk) or the elite path should run the validator and surface the warning. eliteProgramToYearly week objects (targetTSS/phase/weekNum/isDeload) are already shape-compatible with periodization.validatePlan — it's one function call away.
  - `plan/planValidators.validatePlan` structurally CANNOT run on elite output: it requires `weeks[].sessions[]` and elite weeks carry `sessionsBlueprint` instead → every week would be EMPTY_WEEK (see F9).

### F5 — MED: static sample weeks under-deliver the weeklyTSS phase targets for RUN and ROWING (~40% gap at default CTL)
- sampleWeeks templates are fixed (eliteProgram.js:633-934) regardless of currentCTL/weeklyHours, while weeklyTSS targets scale with CTL. Estimating session TSS from the templates' own zone-minutes (Coggan IF midpoints Z1 0.60/Z2 0.70/Z3 0.83/Z4 0.98/Z5 1.13 → 36/49/69/96/128 TSS/hr):
  - Run Build week (Tue thr 2x20, Thu VO2 5x3, Sun long+MP…): Z1 210' + Z2 20' + Z4 40' + Z5 35' ≈ **281 TSS** vs Build target 425-475 @ CTL 50.
  - Rowing Build week (AT 4x2000, UT1 90', TR 5x1000, UT2 90'…): Z1 190' + Z2 80' + Z3 45' + Z4 30' ≈ **279 TSS** vs 425-475.
  - Bike Build week (80+75+80+210+90 = 535 min): ≈ **488 TSS** — consistent with target. ✓
- So the two surfaces disagree: ProgramCalendar/EliteProgramCard display CTL-scaled targetTSS while todayProgrammedSession serves the fixed template sessions; a CTL-50 runner following the daily answers logs ~60% of the weekly target the same card shows. Run/rowing templates match a ~CTL-35 athlete. (Strength weave adds 25-60 min uncounted on top.) Suggest scaling template durations by weeklyTSS[week]/templateTSS, or labelling sampleWeeks explicitly as non-target-bearing.

### F6 — MED: FieldTestModal before/after Peak+Taper TSS comparison always shows 0 → 0
- `src/components/FieldTestModal.jsx:59-70` `sumTSS` does `weeklyTSS.find(w => w.week === wkNum)` then `Number(wk.tss)`. `program.weeklyTSS` is an array of **numbers** indexed 0-based (week n = index n−1); numbers have no `.week`/`.tss`, so find() never matches and both prevTSS and newTSS are 0 (rendered at :278-285). The v9.177 re-anchor comparison feature is dead on arrival. Fix: `weeklyTSS[wkNum - 1]`.

### F7 — MED-LOW: bike TT speed→FTP heuristic is linear in speed; feasibility optimistic ~3×
- eliteProgram.js:1292-1298 (and the synthesis copy at :1166-1176): `ftp ≈ 250 × speedKmh / 35`. Aero power scales ≈ v³, so a 5% TT speed improvement is ~15.8% more watts, but the heuristic computes a 5% FTP gap → `weeksNeeded = gap/ftpGainPerBlock × 12` is **underestimated ≈ 3×** for bike TT inputs, inflating 'comfortable/realistic' feasibility bands. Direct-FTP mode (distanceM=0) is unaffected. Acceptable as a labelled simplification, but the band copy ("realistic with consistent training") presents it as calibrated. Suggest cubing: `gFtp = cFtp × (gSpeed/cSpeed)³` for the gap even if the absolute anchor stays heuristic.

### F8 — LOW: rowing pace tags sit one zone fast/slow vs the app's own British Rowing bands (sport/rowing.js:143-151: UT2 ≥1.20, UT1 1.12-1.20, AT 1.06-1.12, TR 1.01-1.06, 2k 0.97-1.01, AN 0.93-0.97)
- `rowingSampleWeek` eliteProgram.js:858: `utTag = split × 1.15` is used for BOTH UT2 and UT1 sessions — 1.15 is inside the UT1 band, so every "UT2 steady/long" session carries a UT1-zone target (the app's own `rowingZone(1.15×s, s)` returns 2, and the SPM target says 18-20 while the pace says UT1). atTag 1.08 ✓, trTag 1.03 ✓.
- `eliteProgramKeySessions.js:923`: UT1 prescribed at "~110% of 2k split" — 1.10 falls in the **AT** band (1.06-1.12), not UT1. UT2 at ~115% (:903) again = UT1 band. AT 108% ✓, TR 103% ✓, AN 95% ✓.
- `rowingSampleWeek` Peak Sat "AN power 10x250m" (eliteProgram.js:915) uses `splitTag` (1.00× = 2k pace) though AN is 0.93-0.97 — target too slow for the stated intent; keySessions' AN session says 95% correctly.
- Fix: UT2 tag ≥1.20 (or a 1.20-1.25 display band), key-session UT1 → ~113-116%, AN sample-week tag → ×0.95.

### F9 — LOW: output-contract drift (documented, no live breakage found)
- generatePlan (src/lib/plan/generatePlan.js:413-422) emits `weeks[].sessions[]` = `{ day: 1-based number, intent, targetTSS, rpeLow, rpeHigh }` with authoritative `weeklyTSS` per week; planValidators consumes exactly this.
- Elite path emits `phases[] + weeklyTSS[numbers] + sampleWeeks{phase: day[]}` where day = `{ day:'Mon'|…, intent:{en,tr}, durationMin, zones{Z1..Z5}, paceTarget, spm/rpm/cadenceTarget, strength }`; eliteProgramToYearlyWeeks bridges to YearlyPlan weeks with `targetTSS/plannedHours/zoneDistribution/sessionsBlueprint` (eliteProgramToYearly.js:146-168). No `sessions[]`, no per-session tss/rpe anywhere in the elite path; todayProgrammedSession emits `{durationMin, zones, paceTarget}` (todayProgrammedSession.js:205-226) — consumers (TodayProgrammedSessionCard, ProgramCalendar, MarkDoneCell) all speak blueprint natively. The two vocabularies coexist by design but mean the elite path can never reuse plan-side validators/exporters without an adapter.
- `plannedHours = targetTSS/60` assumes 60 TSS/hr (IF≈0.775) — same convention as periodization.js ✓ consistent.

### F10 — LOW: run sample week truncation breaks the positional Mon..Sun contract for trainingDays 3-4
- runSampleWeek (eliteProgram.js:708) slices the 7-day array to `max(5, days+2)` when trainingDays < 7 → 5 elements (Mon-Fri) at trainingDays=3, 6 (Mon-Sat) at 4. The v9.24 comment (:585-590) states the array is positionally indexed Mon=0..Sun=6, and todayProgrammedSession.js:180-182 clamps out-of-range days to the LAST element — so a trainingDays=3 runner's Sat AND Sun both resolve to Friday's "Rest", and the Sunday long run (the key aerobic session) disappears from the program entirely rather than being redistributed. Also: trainingDays is consumed only by the run week — bike (:714) and rowing (:856) weeks are fixed 7-day/5-session templates regardless of profile.trainingDays.

### F11 — LOW (latent): fmtPaceStr / fmtSwimPace can render "4:60/km"
- eliteProgram.js:570-583 round the remainder (`s = Math.round(secPerKm % 60)`) — the exact bug class fixed in rowing's fmtSplit (rowing.js:92-97, v9.487 "rounding the remainder alone rendered 1:60") but not ported. Currently unreachable from inside eliteProgram (trainingPaces returns integers), but both are @public exports; any fractional input ending ≥ x:59.5 renders `x:60`. One-line fix: round total first.

### F12 — INFO
- eliteProgram.js:491 sets ACWR_DANGER_ZONE_RATIO = 1.5 (Gabbett danger zone) but the call-site comment at :1456-1458 says "Caps absolute weekly TSS at 1.3 × weekly-CTL (sweet-spot upper bound)". Code = 1.5; one comment is wrong.
- eliteProgramCohorts.js:59 comment says "2k split in seconds" while the thresholds (480/420) and the value (`currentLevel.split2kSec`) are 2k TIMES — math is correct (7:00/8:00 boundaries match rowingGainPerBlock bands) but the label feeds the F1 naming confusion.
- eliteProgramStaleness.js:94-101 compares `profile.split2kSec` (never produced — EliteProgramCard.jsx:1047-1051 passes `undefined` per v9.485) against currentLevel 2k-time; if a future producer stores the FieldTestModal sec/500m value there, staleness deltas become nonsense — same F1 family.
- reAnchorEliteProgram (eliteProgram.js:1673-1675) falls back to `program.feasibility?.distanceM`, a field feasibility never carries — harmless (10000 fallback engages) but dead code.

## Checked clean (verified math / units)
1. **Daniels VDOT chain** (sport/running.js:39-46, 59-70, 82-120): executed `vdotFromRace(5000, 1200)` → 49.8 (Daniels table ~49.8 ✓); `predictRaceTime(52, 10k)` → 2398s = 39:58 (table ~40:00 ✓); `trainingPaces(52)` → E 5:10, M 4:22, T 4:05, I 3:47, R 3:35 /km — all within Daniels 3rd-ed table bands; units are sec/km throughout and `fmtPaceStr` formats sec/km → "m:ss/km" ✓. T-pace defers to the canonical vdotToThresholdSec table with I<T<M clamp (v9.365 fix) ✓.
2. **Coggan bike zones** (sport/cycling.js:39-47): 0-55/55-75/75-90/90-105/105-120/120-150/150+ %FTP — textbook Coggan 7-level ✓. `bikeSampleWeek` FTP round-trip (eliteProgram.js:716): midpoint of Z4 (0.90-1.05) = 0.975 → ÷0.975 recovers FTP exactly (±1W rounding) ✓.
3. **British Rowing zone table** (sport/rowing.js:143-151) percentages internally consistent, `rowingZones(split500)` correctly receives sec/500m from eliteProgram.js:1373 (c2kSec/4) ✓; `fmtSplit` rounds total-first (v9.487) ✓; Paul's Law exponent 1.07 ✓; secToSplit/velocity conversions ✓; Concept2/Hagerman VO2max matches published Y = a + b·t(min) form with correct sex/weight branches ✓.
4. **Rowing gain calibration** (eliteProgram.js:264-270) and cohort boundaries (eliteProgramCohorts.js:58-65) both keyed on 2k TIME consistently; feasibility gap/rate/weeksNeeded dimensionally consistent (seconds of 2k time) ✓.
5. **Weekly TSS ramp passes the app's Coggan 5-7 band**: executed validatePlanRamp replica at CTL 50/20/10 — max CTL gain ≈ +2/wk, zero warnings (curve is CTL-anchored: baseLow=7×CTL ⇒ wk1 ACWR = 1.0 exactly) ✓.
6. **Taper percentages** (buildWeeklyTSS): T-2 = 63%, T-1 = 42%, race week = 26% of peak weekly load — consistent with Mujika & Padilla 2003 (41-60% progressive volume reduction, intensity preserved in sampleWeeks Taper) ✓.
7. **Distance-aware phase multipliers + redistribution** (eliteProgram.js:342-452): re-normalization conserves total weeks, Taper preserved, floors handled; rowing 2k/Erg/5k categories sane ✓.
8. **ACWR safety cap** (eliteProgram.js:491-525): ceiling 1.5 × 7 × CTL = 525 @ CTL 50 vs curve max 475 — correctly inert for its own curve, engages only after +30% field-test scaling (617 → capped) ✓.
9. **EliteProgramCard wires real CTL** (EliteProgramCard.jsx:1698-1704) so the currentCTL=50 default doesn't silently mis-anchor the curve at the primary call site ✓.
10. **FieldTestModal → reAnchorEliteProgram** rowing path is internally consistent (sec/500m in, ×4 to 2k time, same-unit round-trip) ✓ — the inconsistency is only vs fieldTestGainRatio (F1).
11. **fieldTestRecal maths** (eliteProgram.js:1428-1454): half-step + [0.7,1.3] clamp, applied to Peak+Taper only, correct week indexing (peakStart = base+build) ✓.
12. **Deload note vs implementation**: "~60% of build target" (DELOAD_NOTE) = `buildPk * 0.6` in code ✓ (but see F4 for the rebound it creates).

## Bottom line
RUN paces, BIKE zones and the ROWING zone/split conversion libraries are correct against their cited sources. The failures are at the seams: one live weeklyTSS-corrupting type mismatch (F3), one latent unit collision on `split2kSec` (F1), the founder's rowing-TSS question quantified at −16.7% for UT2 / ~−12% weekly (F2), validators that are never invoked and one that would legitimately fire (F4), and static sample weeks that under-deliver their own CTL-scaled targets for run/rowing (F5).

