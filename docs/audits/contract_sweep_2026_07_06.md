# Dead-Card Contract Sweep — 2026-07-06

Bug-class: consumers reading log-entry / profile fields that no producer emits
(or that the sanitizer whitelist strips). Reference cases: RowingMetricsCard
(`sport_type`/`distance`/`strokes`/`avg_hr`) and DurabilityCard (`entry.powerStream`).

Status: COMPLETE — 2026-07-06. 14 verified finding groups (7 HIGH), severity table at end.

## Producer inventory (verified by reading)

**Entry — hydration keys** (`useSupabaseData.js logRowToEntry:60`): id, date, type, duration, tss, rpe, zones, notes, source, distanceM, avgHR, avgCadence, decouplingPct, np, avgPower, maxHR, elevationGainM, kilojoules, sufferScore, startTime, rpeMethod, wPrimeExhausted, wPrimeMethod, calories, sessionTag, sessionTagReason, powerPeaks.

**Entry — sanitizer whitelist** (`validate.js sanitizeLogEntry:76`): all hydration keys PLUS hasPower, restDayMarked, sickDay, correctiveRest, improvisedSession, plannedType, distance, distanceKm, durationSec, sport_type ('rowing' only), avg_spm, drag_factor, strokes. (Input aliases accepted: avgHr/avg_hr→avgHR, normalizedPower→np, maxHr→maxHR.)

**Entry — DB row persistence** (`logEntryToRow:111`): persists only the hydration-key set. Whitelist-only fields (hasPower, restDayMarked, sickDay, correctiveRest, improvisedSession, plannedType, distance, distanceKm, durationSec, sport_type, avg_spm, drag_factor, strokes) have NO column → localStorage-only, wiped on hydration for signed-in users. (Sibling class — see Findings §B.)

**Recovery** (`recRowToEntry:169` / `recEntryToRow:183`): date, score, sleepHrs, sleep, soreness, energy, stress, mood, hrv, notes. sanitizeRecovery is pass-through (rmssd, lnRMSSD, restingHR, lactate, readiness, bedtime, wake survive locally) but recEntryToRow drops everything outside the 10 columns → same sync-wipe class for restingHR/lactate/readiness/bedtime.

**Profile whitelist** (`sanitizeProfile:301`): name, sport, primarySport, triathlonType, secondarySports, athleteLevel, age, weight, height, gender, ftp, vo2max, maxhr, threshold, thresholdDerived, ltPace, cssSec, dragFactor, goal, neck, waist, hip, email, weeklyTssGoal, lastPeriodStart, cycleLength, raceDate, nextRaceDate, trainingDow, trainDays. **NOTE: no `cp` / `wPrime`** despite resolveCPWPrime reading them (verify write path).

**Producer emissions of note**:
- QuickAddModal:207 emits date, type, duration, durationSec, rpe, tss, notes, distanceKm, avgHr.
- parseC2CSV (fileImport.js:409) emits sport, sport_type, distance, distanceM, duration, durationSec, avg_spm, drag_factor, avg_hr, avg_power, avgPaceSec500m, notes, source. **Never emits `strokes`** (whitelisted but produced by nothing). `sport` + `avgPaceSec500m` are sanitizer-STRIPPED.
- TrainingLog confirmImport raw (TrainingLog.jsx:597) includes `avgPaceSecKm` — NOT in whitelist → stripped at setLog (comment claims persistence; false).

## Findings

### §A — The `durationMin` dead-lib cluster (canonical field is `duration`)

Canonical entries store minutes under `duration` (whitelist + hydration). A family of athlete libs reads `entry.durationMin ?? entry.duration_min` with **no `duration` fallback** — both names exist only on the FIT-preview object (fileImport parseFIT return) and the raw DB row, never on a log entry. Every card below receives the raw `log` prop directly (verified at call sites).

**A1. weeklyEnduranceTime.js:104** `entryDurationMin: entry?.durationMin ?? entry?.duration_min` — all real entries → 0 min → `nonZeroWeeks < MIN_NON_ZERO_WEEKS` gate (line 230) → returns null → **WeeklyEnduranceTimeCard DEAD** (renders nothing, forever). Severity: HIGH. Fix: `entry?.duration ?? entry?.durationMin ?? entry?.duration_min`.

**A2. veryEasyShare.js:68** same helper — totalRatedMin always 0 < MIN_RATED_MIN (60) → null → **VeryEasyShareCard DEAD**. Severity: HIGH. Same fix.

**A3. sessionLengthDistribution.js:77** same helper — every session's duration 0 → no bin match (`findBinId` returns null) → totalSessions below MIN_SESSIONS / all bins empty → **SessionLengthDistributionCard DEAD**. Severity: HIGH. Same fix.

**A4. postLongRunNextDay.js:78** same helper — long-run detection needs durationMin ≥ threshold; always 0 → no long runs ever detected → **PostLongRunNextDayCard DEAD** (tss fallback exists only for day aggregation, not the long-run gate — verify on fix). Severity: HIGH. Same fix.

**A5. backToBackLongDay.js:80** same helper — "long day" = duration above threshold; all 0 → no long days → **BackToBackLongDayCard DEAD**. Severity: HIGH. Same fix. (Note: its `entrySport` also reads `entry.sport` first — stripped field — but falls back to `type`, OK.)

**A6. timeOnFeet.js:74** `Number(entry?.durationMin)` only (not even duration_min) — weekly run minutes all 0 → classifyBand(0,0) → null → **TimeOnFeetCard DEAD**. Severity: HIGH. Fix: read `entry.duration` first.

**A7. raceTimeEstimator.js:143** `const dur = Number(e?.durationMin)` — always NaN/absent → `runs` empty → returns null → **RaceTimeEstimatorCard DEAD**. Severity: HIGH. (Its distance read `e.distanceKm` at :142 is satisfied only by manual QuickAdd entries; FIT/Strava entries carry `distanceM` — add distanceM/1000 fallback while fixing.) Fix: `e.duration` + distanceM fallback.

**A8. volumeIntensityScissors.js:154** `const duration = Number(e.duration_min)` — raw log passed in (VolumeIntensityScissorsCard.jsx:135) → totalMinutes/avgIntensity 0 for every week → card renders an all-zero scissors chart (or gates on empty). **DEAD/WRONG-OUTPUT**. Severity: HIGH. Fix: `e.duration`.

**A9. yearOverYear.js:32** `minutes += Number(e?.durationMin) || 0` — minutes metric permanently 0 for BOTH years (delta null) while sessions/tss work → **YearOverYearCard DEGRADED** (one of three comparison rows dead). Severity: MEDIUM. Fix: `e.duration`.

**A10. checkInQuality.js:19,64** `QUALITY_FIELDS = ['rpe','tss','durationMin','heartRate']`, presence tested via `entry[field]`. Canonical names are `duration` and `avgHR` → those two fill-rates are permanently 0%, avgQuality capped at 0.5 → **CheckInQualityCard DEGRADED-WRONG**: always reports duration+HR as never-logged and can never leave the low band, even for perfect data hygiene. Severity: HIGH (actively misleading). Fix: map fields to `duration`/`avgHR` (accept aliases).

**A11. restDayEnergyTrend.js:128** `isTrainingEntry` duration check reads `durationMin ?? duration_min` — but the `tss > 0` check above it saves nearly all real entries. Only zero-TSS-with-duration entries are misclassified as rest days. **FALSE ALARM (borderline)** — fix cosmetically when touching the file. Severity: LOW.

### §B — Consumer reads phantom fields on canonical shapes (RowingMetrics/Durability class)

**B1. Dashboard.jsx:399-402 — EF trend running branch DEAD.** `efSessions` maps `avgPaceMPerMin: e.avgPaceMPerMin` and `sport: e.sport` — NEITHER field exists on any produced entry (not in whitelist, not hydrated, no importer writes them). `computeEF` (science/efficiencyFactor.js:24) needs `np`/`avgPower` (cyclists, works) OR `avgPaceMPerMin` (runners) → the pace/hr branch can never fire. **EFTrendCard is permanently dead for runners** — the app's primary audience. Severity: HIGH. Fix: derive in the map: `avgPaceMPerMin: e.distanceM > 0 && e.duration > 0 ? e.distanceM / e.duration : undefined`, and infer sport from `e.type`.

**B2. detectPRs.js:153-161 — longest-distance + fastest-pace PRs NEVER fire.** Reads `newSession.distance` (as km) then `distanceM`. Sole call site is QuickAddModal.jsx:220 with the raw manual entry, which carries **`distanceKm`** — never read → `distKm = 0` → PR categories 5 (longest_distance) and 6 (fastest_pace) are DEAD everywhere (no other caller). Latent unit bug on top: the only producer of `distance` is parseC2CSV, in METERS — if a C2 path ever calls detectPRs, a 6000 m erg becomes a "6000 km" PR. Severity: HIGH. Fix: read `distanceKm` first; treat `distance` as meters (or drop it).

**B3. seasonStats.js:46-47 — season distance + sport breakdown effectively dead.** `distanceKm = e.distance > 0 ? e.distance/1000 : 0` — `distance` is produced ONLY by Concept2 CSV; Strava/FIT entries carry `distanceM`, manual entries `distanceKm` — neither read → **totalDistanceKm ≈ 0 for everyone except C2 rowers**. `sport = e.sport_type || e.sport || 'general'` — `sport` is sanitizer-stripped and `sport_type` exists only on local C2 entries → sport breakdown collapses to a single 'general' bucket (no `type` inference). SeasonStatsCard renders wrong/empty distance + meaningless breakdown. Severity: MEDIUM-HIGH (card visibly renders, silently wrong). Fix: `e.distanceM/1000 ?? e.distanceKm ?? e.distance/1000`; infer sport from `e.type` regex like `_logSport.js`.

**B4. EliteProgramCard.jsx:1700-1704 — weeklyHours / trainingDays phantom personalization.** Reads `_profile?.weeklyHours` and `_profile?.trainingDays` with `typeof === 'number'` guards. (a) NOTHING writes `weeklyHours` to the profile (grep: only function params elsewhere); (b) the profile's real field is `trainDays`, and sanitizeProfile stores all numerics as STRINGS — so even a whitelisted value would fail the `typeof number` guard. Both personalization inputs silently fall to defaults; elite program ignores the athlete's actual availability. Severity: MEDIUM. Fix: read `Number(profile.trainDays)`; either add a weeklyHours source or drop the read.

**B5. EliteProgramCard.jsx:1042-1045 — plan-staleness dead for run/row athletes.** `profileLevel = { vdot: profile.vdot, ..., split2kSec: profile.split2kSec ?? profile.split2k }` — `vdot`, `split2kSec`, `split2k` are written by no producer and not in the profile whitelist (`css` fallback likewise; only `cssSec` exists). Staleness detection works only via ftp/cssSec → runners/rowers never get the "profile outpaced the plan" nudge. Severity: MEDIUM. Fix: derive vdot from vo2max/threshold; use eliteProgram's split-from-profile derivation.

**B6. raceGoalEngine.js:91 — `profile.lthr` has no producer.** `hasLTHR` can never be true; the "MEASURED" LTHR label is unreachable. Working fallback (87% of maxhr) → card functions. Severity: LOW (dead branch + unreachable label). Fix: whitelist + collect lthr, or delete the branch.

**B7. hrvAutonomicBalance.js:42-43 — `e.lnRmssd` casing phantom.** Producer (HRVDashboard.jsx:249) writes `lnRMSSD` (capital); consumer reads `lnRmssd`. Branch dead; `rmssd` fallback fires locally so output OK for guests. Severity: LOW. Fix: accept both casings.

### §C — Profile whitelist eats producer fields (sanitizeProfile returns ONLY whitelisted keys; Profile.jsx:73 save + useAppState.js:525 onboarding both run it on the full merged profile)

**C1. CP test results wiped: `cp`, `wPrime`, `powerZones`.** Protocols.jsx:201/:428 write them (CP/FTP test outcomes); consumers: formulas.js resolveCPWPrime:221 (W′ exhaustion badge precision), PowerCurve.jsx:62 ('profile'-sourced CP), QuickAddModal/ZoneCalc (powerZones). The NEXT Profile save or onboarding pass silently deletes all three → measured CP degrades to `estimated` (0.95×FTP + 15 kJ default), power zones revert to FTP-derived. Silent loss of a physiological test the athlete performed. Severity: HIGH. Fix: whitelist cp/wPrime (numStr) + powerZones (shape-validated) in sanitizeProfile.

**C2. Notification prefs wiped: `notifications`, `preferred_checkin_time`, `timezone`.** Written by NotifReminders.jsx:52/82/87/91, read back by NotifReminders + pushNotify.js:226 (check-in push scheduling) + CoachOnboardingWizard.jsx:126. Any Profile save resets reminder prefs to defaults and drops the timezone → scheduled check-in pushes revert to 07:00 defaults without user action. Severity: HIGH. Fix: whitelist all three (validate HH:MM / IANA tz / prefs shape).

### §D — Recovery sync round-trip drops produced+consumed fields (recEntryToRow persists only 10 columns; hydration REPLACES the local array — useSupabaseData.js:431)

Recovery.jsx form produces `restingHR`, `bedtime`, `wake`, `lactate`; HRVDashboard produces `rmssd`, `lnRMSSD`. sanitizeRecovery deliberately passes them through — but recEntryToRow (useSupabaseData.js:183) drops them and recRowToEntry never returns them, so **for signed-in users every one of these fields vanishes on the next hydration** (page load). Consumers silently starve:
- `restingHR` → restingHrDrift.js, restingHrFitnessTrend.js, postHardSessionResponse.js, recoveryQualityStreak.js (4 cards degrade/blank after reload)
- `bedtime` → bedtimeConsistency.js (card dead after reload)
- `rmssd` → hrvAutonomicBalance.js precision path + HRVDashboard trend (falls back to rounded `hrv`, losing precision)
- `lactate`, `wake` → no dashboard consumer (input-only; lower priority)

Guests (localStorage-only) are unaffected, which is why this survives testing. Severity: HIGH (class), per-field MEDIUM. Fix: add columns (mirroring the v9.397/9.465 training_log enrichment pattern) or a `extras` JSONB column round-tripped through both mappers.

### §E — Entry whitelist-only fields lost cross-device (sanitizer keeps them, logEntryToRow has no column, hydration replaces local log)

Fields: `sport_type`, `avg_spm`, `drag_factor`, `distance`, `distanceKm`, `durationSec`, `hasPower`, `restDayMarked`, `sickDay`, `correctiveRest`, `improvisedSession`, `plannedType`. Verified consumer impact:
- **E1.** `restDayMarked` → trainingStreak.js (rest-day streak preservation) + TodayView; `sickDay`/`correctiveRest` → TodayView; `improvisedSession`/`plannedType` → TrainingLog badges. All adherence signals silently die after hydration on a second device / reload for signed-in users. Severity: MEDIUM.
- **E2.** `drag_factor` → RowingMetricsCard drag-vs-class-norm analysis (entry-level DF lost; profile.dragFactor partly compensates). `avg_spm`/`durationSec`/`distance` have surviving fallbacks (avgCadence/duration/distanceM persist). Severity: LOW-MEDIUM.
- **E3.** `hasPower` → PowerCurve.jsx (power-session detection). Severity: LOW (power blob is localStorage-side-channel anyway; powerPeaks now persists).
- **E4.** `distanceKm` (manual QuickAdd) is merged into `distance_m` on write (logDistanceM) and comes back as `distanceM` — consumers with distanceM fallbacks OK; detectPRs (B2) is the one that isn't.
Fix direction: columns for the adherence flags (booleans) or an entry-extras JSONB; document which whitelist fields are local-only.

### §F — Producer-side dead ends (noted, not consumer bugs)

- `strokes` is whitelisted (validate.js:172) and read by RowingMetricsCard, but NO producer emits it — parseC2CSV computes everything except strokes. Card derives from avg_spm×duration, so harmless; whitelist entry is currently pointless. LOW.
- `avgPaceSec500m` (parseC2CSV) and `avgPaceSecKm` (TrainingLog.jsx:610 FIT confirm) are both sanitizer-STRIPPED. avgPaceSecKm's only reader (sessionExecution.js:98) has a distanceM+duration fallback, so no dead card — but the TrainingLog comment claiming it persists is false. Either whitelist them or remove the writes. LOW.
- Recovery `lactate` has no dashboard consumer (input → nothing). Known dead-input class (physiology pipeline audit). LOW.

## Checked clean (swept, verified sound)

**§A cluster — working fallbacks:** longRunConsistency.js:95 (`duration` first), calendarHoles.js:70, trainRestTrainPattern.js:93, seasonRestartCount.js:66, sessionGapVariance.js:79 (all read `duration_min ?? durationMin ?? duration` or presence-only), TriathlonWeekBalanceCard durationMinOf (`duration` first), hrForRpe.js:127 (`avgHR` first), sleepConsistency/sleepCtlCorrelation/preRaceSleepBanking (`sleepHrs` first), cyclingNpTrend (`np ?? normalizedPower`). Plan/program-shaped `durationMin` reads (sessionLibrary, eliteProgram, todayProgrammedSession, NextTrainingCard, ProgramCalendar, RaceGoalDashCard, TrainingBridgeCard, DailyBriefingCard, planAdherence day objects, quickLogFromSession, nutritionTiming, triathlonWeekBalance lib) are NOT log-entry reads — sound.

**Other groups swept and found sound:**
- RowingMetricsCard.jsx (post-v9.474): full fallback chain (`sport_type` OR type/sport regex; distance←distanceM; avg_hr←avgHR; avg_spm←avgCadence; strokes derived) — correct against canonical shape.
- DurabilityCard.jsx / durabilityScore.js (post-v9.480): powerPeaks-first with legacy powerStream fallback — correct.
- hrForRpe.js:127 (`avgHR ?? heartRate ?? avg_hr`), cyclingNpTrend.js (`np ?? normalizedPower`), decouplingTrend (decouplingPct hydrated since v9.464), altitudeStimulus (elevationGainM), triLoad (avgPower), timeOfDayConsistency.js:58 (`startTime ?? time ?? timeOfDay`) — all read hydrated fields first.
- rowingSplitConsistency.js:155-163 (`distance ?? distanceM`, `durationSec` → `duration*60`), predictRacePerformance (intelligence.js:981, distanceM|distance|distanceKm), sessionExecution.js:98 (pace fallback from distanceM+duration) — sound.
- weeklyEnduranceTime classifyEntry / hardSessionTypePattern / easyDayCompliance: phantom `entry.zone` / `entry.intent` reads all fall through to rpe/type — sound (zone/intent only exist on plan-shaped sessions).
- Recovery consumers on the 10 persisted columns (sleep/soreness/energy/mood/stress/sleepHrs/hrv/score): hrvAlertSummary, moodEnergyBalance, energySorenessDivergence, stressPattern, recoveryRecommender, ruleAlerts, sleepConsistency/sleepCtlCorrelation/preRaceSleepBanking (`sleepHrs ?? sleepHours`) — sound.
- Plan/program/strength/test shapes (todayProgrammedSession, planAdherence, eliteProgram*, strengthTraining session_date, runningCV via `session.duration`, batteryProgress testId, cpDecay test-result cp): different contracts, correctly fed — not entry reads.
- Dashboard.jsx sport gating (hasCyclingData/hasSwimData/hasTriData): reads e.type with e.sport as secondary — sound.
- _logSport.js consumers (planLifecycle, planAdherence, recentBest): type fallback — sound.
- intelligence.js + patterns.js core (tss/date/rpe/duration/zones): canonical reads — sound.

## Sweep coverage

- Producers read in full: useSupabaseData.js (logRowToEntry/logEntryToRow/recRowToEntry/recEntryToRow), validate.js (sanitizeLogEntry/sanitizeRecovery/sanitizeProfile), QuickAddModal, TrainingLog confirmImport/confirmExternalImport/CSV path, fileImport.js (parseFIT/parseGPX/parseBulkCSV/parseConcept2CSV), Protocols/Recovery/HRVDashboard/NotifReminders/BodyComp/MaxHrNudge profile+recovery writers.
- Consumers swept mechanically (property-access tally over src/lib/athlete/ 227 libs + src/components/dashboard/ 239 files + science/ + intelligence.js + patterns.js + TodayView/TrainingLog/Dashboard), then every non-inventory field verified by reading the consumer. ~60 candidate fields triaged; findings above are the load-bearing ones.

## Summary (severity-ordered)

| # | Finding | Class | Severity |
|---|---|---|---|
| A1-A8 | 8 cards DEAD via durationMin/duration_min reads (weeklyEnduranceTime, veryEasyShare, sessionLengthDistribution, postLongRunNextDay, backToBackLongDay, timeOnFeet, raceTimeEstimator, volumeIntensityScissors) | DEAD | HIGH |
| A10 | checkInQuality durationMin+heartRate fill-rates permanently 0% | WRONG | HIGH |
| B1 | Dashboard efSessions avgPaceMPerMin/sport phantoms — EF trend dead for runners | DEAD (running) | HIGH |
| B2 | detectPRs never reads distanceKm — distance/pace PRs never fire (+ meters-as-km latent) | DEAD | HIGH |
| C1 | sanitizeProfile wipes cp/wPrime/powerZones on every Profile save | DATA LOSS | HIGH |
| C2 | sanitizeProfile wipes notifications/preferred_checkin_time/timezone | DATA LOSS | HIGH |
| D | Recovery restingHR/bedtime/rmssd produced+consumed but not persisted — 5+ cards die after hydration for signed-in users | DEAD (synced) | HIGH |
| B3 | seasonStats distance≈0 + sport breakdown collapses to 'general' | WRONG | MED-HIGH |
| E1 | restDayMarked/sickDay/correctiveRest/improvisedSession/plannedType lost cross-device | DEGRADED (synced) | MED |
| B4 | EliteProgramCard weeklyHours/trainingDays phantoms (+string-vs-number guard) | DEGRADED | MED |
| B5 | EliteProgramCard staleness vdot/split2k phantoms — dead for run/row | DEGRADED | MED |
| A9 | yearOverYear minutes row always 0 | DEGRADED | MED |
| E2-E3 | drag_factor / hasPower cross-device loss | DEGRADED | LOW-MED |
| B6, B7, F, A11 | lthr dead branch; lnRmssd casing; strokes/avgPaceSec* dead ends; restDayEnergyTrend edge | LOW | LOW |

