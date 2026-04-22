// ─── TodayView.jsx — v5.14.0: Single-screen daily HQ ─────────────────────────
import { useState, useMemo, useContext, useRef, useEffect, lazy, Suspense } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { getTodayPlannedSession, getSingleSuggestion, generateDailyDigest, getTimeOfDayAdvice, predictFitness } from '../lib/intelligence.js'
import { calcLoad } from '../lib/formulas.js'
import { WELLNESS_FIELDS } from '../lib/constants.js'
import { hasUnread } from './CoachMessage.jsx'
import { getMyCoach } from '../lib/inviteUtils.js'
import { getUpcomingSessions, upsertAttendance } from '../lib/db/coachSessions.js'
import TeamAnnouncements from './TeamAnnouncements.jsx'
import QRScanner from './QRScanner.jsx'
import { supabase } from '../lib/supabase.js'
import { getRecommendedProtocols } from '../lib/recoveryProtocols.js'

const WellnessSparkline = lazy(() => import('./charts/WellnessSparkline.jsx'))
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
  if (!dates.has(today)) start.setDate(start.getDate() - 1)
  let consecutiveDays = 0
  while (true) {
    const d = start.toISOString().slice(0, 10)
    if (dates.has(d)) { consecutiveDays++; start.setDate(start.getDate() - 1) }
    else break
  }
  return consecutiveDays
}

const QUICK_FIELDS = WELLNESS_FIELDS.filter(f => ['sleep', 'energy', 'soreness'].includes(f.key))

export default function TodayView({ log, setTab, setLogPrefill }) {
  const { t, lang }   = useContext(LangCtx)
  const { recovery, setRecovery, profile } = useData()

  const [plan]       = useLocalStorage('sporeus-plan',        null)
  const [planStatus, setPlanStatus] = useLocalStorage('sporeus-plan-status', {})

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()

  const plannedSession = useMemo(() => getTodayPlannedSession(plan, today), [plan, today])
  const todayKey       = plannedSession ? `${plannedSession.weekIdx}-${plannedSession.dayIdx}` : null
  const todayStatus    = todayKey ? planStatus[todayKey] : null

  const suggestion = useMemo(() => getSingleSuggestion(log, recovery, profile), [log, recovery, profile])
  const digest     = useMemo(() => generateDailyDigest(log, recovery, profile), [log, recovery, profile])

  const yesterdayLogged = (log || []).some(e => e.date === yesterday)
  const sessions7d      = useMemo(() => {
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })()
    return (log || []).filter(e => e.date >= cutoff).length
  }, [log])
  const consecutiveDays = useMemo(() => calcConsecutiveDays(log, today), [log, today])

  // Consecutive days with wellness logged
  const wellDays = useMemo(() => {
    const recDates = new Set((recovery || []).map(e => e.date))
    const d = new Date(today)
    if (!recDates.has(today)) d.setDate(d.getDate() - 1)
    let s = 0
    while (recDates.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1) }
    return s
  }, [recovery, today])

  // Week TSS (Mon–Sun current week)
  const weekTSS = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - (d.getDay() + 6) % 7)
    const ws = d.toISOString().slice(0, 10)
    return Math.round((log || []).filter(e => e.date >= ws).reduce((s, e) => s + (e.tss || 0), 0))
  }, [log, today])

  // ── Z-score personal baseline (28-day rolling) ──────────────────────────────
  const wellnessBaseline = useMemo(() => {
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10) })()
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
      const athleteId = supabase.auth?.getUser ? (await supabase.auth.getUser())?.data?.user?.id : null
      if (!athleteId) return
      const coachId = await getMyCoach(supabase, athleteId)
      if (!coachId || cancelled) return
      if (!cancelled) setMyCoachId(coachId)
      const { data } = await getUpcomingSessions(coachId, 14)
      if (!cancelled && data) setCoachSessions(data)
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
        const d = new Date(today); d.setDate(d.getDate() - i)
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

    const score = Math.round((wellness.sleep + wellness.energy + (6 - wellness.soreness)) / 3 * 20)
    const entry = {
      date: today, sleep: wellness.sleep, energy: wellness.energy,
      soreness: wellness.soreness, mood: 3, stress: 3, score,
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

  return (
    <div className="sp-fade">

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
              <span onClick={() => { localStorage.setItem(`sporeus-recap-seen-${weeklyRecap.weekLabel}`, '1'); setRecapDismissed(true) }}
                style={{ cursor: 'pointer', fontFamily: MONO, fontSize: '9px', color: '#333' }}>[×]</span>
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
            onClick={() => setTab(ORIENTATION_MESSAGES[orientationStep].tab)}
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
          const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10)
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
            <span style={{ fontSize:'9px', color:'#555', letterSpacing:'0.08em', marginRight:'2px' }}>VO₂max {profile.vo2max} · /km</span>
            {[['EASY', paceRef.easy, GREEN], ['THRESH', paceRef.threshold, AMBER], ['INT', paceRef.interval, RED]].map(([label, val, color]) => (
              <span key={label} style={{ fontSize:'10px', color, border:`1px solid ${color}33`, borderRadius:'3px', padding:'2px 7px' }}>
                {label} {fmt(val)}
              </span>
            ))}
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
            </div>
          </div>
        )
      })()}

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
          const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
        })
        const hasRestDays = last3.every(d => !(log || []).find(e => e.date === d))
        if (ctl > 40 && hasRestDays) {
          return (
            <div style={{ ...card, borderLeft: '3px solid #f5c542', padding: '12px 18px' }}>
              <div style={{ fontFamily: MONO, fontSize: '11px', color: '#f5c542', lineHeight: 1.6 }}>
                3 rest days — CTL decaying at ~2.3% per day. Consider a short activation session.
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

      {/* ── Card 1: Today's Session ────────────────────────────────────────── */}
      <div style={{ ...card, borderLeft: `4px solid ${plannedSession && todayStatus === 'done' ? GREEN : ORANGE}` }}>
        <div style={cardTitle}>{t('todaySession')}</div>

        {plannedSession ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
                {plannedSession.type}
              </span>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {plannedSession.duration} min
                {plannedSession.rpe ? ` · RPE ${plannedSession.rpe}` : ''}
                {plannedSession.weekPhase ? ` · ${plannedSession.weekPhase}` : ''}
              </span>
            </div>
            {plannedSession.description && (
              <p style={{ fontSize: '11px', color: '#888', lineHeight: 1.55, marginBottom: '12px' }}>
                {plannedSession.description}
              </p>
            )}
            {todayStatus === 'done' ? (
              <span style={badge(GREEN)}>✓ {t('todayDone')}</span>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={logThisSession} style={btn(ORANGE)}>{t('todayLogThis')}</button>
                <button onClick={markDone} style={btn('transparent', '#888')}
                  onMouseOver={e => e.currentTarget.style.color = '#ccc'}
                  onMouseOut={e  => e.currentTarget.style.color = '#888'}>
                  {t('todayMarkDone')}
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#555', fontSize: '12px', lineHeight: 1.6 }}>
            {plan
              ? <span style={{ color: AMBER }}>◆ {t('todayRest')}</span>
              : (
                <>
                  <div style={{ color: '#555', marginBottom: '10px' }}>{t('todayNoPlan')}</div>
                  <button onClick={() => setTab('plan')} style={btn(ORANGE)}>{t('t_plan')} →</button>
                </>
              )
            }
          </div>
        )}
      </div>

      {/* ── Card 2: Readiness Quick-Check ─────────────────────────────────── */}
      <div style={{ ...card, borderLeft: `4px solid ${todayRec ? (todayRec.score >= 75 ? GREEN : todayRec.score >= 50 ? AMBER : RED) : '#333'}` }}>
        <div style={cardTitle}>{t('todayReadiness')}</div>

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
              {alreadySubmitted ? '✓ Already submitted today' : `✓ ${t('todaySaved')}`}
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

    </div>
  )
}
