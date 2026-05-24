# Sporeus Athlete App — Dashboard Card Inventory & Overlap Audit

**Date:** 2026-05-25  
**Total Cards:** 236 (v11.76.0)  
**Backing Modules:** 223 pure-fn sport-science wrappers in `src/lib/athlete/*.js`

---

## 1. BUCKET SUMMARY

| Bucket | Count |
|--------|-------|
| Patterns / Streaks / Long-term | 39 |
| Load / Volume / TSS patterns | 37 |
| Recovery / Sleep / HRV / Soreness | 36 |
| Intensity / RPE / Zone distribution | 30 |
| VDOT / Pace / Performance prediction | 27 |
| Data / Admin / UI | 26 |
| Sport-specific | 15 |
| Today / Prescription | 10 |
| Coach / Squad | 9 |
| Profile / Education / Reference | 9 |
| Race-specific | 7 |
| Nutrition / Fueling | 6 |
| Other / Uncategorized | 4 |
| **TOTAL** | **236** |

---

## 2. DETAILED INVENTORY BY BUCKET

### Today / Prescription (10 cards)

- **TodayReadinessCard** — What to do today: TSB-based readiness band
- **TodayStripCard** — Planned session + today's quick metrics summary
- **TodayProgrammedSessionCard** — Coach-assigned session for today
- **NextTrainingCard** — Next prescribed workout from plan
- **PriorityActionCard** — Highest-severity alert/recommendation
- **RuleAlertsCard** — List of all triggered alert rules
- **ReadinessCard** — Freshness & recovery status composite
- **DailyBriefingCard** — Daily summary snapshot
- **NMFreshnessCard** — Nate's Methodology freshness estimate
- **MissionHeadline** — App mission statement + onboarding hook

### Load / Volume / TSS patterns (37 cards)

- **LoadTrendChart** (Hulin 2016) — 7–28-day rolling TSS trend line
- **LoadHeatmapCard** — Calendar grid of daily TSS intensity
- **LoadSpikeAlert** — Week-on-week TSS spike warning (>10%)
- **LoadProjectorCard** (Banister 1991) — Forecast next-week TSS from 28d avg
- **WeeklyTssGoalCard** — Target vs actual TSS per week
- **WeeklyTssVarianceCard** (Foster 2001) — Coefficient of variation in weekly TSS
- **WeeklyVolumeRampCard** (Gabbett 2016) — Week-to-week volume acceleration
- **WeeklyVolumeStreakCard** — Consecutive weeks within goal range
- **WeeklyVolumeRecordCard** — Peak weekly TSS this season
- **WeeklyVolumeIntensityRatioCard** (Foster 2001) — TSS per training hour efficiency
- **AnnualTssTargetCard** (Hellard 2019) — Year-to-date TSS vs annual goal
- **MaxTssDayPersonalRecordCard** (Issurin 2010) — Single-day peak TSS record
- **DailyVolumeRangeCard** (Foster 2001) — Daily session duration distribution
- **SeasonalLoadDistributionCard** (Issurin 2010) — Phase-by-phase TSS allocation
- **CtlRampRateCard** (Banister 1975) — CTL daily growth rate (slope)
- **CtlSlopeCard** (Banister 1991) — CTL acceleration metric
- **VolumeAccelerationCard** (Vetter 2019) — Week-to-week volume slope
- **VolumePerSessionTrendCard** (Daniels 2014) — Mean session duration per week
- **VolumeIntensityScissorsCard** (Issurin 2010) — Volume × intensity divergence over mesocycles
- **WeeklyKmPerSportCard** (Daniels 2014) — Distance by sport per week
- **TimeInZoneCard** (Seiler 2010) — Cumulative minutes per zone (28d)
- **SessionDensityCard** (Bompa 2018) — Sessions per day (28d avg)
- **WorkoutDensityCard** — Sessions per 7d window
- **LongestSessionTrendCard** (Daniels 2014) — Peak weekly session length trend
- **CumulativeFatigueWindowsCard** (Halson 2014) — Continuous high-load periods
- **SessionLengthDistributionCard** (Issurin 2010) — Duration histogram over 28d
- **TimeOnFeetCard** (Bennell 2012) — Running time exposure (week-by-week)
- **TrainingDistributionCard** (Seiler 2010) — Activity spread across days
- **TrainingDiversityCard** (Haff 2009) — Multi-sport days (28d)
- **TrainingHourBudgetCard** (Hellard 2019) — Total weekly training hours vs budget
- **MonotonyStrainCard** (Foster 2001) — 7-day monotony & strain index
- **MonotonyTrendCard** (Foster 1998) — 28-day monotony band classification
- **ACWRCard** — Acute:Chronic workload ratio (7d:28d)
- **MicrocycleVarietyCard** (Issurin 2010) — Within-week stimulus variance
- **SessionVarietyCard** (Seiler 2010) — Type mix per week
- **OverlookedSessionTypeCard** (Bompa 2018) — Session types missing from recent weeks
- **MesocycleProgressionCard** (Issurin 2010) — 4-week block structure progression

### Intensity / RPE / Zone distribution (30 cards)

- **TrainingPolarizationCard** (Seiler 2010) — 80/20 or 90/10 easy:hard split
- **PolarizationComplianceCard** — Adherence to polarized training model
- **IntensityBalanceCard** — Hard/moderate/easy proportions
- **HighRpeBlockCard** — Consecutive days at RPE ≥7
- **HighRpeLowTssCard** (Foster 2017) — RPE-TSS mismatch (high perceived, low measured)
- **RpeStabilityCard** — RPE-to-session-load consistency
- **SessionRPEDriftCard** — Drift in perceived exertion over 12w
- **HardDaySpacingCard** — Inter-hard-session intervals (target ≥48h)
- **HardEasyAdherenceCard** — Adherence to hard-easy principle
- **HardSessionTypePatternCard** — Type diversity of hard sessions
- **AllZonesCard** — Time distribution across all zones (pie chart)
- **CyclingZonesCard** — FTP-derived power zones for cycling
- **SwimmingZonesCard** — Pace-based zones for swimming
- **StaleZonesCard** — Alert if zones > 60d old (no recent test)
- **ZoneDistributorCard** — Zone-by-zone time allocation table
- **ZoneThreeBlackHoleCard** — Time in zone 3 (potential wasted middle-intensity)
- **EasyDayComplianceCard** — Sessions at Z1–Z2 percentage compliance
- **VeryEasyShareCard** (Maffetone 2010) — Ultra-easy (RPE ≤3) proportion
- **LongSessionShareCard** — Long (>2h) session frequency
- **WeekendLongSessionShareCard** (Foster 2017) — Long sessions on weekend
- **WeekendVolumeShareCard** — TSS on weekend vs weekday split
- **TimeOfDayConsistencyCard** — Training time clustering (morning/afternoon/evening)
- **MidweekHardDayFrequencyCard** — Hard sessions Mon–Wed count
- **TwoADaysCard** — Double-workout days frequency
- **TrainRestTrainPatternCard** — Rest-day placement & spacing
- **BackToBackLongDayCard** (Issurin 2010) — Consecutive days with long sessions
- **HardWeekUnrestedCard** (Foster 2001) — High-load week + insufficient recovery
- **HrForRpeCard** — Heart-rate-to-RPE calibration check
- **PaceByRpeCard** — Pace consistency at target RPE levels
- **PaceRangeCard** — Easy/threshold/VO2max pace bands

### Recovery / Sleep / HRV / Soreness (36 cards)

- **RecoveryAdherenceCard** — Recovery practice completion rate
- **RecoveryDebtCard** — Cumulative unmet recovery (days)
- **RecoveryProtocolCard** — Recommended recovery action
- **RecoveryQualityStreakCard** — Consecutive good-recovery days
- **RecoveryStreakCard** — Same as above (may be duplicate)
- **EliteRecoveryCard** — Elite program recovery protocol
- **SleepConsistencyCard** — Bedtime/wake-time regularity (28d)
- **SleepDebtCard** — Sleep deficit vs target (hours)
- **SleepRestingHRCard** — Resting HR as sleep-quality proxy
- **SleepCtlCorrelationCard** — Sleep duration ↔ CTL gain association
- **BedtimeConsistencyCard** (Walker 2017) — Circadian phase variance
- **PreRaceSleepBankingCard** — Sleep buildup before race
- **RestDayDistributionCard** — Rest-day placement in week
- **RestDayEnergyTrendCard** — Energy/mood on rest days (trend)
- **HRVAlertCard** — HRV drop alerts (readiness flag)
- **HRVSummaryCard** — HRV mean + bands (28d)
- **HrvAutonomicBalanceCard** — HRV sym/parasym balance
- **OSTRCMonitorCard** — Overuse injury & illness screening
- **PostHardSessionResponseCard** — Recovery cost after hard session
- **PostHardSessionSorenessCard** (Kellmann 2018) — Post-workout soreness escalation
- **PostLongRunNextDayCard** — Recovery quality after long run
- **AfterBigWeekRpeCard** (Halson 2014) — RPE elevation post-overreach
- **TrainAfterRestCard** (Bompa 2018) — Load on return from rest day
- **RestingHrDriftCard** — Resting HR trend (fatigue marker)
- **RestingHrFitnessTrendCard** — Resting HR × CTL correlation
- **SupercompensationWindowCard** — Post-hard optimal training window
- **ResetWeekEffectCard** — Load reduction week outcomes
- **TaperAdvisorCard** — Taper week recommendations
- **TaperComplianceCard** — Actual vs prescribed taper adherence
- **MoodEnergyBalanceCard** — Mood + energy coherence
- **EnergySorenessDivergenceCard** — Energy ≠ soreness warning
- **CPDecayCard** (Poole 2016) — Critical power decline marker
- **RESTQTrendCard** — Recovery-stress questionnaire trend
- **ProactiveInjuryAlert** — Injury risk escalation
- **DetrainingDetectorCard** — Detraining signs post-absence
- **HardWeekUnrestedCard** (Foster 2001) — (duplicate: also in Intensity)

### VDOT / Pace / Performance prediction (27 cards)

- **RaceReadinessCard** — TSB-based race readiness (green/amber/red)
- **RunningRaceReadinessCard** — Running-specific readiness model
- **RaceCountdownBanner** — Days until race + taper phase
- **RacePredictionsCard** — Riegel model race time prediction
- **RaceGoalAnalyzerCard** — Goal split analysis vs past PRs
- **RaceGoalDashCard** — Goal pace breakdown
- **RaceTimeEstimatorCard** — Multi-distance time predictor
- **PRTimelineCard** — Personal record history with dates
- **PersonalRecordsCard** — All-time bests by distance
- **SeasonBestsCard** — Season-to-date PRs
- **VO2maxCard** — Current VO2max estimate + band
- **VO2maxProgressionCard** — VO2max trend over 12w–52w
- **VO2maxPlateauCard** — Stagnation detection (no gain >30d)
- **VO2GapCard** — VO2max vs test value gap
- **VDOTBenchmarkCard** — VDOT benchmark vs age-group norms
- **VdotProgressCard** — VDOT weekly gain/loss trend
- **AerobicDecouplingTrendCard** (Friel 2014) — Power:HR or pace:HR drift over 28d
- **AerobicEfficiencyCard** (Coggan 2003) — Watts/HR or pace/HR efficiency
- **RunningCVCard** — Running CV (cost of transport) trend
- **YearOverYearCard** — Performance YoY comparison
- **FieldTestHistoryCard** — Test results log with power/pace/HR
- **FitnessGainRateCard** — CTL growth rate (w-o-w)
- **FitnessConsistencyCard** (Banister 1991) — CTL week-to-week variance
- **FitnessBatteryProgressCard** — TSB (freshness) gauge
- **TrainingAgeCard** — Years of structured training
- **TrainingAgeStageCard** — Beginner/intermediate/advanced
- **DurabilityCard** (Maunder 2021) — Session peak power vs MMP

### Sport-specific (15 cards)

- **CyclingNpTrendCard** (Allen 2010) — 90d best-normalized-power by duration
- **RowingMetricsCard** — Rowing split/power/pace targets
- **RowingSplitConsistencyCard** (Smith 2012) — Split variance per session
- **SwimSwolfTrendCard** — SWOLF (efficiency) trend over 28d
- **RunningCadenceTrendCard** — Cadence stability (steps/min)
- **TriathlonLoadCard** — Cross-sport load balance
- **TriathlonWeekBalanceCard** — Tri sport distribution (%)
- **TriDashboard** — Integrated tri discipline view
- **WeeklyEnduranceTimeCard** — Aerobic endurance minutes/week
- **CrossSportRecoveryGapCard** (Bompa 2018) — Inter-sport recovery requirements
- **LongRunConsistencyCard** — Long-run frequency & distance
- **LongRunFrequencyCard** — Long runs per month
- **AlternatingWeekPatternCard** (Issurin 2010) — High:low week rhythm (polarization at macro scale)
- **CyclePhaseCard** — Female athlete cycle phase inference
- **CyclePlannerCard** — Female cycle-based training plan

### Coach / Squad (9 cards)

- **CoachGateCard** — Coach availability & messaging portal
- **CoachEditsBanner** — Coach edit notifications
- **CoachingInsightsDigest** (Seiler 2010) — Prioritized coaching alerts
- **CoachingSummaryScoreCard** (Seiler 2010) — Coach digest health rating
- **EliteProgramCard** — Elite coach-authored program card
- **EliteRaceWeekCard** — Race-week protocol from coach
- **EliteMetricsStrip** — Coach-curated key metrics
- **ProgramCalendar** — Coach plan calendar view
- **ProgramSelectorCard** — Coach program menu selector

### Patterns / Streaks / Long-term (39 cards)

- **StreakCard** (Foster 2001) — Consecutive training days
- **LogStreakBreakerCard** (Wood 2013) — Day-key tracking for streaks
- **AlternatingWeekPatternCard** (Issurin 2010) — Macro-level hard:easy rhythm
- **AverageWeekShapeCard** (Bompa 2018) — Typical weekly microcycle profile
- **BackToBackLongDayCard** (Issurin 2010) — Consecutive long-duration sessions
- **BanisterModelCard** (Banister 1975) — Fitness-fatigue SVG model
- **CalendarHolesCard** (Foster 2017) — Multi-day training gaps
- **ChallengeWidget** — Custom challenge tracking
- **ConsecutiveDeloadCountCard** (Bompa 2018) — Back-to-back low-load weeks
- **ConsistencyDepthCard** — Consistency depth metric
- **ConsistencyTrendCard** (Bangsbo 2006) — Adherence trend classification
- **DeloadCadenceCard** (Haff 2009) — 3:1 build:deload cadence audit
- **FitnessConsistencyCard** (Banister 1991) — CTL variance metric
- **GoalTrackerCard** — Multi-goal tracking dashboard
- **HardSessionTypePatternCard** — Type variety in hard sessions
- **InjuryForecastCard** (Malone 2017) — Injury risk band prediction
- **InjuryPatternCard** — Historical injury event mining
- **InjuryReturnCard** (Soligard 2016) — Return-to-sport load ramp
- **KeySessionsCard** (Daniels 2014) — Landmark session logging
- **LifetimeTotalsCard** (Bandura 1997) — Career aggregate stats
- **MilestonesList** — Achievement milestones
- **MonthlyProgressCard** — Monthly performance summary
- **MorningLogConsistencyCard** (Lally 2010) — Daily checkin completion rate
- **MultiPeakSeasonCard** (Issurin 2010) — Multi-peak plan skeleton
- **PeakWeekCard** — Best 7-day TSS window
- **PeakWeekFrequencyCard** (Issurin 2010) — Peak-week frequency
- **PerfectWeekCard** (Hellard 2019) — Ideal-week conformance
- **PerformanceMetrics** — Composite performance dashboard
- **PerseveranceCard** (Duckworth 2007) — Grit/adherence metric
- **PhaseAnalyticsCard** — Training block progress
- **RecentSessionsCard** — Recent 7–14 day summary
- **RowingSplitConsistencyCard** (Smith 2012) — Rowing split variance
- **SeasonRestartCountCard** (Gabbett 2016) — Comeback frequency
- **SeasonStatsCard** — Season-to-date aggregates
- **SessionGapVarianceCard** (Foster 2017) — Inter-session rhythm variance
- **StressPatternCard** (Selye 1956) — Stress ↔ sleep coupling
- **StrainHistoryCard** (Foster 1998) — Strain event chronology
- **WeekStoryCard** — Weekly narrative summary
- **WeeklyGoalVarianceCard** (Locke 2002) — Weekly variance vs targets
- **YourPatternsCard** — Personalized pattern mining

### Race-specific (7 cards)

- **RaceCountdownBanner** — Race date + taper phase
- **RaceDayFuelingTimelineCard** — Pre/during/post race fueling schedule
- **RaceEquipmentChecklistCard** — Race kit checklist
- **RaceMentalRehearsalCard** — Mental prep visualization
- **RaceStrategyCard** — Race split & tactical plan
- **RaceWeekProtocolCard** — Final week training prescription
- **EliteRaceWeekCard** — Coach race-week protocol

### Nutrition / Fueling (6 cards)

- **FuelGuidanceCard** — Fuel dosing calculator
- **FuelingCard** — Fueling habit tracker
- **NutritionTimingCard** — Meal timing around sessions
- **CaffeineDoseCard** (Burke 2017) — Pre-session caffeine guidance
- **HydrationTargetCard** — Hydration rate targets
- **RaceDayFuelingTimelineCard** — Race fueling schedule

### Profile / Education / Reference (9 cards)

- **DidYouKnowCard** — Sport science factoid
- **DrillsLibraryCard** — Technique drill reference
- **GettingStartedCard** — Onboarding guide
- **NormativeSection** — Zone tables & reference tables
- **BodyCompositionCard** — Body fat / BMI / BMR panel
- **TrainingBridgeCard** — Beginner→intermediate ladder
- **NewSessionTypeIntroCard** — Session type glossary
- **ProgramSelectorCard** — Program gallery
- **ChallengeWidget** — (also in Patterns)

### Data / Admin / UI (26 cards)

- **DataCoverageCard** — Data completeness audit
- **BackupReminder** — Periodic export reminder
- **CheckInQualityCard** (Halson 2014) — Session data hygiene report
- **SessionClassifierBreakdownCard** — Session type classification audit
- **AthleteStatusSummaryCard** — Athlete summary for coach
- **PlanScoreCard** — Plan execution score
- **PlanAdherenceCard** — Plan vs actual comparison
- **AICoachInsights** — LLM-generated insights
- **InsightFeedCard** — Dynamic insight feed
- **InsightsPanel** — Insight panel UI
- **CoachingInsightsDigest** (Seiler 2010) — (also in Coach)
- **BroaderPlanSections** (Burke 2017) — Plan section renderer
- **AllZonesCard** — (also in Intensity)
- **MacroPlanCountdown** — Plan phase countdown
- **WeeklyRetroCard** — Week review form
- **WeeklyReviewCard** — Week summary review
- **WeeklyReportCard** — Coach-ready week report
- **WorkoutDeviationCard** — Session vs plan deviation
- **RuleAlertsCard** — (also in Today)
- **TodayStripCard** — (also in Today)
- **EliteMetricsStrip** — (also in Coach)

### Other / Uncategorized (4 cards)

- **BroaderPlanSections** (Burke 2017)
- **NewSessionTypeIntroCard**
- **NormativeSection**
- **AltitudeStimulusCard** (Lippl 2010)

---

## 3. TOP 10 OVERLAP-SUSPECT GROUPS

1. **[CtlRampRateCard, CtlSlopeCard, VolumeAccelerationCard, LoadProjectorCard]**  
   → All measure CTL/fitness trajectory slope. Subtle algorithmic variants; consider consolidating into single "Fitness Slope" card with toggleable metrics.

2. **[WeeklyTssVarianceCard, WeeklyVolumeRampCard, WeeklyGoalVarianceCard, VolumePerSessionTrendCard]**  
   → All track week-to-week volume consistency via different statistical lenses (CV, absolute ramp, vs goal, per-session avg). May be consolidatable into "Volume Consistency Report."

3. **[PostHardSessionResponseCard, PostHardSessionSorenessCard, AfterBigWeekRpeCard, HardWeekUnrestedCard]**  
   → All flag inadequate recovery after intensity/load spikes. Same root signal, different lookback windows. Consider single "Overreach Alert" with multiple severity tiers.

4. **[ConsistencyTrendCard, ConsistencyDepthCard, MorningLogConsistencyCard, FitnessConsistencyCard]**  
   → All measure adherence/regularity (log, CTL, morning checkin). Scoring methodologies likely overlap; could merge into "Adherence Dashboard."

5. **[AerobicDecouplingTrendCard, AerobicEfficiencyCard, CPDecayCard]**  
   → All measure power:HR or pace:HR coupling and detect aerobic drift/fatigue. CPDecayCard is specialized CP variant; others may compute same base signal.

6. **[MonotonyStrainCard, MonotonyTrendCard, StrainHistoryCard, CumulativeFatigueWindowsCard]**  
   → All use Foster Monotony/Strain or cumulative fatigue metrics. Trend + history + windows are different slices of same metric.

7. **[RaceReadinessCard, RunningRaceReadinessCard, TaperAdvisorCard, TaperComplianceCard]**  
   → All assess taper phase & race-week readiness via TSB/freshness. Running variant may be discipline-specific; advisor + compliance are planning vs execution.

8. **[VO2maxCard, VO2maxProgressionCard, VO2maxPlateauCard, VO2GapCard]**  
   → All track VO2max changes. Plateau detection may be redundant with progression trend (plateau = no slope).

9. **[AllZonesCard, TimeInZoneCard, ZoneDistributorCard, ZoneThreeBlackHoleCard]**  
   → All analyze zone-by-zone time allocation. ZoneThreeBlackHole is specialized variant; others may share same data table.

10. **[DeloadCadenceCard, ConsecutiveDeloadCountCard, ResetWeekEffectCard]**  
    → All identify low-load weeks. Cadence (3:1 rhythm) vs count (N consecutive) vs effect (recovery quality) are different analytical angles on same phenomenon.

---

## 4. RECENT ADDITIONS (last 30 commits by card creation date)

| # | Card | Bucket | Citation |
|---|------|--------|----------|
| 1 | PostHardSessionSorenessCard | Recovery | Kellmann 2018 |
| 2 | ConsecutiveDeloadCountCard | Patterns | Bompa 2018 |
| 3 | VeryEasyShareCard | Intensity | Maffetone 2010 |
| 4 | AfterBigWeekRpeCard | Recovery | Halson 2014 |
| 5 | TrainAfterRestCard | Recovery | Bompa 2018 |
| 6 | SessionGapVarianceCard | Patterns | Foster 2017 |
| 7 | MaxTssDayPersonalRecordCard | Load | Issurin 2010 |
| 8 | HardWeekUnrestedCard | Intensity/Recovery | Foster 2001 |
| 9 | AlternatingWeekPatternCard | Patterns/Sport | Issurin 2010 |
| 10 | VolumePerSessionTrendCard | Load | Daniels 2014 |
| 11 | TrainingHourBudgetCard | Load | Hellard 2019 |
| 12 | HighRpeLowTssCard | Intensity | Foster 2017 |
| 13 | TrainRestTrainPatternCard | Intensity | — |
| 14 | WeekendLongSessionShareCard | Load | Foster 2017 |
| 15 | OverlookedSessionTypeCard | Load | Bompa 2018 |
| 16 | HighRpeBlockCard | Intensity | — |
| 17 | SessionLengthDistributionCard | Load | Issurin 2010 |
| 18 | MesocycleProgressionCard | Load | Issurin 2010 |
| 19 | MonotonyTrendCard | Load | Foster 1998 |
| 20 | EasyDayComplianceCard | Intensity | — |
| 21 | MonotonyStrainCard | Load | Foster 2001 |
| 22 | TrainingDiversityCard | Load | Haff 2009 |
| 23 | SeasonalLoadDistributionCard | Load | Issurin 2010 |
| 24 | SessionVarietyCard | Load | Seiler 2010 |
| 25 | SessionDensityCard | Load | Bompa 2018 |
| 26 | CtlSlopeCard | Load | Banister 1991 |
| 27 | CtlRampRateCard | Load | Banister 1975 |
| 28 | CumulativeFatigueWindowsCard | Load | Halson 2014 |
| 29 | CrossSportRecoveryGapCard | Sport | Bompa 2018 |
| 30 | ConsistencyTrendCard | Patterns | Bangsbo 2006 |

**Key Pattern in Recent Adds:**  
Autopilot heavily weighted **Load/Volume/TSS variants** (14/30, 47%) and **Recovery/Post-hard markers** (5/30). This suggests aggressive expansion in fatigue detection—likely driven by high user demand for "am I overtraining?" signals, but with substantial overlap in the 3-4 CTL measurement cards and post-hard soreness family.

---

## RECOMMENDATIONS

1. **Audit the 3 CTL slope cards** (CtlRampRateCard, CtlSlopeCard, VolumeAccelerationCard). They likely use same `computeCTL()` base function with only window length or derivative style differences. Consider a single "CTL Slope" card with toggle for measurement method.

2. **Consolidate post-hard recovery signals** (PostHardSessionResponseCard, PostHardSessionSorenessCard, AfterBigWeekRpeCard, HardWeekUnrestedCard). These are all "did hard training break the athlete?" flags with different time horizons. A single "Overreach Alert" with 24h / 3d / 7d tabs would reduce dashboard clutter.

3. **Fold zone distribution variants**. AllZonesCard, TimeInZoneCard, ZoneDistributorCard, and ZoneThreeBlackHole all consume zone data. Consider a single "Zone Report" with section toggles (distribution %, time, black-hole warning).

4. **Deprioritize VO2maxPlateauCard** if VO2maxProgressionCard is live. Plateau = 0 slope; no need for two cards.

5. **Review the Recovery/HRV family** (HRVAlertCard, HRVSummaryCard, HrvAutonomicBalanceCard, SleepConsistencyCard, SleepDebtCard, SleepRestingHRCard). All use different wellness proxies but solve the same "is recovery adequate?" question. Consolidation to a single Recovery Status widget would improve usability.

6. **Monitor for "Patterns" bucket bloat** (39 cards, largest bucket). Consider splitting into "Long-term metrics" (VO2, PR, fitness) and "Streaks & Comebacks" (injury return, deload cadence, consistency).

---

**Next Step:** Review the 3 CTL slope functions in `src/lib/athlete/{ctlRampRate, ctlSlope, volumeAcceleration}.js` to quantify overlap and propose a merge PR.

