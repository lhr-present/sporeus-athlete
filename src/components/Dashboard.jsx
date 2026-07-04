// ─── Dashboard.jsx — orchestrator, composes all dashboard cards ───────────────
import { useContext, useState, useMemo, useCallback, lazy, Suspense, memo } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { TSSChart, WeeklyVolChartMemo, ZoneDonutMemo, HelpTip } from './ui.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
const HRVChart = lazy(() => import('./charts/HRVChart.jsx'))
import { monotonyStrain, calcLoad } from '../lib/formulas.js'
import { calculateACWR, calculateConsistency } from '../lib/trainingLoad.js'
import ShareCard from './ShareCard.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { getRecentAchievement } from './Achievements.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { SPORT_BRANCHES, ATHLETE_LEVELS, LEVEL_CONFIG, DASH_CARD_DEFS, DASH_CARD_GROUPS } from '../lib/constants.js'
import { assessDataQuality, predictFitness } from '../lib/intelligence.js'
import { interpretCTL, interpretTSB, interpretMonotony } from '../lib/science/interpretations.js'
import { subThresholdTrend, } from '../lib/science/subThresholdTime.js'
import { selectInsight } from '../lib/onboarding/day0Insight.js'
import { computeMonotony } from '../lib/trainingLoad.js'
import { useData } from '../contexts/DataContext.jsx'
import { isGated as _isGated, LS_KEY as CONFIRM_LS_KEY } from '../lib/athlete/coachConfirmFlow.js'

// ── Previously extracted sub-components ──────────────────────────────────────
const EFTrendCard = lazy(() => import('./science/EFTrendCard.jsx'))
import InsightsPanel        from './dashboard/InsightsPanel.jsx'
import WeekStoryCard        from './dashboard/WeekStoryCard.jsx'
import DidYouKnowCard       from './dashboard/DidYouKnowCard.jsx'
import MilestonesList       from './dashboard/MilestonesList.jsx'
import YourPatternsCard     from './dashboard/YourPatternsCard.jsx'
import ProactiveInjuryAlert from './dashboard/ProactiveInjuryAlert.jsx'
import RaceReadinessCard    from './dashboard/RaceReadinessCard.jsx'
import LoadTrendChart       from './dashboard/LoadTrendChart.jsx'
const TriDashboard         = lazy(() => import('./dashboard/TriDashboard.jsx'))
import ACWRCard             from './dashboard/ACWRCard.jsx'
import WeeklyReportCard     from './dashboard/WeeklyReportCard.jsx'
import VO2maxCard           from './dashboard/VO2maxCard.jsx'
import PeakWeekCard         from './dashboard/PeakWeekCard.jsx'
import TrainingAgeCard      from './dashboard/TrainingAgeCard.jsx'
import GoalTrackerCard      from './dashboard/GoalTrackerCard.jsx'
import LoadHeatmapCard      from './dashboard/LoadHeatmapCard.jsx'
import SeasonBestsCard      from './dashboard/SeasonBestsCard.jsx'

// ── Newly extracted sub-components (v7.18) ───────────────────────────────────
import BackupReminder      from './dashboard/BackupReminder.jsx'
import LoadSpikeAlert      from './dashboard/LoadSpikeAlert.jsx'
import WeeklyTssGoalCard  from './dashboard/WeeklyTssGoalCard.jsx'
import ReadinessCard       from './dashboard/ReadinessCard.jsx'
import RecentSessionsCard  from './dashboard/RecentSessionsCard.jsx'
import ZoneDistributorCard from './dashboard/ZoneDistributorCard.jsx'
import PersonalRecordsCard from './dashboard/PersonalRecordsCard.jsx'
const BodyCompositionCard = lazy(() => import('./dashboard/BodyCompositionCard.jsx'))
const RacePredictionsCard = lazy(() => import('./dashboard/RacePredictionsCard.jsx'))
const BanisterModelCard   = lazy(() => import('./dashboard/BanisterModelCard.jsx'))
const DurabilityCard      = lazy(() => import('./dashboard/DurabilityCard.jsx'))
const MacroPlanCountdown  = lazy(() => import('./dashboard/MacroPlanCountdown.jsx'))
const NormativeSection    = lazy(() => import('./dashboard/NormativeSection.jsx'))
const AICoachInsights     = lazy(() => import('./dashboard/AICoachInsights.jsx'))
const EFDecouplingCard    = lazy(() => import('./dashboard/EFDecouplingCard.jsx'))
const OverreachWatchCard  = lazy(() => import('./dashboard/OverreachWatchCard.jsx'))
import WeeklyRetroCard    from './dashboard/WeeklyRetroCard.jsx'
import PhaseAnalyticsCard from './dashboard/PhaseAnalyticsCard.jsx'
import FuelGuidanceCard   from './dashboard/FuelGuidanceCard.jsx'
import GettingStartedCard from './dashboard/GettingStartedCard.jsx'
import TodayStripCard    from './dashboard/TodayStripCard.jsx'
import EliteMetricsStrip from './dashboard/EliteMetricsStrip.jsx'
const SeasonStatsCard    = lazy(() => import('./dashboard/SeasonStatsCard.jsx'))
const CPDecayCard        = lazy(() => import('./dashboard/CPDecayCard.jsx'))
const RowingMetricsCard  = lazy(() => import('./dashboard/RowingMetricsCard.jsx'))
const ChallengeWidget    = lazy(() => import('./dashboard/ChallengeWidget.jsx'))
const NMFreshnessCard            = lazy(() => import('./dashboard/NMFreshnessCard.jsx'))
const PolarizationComplianceCard = lazy(() => import('./dashboard/PolarizationComplianceCard.jsx'))
const AerobicEfficiencyCard      = lazy(() => import('./dashboard/AerobicEfficiencyCard.jsx'))
const RESTQTrendCard             = lazy(() => import('./dashboard/RESTQTrendCard.jsx'))
const InjuryForecastCard         = lazy(() => import('./dashboard/InjuryForecastCard.jsx'))
const InjuryReturnCard           = lazy(() => import('./dashboard/InjuryReturnCard.jsx'))
const MultiPeakSeasonCard        = lazy(() => import('./dashboard/MultiPeakSeasonCard.jsx'))
const CyclePhaseCard             = lazy(() => import('./dashboard/CyclePhaseCard.jsx'))
const RaceStrategyCard           = lazy(() => import('./dashboard/RaceStrategyCard.jsx'))
const StrainHistoryCard          = lazy(() => import('./dashboard/StrainHistoryCard.jsx'))
const ConsistencyTrendCard       = lazy(() => import('./dashboard/ConsistencyTrendCard.jsx'))
const InsightFeedCard            = lazy(() => import('./dashboard/InsightFeedCard.jsx'))
const RecoveryProtocolCard       = lazy(() => import('./dashboard/RecoveryProtocolCard.jsx'))
const OSTRCMonitorCard           = lazy(() => import('./dashboard/OSTRCMonitorCard.jsx'))
const HRVSummaryCard             = lazy(() => import('./dashboard/HRVSummaryCard.jsx'))
const VO2maxProgressionCard      = lazy(() => import('./dashboard/VO2maxProgressionCard.jsx'))
const RuleAlertsCard             = lazy(() => import('./dashboard/RuleAlertsCard.jsx'))
const CyclePlannerCard           = lazy(() => import('./dashboard/CyclePlannerCard.jsx'))
const PlanAdherenceCard          = lazy(() => import('./dashboard/PlanAdherenceCard.jsx'))
const PRTimelineCard             = lazy(() => import('./dashboard/PRTimelineCard.jsx'))
const LoadProjectorCard          = lazy(() => import('./dashboard/LoadProjectorCard.jsx'))
const InjuryPatternCard          = lazy(() => import('./dashboard/InjuryPatternCard.jsx'))
const VDOTBenchmarkCard          = lazy(() => import('./dashboard/VDOTBenchmarkCard.jsx'))
const HRVAlertCard               = lazy(() => import('./dashboard/HRVAlertCard.jsx'))
const HrvAutonomicBalanceCard    = lazy(() => import('./dashboard/HrvAutonomicBalanceCard.jsx'))
const SleepCtlCorrelationCard    = lazy(() => import('./dashboard/SleepCtlCorrelationCard.jsx'))
const RecoveryStreakCard         = lazy(() => import('./dashboard/RecoveryStreakCard.jsx'))
const RestingHrDriftCard         = lazy(() => import('./dashboard/RestingHrDriftCard.jsx'))
const SessionClassifierBreakdownCard = lazy(() => import('./dashboard/SessionClassifierBreakdownCard.jsx'))
const WorkoutDeviationCard       = lazy(() => import('./dashboard/WorkoutDeviationCard.jsx'))
const MonotonyTrendCard          = lazy(() => import('./dashboard/MonotonyTrendCard.jsx'))
const AerobicDecouplingTrendCard = lazy(() => import('./dashboard/AerobicDecouplingTrendCard.jsx'))
const CtlRampRateCard            = lazy(() => import('./dashboard/CtlRampRateCard.jsx'))
const TsbFreshnessBandCard       = lazy(() => import('./dashboard/TsbFreshnessBandCard.jsx'))
const SleepDebtCard              = lazy(() => import('./dashboard/SleepDebtCard.jsx'))
const CaffeineDoseCard           = lazy(() => import('./dashboard/CaffeineDoseCard.jsx'))
const HydrationTargetCard        = lazy(() => import('./dashboard/HydrationTargetCard.jsx'))
const TaperComplianceCard        = lazy(() => import('./dashboard/TaperComplianceCard.jsx'))
const TimeOfDayConsistencyCard   = lazy(() => import('./dashboard/TimeOfDayConsistencyCard.jsx'))
const LongSessionShareCard       = lazy(() => import('./dashboard/LongSessionShareCard.jsx'))
const RunningCadenceTrendCard    = lazy(() => import('./dashboard/RunningCadenceTrendCard.jsx'))
const SwimSwolfTrendCard         = lazy(() => import('./dashboard/SwimSwolfTrendCard.jsx'))
const RowingSplitConsistencyCard = lazy(() => import('./dashboard/RowingSplitConsistencyCard.jsx'))
const CyclingNpTrendCard         = lazy(() => import('./dashboard/CyclingNpTrendCard.jsx'))
const RaceDayFuelingTimelineCard = lazy(() => import('./dashboard/RaceDayFuelingTimelineCard.jsx'))
const RaceMentalRehearsalCard    = lazy(() => import('./dashboard/RaceMentalRehearsalCard.jsx'))
const RaceEquipmentChecklistCard = lazy(() => import('./dashboard/RaceEquipmentChecklistCard.jsx'))
const PreRaceSleepBankingCard    = lazy(() => import('./dashboard/PreRaceSleepBankingCard.jsx'))
const AltitudeStimulusCard       = lazy(() => import('./dashboard/AltitudeStimulusCard.jsx'))
const PostHardSessionResponseCard = lazy(() => import('./dashboard/PostHardSessionResponseCard.jsx'))
const SeasonalLoadDistributionCard = lazy(() => import('./dashboard/SeasonalLoadDistributionCard.jsx'))
const CrossSportRecoveryGapCard  = lazy(() => import('./dashboard/CrossSportRecoveryGapCard.jsx'))
const MorningLogConsistencyCard  = lazy(() => import('./dashboard/MorningLogConsistencyCard.jsx'))
const WeeklyGoalVarianceCard     = lazy(() => import('./dashboard/WeeklyGoalVarianceCard.jsx'))
const CheckInQualityCard         = lazy(() => import('./dashboard/CheckInQualityCard.jsx'))
const AverageWeekShapeCard       = lazy(() => import('./dashboard/AverageWeekShapeCard.jsx'))
const MoodEnergyBalanceCard      = lazy(() => import('./dashboard/MoodEnergyBalanceCard.jsx'))
const RpeStabilityCard           = lazy(() => import('./dashboard/RpeStabilityCard.jsx'))
const StressPatternCard          = lazy(() => import('./dashboard/StressPatternCard.jsx'))
const PerseveranceCard           = lazy(() => import('./dashboard/PerseveranceCard.jsx'))
const LongestSessionTrendCard    = lazy(() => import('./dashboard/LongestSessionTrendCard.jsx'))
const WeeklyVolumeIntensityRatioCard = lazy(() => import('./dashboard/WeeklyVolumeIntensityRatioCard.jsx'))
const SessionDensityCard         = lazy(() => import('./dashboard/SessionDensityCard.jsx'))
const SleepConsistencyCard       = lazy(() => import('./dashboard/SleepConsistencyCard.jsx'))
const LifetimeTotalsCard         = lazy(() => import('./dashboard/LifetimeTotalsCard.jsx'))
const YearOverYearCard           = lazy(() => import('./dashboard/YearOverYearCard.jsx'))
const TrainingAgeStageCard       = lazy(() => import('./dashboard/TrainingAgeStageCard.jsx'))
const WeeklyVolumeRecordCard     = lazy(() => import('./dashboard/WeeklyVolumeRecordCard.jsx'))
const RaceTimeEstimatorCard      = lazy(() => import('./dashboard/RaceTimeEstimatorCard.jsx'))
const PaceByRpeCard              = lazy(() => import('./dashboard/PaceByRpeCard.jsx'))
const VolumeAccelerationCard     = lazy(() => import('./dashboard/VolumeAccelerationCard.jsx'))
const AnnualTssTargetCard        = lazy(() => import('./dashboard/AnnualTssTargetCard.jsx'))
const HrForRpeCard               = lazy(() => import('./dashboard/HrForRpeCard.jsx'))
const BedtimeConsistencyCard     = lazy(() => import('./dashboard/BedtimeConsistencyCard.jsx'))
const RestingHrFitnessTrendCard  = lazy(() => import('./dashboard/RestingHrFitnessTrendCard.jsx'))
const EnergySorenessDivergenceCard = lazy(() => import('./dashboard/EnergySorenessDivergenceCard.jsx'))
const LogStreakBreakerCard       = lazy(() => import('./dashboard/LogStreakBreakerCard.jsx'))
const DataCoverageCard           = lazy(() => import('./dashboard/DataCoverageCard.jsx'))
const DayOfWeekAvailabilityCard  = lazy(() => import('./dashboard/DayOfWeekAvailabilityCard.jsx'))
const PerfectWeekCard            = lazy(() => import('./dashboard/PerfectWeekCard.jsx'))
const WeeklyTssVarianceCard      = lazy(() => import('./dashboard/WeeklyTssVarianceCard.jsx'))
const LongRunFrequencyCard       = lazy(() => import('./dashboard/LongRunFrequencyCard.jsx'))
const RecoveryQualityStreakCard  = lazy(() => import('./dashboard/RecoveryQualityStreakCard.jsx'))
const CtlSlopeCard               = lazy(() => import('./dashboard/CtlSlopeCard.jsx'))
const WeeklyKmPerSportCard       = lazy(() => import('./dashboard/WeeklyKmPerSportCard.jsx'))
const PaceRangeCard              = lazy(() => import('./dashboard/PaceRangeCard.jsx'))
const TimeOnFeetCard             = lazy(() => import('./dashboard/TimeOnFeetCard.jsx'))
const RestDayDistributionCard    = lazy(() => import('./dashboard/RestDayDistributionCard.jsx'))
const NewSessionTypeIntroCard    = lazy(() => import('./dashboard/NewSessionTypeIntroCard.jsx'))
const MesocycleProgressionCard   = lazy(() => import('./dashboard/MesocycleProgressionCard.jsx'))
const VolumeIntensityScissorsCard= lazy(() => import('./dashboard/VolumeIntensityScissorsCard.jsx'))
const LongRunConsistencyCard     = lazy(() => import('./dashboard/LongRunConsistencyCard.jsx'))
const CalendarHolesCard          = lazy(() => import('./dashboard/CalendarHolesCard.jsx'))
const BackToBackLongDayCard      = lazy(() => import('./dashboard/BackToBackLongDayCard.jsx'))
const SeasonAnchorCard           = lazy(() => import('./dashboard/SeasonAnchorCard.jsx'))
const CumulativeFatigueWindowsCard = lazy(() => import('./dashboard/CumulativeFatigueWindowsCard.jsx'))
const WeeklyEnduranceTimeCard    = lazy(() => import('./dashboard/WeeklyEnduranceTimeCard.jsx'))
const TwoADaysCard               = lazy(() => import('./dashboard/TwoADaysCard.jsx'))
const SessionLengthDistributionCard = lazy(() => import('./dashboard/SessionLengthDistributionCard.jsx'))
const HardEasyAdherenceCard      = lazy(() => import('./dashboard/HardEasyAdherenceCard.jsx'))
const PeakWeekFrequencyCard      = lazy(() => import('./dashboard/PeakWeekFrequencyCard.jsx'))
const ZoneThreeBlackHoleCard     = lazy(() => import('./dashboard/ZoneThreeBlackHoleCard.jsx'))
const HardSessionTypePatternCard = lazy(() => import('./dashboard/HardSessionTypePatternCard.jsx'))
const RestDayEnergyTrendCard     = lazy(() => import('./dashboard/RestDayEnergyTrendCard.jsx'))
const HighRpeBlockCard           = lazy(() => import('./dashboard/HighRpeBlockCard.jsx'))
const PostLongRunNextDayCard     = lazy(() => import('./dashboard/PostLongRunNextDayCard.jsx'))
const MidweekHardDayFrequencyCard = lazy(() => import('./dashboard/MidweekHardDayFrequencyCard.jsx'))
const ResetWeekEffectCard        = lazy(() => import('./dashboard/ResetWeekEffectCard.jsx'))
const SeasonRestartCountCard     = lazy(() => import('./dashboard/SeasonRestartCountCard.jsx'))
const DailyVolumeRangeCard       = lazy(() => import('./dashboard/DailyVolumeRangeCard.jsx'))
const WeeklyVolumeStreakCard     = lazy(() => import('./dashboard/WeeklyVolumeStreakCard.jsx'))
const MicrocycleVarietyCard      = lazy(() => import('./dashboard/MicrocycleVarietyCard.jsx'))
const TrainRestTrainPatternCard  = lazy(() => import('./dashboard/TrainRestTrainPatternCard.jsx'))
const OverlookedSessionTypeCard  = lazy(() => import('./dashboard/OverlookedSessionTypeCard.jsx'))
const HighRpeLowTssCard          = lazy(() => import('./dashboard/HighRpeLowTssCard.jsx'))
const TrainingHourBudgetCard     = lazy(() => import('./dashboard/TrainingHourBudgetCard.jsx'))
const WeekendLongSessionShareCard = lazy(() => import('./dashboard/WeekendLongSessionShareCard.jsx'))
const VolumePerSessionTrendCard  = lazy(() => import('./dashboard/VolumePerSessionTrendCard.jsx'))
const AlternatingWeekPatternCard = lazy(() => import('./dashboard/AlternatingWeekPatternCard.jsx'))
const HardWeekUnrestedCard       = lazy(() => import('./dashboard/HardWeekUnrestedCard.jsx'))
const MaxTssDayPersonalRecordCard = lazy(() => import('./dashboard/MaxTssDayPersonalRecordCard.jsx'))
const SessionGapVarianceCard     = lazy(() => import('./dashboard/SessionGapVarianceCard.jsx'))
const TrainAfterRestCard         = lazy(() => import('./dashboard/TrainAfterRestCard.jsx'))
const AfterBigWeekRpeCard        = lazy(() => import('./dashboard/AfterBigWeekRpeCard.jsx'))
const VeryEasyShareCard          = lazy(() => import('./dashboard/VeryEasyShareCard.jsx'))
const ConsecutiveDeloadCountCard = lazy(() => import('./dashboard/ConsecutiveDeloadCountCard.jsx'))
const PostHardSessionSorenessCard = lazy(() => import('./dashboard/PostHardSessionSorenessCard.jsx'))
const VO2maxPlateauCard          = lazy(() => import('./dashboard/VO2maxPlateauCard.jsx'))
const WeeklyVolumeRampCard       = lazy(() => import('./dashboard/WeeklyVolumeRampCard.jsx'))
const WeekendVolumeShareCard     = lazy(() => import('./dashboard/WeekendVolumeShareCard.jsx'))
const TaperAdvisorCard           = lazy(() => import('./dashboard/TaperAdvisorCard.jsx'))
const PriorityActionCard         = lazy(() => import('./dashboard/PriorityActionCard.jsx'))
const CyclingZonesCard           = lazy(() => import('./dashboard/CyclingZonesCard.jsx'))
const SwimmingZonesCard          = lazy(() => import('./dashboard/SwimmingZonesCard.jsx'))
const RunningCVCard              = lazy(() => import('./dashboard/RunningCVCard.jsx'))
const FitnessBatteryProgressCard = lazy(() => import('./dashboard/FitnessBatteryProgressCard.jsx'))
const TriathlonLoadCard          = lazy(() => import('./dashboard/TriathlonLoadCard.jsx'))
const RunningRaceReadinessCard   = lazy(() => import('./dashboard/RunningRaceReadinessCard.jsx'))
const RaceWeekProtocolCard       = lazy(() => import('./dashboard/RaceWeekProtocolCard.jsx'))
const HardDaySpacingCard         = lazy(() => import('./dashboard/HardDaySpacingCard.jsx'))
const TriathlonWeekBalanceCard   = lazy(() => import('./dashboard/TriathlonWeekBalanceCard.jsx'))
const FuelingCard                = lazy(() => import('./dashboard/FuelingCard.jsx'))
const EliteRecoveryCard          = lazy(() => import('./dashboard/EliteRecoveryCard.jsx'))
const KeySessionsCard            = lazy(() => import('./dashboard/KeySessionsCard.jsx'))
const EliteRaceWeekCard          = lazy(() => import('./dashboard/EliteRaceWeekCard.jsx'))
const DrillsLibraryCard          = lazy(() => import('./dashboard/DrillsLibraryCard.jsx'))
const PlanScoreCard              = lazy(() => import('./dashboard/PlanScoreCard.jsx'))
const AthleteStatusSummaryCard   = lazy(() => import('./dashboard/AthleteStatusSummaryCard.jsx'))
const SleepRestingHRCard         = lazy(() => import('./dashboard/SleepRestingHRCard.jsx'))
const AllZonesCard               = lazy(() => import('./dashboard/AllZonesCard.jsx'))
const DailyBriefingCard          = lazy(() => import('./dashboard/DailyBriefingCard.jsx'))
const NutritionTimingCard        = lazy(() => import('./dashboard/NutritionTimingCard.jsx'))
const WeeklyReviewCard           = lazy(() => import('./dashboard/WeeklyReviewCard.jsx'))
const ConsistencyDepthCard       = lazy(() => import('./dashboard/ConsistencyDepthCard.jsx'))
const MonthlyProgressCard        = lazy(() => import('./dashboard/MonthlyProgressCard.jsx'))
const IntensityBalanceCard       = lazy(() => import('./dashboard/IntensityBalanceCard.jsx'))
const WeekSessionTypeCard        = lazy(() => import('./dashboard/WeekSessionTypeCard.jsx'))
const RaceGoalAnalyzerCard       = lazy(() => import('./dashboard/RaceGoalAnalyzerCard.jsx'))
const TrainingBridgeCard         = lazy(() => import('./dashboard/TrainingBridgeCard.jsx'))
const RaceGoalDashCard           = lazy(() => import('./dashboard/RaceGoalDashCard.jsx'))
const VdotProgressCard           = lazy(() => import('./dashboard/VdotProgressCard.jsx'))
const ProgramSelectorCard        = lazy(() => import('./dashboard/ProgramSelectorCard.jsx'))
const CoachGateCard              = lazy(() => import('./dashboard/CoachGateCard.jsx'))
const TodayReadinessCard         = lazy(() => import('./dashboard/TodayReadinessCard.jsx'))
const StaleZonesCard             = lazy(() => import('./dashboard/StaleZonesCard.jsx'))
const WorkoutDensityCard         = lazy(() => import('./dashboard/WorkoutDensityCard.jsx'))
const SessionVarietyCard         = lazy(() => import('./dashboard/SessionVarietyCard.jsx'))
const FitnessGainRateCard        = lazy(() => import('./dashboard/FitnessGainRateCard.jsx'))
const EasyDayComplianceCard      = lazy(() => import('./dashboard/EasyDayComplianceCard.jsx'))
const TrainingDistributionCard   = lazy(() => import('./dashboard/TrainingDistributionCard.jsx'))
const DetrainingDetectorCard     = lazy(() => import('./dashboard/DetrainingDetectorCard.jsx'))
const MonotonyStrainCard         = lazy(() => import('./dashboard/MonotonyStrainCard.jsx'))
const VO2GapCard                 = lazy(() => import('./dashboard/VO2GapCard.jsx'))
const StreakCard                 = lazy(() => import('./dashboard/StreakCard.jsx'))
const SessionRPEDriftCard        = lazy(() => import('./dashboard/SessionRPEDriftCard.jsx'))
const RecoveryDebtCard           = lazy(() => import('./dashboard/RecoveryDebtCard.jsx'))
const TimeInZoneCard             = lazy(() => import('./dashboard/TimeInZoneCard.jsx'))
const SupercompensationWindowCard = lazy(() => import('./dashboard/SupercompensationWindowCard.jsx'))
const TrainingPolarizationCard   = lazy(() => import('./dashboard/TrainingPolarizationCard.jsx'))
const FitnessConsistencyCard     = lazy(() => import('./dashboard/FitnessConsistencyCard.jsx'))
const RecoveryAdherenceCard      = lazy(() => import('./dashboard/RecoveryAdherenceCard.jsx'))
const TrainingDiversityCard      = lazy(() => import('./dashboard/TrainingDiversityCard.jsx'))
const DeloadCadenceCard          = lazy(() => import('./dashboard/DeloadCadenceCard.jsx'))
const EliteProgramCard           = lazy(() => import('./dashboard/EliteProgramCard.jsx'))
const FieldTestHistoryCard       = lazy(() => import('./dashboard/FieldTestHistoryCard.jsx'))
const MissionHeadline            = lazy(() => import('./dashboard/MissionHeadline.jsx'))
const TodayProgrammedSessionCard = lazy(() => import('./dashboard/TodayProgrammedSessionCard.jsx'))
const CoachingInsightsDigest     = lazy(() => import('./dashboard/CoachingInsightsDigest.jsx'))
const CoachingSummaryScoreCard   = lazy(() => import('./dashboard/CoachingSummaryScoreCard.jsx'))
const RecoveryHub                = lazy(() => import('./RecoveryHub.jsx'))

// Sport-gate matchers — hoisted to module scope so they aren't re-created on
// every render. Stateless (.test without /g) so reuse across calls is safe.
const RE_CYCLE_TYPE  = /bike|cycl|ride/i
const RE_CYCLE_SPORT = /cycl/i
const RE_SWIM        = /swim/i
const RE_ROW_TYPE    = /row|erg|2k\s*test/i
const RE_ROW_SPORT   = /row/i

// First-run activation payoff card. Renders a science-anchored insight
// (Seiler/Banister/Daniels-cited, from day0Insight.selectInsight) once the
// athlete logs their first session. Renders nothing if the insight is null —
// purely additive, never replaces the empty-state / GettingStartedCard.
export const FirstRunInsightCard = memo(function FirstRunInsightCard({ insight, isTR }) {
  if (!insight || !insight.headline) return null
  return (
    <div
      className="sp-card"
      style={{ ...S.card, marginBottom: '16px', borderLeft: '4px solid #ff6600' }}
      data-first-run-insight
    >
      <div style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em', marginBottom: '6px' }}>
        ◈ {isTR ? 'İLK BİLGİ' : 'WHAT THIS MEANS'}
      </div>
      <div style={{ ...S.mono, fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
        {insight.headline}
      </div>
      <div style={{ ...S.mono, fontSize: '11px', lineHeight: 1.7, color: 'var(--text)' }}>
        {insight.body}
      </div>
      {insight.science && (
        <div style={{ ...S.mono, fontSize: '9px', lineHeight: 1.6, color: '#888', marginTop: '8px' }}>
          {insight.science}
        </div>
      )}
    </div>
  )
})

function Dashboard({ log, onLogSession, onGoToProfile }) {
  const [lang]       = useLocalStorage('sporeus-lang', 'en')
  const [plan]       = useLocalStorage('sporeus-plan', null)
  const [planStatus] = useLocalStorage('sporeus-plan-status', {})
  const { recovery, injuries, testResults, raceResults, profile, setLog } = useData()
  const [myCoach]        = useLocalStorage('sporeus-my-coach', null)
  const [stravaToken]    = useLocalStorage('sporeus-strava-token', '')
  const [_confirmRecord]  = useLocalStorage(CONFIRM_LS_KEY, null)
  const { t }        = useContext(LangCtx)

  const sportLabel = SPORT_BRANCHES.find(b => b.id === profile.primarySport)?.label || profile.sport || ''
  const levelLabel = ATHLETE_LEVELS.find(l => l.id === profile.athleteLevel)?.label || ''
  const lc         = LEVEL_CONFIG[profile.athleteLevel] || LEVEL_CONFIG.competitive

  // v9.68.0 — Persist across reloads. A beginner who opens advanced once shouldn't
  // get reset to simplified view on every refresh; that turns "explore deeper" into
  // a per-session toy. localStorage keeps the user's chosen depth.
  const [showAdvanced, setShowAdvanced] = useLocalStorage('sporeus-show-advanced', false)
  // DASH_CARD_DEFS is a module constant → defaultLayout never changes; memoize
  // so the derived `dl`/`toggleCard` deps stay stable across renders.
  const defaultLayout = useMemo(() => Object.fromEntries(DASH_CARD_DEFS.map(c => [c.id, true])), [])
  const [dashLayout, setDashLayout] = useLocalStorage('sporeus-dash-layout', defaultLayout)
  const [showCustomize, setShowCustomize] = useState(false)
  // Customize panel groups default collapsed (234 cards); 'core' opens first.
  const [openGroups, setOpenGroups] = useState(() => ({ core: true }))
  const toggleGroup = useCallback(key => setOpenGroups(p => ({ ...p, [key]: !p[key] })), [])
  const dl       = useMemo(() => ({ ...defaultLayout, ...dashLayout }), [defaultLayout, dashLayout])
  const toggleCard = useCallback(
    id => setDashLayout(prev => ({ ...defaultLayout, ...prev, [id]: !prev[id] })),
    [defaultLayout, setDashLayout]
  )
  const setAllCards = useCallback(
    val => setDashLayout(Object.fromEntries(DASH_CARD_DEFS.map(c => [c.id, val]))),
    [setDashLayout]
  )

  // ── Date range filter ─────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useLocalStorage('sporeus-dash-range', '28')
  const rangeStart = useMemo(() => {
    if (dateRange === 'season') return '2000-01-01'
    const d = new Date(); d.setUTCDate(d.getUTCDate() - parseInt(dateRange, 10))
    return d.toISOString().slice(0, 10)
  }, [dateRange])
  const filteredLog   = useMemo(() => log.filter(e => e.date >= rangeStart), [log, rangeStart])
  const ctlChartDays  = dateRange === '7' ? 30 : dateRange === '28' ? 90 : dateRange === '90' ? 180 : 730
  const rangeLabel    = dateRange === 'season' ? 'SEASON' : `LAST ${dateRange}D`

  // ── Derived metrics ────────────────────────────────────────────────────────────
  const totalTSS   = useMemo(() => filteredLog.reduce((s, e) => s + (e.tss || 0), 0), [filteredLog])
  const totalMin   = useMemo(() => filteredLog.reduce((s, e) => s + (e.duration || 0), 0), [filteredLog])
  // v9.469 \u2014 average over sessions that HAVE an rpe (null-rpe entries used to
  // drag the average down via `|| 0`).
  const avgRPE     = useMemo(() => {
    const withRpe = filteredLog.filter(e => Number.isFinite(Number(e.rpe)) && Number(e.rpe) > 0)
    return withRpe.length ? (withRpe.reduce((s, e) => s + Number(e.rpe), 0) / withRpe.length).toFixed(1) : '\u2014'
  }, [filteredLog])
  const srpeLoad   = useMemo(() => filteredLog.reduce((s, e) => s + ((e.rpe || 0) * (e.duration || 0)), 0), [filteredLog])
  const { atl, ctl, tsb, daily } = useMemo(() => calcLoad(log), [log])
  // First-run activation payoff: science-anchored Day-0/early-trend/first-CTL
  // insight. Renders only once the athlete has ≥1 session (selectInsight returns
  // null at 0). log is already oldest-first (display reverses it elsewhere).
  const firstRunInsight = useMemo(
    () => selectInsight(log, ctl, lang === 'tr' ? 'tr' : 'en'),
    [log, ctl, lang],
  )
  const acwr        = useMemo(() => calculateACWR(log), [log])
  const consistency = useMemo(() => calculateConsistency(log), [log])
  const monoStrain  = useMemo(() => monotonyStrain(log), [log])

  const tsbColor  = tsb > 5 ? '#5bc25b' : tsb < -10 ? '#e03030' : '#f5c542'
  const countSess = useCountUp(filteredLog.length)
  const today     = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
  const prev7     = daily.length >= 8 ? daily[daily.length - 8] : null
  const trendCTL  = prev7 ? ctl - prev7.ctl : 0
  const trendATL  = prev7 ? atl - prev7.atl : 0
  const trendTSB  = prev7 ? (ctl - atl) - (prev7.ctl - prev7.atl) : 0
  const readiness = totalTSS > 600
    ? { label: t('fatigued'), color: '#e03030' }
    : totalTSS > 400
    ? { label: t('trained'),  color: '#f5c542' }
    : { label: t('fresh'),    color: '#5bc25b' }

  const coachingMsg = (() => {
    const lvl    = profile.athleteLevel || 'competitive'
    const isBusy = totalTSS > 400
    if (lvl === 'beginner') return isBusy
      ? t('coachMsgBeginnerBusy')
      : t('coachMsgBeginnerFresh')
    if (!isBusy) return null
    if (lvl === 'recreational') return t('coachMsgRecreational')
    if (lvl === 'competitive')  return t('coachMsgCompetitive')
    return `TSB ${tsb >= 0 ? '+' : ''}${tsb} · ${lang === 'tr' ? 'Yüksek yük — deload önerilir. Eşik → Z2 45dk.' : 'High load detected — deload recommended. Swap threshold → Z2 45min.'}`
  })()

  const dqResult = useMemo(
    () => assessDataQuality(log, recovery, testResults, profile),
    [log, recovery, testResults, profile]
  )
  const [showDQ, setShowDQ] = useState(false)

  const efSessions = useMemo(() => (log || []).map(e => ({
    date: e.date, avgHR: e.avgHR, np: e.np, avgPower: e.avgPower,
    avgPaceMPerMin: e.avgPaceMPerMin, sport: e.sport,
  })), [log])

  // J2/J3 — CTL + TSB interpretations (Banister/Coggan citations)
  const prev28CTL  = daily.length >= 29 ? (daily[daily.length - 29]?.ctl ?? null) : null
  const ctlInterp  = useMemo(() => interpretCTL(ctl, prev28CTL), [ctl, prev28CTL])
  const tsbInterp  = useMemo(() => interpretTSB(tsb), [tsb])

  // L3 — predictFitness 4w/8w projection
  const fitProj = useMemo(() => log.length >= 14 ? predictFitness(log) : null, [log])

  // N4 — Cadence trend (entries from FIT/Strava imports)
  const cadenceEntries = useMemo(() =>
    (filteredLog || []).filter(e => (e.avgCadence || 0) > 0).slice(-24),
    [filteredLog]
  )

  // N5 — Key profile metrics
  const profileMetrics = useMemo(() => [
    profile?.ftp      && { label: 'FTP',    val: `${profile.ftp}W`,           color: '#ff6600' },
    profile?.maxhr    && { label: 'MAX HR', val: `${profile.maxhr}bpm`,        color: '#e03030' },
    profile?.vo2max   && { label: 'VO₂max', val: `${profile.vo2max}`,          color: '#5bc25b' },
    profile?.weight   && { label: 'WEIGHT', val: `${profile.weight}kg`,         color: '#888'    },
    profile?.threshold && { label: 'LT2',   val: `${profile.threshold}W`,      color: '#0064ff' },
  ].filter(Boolean), [profile?.ftp, profile?.maxhr, profile?.vo2max, profile?.weight, profile?.threshold])

  // K4 — Monotony daily TSS bars (computeMonotony Foster 1998)
  const weekLoadDetail = useMemo(() => computeMonotony(log), [log])

  // J5 — Sub-threshold 8-week trend (Seiler 2010)
  const subZones = useMemo(() => {
    const hr = profile?.maxhr ? Math.round(profile.maxhr * 0.9) : null
    const pw = profile?.ftp   ? parseFloat(profile.ftp)         : null
    if (!hr && !pw) return null
    return { ...(hr ? { thresholdHR: hr } : {}), ...(pw ? { thresholdPower: pw } : {}) }
  }, [profile?.maxhr, profile?.ftp])

  const subTrend = useMemo(
    () => subZones ? subThresholdTrend(log, subZones, 8) : [],
    [log, subZones]
  )

  // Polarization ratio for current week (sub-threshold min / total week min)
  const polarRatio = useMemo(() => {
    if (!subTrend.length) return null
    const thisWk = subTrend[subTrend.length - 1]
    if (thisWk?.minutes == null) return null
    const weekEnd = new Date(thisWk.weekStart + 'T00:00:00Z')
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
    const weekEndStr = weekEnd.toISOString().slice(0, 10)
    const totalMin = (log || []).reduce((acc, s) => {
      const d = (s.date || '').slice(0, 10)
      if (d < thisWk.weekStart || d >= weekEndStr) return acc
      const m = s.durationSec != null ? s.durationSec / 60
              : s.duration    != null ? s.duration
              : 0
      return acc + m
    }, 0)
    if (totalMin <= 0) return null
    return Math.round(thisWk.minutes / totalMin * 100)
  }, [subTrend, log])

  // Compute once — sport-specific render gates
  const hasCyclingData  = useMemo(() => parseFloat(profile?.ftp || 0) > 0 ||
    log.some(e => RE_CYCLE_TYPE.test(e.type || '') || RE_CYCLE_SPORT.test(e.sport || '')),
    [log, profile])

  const hasSwimData     = useMemo(() =>
    log.some(e => RE_SWIM.test(e.type || '') || RE_SWIM.test(e.sport || '')),
    [log])

  const hasTriData      = useMemo(() =>
    profile?.primarySport === 'triathlon' ||
    new Set(log.map(e => (e.type || '').split(' ')[0].toLowerCase()))
      .size >= 3,
    [log, profile])

  // v9.7.0 — rowing gate. profile.primarySport='rowing' OR any log entry typed
  // as a row/erg/2k test session OR sport='rowing' literal.
  const hasRowingData   = useMemo(() =>
    profile?.primarySport === 'rowing' ||
    log.some(e => RE_ROW_TYPE.test(e.type || '') || RE_ROW_SPORT.test(e.sport || '')),
    [log, profile])

  // ── Header badges (sport, level, coach, data quality) ─────────────────────────
  const metricsRow = profileMetrics.length >= 2 ? (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
      {profileMetrics.map(m => (
        <span key={m.label} style={{ ...S.mono, fontSize: '10px', color: m.color, border: `1px solid ${m.color}33`, padding: '2px 7px', borderRadius: '2px' }}>
          {m.label} {m.val}
        </span>
      ))}
    </div>
  ) : null

  const headerBadges = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
      {sportLabel && (
        <span style={{ ...S.mono, fontSize: '10px', color: '#ff6600', border: '1px solid #ff660044', padding: '2px 7px', borderRadius: '2px' }}>
          {sportLabel.toUpperCase()}
          {profile.triathlonType && profile.primarySport === 'triathlon' ? ` · ${profile.triathlonType.toUpperCase()}` : ''}
        </span>
      )}
      {levelLabel && (
        <span style={{ ...S.mono, fontSize: '10px', color: '#4a90d9', border: '1px solid #4a90d944', padding: '2px 7px', borderRadius: '2px' }}>
          {levelLabel.toUpperCase()}
        </span>
      )}
      {myCoach === 'huseyin-sporeus' && (
        <span style={{ ...S.mono, fontSize: '10px', color: '#5bc25b', border: '1px solid #5bc25b44', padding: '2px 7px', borderRadius: '2px' }}>
          ◈ COACH: HÜSEYİN AKBULUT
        </span>
      )}
      <button
        onClick={() => setShowDQ(s => !s)}
        title="Data quality — click for tips"
        style={{ ...S.mono, fontSize: '10px', color: dqResult.gradeColor, border: `1px solid ${dqResult.gradeColor}44`, padding: '2px 7px', borderRadius: '2px', background: 'transparent', cursor: 'pointer', letterSpacing: '0.06em' }}>
        DATA: {dqResult.grade} {dqResult.score}/100
      </button>
      {showDQ && (
        <div style={{ width: '100%', background: 'var(--card-bg)', border: `1px solid ${dqResult.gradeColor}44`, borderRadius: '5px', padding: '10px 12px', marginTop: '4px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {dqResult.factors.map(f => (
              <div key={f.name} style={{ textAlign: 'center', minWidth: '56px' }}>
                <div style={{ ...S.mono, fontSize: '14px', fontWeight: 700, color: f.score >= 80 ? '#5bc25b' : f.score >= 60 ? '#0064ff' : f.score >= 40 ? '#f5c542' : '#e03030' }}>{f.score}</div>
                <div style={{ ...S.mono, fontSize: '8px', color: '#555', letterSpacing: '0.06em' }}>{f.name}</div>
              </div>
            ))}
          </div>
          {dqResult.tips.length > 0 && (
            <div style={{ ...S.mono, fontSize: '10px', color: '#888', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
              {dqResult.tips.map((tip, i) => <div key={i}>→ {lang === 'tr' ? tip.tr : tip.en}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── Beginner simplified dashboard ─────────────────────────────────────────────
  if (lc.dashSimple && !showAdvanced) {
    return (
      <div className="sp-fade">
        <ErrorBoundary>
          <Suspense fallback={null}>
            <MissionHeadline />
          </Suspense>
        </ErrorBoundary>
        <div data-elite-program-card>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <EliteProgramCard log={log} profile={profile} setLog={setLog} />
            </Suspense>
          </ErrorBoundary>
        </div>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <InjuryReturnCard log={log} profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <MultiPeakSeasonCard profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <CyclePhaseCard profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <RaceStrategyCard profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <FieldTestHistoryCard />
          </Suspense>
        </ErrorBoundary>
        <TodayStripCard log={log} isTR={lang === 'tr'} onLogSession={onLogSession} />
        <ErrorBoundary>
          <EliteMetricsStrip
            profile={profile}
            log={log}
            testResults={testResults}
            isTR={lang === 'tr'}
            onGoToProfile={onGoToProfile}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <DailyBriefingCard
              profile={profile}
              log={log}
              plan={plan}
              planStatus={planStatus}
              recovery={recovery}
              isTR={lang === 'tr'}
            />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <NutritionTimingCard profile={profile} plan={plan} log={log} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <FuelingCard profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <CaffeineDoseCard profile={profile} plan={plan} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <HydrationTargetCard profile={profile} plan={plan} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <EliteRecoveryCard profile={profile} log={log} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <KeySessionsCard profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <DrillsLibraryCard profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <TodayReadinessCard log={log} recovery={recovery} profile={profile} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <RaceGoalAnalyzerCard profile={profile} log={log} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ProgramSelectorCard profile={profile} log={log} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <CoachGateCard isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <TrainingBridgeCard profile={profile} log={log} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <RaceGoalDashCard profile={profile} log={log} isTR={lang === 'tr'} onLogSession={onLogSession} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <VdotProgressCard profile={profile} log={log} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...S.mono, fontSize: '11px', color: '#888', marginBottom: '4px' }}>{today}</div>
          <div style={{ ...S.mono, fontSize: '18px', fontWeight: 600 }}>
            {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
          </div>
          {headerBadges}
          {metricsRow}
        </div>
        {log.length === 0 && (
          <GettingStartedCard isTR={lang === 'tr'} onLogSession={onLogSession} stravaConnected={!!stravaToken} onConnectStrava={onGoToProfile}/>
        )}
        {log.length > 0 && <FirstRunInsightCard insight={firstRunInsight} isTR={lang === 'tr'} />}
        <div className="sp-card" style={{ ...S.row, marginBottom: '16px', animationDelay: '0ms' }}>
          {[
            { val: countSess, lbl: t('sessions') },
            { val: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`, lbl: t('volume') },
            { val: avgRPE, lbl: t('avgRpe') },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={S.stat}>
              <span style={S.statVal}>{val}</span>
              <span style={S.statLbl}>{lbl}</span>
            </div>
          ))}
        </div>
        {/* WeeklyTssGoalCard — shown in beginner mode */}
        <ErrorBoundary>
          <WeeklyTssGoalCard log={log} profile={profile} isTR={lang === 'tr'} />
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <WeeklyReviewCard log={log} profile={profile} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ConsistencyDepthCard log={log} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <MonthlyProgressCard log={log} profile={profile} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <WeekSessionTypeCard log={log} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <IntensityBalanceCard log={log} isTR={lang === 'tr'} />
          </Suspense>
        </ErrorBoundary>
        <div className="sp-card" style={{ ...S.card, animationDelay: '50ms', borderLeft: '4px solid #5bc25b' }}>
          <div style={{ ...S.mono, fontSize: '12px', lineHeight: 1.8, color: 'var(--text)' }}>{coachingMsg}</div>
          {avgRPE !== '—' && (
            <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginTop: '8px' }}>
              {parseFloat(avgRPE) >= 7 ? '⚠ Average RPE is high this week — include easy days.' : parseFloat(avgRPE) < 5 ? '✓ Low-RPE week — body recovering well.' : '○ Moderate effort week — on track.'}
            </div>
          )}
        </div>
        <div className="sp-card" style={{ ...S.card, animationDelay: '80ms' }}>
          <div style={S.cardTitle}>{t('recentSessions')}</div>
          {filteredLog.length === 0 ? (
            <div style={{ ...S.mono, fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '20px 0' }}>{t('noSessions')}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...S.mono, fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: '#888', fontSize: '10px' }}>
                  {[t('dateL'), 'TYPE', 'MIN', 'RPE'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 0 8px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filteredLog].reverse().map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 0', color: 'var(--sub)' }}>{s.date}</td>
                    <td style={{ padding: '6px 0' }}>{s.type}</td>
                    <td style={{ padding: '6px 0' }}>{s.duration}</td>
                    <td style={{ padding: '6px 0', color: s.rpe >= 8 ? '#e03030' : s.rpe >= 6 ? '#f5c542' : '#5bc25b' }}>{s.rpe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {(() => { const ra = getRecentAchievement(7); return ra ? <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginBottom: '12px' }}>◈ {ra.name} — {ra.desc}</div> : null })()}
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <button style={{ ...S.btnSec, fontSize: '11px' }} onClick={() => setShowAdvanced(true)}>{t('showAdvancedBtn')}</button>
        </div>
      </div>
    )
  }

  // ── Advanced dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="sp-fade">
      {dl['missionHeadline'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <MissionHeadline />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['eliteProgram'] !== false && (
      <div data-elite-program-card>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <EliteProgramCard log={log} profile={profile} setLog={setLog} />
          </Suspense>
        </ErrorBoundary>
      </div>
      )}
      {dl['fieldTestHistory'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <FieldTestHistoryCard />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['todayProgrammedSession'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <TodayProgrammedSessionCard log={log} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['todayStrip'] !== false && (
      <TodayStripCard log={log} isTR={lang === 'tr'} onLogSession={onLogSession} />
      )}
      {dl['eliteMetrics'] !== false && (
      <ErrorBoundary>
        <EliteMetricsStrip
          profile={profile}
          log={log}
          testResults={testResults}
          isTR={lang === 'tr'}
          onGoToProfile={undefined}
        />
      </ErrorBoundary>
      )}
      {dl['dailyBriefing'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <DailyBriefingCard
            profile={profile}
            log={log}
            plan={plan}
            planStatus={planStatus}
            recovery={recovery}
            isTR={lang === 'tr'}
          />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['nutritionTiming'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <NutritionTimingCard profile={profile} plan={plan} log={log} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['todayReadiness'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <TodayReadinessCard log={log} recovery={recovery} profile={profile} />
        </Suspense>
      </ErrorBoundary>
      )}
      {log.length === 0 && (
        <GettingStartedCard isTR={lang === 'tr'} onLogSession={onLogSession} stravaConnected={!!stravaToken} onConnectStrava={onGoToProfile}/>
      )}
      {log.length > 0 && <FirstRunInsightCard insight={firstRunInsight} isTR={lang === 'tr'} />}
      {dl['raceGoalAnalyzer'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <RaceGoalAnalyzerCard profile={profile} log={log} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['programSelector'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <ProgramSelectorCard profile={profile} log={log} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['coachGate'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <CoachGateCard isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['trainingBridge'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <TrainingBridgeCard profile={profile} log={log} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['raceGoalDash'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <RaceGoalDashCard profile={profile} log={log} isTR={lang === 'tr'} onLogSession={onLogSession} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['vdotProgress'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <VdotProgressCard profile={profile} log={log} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['milestones'] !== false && <MilestonesList log={log} profile={profile}/>}
      {dl['backupReminder'] !== false && <BackupReminder log={log}/>}
      {dl['weeklyRetro'] !== false && <WeeklyRetroCard log={log} recovery={recovery} plan={plan} lang={lang}/>}
      {dl['phaseAnalytics'] !== false && <PhaseAnalyticsCard log={log} plan={plan} lang={lang}/>}

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', marginBottom: '4px' }}>{today}</div>
        <div style={{ ...S.mono, fontSize: '18px', fontWeight: 600 }}>
          {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
        </div>
        {headerBadges}
        {metricsRow}
        <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' }}>
          {[['7', '7D'], ['28', '28D'], ['90', '90D'], ['season', 'SEASON']].map(([val, lbl]) => (
            <button key={val} onClick={() => setDateRange(val)}
              style={{ ...S.mono, fontSize: '9px', padding: '3px 10px', borderRadius: '3px', cursor: 'pointer', letterSpacing: '0.06em', border: `1px solid ${dateRange === val ? '#ff6600' : 'var(--border)'}`, background: dateRange === val ? 'rgba(255,102,0,0.12)' : 'transparent', color: dateRange === val ? '#ff6600' : 'var(--muted)', fontWeight: dateRange === val ? 700 : 400 }}>
              {lbl}
            </button>
          ))}
        </div>
        {showAdvanced && (
          <button style={{ ...S.btnSec, fontSize: '10px', marginTop: '8px', padding: '10px 14px', minHeight: '44px' }} onClick={() => setShowAdvanced(false)}>{t('simpleViewBtn')}</button>
        )}
        <button style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', padding: '10px 14px', minHeight: '44px', cursor: 'pointer', marginTop: '8px', marginLeft: '8px' }} onClick={() => setShowCustomize(s => !s)}>
          ⚙ Customize Dashboard
        </button>
        {showCustomize && (
          <div style={{ marginTop: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
                {lang === 'tr' ? 'KARTLARI GÖSTER / GİZLE' : 'SHOW / HIDE CARDS'}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setAllCards(true)} style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer' }}>
                  {lang === 'tr' ? 'Tümünü Göster' : 'Show all'}
                </button>
                <button onClick={() => setAllCards(false)} style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer' }}>
                  {lang === 'tr' ? 'Tümünü Gizle' : 'Hide all'}
                </button>
              </div>
            </div>
            {DASH_CARD_GROUPS.map(g => {
              const cards = DASH_CARD_DEFS.filter(c => c.group === g.key)
              if (cards.length === 0) return null
              const open = !!openGroups[g.key]
              return (
                <div key={g.key} style={{ marginBottom: '6px', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleGroup(g.key)}
                    style={{ ...S.mono, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--text)', background: 'var(--card-bg)', border: 'none', padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span>{open ? '▾' : '▸'} {lang === 'tr' ? g.tr : g.en}</span>
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{cards.length}</span>
                  </button>
                  {open && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px 10px' }}>
                      {cards.map(card => (
                        <label key={card.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', ...S.mono, fontSize: '11px', color: dl[card.id] ? 'var(--text)' : 'var(--muted)' }}>
                          <input type="checkbox" checked={!!dl[card.id]} onChange={() => toggleCard(card.id)} style={{ accentColor: '#ff6600' }}/>
                          {lang === 'tr' ? (card.tr || card.label) : card.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Status + load metrics */}
      <ReadinessCard
        dl={dl} lc={lc} readiness={readiness}
        ctl={ctl} atl={atl} tsb={tsb} tsbColor={tsbColor}
        trendCTL={trendCTL} trendATL={trendATL} trendTSB={trendTSB} prev7={prev7}
        consistency={consistency} dqResult={dqResult} coachingMsg={coachingMsg} totalTSS={totalTSS}
      />

      {/* J2+J3 — CTL + TSB science interpretations */}
      {lc.showCTL && log.length >= 14 && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#555', lineHeight: 1.7, padding: '8px 12px', marginBottom: '10px', borderLeft: '2px solid #0064ff44', background: 'var(--surface)' }}>
          <div style={{ color: '#888', marginBottom: '2px' }}>{lang === 'tr' ? ctlInterp.tr : ctlInterp.en}</div>
          <div style={{ color: '#888' }}>{lang === 'tr' ? tsbInterp.tr : tsbInterp.en}</div>
          <div style={{ color: '#2a2a2a', fontSize: '9px', marginTop: '3px' }}>{ctlInterp.citation}</div>
        </div>
      )}
      {lc.showCTL && log.length >= 7 && log.length < 14 && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#555', lineHeight: 1.7, padding: '8px 12px', marginBottom: '10px', borderLeft: '2px solid #0064ff44', background: 'var(--surface)' }}>
          {lang === 'tr'
            ? 'Yorum ~2 haftalık kayıttan sonra keskinleşir — kondisyon (CTL) ve form (TSB) değerleri hâlâ yerleşiyor.'
            : 'Interpretation sharpens after ~2 weeks of logs — your fitness (CTL) and form (TSB) values are still settling.'}
        </div>
      )}

      {/* L3 — Fitness projection 4w/8w */}
      {lc.showCTL && fitProj && (() => {
        const TRAJ = { improving: { c: '#5bc25b', a: '↑' }, declining: { c: '#e03030', a: '↓' }, stable: { c: '#f5c542', a: '→' }, flat: { c: '#555', a: '—' } }
        const { c, a } = TRAJ[fitProj.trajectory] || TRAJ.flat
        return (
          <div style={{ ...S.mono, fontSize: '10px', padding: '8px 12px', marginBottom: '10px', borderLeft: `2px solid ${c}44`, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px', color: c, fontWeight: 700 }}>{a}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: '#555' }} title="Chronic Training Load — 42-day avg fitness. Higher = more base fitness.">CTL</span>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{fitProj.current}</span>
                <span style={{ color: '#333' }}>→ 4W</span>
                <span style={{ color: c, fontWeight: 700 }}>{fitProj.in4w}</span>
                <span style={{ color: '#333' }}>8W</span>
                <span style={{ color: '#666' }}>{fitProj.in8w}</span>
                <span style={{ color: '#333', fontSize: '9px' }}>AVG {fitProj.avgWeeklyTSS} TSS/WK</span>
              </div>
              <div style={{ color: '#555', fontSize: '9px', marginTop: '3px' }}>
                {lang === 'tr' ? fitProj.label?.tr : fitProj.label?.en}
              </div>
            </div>
          </div>
        )
      })()}

      {dl['raceReadiness'] !== false && (
      <ErrorBoundary inline name="Race Readiness">
        <RaceReadinessCard log={log} recovery={recovery} injuries={injuries} profile={profile} plan={plan} planStatus={planStatus} lang={lang}/>
      </ErrorBoundary>
      )}
      {dl['raceWeekProtocol'] !== false && <ErrorBoundary><Suspense fallback={null}><RaceWeekProtocolCard profile={profile} log={log}/></Suspense></ErrorBoundary>}
      {dl['eliteRaceWeek'] !== false && <ErrorBoundary><Suspense fallback={null}><EliteRaceWeekCard profile={profile}/></Suspense></ErrorBoundary>}
      {dl['raceDayFuelingTimeline'] !== false && <ErrorBoundary><Suspense fallback={null}><RaceDayFuelingTimelineCard profile={profile}/></Suspense></ErrorBoundary>}
      {dl['raceMentalRehearsal'] !== false && <ErrorBoundary><Suspense fallback={null}><RaceMentalRehearsalCard profile={profile}/></Suspense></ErrorBoundary>}
      {dl['raceEquipmentChecklist'] !== false && <ErrorBoundary><Suspense fallback={null}><RaceEquipmentChecklistCard profile={profile}/></Suspense></ErrorBoundary>}
      {dl['preRaceSleepBanking'] !== false && <ErrorBoundary><Suspense fallback={null}><PreRaceSleepBankingCard recovery={recovery} profile={profile}/></Suspense></ErrorBoundary>}
      {dl['altitudeStimulus'] !== false && <ErrorBoundary><Suspense fallback={null}><AltitudeStimulusCard log={log}/></Suspense></ErrorBoundary>}
      {dl['postHardSessionResponse'] !== false && <ErrorBoundary><Suspense fallback={null}><PostHardSessionResponseCard log={log} recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['seasonalLoadDistribution'] !== false && <ErrorBoundary><Suspense fallback={null}><SeasonalLoadDistributionCard log={log}/></Suspense></ErrorBoundary>}
      {dl['crossSportRecoveryGap'] !== false && <ErrorBoundary><Suspense fallback={null}><CrossSportRecoveryGapCard log={log}/></Suspense></ErrorBoundary>}
      {dl['morningLogConsistency'] !== false && <ErrorBoundary><Suspense fallback={null}><MorningLogConsistencyCard recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['weeklyGoalVariance'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyGoalVarianceCard log={log} profile={profile}/></Suspense></ErrorBoundary>}
      {dl['checkInQuality'] !== false && <ErrorBoundary><Suspense fallback={null}><CheckInQualityCard log={log}/></Suspense></ErrorBoundary>}
      {dl['averageWeekShape'] !== false && <ErrorBoundary><Suspense fallback={null}><AverageWeekShapeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['moodEnergyBalance'] !== false && <ErrorBoundary><Suspense fallback={null}><MoodEnergyBalanceCard recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['rpeStability'] !== false && <ErrorBoundary><Suspense fallback={null}><RpeStabilityCard log={log}/></Suspense></ErrorBoundary>}
      {dl['stressPattern'] !== false && <ErrorBoundary><Suspense fallback={null}><StressPatternCard recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['perseverance'] !== false && <ErrorBoundary><Suspense fallback={null}><PerseveranceCard log={log}/></Suspense></ErrorBoundary>}
      {dl['longestSessionTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><LongestSessionTrendCard log={log}/></Suspense></ErrorBoundary>}
      {dl['weeklyVolumeIntensityRatio'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyVolumeIntensityRatioCard log={log}/></Suspense></ErrorBoundary>}
      {dl['sessionDensity'] !== false && <ErrorBoundary><Suspense fallback={null}><SessionDensityCard log={log}/></Suspense></ErrorBoundary>}
      {dl['sleepConsistency'] !== false && <ErrorBoundary><Suspense fallback={null}><SleepConsistencyCard recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['lifetimeTotals'] !== false && <ErrorBoundary><Suspense fallback={null}><LifetimeTotalsCard log={log}/></Suspense></ErrorBoundary>}
      {dl['yearOverYear'] !== false && <ErrorBoundary><Suspense fallback={null}><YearOverYearCard log={log}/></Suspense></ErrorBoundary>}
      {dl['trainingAgeStage'] !== false && <ErrorBoundary><Suspense fallback={null}><TrainingAgeStageCard log={log}/></Suspense></ErrorBoundary>}
      {dl['weeklyVolumeRecord'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyVolumeRecordCard log={log}/></Suspense></ErrorBoundary>}
      {dl['raceTimeEstimator'] !== false && <ErrorBoundary><Suspense fallback={null}><RaceTimeEstimatorCard log={log}/></Suspense></ErrorBoundary>}
      {dl['paceByRpe'] !== false && <ErrorBoundary><Suspense fallback={null}><PaceByRpeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['volumeAcceleration'] !== false && <ErrorBoundary><Suspense fallback={null}><VolumeAccelerationCard log={log}/></Suspense></ErrorBoundary>}
      {dl['annualTssTarget'] !== false && <ErrorBoundary><Suspense fallback={null}><AnnualTssTargetCard log={log}/></Suspense></ErrorBoundary>}
      {dl['hrForRpe'] !== false && <ErrorBoundary><Suspense fallback={null}><HrForRpeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['bedtimeConsistency'] !== false && <ErrorBoundary><Suspense fallback={null}><BedtimeConsistencyCard recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['restingHrFitnessTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><RestingHrFitnessTrendCard recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['energySorenessDivergence'] !== false && <ErrorBoundary><Suspense fallback={null}><EnergySorenessDivergenceCard recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['logStreakBreaker'] !== false && <ErrorBoundary><Suspense fallback={null}><LogStreakBreakerCard log={log} recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['dataCoverage'] !== false && <ErrorBoundary><Suspense fallback={null}><DataCoverageCard log={log} recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['dayOfWeekAvailability'] !== false && <ErrorBoundary><Suspense fallback={null}><DayOfWeekAvailabilityCard log={log}/></Suspense></ErrorBoundary>}
      {dl['perfectWeek'] !== false && <ErrorBoundary><Suspense fallback={null}><PerfectWeekCard log={log}/></Suspense></ErrorBoundary>}
      {dl['weeklyTssVariance'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyTssVarianceCard log={log}/></Suspense></ErrorBoundary>}
      {dl['longRunFrequency'] !== false && <ErrorBoundary><Suspense fallback={null}><LongRunFrequencyCard log={log}/></Suspense></ErrorBoundary>}
      {dl['recoveryQualityStreak'] !== false && <ErrorBoundary><Suspense fallback={null}><RecoveryQualityStreakCard recovery={recovery} profile={profile}/></Suspense></ErrorBoundary>}
      {dl['ctlSlope'] !== false && <ErrorBoundary><Suspense fallback={null}><CtlSlopeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['weeklyKmPerSport'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyKmPerSportCard log={log}/></Suspense></ErrorBoundary>}
      {dl['paceRange'] !== false && <ErrorBoundary><Suspense fallback={null}><PaceRangeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['timeOnFeet'] !== false && <ErrorBoundary><Suspense fallback={null}><TimeOnFeetCard log={log}/></Suspense></ErrorBoundary>}
      {dl['restDayDistribution'] !== false && <ErrorBoundary><Suspense fallback={null}><RestDayDistributionCard log={log}/></Suspense></ErrorBoundary>}
      {dl['newSessionTypeIntro'] !== false && <ErrorBoundary><Suspense fallback={null}><NewSessionTypeIntroCard log={log}/></Suspense></ErrorBoundary>}
      {dl['mesocycleProgression'] !== false && <ErrorBoundary><Suspense fallback={null}><MesocycleProgressionCard log={log}/></Suspense></ErrorBoundary>}
      {dl['volumeIntensityScissors'] !== false && <ErrorBoundary><Suspense fallback={null}><VolumeIntensityScissorsCard log={log}/></Suspense></ErrorBoundary>}
      {dl['longRunConsistency'] !== false && <ErrorBoundary><Suspense fallback={null}><LongRunConsistencyCard log={log}/></Suspense></ErrorBoundary>}
      {dl['calendarHoles'] !== false && <ErrorBoundary><Suspense fallback={null}><CalendarHolesCard log={log}/></Suspense></ErrorBoundary>}
      {dl['backToBackLongDay'] !== false && <ErrorBoundary><Suspense fallback={null}><BackToBackLongDayCard log={log}/></Suspense></ErrorBoundary>}
      {dl['seasonAnchor'] !== false && <ErrorBoundary><Suspense fallback={null}><SeasonAnchorCard log={log}/></Suspense></ErrorBoundary>}
      {dl['cumulativeFatigueWindows'] !== false && <ErrorBoundary><Suspense fallback={null}><CumulativeFatigueWindowsCard log={log}/></Suspense></ErrorBoundary>}
      {dl['weeklyEnduranceTime'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyEnduranceTimeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['twoADays'] !== false && <ErrorBoundary><Suspense fallback={null}><TwoADaysCard log={log}/></Suspense></ErrorBoundary>}
      {dl['sessionLengthDistribution'] !== false && <ErrorBoundary><Suspense fallback={null}><SessionLengthDistributionCard log={log}/></Suspense></ErrorBoundary>}
      {dl['hardEasyAdherence'] !== false && <ErrorBoundary><Suspense fallback={null}><HardEasyAdherenceCard log={log}/></Suspense></ErrorBoundary>}
      {dl['peakWeekFrequency'] !== false && <ErrorBoundary><Suspense fallback={null}><PeakWeekFrequencyCard log={log}/></Suspense></ErrorBoundary>}
      {dl['zoneThreeBlackHole'] !== false && <ErrorBoundary><Suspense fallback={null}><ZoneThreeBlackHoleCard log={log}/></Suspense></ErrorBoundary>}
      {dl['hardSessionTypePattern'] !== false && <ErrorBoundary><Suspense fallback={null}><HardSessionTypePatternCard log={log}/></Suspense></ErrorBoundary>}
      {dl['restDayEnergyTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><RestDayEnergyTrendCard log={log} recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['highRpeBlock'] !== false && <ErrorBoundary><Suspense fallback={null}><HighRpeBlockCard log={log}/></Suspense></ErrorBoundary>}
      {dl['postLongRunNextDay'] !== false && <ErrorBoundary><Suspense fallback={null}><PostLongRunNextDayCard log={log}/></Suspense></ErrorBoundary>}
      {dl['midweekHardDayFrequency'] !== false && <ErrorBoundary><Suspense fallback={null}><MidweekHardDayFrequencyCard log={log}/></Suspense></ErrorBoundary>}
      {dl['resetWeekEffect'] !== false && <ErrorBoundary><Suspense fallback={null}><ResetWeekEffectCard log={log}/></Suspense></ErrorBoundary>}
      {dl['seasonRestartCount'] !== false && <ErrorBoundary><Suspense fallback={null}><SeasonRestartCountCard log={log}/></Suspense></ErrorBoundary>}
      {dl['dailyVolumeRange'] !== false && <ErrorBoundary><Suspense fallback={null}><DailyVolumeRangeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['weeklyVolumeStreak'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyVolumeStreakCard log={log}/></Suspense></ErrorBoundary>}
      {dl['microcycleVariety'] !== false && <ErrorBoundary><Suspense fallback={null}><MicrocycleVarietyCard log={log}/></Suspense></ErrorBoundary>}
      {dl['trainRestTrainPattern'] !== false && <ErrorBoundary><Suspense fallback={null}><TrainRestTrainPatternCard log={log}/></Suspense></ErrorBoundary>}
      {dl['overlookedSessionType'] !== false && <ErrorBoundary><Suspense fallback={null}><OverlookedSessionTypeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['highRpeLowTss'] !== false && <ErrorBoundary><Suspense fallback={null}><HighRpeLowTssCard log={log}/></Suspense></ErrorBoundary>}
      {dl['trainingHourBudget'] !== false && <ErrorBoundary><Suspense fallback={null}><TrainingHourBudgetCard log={log}/></Suspense></ErrorBoundary>}
      {dl['weekendLongSessionShare'] !== false && <ErrorBoundary><Suspense fallback={null}><WeekendLongSessionShareCard log={log}/></Suspense></ErrorBoundary>}
      {dl['volumePerSessionTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><VolumePerSessionTrendCard log={log}/></Suspense></ErrorBoundary>}
      {dl['alternatingWeekPattern'] !== false && <ErrorBoundary><Suspense fallback={null}><AlternatingWeekPatternCard log={log}/></Suspense></ErrorBoundary>}
      {dl['hardWeekUnrested'] !== false && <ErrorBoundary><Suspense fallback={null}><HardWeekUnrestedCard log={log}/></Suspense></ErrorBoundary>}
      {dl['maxTssDayPersonalRecord'] !== false && <ErrorBoundary><Suspense fallback={null}><MaxTssDayPersonalRecordCard log={log}/></Suspense></ErrorBoundary>}
      {dl['sessionGapVariance'] !== false && <ErrorBoundary><Suspense fallback={null}><SessionGapVarianceCard log={log}/></Suspense></ErrorBoundary>}
      {dl['trainAfterRest'] !== false && <ErrorBoundary><Suspense fallback={null}><TrainAfterRestCard log={log}/></Suspense></ErrorBoundary>}
      {dl['afterBigWeekRpe'] !== false && <ErrorBoundary><Suspense fallback={null}><AfterBigWeekRpeCard log={log}/></Suspense></ErrorBoundary>}
      {dl['veryEasyShare'] !== false && <ErrorBoundary><Suspense fallback={null}><VeryEasyShareCard log={log}/></Suspense></ErrorBoundary>}
      {dl['consecutiveDeloadCount'] !== false && <ErrorBoundary><Suspense fallback={null}><ConsecutiveDeloadCountCard log={log}/></Suspense></ErrorBoundary>}
      {dl['postHardSessionSoreness'] !== false && <ErrorBoundary><Suspense fallback={null}><PostHardSessionSorenessCard log={log} recovery={recovery}/></Suspense></ErrorBoundary>}
      {dl['hardDaySpacing'] !== false && <ErrorBoundary><Suspense fallback={null}><HardDaySpacingCard log={log}/></Suspense></ErrorBoundary>}
      {dl['proactiveInjuryAlert'] !== false && <ProactiveInjuryAlert log={log} injuries={injuries} lang={lang}/>}
      {dl['loadSpikeAlert'] !== false && <LoadSpikeAlert/>}

      {dl['weeklyTssGoal'] !== false && (
      <ErrorBoundary>
        <WeeklyTssGoalCard log={log} profile={profile} isTR={lang === 'tr'} />
      </ErrorBoundary>
      )}
      {dl['weeklyReview'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <WeeklyReviewCard log={log} profile={profile} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['consistencyDepth'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <ConsistencyDepthCard log={log} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['monthlyProgress'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <MonthlyProgressCard log={log} profile={profile} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['weekSessionType'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <WeekSessionTypeCard log={log} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['intensityBalance'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <IntensityBalanceCard log={log} isTR={lang === 'tr'} />
        </Suspense>
      </ErrorBoundary>
      )}

      {dl['allZones'] !== false && (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <AllZonesCard
            profile={profile}
            log={log}
            testResults={testResults}
            isTR={lang === 'tr'}
          />
        </Suspense>
      </ErrorBoundary>
      )}

      {dl['hrvTrend'] !== false && recovery.some(e => parseFloat(e.hrv) > 0) && (
        <div className="sp-card" style={{ ...S.card, animationDelay: '20ms' }}>
          <div style={S.cardTitle}>HRV TREND</div>
          <Suspense fallback={null}><HRVChart recovery={recovery} days={30}/></Suspense>
        </div>
      )}

      <ErrorBoundary><Suspense fallback={null}><AICoachInsights dl={dl}/></Suspense></ErrorBoundary>
      {dl['insightsPanel'] !== false && <InsightsPanel log={log} recovery={recovery} profile={profile} lang={lang}/>}
      {dl['efTrend'] !== false && (
      <ErrorBoundary inline name="EF Trend">
        <Suspense fallback={null}>
          <EFTrendCard sessions={efSessions} />
        </Suspense>
      </ErrorBoundary>
      )}
      {dl['yourPatterns'] !== false && <YourPatternsCard log={log} recovery={recovery} injuries={injuries} profile={profile} lang={lang}/>}
      {dl['weekStory'] !== false && <WeekStoryCard log={log} recovery={recovery} profile={profile} lang={lang}/>}
      {dl['fuelGuidance'] !== false && <FuelGuidanceCard log={log} plan={plan} profile={profile} lang={lang}/>}
      {dl['didYouKnow'] !== false && <DidYouKnowCard log={log} recovery={recovery} profile={profile} lang={lang}/>}

      {/* Stats row */}
      {dl.stats && (
        <div className="sp-card" style={{ ...S.row, marginBottom: '16px', animationDelay: '50ms' }}>
          {[
            { val: countSess, lbl: t('sessions') },
            { val: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`, lbl: t('volume') },
            { val: avgRPE, lbl: t('avgRpe') },
            { val: totalTSS, lbl: t('tss7'), tip: 'Training Stress Score. Combines duration × intensity². Easy day ~50, hard day ~100+.' },
            { val: srpeLoad > 0 ? srpeLoad : '—', lbl: 'sRPE LOAD', tip: 'Session-RPE load: RPE × minutes (Foster 2001). Quantifies internal load without heart rate or power data.' },
          ].map(({ val, lbl, tip }) => (
            <div key={lbl} style={S.stat}>
              <span style={S.statVal}>{val}</span>
              <span style={S.statLbl}>{lbl}{tip && <HelpTip text={tip}/>}</span>
            </div>
          ))}
        </div>
      )}

      {/* TSS trend chart */}
      {dl.chart && (
        <div className="sp-card" style={{ ...S.card, animationDelay: '100ms' }}>
          <div style={S.cardTitle}>{t('tssChartTitle')}</div>
          {daily.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ ...S.mono, fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                {lang === 'tr' ? 'Henüz antrenman yok' : 'No sessions yet'}
              </div>
              <div style={{ ...S.mono, fontSize: '11px', color: '#888', lineHeight: 1.7 }}>
                {lang === 'tr'
                  ? <>İlk antrenmanını kaydet — kondisyon trendini burada gör. <span style={{ color: '#ff6600' }}>Log</span> sekmesine dokun →</>
                  : <>Log your first session to see your fitness trend here. Tap the <span style={{ color: '#ff6600' }}>Log</span> tab →</>}
              </div>
            </div>
          ) : (
            <TSSChart daily={daily} t={t}/>
          )}
        </div>
      )}

      <RecentSessionsCard filteredLog={filteredLog} rangeLabel={rangeLabel} dl={dl}/>

      {/* M4 — Recent session notes */}
      {dl['sessionNotes'] !== false && (() => {
        const withNotes = [...(filteredLog || [])].reverse().filter(e => e.notes?.trim()).slice(0, 3)
        if (withNotes.length === 0) return null
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay: '155ms' }}>
            <div style={S.cardTitle}>SESSION NOTES</div>
            {withNotes.map((e, i) => (
              <div key={i} style={{ marginBottom: i < withNotes.length - 1 ? '10px' : 0, borderBottom: i < withNotes.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < withNotes.length - 1 ? '10px' : 0 }}>
                <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '3px', letterSpacing: '0.06em' }}>
                  {e.date} · {e.type} · {e.tss} TSS
                </div>
                <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6 }}>
                  {e.notes}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* N4 — Cadence trend */}
      {dl['cadenceTrend'] !== false && cadenceEntries.length >= 5 && (() => {
        const vals = cadenceEntries.map(e => e.avgCadence)
        const avg  = Math.round(vals.reduce((s,v)=>s+v,0)/vals.length)
        const min  = Math.min(...vals), max = Math.max(...vals)
        const range = max - min || 5
        const W = 200, H = 32, pad = 4
        const pts = vals.map((v,i) => {
          const x = pad + i*(W-2*pad)/Math.max(vals.length-1,1)
          const y = H - pad - (v-min)/range*(H-2*pad)
          return `${x},${y}`
        }).join(' ')
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay: '160ms' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={S.cardTitle}>CADENCE TREND — {cadenceEntries.length} SESSIONS</div>
              <div style={{ ...S.mono, fontSize:'12px', color:'#0064ff', fontWeight:600 }}>{avg} rpm avg</div>
            </div>
            <svg role="img" aria-label={lang==='tr' ? `Kadans trendi: ${cadenceEntries.length} antrenman, ortalama ${avg} rpm, ${min}–${max} aralığı` : `Cadence trend: ${cadenceEntries.length} sessions, ${avg} rpm average, ${min}–${max} range`} width={W} height={H} style={{ display:'block', overflow:'visible' }}>
              <polyline points={pts} fill="none" stroke="#0064ff" strokeWidth="1.5" strokeLinejoin="round"/>
              {vals.map((v,i) => {
                const x = pad + i*(W-2*pad)/Math.max(vals.length-1,1)
                const y = H - pad - (v-min)/range*(H-2*pad)
                return <circle key={i} cx={x} cy={y} r="2" fill="#0064ff"/>
              })}
            </svg>
            <div style={{ ...S.mono, fontSize:'9px', color:'#555', marginTop:'4px' }}>
              {min}–{max} rpm · {lang==='tr' ? 'Optimal: koşu 170–180, bisiklet 85–95 rpm' : 'Optimal: run 170–180, cycle 85–95 rpm'}
            </div>
          </div>
        )
      })()}

      {dl.weekly && log.length > 0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay: '170ms' }}>
          <div style={S.cardTitle}>WEEKLY VOLUME — LAST 8 WEEKS</div>
          <WeeklyVolChartMemo log={log}/>
        </div>
      )}

      {/* Zone distribution (donut + monotony) */}
      {dl.zones && lc.showZoneDonut && log.length > 0 && (() => {
        const { mono, strain } = monoStrain
        const monoRed   = mono > 2.0
        const strainRed = strain > 6000
        return (
          <div className="sp-card" style={{ ...S.row, marginBottom: '16px', animationDelay: '180ms' }}>
            <div style={{ ...S.card, flex: '1 1 200px', marginBottom: 0 }}>
              <div style={S.cardTitle}>ZONE DISTRIBUTION</div>
              <ZoneDonutMemo log={log}/>
            </div>
            {lc.showMonotony && (
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ ...S.card, marginBottom: 0, borderLeft: `3px solid ${monoRed ? '#e03030' : '#5bc25b'}` }}>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>MONOTONY INDEX</div>
                  <div style={{ ...S.mono, fontSize: '22px', fontWeight: 600, color: monoRed ? '#e03030' : '#1a1a1a' }}>{mono}</div>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#aaa' }}>{monoRed ? t('monoInjuryRisk') : t('monoNormal')} (alert &gt;2.0)</div>
                  {(() => {
                    const mi = interpretMonotony(mono, strain)
                    return (
                      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '5px', lineHeight: 1.5 }}>
                        {lang === 'tr' ? mi.tr : mi.en}
                      </div>
                    )
                  })()}
                  {weekLoadDetail.weekTSS > 0 && (() => {
                    const maxT = Math.max(...weekLoadDetail.dailyTSS, 1)
                    const days = ['M','T','W','T','F','S','S']
                    const statusLabel = { low: lang === 'tr' ? 'ÇEŞİTLİ' : 'VARIED', moderate: lang === 'tr' ? 'ORTA' : 'MODERATE', high: lang === 'tr' ? 'YÜKSEK' : 'HIGH', insufficient: '' }
                    const statusColor = { low: '#5bc25b', moderate: '#f5c542', high: '#e03030', insufficient: '#333' }
                    return (
                      <>
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', marginTop: '8px', height: '20px' }}>
                          {weekLoadDetail.dailyTSS.map((t, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: '100%', height: `${t > 0 ? Math.max(3, Math.round(t / maxT * 18)) : 2}px`, background: t > 0 ? (monoRed ? '#e03030aa' : '#ff660088') : '#1a1a1a', borderRadius: '1px' }} />
                              <div style={{ ...S.mono, fontSize: '7px', color: '#2a2a2a' }}>{days[i]}</div>
                            </div>
                          ))}
                        </div>
                        {weekLoadDetail.status && weekLoadDetail.status !== 'insufficient' && (
                          <div style={{ ...S.mono, fontSize: '8px', color: statusColor[weekLoadDetail.status] || '#333', marginTop: '4px', letterSpacing: '0.06em' }}>
                            {statusLabel[weekLoadDetail.status]}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
                <div style={{ ...S.card, marginBottom: 0, borderLeft: `3px solid ${strainRed ? '#e03030' : '#5bc25b'}` }}>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>STRAIN INDEX</div>
                  <div style={{ ...S.mono, fontSize: '22px', fontWeight: 600, color: strainRed ? '#e03030' : '#1a1a1a' }}>{strain}</div>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#aaa' }}>{strainRed ? '⚠ HIGH' : 'Normal'} (alert &gt;6000)</div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* J5 — Sub-threshold 8-week trend (Seiler 2010) */}
      {dl['subThresholdTrend'] !== false && subZones && subTrend.some(w => w.minutes !== null) && (() => {
        const maxMin = Math.max(...subTrend.map(w => w.minutes ?? 0), 1)
        const thisWk = subTrend[subTrend.length - 1]
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay: '185ms' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <div style={S.cardTitle}>
                {lang === 'tr' ? 'EŞİK ALTI SÜRE TRENDİ' : 'SUB-THRESHOLD TREND'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                {polarRatio !== null && (
                  <div style={{ ...S.mono, fontSize: '11px', color: polarRatio >= 80 ? '#5bc25b' : '#ff6600', fontWeight: 700 }}>
                    {polarRatio}% <span style={{ fontSize: '8px', color: '#555', fontWeight: 400 }}>≥80%</span>
                  </div>
                )}
                {thisWk?.minutes !== null && (
                  <div style={{ ...S.mono, fontSize: '11px', color: '#5bc25b' }}>
                    {thisWk.minutes}min {lang === 'tr' ? 'bu hafta' : 'this week'}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '40px' }}>
              {subTrend.map((w, i) => {
                const h = w.minutes !== null ? Math.max(4, Math.round(w.minutes / maxMin * 40)) : 4
                const isThisWk = i === subTrend.length - 1
                return (
                  <div key={w.weekStart} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '2px' }}>
                    <div style={{ width: '100%', height: `${h}px`, background: w.minutes === null ? '#1a1a1a' : isThisWk ? '#5bc25b' : '#0064ff66', borderRadius: '2px' }} />
                    {w.sessionsIncluded > 0 && <div style={{ fontSize: '7px', color: '#333', fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1 }}>{w.sessionsIncluded}</div>}
                  </div>
                )
              })}
            </div>
            <div style={{ ...S.mono, fontSize: '8px', color: '#333', marginTop: '5px' }}>
              8W · Z1+Z2 (Seiler 2010) · {subZones.thresholdHR ? `THR ${subZones.thresholdHR}bpm` : `FTP ${subZones.thresholdPower}W`}
            </div>
          </div>
        )
      })()}

      {dl['zoneDistributor'] !== false && <ZoneDistributorCard filteredLog={filteredLog} rangeLabel={rangeLabel}/>}

      <PersonalRecordsCard dl={dl}/>

      {dl['triDashboard'] !== false && hasTriData && <ErrorBoundary><Suspense fallback={null}><TriDashboard log={log} lang={lang}/></Suspense></ErrorBoundary>}
      <LoadTrendChart log={log} acwr={acwr} ctlChartDays={ctlChartDays} raceResults={raceResults} plan={plan} dl={dl} lc={lc}/>

      {dl['banisterModel'] !== false && <ErrorBoundary><Suspense fallback={null}><BanisterModelCard/></Suspense></ErrorBoundary>}
      {dl['durability'] !== false && <ErrorBoundary><Suspense fallback={null}><DurabilityCard log={log} lang={lang}/></Suspense></ErrorBoundary>}
      <ErrorBoundary><Suspense fallback={null}><BodyCompositionCard dl={dl}/></Suspense></ErrorBoundary>
      <ErrorBoundary><Suspense fallback={null}><RacePredictionsCard dl={dl}/></Suspense></ErrorBoundary>

      {dl.achievements !== false && (() => {
        const ra = getRecentAchievement(7)
        return ra ? <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginBottom: '12px' }}>◈ {ra.name} — {ra.desc}</div> : null
      })()}

      {dl['normative'] !== false && <ErrorBoundary><Suspense fallback={null}><NormativeSection/></Suspense></ErrorBoundary>}
      <ErrorBoundary><Suspense fallback={null}><MacroPlanCountdown dl={dl} lc={lc}/></Suspense></ErrorBoundary>

      {dl['weeklyReport'] !== false && (
      <WeeklyReportCard
        last7={filteredLog} totalMin={totalMin} totalTSS={totalTSS} avgRPE={avgRPE}
        recovery={recovery} plan={plan} planStatus={planStatus} rangeLabel={rangeLabel}
      />
      )}
      <ACWRCard log={log} lc={lc} dl={dl}/>
      {dl['coachingSummaryScore'] !== false && <ErrorBoundary><Suspense fallback={null}><CoachingSummaryScoreCard log={log} /></Suspense></ErrorBoundary>}
      {dl['coachingInsightsDigest'] !== false && <ErrorBoundary><Suspense fallback={null}><CoachingInsightsDigest log={log} /></Suspense></ErrorBoundary>}
      {dl['staleZones'] !== false && <ErrorBoundary><Suspense fallback={null}><StaleZonesCard log={log} /></Suspense></ErrorBoundary>}
      {dl['workoutDensity'] !== false && <ErrorBoundary><Suspense fallback={null}><WorkoutDensityCard log={log} /></Suspense></ErrorBoundary>}
      {dl['sessionVariety'] !== false && <ErrorBoundary><Suspense fallback={null}><SessionVarietyCard log={log} /></Suspense></ErrorBoundary>}
      {dl['fitnessGainRate'] !== false && <ErrorBoundary><Suspense fallback={null}><FitnessGainRateCard log={log} /></Suspense></ErrorBoundary>}
      {dl['easyDayCompliance'] !== false && <ErrorBoundary><Suspense fallback={null}><EasyDayComplianceCard log={log} /></Suspense></ErrorBoundary>}
      {dl['trainingDistribution'] !== false && <ErrorBoundary><Suspense fallback={null}><TrainingDistributionCard log={log} /></Suspense></ErrorBoundary>}
      {dl['detrainingDetector'] !== false && <ErrorBoundary><Suspense fallback={null}><DetrainingDetectorCard log={log} /></Suspense></ErrorBoundary>}
      {dl['monotonyStrain'] !== false && <ErrorBoundary><Suspense fallback={null}><MonotonyStrainCard log={log} /></Suspense></ErrorBoundary>}
      {dl['vo2Gap'] !== false && <ErrorBoundary><Suspense fallback={null}><VO2GapCard log={log} /></Suspense></ErrorBoundary>}
      {dl['streak'] !== false && <ErrorBoundary><Suspense fallback={null}><StreakCard log={log} /></Suspense></ErrorBoundary>}
      {dl['sessionRpeDrift'] !== false && <ErrorBoundary><Suspense fallback={null}><SessionRPEDriftCard log={log} /></Suspense></ErrorBoundary>}
      {dl['recoveryDebt'] !== false && <ErrorBoundary><Suspense fallback={null}><RecoveryDebtCard log={log} /></Suspense></ErrorBoundary>}
      {dl['timeInZone'] !== false && <ErrorBoundary><Suspense fallback={null}><TimeInZoneCard log={log} /></Suspense></ErrorBoundary>}
      {dl['supercompensationWindow'] !== false && <ErrorBoundary><Suspense fallback={null}><SupercompensationWindowCard log={log} /></Suspense></ErrorBoundary>}
      {dl['trainingPolarization'] !== false && <ErrorBoundary><Suspense fallback={null}><TrainingPolarizationCard log={log} /></Suspense></ErrorBoundary>}
      {dl['fitnessConsistency'] !== false && <ErrorBoundary><Suspense fallback={null}><FitnessConsistencyCard log={log} /></Suspense></ErrorBoundary>}
      {dl['recoveryAdherence'] !== false && <ErrorBoundary><Suspense fallback={null}><RecoveryAdherenceCard log={log} /></Suspense></ErrorBoundary>}
      {dl['trainingDiversity'] !== false && <ErrorBoundary><Suspense fallback={null}><TrainingDiversityCard log={log} /></Suspense></ErrorBoundary>}
      {dl['deloadCadence'] !== false && <ErrorBoundary><Suspense fallback={null}><DeloadCadenceCard log={log} /></Suspense></ErrorBoundary>}
      <VO2maxCard log={log} profile={profile} dl={dl}/>
      <PeakWeekCard log={log} dl={dl}/>
      <TrainingAgeCard log={log} dl={dl}/>
      <GoalTrackerCard log={log} profile={profile} dl={dl}/>
      {dl['seasonStats'] !== false && <ErrorBoundary><Suspense fallback={null}><SeasonStatsCard log={log} /></Suspense></ErrorBoundary>}
      {dl['cpDecay'] !== false && <ErrorBoundary><Suspense fallback={null}><CPDecayCard testResults={testResults || []} /></Suspense></ErrorBoundary>}
      {dl['rowingMetrics'] !== false && hasRowingData && <ErrorBoundary><Suspense fallback={null}><RowingMetricsCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['rowingSplitConsistency'] !== false && hasRowingData && <ErrorBoundary><Suspense fallback={null}><RowingSplitConsistencyCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['challenge'] !== false && <ErrorBoundary><Suspense fallback={null}><ChallengeWidget log={log} /></Suspense></ErrorBoundary>}
      {dl['nmFreshness'] !== false && <ErrorBoundary><Suspense fallback={null}><NMFreshnessCard log={log} /></Suspense></ErrorBoundary>}
      {dl['polarizationCompliance'] !== false && <ErrorBoundary><Suspense fallback={null}><PolarizationComplianceCard log={log} /></Suspense></ErrorBoundary>}
      {dl['aerobicEfficiency'] !== false && <ErrorBoundary><Suspense fallback={null}><AerobicEfficiencyCard log={log} /></Suspense></ErrorBoundary>}
      {dl['restqTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><RESTQTrendCard /></Suspense></ErrorBoundary>}
      {dl['injuryForecast'] !== false && <ErrorBoundary><Suspense fallback={null}><InjuryForecastCard log={log} recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['strainHistory'] !== false && <ErrorBoundary><Suspense fallback={null}><StrainHistoryCard log={log} /></Suspense></ErrorBoundary>}
      {dl['consistencyTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><ConsistencyTrendCard log={log} /></Suspense></ErrorBoundary>}
      {dl['insightFeed'] !== false && <ErrorBoundary><Suspense fallback={null}><InsightFeedCard log={log} /></Suspense></ErrorBoundary>}
      {dl['recoveryProtocol'] !== false && <ErrorBoundary><Suspense fallback={null}><RecoveryProtocolCard log={log} recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['recoveryHub'] !== false && <ErrorBoundary><Suspense fallback={null}><RecoveryHub /></Suspense></ErrorBoundary>}
      {dl['ostrcMonitor'] !== false && <ErrorBoundary><Suspense fallback={null}><OSTRCMonitorCard /></Suspense></ErrorBoundary>}
      {dl['hrvSummary'] !== false && <ErrorBoundary><Suspense fallback={null}><HRVSummaryCard recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['vo2maxProgression'] !== false && <ErrorBoundary><Suspense fallback={null}><VO2maxProgressionCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['vo2maxPlateau'] !== false && <ErrorBoundary><Suspense fallback={null}><VO2maxPlateauCard testResults={testResults || []} /></Suspense></ErrorBoundary>}
      {dl['ruleAlerts'] !== false && <ErrorBoundary><Suspense fallback={null}><RuleAlertsCard log={log} recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['cyclePlanner'] !== false && <ErrorBoundary><Suspense fallback={null}><CyclePlannerCard profile={profile} /></Suspense></ErrorBoundary>}
      {dl['planAdherence'] !== false && <ErrorBoundary><Suspense fallback={null}><PlanAdherenceCard plan={plan} planStatus={planStatus} log={log} /></Suspense></ErrorBoundary>}
      {dl['planScore'] !== false && <ErrorBoundary><Suspense fallback={null}><PlanScoreCard plan={plan} log={log} /></Suspense></ErrorBoundary>}
      {dl['athleteStatusSummary'] !== false && <ErrorBoundary><Suspense fallback={null}><AthleteStatusSummaryCard log={log} recovery={recovery} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['sleepRestingHr'] !== false && <ErrorBoundary><Suspense fallback={null}><SleepRestingHRCard recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['sleepCtlCorrelation'] !== false && <ErrorBoundary><Suspense fallback={null}><SleepCtlCorrelationCard log={log} recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['sleepDebt'] !== false && <ErrorBoundary><Suspense fallback={null}><SleepDebtCard recovery={recovery} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['recoveryStreak'] !== false && <ErrorBoundary><Suspense fallback={null}><RecoveryStreakCard recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['restingHrDrift'] !== false && <ErrorBoundary><Suspense fallback={null}><RestingHrDriftCard recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['sessionClassifierBreakdown'] !== false && <ErrorBoundary><Suspense fallback={null}><SessionClassifierBreakdownCard log={log} /></Suspense></ErrorBoundary>}
      {dl['workoutDeviation'] !== false && <ErrorBoundary><Suspense fallback={null}><WorkoutDeviationCard log={log} plan={plan} /></Suspense></ErrorBoundary>}
      {dl['monotonyTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><MonotonyTrendCard log={log} /></Suspense></ErrorBoundary>}
      {dl['aerobicDecouplingTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><AerobicDecouplingTrendCard log={log} /></Suspense></ErrorBoundary>}
      {dl['efDecoupling'] !== false && <ErrorBoundary><Suspense fallback={null}><EFDecouplingCard log={log} lang={lang} /></Suspense></ErrorBoundary>}
      {dl['overreachWatch'] !== false && <ErrorBoundary><Suspense fallback={null}><OverreachWatchCard log={log} lang={lang} /></Suspense></ErrorBoundary>}
      {dl['ctlRampRate'] !== false && <ErrorBoundary><Suspense fallback={null}><CtlRampRateCard log={log} /></Suspense></ErrorBoundary>}
      {dl['weeklyVolumeRamp'] !== false && <ErrorBoundary><Suspense fallback={null}><WeeklyVolumeRampCard log={log} /></Suspense></ErrorBoundary>}
      {dl['weekendVolumeShare'] !== false && <ErrorBoundary><Suspense fallback={null}><WeekendVolumeShareCard log={log} /></Suspense></ErrorBoundary>}
      {dl['timeOfDayConsistency'] !== false && <ErrorBoundary><Suspense fallback={null}><TimeOfDayConsistencyCard log={log} /></Suspense></ErrorBoundary>}
      {dl['longSessionShare'] !== false && <ErrorBoundary><Suspense fallback={null}><LongSessionShareCard log={log} /></Suspense></ErrorBoundary>}
      {dl['runningCadenceTrend'] !== false && <ErrorBoundary><Suspense fallback={null}><RunningCadenceTrendCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['tsbFreshnessBand'] !== false && <ErrorBoundary><Suspense fallback={null}><TsbFreshnessBandCard log={log} /></Suspense></ErrorBoundary>}
      {dl['prTimeline'] !== false && <ErrorBoundary><Suspense fallback={null}><PRTimelineCard log={log} /></Suspense></ErrorBoundary>}
      {dl['loadProjector'] !== false && <ErrorBoundary><Suspense fallback={null}><LoadProjectorCard log={log} /></Suspense></ErrorBoundary>}
      {dl['injuryPattern'] !== false && <ErrorBoundary><Suspense fallback={null}><InjuryPatternCard log={log} injuries={injuries || []} recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['vdotBenchmark'] !== false && <ErrorBoundary><Suspense fallback={null}><VDOTBenchmarkCard log={log} testResults={testResults || []} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['hrvAlert'] !== false && <ErrorBoundary><Suspense fallback={null}><HRVAlertCard recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['hrvAutonomicBalance'] !== false && <ErrorBoundary><Suspense fallback={null}><HrvAutonomicBalanceCard recovery={recovery} /></Suspense></ErrorBoundary>}
      {dl['taperAdvisor'] !== false && <ErrorBoundary><Suspense fallback={null}><TaperAdvisorCard plan={plan} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['taperCompliance'] !== false && <ErrorBoundary><Suspense fallback={null}><TaperComplianceCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['priorityAction'] !== false && <ErrorBoundary><Suspense fallback={null}><PriorityActionCard log={log} recovery={recovery} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['cyclingZones'] !== false && hasCyclingData && <ErrorBoundary><Suspense fallback={null}><CyclingZonesCard testResults={testResults || []} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['cyclingNpTrend'] !== false && hasCyclingData && <ErrorBoundary><Suspense fallback={null}><CyclingNpTrendCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['swimmingZones'] !== false && hasSwimData    && <ErrorBoundary><Suspense fallback={null}><SwimmingZonesCard log={log} /></Suspense></ErrorBoundary>}
      {dl['swimSwolfTrend'] !== false && hasSwimData    && <ErrorBoundary><Suspense fallback={null}><SwimSwolfTrendCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['runningCv'] !== false && <ErrorBoundary><Suspense fallback={null}><RunningCVCard log={log} /></Suspense></ErrorBoundary>}
      {dl['runningRaceReadiness'] !== false && <ErrorBoundary><Suspense fallback={null}><RunningRaceReadinessCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['fitnessBatteryProgress'] !== false && <ErrorBoundary><Suspense fallback={null}><FitnessBatteryProgressCard /></Suspense></ErrorBoundary>}
      {dl['triathlonLoad'] !== false && hasTriData     && <ErrorBoundary><Suspense fallback={null}><TriathlonLoadCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      {dl['triathlonWeekBalance'] !== false && hasTriData     && <ErrorBoundary><Suspense fallback={null}><TriathlonWeekBalanceCard log={log} profile={profile} /></Suspense></ErrorBoundary>}
      <LoadHeatmapCard log={log} dl={dl} lang={lang}/>
      <SeasonBestsCard log={log} dl={dl}/>

      {dl['shareCard'] !== false && <ShareCard log={log} profile={profile} filteredLog={filteredLog}/>}

      {dl['quickLinks'] !== false && (
      <div className="sp-card" style={{ ...S.card, animationDelay: '200ms' }}>
        <div style={S.cardTitle}>{t('quickLinks')}</div>
        <div style={S.row}>
          {[['sporeus.com', 'https://sporeus.com'], ['Hesaplayıcılar', 'https://sporeus.com/hesaplayicilar/']].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              style={{ ...S.mono, fontSize: '12px', color: '#0064ff', textDecoration: 'none', padding: '4px 0' }}>
              → {label}
            </a>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

export default memo(Dashboard)
