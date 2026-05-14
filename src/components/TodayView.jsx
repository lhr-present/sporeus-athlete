// ─── TodayView.jsx — v5.14.0: Single-screen daily HQ ─────────────────────────
import { useState, useMemo, useContext, useRef, useEffect, lazy, Suspense } from 'react'
import ErrorBoundary from './ErrorBoundary.jsx'

const NextTrainingCardLazy = lazy(() => import('./dashboard/NextTrainingCard.jsx'))
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { getTodayPlannedSession, getSingleSuggestion, generateDailyDigest, getTimeOfDayAdvice, predictFitness } from '../lib/intelligence.js'
import { buildGlanceLine } from '../lib/athlete/morningGlance.js'
import Citation from './ui/Citation.jsx'
import Banner from './ui/Banner.jsx'
import { calcLoad } from '../lib/formulas.js'
import { WELLNESS_FIELDS } from '../lib/constants.js'
import { hasUnread } from './CoachMessage.jsx'
import { getMyCoach } from '../lib/inviteUtils.js'
import { getUpcomingSessions, upsertAttendance } from '../lib/db/coachSessions.js'
import TeamAnnouncements from './TeamAnnouncements.jsx'
import QRScanner from './QRScanner.jsx'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { getRecommendedProtocols } from '../lib/recoveryProtocols.js'
import { computeNextAction } from '../lib/nextAction.js'
import { buildContingencyMap } from '../lib/athlete/eliteProgramSubstitutions.js'
import { deriveSessionStructure } from '../lib/athlete/sessionStructure.js'
import { computeSessionExecution, EXECUTION_STATUS_LABEL, EXECUTION_STATUS_COLOR, getExecutionImplication } from '../lib/athlete/sessionExecution.js'
import { deriveSessionTargets } from '../lib/athlete/derivedSessionTargets.js'
import { buildDailyRecommendation } from '../lib/athlete/dailyRecommendation.js'
import { computePlanDrift, detectStalePlan } from '../lib/athlete/planAdaptation.js'
import { detectGoalActivityMismatch } from '../lib/athlete/goalActivityMismatch.js'
import { computeTrainingStreak, getStreakMilestone } from '../lib/athlete/trainingStreak.js'
import { detectComebackGap } from '../lib/athlete/comebackDetector.js'
import { detectRaceRetrospective, retroLocalStorageKey } from '../lib/athlete/raceRetrospective.js'
import { explainPlannedSession } from '../lib/athlete/planRationale.js'
import { analyzeWellnessTrend } from '../lib/athlete/wellnessTrend.js'
import { analyzeDecouplingTrend } from '../lib/athlete/decouplingTrend.js'
import { analyzePolarizedWeek } from '../lib/athlete/polarizedWeek.js'
import { isBannerSnoozed, snoozeBanner } from '../lib/athlete/bannerSnooze.js'
import { classifyStravaSync } from '../lib/athlete/stravaSyncHealth.js'
import { getStravaConnection } from '../lib/strava.js'
import { analyzeWeeklyBudget } from '../lib/athlete/weeklyBudget.js'
import { rankDiagnostics } from '../lib/athlete/diagnosticPriority.js'
import { buildStarterPlan } from '../lib/plan/starterPlan.js'
import { recordPlanVersion } from '../lib/plan/versionTracking.js'
import { emitEvent } from '../lib/attribution.js'

const WellnessSparkline = lazy(() => import('./charts/WellnessSparkline.jsx'))

// v9.60.0 — Rule IDs that warrant downgrading a hard planned session to easy.
// Kept module-scope so its identity stays stable across renders (so useMemo
// below has the correct dependency contract).
const SWAP_TRIGGER_RULES = [
  'hrv_drift',         // Plews 2013 — autonomic strain
  'tsb_deep',          // Banister 1991 — deep fatigue
  'injury_risk_high',  // Hulin 2016 — composite risk model
  'injury_window',     // Foster 1998 — predictive 14d risk window
  'acwr_spike',        // Gabbett 2016 — ACWR > 1.5
  'acwr_high',         // Gabbett 2016 — ACWR 1.3–1.5
  'wellness_poor',     // Meeusen 2013 — subjective ≤ 2/5
]
import { isRESTQDue } from '../lib/sport/restq.js'
import { flushQueue } from '../lib/offlineQueue.js'
import { calculateACWR, calculateConsistency, generateWeeklyRecap } from '../lib/trainingLoad.js'
import { BANISTER } from '../lib/sport/constants.js'
import { S } from '../styles.js'
import { getOrientationStep, ORIENTATION_MESSAGES } from '../lib/orientation.js'
import NextActionCard from './NextActionCard.jsx'
const MorningCheckIn = lazy(() => import('./MorningCheckIn.jsx'))
import { computeHRVTrend, isHRVSuppressed } from '../lib/hrv.js'
import { findSeasonalPatterns } from '../lib/patterns.js'
import { computeMonotony } from '../lib/trainingLoad.js'
import { getTrainingPaces } from '../lib/vdot.js'
import { getLoadTrendAlert, getMissedRestWarning, getMonotonyWarning } from '../lib/ruleInsights.js'
import { interpretACWR, interpretCTL, interpretTSB } from '../lib/science/interpretations.js'

const EMBED_MODE = new URLSearchParams(window.location.search).get('embed') === 'true'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const BLUE   = '#0064ff'

function calcConsecutiveDays(log, today) {
  const dates = new Set((log || []).map(e => e.date))
  const start = new Date(today)
  if (!dates.has(today)) start.setUTCDate(start.getUTCDate() - 1)
  let consecutiveDays = 0
  while (true) {
    const d = start.toISOString().slice(0, 10)
    if (dates.has(d)) { consecutiveDays++; start.setUTCDate(start.getUTCDate() - 1) }
    else break
  }
  return consecutiveDays
}

const QUICK_FIELDS = WELLNESS_FIELDS.filter(f => ['sleep', 'energy', 'soreness'].includes(f.key))

export default function TodayView({ log, setTab, setLogPrefill, authUser }) {
  const { t, lang }   = useContext(LangCtx)
  const { recovery, setRecovery, profile, setLog } = useData()

  const [plan]       = useLocalStorage('sporeus-plan',        null)
  const [planStatus, setPlanStatus] = useLocalStorage('sporeus-plan-status', {})

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })()

  const plannedSession = useMemo(() => getTodayPlannedSession(plan, today), [plan, today])
  const todayKey       = plannedSession ? `${plannedSession.weekIdx}-${plannedSession.dayIdx}` : null
  const todayStatus    = todayKey ? planStatus[todayKey] : null

  // v9.85.0 — Tomorrow preview. Read tomorrow's planned session so the
  // athlete can gear up (e.g. set alarm earlier for long ride, prepare
  // intervals workout track). Uses the same helper as today; null if rest
  // or no plan.
  const tomorrowSession = useMemo(() => {
    const t = new Date(today); t.setUTCDate(t.getUTCDate() + 1)
    return getTodayPlannedSession(plan, t.toISOString().slice(0, 10))
  }, [plan, today])

  // v9.85.0 — Hard session detector (reused for race-week alignment flag).
  // Mirrors the heuristic from sessionSwapFlag so both flags agree on
  // what counts as a high-stress session.
  const isHardToday = useMemo(() => {
    if (!plannedSession) return false
    const typeStr = String(plannedSession.type || '').toLowerCase()
    return (plannedSession.rpe ?? 0) >= 7
      || /vo2|interval|threshold|race.?pace|tempo|hard/i.test(typeStr)
  }, [plannedSession])

  const suggestion = useMemo(() => getSingleSuggestion(log, recovery, profile), [log, recovery, profile])
  const digest     = useMemo(() => generateDailyDigest(log, recovery, profile), [log, recovery, profile])

  // v9.56.0 → v9.60.0 — Session-swap banner. When today's planned session is
  // hard AND nextAction signals ANY hard-rest condition, surface a "downgrade
  // to easy" banner on the planned card. Pre-v9.60.0 this only fired for 3 of
  // 11+ rules — wellness_poor, injury_window, acwr_spike, acwr_high all
  // bypassed it, so safety-critical fatigue rules failed to suggest swap.
  const nextAction = useMemo(() => computeNextAction(log, recovery, profile), [log, recovery, profile])
  const sessionSwapFlag = useMemo(() => {
    if (!plannedSession) return null
    if (!nextAction || !SWAP_TRIGGER_RULES.includes(nextAction.id)) return null
    const t = String(plannedSession.type || '').toLowerCase()
    const isHard = (plannedSession.rpe ?? 0) >= 7
      || /vo2|interval|threshold|race.?pace|tempo|hard/i.test(t)
    if (!isHard) return null
    return nextAction
  }, [plannedSession, nextAction])

  // v9.102.0 (Prompt T) — Auto-downgrade gate. The banners above warn the
  // athlete that a hard day collides with low readiness / fatigue signals,
  // but until now they were still shown the hard session as the primary
  // render and had to manually decide to swap. This computes the swap
  // *target* (a buildDailyRecommendation easy session) so it can become the
  // default card, with the original hard session hidden behind a disclosure.
  // Discovery: the "warning above hard session" UX produced a measurable
  // gap between "saw warning" and "swapped session" in plan_status data.
  const [showOriginalSession, setShowOriginalSession] = useState(false)
  // v9.146.0 — Session-card sub-banner collapse. Gates phase+week,
  // deload tile, description, structure breakdown, and tomorrow
  // preview behind one toggle so the morning glance + execution data
  // stay above the fold. Default false → 5 fewer surfaces visible.
  // Spec: Prompt 2 from the v9.144 critique.
  const [showSessionDetails, setShowSessionDetails] = useState(false)

  const yesterdayLogged = (log || []).some(e => e.date === yesterday)

  // v9.89.0 — Find today's logged entry (most recent if multiple) for the
  // execution snapshot. Highest-TSS pick reduces noise when an athlete
  // logs two short walks plus the actual hard session.
  const todayLogEntry = useMemo(() => {
    const todayEntries = (log || []).filter(e => e.date === today)
    if (!todayEntries.length) return null
    return [...todayEntries].sort((a, b) => (Number(b.tss) || 0) - (Number(a.tss) || 0))[0]
  }, [log, today])
  const sessionExecution = useMemo(
    () => computeSessionExecution(plannedSession, todayLogEntry),
    [plannedSession, todayLogEntry]
  )
  const sessions7d      = useMemo(() => {
    const cutoff = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10) })()
    return (log || []).filter(e => e.date >= cutoff).length
  }, [log])
  const consecutiveDays = useMemo(() => calcConsecutiveDays(log, today), [log, today])

  // Consecutive days with wellness logged
  const wellDays = useMemo(() => {
    const recDates = new Set((recovery || []).map(e => e.date))
    const d = new Date(today)
    if (!recDates.has(today)) d.setUTCDate(d.getUTCDate() - 1)
    let s = 0
    while (recDates.has(d.toISOString().slice(0, 10))) { s++; d.setUTCDate(d.getUTCDate() - 1) }
    return s
  }, [recovery, today])

  // Week TSS (Mon–Sun current week)
  const weekTSS = useMemo(() => {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
    const ws = d.toISOString().slice(0, 10)
    return Math.round((log || []).filter(e => e.date >= ws).reduce((s, e) => s + (e.tss || 0), 0))
  }, [log, today])

  // ── Z-score personal baseline (28-day rolling) ──────────────────────────────
  const wellnessBaseline = useMemo(() => {
    const cutoff = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 29); return d.toISOString().slice(0, 10) })()
    const past = (recovery || []).filter(e => e.date >= cutoff && e.date < today && typeof e.score === 'number')
    if (past.length < 7) return null
    const n    = past.length
    const mean = past.reduce((s, e) => s + e.score, 0) / n
    const variance = past.reduce((s, e) => s + Math.pow(e.score - mean, 2), 0) / (n - 1)
    const sd   = Math.sqrt(variance)
    return { mean: Math.round(mean), sd: Math.round(sd * 10) / 10, n }
  }, [recovery, today])

  const acwrRatio    = useMemo(() => calculateACWR(log).ratio, [log])
  const consistency  = useMemo(() => calculateConsistency(log), [log])
  const { ctl: todayCtl } = useMemo(() => calcLoad(log || []), [log])
  const K_CTL = BANISTER.K_CTL

  const todayRec = (recovery || []).find(e => e.date === today)

  const hrvTrend   = useMemo(() => computeHRVTrend(recovery || []), [recovery])
  const seasonal   = useMemo(() => findSeasonalPatterns(log || [], recovery || []), [log, recovery])
  const thisMonth  = new Date().toLocaleString('en', { month: 'short' })
  const weekLoad   = useMemo(() => computeMonotony(log || []), [log])

  // V1 — load trend spike alert (getLoadTrendAlert: >10% week-on-week TSS increase)
  const loadAlert  = useMemo(() => getLoadTrendAlert(weekLoad.dailyTSS || []), [weekLoad])
  // V3 — missed rest warning (getMissedRestWarning: ≥6 consecutive training days)
  const missedRestWarn = useMemo(() => getMissedRestWarning(consecutiveDays), [consecutiveDays])
  // V4 — monotony coaching action (getMonotonyWarning: Foster 2001 monotony > 2.0)
  const monoWarn   = useMemo(() => getMonotonyWarning(weekLoad.dailyTSS || []), [weekLoad])

  // M1 — HRV suppression alert (isHRVSuppressed: CV ≥10% AND latest below mean)
  const hrvSuppressed = useMemo(() => (recovery || []).length >= 3 ? isHRVSuppressed(recovery || []) : false, [recovery])

  // M2 — Latest RESTQ result
  const restqLatest = (() => {
    try {
      const history = JSON.parse(localStorage.getItem('sporeus-restq-history') || '[]')
      return history.length > 0 ? history[history.length - 1] : null
    } catch { return null }
  })()

  // L1 — predictFitness forecast strip (gated: ≥14 sessions)
  const fitnessForecast = useMemo(() => (log || []).length >= 14 ? predictFitness(log || []) : null, [log])

  // E6 — Science insights (interpretACWR / interpretCTL / interpretTSB)
  const scienceInsights = useMemo(() => {
    const { ctl: curCTL, atl: _curATL, tsb: curTSB } = calcLoad(log || [])
    // prevCTL: CTL 4 weeks ago — filter log to only entries older than 28 days
    const cutoff28 = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 28); return d.toISOString().slice(0, 10) })()
    const { ctl: prevCTL } = calcLoad((log || []).filter(e => e.date <= cutoff28))
    const isRaceWeek = !!(profile?.raceDate && (() => {
      const days = Math.round((new Date(profile.raceDate) - new Date(today)) / 86400000)
      return days >= 0 && days <= 7
    })())
    const sport = profile?.sport || 'general'
    const acwrInsight = interpretACWR(acwrRatio != null && (log || []).length >= 7 ? acwrRatio : null)
    const ctlInsight  = curCTL > 0 ? interpretCTL(curCTL, prevCTL > 0 ? prevCTL : null, sport) : null
    const tsbInsight  = curCTL > 0 ? interpretTSB(curTSB, isRaceWeek) : null
    return [acwrInsight, ctlInsight, tsbInsight].filter(Boolean)
  }, [log, profile, acwrRatio, today])

  // N3 — Training paces from VDOT (Daniels)
  const paceRef = useMemo(() => {
    const v = parseFloat(profile?.vo2max)
    return v > 0 ? getTrainingPaces(v) : null
  }, [profile?.vo2max])

  // L2 — Race countdown from profile.raceDate
  const raceCountdown = useMemo(() => {
    const rd = profile?.raceDate
    if (!rd) return null
    const days = Math.round((new Date(rd) - new Date(today)) / 86400000)
    if (days < 0 || days > 120) return null
    const phase = days === 0 ? (lang === 'tr' ? 'YARIŞ GÜNÜ!' : 'RACE DAY!') :
      days <= 7  ? (lang === 'tr' ? 'YARIŞ HAFTASI'  : 'RACE WEEK')  :
      days <= 14 ? (lang === 'tr' ? 'TAPER'           : 'TAPER')      :
                   (lang === 'tr' ? 'YAPIM AŞAMASI'   : 'BUILD')
    return { days, phase, rd }
  }, [profile?.raceDate, today, lang])

  // Coach message unread count (athlete reads from localStorage)
  // Coach sessions RSVP + announcements
  const [coachSessions, setCoachSessions] = useState([])
  const [rsvpBusy, setRsvpBusy]           = useState({}) // { [sessionId]: true }
  const [myCoachId, setMyCoachId]          = useState(null)
  const [showQrScanner, setShowQrScanner]  = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadCoachSessions() {
      if (!supabase) return
      try {
        // v9.90.0 — Wrapped in try/catch. Previously a network rejection
        // from getMyCoach or getUpcomingSessions escaped as an unhandled
        // promise rejection (Sentry noise; no user impact since the
        // component renders without coach data when these fail).
        const athleteId = supabase.auth?.getUser ? (await supabase.auth.getUser())?.data?.user?.id : null
        if (!athleteId) return
        const coachId = await getMyCoach(supabase, athleteId)
        if (!coachId || cancelled) return
        if (!cancelled) setMyCoachId(coachId)
        const { data } = await getUpcomingSessions(coachId, 14)
        if (!cancelled && data) setCoachSessions(data)
      } catch (err) {
        logger.warn('[TodayView] loadCoachSessions failed:', err?.message || err)
      }
    }
    loadCoachSessions()
    return () => { cancelled = true }
  }, [])

  const handleRsvp = async (sessionId, status) => {
    if (!supabase) return
    const athleteId = (await supabase.auth.getUser())?.data?.user?.id
    if (!athleteId) return
    setRsvpBusy(b => ({ ...b, [sessionId]: true }))
    await upsertAttendance(sessionId, athleteId, status)
    setCoachSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, _myStatus: status } : s
    ))
    setRsvpBusy(b => ({ ...b, [sessionId]: false }))
  }

  const handleQrScan = async (sessionId) => {
    setShowQrScanner(false)
    // Confirm attendance for the scanned session
    const match = coachSessions.find(s => s.id === sessionId)
    if (match) {
      await handleRsvp(sessionId, 'confirmed')
    } else {
      // Session not yet loaded — re-fetch and confirm
      if (supabase && myCoachId) {
        const { data } = await getUpcomingSessions(myCoachId, 14)
        if (data) setCoachSessions(data)
        await handleRsvp(sessionId, 'confirmed')
      }
    }
  }

  const [coachUnread, setCoachUnread] = useState(() => {
    try {
      const msgs = JSON.parse(localStorage.getItem('sporeus-coach-messages') || '[]')
      return hasUnread(msgs, 'athlete')
    } catch (e) { logger.warn('localStorage:', e.message); return 0 }
  })

  // E66 — quick readiness tap state
  const todayReadiness = useMemo(() => {
    const entry = (recovery || []).find(e => e.date === today)
    return entry?.readiness != null ? entry.readiness : entry?.score != null ? entry.score : null
  }, [recovery, today])

  // v9.102.0 (Prompt T) — When today's plan calls for a hard session AND
  // readiness < 50 (or any hrv/tsb/injury rule fires via sessionSwapFlag),
  // compute an evidence-based easy/recovery recommendation that replaces
  // the rendered card. Original hard session stays available under a
  // collapsible disclosure so the athlete can override.
  const downgradeRec = useMemo(() => {
    if (!plannedSession || !isHardToday) return null
    const lowReadiness = todayReadiness != null && todayReadiness < 50
    if (!lowReadiness && !sessionSwapFlag) return null
    return buildDailyRecommendation({ log, recovery, profile, lang })
  }, [plannedSession, isHardToday, todayReadiness, sessionSwapFlag, log, recovery, profile, lang])
  const [quickReadinessSaved, setQuickReadinessSaved] = useState(false)
  const [quickReadinessLogged, setQuickReadinessLogged] = useState(false)

  const handleQuickReadiness = (value) => {
    const entry = { date: today, readiness: value, score: value, source: 'quick-tap', id: Date.now() }
    setRecovery(prev => [...(prev || []).filter(e => e.date !== today), entry].slice(-90))
    setQuickReadinessSaved(true)
    setQuickReadinessLogged(true)
    setTimeout(() => setQuickReadinessLogged(false), 2000)
    // v9.142.0 — Quick readiness satisfies the log_wellness orientation
    // step (the step only requires *any* wellness entry within 3 days).
    // Auto-dismiss so the user doesn't see a redundant nudge after
    // logging.
    if (orientationStep === 'log_wellness') {
      try { localStorage.setItem('sporeus-oriented-log_wellness', '1') } catch (e) { logger.warn('localStorage:', e.message) }
      setOrientationStep(null)
    }
  }

  const [wellness, setWellness]       = useState({ sleep: 3, energy: 3, soreness: 3 })
  const [wellnessSaved, setWellnessSaved] = useState(false)
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [saveDone, setSaveDone]           = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [scoreDisplay, setScoreDisplay]   = useState(0)
  const [shareLoading, setShareLoading]         = useState(false)
  const [expandedProtocol, setExpandedProtocol] = useState(null)
  const [showCheckIn, setShowCheckIn]           = useState(false)
  const [recoveryDone, setRecoveryDone] = useLocalStorage(`sporeus-recovery-done-${today}`, {})

  // v9.120.0 — Post-race retrospective form state. Local-only; on
  // submit we emit attribution + set localStorage and the card
  // self-dismisses via the gate check inside the render block.
  const [retroOutcome, setRetroOutcome] = useState(null)
  const [retroNote, setRetroNote]       = useState('')
  const [retroDismissed, setRetroDismissed] = useState(false)
  // v9.126.0 — Banner snooze bumper. snoozeBanner() writes localStorage;
  // bumping this counter forces a re-render so isBannerSnoozed reads the
  // fresh value. Per-banner local state would also work but a single
  // counter keeps the call sites compact.
  const [snoozeBump, setSnoozeBump] = useState(0)

  // v9.132.0 — Strava sync health. Fetched once per mount when authUser
  // is available; null when no Strava connection exists (silent — not
  // every athlete uses Strava). Re-fetches if authUser.id changes.
  const [stravaConn, setStravaConn] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!authUser?.id) { setStravaConn(null); return }
    getStravaConnection(authUser.id)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setStravaConn(data || null)
      })
      .catch(() => { /* silent — Strava is optional */ })
    return () => { cancelled = true }
  }, [authUser?.id])

  const [weeklyRecap] = useState(() => generateWeeklyRecap(log))
  const [recapDismissed, setRecapDismissed] = useState(() => weeklyRecap ? !!localStorage.getItem(`sporeus-recap-seen-${weeklyRecap?.weekLabel}`) : true)
  const [orientationStep, setOrientationStep] = useState(() => getOrientationStep(log, profile, recovery))

  // UUID idempotency key — generated once on mount, reset when today changes
  const idempotencyKey = useRef(null)
  useEffect(() => {
    idempotencyKey.current = `${today}-${Math.random().toString(36).slice(2, 10)}`
    setIsSubmitting(false)
    setAlreadySubmitted(false)
  }, [today])

  // v9.108.0 (Prompt PP) — One-shot race_week_entered telemetry. Fires
  // once per raceDate the first time the athlete is within 7 days. Gated
  // on localStorage so the event doesn't fire on every page render or
  // re-fire after browser refresh.
  useEffect(() => {
    if (!raceCountdown?.rd) return
    if (raceCountdown.days < 0 || raceCountdown.days > 7) return
    const key = `sporeus-race-week-entered-${raceCountdown.rd}`
    try {
      if (localStorage.getItem(key)) return
      emitEvent('race_week_entered', { days_to_race: raceCountdown.days, race_date: raceCountdown.rd })
      localStorage.setItem(key, new Date().toISOString())
    } catch { /* fail open */ }
  }, [raceCountdown?.rd, raceCountdown?.days])

  const handleShare = async () => {
    if (shareLoading || (log || []).length < 1) return
    setShareLoading(true)
    try {
      const w = 600, h = 320
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      // Background
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h)
      // Orange accent bar
      ctx.fillStyle = '#ff6600'; ctx.fillRect(0, 0, 4, h)
      // Wordmark
      ctx.fillStyle = '#ff6600'; ctx.font = "bold 13px 'Courier New',monospace"
      ctx.fillText('\u25C8 SPOREUS ATHLETE', 24, 28)
      ctx.fillStyle = '#333'; ctx.font = "10px 'Courier New',monospace"
      ctx.fillText(today, w - 90, 28)
      // Name
      const name = profile?.name || 'Athlete'
      ctx.fillStyle = '#e0e0e0'; ctx.font = "bold 20px 'Courier New',monospace"
      ctx.fillText(name.slice(0, 28), 24, 65)
      // Readiness score
      const rec = (recovery || []).find(e => e.date === today)
      if (rec) {
        const col = rec.score >= 75 ? '#5bc25b' : rec.score >= 50 ? '#f5c542' : '#e03030'
        ctx.fillStyle = col; ctx.font = "bold 52px 'Courier New',monospace"
        ctx.fillText(String(rec.score), 24, 140)
        ctx.fillStyle = '#555'; ctx.font = "9px 'Courier New',monospace"
        ctx.fillText('READINESS /100', 24, 155)
      }
      // ACWR
      if (acwrRatio !== null) {
        const ac = acwrRatio > 1.3 ? '#e03030' : acwrRatio >= 0.8 ? '#5bc25b' : '#f5c542'
        ctx.fillStyle = ac; ctx.font = "bold 52px 'Courier New',monospace"
        ctx.fillText(acwrRatio.toFixed(2), 180, 140)
        ctx.fillStyle = '#555'; ctx.font = "9px 'Courier New',monospace"
        ctx.fillText('ACWR', 180, 155)
      }
      // 7-day TSS bars
      const bars = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setUTCDate(d.getUTCDate() - i)
        const ds = d.toISOString().slice(0, 10)
        bars.push((log || []).filter(e => e.date === ds).reduce((s, e) => s + (e.tss || 0), 0))
      }
      const maxB = Math.max(...bars, 1)
      const bw = 52, bg = 6, bx0 = 24, by0 = 260, bmh = 70
      bars.forEach((tss, i) => {
        const bh = Math.max(2, Math.round((tss / maxB) * bmh))
        ctx.fillStyle = i === 6 ? '#ff6600' : '#1e1e1e'
        ctx.fillRect(bx0 + i * (bw + bg), by0 - bh, bw, bh)
      })
      ctx.fillStyle = '#222'; ctx.font = "8px 'Courier New',monospace"
      ctx.fillText('7-DAY TSS', bx0, by0 + 12)
      // Footer
      ctx.fillStyle = '#2a2a2a'; ctx.font = "9px 'Courier New',monospace"
      ctx.fillText('sporeus.com', w - 88, h - 10)
      // Share or download
      await new Promise(res => canvas.toBlob(async (blob) => {
        const file = new File([blob], `sporeus-${today}.png`, { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'My Training Summary', text: `${name} — Readiness ${rec?.score ?? '?'}/100` }) } catch (e) { logger.warn('share:', e.message) }
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = `sporeus-${today}.png`; a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
        res()
      }, 'image/png'))
    } catch (e) { logger.warn('caught:', e.message) }
    setShareLoading(false)
  }

  const saveReadiness = async () => {
    if (isSubmitting) return
    // Check if this idempotency key was already used (double-tap guard)
    const usedKey = 'sporeus-checkin-idem'
    const stored = (() => { try { return localStorage.getItem(usedKey) } catch { return null } })()
    if (stored === idempotencyKey.current) {
      setAlreadySubmitted(true)
      setWellnessSaved(true)
      return
    }
    setIsSubmitting(true)
    try { localStorage.setItem(usedKey, idempotencyKey.current) } catch (e) { logger.warn('localStorage:', e.message) }

    // HRV weighting: suppressed HRV pulls readiness down even when subjective wellness is high
    const hrvFactor = hrvTrend.daysWithData >= 3
      ? (hrvTrend.trend === 'unstable' ? 0.75 : hrvTrend.trend === 'warning' ? 0.90 : 1.0)
      : 1.0
    const score = Math.min(100, Math.round((wellness.sleep + wellness.energy + (6 - wellness.soreness)) / 3 * 20 * hrvFactor))
    const entry = {
      date: today, sleep: wellness.sleep, energy: wellness.energy,
      soreness: wellness.soreness, mood: 3, stress: 3, score,
      hrv_factor: hrvFactor !== 1.0 ? hrvFactor : undefined,
      id: Date.now(), idempotency_key: idempotencyKey.current,
    }

    // setRecovery triggers Supabase sync via useRecovery hook (DataContext).
    // The hook handles both online upsert and localStorage persistence.
    setRecovery(prev => [...(prev || []).filter(e => e.date !== today), entry].slice(-90))
    setWellnessSaved(true)
    setSaveDone(true)
    setTimeout(() => setSaveDone(false), 3000)
    // Count-up animation: 0 → score over 400ms
    const target = score; const start = Date.now(); const dur = 400
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / dur, 1)
      setScoreDisplay(Math.round(target * progress))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    if (EMBED_MODE) {
      try { window.parent.postMessage({ type: 'sporeus-checkin-complete', score }, '*') } catch (e) { logger.warn('postMessage:', e.message) }
    }

    // Flush any previously queued offline entries now that we're submitting
    flushQueue().catch(() => {})

    // Re-enable after 2s (prevents accidental double-tap; localStorage guard prevents true duplicates)
    setTimeout(() => setIsSubmitting(false), 2000)
  }

  const markDone = () => {
    if (!todayKey) return
    setPlanStatus(ps => ({ ...ps, [todayKey]: 'done' }))
    if (isSupabaseReady()) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.id) {
          supabase.from('profiles')
            .update({ last_workout_done_at: new Date().toISOString() })
            .eq('id', data.user.id)
        }
      })
    }
  }

  const logThisSession = () => {
    if (plannedSession) {
      setLogPrefill({ type: plannedSession.type, duration: plannedSession.duration, rpe: plannedSession.rpe || 6, date: today })
    }
    setTab('log')
  }

  const card = {
    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '20px 18px', marginBottom: '14px', fontFamily: MONO,
  }
  const cardTitle = {
    fontSize: '10px', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase',
    marginBottom: '14px',
  }
  const badge = (color) => ({
    display: 'inline-block', background: color + '18', border: `1px solid ${color}`,
    borderRadius: '4px', padding: '2px 8px', fontSize: '10px', color, letterSpacing: '0.06em',
  })
  const btn = (bg, fg = '#fff') => ({
    fontFamily: MONO, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
    padding: '7px 14px', borderRadius: '4px', border: 'none', background: bg,
    color: fg, cursor: 'pointer',
  })

  // Plan week TSS target (sum of plan sessions this week) or fallback 0
  const weekTSSTarget = (() => {
    if (!plannedSession || !plan?.weeks) return 0
    const sessions = plan.weeks[plannedSession.weekIdx]?.sessions || []
    return Math.round(sessions.reduce((s, ws) => s + (ws.tss || 0), 0))
  })()

  // Plan week session target (non-rest planned sessions)
  const sessionTarget = (() => {
    if (!plannedSession || !plan?.weeks) return 5
    const sessions = plan.weeks[plannedSession.weekIdx]?.sessions || []
    return sessions.filter(ws => ws.type && ws.type !== 'Rest' && ws.duration > 0).length || 5
  })()

  // RESTQ-Sport nudge
  const restqDue = (() => {
    try {
      const history = JSON.parse(localStorage.getItem('sporeus-restq-history') || '[]')
      return isRESTQDue(history, (log || []).length)
    } catch { return false }
  })()

  // v9.110.0 (Prompt AAA) — Diagnostic priority. Pre-v9.110 the 4 detectors
  // (goal-mismatch, stale-plan, plan-drift, comeback) each rendered as
  // independent peer cards in different positions. Worst-case render
  // stacked 4 red/amber surfaces above the actual training session.
  //
  // Now: compute all payloads once, rank by severity, only the TOP
  // diagnostic gets full-presentation card. The rest collapse into a
  // single "▼ N more diagnostics" disclosure attached to the top card.
  // Each IIFE checks `diagnosticTop?.key === <its-key>` and short-circuits
  // when it's not winning.
  const planForStaleLookup = plan ? {
    generatedAt: plan.generatedAt,
    weeks:       Array.isArray(plan.weeks) ? plan.weeks : [],
    seedCTL:     plan.seedCTL,
  } : null
  const diagnosticTop = useMemo(() => {
    const inputs = [
      { key: 'goal-mismatch', payload: detectGoalActivityMismatch(profile, log, { today }) },
      { key: 'stale-plan',    payload: planForStaleLookup ? detectStalePlan(planForStaleLookup, todayCtl, today) : null },
      { key: 'plan-drift',    payload: plan ? computePlanDrift(plan, log, today) : null },
      { key: 'comeback',      payload: detectComebackGap(log, today) },
    ]
    return rankDiagnostics(inputs)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- planForStaleLookup identity excluded; underlying fields tracked
  }, [profile, log, today, plan, todayCtl])

  // v9.128.0 (Prompt PPP) — Soft priority: when a CRITICAL Mission 1
  // diagnostic is the primary card, suppress secondary alert banners
  // (decoupling, polarized) for this render. They re-surface as soon
  // as the critical clears. Addresses the v9.126 critique that v9.123
  // and v9.125 bypassed the v9.110 priority system — when goal-mismatch
  // or plan-regenerate is firing, decoupling can wait.
  // Warning-tier diagnostics don't trigger deferral — they share the
  // same severity floor as the secondary alerts, so they coexist.
  const criticalPrimaryActive = diagnosticTop?.top?.severity === 'critical'

  // One-shot telemetry: emit which diagnostic won (per day per top.key) so
  // we can measure detector activation rates in the audit window.
  useEffect(() => {
    if (!diagnosticTop?.top) return
    const k = `sporeus-diagnostic-shown-${today}-${diagnosticTop.top.key}`
    try {
      if (localStorage.getItem(k)) return
      emitEvent('diagnostic_primary_shown', {
        key: diagnosticTop.top.key,
        severity: diagnosticTop.top.severity,
        rest_count: diagnosticTop.rest.length,
      })
      localStorage.setItem(k, new Date().toISOString())
    } catch { /* fail open */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- diagnosticTop is a memoized object; field-level deps below
  }, [diagnosticTop?.top?.key, diagnosticTop?.top?.severity, diagnosticTop?.rest?.length, today])

  // v9.151.0 — Auto-downgrade telemetry (Prompt 9). One-shot per day:
  // emit downgrade_shown when v9.102's downgrade card renders, so we can
  // measure the override rate (downgrade_overridden / downgrade_shown).
  // Adoption signal: if many athletes click SEE PLANNED instead of LOG
  // DOWNGRADED, the v9.102 thresholds are too aggressive.
  useEffect(() => {
    if (!downgradeRec || !plannedSession) return
    const k = `sporeus-downgrade-shown-${today}`
    try {
      if (localStorage.getItem(k)) return
      emitEvent('downgrade_shown', {
        planned_type:  plannedSession.type,
        planned_rpe:   plannedSession.rpe || null,
        suggested_rpe: downgradeRec.rpe || null,
        readiness:     todayReadiness ?? null,
        trigger:       sessionSwapFlag ? 'swap_flag' : 'low_readiness',
        source:        downgradeRec.source || null,
      })
      localStorage.setItem(k, new Date().toISOString())
    } catch { /* fail open */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- objects are memoized; field-level deps below
  }, [downgradeRec, plannedSession?.type, plannedSession?.rpe, todayReadiness, sessionSwapFlag, today])

  return (
    <div className="sp-fade">

      {/* ── v9.145.0 — Above-fold morning glance ──────────────────────────
          The TodayView surface has grown to 40+ conditional cards/banners
          over the years. The actual planned session (the *primary* purpose
          of the tab) ends up scrolled below 5-10 banners depending on
          state. This block puts the 3 things an athlete needs at 6am
          above everything else: today's session line, readiness, and the
          single critical diagnostic (if any). The rest collapses into the
          MORE CONTEXT disclosure below — auto-open when nothing critical,
          collapsed when something critical so the morning glance stays
          clean. Spec: Prompt 1 from the v9.144 critique. */}
      {(() => {
        const glanceLine = buildGlanceLine({ plannedSession, lang })
        const criticalDx = diagnosticTop?.top?.severity === 'critical' ? diagnosticTop.top : null
        const readinessColor = todayReadiness == null ? '#888'
          : todayReadiness >= 75 ? GREEN
          : todayReadiness >= 50 ? AMBER
          : RED
        const readinessEmoji = todayReadiness == null ? '·'
          : todayReadiness >= 75 ? '⚡'
          : todayReadiness >= 50 ? '😐'
          : '😴'
        return (
          <div style={{
            padding: '12px 16px', marginBottom: '10px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderLeft: `4px solid ${criticalDx ? RED : ORANGE}`,
            borderRadius: '6px', fontFamily: MONO,
          }}>
            {/* Line 1: session glance */}
            {glanceLine ? (
              <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '8px' }}>
                {glanceLine}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontStyle: 'italic' }}>
                {lang === 'tr' ? 'Bugün için plan yok' : 'No plan for today'}
              </div>
            )}

            {/* Line 2: readiness — chip when logged, 3-tap when null */}
            {todayReadiness != null ? (
              <div style={{ fontSize: '10px', color: readinessColor, marginBottom: criticalDx ? '8px' : 0, fontWeight: 700, letterSpacing: '0.04em' }}>
                {readinessEmoji} {todayReadiness}/100 · {lang === 'tr' ? 'HAZIRLIK' : 'READINESS'}
              </div>
            ) : !quickReadinessSaved ? (
              <div style={{ display: 'flex', gap: '6px', marginBottom: criticalDx ? '8px' : 0 }}>
                {[{ e: '😴', v: 25 }, { e: '😐', v: 60 }, { e: '⚡', v: 90 }].map(({ e, v }) => (
                  <button key={v} onClick={() => handleQuickReadiness(v)} style={{
                    fontFamily: MONO, fontSize: '14px',
                    padding: '4px 14px', borderRadius: '4px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', cursor: 'pointer',
                  }}>{e}</button>
                ))}
              </div>
            ) : null}

            {/* Line 3: critical diagnostic only */}
            {criticalDx && (
              <div style={{
                fontSize: '11px', color: RED, padding: '6px 8px',
                borderLeft: `2px solid ${RED}`, background: `${RED}0c`,
                fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.5,
              }}>
                ⚠ {criticalDx.payload?.message
                    || criticalDx.payload?.recommendation?.[lang]
                    || criticalDx.payload?.recommendation?.en
                    || criticalDx.key}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── v9.145.0 — Everything below collapses when something critical
          is active. Auto-open otherwise so first-time users see the full
          density. The key forces a remount when criticality changes so
          the open prop applies. */}
      <details
        open={diagnosticTop?.top?.severity !== 'critical'}
        key={diagnosticTop?.top?.severity === 'critical' ? 'crit' : 'normal'}
        style={{ marginBottom: '10px' }}
      >
        <summary style={{
          cursor: 'pointer', userSelect: 'none', padding: '6px 4px',
          fontFamily: MONO, fontSize: '10px', color: '#888', letterSpacing: '0.06em',
        }}>
          ▼ {lang === 'tr' ? 'DAHA FAZLA BAĞLAM' : 'MORE CONTEXT'}
        </summary>

      {/* ── v9.4.0 — NEXT TRAINING hero (Mission #1 anchor at top of TODAY) ─ */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <NextTrainingCardLazy />
        </Suspense>
      </ErrorBoundary>

      {/* ── v9.110.0 (Prompt AAA) — "▼ N more diagnostics" disclosure.
          Pre-v9.110 each detector rendered its own peer card. Now only the
          top-ranked card renders inline; this disclosure surfaces the
          others in compact form so the data is still accessible without
          stacking 4 cards. Hidden when there are no other diagnostics. */}
      {diagnosticTop?.rest?.length > 0 && (() => {
        const rest = diagnosticTop.rest
        const SEV = { critical: '#e03030', warning: '#f5c542', info: '#888' }
        const KEY_LABEL = {
          'goal-mismatch': { en: 'Goal ≠ training mix',   tr: 'Hedef ≠ antrenman' },
          'stale-plan':    { en: 'Plan anchor is stale',  tr: 'Plan anchorı bayat' },
          'plan-drift':    { en: 'Plan-execution drift',  tr: 'Plan/icra sapması' },
          'comeback':      { en: 'Returning after a gap', tr: 'Aradan sonra dönüş' },
        }
        return (
          <details style={{
            marginBottom: '12px', padding: '6px 12px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderLeft: '3px solid #555', borderRadius: '4px',
            fontFamily: MONO, fontSize: '10px',
          }}>
            <summary style={{ cursor: 'pointer', color: '#888', letterSpacing: '0.06em', userSelect: 'none' }}>
              ▼ {rest.length} {lang === 'tr'
                ? (rest.length === 1 ? 'EK TEŞHİS' : 'EK TEŞHİS')
                : (rest.length === 1 ? 'MORE DIAGNOSTIC' : 'MORE DIAGNOSTICS')}
            </summary>
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {rest.map(r => {
                const color = SEV[r.severity] || '#888'
                const lbl = KEY_LABEL[r.key]?.[lang] || KEY_LABEL[r.key]?.en || r.key
                return (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color, fontSize: '11px' }}>●</span>
                    <span style={{ color: '#ccc' }}>{lbl}</span>
                    <span style={{ color: '#555', marginLeft: 'auto', fontSize: '9px', letterSpacing: '0.04em' }}>
                      {r.severity.toUpperCase()}
                    </span>
                  </div>
                )
              })}
              <div style={{ color: '#555', fontStyle: 'italic', marginTop: '4px', fontSize: '9px' }}>
                {lang === 'tr'
                  ? '— birden fazla işaret tespit edildi; en önemli olan yukarıda gösteriliyor'
                  : '— multiple signals detected; the most important one is shown above'}
              </div>
            </div>
          </details>
        )
      })()}

      {/* ── v9.109.0 (Prompt TT) — Comeback banner. When the athlete returns
          after a 14+ day gap with prior CTL above floor, surface a
          welcome-back message + load-easing suggestion (50% prior CTL).
          Mission 1 normally treats every visit identically; returning
          athletes need the lighter restart guidance or they re-injure
          themselves trying to pick up where they left off.
          v9.110.0 (Prompt AAA): only render when comeback wins the
          diagnostic-priority ranking — otherwise the higher-severity
          flag takes the slot and comeback appears under "▼ N more". */}
      {diagnosticTop?.top?.key === 'comeback' && (() => {
        const comeback = detectComebackGap(log, today)
        if (!comeback.isComeback) return null
        const weeks = Math.round(comeback.gapDays / 7)
        return (
          <div style={{
            marginBottom: '14px', padding: '12px 16px',
            background: '#0064ff14', border: '1px solid #0064ff55',
            borderLeft: '4px solid #0064ff', borderRadius: '5px',
            fontFamily: MONO,
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0064ff', letterSpacing: '0.08em', marginBottom: '6px' }}>
              ✦ {lang === 'tr'
                ? `TEKRAR HOŞ GELDİN · ${weeks} HAFTA SONRA`
                : `WELCOME BACK · AFTER ${weeks} WEEKS`}
            </div>
            <div style={{ fontSize: '11px', color: '#ccc', lineHeight: 1.55, marginBottom: '6px' }}>
              {lang === 'tr'
                ? `${comeback.gapDays} günlük araya çıktın. Önceki kondisyonun ${comeback.priorCTL} CTL'di. Sakatlanmamak için ilk 1-2 hafta ~${comeback.easedCTL} CTL hedefiyle başla (önceki yükün %50'si).`
                : `You've been away for ${comeback.gapDays} days. Your prior fitness was ${comeback.priorCTL} CTL. Start back at ~${comeback.easedCTL} CTL (50% of prior) for the first 1–2 weeks to avoid re-injury.`}
            </div>
            <Citation text="Bompa & Buzzichelli 2018 (detraining principle — connective tissue de-adapts faster than aerobic capacity)" />
          </div>
        )
      })()}

      {/* v9.109.0 — One-shot comeback_after_gap telemetry */}
      {(() => {
        const comeback = detectComebackGap(log, today)
        if (!comeback.isComeback || !comeback.lastDate) return null
        const key = `sporeus-comeback-${comeback.lastDate}`
        try {
          if (!localStorage.getItem(key)) {
            emitEvent('comeback_after_gap', {
              gap_days:   comeback.gapDays,
              prior_ctl:  comeback.priorCTL,
              eased_ctl:  comeback.easedCTL,
            })
            localStorage.setItem(key, new Date().toISOString())
          }
        } catch { /* fail open */ }
        return null
      })()}

      {/* ── v9.123.0 — Aerobic decoupling trend alert. Surfaces when the
          last 14d of aerobic-RPE sessions (≥2 samples) show average
          Pw:Hr drift ≥5%. Silent for good trends (<5%) and for athletes
          without FIT-imported decoupling data. Friel-method threshold
          mirrors the per-session DECOUPLING_THRESHOLDS in
          lib/decoupling.js — surfacing the multi-session pattern that
          per-session data alone hides. */}
      {(() => {
        const dec = analyzeDecouplingTrend(log, today)
        if (!dec.summary) return null
        if (isBannerSnoozed('decoupling')) return null
        if (criticalPrimaryActive) return null
        void snoozeBump  // dependency: bumping forces re-read
        const isSignificant = dec.flag === 'significant'
        return (
          <Banner
            severity={isSignificant ? 'critical' : 'warning'}
            title={lang === 'tr' ? 'AEROBİK DESENKRONİZASYON' : 'AEROBIC DECOUPLING'}
            subtitle={`· ${dec.avgPct.toFixed(1)}% · ${dec.sampleCount} ${lang === 'tr' ? 'seans' : 'sessions'}`}
            snoozeKey="decoupling"
            onSnooze={() => setSnoozeBump(b => b + 1)}
            lang={lang}
            citation="Friel — Pw:Hr drift >5% on steady aerobic work indicates the aerobic engine cannot sustain demand."
          >
            {dec.summary[lang] || dec.summary.en}
          </Banner>
        )
      })()}

      {/* ── v9.132.0 — Strava sync health banner. Surfaces stale/failing
          Strava connections so an athlete with a silently-broken sync
          sees it without having to navigate to Profile. Silent when
          disconnected (athlete doesn't use Strava — no false alarm) or
          healthy. Snoozable for 7 days like other banners. Defers to
          critical Mission 1 diagnostics (v9.128 PPP). */}
      {(() => {
        const health = classifyStravaSync(stravaConn)
        if (!health.actionable) return null
        if (isBannerSnoozed('strava-sync')) return null
        if (criticalPrimaryActive) return null
        void snoozeBump
        const color = health.state === 'failing' ? '#e03030' : '#f5c542'
        return (
          <div role="status" style={{
            marginBottom: '14px', padding: '10px 14px',
            background: `${color}10`, border: `1px solid ${color}55`,
            borderLeft: `4px solid ${color}`, borderRadius: '4px',
            fontFamily: MONO, position: 'relative',
          }}>
            <button
              onClick={() => { snoozeBanner('strava-sync'); setSnoozeBump(b => b + 1) }}
              aria-label={lang === 'tr' ? 'Uyarıyı 7 gün ertele' : 'Snooze alert for 7 days'}
              title={lang === 'tr' ? '7 gün ertele' : 'Snooze 7 days'}
              style={{ position: 'absolute', top: '6px', right: '8px',
                background: 'transparent', border: 'none', color: '#666',
                cursor: 'pointer', fontSize: '12px', padding: '2px 6px', lineHeight: 1 }}>
              ×
            </button>
            <div style={{ fontSize: '10px', fontWeight: 700, color, letterSpacing: '0.08em', marginBottom: '6px', paddingRight: '20px' }}>
              {health.state === 'failing' ? '⚠' : '↻'} {lang === 'tr' ? 'STRAVA SENKRON' : 'STRAVA SYNC'}
              {health.daysSinceLastSync != null && (
                <span style={{ color: '#888', fontWeight: 400, marginLeft: '8px' }}>
                  · {health.daysSinceLastSync}{lang === 'tr' ? ' gün önce' : 'd ago'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: '#ccc', lineHeight: 1.55, marginBottom: '6px' }}>
              {health.summary[lang] || health.summary.en}
            </div>
            <button
              onClick={() => setTab('profile')}
              style={{
                fontFamily: MONO, fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.06em', padding: '4px 10px',
                background: 'transparent', border: `1px solid ${color}88`,
                color, borderRadius: '3px', cursor: 'pointer',
              }}>
              → {lang === 'tr' ? 'PROFİL\'E GİT' : 'OPEN PROFILE'}
            </button>
          </div>
        )
      })()}

      {/* ── v9.125.0 — Weekly polarized intensity distribution. Surfaces a
          one-line chip when the current week's distribution drifts off
          the Seiler 80/20 polarized model. Silent when the week is
          already polarized — silence is the absence of a problem. Uses
          the existing weeklyPolarizationScore (PolarizationComplianceCard
          on Dashboard surfaces the 8-week trend; this is the daily
          surface). */}
      {(() => {
        const pol = analyzePolarizedWeek(log, today)
        if (!pol || pol.flag === 'polarized' || !pol.interpretation) return null
        if (isBannerSnoozed('polarized')) return null
        if (criticalPrimaryActive) return null
        void snoozeBump
        const label = pol.flag === 'drift-threshold'
          ? (lang === 'tr' ? 'EŞİK YOĞUNLUĞU FAZLA' : 'THRESHOLD-HEAVY')
          : pol.flag === 'drift-pyramidal'
          ? (lang === 'tr' ? 'PİRAMİDAL DAĞILIM'   : 'PYRAMIDAL DISTRIBUTION')
          : (lang === 'tr' ? 'YAPILANDIRILMAMIŞ HAFTA' : 'UNSTRUCTURED WEEK')
        return (
          <Banner
            severity={pol.flag === 'drift-threshold' ? 'critical' : 'warning'}
            icon="◇"
            title={label}
            subtitle={`· ${pol.easyPct}% / ${pol.thresholdPct}% / ${pol.hardPct}%`}
            snoozeKey="polarized"
            onSnooze={() => setSnoozeBump(b => b + 1)}
            lang={lang}
            citation={pol.citation}
          >
            {pol.interpretation[lang] || pol.interpretation.en}
          </Banner>
        )
      })()}

      {/* ── v9.120.0 — Post-race retrospective. When profile.raceDate is
          1–7 days in the past AND the retrospective hasn't been logged
          for this race yet, surface a card asking how the race went.
          Closes the loop opened by Mission 2's race_committed milestone
          (v9.113 DDD) — the system advertised the date as important
          enough to track, but then never asked about the outcome.
          Outcome (hit/missed/DNF) + optional free-form note. Emits
          race_completed with structured outcome + note presence (not
          note content). Idempotent via per-raceDate localStorage gate. */}
      {(() => {
        const retro = detectRaceRetrospective(profile, today)
        if (!retro) return null
        if (retroDismissed) return null
        let alreadyLogged = false
        try { alreadyLogged = !!localStorage.getItem(retroLocalStorageKey(retro.raceDate)) } catch { /* ignore */ }
        if (alreadyLogged) return null
        const outcomes = [
          { key: 'hit_goal',    en: 'Hit goal',     tr: 'Hedefi tutturdun', color: '#5bc25b' },
          { key: 'missed_goal', en: 'Missed goal',  tr: 'Hedef tutmadı',    color: '#f5c542' },
          { key: 'dnf',         en: 'DNF',          tr: 'Tamamlamadın',     color: '#e03030' },
        ]
        const submit = () => {
          if (!retroOutcome) return
          const note = (retroNote || '').trim().slice(0, 200)
          emitEvent('race_completed', {
            race_date: retro.raceDate,
            outcome:   retroOutcome,
            days_since_race: retro.daysSince,
            has_note:  !!note,
          })
          try { localStorage.setItem(retroLocalStorageKey(retro.raceDate), JSON.stringify({ outcome: retroOutcome, ts: new Date().toISOString() })) } catch { /* ignore */ }
          setRetroDismissed(true)
        }
        const skip = () => {
          try { localStorage.setItem(retroLocalStorageKey(retro.raceDate), JSON.stringify({ outcome: 'skipped', ts: new Date().toISOString() })) } catch { /* ignore */ }
          setRetroDismissed(true)
        }
        return (
          <div style={{
            marginBottom: '14px', padding: '14px 16px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderLeft: '4px solid #ff6600', borderRadius: '4px',
          }}>
            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#ff6600', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px' }}>
              ◆ {lang === 'tr' ? 'YARIŞ SONRASI' : 'POST-RACE'}
              <span style={{ color: '#888', fontWeight: 400, marginLeft: '8px' }}>
                · {retro.daysSince}{lang === 'tr' ? ' gün önce' : 'd ago'}
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--text)', marginBottom: '12px', lineHeight: 1.5 }}>
              {lang === 'tr' ? 'Yarış nasıl geçti?' : 'How did your race go?'}
            </div>
            <div role="radiogroup" aria-label={lang === 'tr' ? 'Yarış sonucu' : 'Race outcome'}
              style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {outcomes.map(o => {
                const selected = retroOutcome === o.key
                return (
                  <button
                    key={o.key}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRetroOutcome(o.key)}
                    style={{
                      fontFamily: MONO, fontSize: '11px', fontWeight: 700,
                      padding: '6px 12px', letterSpacing: '0.06em',
                      background: selected ? `${o.color}22` : 'transparent',
                      border: `1px solid ${selected ? `${o.color}aa` : 'var(--border)'}`,
                      color: selected ? o.color : '#aaa',
                      borderRadius: '3px', cursor: 'pointer',
                    }}>
                    {selected ? '◉' : '○'} {o[lang] || o.en}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={retroNote}
              onChange={e => setRetroNote(e.target.value.slice(0, 200))}
              placeholder={lang === 'tr'
                ? 'Sonuç (opsiyonel) — ör. 3:42:18'
                : 'Result (optional) — e.g. 3:42:18'}
              style={{
                width: '100%', fontFamily: MONO, fontSize: '11px',
                padding: '6px 9px', marginBottom: '10px',
                background: 'var(--input-bg)', color: 'var(--text)',
                border: '1px solid var(--input-border)', borderRadius: '3px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={submit}
                disabled={!retroOutcome}
                style={{
                  ...btn(retroOutcome ? '#ff6600' : 'transparent'),
                  opacity: retroOutcome ? 1 : 0.4,
                  cursor: retroOutcome ? 'pointer' : 'not-allowed',
                }}>
                {lang === 'tr' ? 'YARIŞI KAYDET →' : 'LOG RACE →'}
              </button>
              <button onClick={skip} style={{ ...btn('transparent', '#888'), fontSize: '9px' }}>
                {lang === 'tr' ? 'GEÇ' : 'SKIP'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── v9.107.0 (Prompt LL) — Training streak chip. One-line summary
          surfaces a habit signal the system already had. Hidden when
          current streak is 0 to avoid demoralizing fresh / returning
          athletes who'd just see "0 days". Always-visible only when
          they have something to celebrate.
          v9.108.0 (Prompt OO): milestone badge on tier days (7/14/30/
          60/100/365). One-shot streak_milestone telemetry per tier, gated
          on sporeus-streak-milestone-{tier} so a streak crossing 7 once
          doesn't re-fire if the athlete breaks and re-hits it later. */}
      {(() => {
        const streak = computeTrainingStreak(log, today)
        if (streak.current === 0) return null
        const flame = streak.current >= 7
        const milestone = getStreakMilestone(streak.current)
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            marginBottom: '14px', padding: '8px 14px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${milestone ? '#ff6600' : flame ? '#ff6600' : '#5bc25b'}`,
            borderRadius: '4px', fontFamily: MONO,
          }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: flame ? '#ff6600' : '#5bc25b' }}>
              {flame ? '🔥' : '✓'} {streak.current}-{lang === 'tr' ? 'gün seri' : 'day streak'}
            </span>
            {milestone && (
              <span style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                padding: '3px 8px', background: '#ff660022', color: '#ff6600',
                border: '1px solid #ff660066', borderRadius: '3px',
              }}>
                ✨ {milestone.label[lang] || milestone.label.en}
              </span>
            )}
            {streak.longest > streak.current && (
              <span style={{ fontSize: '10px', color: '#666' }}>
                {lang === 'tr' ? 'kişisel rekor' : 'best'}: {streak.longest}
              </span>
            )}
            {streak.current >= 7 && !milestone && (
              <span style={{ fontSize: '9px', color: '#888', letterSpacing: '0.06em', marginLeft: 'auto' }}>
                {lang === 'tr' ? '· bir hafta üst üste · alışkanlık oluşuyor' : '· week-long · habit is forming'}
              </span>
            )}
            {streak.includesRestDay && (
              <span style={{ fontSize: '9px', color: '#888', letterSpacing: '0.04em' }}>
                {lang === 'tr' ? '(planlı dinlenme dahil)' : '(incl. planned rest)'}
              </span>
            )}
          </div>
        )
      })()}
      {/* Milestone one-shot telemetry — separated from the render so
          useEffect deps are stable. */}
      {(() => {
        const streak = computeTrainingStreak(log, today)
        const m = getStreakMilestone(streak.current)
        if (m) {
          const key = `sporeus-streak-milestone-${m.tier}`
          try {
            if (!localStorage.getItem(key)) {
              emitEvent('streak_milestone', { tier: m.tier, current: streak.current, longest: streak.longest })
              localStorage.setItem(key, new Date().toISOString())
            }
          } catch { /* fail open */ }
        }
        return null
      })()}

      {/* ── v9.127.0 — Weekly TSS budget pace chip. Compact bar showing
          spent / target with a pace indicator. Visible Mon–Sun whenever
          the plan provides a target. Surfaces what raw TSS numbers
          don't: are you on pace for this week's prescribed load?
          On-pace is rendered with neutral coloring; ahead/behind gets
          amber and an inline summary line. */}
      {(() => {
        const budget = analyzeWeeklyBudget({ weekTSS, weekTSSTarget, today })
        if (!budget) return null
        const barFill = Math.min(100, budget.spentPct)
        const color =
          budget.status === 'on-pace' ? '#5bc25b'
          : budget.status === 'ahead' ? '#f5c542'
          : '#0064ff'  // behind — informational blue, not alarm-red
        const label = lang === 'tr' ? 'HAFTALIK TSS' : 'WEEK TSS'
        const statusLabel = budget.status === 'on-pace'
          ? (lang === 'tr' ? 'hedef hızında' : 'on pace')
          : budget.status === 'ahead'
          ? (lang === 'tr' ? `+${budget.paceDelta}% önde` : `+${budget.paceDelta}% ahead`)
          : (lang === 'tr' ? `${budget.paceDelta}% geride` : `${budget.paceDelta}% behind`)
        return (
          <div style={{
            marginBottom: '14px', padding: '8px 12px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${color}`, borderRadius: '4px',
            fontFamily: MONO,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '9px', color: '#888', letterSpacing: '0.1em' }}>
                ◇ {label}
                <span style={{ color: '#aaa', marginLeft: '8px', letterSpacing: '0.04em' }}>
                  {budget.spent} / {budget.target}
                </span>
              </span>
              <span style={{ fontSize: '9px', color, letterSpacing: '0.06em' }}>
                {statusLabel}
              </span>
            </div>
            <div style={{ height: '3px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${barFill}%`, height: '100%', background: color,
                transition: 'width 200ms ease-out',
              }}/>
              {/* Tick at expected pace */}
              <div style={{
                position: 'absolute', top: '-2px', height: '7px', width: '1px',
                left: `${budget.expectedPct}%`, background: '#aaa', opacity: 0.6,
              }}/>
            </div>
            {budget.summary && (
              <div style={{ fontSize: '9px', color: '#aaa', marginTop: '5px', lineHeight: 1.5 }}>
                {budget.summary[lang] || budget.summary.en}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Weekly Recap (Monday only) ─────────────────────────────────────── */}
      {/* ── O4 — Weekly recap card (visual upgrade) ─────────────────────── */}
      {weeklyRecap && !recapDismissed && (() => {
        const ratio   = weeklyRecap.comparedToAvg?.tssRatio ?? null
        const tssColor = ratio == null ? '#555' : ratio >= 1.1 ? GREEN : ratio <= 0.9 ? RED : AMBER
        const tssArrow = ratio == null ? '' : ratio >= 1.05 ? '↑' : ratio <= 0.95 ? '↓' : '→'
        const ctlColor = weeklyRecap.ctlDelta > 0 ? GREEN : weeklyRecap.ctlDelta < 0 ? RED : '#555'
        return (
          <div style={{ ...card, padding: '12px 16px', marginBottom: '14px', borderLeft: `3px solid ${tssColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', letterSpacing: '0.10em' }}>
                ◈ {lang === 'tr' ? 'GEÇEN HAFTA' : 'LAST WEEK'} · {weeklyRecap.weekLabel}
              </div>
              <button onClick={() => { localStorage.setItem(`sporeus-recap-seen-${weeklyRecap.weekLabel}`, '1'); setRecapDismissed(true) }}
                aria-label={lang === 'tr' ? 'Haftalık özeti kapat' : 'Dismiss weekly recap'}
                style={{ cursor: 'pointer', fontFamily: MONO, fontSize: '9px', color: '#333', background: 'transparent', border: 'none', padding: 0, lineHeight: 1 }}>[×]</button>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontFamily: MONO }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: tssColor, lineHeight: 1 }}>{tssArrow} {weeklyRecap.totalTSS}</div>
                <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.06em', marginTop: '2px' }}>TSS{ratio != null ? ` · ${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)}% vs 4wk` : ''}</div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{weeklyRecap.sessions}</div>
                <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.06em', marginTop: '2px' }}>
                  {lang === 'tr' ? 'SEANS' : 'SESSIONS'}{weeklyRecap.comparedToAvg?.sessionRatio != null ? ` · ${weeklyRecap.comparedToAvg.sessionRatio >= 1 ? '+' : ''}${Math.round((weeklyRecap.comparedToAvg.sessionRatio - 1) * 100)}%` : ''}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: ctlColor, lineHeight: 1 }}>{weeklyRecap.ctlDelta >= 0 ? '+' : ''}{weeklyRecap.ctlDelta}</div>
                <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.06em', marginTop: '2px' }}>CTL Δ</div>
              </div>
              {weeklyRecap.dominantType && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, lineHeight: 1, marginTop: '4px' }}>{weeklyRecap.dominantType.toUpperCase()}</div>
                  <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.06em', marginTop: '2px' }}>{lang === 'tr' ? 'BASKN TİP' : 'DOMINANT'}{weeklyRecap.avgRPE ? ` · RPE ${weeklyRecap.avgRPE}` : ''}</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Orientation nudge (disappears once oriented) ──────────────────── */}
      {orientationStep && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#555', marginBottom: '12px' }}>
          <span
            onClick={() => {
              // v9.142.0 — log_wellness routes to today (the current tab),
              // making the click a no-op while the actual "Morning Check-In"
              // button sits right below. Special-case to open the modal
              // directly so the link does what its label promises.
              if (orientationStep === 'log_wellness') {
                setShowCheckIn(true)
                try { localStorage.setItem(`sporeus-oriented-${orientationStep}`, '1') } catch (e) { logger.warn('localStorage:', e.message) }
                setOrientationStep(getOrientationStep(log, profile, recovery))
              } else {
                setTab(ORIENTATION_MESSAGES[orientationStep].tab)
              }
            }}
            style={{ cursor: 'pointer', color: '#0064ff', textDecoration: 'none' }}
          >
            {ORIENTATION_MESSAGES[orientationStep][lang] || ORIENTATION_MESSAGES[orientationStep].en}
          </span>
          {' '}
          <span
            onClick={() => {
              try { localStorage.setItem(`sporeus-oriented-${orientationStep}`, '1') } catch (e) { logger.warn('localStorage:', e.message) }
              setOrientationStep(getOrientationStep(log, profile, recovery))
            }}
            style={{ cursor: 'pointer', color: '#444', fontSize: '9px' }}
          >
            [done]
          </span>
        </div>
      )}

      {/* ── Morning check-in button — G5 ──────────────────────────────────── */}
      {!todayRec && (
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => setShowCheckIn(true)}
            style={{ ...S.btn, fontSize: '11px', padding: '8px 18px', width: '100%' }}
          >
            🌅 {lang === 'tr' ? 'Sabah Hazırlık Girişi' : 'Morning Readiness Check-In'}
          </button>
        </div>
      )}
      {showCheckIn && (
        <Suspense fallback={null}>
          <MorningCheckIn onClose={() => setShowCheckIn(false)} />
        </Suspense>
      )}

      {/* ── HRV 7-day trend strip — H4 ─────────────────────────────────────── */}
      {hrvTrend.daysWithData >= 3 && (() => {
        const TREND_C = { stable: '#5bc25b', warning: '#f5c542', unstable: '#e03030', insufficient_data: '#555' }
        const tc = TREND_C[hrvTrend.trend] || '#555'
        // Build last-7-day HRV bar map
        const hrvMap = {}
        ;(recovery || []).forEach(e => { if (parseFloat(e.hrv) > 0) hrvMap[e.date] = parseFloat(e.hrv) })
        const bars = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setUTCDate(d.getUTCDate() - (6 - i)); return d.toISOString().slice(0, 10)
        }).map(d => ({ date: d, val: hrvMap[d] || 0 }))
        const maxHRV = Math.max(...bars.map(b => b.val), 1)
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 12px', background: 'var(--surface, #0f0f0f)', borderRadius: '3px', borderLeft: `3px solid ${tc}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '22px' }}>
                  {bars.map((b, i) => (
                    <div key={i} style={{ flex: 1, background: b.val > 0 ? tc : '#222', height: `${b.val > 0 ? Math.max(20, Math.round(b.val / maxHRV * 100)) : 20}%`, borderRadius: '1px', opacity: b.val > 0 ? 1 : 0.3 }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <div style={{ fontSize: '9px', color: tc, fontWeight: 700, letterSpacing: '0.06em', fontFamily: "'IBM Plex Mono', monospace" }}>
                  HRV {hrvTrend.trend.replace('_', ' ').toUpperCase()}
                </div>
                <div style={{ fontSize: '9px', color: '#555', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {hrvTrend.latestHRV != null ? `${hrvTrend.latestHRV}ms` : ''}{hrvTrend.baseline && hrvTrend.latestHRV != null ? ` / ${hrvTrend.baseline}ms` : (hrvTrend.baseline ? `${hrvTrend.baseline}ms` : '')}
                  {hrvTrend.daysWithData > 0 ? ` · ${hrvTrend.daysWithData}d` : ''}
                  {hrvTrend.dropPct != null && hrvTrend.dropPct !== 0 ? ` · ${hrvTrend.dropPct > 0 ? '↓' : '↑'}${Math.abs(hrvTrend.dropPct)}%` : ''}
                </div>
              </div>
            </div>
            {hrvTrend.interpretation && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#555', marginTop: '-6px', marginBottom: '10px', lineHeight: 1.5 }}>
                {hrvTrend.interpretation[lang] || hrvTrend.interpretation.en}
              </div>
            )}
          </>
        )
      })()}

      {/* ── M1 — HRV suppression alert (isHRVSuppressed) ───────────────────── */}
      {hrvSuppressed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', background: '#e0303011', border: '1px solid #e0303044', borderRadius: '3px', marginBottom: '10px', fontFamily: MONO }}>
          <span style={{ color: RED, fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>⬇ HRV</span>
          <div style={{ fontSize: '10px', color: RED }}>
            {lang === 'tr' ? 'HRV baskılanmış — yalnızca kolay antrenman. (Plews 2013)' : 'HRV suppressed — easy session only. (Plews 2013)'}
          </div>
        </div>
      )}

      {/* ── Next Action card — G3 rules-based ──────────────────────────────── */}
      <NextActionCard />

      {/* ── Seasonal pattern badge — I5 ────────────────────────────────────── */}
      {seasonal.strongMonths.length > 0 && (() => {
        const isPeak = seasonal.strongMonths.includes(thisMonth)
        const isWeak = seasonal.weakMonths.includes(thisMonth)
        if (!isPeak && !isWeak) return null
        const tc    = isPeak ? GREEN : AMBER
        const label = isPeak
          ? (lang === 'tr' ? 'ZİRVE AY' : 'PEAK MONTH')
          : (lang === 'tr' ? 'DÜŞÜK AY'  : 'OFF-PEAK MONTH')
        return (
          <div style={{ fontFamily: MONO, fontSize: '10px', color: tc, padding: '7px 12px', background: `${tc}11`, border: `1px solid ${tc}33`, borderRadius: '3px', marginBottom: '10px', lineHeight: 1.7 }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.08em' }}>◈ {label}</span>
            <span style={{ color: '#555', marginLeft: '8px' }}>{lang === 'tr' ? seasonal.tr : seasonal.en}</span>
          </div>
        )
      })()}

      {/* ── Morning Brief ─────────────────────────────────────────────────── */}
      {!digest.empty && (() => {
        const yesterdayEntry = (log || []).find(e => e.date === yesterday)
        const timeAdvice     = getTimeOfDayAdvice(new Date().getHours())
        const TIME_ADVICE_TR = {
          'Morning training — HR runs 5–10% lower, perceived effort feels higher than it is.': 'Sabah antrenmanı — KA %5–10 daha düşük çalışır, algılanan efor gerçekten daha yüksek hissettir.',
          'Late morning — body temperature rising, good window for quality work.': 'İlk öğle — vücut ısısı yükseliyor, kaliteli antrenman için iyi pencere.',
          'Midday — peak strength and power output window (Drust et al. 2005).': 'Öğle — güç ve kuvvet çıkışı zirvesi (Drust ve ark. 2005).',
          'Afternoon — reaction time and coordination peak; ideal for technical sessions.': 'Öğleden sonra — reaksiyon süresi ve koordinasyon zirvede; teknik seanslar için ideal.',
          'Evening — allow 2h before sleep after hard sessions to avoid elevated cortisol disrupting recovery.': 'Akşam — zorlu seansı uykudan en az 2 saat önce bitir; yüksek kortizol toparlanmayı bozar.',
        }
        const timeAdviceText = timeAdvice ? (lang === 'tr' ? (TIME_ADVICE_TR[timeAdvice] || timeAdvice) : timeAdvice) : null
        return (
          <div style={{ ...card, borderLeft: `4px solid #333`, padding: '14px 18px' }}>
            <div style={{ ...cardTitle, marginBottom: '8px' }}>
              {lang === 'tr' ? '◈ SABAH ÖZETİ' : '◈ MORNING BRIEF'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-line', fontFamily: MONO }}>
              {digest[lang] || digest.en}
            </div>
            {yesterdayEntry && (
              <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888', marginTop: '6px' }}>
                Yesterday: {yesterdayEntry.tss} TSS {yesterdayEntry.type} · {yesterdayEntry.duration}min
              </div>
            )}
            {/* M5 — Yesterday's session note */}
            {yesterdayEntry?.notes && (
              <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555', marginTop: '4px', fontStyle: 'italic', paddingLeft: '8px', borderLeft: '2px solid #333' }}>
                "{yesterdayEntry.notes}"
              </div>
            )}
            {timeAdviceText && (
              <div style={{ fontFamily: MONO, fontSize: '10px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                {timeAdviceText}
              </div>
            )}
            {/* U4 — PMC dim strip from digest */}
            {!digest.empty && (digest.ctl > 0 || digest.acwr !== null) && (
              <div style={{ fontFamily: MONO, fontSize: '9px', color: '#2a2a2a', marginTop: '4px', letterSpacing: '0.04em' }}>
                {[
                  digest.ctl > 0 ? `CTL ${digest.ctl}` : null,
                  digest.tsb !== undefined && digest.tsb !== null ? `TSB ${digest.tsb >= 0 ? '+' : ''}${digest.tsb}` : null,
                  digest.acwr !== null && digest.acwr !== undefined ? `ACWR ${digest.acwr}` : null,
                ].filter(Boolean).join(' · ')}
              </div>
            )}
            {/* L5 — Goal-context line */}
            {profile?.goal && todayCtl > 0 && (
              <div style={{ fontFamily: MONO, fontSize: '10px', color: '#0064ff', marginTop: '6px', letterSpacing: '0.04em' }}>
                ◈ {lang === 'tr' ? 'HEDEF' : 'GOAL'}: {profile.goal}
                {' · '}CTL {todayCtl}{todayCtl >= 60 ? (lang === 'tr' ? ' — yüksek form' : ' — strong base') : todayCtl >= 35 ? (lang === 'tr' ? ' — gelişiyor' : ' — building') : (lang === 'tr' ? ' — temel dönem' : ' — base phase')}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── N3 — Training pace reference (Daniels VDOT) ─────────────────── */}
      {paceRef && (() => {
        const fmt = s => { const m = Math.floor(s/60); return `${m}:${String(Math.round(s%60)).padStart(2,'0')}` }
        return (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', padding:'7px 12px', background:'var(--surface, #0f0f0f)', borderRadius:'3px', marginBottom:'10px', fontFamily: MONO, alignItems:'center' }}>
            <span style={{ fontSize:'9px', color:'#555', letterSpacing:'0.08em', marginRight:'2px' }}>VO₂max {profile?.vo2max} · /km</span>
            {[['EASY', paceRef.easy, GREEN], ['THRESH', paceRef.threshold, AMBER], ['INT', paceRef.interval, RED]].map(([label, val, color]) => (
              <span key={label} style={{ fontSize:'10px', color, border:`1px solid ${color}33`, borderRadius:'3px', padding:'2px 7px' }}>
                {label} {fmt(val)}
              </span>
            ))}
          </div>
        )
      })()}

      {/* ── v9.108.0 (Prompt PP) — Race-week banner. When raceDate is
          within 7 days, surface a holistic "RACE WEEK" framing above the
          numeric countdown. Days remaining drive which prep items light
          up. Emits race_week_entered once per raceDate (gated on
          localStorage key) — telemetry for the funnel "did the athlete
          actually engage with race-week mode before their event?". */}
      {raceCountdown && raceCountdown.days >= 0 && raceCountdown.days <= 7 && (() => {
        const d = raceCountdown.days
        const items = [
          { key: 'taper',    label: lang === 'tr' ? 'Konik (volüm −41%, yoğunluk korunur)' : 'Taper (−41% volume, keep intensity)', when: d >= 0,
            cite: 'Bosquet 2007' },
          { key: 'sleep',    label: lang === 'tr' ? 'Uyku önceliği — 8+ saat hedefi'        : 'Sleep priority — target 8+ hrs',     when: d >= 0,
            cite: 'Mah 2011' },
          { key: 'hydrate',  label: lang === 'tr' ? 'Sıvı + elektrolit (özellikle son 72s)' : 'Hydration + electrolytes (last 72h)', when: d <= 3,
            cite: 'Sawka 2007' },
          { key: 'carbs',    label: lang === 'tr' ? 'Karbonhidrat yükle (7–12 g/kg, son 36–48 saat)' : 'Carb-load (7–12 g/kg, 36–48h pre)', when: d <= 2,
            cite: 'Burke 2017' },
          { key: 'gear',     label: lang === 'tr' ? 'Donanım kontrol — pin, ayakkabı, GPS, çorap' : 'Gear check — bib, shoes, GPS, socks', when: d <= 1,
            cite: '' },
          { key: 'shakeout', label: lang === 'tr' ? '20 dk gevşek + 3×30s yarış temposu'    : '20min easy + 3×30s race-pace strides', when: d === 1,
            cite: '' },
        ]
        const active = items.filter(i => i.when)
        return (
          <div style={{
            marginBottom: '12px', padding: '12px 16px',
            background: '#ff66001a', border: '1px solid #ff660066',
            borderLeft: '4px solid #ff6600', borderRadius: '5px',
            fontFamily: MONO,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
                {d === 0 ? (lang === 'tr' ? '◆ YARIŞ GÜNÜ' : '◆ RACE DAY')
                 : (lang === 'tr' ? `◆ YARIŞ HAFTASI · ${d} GÜN` : `◆ RACE WEEK · ${d} DAYS`)}
              </span>
              <span style={{ fontSize: '10px', color: '#888' }}>{raceCountdown.rd}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {active.map(it => (
                <div key={it.key} style={{ fontSize: '11px', color: '#ccc', lineHeight: 1.5 }}>
                  <span style={{ color: '#5bc25b', marginRight: '6px' }}>□</span>
                  {it.label}
                  {it.cite && <span style={{ color: '#666', fontStyle: 'italic', marginLeft: '6px' }}>· {it.cite}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── L2 — Race countdown ──────────────────────────────────────────── */}
      {raceCountdown && (() => {
        const phaseColor = raceCountdown.days <= 7 ? ORANGE : raceCountdown.days <= 14 ? AMBER : BLUE
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', background: `${phaseColor}11`, border: `1px solid ${phaseColor}44`, borderRadius: '3px', marginBottom: '10px', fontFamily: MONO }}>
            <div style={{ textAlign: 'center', minWidth: '36px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: phaseColor, lineHeight: 1 }}>{raceCountdown.days}</div>
              <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.08em' }}>{lang === 'tr' ? 'GÜN' : 'DAYS'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: phaseColor, letterSpacing: '0.08em' }}>
                {raceCountdown.days === 0 ? raceCountdown.phase : `${lang === 'tr' ? 'YARIŞA' : 'TO RACE'} · ${raceCountdown.phase}`}
              </div>
              <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{raceCountdown.rd}</div>
            </div>
          </div>
        )
      })()}

      {/* ── K3 — 7-day TSS load strip (computeMonotony) ──────────────────── */}
      {weekLoad.weekTSS > 0 && (() => {
        const maxTSS = Math.max(...weekLoad.dailyTSS, 1)
        const days   = ['M','T','W','T','F','S','S']
        const today  = new Date().getDay()
        const todayIdx = today === 0 ? 6 : today - 1
        const STATUS_C = { low: '#5bc25b', moderate: '#f5c542', high: '#e03030', insufficient: '#555' }
        const sc = STATUS_C[weekLoad.status] || '#555'
        return (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', padding: '8px 12px', background: 'var(--surface, #0f0f0f)', borderRadius: '3px', marginBottom: '10px', borderLeft: `3px solid ${sc}` }}>
            {weekLoad.dailyTSS.map((tss, i) => {
              const h = tss > 0 ? Math.max(6, Math.round(tss / maxTSS * 32)) : 3
              const isToday = i === todayIdx
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: '100%', height: `${h}px`, background: isToday ? '#ff6600' : tss > 0 ? '#0064ff88' : '#1a1a1a', borderRadius: '2px' }} />
                  <div style={{ fontFamily: MONO, fontSize: '8px', color: isToday ? '#ff6600' : '#333' }}>{days[i]}</div>
                </div>
              )
            })}
            <div style={{ marginLeft: '8px', minWidth: '56px' }}>
              <div style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: sc }}>{weekLoad.weekTSS}</div>
              <div style={{ fontFamily: MONO, fontSize: '8px', color: '#333', letterSpacing: '0.06em' }}>WEEK TSS</div>
              {weekLoad.monotony !== null && (
                <div style={{ fontFamily: MONO, fontSize: '8px', color: sc, marginTop: '2px' }}>
                  M {weekLoad.monotony.toFixed(1)}
                </div>
              )}
              {/* V4 — getMonotonyWarning action note (Foster 2001) */}
              {monoWarn.flag && (
                <div style={{ fontFamily: MONO, fontSize: '7px', color: '#f5c542', marginTop: '3px', lineHeight: 1.4 }}>
                  {lang === 'tr' ? monoWarn.actionTr : monoWarn.action}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── V1 — getLoadTrendAlert: >10% week-on-week TSS spike ──────────── */}
      {loadAlert.flag && weekLoad.weekTSS > 0 && (
        <div style={{ padding: '7px 12px', background: '#f5c54211', borderLeft: '3px solid #f5c542', borderRadius: '3px', marginBottom: '10px', fontFamily: MONO }}>
          <div style={{ fontSize: '9px', color: '#f5c542', letterSpacing: '0.06em', marginBottom: '2px' }}>↑ {lang === 'tr' ? 'YÜK ARTIŞI' : 'LOAD SPIKE'}</div>
          <div style={{ fontSize: '10px', color: 'var(--sub)' }}>{lang === 'tr' ? loadAlert.tr : loadAlert.message}</div>
          <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>{lang === 'tr' ? loadAlert.actionTr : loadAlert.action}</div>
        </div>
      )}

      {/* ── V3 — getMissedRestWarning: ≥6 consecutive training days ──────── */}
      {missedRestWarn.flag && (
        <Banner
          severity="critical"
          title={lang === 'tr' ? 'DİNLENME GÜNÜ GECİKMİŞ' : 'REST DAY OVERDUE'}
          lang={lang}
          actions={!todayLogEntry && (
            <button
              onClick={() => {
                setLog([...(log || []), {
                  date: today,
                  type: 'Rest',
                  duration: 0,
                  tss: 0,
                  restDayMarked: true,
                  correctiveRest: true,
                  id: `${today}-corrective-rest-${Date.now()}`,
                }])
                try { emitEvent('missed_rest_action', { consecutive_days: consecutiveDays }) } catch { /* fail open */ }
              }}
              style={btn('#e03030')}
            >
              {lang === 'tr' ? '↓ DİNLENME GÜNÜNÜ İŞARETLE' : '↓ MARK REST DAY'}
            </button>
          )}
        >
          <div>{lang === 'tr' ? missedRestWarn.tr : missedRestWarn.message}</div>
          <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
            {lang === 'tr' ? missedRestWarn.actionTr : missedRestWarn.action}
          </div>
        </Banner>
      )}

      {/* ── L1 — predictFitness compact forecast ─────────────────────────── */}
      {fitnessForecast && (() => {
        const TRAJ_COLOR = { improving: GREEN, declining: RED, stable: AMBER, flat: '#555' }
        const TRAJ_ARROW = { improving: '↑', declining: '↓', stable: '→', flat: '—' }
        const tc = TRAJ_COLOR[fitnessForecast.trajectory] || '#555'
        const ar = TRAJ_ARROW[fitnessForecast.trajectory] || '—'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 12px', background: 'var(--surface, #0f0f0f)', borderLeft: `3px solid ${tc}`, borderRadius: '3px', marginBottom: '10px', fontFamily: MONO }}>
            <div style={{ fontSize: '18px', color: tc, fontWeight: 700, lineHeight: 1 }}>{ar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', color: '#555', letterSpacing: '0.06em' }}>CTL {lang === 'tr' ? 'ŞİMDİ' : 'NOW'}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{fitnessForecast.current}</span>
                <span style={{ fontSize: '9px', color: '#555' }}>→ 4W</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: tc }}>{fitnessForecast.in4w}</span>
                <span style={{ fontSize: '9px', color: '#555' }}>8W</span>
                <span style={{ fontSize: '11px', color: '#666' }}>{fitnessForecast.in8w}</span>
                {fitnessForecast.avgWeeklyTSS > 0 && <>
                  <span style={{ fontSize: '9px', color: '#2a2a2a' }}>·</span>
                  <span style={{ fontSize: '9px', color: '#2a2a2a' }}>{lang === 'tr' ? `ORT ${fitnessForecast.avgWeeklyTSS} TSS/HFT` : `AVG ${fitnessForecast.avgWeeklyTSS} TSS/WK`}</span>
                </>}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '3px', letterSpacing: '0.03em' }}>
                {lang === 'tr' ? fitnessForecast.label?.tr : fitnessForecast.label?.en}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Consecutive rest day warning ──────────────────────────────────── */}
      {(() => {
        const { ctl } = calcLoad(log || [])
        const last3 = [-1, -2, -3].map(n => {
          const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
        })
        const hasRestDays = last3.every(d => !(log || []).find(e => e.date === d))
        if (ctl > 40 && hasRestDays) {
          return (
            <div style={{ ...card, borderLeft: '3px solid #f5c542', padding: '12px 18px' }}>
              <div style={{ fontFamily: MONO, fontSize: '11px', color: '#f5c542', lineHeight: 1.6 }}>
                {lang === 'tr' ? '3 dinlenme günü — KTY günlük ~%2,3 düşüyor. Kısa bir aktivasyon seansı düşün.' : '3 rest days — CTL decaying at ~2.3% per day. Consider a short activation session.'}
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* ── Coach message unread badge ────────────────────────────────────── */}
      {coachUnread > 0 && (
        <div style={{
          ...card, borderLeft: `4px solid #0064ff`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>✉</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: '#0064ff' }}>
              {coachUnread} {coachUnread > 1 ? t('todayCoachMsgs') : t('todayCoachMsg')}
            </span>
          </div>
          <button
            onClick={() => setCoachUnread(0)}
            style={S.ghostBtn}
          >
            {t('todayDismiss')}
          </button>
        </div>
      )}

      {/* ── E66 — Quick readiness check-in (shown only when no entry for today) ── */}
      {todayReadiness == null && !quickReadinessSaved && (
        <div style={{ ...card, borderLeft: '3px solid #f5c542', padding: '12px 16px' }}>
          <div style={{ fontFamily: MONO, fontSize: '9px', color: '#666', letterSpacing: '0.10em', marginBottom: '10px' }}>
            {lang === 'tr' ? 'BUGÜN NASIL HİSSEDİYORSUN?' : 'HOW DO YOU FEEL TODAY?'}
          </div>
          {quickReadinessLogged ? (
            <div style={{ fontFamily: MONO, fontSize: '11px', color: GREEN }}>Logged ✓</div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { emoji: '😴', labelEN: 'Tired',  labelTR: 'Yorgun', value: 25 },
                { emoji: '😐', labelEN: 'Okay',   labelTR: 'Tamam',  value: 60 },
                { emoji: '⚡', labelEN: 'Ready',  labelTR: 'Hazır',  value: 90 },
              ].map(({ emoji, labelEN, labelTR, value }) => (
                <button
                  key={value}
                  onClick={() => handleQuickReadiness(value)}
                  style={{
                    fontFamily: MONO, fontSize: '10px', fontWeight: 600,
                    padding: '8px 12px', borderRadius: '5px', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1,
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{emoji}</span>
                  <span style={{ fontSize: '9px', letterSpacing: '0.06em' }}>
                    {lang === 'tr' ? labelTR : labelEN}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Today's Signal tile (v9.104.0 — Prompt EE) ──
          v9.149.0: Moved above Card 1 (per v9.144 critique). When there
          IS a planned session AND the wellness-derived
          buildDailyRecommendation disagrees by 2+ RPE, surface the
          alternative as a compact transparency tile. NOT an auto-swap
          (v9.102 handles low-readiness swaps via downgradeRec) — just
          shows "if we built today's session from your readiness only,
          here's what it would be". Helps athletes learn what the system
          sees. Suppressed when downgradeRec is already on screen (the
          full v9.102 card supersedes this advisory). */}
      {plannedSession && !downgradeRec && (() => {
        const rec = buildDailyRecommendation({ log, recovery, profile, lang })
        if (!rec) return null
        const plannedRpe = Number(plannedSession.rpe) || 0
        const recRpe = Number(rec.rpe) || 0
        if (Math.abs(plannedRpe - recRpe) < 2) return null
        const direction = recRpe < plannedRpe ? 'easier' : 'harder'
        const arrow = direction === 'easier' ? '↓' : '↑'
        const dotColor = direction === 'easier' ? AMBER : '#0064ff'
        return (
          <div style={{
            marginBottom: '14px',
            padding: '8px 12px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${dotColor}`, borderRadius: '4px',
            fontFamily: MONO, fontSize: '11px', color: '#aaa', lineHeight: 1.55,
          }}>
            <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.08em', marginBottom: '4px' }}>
              {arrow} {lang === 'tr' ? 'BUGÜNÜN SİNYALİ · ŞEFFAFLIK' : "TODAY'S SIGNAL · TRANSPARENCY"}
            </div>
            <div style={{ color: '#ccc' }}>
              {lang === 'tr'
                ? `Hazırlık verin şunu öneriyor: `
                : `Your wellness data suggests: `}
              <span style={{ color: dotColor, fontWeight: 700 }}>{rec.type}</span>
              <span style={{ color: '#888' }}> · {rec.duration}min · RPE {rec.rpe}</span>
              <span style={{ color: '#666' }}>
                {' '}({lang === 'tr' ? 'planlanan' : 'planned'} RPE {plannedRpe})
              </span>
            </div>
            <div style={{ color: '#888', fontSize: '10px', marginTop: '3px' }}>
              {rec.rationale}
            </div>
          </div>
        )
      })()}

      {/* ── Card 1: Today's Session ────────────────────────────────────────── */}
      <div style={{ ...card, borderLeft: `4px solid ${plannedSession && todayStatus === 'done' ? GREEN : ORANGE}` }}>
        <div style={cardTitle}>{t('todaySession')}</div>

        {plannedSession ? (
          <>
            {/* E66 — Low readiness warning banner */}
            {todayReadiness != null && todayReadiness < 50 && (
              <div style={{
                padding: '7px 10px', marginBottom: '12px',
                background: '#f5c54218', border: '1px solid #f5c54266',
                borderRadius: '4px', fontFamily: MONO, fontSize: '10px', color: '#f5c542',
                lineHeight: 1.5,
              }}>
                {lang === 'tr'
                  ? `⚠ Hazırlık DÜŞÜK (${todayReadiness}/100) — bugün %20 daha az yoğunluk dene`
                  : `⚠ Readiness LOW (${todayReadiness}/100) — consider -20% intensity today`}
              </div>
            )}
            {/* v9.84.0 — Positive readiness signal. Previously athletes saw only
                a negative banner when score < 50. With this, a "go signal"
                surfaces when readiness ≥75 so the athlete opens the app and
                immediately sees green = train as planned. */}
            {todayReadiness != null && todayReadiness >= 75 && todayStatus !== 'done' && (
              <div style={{
                padding: '6px 10px', marginBottom: '12px',
                background: '#5bc25b18', border: '1px solid #5bc25b55',
                borderRadius: '4px', fontFamily: MONO, fontSize: '10px', color: '#5bc25b',
                lineHeight: 1.5,
              }}>
                {lang === 'tr'
                  ? `✓ Hazırlık iyi (${todayReadiness}/100) — planlandığı gibi antrene ol`
                  : `✓ Readiness good (${todayReadiness}/100) — train as planned`}
              </div>
            )}
            {/* v9.85.0 — Race-week alignment flag. When the athlete is inside
                a 7-day race-week window and today's planned session is hard
                (RPE ≥7 OR threshold/VO2/tempo/intervals), surface a taper
                warning. Calendar-based — independent of HRV/TSB fatigue
                signals (which are covered by sessionSwapFlag below). Hard
                work this close to race day defeats the taper; either
                downgrade or confirm intent. */}
            {raceCountdown && raceCountdown.days > 0 && raceCountdown.days <= 7 && isHardToday && (
              <div role="alert" style={{
                padding: '8px 10px', marginBottom: '12px',
                background: '#ff660018', border: '1px solid #ff660066',
                borderRadius: '4px', fontFamily: MONO, fontSize: '10px', color: '#ff6600',
                lineHeight: 1.55,
              }}>
                <div style={{ fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>
                  {lang === 'tr'
                    ? `⚠ YARIŞA ${raceCountdown.days} GÜN — TAPER İHLALİ`
                    : `⚠ RACE IN ${raceCountdown.days}d — TAPER CONFLICT`}
                </div>
                <div>
                  {lang === 'tr'
                    ? 'Bugünkü sert antrenman taperı bozabilir. Kolay seansa geç ya da süreyi yarıya indir.'
                    : "Today's hard session may compromise your taper. Downgrade to easy or halve the duration."}
                </div>
                <div style={{ color: '#888', marginTop: '4px', fontSize: '9px' }}>
                  Bosquet 2007 (meta-analysis: 2-week taper, intensity preserved, volume −41%)
                </div>
                {/* v9.141.0 — Action CTA. Bosquet 2007 protocol is volume cut,
                    intensity preserved — so halve duration, keep RPE. Same
                    evidence-action pairing v9.139/140 introduced. Hidden when
                    today is already logged. */}
                {!todayLogEntry && (
                  <button
                    onClick={() => {
                      const halved = Math.max(20, Math.floor((plannedSession.duration || 60) / 2))
                      setLogPrefill({
                        type: plannedSession.type,
                        duration: halved,
                        rpe: plannedSession.rpe || 6,
                        date: today,
                      })
                      try {
                        emitEvent('taper_conflict_action', {
                          days_to_race:   raceCountdown.days,
                          planned_type:   plannedSession.type,
                          planned_duration: plannedSession.duration,
                          halved_duration:  halved,
                        })
                      } catch { /* fail open */ }
                      setTab('log')
                    }}
                    style={{ ...btn('#ff6600'), marginTop: '8px' }}
                  >
                    {lang === 'tr' ? '↓ SÜREYİ YARIYA İNDİR (YOĞUNLUK KORUNUR)' : '↓ HALVE DURATION (INTENSITY PRESERVED)'}
                  </button>
                )}
              </div>
            )}
            {/* v9.56.0 — HRV/TSB-flagged session-swap recommendation. Fires
                only when today's planned session is hard AND objective
                signals (hrv_drift / tsb_deep / injury_risk_high) suggest the
                athlete shouldn't push. Cites the rule's source (Plews 2013
                for HRV, Banister 1991 for TSB, Hulin 2016 for injury risk). */}
            {sessionSwapFlag && (
              <div role="alert" style={{
                padding: '8px 10px', marginBottom: '12px',
                background: '#e0303018', border: '1px solid #e0303066',
                borderRadius: '4px', fontFamily: MONO, fontSize: '10px', color: '#ff6a6a',
                lineHeight: 1.55,
              }}>
                <div style={{ fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>
                  {lang === 'tr' ? '⚠ KOLAY GÜNE GEÇ' : '⚠ DOWNGRADE TO EASY'}
                </div>
                <div>{sessionSwapFlag.rationale?.[lang] || sessionSwapFlag.rationale?.en}</div>
                <div style={{ color: '#888', marginTop: '4px', fontSize: '9px' }}>
                  {sessionSwapFlag.citation}
                </div>
              </div>
            )}
            {/* v9.102.0 (Prompt T) — Auto-downgraded session card. Renders
                only when isHardToday AND (readiness<50 OR sessionSwapFlag).
                Replaces the planned hard render; original tucks under
                disclosure below so the athlete can still see / log it. */}
            {downgradeRec && !showOriginalSession && (
              <div style={{
                marginBottom: '12px', padding: '10px 12px',
                background: '#5bc25b0c', border: '1px solid #5bc25b44',
                borderLeft: '4px solid #5bc25b', borderRadius: '4px',
              }}>
                <div style={{
                  fontFamily: MONO, fontSize: '9px', color: '#5bc25b',
                  fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px',
                }}>
                  {lang === 'tr' ? '✓ OTOMATIK İNDİRGEME · KANIT TEMELLİ' : '✓ AUTO-DOWNGRADED · EVIDENCE-BASED'}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
                    {downgradeRec.type}
                  </span>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    {downgradeRec.duration} min · {downgradeRec.zone} · RPE {downgradeRec.rpe}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#ccc', lineHeight: 1.55, marginBottom: '8px' }}>
                  {downgradeRec.rationale}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setLogPrefill({ type: downgradeRec.type, duration: downgradeRec.duration, rpe: downgradeRec.rpe, date: today })
                      emitEvent('session_downgrade_logged', {
                        from_rpe: plannedSession.rpe || null,
                        to_rpe:   downgradeRec.rpe,
                        source:   downgradeRec.source,
                      })
                      setTab('log')
                    }}
                    style={btn('#5bc25b')}>
                    {lang === 'tr' ? '↓ İNDİRGENMİŞ SEANSI LOGLA' : '↓ LOG DOWNGRADED SESSION'}
                  </button>
                  <button
                    onClick={() => {
                      setShowOriginalSession(true)
                      try {
                        emitEvent('downgrade_overridden', {
                          planned_type:  plannedSession.type,
                          planned_rpe:   plannedSession.rpe || null,
                          suggested_rpe: downgradeRec.rpe || null,
                          readiness:     todayReadiness ?? null,
                          trigger:       sessionSwapFlag ? 'swap_flag' : 'low_readiness',
                          source:        downgradeRec.source || null,
                        })
                      } catch { /* fail open */ }
                    }}
                    style={btn('transparent', '#888')}>
                    {lang === 'tr' ? 'PLANLANAN SEANSI GÖR' : 'SEE PLANNED SESSION'}
                  </button>
                </div>
              </div>
            )}
            {(!downgradeRec || showOriginalSession) && (<>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
                {plannedSession.type}
              </span>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {plannedSession.duration} min
                {plannedSession.rpe ? ` · RPE ${plannedSession.rpe}` : ''}
              </span>
            </div>
            {/* v9.84.0 — Phase + week progress (v9.146 collapsed by default) */}
            {showSessionDetails && (plannedSession.weekPhase || plannedSession.weekIdx != null) && (
              <div style={{ fontSize: '10px', color: '#0064ff', marginBottom: '8px', letterSpacing: '0.06em' }}>
                {plannedSession.weekPhase && <span style={{ fontWeight: 700 }}>📍 {plannedSession.weekPhase}</span>}
                {plannedSession.weekIdx != null && plan?.weeks?.length > 0 && (
                  <span style={{ color: '#888', fontWeight: 400 }}>
                    {plannedSession.weekPhase ? ' · ' : '📍 '}
                    {lang === 'tr' ? 'Hafta' : 'Week'} {plannedSession.weekIdx + 1}/{plan.weeks.length}
                  </span>
                )}
              </div>
            )}
            {/* v9.107.0 (Prompt NN) — Deload-active context tile (v9.146 collapsed by default) */}
            {showSessionDetails && plan?.weeks?.[plannedSession.weekIdx]?.sessions?.some(s => s?._deloaded) && (
              <div style={{
                fontSize: '10px', color: '#5bc25b', marginBottom: '10px',
                padding: '6px 10px', borderLeft: '3px solid #5bc25b',
                background: 'rgba(91,194,91,0.06)', lineHeight: 1.55,
              }}>
                <div style={{ fontWeight: 700, letterSpacing: '0.05em', marginBottom: '3px' }}>
                  ↓ {lang === 'tr' ? 'YÜK İNDİRME AKTİF · −%20 TSS' : 'DELOAD ACTIVE · −20% TSS'}
                </div>
                <div style={{ color: '#aaa', fontSize: '10px' }}>
                  {lang === 'tr'
                    ? 'Bu hafta uyum açığı tespit edildiği için yük azaltıldı. Hafif hisset — kondisyonu korur, uygulamayı düzeltir.'
                    : 'Load was eased this week after a compliance gap was detected. Should feel light — preserves fitness while restoring execution.'}
                </div>
                <Citation text="Mujika 2003 (taper compliance — small load cuts in the −20% range preserve fitness)" />
              </div>
            )}
            {/* v9.84.0 — Pace target + zone breakdown. Critical Mission 1 data
                the athlete needs to actually execute the session: what pace,
                which zones. Previously these were either buried in a
                separate card or omitted entirely. Conditional render —
                shown only when the plan provides this data.
                v9.91.0 — Derive pace/power from profile.threshold + profile.ftp
                when the plan doesn't carry an explicit paceTarget. The main
                Plan generator emits sessions without paceTarget; only the
                elite-program path sets it. Now both paths feed the strip. */}
            {(() => {
              const derived       = deriveSessionTargets(plannedSession, profile)
              const paceDisplay   = plannedSession.paceTarget || derived.paceTarget
              const powerDisplay  = derived.powerTarget
              const hasPaceField  = paceDisplay || plannedSession.hrTarget || powerDisplay
              const hasZoneField  = plannedSession.zones && Object.values(plannedSession.zones).some(v => v > 0)
              if (!hasPaceField && !hasZoneField) return null
              return (
              <div style={{
                display: 'flex', gap: '14px', flexWrap: 'wrap',
                fontSize: '10px', color: '#aaa',
                padding: '8px 10px', marginBottom: '10px',
                background: 'rgba(255,102,0,0.04)', border: '1px solid #ff660033', borderRadius: '4px',
                fontFamily: MONO, letterSpacing: '0.04em',
              }}>
                {paceDisplay && (
                  <span>
                    <span style={{ color: '#666' }}>{lang === 'tr' ? 'TEMPO' : 'PACE'} · </span>
                    <span style={{ color: '#ff6600', fontWeight: 700 }}>{paceDisplay}</span>
                    {!plannedSession.paceTarget && derived.paceTarget && (
                      <span style={{ color: '#444', fontSize: '8px', marginLeft: '4px' }}>
                        ({lang === 'tr' ? 'eşikten' : 'from threshold'})
                      </span>
                    )}
                  </span>
                )}
                {powerDisplay && (
                  <span>
                    <span style={{ color: '#666' }}>{lang === 'tr' ? 'GÜÇ' : 'POWER'} · </span>
                    <span style={{ color: '#ff6600', fontWeight: 700 }}>{powerDisplay}</span>
                    <span style={{ color: '#444', fontSize: '8px', marginLeft: '4px' }}>
                      ({lang === 'tr' ? 'FTP\'den' : 'from FTP'})
                    </span>
                  </span>
                )}
                {plannedSession.hrTarget && (
                  <span>
                    <span style={{ color: '#666' }}>KA · </span>
                    <span style={{ color: '#ff6600', fontWeight: 700 }}>{plannedSession.hrTarget}</span>
                  </span>
                )}
                {hasZoneField && (
                  <span>
                    <span style={{ color: '#666' }}>{lang === 'tr' ? 'BÖLGELER' : 'ZONES'} · </span>
                    {Object.entries(plannedSession.zones)
                      .filter(([, v]) => v > 0)
                      .map(([z, v]) => (
                        <span key={z} style={{ color: '#ccc', marginRight: '6px' }}>
                          {z} <span style={{ color: '#666' }}>{v}m</span>
                        </span>
                      ))
                    }
                  </span>
                )}
              </div>
              )
            })()}
            {/* v9.146 — Description paragraph collapsed by default */}
            {showSessionDetails && plannedSession.description && (
              <p style={{ fontSize: '11px', color: '#888', lineHeight: 1.55, marginBottom: '12px' }}>
                {plannedSession.description}
              </p>
            )}
            {/* v9.88.0 — Session structure breakdown (v9.146 collapsed by default) */}
            {showSessionDetails && (() => {
              const struct = deriveSessionStructure(plannedSession)
              if (!struct) return null
              const [wu, rep, cd] = struct.blocks
              return (
                <div style={{
                  fontSize: '10px', color: '#aaa',
                  padding: '8px 10px', marginBottom: '12px',
                  background: 'rgba(0,100,255,0.04)', border: '1px solid #0064ff33', borderRadius: '4px',
                  fontFamily: MONO, lineHeight: 1.5,
                }}>
                  <div style={{ color: '#666', fontSize: '9px', letterSpacing: '0.08em', marginBottom: '4px' }}>
                    {lang === 'tr' ? '◇ YAPI' : '◇ STRUCTURE'}
                  </div>
                  <div>
                    <span style={{ color: '#ccc' }}>{wu.durationMin}{lang === 'tr' ? ' dk ' : 'min '}</span>
                    <span style={{ color: '#666' }}>{wu.label[lang] || wu.label.en}</span>
                    <span style={{ color: '#444' }}>{' + '}</span>
                    <span style={{ color: '#0064ff', fontWeight: 700 }}>
                      {rep.count}×{rep.durationMin}{lang === 'tr' ? ' dk' : 'min'}
                    </span>
                    <span style={{ color: '#666' }}> @{rep.zone} {rep.label[lang] || rep.label.en}</span>
                    {rep.recoveryMin > 0 && (
                      <span style={{ color: '#666' }}>
                        {' ('}
                        <span style={{ color: '#888' }}>
                          {rep.recoveryMin}{lang === 'tr' ? ' dk toparlanma' : 'min recovery'}
                        </span>
                        {')'}
                      </span>
                    )}
                    {cd.durationMin > 0 && (
                      <>
                        <span style={{ color: '#444' }}>{' + '}</span>
                        <span style={{ color: '#ccc' }}>{cd.durationMin}{lang === 'tr' ? ' dk ' : 'min '}</span>
                        <span style={{ color: '#666' }}>{cd.label[lang] || cd.label.en}</span>
                      </>
                    )}
                  </div>
                  {struct.estimate && (
                    <div style={{ color: '#444', fontSize: '8px', marginTop: '3px', letterSpacing: '0.04em' }}>
                      {lang === 'tr' ? 'tahmini yapı' : 'estimated structure'}
                    </div>
                  )}
                </div>
              )
            })()}
            {/* v9.85.0 — Fueling guidance for long sessions. Activates at the
                90-minute mark (Burke 2017: glycogen depletion becomes
                performance-limiting beyond ~75-90 min at moderate+ intensity).
                Bike-specific threshold lower (~75 min) since carb-burn rate
                is higher per minute. Cycling sport-detection via primarySport
                or session type containing 'bike'/'ride'. */}
            {(() => {
              const dur = Number(plannedSession.duration || 0)
              const sport = String(profile?.primarySport || '').toLowerCase()
              const typeStr = String(plannedSession.type || '').toLowerCase()
              const isCycling = sport.includes('cycl') || sport.includes('bike') || /bike|cycl|ride/.test(typeStr)
              const cutoff = isCycling ? 75 : 90
              if (dur < cutoff) return null
              const veryLong = dur >= 150
              return (
                <div style={{
                  fontSize: '10px', color: '#5bc25b', marginBottom: '12px',
                  padding: '6px 10px', borderLeft: '3px solid #5bc25b',
                  background: 'rgba(91,194,91,0.06)', lineHeight: 1.55,
                }}>
                  <div style={{ fontWeight: 700, letterSpacing: '0.05em', marginBottom: '3px' }}>
                    {lang === 'tr' ? '◆ BESLENME · ' : '◆ FUELING · '}
                    {dur}{lang === 'tr' ? ' dk' : ' min'}
                  </div>
                  <div style={{ color: '#aaa' }}>
                    {lang === 'tr'
                      ? `${veryLong ? '60-90' : '30-60'}g KH/saat, 30. dakikadan itibaren her 20-30 dk al. 500-750ml sıvı/saat (sıcakta 1L+). Uzun antrenmanda elektrolit ekle.`
                      : `${veryLong ? '60-90' : '30-60'}g CHO/hr starting at min 30, every 20-30 min. Fluid 500-750ml/hr (1L+ in heat). Electrolytes on long sessions.`}
                  </div>
                  <div style={{ color: '#666', marginTop: '2px', fontSize: '9px' }}>
                    Burke 2017 · Jeukendrup 2014
                  </div>
                </div>
              )
            })()}
            {/* v9.84.0 — Coach/programmed session notes (cue, focus, safety).
                Previously these were stored in the plan but never rendered.
                Shown as a yellow-rule sidebar so they read like a coach's
                pre-session callout. Bilingual via notes.{en,tr}. */}
            {plannedSession.notes && (plannedSession.notes.en || plannedSession.notes.tr || typeof plannedSession.notes === 'string') && (
              <div style={{
                fontSize: '11px', color: '#f5c542', marginBottom: '12px',
                padding: '6px 10px', borderLeft: '3px solid #f5c542',
                background: 'rgba(245,197,66,0.06)', lineHeight: 1.55,
                fontStyle: 'italic',
              }}>
                {typeof plannedSession.notes === 'string'
                  ? plannedSession.notes
                  : (plannedSession.notes[lang] || plannedSession.notes.en || plannedSession.notes.tr)}
              </div>
            )}
            {todayStatus === 'done' ? (
              <span style={badge(GREEN)}>✓ {t('todayDone')}</span>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={logThisSession} style={btn(ORANGE)}>{t('todayLogThis')}</button>
                  <button onClick={markDone} style={btn('transparent', '#888')}
                    onMouseOver={e => e.currentTarget.style.color = '#ccc'}
                    onMouseOut={e  => e.currentTarget.style.color = '#888'}>
                    {t('todayMarkDone')}
                  </button>
                </div>
                {/* v9.152.0 — Improvised-session shortcut (Prompt 10). The
                    session card assumes plan adherence; if the athlete
                    swapped (strength when run was planned), they used to
                    navigate to Log and start from scratch. Now one click
                    opens Log with `improvisedSession: true` indicated so
                    the saved entry carries the off-plan signal for
                    adherence-aware analysis. */}
                <button
                  type="button"
                  onClick={() => {
                    setLogPrefill({
                      date: today,
                      improvisedSession: true,
                      plannedType: plannedSession?.type || null,
                    })
                    setTab('log')
                  }}
                  style={{
                    marginTop: '8px', padding: '4px 8px', fontFamily: MONO,
                    fontSize: '9px', color: '#888', background: 'transparent',
                    border: 'none', borderBottom: '1px dotted #555',
                    cursor: 'pointer', letterSpacing: '0.04em',
                  }}
                >
                  {lang === 'tr' ? 'Başka bir şey yaptım →' : 'I trained something else →'}
                </button>
              </>
            )}
            {/* v9.121.0 — Plan rationale disclosure. Surfaces the factors
                driving today's prescription (phase, yesterday's load,
                TSB, sleep). Renders only when at least one factor fires
                — empty rationale stays hidden so the disclosure never
                shows a blank panel. Inside the (!downgradeRec ||
                showOriginalSession) gate so it only appears for the
                original session, not the auto-downgrade card (which
                has its own inline rationale). */}
            {(() => {
              const rationale = explainPlannedSession({
                session: plannedSession, log, recovery, profile, today,
              })
              if (!rationale.hasContent) return null
              return (
                <details style={{
                  marginTop: '10px', padding: '6px 10px',
                  background: 'rgba(0,100,255,0.04)', border: '1px solid #0064ff33',
                  borderRadius: '4px',
                }}>
                  <summary style={{
                    fontFamily: MONO, fontSize: '10px', color: '#6699ff',
                    letterSpacing: '0.06em', cursor: 'pointer', userSelect: 'none',
                  }}>
                    ▼ {lang === 'tr' ? 'BU SEANS NEDEN?' : 'WHY THIS SESSION'}
                    <span style={{ color: '#888', marginLeft: '8px' }}>· {rationale.factors.length}</span>
                  </summary>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rationale.factors.map(f => (
                      <div key={f.key} style={{ fontFamily: MONO, fontSize: '10px', lineHeight: 1.5 }}>
                        <span style={{ color: '#0064ff', fontWeight: 700 }}>
                          {(f.label?.[lang] || f.label?.en)}
                        </span>
                        <span style={{ color: '#aaa', marginLeft: '6px' }}>
                          — {(f.detail?.[lang] || f.detail?.en)}
                        </span>
                        {f.citation && (
                          <div style={{ color: '#666', fontSize: '9px', fontStyle: 'italic', marginLeft: '0', marginTop: '2px' }}>
                            {f.citation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )
            })()}
            </>)}
            {/* v9.89.0 — Execution snapshot. After today's session is logged,
                compare logged values vs planned to surface the duration / RPE
                / TSS deltas. Pure additive — renders only when both a plan
                and a log entry exist for today. Status thresholds: on-target
                = duration within ±15% AND RPE within ±1; over = >115% OR
                RPE+1; under = <85% (but ≥50%); incomplete = <50%. */}
            {sessionExecution && (
              <div style={{
                marginTop: '10px', padding: '8px 10px',
                fontSize: '10px', color: '#aaa', lineHeight: 1.55,
                background: `${EXECUTION_STATUS_COLOR[sessionExecution.status]}14`,
                border: `1px solid ${EXECUTION_STATUS_COLOR[sessionExecution.status]}55`,
                borderRadius: '4px',
                fontFamily: MONO, letterSpacing: '0.04em',
              }}>
                <div style={{
                  color: EXECUTION_STATUS_COLOR[sessionExecution.status],
                  fontWeight: 700, fontSize: '9px', letterSpacing: '0.08em', marginBottom: '4px',
                }}>
                  {lang === 'tr' ? '◆ İCRA · ' : '◆ EXECUTION · '}
                  {(EXECUTION_STATUS_LABEL[sessionExecution.status][lang] || EXECUTION_STATUS_LABEL[sessionExecution.status].en).toUpperCase()}
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span>
                    <span style={{ color: '#666' }}>{lang === 'tr' ? 'SÜRE · ' : 'DUR · '}</span>
                    <span style={{ color: '#ccc', fontWeight: 700 }}>{sessionExecution.duration.logged}m</span>
                    <span style={{ color: '#666' }}>{lang === 'tr' ? ' / plan ' : ' / plan '}{sessionExecution.duration.planned}m</span>
                    <span style={{ color: sessionExecution.duration.deltaMin === 0 ? '#888' : sessionExecution.duration.deltaMin > 0 ? '#f5c542' : '#888', marginLeft: '4px' }}>
                      ({sessionExecution.duration.deltaMin > 0 ? '+' : ''}{sessionExecution.duration.deltaMin})
                    </span>
                  </span>
                  {sessionExecution.rpe && (
                    <span>
                      <span style={{ color: '#666' }}>RPE · </span>
                      <span style={{ color: '#ccc', fontWeight: 700 }}>{sessionExecution.rpe.logged}</span>
                      <span style={{ color: '#666' }}>{lang === 'tr' ? ' / plan ' : ' / plan '}{sessionExecution.rpe.planned}</span>
                      {sessionExecution.rpe.delta !== 0 && (
                        <span style={{ color: Math.abs(sessionExecution.rpe.delta) >= 2 ? '#f5c542' : '#888', marginLeft: '4px' }}>
                          ({sessionExecution.rpe.delta > 0 ? '+' : ''}{sessionExecution.rpe.delta})
                        </span>
                      )}
                    </span>
                  )}
                  {sessionExecution.tss && (
                    <span>
                      <span style={{ color: '#666' }}>TSS · </span>
                      <span style={{ color: '#ccc', fontWeight: 700 }}>{sessionExecution.tss.logged}</span>
                      <span style={{ color: '#666' }}>{lang === 'tr' ? ' / plan ' : ' / plan '}{sessionExecution.tss.planned}</span>
                      {sessionExecution.tss.delta !== 0 && (
                        <span style={{ color: Math.abs(sessionExecution.tss.deltaPct) >= 0.20 ? '#f5c542' : '#888', marginLeft: '4px' }}>
                          ({sessionExecution.tss.delta > 0 ? '+' : ''}{sessionExecution.tss.delta})
                        </span>
                      )}
                    </span>
                  )}
                  {/* v9.153.0 (Prompt 8) — HR delta. Surfaces only when both
                      the plan carries hrTarget AND the log entry has avgHR
                      (typically FIT import or detailed manual entry). */}
                  {sessionExecution.hr && (
                    <span>
                      <span style={{ color: '#666' }}>HR · </span>
                      <span style={{ color: '#ccc', fontWeight: 700 }}>{sessionExecution.hr.logged}</span>
                      <span style={{ color: '#666' }}>
                        {lang === 'tr' ? ' / plan ' : ' / plan '}
                        {sessionExecution.hr.plannedRange
                          ? `${sessionExecution.hr.plannedRange[0]}-${sessionExecution.hr.plannedRange[1]}`
                          : sessionExecution.hr.planned}
                      </span>
                      {sessionExecution.hr.status !== 'in-range' && (
                        <span style={{ color: '#f5c542', marginLeft: '4px' }}>
                          ({sessionExecution.hr.gap > 0 ? '+' : ''}{sessionExecution.hr.gap})
                        </span>
                      )}
                    </span>
                  )}
                  {/* v9.153.0 (Prompt 8) — Pace delta. mm:ss/km display. */}
                  {sessionExecution.pace && (() => {
                    const fmt = sec => {
                      const m = Math.floor(sec / 60)
                      const s = Math.round(sec % 60)
                      return `${m}:${String(s).padStart(2, '0')}`
                    }
                    return (
                      <span>
                        <span style={{ color: '#666' }}>{lang === 'tr' ? 'TEMPO · ' : 'PACE · '}</span>
                        <span style={{ color: '#ccc', fontWeight: 700 }}>{fmt(sessionExecution.pace.logged)}</span>
                        <span style={{ color: '#666' }}>{lang === 'tr' ? ' / plan ' : ' / plan '}{fmt(sessionExecution.pace.planned)}</span>
                        {sessionExecution.pace.status !== 'on-target' && (
                          <span style={{ color: '#f5c542', marginLeft: '4px' }}>
                            ({sessionExecution.pace.delta > 0 ? '+' : ''}{sessionExecution.pace.delta}s)
                          </span>
                        )}
                      </span>
                    )
                  })()}
                </div>
                {/* v9.140.0 — Next-action implication. Converts the delta
                    numbers above into adherence guidance: over → keep
                    tomorrow easy; under/incomplete → stay on plan. Null
                    for on-target (the green status is its own affirmation). */}
                {(() => {
                  const imp = getExecutionImplication(sessionExecution)
                  if (!imp) return null
                  return (
                    <div style={{
                      marginTop: '6px', paddingTop: '6px',
                      borderTop: '1px dashed var(--border)',
                      fontSize: '10px', color: '#ccc', lineHeight: 1.55, letterSpacing: 'normal',
                    }}>
                      <span style={{ color: EXECUTION_STATUS_COLOR[sessionExecution.status] }}>→ </span>
                      {imp[lang] || imp.en}
                      {imp.citation && (
                        <div style={{ color: '#666', fontSize: '9px', fontStyle: 'italic', marginTop: '2px' }}>
                          {imp.citation}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
            {/* v9.85.0 — Tomorrow preview (v9.146 collapsed by default) */}
            {showSessionDetails && tomorrowSession && (() => {
              // v9.109.0 (Prompt YY): session-type-specific prep hints.
              // Built from the same hard/long/threshold heuristic the rest
              // of TodayView uses (rpe>=7 OR keyword match) so hints stay
              // consistent across cards.
              const t = String(tomorrowSession.type || '').toLowerCase()
              const dur = Number(tomorrowSession.duration) || 0
              const rpe = Number(tomorrowSession.rpe) || 0
              const hints = []
              const isLong   = dur >= 90 || /long|endurance/i.test(t)
              const isHard   = rpe >= 7 || /interval|threshold|vo2|tempo|race.?pace/i.test(t)
              const isEarly  = /am|morning/i.test(t)
              if (isLong) {
                hints.push(lang === 'tr'
                  ? 'Akşam karbonhidrat yükle · sabah erken alarm · cebine jel'
                  : 'Carb-load tonight · early alarm · gels in pocket')
              }
              if (isHard) {
                hints.push(lang === 'tr'
                  ? 'Ayakkabı + GPS hazır · ısınma için 15 dk ayır · uyku önceliği'
                  : 'Shoes + GPS ready · 15min for warm-up · prioritize sleep')
              }
              if (isEarly) {
                hints.push(lang === 'tr' ? 'Antrenman kıyafetlerini gece hazırla' : 'Lay out kit tonight')
              }
              return (
                <div style={{
                  marginTop: '12px', paddingTop: '8px',
                  borderTop: '1px dashed var(--border)',
                  fontSize: '10px', color: '#888', letterSpacing: '0.04em',
                  fontFamily: MONO,
                }}>
                  <div>
                    <span style={{ color: '#666' }}>{lang === 'tr' ? 'YARIN · ' : 'TOMORROW · '}</span>
                    <span style={{ color: '#ccc', fontWeight: 700 }}>{tomorrowSession.type}</span>
                    <span style={{ color: '#666' }}>
                      {' · '}{tomorrowSession.duration} min
                      {tomorrowSession.rpe ? ` · RPE ${tomorrowSession.rpe}` : ''}
                    </span>
                  </div>
                  {hints.length > 0 && (
                    <div style={{ marginTop: '4px', color: '#999', lineHeight: 1.5, letterSpacing: 'normal' }}>
                      {hints.map((h, i) => (
                        <div key={i} style={{ paddingLeft: '8px' }}>
                          <span style={{ color: '#5bc25b' }}>→ </span>{h}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
            {/* v9.57.0 — Substitution / contingency guide (always available,
                collapsed). Pre-fix the rich illness + life-event + travel
                guidance in eliteProgramSubstitutions.js never surfaced — the
                athlete on a sick day saw their planned session and no advice
                on what to do instead. Now expandable, sport-aware via
                buildContingencyMap. Cites Friman & Wesslen, Bompa, Halson. */}
            {(() => {
              const cont = buildContingencyMap({ sport: profile?.primarySport || 'run' })
              return (
                <details style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                  <summary style={{ ...{ fontFamily: MONO }, fontSize: '10px', color: '#888', cursor: 'pointer', letterSpacing: '0.06em' }}>
                    {lang === 'tr' ? '◈ HASTA / BOZULDU MU? — KILAVUZ' : "◈ SICK / DISRUPTED TODAY? — GUIDE"}
                  </summary>
                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#aaa', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: '#ccc', marginBottom: '4px' }}>
                      {cont.illness.title[lang] || cont.illness.title.en}
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ color: '#5bc25b' }}>↑ </span>{cont.illness.aboveNeck[lang] || cont.illness.aboveNeck.en}
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ color: '#e03030' }}>↓ </span>{cont.illness.belowNeck[lang] || cont.illness.belowNeck.en}
                    </div>
                    {/* v9.139.0 — Action CTAs. Until now the contingency guide
                        explained "above-neck: reduce intensity, below-neck:
                        rest" but offered no path to log it. Matches the
                        evidence-action pairing in v9.102 auto-downgrade
                        (rationale + LOG button) so sick-day adherence is one
                        click, not three (open log tab + invent reduced
                        session + submit). Hidden when today is already
                        logged so the buttons don't propose a duplicate. */}
                    {!todayLogEntry && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '8px' }}>
                        <button
                          onClick={() => {
                            const reducedDuration = Math.max(20, Math.floor((plannedSession.duration || 60) / 2))
                            setLogPrefill({ type: 'Easy', duration: reducedDuration, rpe: 3, date: today })
                            try { emitEvent('sick_day_action', { severity: 'above_neck', planned_type: plannedSession.type, reduced_duration: reducedDuration }) } catch { /* fail open */ }
                            setTab('log')
                          }}
                          style={btn('#5bc25b')}
                        >
                          {lang === 'tr' ? '↑ HAFİF SEANS LOGLA' : '↑ LOG REDUCED SESSION'}
                        </button>
                        <button
                          onClick={() => {
                            setLog([...(log || []), {
                              date: today,
                              type: 'Rest',
                              duration: 0,
                              tss: 0,
                              restDayMarked: true,
                              sickDay: true,
                              id: `${today}-sick-${Date.now()}`,
                            }])
                            try { emitEvent('sick_day_action', { severity: 'below_neck', planned_type: plannedSession.type }) } catch { /* fail open */ }
                          }}
                          style={btn('transparent', '#e03030')}
                        >
                          {lang === 'tr' ? '↓ HASTA DİNLENME GÜNÜ' : '↓ MARK SICK REST DAY'}
                        </button>
                      </div>
                    )}
                    <div style={{ fontWeight: 700, color: '#ccc', marginTop: '10px', marginBottom: '4px' }}>
                      {cont.lifeEvent.title[lang] || cont.lifeEvent.title.en}
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#888' }}>2-3d: </span>{cont.lifeEvent.twoToThreeDays[lang] || cont.lifeEvent.twoToThreeDays.en}
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#888' }}>4-7d: </span>{cont.lifeEvent.fourToSevenDays[lang] || cont.lifeEvent.fourToSevenDays.en}
                    </div>
                    <Citation text={`${cont.illness.citation} · ${cont.lifeEvent.citation}`} />
                  </div>
                </details>
              )
            })()}
            {/* v9.146.0 — Session-details toggle. Reveals 5 collapsed sub-banners
                (phase+week, deload tile, description, structure breakdown,
                tomorrow preview) all at once. Spec: Prompt 2 from v9.144
                critique. Hidden when the auto-downgrade card is active and
                the original session is suppressed, since there are no details
                to reveal for the downgrade flow. */}
            {(!downgradeRec || showOriginalSession) && (
              <button
                onClick={() => setShowSessionDetails(v => !v)}
                style={{
                  display: 'block', width: '100%', marginTop: '10px',
                  padding: '6px 10px', fontFamily: MONO, fontSize: '10px',
                  color: '#888', letterSpacing: '0.06em',
                  background: 'transparent', border: '1px dashed var(--border)',
                  borderRadius: '4px', cursor: 'pointer', textAlign: 'center',
                }}
                aria-expanded={showSessionDetails}
              >
                {showSessionDetails
                  ? (lang === 'tr' ? '▲ DETAYLARI GİZLE' : '▲ HIDE DETAILS')
                  : (lang === 'tr' ? '▼ DETAYLARI GÖSTER (faz, yapı, yarın…)' : '▼ SHOW DETAILS (phase, structure, tomorrow…)')}
              </button>
            )}
          </>
        ) : (
          <div style={{ color: '#555', fontSize: '12px', lineHeight: 1.6 }}>
            {plan
              ? (() => {
                  // v9.111.0 (Prompt EEE) — Rest-day equivalence. When today
                  // is a planned rest, athletes used to see only an AMBER
                  // banner. They had to either skip logging (which broke
                  // their streak) or invent a fake activity. Now they can
                  // explicitly acknowledge the rest day: tss=0 + restDayMarked
                  // gets counted as a streak-preserving day by
                  // computeTrainingStreak. Periodization mandates rest;
                  // habit-tracking shouldn't punish following the plan.
                  const restEntry = (log || []).find(e =>
                    e.date === today && (Number(e.tss) === 0 || !e.tss) && e.restDayMarked === true
                  )
                  const markRest = () => {
                    setLog([...(log || []), {
                      date: today,
                      type: 'Rest',
                      duration: 0,
                      tss: 0,
                      restDayMarked: true,
                      id: `${today}-rest-${Date.now()}`,
                    }])
                    emitEvent('rest_day_marked', { date: today })
                  }
                  return (
                    <>
                      <div style={{ color: AMBER, marginBottom: '10px' }}>◆ {t('todayRest')}</div>
                      {restEntry ? (() => {
                        // v9.150.0 — Rest-type affirmation (Prompt 7).
                        // Discriminate by flag: sick (v9.139), corrective
                        // (v9.144), or planned (v9.111 + this default).
                        // Color + copy vary by type so the affirmation
                        // matches the choice the athlete made.
                        const restType = restEntry.sickDay
                          ? 'sick'
                          : restEntry.correctiveRest
                          ? 'corrective'
                          : 'planned'
                        const restMeta = {
                          planned: {
                            color: GREEN,
                            en: '✓ Rest as planned — recovery is part of the program. Streak preserved.',
                            tr: '✓ Plana göre dinlenme — toparlanma programın parçası. Seri korunuyor.',
                          },
                          sick: {
                            color: AMBER,
                            en: '✓ Sick day logged — listen to your body. Streak preserved, no penalty.',
                            tr: '✓ Hastalık günü kaydedildi — bedenini dinle. Seri korunuyor, ceza yok.',
                          },
                          corrective: {
                            color: AMBER,
                            en: '✓ Rest after 6+ consecutive training days — smart move. Streak preserved.',
                            tr: '✓ 6+ ardışık antrenmandan sonra dinlenme — akıllıca. Seri korunuyor.',
                          },
                        }[restType]
                        return (
                          <div style={{ fontSize: '11px', color: restMeta.color, fontFamily: MONO, letterSpacing: '0.04em', lineHeight: 1.5 }}>
                            {lang === 'tr' ? restMeta.tr : restMeta.en}
                          </div>
                        )
                      })() : (
                        <>
                          <button onClick={markRest} style={btn('#5bc25b')}>
                            {lang === 'tr' ? '✓ DİNLENME GÜNÜNÜ İŞARETLE' : '✓ MARK REST DAY'}
                          </button>
                          <div style={{ fontSize: '9px', color: '#888', marginTop: '6px', lineHeight: 1.5 }}>
                            {lang === 'tr'
                              ? 'Planlı dinlenme günü serini koruyacak.'
                              : 'Planned rest will keep your streak intact.'}
                          </div>
                        </>
                      )}
                    </>
                  )
                })()
              : (() => {
                  // v9.93.0 — Mission 1 Prompt C: plan-less athletes used to see
                  // only "No plan active — generate one." Now they get a real
                  // recommendation derived from wellness/ACWR/TSB (getSingleSuggestion)
                  // shaped into a session via sport-aware labels + pace/power.
                  const rec = buildDailyRecommendation({ log, recovery, profile, lang })
                  if (!rec) {
                    return (
                      <>
                        <div style={{ color: '#555', marginBottom: '10px' }}>{t('todayNoPlan')}</div>
                        <button onClick={() => setTab('plan')} style={btn(ORANGE)}>{t('t_plan')} →</button>
                      </>
                    )
                  }
                  const derived = deriveSessionTargets({ zone: rec.zone, type: rec.type }, profile)
                  const isRest = rec.load === 'none' || rec.duration === 0
                  const loadColor =
                    rec.load === 'hard' ? '#e03030'
                    : rec.load === 'moderate' ? '#f5c542'
                    : rec.load === 'easy' ? '#5bc25b'
                    : '#888'
                  return (
                    <>
                      <div style={{
                        fontSize: '9px', letterSpacing: '0.12em', color: '#666',
                        textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700,
                      }}>
                        {lang === 'tr' ? 'PLAN YOK · TAVSİYE' : 'NO PLAN · RECOMMENDED TODAY'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#ccc' }}>{rec.type}</span>
                        {!isRest && (
                          <span style={{ fontSize: '11px', color: '#888' }}>
                            {rec.duration}min · RPE {rec.rpe} · {rec.zone}
                          </span>
                        )}
                        {isRest && (
                          <span style={{ fontSize: '11px', color: AMBER, fontWeight: 700 }}>
                            {lang === 'tr' ? 'DİNLENME' : 'REST'}
                          </span>
                        )}
                      </div>
                      {!isRest && (derived.paceTarget || derived.powerTarget) && (
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', letterSpacing: '0.04em' }}>
                          {derived.paceTarget && (
                            <>
                              <span style={{ color: '#666' }}>{lang === 'tr' ? 'TEMPO · ' : 'PACE · '}</span>
                              <span style={{ color: '#5bc25b', fontWeight: 700 }}>{derived.paceTarget}</span>
                              <span style={{ color: '#666', fontSize: '9px', marginLeft: '4px' }}>
                                {lang === 'tr' ? '(eşikten)' : '(from threshold)'}
                              </span>
                            </>
                          )}
                          {derived.powerTarget && (
                            <>
                              <span style={{ color: '#666' }}>{'POWER · '}</span>
                              <span style={{ color: '#5bc25b', fontWeight: 700 }}>{derived.powerTarget}</span>
                              <span style={{ color: '#666', fontSize: '9px', marginLeft: '4px' }}>
                                {lang === 'tr' ? '(FTP\'den)' : '(from FTP)'}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <div style={{
                        fontSize: '10px', color: '#888', marginBottom: '12px',
                        padding: '6px 8px', borderLeft: `2px solid ${loadColor}`,
                        background: `${loadColor}0c`, lineHeight: 1.5,
                      }}>
                        {rec.rationale}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {!isRest && (
                          <button
                            onClick={() => {
                              setLogPrefill({ type: rec.type, duration: rec.duration, rpe: rec.rpe, date: today })
                              setTab('log')
                            }}
                            style={btn(ORANGE)}
                          >
                            {lang === 'tr' ? 'BUNU KAYDET →' : 'LOG THIS →'}
                          </button>
                        )}
                        <button onClick={() => setTab('plan')} style={btn('transparent', '#888')}>
                          {lang === 'tr' ? 'PLAN OLUŞTUR' : 'GENERATE PLAN'}
                        </button>
                      </div>
                    </>
                  )
                })()
            }
          </div>
        )}
      </div>

      {/* ── Card 1z: Goal-Activity Mismatch (v9.104.0 — Prompt DD) ──
          The most upstream Mission 1 diagnostic. Fires when the rolling
          28d log is dominated by a sport that isn't the goal sport AND
          the goal sport itself is being neglected.
          v9.110.0 (Prompt AAA): only renders as a full card when
          mismatch wins the priority ranking. Otherwise it appears in
          the "▼ N more diagnostics" disclosure under the top card. */}
      {diagnosticTop?.top?.key === 'goal-mismatch' && (() => {
        const mismatch = detectGoalActivityMismatch(profile, log, { today })
        if (!mismatch.mismatched) return null
        return (
          <div style={{ ...card, borderLeft: `4px solid ${RED}` }}>
            <div style={cardTitle}>
              {lang === 'tr' ? 'HEDEF ≠ ANTRENMAN' : 'GOAL ≠ TRAINING'}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {lang === 'tr' ? 'Hedef' : 'Goal'}:
                <span style={{ color: '#ccc', fontWeight: 700, marginLeft: '4px' }}>
                  {String(mismatch.goalSport).toUpperCase()}
                </span>
              </span>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {lang === 'tr' ? 'Loglanan' : 'Logged'}:
                <span style={{ color: RED, fontWeight: 700, marginLeft: '4px' }}>
                  {String(mismatch.dominantSport).toUpperCase()} {Math.round(mismatch.dominantShare * 100)}%
                </span>
              </span>
              <span style={{ fontSize: '10px', color: '#666' }}>
                {mismatch.sessionsInWindow} {lang === 'tr' ? 'seans / 28 gün' : 'sessions / 28d'}
              </span>
            </div>
            <div style={{
              fontSize: '11px', color: '#ccc', lineHeight: 1.55, marginBottom: '10px',
              padding: '8px 10px', background: `${RED}0c`, borderLeft: `2px solid ${RED}`,
            }}>
              {mismatch.recommendation[lang] || mismatch.recommendation.en}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  emitEvent('goal_activity_mismatch_shown', {
                    goal_sport:     mismatch.goalSport,
                    dominant_sport: mismatch.dominantSport,
                    dominant_share: mismatch.dominantShare,
                    cta:            'update_goal',
                  })
                  setTab('profile')
                  // Defer scroll until Profile mounts
                  setTimeout(() => {
                    const el = document.getElementById('goal-editor')
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 200)
                }}
                style={btn(ORANGE)}>
                ↻ {lang === 'tr' ? 'HEDEFİ GÜNCELLE' : 'UPDATE GOAL'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Card 1a: Stale Plan Detector (v9.103.0 — Prompt AA) ──
          computePlanDrift only sees execution drift. A plan that's 8+
          weeks old or whose seedCTL has been left behind by current
          fitness still says "on-track" while every prescribed target is
          wrong in absolute terms. This card surfaces that.
          v9.110.0 (Prompt AAA): gated by priority ranking. */}
      {plan && diagnosticTop?.top?.key === 'stale-plan' && (() => {
        const stale = detectStalePlan(plan, todayCtl, today)
        if (!stale?.stale) return null
        return (
          <div style={{ ...card, borderLeft: `4px solid ${AMBER}` }}>
            <div style={cardTitle}>
              {lang === 'tr' ? 'PLAN BAYAT ·  YENİDEN KALİBRE ET' : 'PLAN AGE WARNING · RECALIBRATE'}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {lang === 'tr' ? `Plan yaşı: ${Math.round(stale.ageDays / 7)} hafta` : `Plan age: ${Math.round(stale.ageDays / 7)} weeks`}
              </span>
              {stale.seedCTL != null && (
                <span style={{ fontSize: '11px', color: '#888' }}>
                  {lang === 'tr' ? `Seed CTL: ${stale.seedCTL}  → bugün: ${Math.round(todayCtl)}` : `Seed CTL: ${stale.seedCTL}  → today: ${Math.round(todayCtl)}`}
                </span>
              )}
              {stale.ctlDriftPct != null && (
                <span style={{ fontSize: '11px', color: AMBER, fontWeight: 700 }}>
                  Δ {Math.round(stale.ctlDriftPct * 100)}%
                </span>
              )}
            </div>
            <div style={{
              fontSize: '11px', color: '#ccc', lineHeight: 1.55, marginBottom: '10px',
              padding: '8px 10px', background: `${AMBER}0c`, borderLeft: `2px solid ${AMBER}`,
            }}>
              {stale.recommendation[lang] || stale.recommendation.en}
            </div>
            <button
              onClick={() => {
                const remainingWeeks = (() => {
                  const startISO = String(plan.generatedAt || '').slice(0, 10)
                  if (!startISO || !Array.isArray(plan.weeks)) return 12
                  const elapsed = Math.floor(
                    (new Date(today + 'T12:00:00Z') - new Date(startISO + 'T12:00:00Z')) / 86400000
                  )
                  const remaining = plan.weeks.length - Math.floor(elapsed / 7)
                  return Math.max(4, Math.min(52, remaining))
                })()
                const seedData = {
                  goal:         profile?.goal || plan?.goal || 'General Fitness',
                  sport:        profile?.primarySport || profile?.sport || null,
                  primarySport: profile?.primarySport || profile?.sport || null,
                  athleteLevel: profile?.athleteLevel || profile?.level || 'intermediate',
                  trainDays:    Number(profile?.trainDays) || 5,
                  weeks:        remainingWeeks,
                  raceDate:     profile?.raceDate || profile?.nextRaceDate || undefined,
                }
                const next = buildStarterPlan(seedData, today, lang, log)
                if (!next) { setTab('plan'); return }
                try {
                  recordPlanVersion(next, 'recalibrate', stale.reason)
                  localStorage.setItem('sporeus-plan', JSON.stringify(next))
                  emitEvent('plan_recalibrated_age', {
                    reason:       stale.reason,
                    age_days:     stale.ageDays,
                    ctl_drift_pct: stale.ctlDriftPct,
                    seed_ctl:     stale.seedCTL,
                    new_ctl:      Math.round(todayCtl),
                    weeks:        next.weeks?.length || 0,
                    version_tag:  next.versionTag,
                  })
                  window.location.reload()
                } catch (e) {
                  logger.warn('plan recalibrate failed:', e?.message)
                  setTab('plan')
                }
              }}
              style={btn(AMBER)}>
              {lang === 'tr' ? '↻ YENİDEN KALİBRE ET' : '↻ RECALIBRATE PLAN'}
            </button>
          </div>
        )
      })()}

      {/* ── Card 1b: Weekly Adaptation (v9.94.0 — Mission 1 EXECUTION → ADAPTATION) ──
          v9.110.0 (Prompt AAA): gated by priority ranking. */}
      {plan && diagnosticTop?.top?.key === 'plan-drift' && (() => {
        const drift = computePlanDrift(plan, log, today)
        if (!drift || drift.status === 'pending') return null
        const statusColor =
          drift.status === 'drift'    ? RED
          : drift.status === 'under'  ? AMBER
          : drift.status === 'over'   ? AMBER
          : drift.status === 'on-track' ? GREEN
          : '#888'
        const pctLabel = `${Math.round(drift.avgPct * 100)}%`
        return (
          <div style={{ ...card, borderLeft: `4px solid ${statusColor}` }}>
            <div style={cardTitle}>
              {lang === 'tr' ? 'HAFTALIK ADAPTASYON' : 'WEEKLY ADAPTATION'}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: statusColor }}>{pctLabel}</span>
              <span style={{ fontSize: '10px', color: '#888', letterSpacing: '0.06em' }}>
                {lang === 'tr'
                  ? `${drift.weeksAnalyzed} HAFTA · PLAN UYUMU`
                  : `${drift.weeksAnalyzed} WEEKS · PLAN COMPLIANCE`}
              </span>
            </div>
            <div style={{
              fontSize: '11px', color: '#ccc', lineHeight: 1.55, marginBottom: '10px',
              padding: '8px 10px', background: `${statusColor}0c`,
              borderLeft: `2px solid ${statusColor}`,
            }}>
              {drift.recommendation[lang] || drift.recommendation.en}
            </div>
            {drift.citation && (
              <div style={{ fontSize: '9px', color: '#666', fontStyle: 'italic', marginBottom: '10px' }}>
                {drift.citation}
              </div>
            )}
            {/* Per-week sparkline: each completed week as a colored cell */}
            {drift.weeks.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {drift.weeks.map(w => {
                  const c =
                    w.status === 'missed'   ? RED
                    : w.status === 'under'  ? AMBER
                    : w.status === 'over'   ? AMBER
                    : w.status === 'on-track' ? GREEN
                    : '#333'
                  return (
                    <div key={w.weekIdx}
                      title={`W${w.weekIdx + 1}: ${w.actualTSS}/${w.plannedTSS} TSS (${Math.round(w.pct * 100)}%)`}
                      style={{
                        flex: '1 0 28px', minWidth: '28px', height: '18px',
                        background: c + '33', border: `1px solid ${c}66`,
                        borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '8px', color: c, fontWeight: 700,
                      }}
                    >
                      W{w.weekIdx + 1}
                    </div>
                  )
                })}
              </div>
            )}
            {/* v9.102.0 (Prompt U) — Soft taper button. When drift says
                "reduce-next" (avg 30-70% compliance), scale next week's TSS
                by 0.8 in place instead of forcing the athlete to a full
                regenerate or accept the over-aggressive load. Mujika 2003
                taper-compliance evidence: small load cuts preserve fitness
                while restoring execution. */}
            {drift.action === 'reduce-next' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    if (!plan || !Array.isArray(plan.weeks)) return
                    const startISO = String(plan.generatedAt || '').slice(0, 10)
                    if (!startISO) return
                    const days = Math.floor(
                      (new Date(today + 'T12:00:00Z') - new Date(startISO + 'T12:00:00Z')) / 86400000
                    )
                    const currentWeekIdx = Math.max(0, Math.floor(days / 7))
                    const nextWeekIdx = currentWeekIdx + 1
                    if (nextWeekIdx >= plan.weeks.length) return
                    const updated = { ...plan, weeks: plan.weeks.map((wk, i) => {
                      if (i !== nextWeekIdx) return wk
                      return {
                        ...wk,
                        sessions: (Array.isArray(wk.sessions) ? wk.sessions : []).map(s => {
                          const t = Number(s.tss) || 0
                          return t > 0
                            ? { ...s, tss: Math.round(t * 0.8), _deloaded: true }
                            : s
                        }),
                      }
                    })}
                    try {
                      recordPlanVersion(updated, 'deload', `w${nextWeekIdx + 1}`)
                      localStorage.setItem('sporeus-plan', JSON.stringify(updated))
                      emitEvent('plan_deload_applied', {
                        from_pct:        drift.avgPct,
                        week_idx:        nextWeekIdx,
                        scaling:         0.8,
                        version_tag:     updated.versionTag,
                      })
                      window.location.reload()
                    } catch (e) {
                      logger.warn('plan deload failed:', e?.message)
                    }
                  }}
                  style={btn(AMBER)}
                >
                  {lang === 'tr' ? '↓ SONRAKİ HAFTAYI %20 AZALT' : '↓ REDUCE NEXT WEEK BY 20%'}
                </button>
              </div>
            )}
            {drift.action === 'regenerate' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* v9.101.0 (Prompt S) — One-click in-place regenerate. Was:
                    navigate to PLAN tab + user manually clicks GENERATE. Now:
                    rebuild the plan from current log-anchored CTL (v9.97
                    smart-CTL seed) and overwrite localStorage. The user stays
                    on TODAY and the drift card collapses next render. */}
                <button
                  onClick={() => {
                    // Reconstruct onboarding-shape data from current profile
                    // and the existing plan's parameters.
                    const seedData = {
                      goal:         profile?.goal || plan?.goal || 'General Fitness',
                      sport:        profile?.primarySport || profile?.sport || null,
                      primarySport: profile?.primarySport || profile?.sport || null,
                      athleteLevel: profile?.athleteLevel || profile?.level || 'intermediate',
                      trainDays:    Number(profile?.trainDays) || 5,
                      weeks:        Array.isArray(plan?.weeks) ? plan.weeks.length : 12,
                      raceDate:     profile?.raceDate || profile?.nextRaceDate || undefined,
                    }
                    const next = buildStarterPlan(seedData, today, lang, log)
                    if (!next) {
                      // Fall back to legacy nav if the rebuild can't succeed
                      setTab('plan')
                      return
                    }
                    try {
                      recordPlanVersion(next, 'regen')
                      localStorage.setItem('sporeus-plan', JSON.stringify(next))
                      emitEvent('plan_regenerated_from_drift', {
                        from_action: drift.action,
                        from_pct:    drift.avgPct,
                        weeks:       next.weeks?.length || 0,
                        version_tag: next.versionTag,
                      })
                      // Force a remount so TodayView's useLocalStorage picks
                      // up the new plan. Reload is the simplest reliable path.
                      window.location.reload()
                    } catch (e) {
                      logger.warn('plan regenerate failed:', e?.message)
                      setTab('plan')
                    }
                  }}
                  style={btn(ORANGE)}
                >
                  {lang === 'tr' ? '↻ MEVCUT KONDISYONDAN YENİDEN OLUŞTUR' : '↻ REGENERATE FROM CURRENT FITNESS'}
                </button>
                <button
                  onClick={() => setTab('plan')}
                  style={btn('transparent', '#888')}
                >
                  {lang === 'tr' ? 'PLAN SEKMESİNE GİT' : 'OPEN PLAN TAB'}
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Card 2: Readiness Quick-Check ─────────────────────────────────── */}
      <div style={{ ...card, borderLeft: `4px solid ${todayRec ? (todayRec.score >= 75 ? GREEN : todayRec.score >= 50 ? AMBER : RED) : '#333'}` }}>
        <div style={cardTitle}>{t('todayReadiness')}</div>

        {/* v9.122.0 — 7d-vs-prior-7d wellness trend banner. Surfaces
            patterns the individual day inputs don't reveal — "sleep
            declining all week" matters more than today's number alone.
            Renders only when at least one field is concerning (low avg
            or steep delta in the worsening direction). The existing
            14d sparkline below shows lines; this banner shows insight. */}
        {(() => {
          const trend = analyzeWellnessTrend(recovery, today)
          if (!trend.anyConcerning) return null
          const concerns = trend.fields.filter(f => f.concerning)
          const LABELS = {
            sleep:    { en: 'Sleep',    tr: 'Uyku' },
            energy:   { en: 'Energy',   tr: 'Enerji' },
            soreness: { en: 'Soreness', tr: 'Ağrı' },
          }
          const REASONS = {
            'avg-low':    { en: '7d avg low',     tr: '7g ort. düşük' },
            'avg-high':   { en: '7d avg elevated',tr: '7g ort. yüksek' },
            'declining':  { en: 'declining',      tr: 'düşüyor' },
            'rising':     { en: 'rising',         tr: 'yükseliyor' },
          }
          return (
            <div role="status" aria-live="polite" style={{
              marginBottom: '12px', padding: '8px 10px',
              background: '#f5c54214', border: '1px solid #f5c54266',
              borderLeft: '3px solid #f5c542', borderRadius: '4px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: '9px', color: '#f5c542', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>
                ↓ {lang === 'tr' ? 'HAFTA İÇİ EĞİLİM' : 'WEEK-OVER-WEEK TREND'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {concerns.map(f => {
                  const lbl = LABELS[f.key]?.[lang] || LABELS[f.key]?.en
                  const rzn = REASONS[f.reason]?.[lang] || REASONS[f.reason]?.en || ''
                  const sign = f.delta > 0 ? '+' : ''
                  const deltaPart = f.delta != null
                    ? ` · Δ ${sign}${f.delta.toFixed(1)} vs ${lang === 'tr' ? 'önceki 7g' : 'prior 7d'}`
                    : ''
                  return (
                    <div key={f.key} style={{ fontFamily: MONO, fontSize: '10px', color: 'var(--text)' }}>
                      <span style={{ fontWeight: 700 }}>{lbl}</span>
                      <span style={{ color: '#aaa' }}> — {rzn}{deltaPart}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {todayRec ? (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '36px', fontWeight: 700, color: todayRec.score >= 75 ? GREEN : todayRec.score >= 50 ? AMBER : RED }}>
              {wellnessSaved && scoreDisplay > 0 ? scoreDisplay : todayRec.score}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888' }}>{t('readScoreTitle')} / 100</div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                {todayRec.score >= 75 ? t('goLabel') : todayRec.score >= 50 ? t('monitorLabel') : t('restLabel')}
              </div>
              {wellnessBaseline && (() => {
                const z = wellnessBaseline.sd > 0
                  ? (todayRec.score - wellnessBaseline.mean) / wellnessBaseline.sd
                  : 0
                if (z >= -1.0) return null
                const severe = z < -1.5
                const col = severe ? RED : AMBER
                const msg = severe
                  ? (lang === 'tr' ? `Normalin ${Math.abs(z).toFixed(1)}σ altında — belirgin düşüş` : `${Math.abs(z).toFixed(1)}σ below your norm — notable dip`)
                  : (lang === 'tr' ? `Normalin altında (ort. ${wellnessBaseline.mean})` : `Below your 28d avg (${wellnessBaseline.mean})`)
                return (
                  <div style={{ marginTop: '5px', fontSize: '9px', color: col, letterSpacing: '0.06em' }}>
                    {severe ? '⚠ ' : '↓ '}{msg}
                  </div>
                )
              })()}
            </div>
          </div>
          {recovery.length >= 3 && (() => {
            const pts = [...recovery].sort((a,b) => a.date.localeCompare(b.date)).slice(-7).filter(e => typeof e.score === 'number')
            if (pts.length < 3) return null
            const scores = pts.map(e => e.score)
            const W = 120, H = 28
            const minS = Math.min(...scores, 0), maxS = Math.max(...scores, 100)
            const range = maxS - minS || 1
            const toX = i => Math.round((i / (scores.length - 1)) * (W - 4)) + 2
            const toY = v => Math.round(H - 2 - ((v - minS) / range) * (H - 4))
            const polyline = scores.map((v,i) => `${toX(i)},${toY(v)}`).join(' ')
            const scoreColor = todayRec.score >= 75 ? GREEN : todayRec.score >= 50 ? AMBER : RED
            return (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontFamily: MONO, fontSize: '8px', color: '#555', letterSpacing: '0.08em', marginBottom: '3px' }}>
                  {lang === 'tr' ? '7 GÜNLÜK HAZIRLIK' : '7-DAY READINESS'}
                </div>
                <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
                  <line x1="2" y1={toY(50)} x2={W-2} y2={toY(50)} stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />
                  <polyline points={polyline} fill="none" stroke={scoreColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={toX(scores.length-1)} cy={toY(scores[scores.length-1])} r="2.5" fill={scoreColor} />
                </svg>
              </div>
            )
          })()}
          {/* P2 — 28-day baseline reference (always shown when data exists) */}
          {wellnessBaseline && (
            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#444', marginTop: '8px', letterSpacing: '0.05em' }}>
              {lang === 'tr' ? '28g ort' : '28d avg'}:{' '}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{wellnessBaseline.mean}</span>
              {wellnessBaseline.sd > 0 && <span style={{ color: '#444' }}> ± {wellnessBaseline.sd}</span>}
              <span style={{ color: '#333' }}> · {wellnessBaseline.n} {lang === 'tr' ? 'gün' : 'days'}</span>
            </div>
          )}
          </>
        ) : wellnessSaved ? (
          <>
            <div style={{ color: GREEN, fontSize: '12px' }}>
              {alreadySubmitted ? t('alreadySubmitted') : `✓ ${t('todaySaved')}`}
            </div>
            <Suspense fallback={null}><WellnessSparkline recovery={recovery} /></Suspense>
          </>
        ) : (
          <>
            {/* Field completion circles */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {QUICK_FIELDS.map(field => (
                <span key={field.key} style={{ fontFamily: MONO, fontSize: '12px', color: wellness[field.key] ? '#ff6600' : '#333' }}>
                  {wellness[field.key] ? '◉' : '○'}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {QUICK_FIELDS.map(field => (
                <div key={field.key}>
                  <div style={{ ...S.sectionLabel, marginBottom: '6px' }}>{t(field.lk)}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {field.emoji.map((em, i) => {
                      const isSelected = wellness[field.key] === i + 1
                      return (
                        <button type="button" key={i} aria-label={`${field.key} level ${i + 1}`}
                          onClick={() => setWellness(w => ({ ...w, [field.key]: i + 1 }))}
                          style={{ fontSize: '18px', padding: '8px 8px', borderRadius: '5px', cursor: 'pointer', border: `2px solid ${isSelected ? ORANGE : 'var(--border)'}`, background: isSelected ? '#2a1800' : 'var(--surface)', lineHeight: 1, transform: isSelected ? 'scale(1.15)' : 'scale(1)', transition: 'transform 150ms ease-out' }}>
                          {em}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={saveReadiness}
              disabled={isSubmitting}
              style={{ ...btn(isSubmitting ? '#555' : saveDone ? '#2d6a2d' : ORANGE), opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? 'SAVING...' : saveDone ? 'SAVED ◈' : t('todaySaveReadiness')}
            </button>
            <button onClick={() => setTab('recovery')}
              style={{ ...btn('transparent', '#555'), border: '1px solid var(--border)', marginLeft: '8px' }}>
              {t('t_recovery')} →
            </button>
          </>
        )}
      </div>

      {consistency && consistency.currentGap >= 2 && todayCtl > 30 && (
        <div style={{ fontSize: '10px', color: '#555', fontFamily: "'IBM Plex Mono', monospace", marginBottom: '12px' }}>
          Last session: {consistency.currentGap}d ago — CTL decaying at {(K_CTL * todayCtl).toFixed(1)} TSS/day
        </div>
      )}

      {/* ── Recovery Protocols Card ───────────────────────────────────────── */}
      {wellnessSaved && todayRec && (todayRec.soreness < 3 || todayRec.energy < 3) && (() => {
        const lastTSS = (log || []).length > 0
          ? [...(log || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.tss || 0
          : 0
        const lastEntry = (log || []).length > 0
          ? [...(log || [])].sort((a, b) => b.date.localeCompare(a.date))[0]
          : null
        const hoursSinceLastSession = lastEntry
          ? Math.max(0, (Date.now() - new Date(lastEntry.date + 'T12:00:00').getTime()) / 3600000)
          : 48
        const protocols = getRecommendedProtocols(todayRec.score, lastTSS, hoursSinceLastSession)
        const evBadgeColor = lvl => lvl === 'strong' ? '#5bc25b' : lvl === 'moderate' ? '#ff6600' : '#888'

        return (
          <div style={{ ...card, borderLeft: `4px solid #5bc25b` }}>
            <div style={cardTitle}>◈ RECOVERY PROTOCOLS</div>
            {protocols.map(p => {
              const isExpanded = expandedProtocol === p.id
              const isDone     = !!recoveryDone[p.id]
              return (
                <div key={p.id} style={{
                  marginBottom: '10px', padding: '10px 12px',
                  background: 'var(--surface)', borderRadius: '6px',
                  border: `1px solid ${isDone ? '#5bc25b44' : 'var(--border)'}`,
                  opacity: isDone ? 0.7 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: isDone ? '#5bc25b' : 'var(--text)', marginBottom: '4px' }}>
                        {isDone ? '✓ ' : ''}{p.name}
                      </div>
                      {/* O3 — when_to_use rationale */}
                      {p.when_to_use && (
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginBottom: '6px', lineHeight: 1.5 }}>
                          {p.when_to_use}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ ...badge('#888'), fontSize: '9px' }}>{p.duration}</span>
                        <span style={{ ...badge(evBadgeColor(p.evidence_level)), fontSize: '9px' }}>
                          {p.evidence_level.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: MONO, fontSize: '10px', color: '#888' }}>
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={e => setRecoveryDone(prev => ({ ...prev, [p.id]: e.target.checked }))}
                          style={{ accentColor: '#5bc25b' }}
                        />
                        done
                      </label>
                      <button
                        onClick={() => setExpandedProtocol(isExpanded ? null : p.id)}
                        aria-label={isExpanded ? 'Collapse protocol steps' : 'Expand protocol steps'}
                        style={{ ...btn('transparent', '#888'), border: '1px solid var(--border)', padding: '3px 8px', fontSize: '10px' }}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <ol style={{ margin: '10px 0 0 0', padding: '0 0 0 16px', fontFamily: MONO, fontSize: '10px', color: '#aaa', lineHeight: 1.8 }}>
                      {p.steps.map((step, si) => (
                        <li key={si} style={{ marginBottom: '2px' }}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── Card 3: Quick Stats ────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>{t('todayQuickStats')}</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>

          <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '10px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{yesterdayLogged ? '✓' : '—'}</div>
            <div style={{ fontSize: '9px', color: yesterdayLogged ? GREEN : '#444', letterSpacing: '0.08em' }}>{t('todayYesterday')}</div>
          </div>

          <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '10px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: ORANGE, marginBottom: '4px' }}>{sessions7d}</div>
            <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.08em' }}>{t('todayThisWeek')}</div>
          </div>

          <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '10px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: consecutiveDays >= 3 ? ORANGE : '#888', marginBottom: '4px' }}>
              {consecutiveDays}
            </div>
            <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.08em' }}>{t('todayConsec')}</div>
          </div>

          {/* P4 — ACWR ratio tile (computed but only used in share canvas before) */}
          {acwrRatio !== null && (log || []).length >= 7 && (
            <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '10px 8px', background: 'var(--surface)', borderRadius: '6px', border: `1px solid ${acwrRatio > 1.3 ? RED : acwrRatio < 0.8 ? AMBER : 'var(--border)'}` }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: acwrRatio > 1.3 ? RED : acwrRatio < 0.8 ? AMBER : ORANGE, marginBottom: '4px' }}>
                {acwrRatio.toFixed(2)}
              </div>
              <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.08em' }}>ACWR</div>
            </div>
          )}

          {/* E66 — Readiness score tile */}
          {todayReadiness != null && (
            <div style={{
              flex: '1 1 80px', textAlign: 'center', padding: '10px 8px',
              background: 'var(--surface)', borderRadius: '6px',
              border: `1px solid ${todayReadiness >= 75 ? GREEN : todayReadiness >= 50 ? AMBER : RED}44`,
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: todayReadiness >= 75 ? GREEN : todayReadiness >= 50 ? AMBER : RED, marginBottom: '4px' }}>
                {todayReadiness}
              </div>
              <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.08em' }}>
                {lang === 'tr' ? 'HAZIRLIK' : 'READINESS'}
              </div>
            </div>
          )}

        </div>

        {!yesterdayLogged && (log || []).length > 0 && (
          <button onClick={() => { setLogPrefill({ date: yesterday }); setTab('log') }}
            style={{ ...btn('transparent', '#555'), border: '1px solid var(--border)', marginTop: '12px', width: '100%' }}>
            {t('todayLogYesterday')}
          </button>
        )}
        {(log || []).length >= 3 && (
          <button
            onClick={handleShare}
            disabled={shareLoading}
            style={{ ...btn('transparent', '#555'), border: '1px solid var(--border)', marginTop: '8px', width: '100%', opacity: shareLoading ? 0.6 : 1 }}
          >
            {shareLoading ? '…' : t('shareProgress')}
          </button>
        )}
      </div>

      {/* v9.66.0 — Coach discovery nudge. Fresh users (no log yet) previously
          had zero surface telling them the coach feature exists; it was
          buried in Profile. Shown only for empty-log athletes to avoid
          nagging users who are already established or already attached. */}
      {(log || []).length === 0 && (
        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888', marginBottom: '10px', padding: '8px 12px', border: '1px dashed #0064ff44', borderRadius: '4px', background: '#0064ff08', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 200px' }}>
            {lang === 'tr' ? '◆ Antrenörünüz var mı? Davet kodunuzu Profil\'de girin.' : '◆ Have a coach? Enter your invite code in Profile.'}
          </span>
          <button onClick={() => setTab('profile')} style={{ background: 'none', border: '1px solid #0064ff44', color: '#0064ff', fontFamily: MONO, fontSize: '9px', cursor: 'pointer', padding: '4px 10px', borderRadius: '3px', minHeight: '28px', flexShrink: 0 }}>
            {lang === 'tr' ? 'PROFİL →' : 'PROFILE →'}
          </button>
        </div>
      )}

      {/* ── P5 — Race date nudge when raceDate not set ──────────────────── */}
      {!profile?.raceDate && (log || []).length >= 10 && (
        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#444', marginBottom: '10px', padding: '7px 12px', border: '1px solid #222', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span>{lang === 'tr' ? '▷ Hedef yarış tarihi yok — Profile\'de ekle → geri sayım + taper rehberi' : '▷ No race date set — add one in Profile for countdown + taper guidance'}</span>
          <button onClick={() => setTab('profile')} style={{ background: 'none', border: 'none', color: ORANGE, fontFamily: MONO, fontSize: '9px', cursor: 'pointer', padding: '0', flexShrink: 0 }}>→ {lang === 'tr' ? 'Profil' : 'Profile'}</button>
        </div>
      )}

      {/* ── Progress Rings ────────────────────────────────────────────────── */}
      {(log || []).length >= 3 && (() => {
        const R = 26, SW = 6, SZ = 74
        const circ = 2 * Math.PI * R
        const tssPct     = weekTSSTarget > 0 ? Math.min(1, weekTSS / weekTSSTarget)   : 0
        const sessPct    = Math.min(1, sessions7d / sessionTarget)
        const wellPct    = Math.min(1, wellDays / 7)

        const Ring = ({ pct, color, val, label, sub }) => (
          <div style={{ textAlign: 'center', flex: '1 1 64px' }}>
            <svg width={SZ} height={SZ} style={{ display: 'block', margin: '0 auto' }}>
              <circle cx={SZ/2} cy={SZ/2} r={R} fill="none" stroke="#222" strokeWidth={SW}/>
              <circle cx={SZ/2} cy={SZ/2} r={R} fill="none" stroke={color} strokeWidth={SW}
                strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                transform={`rotate(-90 ${SZ/2} ${SZ/2})`}/>
              <text x={SZ/2} y={SZ/2 + 5} fill={pct >= 1 ? color : 'var(--text)'}
                fontFamily="monospace" fontSize="14" fontWeight="700" textAnchor="middle">
                {val}
              </text>
            </svg>
            <div style={{ fontSize: '8px', color: '#666', letterSpacing: '0.08em', marginTop: '3px' }}>{label}</div>
            <div style={{ fontSize: '8px', color: '#444' }}>{sub}</div>
          </div>
        )

        return (
          <div style={card}>
            <div style={cardTitle}>{t('weeklyRings')}</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              <Ring pct={tssPct}  color={ORANGE} val={weekTSS}   label={t('weekTSS')}   sub={weekTSSTarget > 0 ? `/ ${weekTSSTarget}` : 'no target'} />
              <Ring pct={sessPct} color={GREEN}  val={sessions7d} label={t('sessions')}  sub={`/ ${sessionTarget}`} />
              <Ring pct={wellPct} color={BLUE}   val={wellDays} label={t('wellness')}  sub="/ 7" />
            </div>
          </div>
        )
      })()}

      {/* ── Upcoming Coach Sessions (RSVP) ────────────────────────────────── */}
      {coachSessions.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={cardTitle}>
              {lang === 'tr' ? 'YAKLAŞAN ANTRENMANLAR' : 'UPCOMING SESSIONS'}
            </div>
            <button
              onClick={() => setShowQrScanner(true)}
              style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, padding: '3px 9px', background: 'none', border: `1px solid ${ORANGE}`, borderRadius: '3px', color: ORANGE, cursor: 'pointer', letterSpacing: '0.06em' }}
            >
              ▣ {lang === 'tr' ? 'QR TARA' : 'SCAN QR'}
            </button>
          </div>
          {coachSessions.map(s => {
            const myStatus = s._myStatus || 'pending'
            const busy     = rsvpBusy[s.id]
            const fmtDate  = d => d ? d.slice(5).replace('-', '/') : '—'
            return (
              <div key={s.id} style={{ marginBottom: '10px', padding: '10px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text)', fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#666', marginTop: '2px' }}>
                      {fmtDate(s.session_date)}{s.session_time ? ' · ' + s.session_time : ''}
                    </div>
                    {s.notes && <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginTop: '3px' }}>{s.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    {myStatus === 'confirmed' ? (
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: GREEN }}>✓ {lang === 'tr' ? 'Katılıyorum' : 'Confirmed'}</span>
                    ) : myStatus === 'declined' ? (
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: '#e03030' }}>✗ {lang === 'tr' ? 'Katılmıyorum' : 'Declined'}</span>
                    ) : (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => handleRsvp(s.id, 'confirmed')}
                          style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, padding: '3px 9px', background: GREEN, border: 'none', borderRadius: '2px', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                        >
                          {lang === 'tr' ? 'Katılıyorum' : 'Confirm'}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleRsvp(s.id, 'declined')}
                          style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, padding: '3px 9px', background: 'transparent', border: '1px solid #e03030', borderRadius: '2px', color: '#e03030', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                        >
                          {lang === 'tr' ? 'Katılmıyorum' : 'Decline'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* QR Scanner modal */}
      {showQrScanner && (
        <QRScanner
          onScan={handleQrScan}
          onClose={() => setShowQrScanner(false)}
          lang={lang}
        />
      )}

      {/* ── Team Announcements (athlete view, only when connected to coach) ── */}
      {myCoachId && <TeamAnnouncements coachId={myCoachId} isCoach={false} />}

      {/* ── RESTQ-Sport nudge ─────────────────────────────────────────────── */}
      {restqDue && (
        <div style={{ ...card, borderLeft: `4px solid #f5c542`, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700, color: '#f5c542', letterSpacing: '0.08em', marginBottom: '3px' }}>
              RESTQ-SPORT {lang === 'tr' ? 'EKRANI BEKLEMEDE' : 'SCREENING DUE'}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#888' }}>
              {lang === 'tr' ? '28 günlük stres/toparlanma anketi — Protokoller sekmesinde.' : '28-day stress/recovery questionnaire — visit the Protocols tab.'}
            </div>
          </div>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>📋</span>
        </div>
      )}

      {/* ── M2 — Latest RESTQ result badge ───────────────────────────────── */}
      {restqLatest && !restqDue && (() => {
        const INTERP_C = { well_recovered: GREEN, adequate: BLUE, watch: AMBER, overreaching_risk: RED }
        const ic = INTERP_C[restqLatest.interpretation] || '#555'
        return (
          <div style={{ fontFamily: MONO, fontSize: '10px', padding: '7px 12px', marginBottom: '10px', background: `${ic}11`, border: `1px solid ${ic}33`, borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ minWidth: '36px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: ic, lineHeight: 1 }}>{restqLatest.balance?.toFixed(1) ?? '—'}</div>
              <div style={{ fontSize: '7px', color: '#555', letterSpacing: '0.06em' }}>RESTQ</div>
            </div>
            <div>
              <div style={{ color: ic, fontWeight: 700, letterSpacing: '0.06em' }}>
                {lang === 'tr' ? restqLatest.interpretationLabel?.tr : restqLatest.interpretationLabel?.en}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '2px' }}>{restqLatest.date}</div>
            </div>
          </div>
        )
      })()}

      {/* ── Card 4: Smart Suggestion ───────────────────────────────────────── */}
      <div style={{ ...card }}>
        <div style={cardTitle}>{t('todaySuggestion')}</div>
        {!suggestion && (
          <div style={{ fontSize: '11px', color: '#555', fontFamily: MONO }}>
            {lang === 'tr' ? 'Öneri oluşturmak için daha fazla antrenman kaydı gerekiyor.' : 'Log a few sessions to receive a smart suggestion.'}
          </div>
        )}
        {suggestion && (
          <div style={{ marginBottom: '16px' }}>
            {/* O2 — suggestion source badge */}
            {suggestion.source && suggestion.source !== 'default' && (() => {
              const SRC = {
                wellness_poor:   { label: lang==='tr' ? '⚠ TOPARLANMA DÜŞÜK' : '⚠ WELLNESS LOW',      color: RED   },
                acwr_high:       { label: '↑ ACWR HIGH',                                               color: AMBER },
                acwr_spike:      { label: '⚠ ACWR SPIKE',                                              color: RED   },
                acwr_low:        { label: '↓ ACWR LOW',                                                color: BLUE  },
                tsb_high:        { label: lang==='tr' ? '↑ FORM YÜKSEK' : '↑ TSB HIGH',               color: GREEN },
                tsb_low:         { label: lang==='tr' ? '↓ FORM DÜŞÜK'  : '↓ TSB LOW',                color: AMBER },
              }
              const s = SRC[suggestion.source]
              if (!s) return null
              return (
                <div style={{ display:'inline-flex', marginBottom:'6px', padding:'2px 7px', background:`${s.color}11`, border:`1px solid ${s.color}33`, borderRadius:'3px', fontFamily:MONO, fontSize:'9px', color:s.color, letterSpacing:'0.06em' }}>
                  {s.label}
                </div>
              )
            })()}
            <div style={{ fontSize: '11px', color: 'var(--text)', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
              {suggestion.action}
            </div>
            <div style={{ fontSize: '10px', color: '#555', fontFamily: "'IBM Plex Mono', monospace", marginTop: '3px' }}>
              {suggestion.rationale}
            </div>
            {suggestion.duration && (
              <div style={{ fontSize: '9px', color: '#444', fontFamily: "'IBM Plex Mono', monospace", marginTop: '2px' }}>
                → {suggestion.duration}min · {suggestion.load}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── E6 — Science Insights (interpretACWR / interpretCTL / interpretTSB) ── */}
      {scienceInsights.length > 0 && (
        <div style={{ ...card, borderLeft: `4px solid ${BLUE}` }}>
          <div style={cardTitle}>◈ {t('insightsTitle')}</div>
          {scienceInsights.slice(0, 3).map((insight, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: i < scienceInsights.length - 1 ? '10px' : 0 }}>
              <span style={{ color: BLUE, flexShrink: 0, fontSize: '10px', marginTop: '1px' }}>▸</span>
              <div style={{ fontFamily: MONO, fontSize: '10px', color: 'var(--sub,#aaa)', lineHeight: 1.7 }}>
                {insight[lang] || insight.en}
              </div>
            </div>
          ))}
        </div>
      )}

      </details>
    </div>
  )
}
