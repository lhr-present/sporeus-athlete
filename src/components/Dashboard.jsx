// ─── Dashboard.jsx — orchestrator, composes all dashboard cards ───────────────
import { useContext, useState, useMemo, lazy, Suspense } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { TSSChart, WeeklyVolChart, ZoneDonut, HelpTip } from './ui.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
const HRVChart = lazy(() => import('./charts/HRVChart.jsx'))
import { monotonyStrain, calcLoad } from '../lib/formulas.js'
import { calculateACWR, calculateConsistency } from '../lib/trainingLoad.js'
import ShareCard from './ShareCard.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { getRecentAchievement } from './Achievements.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { SPORT_BRANCHES, ATHLETE_LEVELS, LEVEL_CONFIG, DASH_CARD_DEFS } from '../lib/constants.js'
import { assessDataQuality, predictFitness } from '../lib/intelligence.js'
import { interpretCTL, interpretTSB, interpretMonotony } from '../lib/science/interpretations.js'
import { subThresholdTrend, } from '../lib/science/subThresholdTime.js'
import { computeMonotony } from '../lib/trainingLoad.js'
import { useData } from '../contexts/DataContext.jsx'

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
import TriDashboard         from './dashboard/TriDashboard.jsx'
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
import ReadinessCard       from './dashboard/ReadinessCard.jsx'
import RecentSessionsCard  from './dashboard/RecentSessionsCard.jsx'
import ZoneDistributorCard from './dashboard/ZoneDistributorCard.jsx'
import PersonalRecordsCard from './dashboard/PersonalRecordsCard.jsx'
import BodyCompositionCard from './dashboard/BodyCompositionCard.jsx'
import RacePredictionsCard from './dashboard/RacePredictionsCard.jsx'
import BanisterModelCard   from './dashboard/BanisterModelCard.jsx'
import DurabilityCard      from './dashboard/DurabilityCard.jsx'
import MacroPlanCountdown  from './dashboard/MacroPlanCountdown.jsx'
import NormativeSection    from './dashboard/NormativeSection.jsx'
import AICoachInsights    from './dashboard/AICoachInsights.jsx'
import WeeklyRetroCard    from './dashboard/WeeklyRetroCard.jsx'
import PhaseAnalyticsCard from './dashboard/PhaseAnalyticsCard.jsx'
import FuelGuidanceCard   from './dashboard/FuelGuidanceCard.jsx'
const SeasonStatsCard    = lazy(() => import('./dashboard/SeasonStatsCard.jsx'))
const CPDecayCard        = lazy(() => import('./dashboard/CPDecayCard.jsx'))
const RowingMetricsCard  = lazy(() => import('./dashboard/RowingMetricsCard.jsx'))
const ChallengeWidget    = lazy(() => import('./dashboard/ChallengeWidget.jsx'))
const NMFreshnessCard            = lazy(() => import('./dashboard/NMFreshnessCard.jsx'))
const PolarizationComplianceCard = lazy(() => import('./dashboard/PolarizationComplianceCard.jsx'))
const AerobicEfficiencyCard      = lazy(() => import('./dashboard/AerobicEfficiencyCard.jsx'))
const RESTQTrendCard             = lazy(() => import('./dashboard/RESTQTrendCard.jsx'))
const InjuryForecastCard         = lazy(() => import('./dashboard/InjuryForecastCard.jsx'))

export default function Dashboard({ log }) {
  const [lang]       = useLocalStorage('sporeus-lang', 'en')
  const [plan]       = useLocalStorage('sporeus-plan', null)
  const [planStatus] = useLocalStorage('sporeus-plan-status', {})
  const { recovery, injuries, testResults, raceResults, profile } = useData()
  const [myCoach]    = useLocalStorage('sporeus-my-coach', null)
  const { t }        = useContext(LangCtx)

  const sportLabel = SPORT_BRANCHES.find(b => b.id === profile.primarySport)?.label || profile.sport || ''
  const levelLabel = ATHLETE_LEVELS.find(l => l.id === profile.athleteLevel)?.label || ''
  const lc         = LEVEL_CONFIG[profile.athleteLevel] || LEVEL_CONFIG.competitive

  const [showAdvanced, setShowAdvanced] = useState(false)
  const defaultLayout = Object.fromEntries(DASH_CARD_DEFS.map(c => [c.id, true]))
  const [dashLayout, setDashLayout] = useLocalStorage('sporeus-dash-layout', defaultLayout)
  const [showCustomize, setShowCustomize] = useState(false)
  const dl       = { ...defaultLayout, ...dashLayout }
  const toggleCard = id => setDashLayout(prev => ({ ...defaultLayout, ...prev, [id]: !prev[id] }))

  // ── Date range filter ─────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useLocalStorage('sporeus-dash-range', '28')
  const rangeStart = useMemo(() => {
    if (dateRange === 'season') return '2000-01-01'
    const d = new Date(); d.setDate(d.getDate() - parseInt(dateRange, 10))
    return d.toISOString().slice(0, 10)
  }, [dateRange])
  const filteredLog   = useMemo(() => log.filter(e => e.date >= rangeStart), [log, rangeStart])
  const ctlChartDays  = dateRange === '7' ? 30 : dateRange === '28' ? 90 : dateRange === '90' ? 180 : 730
  const rangeLabel    = dateRange === 'season' ? 'SEASON' : `LAST ${dateRange}D`

  // ── Derived metrics ────────────────────────────────────────────────────────────
  const totalTSS   = filteredLog.reduce((s, e) => s + (e.tss || 0), 0)
  const totalMin   = filteredLog.reduce((s, e) => s + (e.duration || 0), 0)
  const avgRPE     = filteredLog.length ? (filteredLog.reduce((s, e) => s + (e.rpe || 0), 0) / filteredLog.length).toFixed(1) : '\u2014'
  const srpeLoad   = filteredLog.reduce((s, e) => s + ((e.rpe || 0) * (e.duration || 0)), 0)
  const { atl, ctl, tsb, daily } = useMemo(() => calcLoad(log), [log])
  const acwr        = useMemo(() => calculateACWR(log), [log])
  const consistency = useMemo(() => calculateConsistency(log), [log])

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
      ? "Take it easy today — rest is part of training!"
      : "Keep showing up — consistency beats intensity every time."
    if (!isBusy) return null
    if (lvl === 'recreational') return "Consider an easy session today — your body needs recovery."
    if (lvl === 'competitive')  return `Readiness low — consider swapping tomorrow's tempo for an easy run.`
    return `TSB ${tsb >= 0 ? '+' : ''}${tsb} · High load detected — deload recommended. Swap threshold → Z2 45min.`
  })()

  const dqResult = assessDataQuality(log, recovery, testResults, profile)
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
  const profileMetrics = [
    profile?.ftp      && { label: 'FTP',    val: `${profile.ftp}W`,           color: '#ff6600' },
    profile?.maxhr    && { label: 'MAX HR', val: `${profile.maxhr}bpm`,        color: '#e03030' },
    profile?.vo2max   && { label: 'VO₂max', val: `${profile.vo2max}`,          color: '#5bc25b' },
    profile?.weight   && { label: 'WEIGHT', val: `${profile.weight}kg`,         color: '#888'    },
    profile?.threshold && { label: 'LT2',   val: `${profile.threshold}W`,      color: '#0064ff' },
  ].filter(Boolean)

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
  const _countTSS = useCountUp(totalTSS)
  if (lc.dashSimple && !showAdvanced) {
    return (
      <div className="sp-fade">
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...S.mono, fontSize: '11px', color: '#888', marginBottom: '4px' }}>{today}</div>
          <div style={{ ...S.mono, fontSize: '18px', fontWeight: 600 }}>
            {profile.name ? `ATHLETE: ${profile.name.toUpperCase()}` : t('appTitle')}
          </div>
          {headerBadges}
          {metricsRow}
        </div>
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
          <button style={{ ...S.btnSec, fontSize: '11px' }} onClick={() => setShowAdvanced(true)}>SHOW ADVANCED ANALYTICS ↓</button>
        </div>
      </div>
    )
  }

  // ── Advanced dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="sp-fade">
      <MilestonesList log={log} profile={profile}/>
      <BackupReminder log={log}/>
      <WeeklyRetroCard log={log} recovery={recovery} plan={plan} lang={lang}/>
      <PhaseAnalyticsCard log={log} plan={plan} lang={lang}/>

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
          <button style={{ ...S.btnSec, fontSize: '10px', marginTop: '8px', padding: '3px 8px' }} onClick={() => setShowAdvanced(false)}>← SIMPLE VIEW</button>
        )}
        <button style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', marginTop: '8px', marginLeft: '8px' }} onClick={() => setShowCustomize(s => !s)}>
          ⚙ Customize Dashboard
        </button>
        {showCustomize && (
          <div style={{ marginTop: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.06em' }}>SHOW / HIDE CARDS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {DASH_CARD_DEFS.map(card => (
                <label key={card.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', ...S.mono, fontSize: '11px', color: dl[card.id] ? 'var(--text)' : 'var(--muted)' }}>
                  <input type="checkbox" checked={!!dl[card.id]} onChange={() => toggleCard(card.id)} style={{ accentColor: '#ff6600' }}/>
                  {card.label}
                </label>
              ))}
            </div>
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

      {/* L3 — Fitness projection 4w/8w */}
      {lc.showCTL && fitProj && (() => {
        const TRAJ = { improving: { c: '#5bc25b', a: '↑' }, declining: { c: '#e03030', a: '↓' }, stable: { c: '#f5c542', a: '→' }, flat: { c: '#555', a: '—' } }
        const { c, a } = TRAJ[fitProj.trajectory] || TRAJ.flat
        return (
          <div style={{ ...S.mono, fontSize: '10px', padding: '8px 12px', marginBottom: '10px', borderLeft: `2px solid ${c}44`, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px', color: c, fontWeight: 700 }}>{a}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: '#555' }}>CTL</span>
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

      <ErrorBoundary inline name="Race Readiness">
        <RaceReadinessCard log={log} recovery={recovery} injuries={injuries} profile={profile} plan={plan} planStatus={planStatus} lang={lang}/>
      </ErrorBoundary>
      <ProactiveInjuryAlert log={log} injuries={injuries} lang={lang}/>
      <LoadSpikeAlert/>

      {recovery.some(e => parseFloat(e.hrv) > 0) && (
        <div className="sp-card" style={{ ...S.card, animationDelay: '20ms' }}>
          <div style={S.cardTitle}>HRV TREND</div>
          <Suspense fallback={null}><HRVChart recovery={recovery} days={30}/></Suspense>
        </div>
      )}

      <AICoachInsights dl={dl}/>
      <InsightsPanel log={log} recovery={recovery} profile={profile} lang={lang}/>
      <ErrorBoundary inline name="EF Trend">
        <Suspense fallback={null}>
          <EFTrendCard sessions={efSessions} />
        </Suspense>
      </ErrorBoundary>
      <YourPatternsCard log={log} recovery={recovery} injuries={injuries} profile={profile} lang={lang}/>
      <WeekStoryCard log={log} recovery={recovery} profile={profile} lang={lang}/>
      <FuelGuidanceCard log={log} plan={plan} profile={profile} lang={lang}/>
      <DidYouKnowCard log={log} recovery={recovery} profile={profile} lang={lang}/>

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
              <div style={{ ...S.mono, fontSize: '13px', color: '#555', marginBottom: '6px' }}>No sessions yet</div>
              <div style={{ ...S.mono, fontSize: '11px', color: '#888', lineHeight: 1.7 }}>
                Log your first session to see your fitness trend here.<br/>Tap the <span style={{ color: '#ff6600' }}>Log</span> tab →
              </div>
            </div>
          ) : (
            <TSSChart daily={daily} t={t}/>
          )}
        </div>
      )}

      <RecentSessionsCard filteredLog={filteredLog} rangeLabel={rangeLabel} dl={dl}/>

      {/* M4 — Recent session notes */}
      {(() => {
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
      {cadenceEntries.length >= 5 && (() => {
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
            <svg width={W} height={H} style={{ display:'block', overflow:'visible' }}>
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
          <WeeklyVolChart log={log}/>
        </div>
      )}

      {/* Zone distribution (donut + monotony) */}
      {dl.zones && lc.showZoneDonut && log.length > 0 && (() => {
        const { mono, strain } = monotonyStrain(log)
        const monoRed   = mono > 2.0
        const strainRed = strain > 6000
        return (
          <div className="sp-card" style={{ ...S.row, marginBottom: '16px', animationDelay: '180ms' }}>
            <div style={{ ...S.card, flex: '1 1 200px', marginBottom: 0 }}>
              <div style={S.cardTitle}>ZONE DISTRIBUTION</div>
              <ZoneDonut log={log}/>
            </div>
            {lc.showMonotony && (
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ ...S.card, marginBottom: 0, borderLeft: `3px solid ${monoRed ? '#e03030' : '#5bc25b'}` }}>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#888' }}>MONOTONY INDEX</div>
                  <div style={{ ...S.mono, fontSize: '22px', fontWeight: 600, color: monoRed ? '#e03030' : '#1a1a1a' }}>{mono}</div>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#aaa' }}>{monoRed ? '⚠ INJURY RISK' : 'Normal'} (alert &gt;2.0)</div>
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
      {subZones && subTrend.some(w => w.minutes !== null) && (() => {
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

      <ZoneDistributorCard filteredLog={filteredLog} rangeLabel={rangeLabel}/>

      <PersonalRecordsCard dl={dl}/>

      {(profile.sport || '').toLowerCase().includes('tri') && <TriDashboard log={log} lang={lang}/>}
      <LoadTrendChart log={log} acwr={acwr} ctlChartDays={ctlChartDays} raceResults={raceResults} plan={plan} dl={dl} lc={lc}/>

      <BanisterModelCard/>
      <DurabilityCard log={log} lang={lang}/>
      <BodyCompositionCard dl={dl}/>
      <RacePredictionsCard dl={dl}/>

      {dl.achievements !== false && (() => {
        const ra = getRecentAchievement(7)
        return ra ? <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginBottom: '12px' }}>◈ {ra.name} — {ra.desc}</div> : null
      })()}

      <NormativeSection/>
      <MacroPlanCountdown dl={dl} lc={lc}/>

      <WeeklyReportCard
        last7={filteredLog} totalMin={totalMin} totalTSS={totalTSS} avgRPE={avgRPE}
        recovery={recovery} plan={plan} planStatus={planStatus} rangeLabel={rangeLabel}
      />
      <ACWRCard log={log} lc={lc} dl={dl}/>
      <VO2maxCard log={log} profile={profile} dl={dl}/>
      <PeakWeekCard log={log} dl={dl}/>
      <TrainingAgeCard log={log} dl={dl}/>
      <GoalTrackerCard log={log} profile={profile} dl={dl}/>
      <Suspense fallback={null}><SeasonStatsCard log={log} /></Suspense>
      <Suspense fallback={null}><CPDecayCard testResults={testResults || []} /></Suspense>
      <Suspense fallback={null}><RowingMetricsCard log={log} /></Suspense>
      <Suspense fallback={null}><ChallengeWidget log={log} /></Suspense>
      <Suspense fallback={null}><NMFreshnessCard log={log} /></Suspense>
      <Suspense fallback={null}><PolarizationComplianceCard log={log} /></Suspense>
      <Suspense fallback={null}><AerobicEfficiencyCard log={log} /></Suspense>
      <Suspense fallback={null}><RESTQTrendCard /></Suspense>
      <Suspense fallback={null}><InjuryForecastCard log={log} recovery={recovery} /></Suspense>
      <LoadHeatmapCard log={log} dl={dl}/>
      <SeasonBestsCard log={log} dl={dl}/>

      <ShareCard log={log} profile={profile} filteredLog={filteredLog}/>

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
    </div>
  )
}
